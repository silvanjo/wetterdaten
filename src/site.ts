/**
 * Erzeugt die fertige statische Seite nach ./public.
 *
 * Ergebnis ist reines HTML/CSS/JS ohne Server-Laufzeit – hochladbar auf jeden
 * Webspace, GitHub Pages, Netlify oder Cloudflare Pages.
 *
 * Die Archivtabelle steht vollständig im HTML, nicht nur im JavaScript: Die
 * Seite bleibt damit auch ohne JS lesbar und druckbar, was für eine
 * Wetterdokumentation der Punkt ist. JavaScript ergänzt lediglich Suche,
 * Sortierung, Seitenblättern und das Diagramm.
 */

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { LOCATIONS, OUT_DIR, type Location } from './config.js';
import { getCoverage, getDays, openDatabase, type StoredDay } from './db.js';
import { describeWeather } from './wmo.js';
import { renderIcon, renderSprite } from './icons.js';
import { formatGerman, formatShort, today } from './dates.js';

const VENDOR = [
  ['node_modules/simple-datatables/dist/umd/simple-datatables.js', 'vendor/simple-datatables.js'],
  ['node_modules/simple-datatables/dist/style.css', 'vendor/simple-datatables.css'],
  ['node_modules/chart.js/dist/chart.umd.js', 'vendor/chart.js'],
] as const;

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const num = (value: number | null, digits: number, unit: string): string =>
  value === null ? '–' : `${value.toFixed(digits).replace('.', ',')}${unit}`;

function pageFileName(location: Location, index: number): string {
  return index === 0 ? 'index.html' : `${location.slug}.html`;
}

function renderSidebar(current: Location): string {
  const groups = new Map<string, Location[]>();
  for (const location of LOCATIONS) {
    groups.set(location.region, [...(groups.get(location.region) ?? []), location]);
  }

  const blocks = [...groups].map(([region, entries]) => {
    const links = entries
      .map((entry) => {
        const index = LOCATIONS.indexOf(entry);
        const active = entry.slug === current.slug ? ' active' : '';
        return (
          `<a class="nav-link${active}" href="${pageFileName(entry, index)}"` +
          `${active ? ' aria-current="page"' : ''}>` +
          `<span class="nav-icon">${renderIcon('cloud', 'wx-icon wx-icon-sm')}</span>` +
          `Wetterdaten ${escapeHtml(entry.name)}</a>`
        );
      })
      .join('\n            ');
    return `<div class="sidenav-heading">${escapeHtml(region)}</div>\n            ${links}`;
  });

  return blocks.join('\n            ');
}

function renderForecastStrip(days: readonly StoredDay[]): string {
  return days
    .map((day) => {
      const { text, icon } = describeWeather(day.weatherCode);
      const probability =
        day.precipitationProbability === null ? '' : `<div class="fc-prob">${day.precipitationProbability} %</div>`;
      return (
        `<div class="fc-day" title="${escapeHtml(text)}">` +
        `<div class="fc-date">${escapeHtml(formatShort(day.date))}</div>` +
        `<div class="fc-icon">${renderIcon(icon)}</div>` +
        `<div class="fc-temp"><span class="fc-max">${num(day.tempMax, 0, '°')}</span>` +
        `<span class="fc-min">${num(day.tempMin, 0, '°')}</span></div>` +
        `<div class="fc-rain">${num(day.precipitation, 1, ' mm')}</div>` +
        probability +
        `</div>`
      );
    })
    .join('\n              ');
}

function renderArchiveRows(days: readonly StoredDay[]): string {
  return days
    .map((day) => {
      const { text, icon } = describeWeather(day.weatherCode);
      // Werte der letzten Tage stammen noch nicht aus dem endgültigen Archiv.
      const provisional =
        day.source === 'forecast_api' ? ' <span class="badge badge-provisional">vorläufig</span>' : '';
      return (
        `<tr>` +
        `<td data-order="${day.date}">${escapeHtml(formatGerman(day.date))}</td>` +
        `<td data-order="${day.precipitation ?? -1}">${num(day.precipitation, 2, ' mm')}</td>` +
        `<td data-order="${day.tempMax ?? -999}">${num(day.tempMax, 1, ' °C')}</td>` +
        `<td data-order="${day.tempMin ?? -999}">${num(day.tempMin, 1, ' °C')}</td>` +
        // Die Beschreibungsspalte sortiert nach dem sichtbaren Text, ein
        // data-order wäre nur eine Verdopplung von rund 45 kB pro Seite.
        `<td>${renderIcon(icon, 'wx-icon wx-icon-sm wx-icon-inline')}` +
        `${escapeHtml(text)}${provisional}</td>` +
        `</tr>`
      );
    })
    .join('\n                  ');
}

