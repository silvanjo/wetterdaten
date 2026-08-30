/**
 * Einziger Datenbefehl: `npm run update`.
 *
 * Der Lauf entscheidet selbst, was zu tun ist – beim ersten Mal holt er die
 * gesamte Historie, danach nur noch das Fenster um heute. Es gibt bewusst
 * keinen separaten Backfill-Befehl, den man vergessen könnte.
 */

import {
  ARCHIVE_LAG_DAYS,
  ARCHIVE_START,
  FORECAST_DAYS,
  LOCATIONS,
  LOOKBACK_DAYS,
} from './config.js';
import { fetchArchive, fetchForecast } from './openmeteo.js';
import { getCoverage, openDatabase, upsertDays } from './db.js';
import { addDays, daysBetween, today } from './dates.js';

async function main(): Promise<void> {
  const db = openDatabase();
  const now = today();
  const archiveEnd = addDays(now, -ARCHIVE_LAG_DAYS);

  console.log(`Aktualisierung ${now}\n`);

  // --- Schritt 1: Archiv (gemessene Vergangenheit) --------------------------
  for (const location of LOCATIONS) {
    const coverage = getCoverage(db, location.slug);

    // Ab dem letzten gesicherten Archivtag weiterladen, sonst von vorn.
    // Die Überlappung von LOOKBACK_DAYS holt vorläufige Werte als endgültige nach.
    const start = coverage.lastMeasured
      ? addDays(coverage.lastMeasured, -LOOKBACK_DAYS)
      : ARCHIVE_START;

    if (daysBetween(start, archiveEnd) < 0) {
      console.log(`${location.name}: Archiv ist aktuell.`);
      continue;
    }

    process.stdout.write(`${location.name}: Archiv ${start} bis ${archiveEnd} … `);
    const records = await fetchArchive(location, start, archiveEnd);
    const written = upsertDays(db, location.slug, records, 'archive', now);
    console.log(`${records.length} Tage geholt, ${written} geschrieben.`);
  }

  // --- Schritt 2: Vorhersage (alle Orte in einem Request) -------------------
  process.stdout.write(`\nVorhersage: ${LOOKBACK_DAYS} Tage zurück, ${FORECAST_DAYS} Tage voraus … `);
  const forecasts = await fetchForecast(LOCATIONS, LOOKBACK_DAYS, FORECAST_DAYS);
  let forecastRows = 0;
  for (const location of LOCATIONS) {
    const records = forecasts.get(location.slug) ?? [];
    forecastRows += upsertDays(db, location.slug, records, 'forecast_api', now);
  }
  console.log(`${forecastRows} Zeilen geschrieben.\n`);

  // --- Schritt 3: Abdeckung prüfen ------------------------------------------
  let problems = 0;
  for (const location of LOCATIONS) {
    const { count, measured, forecast, firstDate, lastMeasured, gaps } = getCoverage(db, location.slug);
    console.log(
      `${location.name}: ${count} Tage (${measured} gemessen, ${forecast} Vorhersage), ` +
        `${firstDate} bis ${lastMeasured}`,
    );
    if (gaps.length > 0) {
      problems += gaps.length;
      console.warn(`  Achtung: ${gaps.length} fehlende Tage, z. B. ${gaps.slice(0, 5).join(', ')}`);
    } else {
      console.log('  Lückenlos.');
    }
  }

  db.close();
  if (problems > 0) {
    console.error(`\nFehlende Tage insgesamt: ${problems}`);
    process.exitCode = 1;
  }
}

await main();
