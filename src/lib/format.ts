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

/** ISO date → localized short date, or empty string when null.
 *  Date-only strings ("2026-08-07") are calendar dates, not instants — format
 *  them in UTC so they never shift a day in the viewer's timezone. */
export function formatDate(iso: string | null, locale: string): string {
  if (!iso) return ''
  const dateOnly = !iso.includes('T')
  return new Date(dateOnly ? iso + 'T00:00:00Z' : iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  })
}
