/**
 * Client für die Open-Meteo-API.
 *
 * Zwei Endpunkte:
 *  - archive-api  : gemessene Vergangenheit (ERA5), verfügbar ab 1940,
 *                   mit rund fünf Tagen Verzögerung.
 *  - api/forecast : Vorhersage bis 16 Tage, dazu über `past_days` die
 *                   jüngste Vergangenheit, die im Archiv noch fehlt.
 *
 * Kein API-Schlüssel nötig. Daten stehen unter CC BY 4.0.
 */

import { API_BASE, ARCHIVE_BASE, TIMEZONE, type Location } from './config.js';

/** Ein Tageswert, so wie ihn die API liefert. */
export interface DailyRecord {
  readonly date: string;
  readonly tempMax: number | null;
  readonly tempMin: number | null;
  readonly precipitation: number | null;
  readonly weatherCode: number | null;
  readonly precipitationProbability: number | null;
}

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  weather_code: (number | null)[];
  precipitation_probability_max?: (number | null)[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  daily: OpenMeteoDaily;
  error?: boolean;
  reason?: string;
}

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 4;

async function requestJson(url: string): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const body: unknown = await response.json();

      // Open-Meteo meldet fachliche Fehler mit HTTP 400 und { error, reason }.
      if (typeof body === 'object' && body !== null && 'error' in body) {
        const reason = (body as { reason?: string }).reason ?? 'unbekannter Fehler';
        throw new Error(`Open-Meteo: ${reason}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

      return body;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.warn(`  Versuch ${attempt} fehlgeschlagen (${String(error)}), neuer Versuch in ${waitMs} ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error(`Abruf endgültig fehlgeschlagen: ${String(lastError)}`);
}

/** Bei mehreren Koordinaten antwortet die API mit einem Array, sonst mit einem Objekt. */
function normalise(body: unknown): OpenMeteoResponse[] {
  return Array.isArray(body) ? (body as OpenMeteoResponse[]) : [body as OpenMeteoResponse];
}

function toRecords(daily: OpenMeteoDaily): DailyRecord[] {
  return daily.time.map((date, i) => ({
    date,
    tempMax: daily.temperature_2m_max[i] ?? null,
    tempMin: daily.temperature_2m_min[i] ?? null,
    precipitation: daily.precipitation_sum[i] ?? null,
    weatherCode: daily.weather_code[i] ?? null,
    precipitationProbability: daily.precipitation_probability_max?.[i] ?? null,
  }));
}

/** Gemessene Historie für einen Ort. */
export async function fetchArchive(
  location: Location,
  startDate: string,
  endDate: string,
): Promise<DailyRecord[]> {
  const url =
    `${ARCHIVE_BASE}/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
    `&timezone=${encodeURIComponent(TIMEZONE)}`;

  const [response] = normalise(await requestJson(url));
  if (!response?.daily) throw new Error(`Keine Archivdaten für ${location.name}`);
  return toRecords(response.daily);
}

/**
 * Vorhersage plus jüngste Vergangenheit – für alle Orte in einem einzigen
 * Request, die API nimmt kommagetrennte Koordinaten entgegen.
 */
export async function fetchForecast(
  locations: readonly Location[],
  pastDays: number,
  forecastDays: number,
): Promise<Map<string, DailyRecord[]>> {
  const latitudes = locations.map((l) => l.latitude).join(',');
  const longitudes = locations.map((l) => l.longitude).join(',');

  const url =
    `${API_BASE}/v1/forecast?latitude=${latitudes}&longitude=${longitudes}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code,precipitation_probability_max` +
    `&timezone=${encodeURIComponent(TIMEZONE)}&past_days=${pastDays}&forecast_days=${forecastDays}`;

  const responses = normalise(await requestJson(url));
  if (responses.length !== locations.length) {
    throw new Error(`Erwartet ${locations.length} Antworten, erhalten ${responses.length}`);
  }

  // Die Reihenfolge der Antworten entspricht der Reihenfolge der Koordinaten.
  const result = new Map<string, DailyRecord[]>();
  locations.forEach((location, i) => {
    const daily = responses[i]?.daily;
    if (!daily) throw new Error(`Keine Vorhersagedaten für ${location.name}`);
    result.set(location.slug, toRecords(daily));
  });
  return result;
}
