/**
 * Kleine Datumshelfer. Die Arithmetik läuft in UTC, damit die Sommerzeit keine
 * Tage verschiebt – "heute" wird dagegen bewusst in der konfigurierten Zone
 * bestimmt, sonst gilt zwischen Mitternacht und 02:00 Ortszeit noch der Vortag.
 */

import { TIMEZONE } from './config.js';

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function today(timeZone: string = TIMEZONE): string {
  // 'en-CA' formatiert als YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  const ms = new Date(`${toIsoDate}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

/** "2026-08-28" -> "Fr 28.08.2026" – dasselbe Format wie auf der Vorlagenseite. */
export function formatGerman(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const weekday = WEEKDAYS[date.getUTCDay()] ?? '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${weekday} ${day}.${month}.${date.getUTCFullYear()}`;
}

/** "2026-08-31" -> "Mo 31.08." – für schmale Spalten und Diagrammachsen. */
export function formatShort(iso: string): string {
  return formatGerman(iso).slice(0, 9); // "Mo 31.08." endet bereits auf einem Punkt
}