function renderPage(location: Location, days: readonly StoredDay[], generatedAt: string): string {
  const now = today();
  const past = days.filter((d) => d.date < now).reverse(); // neueste zuerst
  const upcoming = days.filter((d) => d.date >= now);
  const coverageNote =
    past.length > 0 ? `${past.length.toLocaleString('de-DE')} aufgezeichnete Tage seit ${formatGerman(past.at(-1)!.date)}` : '';

  const chartData = JSON.stringify({
    labels: upcoming.map((d) => formatShort(d.date)),
    tempMax: upcoming.map((d) => d.tempMax),
    tempMin: upcoming.map((d) => d.tempMin),
    precipitation: upcoming.map((d) => d.precipitation),
  });

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wetterdaten ${escapeHtml(location.name)}</title>
  <meta name="description" content="Wetterarchiv und 16-Tage-Vorhersage für ${escapeHtml(location.name)}.">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='19' font-size='20'%3E%E2%9B%85%3C/text%3E%3C/svg%3E">
  <link rel="stylesheet" href="vendor/simple-datatables.css">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  ${renderSprite()}
  <nav class="topnav">
    <a class="brand" href="index.html">Wetterdaten</a>
    <button id="sidebarToggle" class="sidebar-toggle" type="button" aria-label="Navigation umschalten" aria-expanded="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
  </nav>

  <div class="layout" id="layout">
    <aside class="sidenav">
      <nav class="nav">
            ${renderSidebar(location)}
      </nav>
      <div class="sidenav-footer">
        <div class="small">Datenstand</div>
        ${escapeHtml(generatedAt)}
      </div>
    </aside>

    <main class="content">
      <div class="container">
        <h1>Wetterdaten</h1>
        <p class="subtitle">Wetterdaten für ${escapeHtml(location.name)}</p>

        <section class="card">
          <div class="card-header">
            ${renderIcon('cloud-sun', 'wx-icon wx-icon-md')}
            <span>Vorhersage · ${upcoming.length} Tage</span>
          </div>
          <div class="card-body">
            <div class="chart-wrap"><canvas id="forecastChart" height="260"></canvas></div>
            <div class="fc-strip">
              ${renderForecastStrip(upcoming)}
            </div>
            <p class="note">Vorhersagewerte. Sobald ein Tag vorbei ist, wird er durch den gemessenen Wert ersetzt und wandert in die Tabelle darunter.</p>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            ${renderIcon('cloud', 'wx-icon wx-icon-md')}
            <span>Aufgezeichnete Werte</span>
            <span class="card-meta">${escapeHtml(coverageNote)}</span>
          </div>
          <div class="card-body">
            <div class="table-wrap">
              <table id="archiveTable">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Niederschlag</th>
                    <th>Höchsttemperatur</th>
                    <th>Tiefsttemperatur</th>
                    <th>Wetterbeschreibung</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderArchiveRows(past)}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <footer class="footer">
          <div>
            Wetterdaten von <a href="https://open-meteo.com/" rel="noopener">Open-Meteo.com</a>,
            lizenziert unter <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC BY 4.0</a>.
            Historie aus der ERA5-Reanalyse, Vorhersage aus dem ICON-Modell des DWD.
          </div>
          <div><a href="daten/${location.slug}.json">Rohdaten als JSON</a> · Datenstand ${escapeHtml(generatedAt)}</div>
        </footer>
      </div>
    </main>
  </div>

  <script id="forecastData" type="application/json">${chartData}</script>
  <script src="vendor/simple-datatables.js"></script>
  <script src="vendor/chart.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
`;
}

function main(): void {
  const db = openDatabase();
  const generatedAt = new Date().toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  });

  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(`${OUT_DIR}daten`, { recursive: true });

  for (const [source, target] of VENDOR) {
    mkdirSync(`${OUT_DIR}vendor`, { recursive: true });
    cpSync(source, `${OUT_DIR}${target}`);
  }
  cpSync('web', OUT_DIR, { recursive: true });

  LOCATIONS.forEach((location, index) => {
    const days = getDays(db, location.slug);
    if (days.length === 0) {
      throw new Error(`Keine Daten für ${location.name} – bitte zuerst "npm run update" ausführen.`);
    }

    writeFileSync(`${OUT_DIR}${pageFileName(location, index)}`, renderPage(location, days, generatedAt));
    writeFileSync(
      `${OUT_DIR}daten/${location.slug}.json`,
      `${JSON.stringify({ location, generatedAt, days }, null, 2)}\n`,
    );

    const { count, gaps } = getCoverage(db, location.slug);
    console.log(`${pageFileName(location, index).padEnd(20)} ${count} Tage, ${gaps.length} Lücken`);
  });

  db.close();
  console.log(`\nFertig in ${OUT_DIR}`);
}

main();
