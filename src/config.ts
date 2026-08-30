/**
 * Zentrale Konfiguration.
 *
 * Ein neuer Ort ist ein Eintrag in LOCATIONS – sonst muss nirgends etwas
 * angefasst werden. Koordinaten lassen sich über
 * https://geocoding-api.open-meteo.com/v1/search?name=ORT&language=de
 * ermitteln.
 */

export interface Location {
  /** Teil des Dateinamens, z. B. "berlin" -> berlin.html */
  readonly slug: string;
  /** Anzeigename in Navigation und Überschrift */
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Gruppenüberschrift in der Seitenleiste */
  readonly region: string;
}

export const LOCATIONS: readonly Location[] = [
  {
    slug: 'gross-kreutz',
    name: 'Groß Kreutz (Havel)',
    latitude: 52.40281,
    longitude: 12.7794,
    region: 'Brandenburg',
  },
  {
    slug: 'berlin',
    name: 'Berlin',
    latitude: 52.52,
    longitude: 13.405,
    region: 'Berlin',
  },
] as const;

/** Erster Tag, den backfill.ts holt. Open-Meteo liefert zurück bis 1940. */
export const ARCHIVE_START = '2022-06-27';

/** Tage in die Zukunft (Open-Meteo erlaubt bis 16). */
export const FORECAST_DAYS = 16;

/**
 * Tage in die Vergangenheit, die der tägliche Lauf mitnimmt. Die Überlappung
 * schließt Lücken, falls der Cron einmal ausfällt, und ersetzt abgelaufene
 * Prognosen durch den tatsächlichen Wert.
 */
export const LOOKBACK_DAYS = 7;

/**
 * Das ERA5-Archiv hinkt der Gegenwart um einige Tage hinterher. So weit vor
 * heute endet der Archivabruf; die Lücke bis heute deckt LOOKBACK_DAYS ab.
 */
export const ARCHIVE_LAG_DAYS = 6;

export const TIMEZONE = 'Europe/Berlin';

export const DB_PATH = new URL('../data/wetter.sqlite', import.meta.url).pathname;
export const OUT_DIR = new URL('../public/', import.meta.url).pathname;

/** Basis-URL der Open-Meteo-API, per Umgebungsvariable überschreibbar (Tests). */
export const API_BASE = process.env.OPEN_METEO_BASE ?? 'https://api.open-meteo.com';
export const ARCHIVE_BASE = process.env.OPEN_METEO_ARCHIVE_BASE ?? 'https://archive-api.open-meteo.com';
