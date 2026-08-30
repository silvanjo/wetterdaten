/**
 * Datenhaltung in SQLite (node:sqlite, seit Node 22 eingebaut – keine
 * zusätzliche Abhängigkeit, kein Kompilieren).
 *
 * Kernregel des Schemas: Jeder Tag existiert genau einmal pro Ort, und ein
 * gemessener Wert wird nie wieder von einer Vorhersage überschrieben.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from './config.js';
import type { DailyRecord } from './openmeteo.js';

export type Kind = 'measured' | 'forecast';

/**
 * Herkunft der Zahl – unabhängig davon, wie sie angezeigt wird.
 *  archive      : ERA5-Reanalyse, der belastbare Messwert.
 *  forecast_api : Vorhersage-Endpunkt. Für künftige Tage die Prognose, für die
 *                 letzten Tage ein vorläufiger Wert, den der nächste
 *                 Archivlauf durch den endgültigen ersetzt.
 */
export type Source = 'archive' | 'forecast_api';

export interface StoredDay extends DailyRecord {
  readonly kind: Kind;
  readonly source: Source;
  readonly fetchedAt: string;
}

interface Row {
  date: string;
  temp_max: number | null;
  temp_min: number | null;
  precipitation: number | null;
  weather_code: number | null;
  precipitation_probability: number | null;
  kind: string;
  source: string;
  fetched_at: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS observations (
  location                  TEXT    NOT NULL,
  date                      TEXT    NOT NULL,
  temp_max                  REAL,
  temp_min                  REAL,
  precipitation             REAL,
  weather_code              INTEGER,
  precipitation_probability INTEGER,
  kind                      TEXT    NOT NULL CHECK (kind IN ('measured', 'forecast')),
  source                    TEXT    NOT NULL CHECK (source IN ('archive', 'forecast_api')),
  fetched_at                TEXT    NOT NULL,
  PRIMARY KEY (location, date)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_observations_location_date
  ON observations (location, date DESC);
`;

export function openDatabase(path: string = DB_PATH): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/**
 * Schreibt Tageswerte.
 *
 * Die WHERE-Klausel am DO UPDATE ist die eigentliche Integritätsregel:
 * geschrieben wird nur, wenn der neue Wert aus dem Archiv stammt oder der
 * bestehende bloß vorläufig war. Ein endgültiger Archivwert kann damit nie
 * von einer Prognose überschrieben werden – auch nicht bei einem
 * versehentlichen Doppellauf oder falsch gesetzter Systemzeit.
 *
 * @returns Anzahl tatsächlich geschriebener Zeilen.
 */
export function upsertDays(
  db: DatabaseSync,
  locationSlug: string,
  records: readonly DailyRecord[],
  source: Source,
  today: string,
): number {
  const statement = db.prepare(`
    INSERT INTO observations
      (location, date, temp_max, temp_min, precipitation,
       weather_code, precipitation_probability, kind, source, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (location, date) DO UPDATE SET
      temp_max                  = excluded.temp_max,
      temp_min                  = excluded.temp_min,
      precipitation             = excluded.precipitation,
      weather_code              = excluded.weather_code,
      precipitation_probability = excluded.precipitation_probability,
      kind                      = excluded.kind,
      source                    = excluded.source,
      fetched_at                = excluded.fetched_at
    WHERE excluded.source = 'archive' OR observations.source = 'forecast_api'
  `);

  const fetchedAt = new Date().toISOString();
  let written = 0;

  db.exec('BEGIN');
  try {
    for (const record of records) {
      // Tage ohne jeden Messwert gar nicht erst aufnehmen.
      if (record.tempMax === null && record.tempMin === null && record.precipitation === null) {
        continue;
      }
      // Vergangene Tage sind Messwerte, alles ab heute ist Vorhersage.
      const kind: Kind = record.date < today ? 'measured' : 'forecast';

      const result = statement.run(
        locationSlug,
        record.date,
        record.tempMax,
        record.tempMin,
        record.precipitation,
        record.weatherCode,
        record.precipitationProbability,
        kind,
        source,
        fetchedAt,
      );
      written += Number(result.changes);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return written;
}

function toStoredDay(row: Row): StoredDay {
  return {
    date: row.date,
    tempMax: row.temp_max,
    tempMin: row.temp_min,
    precipitation: row.precipitation,
    weatherCode: row.weather_code,
    precipitationProbability: row.precipitation_probability,
    kind: row.kind as Kind,
    source: row.source as Source,
    fetchedAt: row.fetched_at,
  };
}

export function getDays(db: DatabaseSync, locationSlug: string, kind?: Kind): StoredDay[] {
  const sql = kind
    ? 'SELECT * FROM observations WHERE location = ? AND kind = ? ORDER BY date'
    : 'SELECT * FROM observations WHERE location = ? ORDER BY date';
  const rows = (kind
    ? db.prepare(sql).all(locationSlug, kind)
    : db.prepare(sql).all(locationSlug)) as unknown as Row[];
  return rows.map(toStoredDay);
}

export interface Coverage {
  readonly count: number;
  readonly measured: number;
  readonly forecast: number;
  readonly firstDate: string | null;
  readonly lastMeasured: string | null;
  readonly gaps: readonly string[];
}

/**
 * Abdeckung eines Ortes inklusive fehlender Tage. Genau die Prüfung, an der
 * die alte Seite scheitert – dort fehlen sämtliche Wochenenden.
 */
export function getCoverage(db: DatabaseSync, locationSlug: string): Coverage {
  const rows = db
    .prepare('SELECT date, kind FROM observations WHERE location = ? ORDER BY date')
    .all(locationSlug) as unknown as { date: string; kind: string }[];

  if (rows.length === 0) {
    return { count: 0, measured: 0, forecast: 0, firstDate: null, lastMeasured: null, gaps: [] };
  }

  const present = new Set(rows.map((r) => r.date));
  const measuredDates = rows.filter((r) => r.kind === 'measured').map((r) => r.date);

  const gaps: string[] = [];
  const first = rows[0]!.date;
  const last = rows[rows.length - 1]!.date;

  for (let d = new Date(`${first}T00:00:00Z`); d <= new Date(`${last}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (!present.has(iso)) gaps.push(iso);
  }

  return {
    count: rows.length,
    measured: measuredDates.length,
    forecast: rows.length - measuredDates.length,
    firstDate: first,
    lastMeasured: measuredDates.at(-1) ?? null,
    gaps,
  };
}
