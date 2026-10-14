import type { Pt, Units } from './types'

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

export function plen(pts: Pt[], closed: boolean) {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i])
  if (closed && pts.length > 2) s += dist(pts[pts.length - 1], pts[0])
  return s
}

export function parea(pts: Pt[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

export function centroid(pts: Pt[]): Pt {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const f = p.x * q.y - q.x * p.y
    a += f
    cx += (p.x + q.x) * f
    cy += (p.y + q.y) * f
  }
  if (Math.abs(a) < 1e-6) {
    let sx = 0
    let sy = 0
    pts.forEach((p) => {
      sx += p.x
      sy += p.y
    })
    return { x: sx / pts.length, y: sy / pts.length }
  }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** Feet -> "12'-6 1/2\"" (or metric), rounded to 1/prec of an inch. */
export function fmtLen(ft: number | null, units: Units, prec: number): string | null {
  if (ft == null || !isFinite(ft)) return null
  if (units === 'met') {
    const m = ft * 0.3048
    return m < 1 ? (m * 100).toFixed(1) + ' cm' : m.toFixed(3) + ' m'
  }
  const total = Math.round(ft * 12 * prec) / prec
  let f = Math.floor(total / 12 + 1e-9)
  const inch = total - f * 12
  let whole = Math.floor(inch + 1e-9)
  let num = Math.round((inch - whole) * prec)
  if (num === prec) {
    whole++
    num = 0
  }
  if (whole === 12) {
    f++
    whole = 0
  }
  let s = f + "'-" + whole
  if (num) {
    const g = gcd(num, prec)
    s += ' ' + num / g + '/' + prec / g
  }
  return s + '"'
}

export function fmtArea(sqft: number | null, units: Units): string | null {
  if (sqft == null || !isFinite(sqft)) return null
  if (units === 'met') return (sqft * 0.09290304).toFixed(2) + ' m²'
  return sqft.toFixed(1) + ' sq ft'
}

/** Accepts "12", "6.5", "6 1/2", "1/2". Returns NaN when it is not a number. */
export function parseNum(input: unknown): number {
  const s = String(input ?? '')
    .trim()
    .replace(/["'″′]/g, '')
  if (!s) return 0
  const mt = s.match(/^(\d+(?:\.\d+)?|\.\d+)?\s*(?:(\d+)\s*\/\s*(\d+))?$/)
  if (!mt || (!mt[1] && !mt[2])) return NaN
  let v = mt[1] ? parseFloat(mt[1]) : 0
  if (mt[2]) {
    if (+mt[3] === 0) return NaN
    v += +mt[2] / +mt[3]
  }
  return v
}

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/* ---------- printed drawing scales (PDF points per real foot) ---------- */
const metric = (r: number) => 0.3048 / r / 0.0254 * 72

export const PRESET_GROUPS: { label: string; items: [number, string][] }[] = [
  {
    label: 'Architectural (feet & inches)',
    items: [
      [(1 / 16) * 72, `1/16" = 1'-0"`],
      [(3 / 32) * 72, `3/32" = 1'-0"`],
      [(1 / 8) * 72, `1/8" = 1'-0"`],
      [(3 / 16) * 72, `3/16" = 1'-0"`],
      [(1 / 4) * 72, `1/4" = 1'-0"`],
      [(3 / 8) * 72, `3/8" = 1'-0"`],
      [(1 / 2) * 72, `1/2" = 1'-0"`],
      [(3 / 4) * 72, `3/4" = 1'-0"`],
      [72, `1" = 1'-0"`],
      [1.5 * 72, `1 1/2" = 1'-0"`],
      [3 * 72, `3" = 1'-0"`],
    ],
  },
  {
    label: 'Engineering',
    items: [10, 20, 30, 40, 50].map((n) => [72 / n, `1" = ${n}'`] as [number, string]),
  },
  {
    label: 'Metric',
    items: [20, 25, 50, 100, 200].map((n) => [metric(n), `1:${n}`] as [number, string]),
  },
]
