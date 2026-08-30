/**
 * Wettersymbole als Inline-SVG.
 *
 * Bewusst keine Icon-Bibliothek: acht Strichzeichnungen ersetzen ein
 * Megabyte Font Awesome, laden nichts von fremden Servern nach und
 * übernehmen über `currentColor` die Textfarbe.
 */

export type IconName =
  | 'sun'
  | 'cloud-sun'
  | 'cloud'
  | 'rain'
  | 'rain-heavy'
  | 'snow'
  | 'thunder'
  | 'fog'
  | 'unknown';

const PATHS: Record<IconName, string> = {
  'sun':
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  'cloud-sun':
    '<circle cx="8" cy="7.5" r="2.8"/>' +
    '<path d="M8 2.6v1.3M8 11.1v1.3M4.2 3.7l.9.9M10.9 10.4l.9.9M2.8 7.5h1.3M11.9 7.5h1.3M4.2 11.3l.9-.9M10.9 4.6l.9-.9"/>' +
    '<path d="M17.4 20.5a3.6 3.6 0 0 0 .4-7.18 5 5 0 0 0-9.65.9A3.15 3.15 0 0 0 8.6 20.5z"/>',
  'cloud':
    '<path d="M17.4 18.5a3.9 3.9 0 0 0 .4-7.78 5.4 5.4 0 0 0-10.42.98A3.4 3.4 0 0 0 7.8 18.5z"/>',
  'rain':
    '<path d="M17.2 15.5a3.7 3.7 0 0 0 .4-7.38 5.2 5.2 0 0 0-10.03.94A3.25 3.25 0 0 0 7.8 15.5z"/>' +
    '<path d="M8.5 18.2 7.7 20.6M12 18.2l-.8 2.4M15.5 18.2l-.8 2.4"/>',
  'rain-heavy':
    '<path d="M17.2 14.5a3.7 3.7 0 0 0 .4-7.38 5.2 5.2 0 0 0-10.03.94A3.25 3.25 0 0 0 7.8 14.5z"/>' +
    '<path d="M7.4 16.6 6.2 20.4M10.9 16.6 9.7 20.4M14.4 16.6l-1.2 3.8M17.4 16.6l-1.2 3.8"/>',
  'snow':
    '<path d="M17.2 14.5a3.7 3.7 0 0 0 .4-7.38 5.2 5.2 0 0 0-10.03.94A3.25 3.25 0 0 0 7.8 14.5z"/>' +
    '<path d="M9 18.4h.01M12 20.2h.01M15 18.4h.01M10.5 21h.01M13.5 21h.01"/>',
  'thunder':
    '<path d="M17.2 14.2a3.7 3.7 0 0 0 .4-7.38 5.2 5.2 0 0 0-10.03.94A3.25 3.25 0 0 0 7.8 14.2z"/>' +
    '<path d="M13 15.6 9.8 20h2.6l-.8 3.2"/>',
  'fog':
    '<path d="M17.2 12.5a3.7 3.7 0 0 0 .4-7.38 5.2 5.2 0 0 0-10.03.94A3.25 3.25 0 0 0 7.8 12.5z"/>' +
    '<path d="M5 16h9M8 19h9M5 19h1"/>',
  'unknown':
    '<circle cx="12" cy="12" r="9"/>' +
    '<path d="M9.6 9.6a2.5 2.5 0 0 1 4.85.83c0 1.67-2.45 2.5-2.45 2.5M12 17.2h.01"/>',
};

/**
 * Symboldefinitionen, einmal pro Seite ausgegeben. Die Zeilen der Tabelle
 * verweisen danach nur noch per <use> darauf – bei über 1500 Zeilen ist das
 * der Unterschied zwischen rund 850 kB und rund 250 kB Seitengröße.
 */
export function renderSprite(): string {
  const symbols = (Object.keys(PATHS) as IconName[])
    .map((name) => `<symbol id="wx-${name}" viewBox="0 0 24 24">${PATHS[name]}</symbol>`)
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true" ` +
    `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ` +
    `stroke-linejoin="round">${symbols}</svg>`
  );
}

/** Verweis auf ein Symbol aus dem Sprite. */
export function renderIcon(name: IconName, cssClass = 'wx-icon'): string {
  return `<svg class="${cssClass}" aria-hidden="true"><use href="#wx-${name}"/></svg>`;
}

export const ICON_PATHS = PATHS;
