// Workroom inch helpers shared by the calculators.

/** Parse workroom inches: "20", "20.5", "20 1/2", "20-1/2", "1/2", with or without ". */
export function parseInches(raw: string): number | null {
  const s = raw.trim().replace(/["”″]|in\b/g, '').trim()
  if (!s) return null
  const m = s.match(/^(\d+(?:\.\d+)?)?(?:[\s-]+)?(?:(\d+)\/(\d+))?$/)
  if (!m || (!m[1] && !m[2])) return null
  const whole = m[1] ? parseFloat(m[1]) : 0
  const frac = m[2] ? parseInt(m[2]) / parseInt(m[3]) : 0
  if (m[2] && parseInt(m[3]) === 0) return null
  if (m[1]?.includes('.') && m[2]) return null
  return whole + frac
}

/** Decimal inches → text, rounded UP to the next ⅛" (never down), e.g. 20.5 → 20 1/2". */
export function formatInches(dec: number): string {
  if (!isFinite(dec)) return '—'
  const neg = dec < 0 ? '-' : ''
  dec = Math.abs(dec)
  let w = Math.floor(dec)
  let e = Math.ceil((dec - w) * 8 - 1e-9)
  if (e === 8) {
    w += 1
    e = 0
  }
  if (e === 0) return `${neg}${w}"`
  const g = gcd(8, e)
  return `${neg}${w > 0 ? w + ' ' : ''}${e / g}/${8 / g}"`
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}
