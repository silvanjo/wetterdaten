/**
 * WMO-Wettercode (Tabelle 4677) -> deutsche Beschreibung und Font-Awesome-Icon.
 * Open-Meteo liefert diese Codes im Feld `weather_code`.
 */

import type { IconName } from './icons.js';

export interface WeatherLabel {
  readonly text: string;
  readonly icon: IconName;
}

const UNKNOWN: WeatherLabel = { text: 'Unbekannt', icon: 'unknown' };

const TABLE: ReadonlyMap<number, WeatherLabel> = new Map([
  [0, { text: 'Klar', icon: 'sun' }],
  [1, { text: 'Überwiegend klar', icon: 'sun' }],
  [2, { text: 'Teilweise bewölkt', icon: 'cloud-sun' }],
  [3, { text: 'Bedeckt', icon: 'cloud' }],
  [45, { text: 'Nebel', icon: 'fog' }],
  [48, { text: 'Reifnebel', icon: 'fog' }],
  [51, { text: 'Leichter Nieselregen', icon: 'rain' }],
  [53, { text: 'Mäßiger Nieselregen', icon: 'rain' }],
  [55, { text: 'Starker Nieselregen', icon: 'rain-heavy' }],
  [56, { text: 'Leichter gefrierender Nieselregen', icon: 'snow' }],
  [57, { text: 'Starker gefrierender Nieselregen', icon: 'snow' }],
  [61, { text: 'Leichter Regen', icon: 'rain' }],
  [63, { text: 'Mäßiger Regen', icon: 'rain' }],
  [65, { text: 'Starker Regen', icon: 'rain-heavy' }],
  [66, { text: 'Leichter gefrierender Regen', icon: 'snow' }],
  [67, { text: 'Starker gefrierender Regen', icon: 'snow' }],
  [71, { text: 'Leichter Schneefall', icon: 'snow' }],
  [73, { text: 'Mäßiger Schneefall', icon: 'snow' }],
  [75, { text: 'Starker Schneefall', icon: 'snow' }],
  [77, { text: 'Schneegriesel', icon: 'snow' }],
  [80, { text: 'Leichte Regenschauer', icon: 'rain' }],
  [81, { text: 'Mäßige Regenschauer', icon: 'rain' }],
  [82, { text: 'Heftige Regenschauer', icon: 'rain-heavy' }],
  [85, { text: 'Leichte Schneeschauer', icon: 'snow' }],
  [86, { text: 'Starke Schneeschauer', icon: 'snow' }],
  [95, { text: 'Gewitter', icon: 'thunder' }],
  [96, { text: 'Gewitter mit leichtem Hagel', icon: 'thunder' }],
  [99, { text: 'Gewitter mit starkem Hagel', icon: 'thunder' }],
]);

export function describeWeather(code: number | null): WeatherLabel {
  if (code === null) return UNKNOWN;
  return TABLE.get(code) ?? UNKNOWN;
}
