/* Reichert die fertig gerenderte Seite an: Tabelle durchsuchbar machen,
   Vorhersagediagramm zeichnen, Seitenleiste ein- und ausklappen.
   Ohne dieses Skript bleibt die Seite vollständig lesbar. */

(function () {
  'use strict';

  // --- Seitenleiste -------------------------------------------------------
  var layout = document.getElementById('layout');
  var toggle = document.getElementById('sidebarToggle');

  if (layout && window.innerWidth <= 800) layout.classList.add('collapsed');

  if (layout && toggle) {
    toggle.addEventListener('click', function () {
      var collapsed = layout.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  // --- Archivtabelle ------------------------------------------------------
  var table = document.getElementById('archiveTable');
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
        info: '{start} bis {end} von {rows} Einträgen',
      },
    });
  }

  // --- Vorhersagediagramm -------------------------------------------------
  var dataScript = document.getElementById('forecastData');
  var canvas = document.getElementById('forecastChart');
  if (!dataScript || !canvas || !window.Chart) return;

  var forecast = JSON.parse(dataScript.textContent);
  var styles = getComputedStyle(document.documentElement);
  var warm = styles.getPropertyValue('--warm').trim() || '#e8590c';
  var cool = styles.getPropertyValue('--cool').trim() || '#1c7ed6';

  new window.Chart(canvas, {
    data: {
      labels: forecast.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Niederschlag',
          data: forecast.precipitation,
          backgroundColor: 'rgba(28, 126, 214, .22)',
          borderColor: 'rgba(28, 126, 214, .45)',
          borderWidth: 1,
          yAxisID: 'y1',
          order: 3,
        },
        {
          type: 'line',
          label: 'Höchsttemperatur',
          data: forecast.tempMax,
          borderColor: warm,
          backgroundColor: warm,
          tension: 0.35,
          pointRadius: 3,
          borderWidth: 2,
          yAxisID: 'y',
          order: 1,
        },
        {
          type: 'line',
          label: 'Tiefsttemperatur',
          data: forecast.tempMin,
          borderColor: cool,
          backgroundColor: cool,
          tension: 0.35,
          pointRadius: 3,
          borderWidth: 2,
          yAxisID: 'y',
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: function (context) {
              var unit = context.dataset.yAxisID === 'y1' ? ' mm' : ' °C';
              var value = context.parsed.y;
              if (value === null) return context.dataset.label + ': –';
              return context.dataset.label + ': ' + value.toLocaleString('de-DE') + unit;
            },
          },
        },
      },
      scales: {
        y: {
          position: 'left',
          title: { display: true, text: '°C' },
          grid: { color: 'rgba(0,0,0,.06)' },
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: 'mm' },
          grid: { drawOnChartArea: false },
        },
        x: { grid: { display: false } },
      },
    },
  });
})();
