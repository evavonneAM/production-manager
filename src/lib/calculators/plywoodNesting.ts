// Plywood for cushions upholstered to plywood: nest every board for the job onto
// full sheets (MaxRects, same method as the Plywood Seat Nesting page) and charge
// per sheet. Every piece stays whole on one sheet; a board longer than a sheet is
// cut into equal lengths that each fit.

export const SHEET_W = 48
export const SHEET_L = 96
export const KERF = 1 / 8
/** Cleaned off each factory edge. */
export const TRIM = 1 / 4
export const SHEET_PRICE = 100

const EPS = 1e-6
const USABLE_W = SHEET_W - 2 * TRIM
const USABLE_L = SHEET_L - 2 * TRIM

export type Board = { name: string; qty: number; length: number; depth: number }
/** One board as cut: `of` > 1 when a long board was cut into equal lengths. */
export type Piece = { name: string; length: number; depth: number; of: number }
export type PlacedPiece = Piece & { x: number; y: number; w: number; h: number }
export type Sheet = { pieces: PlacedPiece[]; used: number }
export type PlywoodPlan = { sheets: Sheet[]; pieces: number; cost: number; split: { name: string; length: number; parts: number }[]; tooDeep: string[] }

type Item = Piece & { w: number; h: number; area: number }
type Free = { x: number; y: number; w: number; h: number }
type Bin = { free: Free[]; placed: (Item & { x: number; y: number; pw: number; ph: number })[]; used: number }

function packOnce(items: Item[], BW: number, BH: number, score: 'bssf' | 'baf' | 'bl'): Bin[] | null {
  const bins: Bin[] = []
  const findPos = (b: Bin, w: number, h: number) => {
    let best: { x: number; y: number; w: number; h: number; s1: number; s2: number } | null = null
    for (const f of b.free) {
      const tries: [number, number][] = [[w, h]]
      if (Math.abs(w - h) > EPS) tries.push([h, w])
      for (const [tw, th] of tries) {
        if (tw <= f.w + EPS && th <= f.h + EPS) {
          let s1: number, s2: number
          if (score === 'bssf') {
            const a = f.w - tw, c = f.h - th
            s1 = Math.min(a, c)
            s2 = Math.max(a, c)
          } else if (score === 'baf') {
            s1 = f.w * f.h - tw * th
            s2 = Math.min(f.w - tw, f.h - th)
          } else {
            s1 = f.y + th
            s2 = f.x
          }
          if (!best || s1 < best.s1 - EPS || (Math.abs(s1 - best.s1) < EPS && s2 < best.s2)) best = { x: f.x, y: f.y, w: tw, h: th, s1, s2 }
        }
      }
    }
    return best
  }
  const place = (b: Bin, p: { x: number; y: number; w: number; h: number }) => {
    const out: Free[] = []
    for (const f of b.free) {
      if (p.x >= f.x + f.w - EPS || p.x + p.w <= f.x + EPS || p.y >= f.y + f.h - EPS || p.y + p.h <= f.y + EPS) {
        out.push(f)
        continue
      }
      if (p.x > f.x + EPS) out.push({ x: f.x, y: f.y, w: p.x - f.x, h: f.h })
      if (p.x + p.w < f.x + f.w - EPS) out.push({ x: p.x + p.w, y: f.y, w: f.x + f.w - p.x - p.w, h: f.h })
      if (p.y > f.y + EPS) out.push({ x: f.x, y: f.y, w: f.w, h: p.y - f.y })
      if (p.y + p.h < f.y + f.h - EPS) out.push({ x: f.x, y: p.y + p.h, w: f.w, h: f.y + f.h - p.y - p.h })
    }
    // Drop free rectangles that sit inside another one.
    b.free = out.filter(
      (a, i) =>
        !out.some(
          (c, j) =>
            j !== i &&
            a.x >= c.x - EPS && a.y >= c.y - EPS && a.x + a.w <= c.x + c.w + EPS && a.y + a.h <= c.y + c.h + EPS &&
            (j < i || !(Math.abs(a.x - c.x) < EPS && Math.abs(a.y - c.y) < EPS && Math.abs(a.w - c.w) < EPS && Math.abs(a.h - c.h) < EPS)),
        ),
    )
  }
  for (const it of items) {
    let bin = bins.find((b) => findPos(b, it.w, it.h))
    if (!bin) {
      bin = { free: [{ x: 0, y: 0, w: BW, h: BH }], placed: [], used: 0 }
      bins.push(bin)
    }
    const p = findPos(bin, it.w, it.h)
    if (!p) return null
    place(bin, p)
    bin.placed.push({ ...it, x: p.x, y: p.y, pw: p.w, ph: p.h })
    bin.used += it.area
  }
  return bins
}

/** Nest the boards onto 4 × 8 sheets, trying several orders and keep the fewest sheets. */
export function planPlywood(boards: Board[]): PlywoodPlan {
  const items: Item[] = []
  const split: PlywoodPlan['split'] = []
  const tooDeep: string[] = []
  for (const b of boards) {
    if (!(b.qty > 0 && b.length > 0 && b.depth > 0)) continue
    const short = Math.min(b.length, b.depth)
    const long = Math.max(b.length, b.depth)
    if (short > USABLE_W + EPS) {
      tooDeep.push(b.name)
      continue
    }
    const parts = Math.ceil(long / USABLE_L - EPS)
    if (parts > 1) split.push({ name: b.name, length: long, parts })
    const len = long / parts
    for (let q = 0; q < b.qty; q++)
      for (let k = 0; k < parts; k++)
        items.push({ name: b.name, length: len, depth: short, of: parts, w: short + KERF, h: len + KERF, area: len * short })
  }
  const orders: ((a: Item, b: Item) => number)[] = [
    (a, b) => b.area - a.area,
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.area - a.area,
    (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || b.area - a.area,
    (a, b) => b.w + b.h - (a.w + a.h),
  ]
  let best: Bin[] | null = null
  let bestLast = Infinity
  if (items.length)
    for (const o of orders)
      for (const sc of ['bssf', 'baf', 'bl'] as const) {
        const res = packOnce([...items].sort(o), USABLE_W + KERF, USABLE_L + KERF, sc)
        if (!res) continue
        const last = Math.min(...res.map((b) => b.used))
        if (!best || res.length < best.length || (res.length === best.length && last < bestLast)) {
          best = res
          bestLast = last
        }
      }
  const sheets: Sheet[] = (best ?? []).map((b) => ({
    used: b.used / (SHEET_W * SHEET_L),
    pieces: b.placed.map((p) => ({ name: p.name, length: p.length, depth: p.depth, of: p.of, x: TRIM + p.x, y: TRIM + p.y, w: p.pw - KERF, h: p.ph - KERF })),
  }))
  return { sheets, pieces: items.length, cost: sheets.length * SHEET_PRICE, split, tooDeep }
}
