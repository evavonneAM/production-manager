/** Localized hour/minute unit labels, e.g. { h: 'ч', m: 'мин' }. */
export type TimeUnits = { h: string; m: string }

/** Minutes → compact labor label, e.g. 0 → "0h", 213 → "3h 33m" (units localized). */
export function formatMinutes(min: number, units: TimeUnits): string {
  if (!min) return `0${units.h}`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}${units.m}`
  if (m === 0) return `${h}${units.h}`
  return `${h}${units.h} ${m}${units.m}`
}

/** ISO date → localized short date, or empty string when null. */
export function formatDate(iso: string | null, locale: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
