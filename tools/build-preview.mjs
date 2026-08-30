/**
 * Baut aus den erzeugten Seiten eine einzelne, in sich geschlossene HTML-Datei.
 *
 * Nur für Vorschauzwecke (z. B. als Artifact-Link): CSS und Skript sind
 * eingebettet, die beiden Orte liegen als umschaltbare Abschnitte in einer
 * Datei. Für den Betrieb wird `public/` verwendet, nicht diese Datei.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../preview/wetterdaten-vorschau.html', import.meta.url).pathname;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const PAGES = [
  { slug: 'gross-kreutz', file: 'public/index.html', name: 'Groß Kreutz (Havel)', region: 'Brandenburg' },
  { slug: 'berlin', file: 'public/berlin.html', name: 'Berlin', region: 'Berlin' },
];

const between = (html, start, end) => {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Abschnitt nicht gefunden: ${start}`);
  return html.slice(a, b + end.length);
};

let sprite = '';
const sections = [];
const chartData = [];

PAGES.forEach((page, index) => {
  const html = read(page.file);
  if (index === 0) sprite = between(html, '<svg xmlns="http://www.w3.org/2000/svg" style="display:none"', '</svg>');

  let main = between(html, '<main class="content">', '</main>')
    .replace('<main class="content">', `<main class="content" id="ort-${page.slug}"${index > 0 ? ' hidden' : ''}>`)
    .replaceAll('id="archiveTable"', `id="archiveTable-${page.slug}"`)
    .replaceAll('id="forecastChart"', `id="forecastChart-${page.slug}"`)
    // Die JSON-Rohdaten liegen in der Vorschau nicht daneben.
    .replace(/<a href="daten\/[^"]+">Rohdaten als JSON<\/a> · /, '');

  sections.push(main);
  chartData.push(
    `<script id="fc-${page.slug}" type="application/json">` +
      between(html, '<script id="forecastData" type="application/json">', '</script>')
        .replace('<script id="forecastData" type="application/json">', '')
        .replace('</script>', '') +
      `</script>`,
  );
});

const navLinks = PAGES.map(
  (p, i) =>
    `<div class="sidenav-heading">${p.region}</div>` +
    `<a class="nav-link${i === 0 ? ' active' : ''}" href="#${p.slug}" data-ort="${p.slug}">` +
    `<span class="nav-icon"><svg class="wx-icon wx-icon-sm"><use href="#wx-cloud"/></svg></span>` +
    `Wetterdaten ${p.name}</a>`,
).join('\n        ');

const html = `<title>Wetterdaten Groß Kreutz &amp; Berlin</title>
<style>
${read('node_modules/simple-datatables/dist/style.css')}
${read('web/css/styles.css')}
.preview-hint{background:#eef4ff;border:1px solid #cddcfb;color:#1b4079;border-radius:6px;padding:.7rem .9rem;margin:0 0 1.2rem;font-size:.87rem}
</style>
${sprite}
<nav class="topnav">
  <a class="brand" href="#">Wetterdaten</a>
  <button id="sidebarToggle" class="sidebar-toggle" type="button" aria-label="Navigation umschalten" aria-expanded="true">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
  </button>
</nav>
<div class="layout" id="layout">
  <aside class="sidenav">
    <nav class="nav">
        ${navLinks}
    </nav>
    <div class="sidenav-footer"><div class="small">Vorschau</div>Stand ${new Date().toLocaleDateString('de-DE')}</div>
  </aside>
${sections.join('\n')}
</div>
${chartData.join('\n')}
<script>${read('node_modules/simple-datatables/dist/umd/simple-datatables.js')}</script>
<script>${read('node_modules/chart.js/dist/chart.umd.js')}</script>
<script>
/* Vorschau: Seitenleiste, Ortswechsel und verzögerter Aufbau von Tabelle und Diagramm.
   Die Bibliotheken sind eingebettet, die Datei ist damit vollständig eigenständig. */
(function () {
  'use strict';
  var ready = {};

  function build(slug) {
    if (ready[slug]) return;
    ready[slug] = true;

    var table = document.getElementById('archiveTable-' + slug);
    if (table && window.simpleDatatables) {
      new window.simpleDatatables.DataTable(table, {
        perPage: 10,
        perPageSelect: [10, 25, 50, 75, 100, 200, 500],
        columns: [{ select: 0, sort: 'desc' }],
        labels: {
          placeholder: 'Suchen …',
          searchTitle: 'In der Tabelle suchen',
          searchLabel: 'Suche:',
          perPage: 'Zeilen anzeigen',
          noRows: 'Keine Einträge vorhanden',
          noResults: 'Keine Einträge gefunden',
          info: '{start} bis {end} von {rows} Einträgen'
        }
      });
    }

    var script = document.getElementById('fc-' + slug);
    var canvas = document.getElementById('forecastChart-' + slug);
    if (!script || !canvas || !window.Chart) return;
    var fc = JSON.parse(script.textContent);
    var css = getComputedStyle(document.documentElement);
    var warm = css.getPropertyValue('--warm').trim() || '#e8590c';
    var cool = css.getPropertyValue('--cool').trim() || '#1c7ed6';

    new window.Chart(canvas, {
      data: {
        labels: fc.labels,
        datasets: [
          { type: 'bar', label: 'Niederschlag', data: fc.precipitation, backgroundColor: 'rgba(28,126,214,.22)', borderColor: 'rgba(28,126,214,.45)', borderWidth: 1, yAxisID: 'y1', order: 3 },
          { type: 'line', label: 'Höchsttemperatur', data: fc.tempMax, borderColor: warm, backgroundColor: warm, tension: .35, pointRadius: 3, borderWidth: 2, yAxisID: 'y', order: 1 },
          { type: 'line', label: 'Tiefsttemperatur', data: fc.tempMin, borderColor: cool, backgroundColor: cool, tension: .35, pointRadius: 3, borderWidth: 2, yAxisID: 'y', order: 2 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: function (c) {
            var unit = c.dataset.yAxisID === 'y1' ? ' mm' : ' °C';
            return c.parsed.y === null ? c.dataset.label + ': –' : c.dataset.label + ': ' + c.parsed.y.toLocaleString('de-DE') + unit;
          } } }
        },
        scales: {
          y: { position: 'left', title: { display: true, text: '°C' }, grid: { color: 'rgba(0,0,0,.06)' } },
          y1: { position: 'right', beginAtZero: true, title: { display: true, text: 'mm' }, grid: { drawOnChartArea: false } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  var layout = document.getElementById('layout');
  var toggle = document.getElementById('sidebarToggle');
  if (layout && window.innerWidth <= 800) layout.classList.add('collapsed');
  if (layout && toggle) {
    toggle.addEventListener('click', function () {
      var collapsed = layout.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  document.querySelectorAll('.nav-link[data-ort]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var slug = link.dataset.ort;
      document.querySelectorAll('.nav-link[data-ort]').forEach(function (l) { l.classList.toggle('active', l === link); });
      document.querySelectorAll('main.content').forEach(function (m) { m.hidden = m.id !== 'ort-' + slug; });
      build(slug);
      if (window.innerWidth <= 800) document.getElementById('layout').classList.add('collapsed');
    });
  });

  build('${PAGES[0].slug}');
})();
</script>
`;

writeFileSync(OUT, html);
console.log(`${OUT} – ${(html.length / 1024).toFixed(0)} kB`);
