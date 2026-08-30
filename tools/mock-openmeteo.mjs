/**
 * Nachbau der Open-Meteo-Endpunkte für den Testlauf.
 *
 * Der Container dieses Projekts hat keinen Netzzugang zu open-meteo.com. Der
 * Mock liefert die zuvor abgerufenen echten Messwerte im Originalformat, damit
 * update.ts unverändert – also derselbe Code wie in der Produktion – getestet
 * werden kann. Für den Betrieb wird er nicht gebraucht.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.MOCK_PORT ?? 8099);

const LOCATIONS = [
  { slug: 'gross-kreutz', latitude: 52.40281, longitude: 12.7794 },
  { slug: 'berlin', latitude: 52.52, longitude: 13.405 },
];

const parseCsv = (file, withProbability) =>
  readFileSync(new URL(`../seed/${file}`, import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [date, tmax, tmin, rain, code, probability] = line.split(',');
      const number = (v) => (v === undefined || v === '' ? null : Number(v));
      return {
        date,
        tmax: number(tmax),
        tmin: number(tmin),
        rain: number(rain),
        code: number(code),
        probability: withProbability ? number(probability) : null,
      };
    });

const DATA = Object.fromEntries(
  LOCATIONS.map((l) => [
    l.slug,
    { archive: parseCsv(`archive-${l.slug}.csv`, false), forecast: parseCsv(`forecast-${l.slug}.csv`, true) },
  ]),
);

const findLocation = (lat, lon) =>
  LOCATIONS.find((l) => Math.abs(l.latitude - lat) < 0.01 && Math.abs(l.longitude - lon) < 0.01);

function toResponse(location, rows, withProbability) {
  const daily = {
    time: rows.map((r) => r.date),
    temperature_2m_max: rows.map((r) => r.tmax),
    temperature_2m_min: rows.map((r) => r.tmin),
    precipitation_sum: rows.map((r) => r.rain),
    weather_code: rows.map((r) => r.code),
  };
  if (withProbability) daily.precipitation_probability_max = rows.map((r) => r.probability);

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: 'Europe/Berlin',
    daily_units: { time: 'iso8601', temperature_2m_max: '°C', precipitation_sum: 'mm' },
    daily,
  };
}

createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const latitudes = (url.searchParams.get('latitude') ?? '').split(',').map(Number);
  const longitudes = (url.searchParams.get('longitude') ?? '').split(',').map(Number);

  const send = (status, body) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  };

  const locations = latitudes.map((lat, i) => findLocation(lat, longitudes[i]));
  if (locations.some((l) => !l)) {
    return send(400, { error: true, reason: 'Unbekannte Koordinaten im Mock' });
  }

  if (url.pathname === '/v1/archive') {
    const start = url.searchParams.get('start_date');
    const end = url.searchParams.get('end_date');
    const rows = DATA[locations[0].slug].archive.filter((r) => r.date >= start && r.date <= end);
    return send(200, toResponse(locations[0], rows, false));
  }

  if (url.pathname === '/v1/forecast') {
    const bodies = locations.map((l) => toResponse(l, DATA[l.slug].forecast, true));
    return send(200, bodies.length === 1 ? bodies[0] : bodies);
  }

  send(404, { error: true, reason: 'Unbekannter Pfad' });
}).listen(PORT, () => console.log(`Mock-API auf http://localhost:${PORT}`));
