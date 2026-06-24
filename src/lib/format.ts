/** Minutes → compact hours label, e.g. 0 → "0h", 213 → "3h 33m". */
export function formatMinutes(min: number): string {
  if (!min) return '0h'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
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
