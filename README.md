# Wetterdaten – Groß Kreutz (Havel) und Berlin

Wetterarchiv und 16-Tage-Vorhersage für zwei Orte. Erzeugt eine rein statische
Website – kein PHP, keine Datenbank auf dem Server, keine Laufzeitumgebung, die
gepflegt werden müsste. Das fertige Ergebnis sind HTML-Dateien, die überall
liegen können.

## Was drin ist

* **Lückenlose Historie** ab 27.06.2022, Wochenenden inklusive
* **Vorhersage** für 16 Tage mit Diagramm, sauber getrennt von den
  aufgezeichneten Werten
* **Durchsuchbare Tabelle** mit Sortierung und Seitenblättern
* **Zwei Orte**, weitere sind ein Eintrag in `src/config.ts`

Datenquelle ist [Open-Meteo](https://open-meteo.com/) (CC BY 4.0, kein
API-Schlüssel nötig): Historie aus der ERA5-Reanalyse, Vorhersage aus dem
ICON-Modell des DWD.

## Schnellstart

```bash
npm install
npm run update    # Daten holen (beim ersten Mal die komplette Historie)
npm run site      # Seite nach ./public erzeugen
npm run serve     # Vorschau auf http://localhost:8080
```

`npm run update` entscheidet selbst, was zu tun ist: Beim ersten Lauf holt es
die gesamte Historie, danach nur noch das Fenster um heute. Einen separaten
Backfill-Befehl, den man vergessen könnte, gibt es bewusst nicht.

## Veröffentlichen

Der Ordner `public/` ist die fertige Seite. Drei Wege, vom einfachsten an:

**GitHub Pages (empfohlen, kostenlos, aktualisiert sich selbst).**
Repository anlegen, Code pushen, unter *Settings → Pages* als Quelle
*GitHub Actions* wählen. Der mitgelieferte Workflow
`.github/workflows/update.yml` läuft danach täglich um 07:30 Uhr, holt die
neuen Werte und veröffentlicht die Seite neu. Danach gibt es nichts mehr zu
tun – die Adresse lautet `https://<konto>.github.io/<repository>/`.

**Netlify oder Cloudflare Pages.** Repository verbinden, Build-Befehl
`npm run update && npm run site`, Verzeichnis `public`. Beide bieten einen
täglichen Build-Trigger.

**Klassischer Webspace.** `npm run update && npm run site` lokal ausführen und
den Inhalt von `public/` per FTP hochladen. Für die tägliche Aktualisierung
braucht es dann einen Cronjob auf einem Rechner, der ohnehin läuft.

## Einen Ort hinzufügen

In `src/config.ts` einen Eintrag ergänzen:

```ts
{
  slug: 'potsdam',              // wird zum Dateinamen potsdam.html
  name: 'Potsdam',
  latitude: 52.4009,
  longitude: 13.0591,
  region: 'Brandenburg',        // Zwischenüberschrift in der Seitenleiste
}
```

Koordinaten liefert
`https://geocoding-api.open-meteo.com/v1/search?name=Potsdam&language=de`.
Danach `npm run update && npm run site` – die Historie des neuen Ortes wird
automatisch nachgeholt.

## Aufbau

```
src/config.ts       Orte und Einstellungen – der einzige Ort für Änderungen
src/openmeteo.ts    API-Client mit Wiederholversuchen
src/db.ts           SQLite-Ablage samt Integritätsregeln
src/update.ts       Befehl: Daten holen
src/site.ts         Befehl: statische Seite erzeugen
src/wmo.ts          Wettercode → deutsche Beschreibung
src/icons.ts        Wettersymbole als SVG-Sprite
web/                CSS und Client-JavaScript
tools/              Nachbau der API für Tests ohne Netzzugang
seed/               Echte Messwerte für ebendiese Tests
```

### Zwei Regeln, die im Schema stecken

**Eine Vorhersage überschreibt nie einen Messwert.** Jeder Tageswert trägt
seine Herkunft (`archive` oder `forecast_api`). Das `ON CONFLICT`-`WHERE` in
`db.ts` lässt ein Überschreiben nur zu, wenn der neue Wert aus dem Archiv kommt
oder der bestehende bloß vorläufig war. Ein Doppellauf oder eine falsch
gestellte Systemuhr kann die Aufzeichnung damit nicht beschädigen.

**Werte der letzten Tage sind als „vorläufig" gekennzeichnet.** Das ERA5-Archiv
hinkt etwa fünf Tage hinterher. Diese Lücke füllt der Vorhersage-Endpunkt, und
sobald das Archiv nachzieht, ersetzt der endgültige Wert den vorläufigen –
sichtbar am Wegfall der Markierung in der Tabelle.

`npm run update` meldet am Ende die Abdeckung je Ort und beendet sich mit
Fehlercode, wenn Tage fehlen. Das lässt sich als Alarm verwenden.

## Entwicklung ohne Netzzugang

`tools/mock-openmeteo.mjs` liefert die Endpunkte aus echten, zuvor abgerufenen
Werten nach:

```bash
node tools/mock-openmeteo.mjs &
OPEN_METEO_BASE=http://localhost:8099 \
OPEN_METEO_ARCHIVE_BASE=http://localhost:8099 npm run update
```

## Technik

Node 22 mit TypeScript, ohne Laufzeitabhängigkeiten – SQLite (`node:sqlite`)
und `fetch` bringt Node selbst mit. Im Browser laufen
[simple-datatables](https://github.com/fiduswriter/simple-datatables) und
[Chart.js](https://www.chartjs.org/), beide lokal mitgeliefert statt von einem
CDN geladen. Die Tabelle steht vollständig im HTML: Die Seite bleibt ohne
JavaScript lesbar und druckbar, was für eine Wetterdokumentation der Punkt ist.
