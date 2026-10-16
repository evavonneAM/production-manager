// Fabric yardage for cushions: lay every cut piece for one fabric onto the roll
// (MaxRects, the same method as the plywood nesting) and measure how much roll
// it takes. The roll is the usable width across and as long as it needs to be.
// Version 1 is for plain fabric: no pattern repeat and no nap.

import { cordingStrips, type AnyCuts, BIAS_STRIP_LENGTH } from './cushionCut'

export type Direction = 'either' | 'upTheRoll' | 'railroaded'

/** Defaults until the cutter's rulebook comes back. */
export const DEFAULT_USABLE_WIDTH = 54
/** Gap between pieces; 0 = pieces share a cut line. */
export const DEFAULT_GAP = 0
/** Squared off the first end of the cut before laying out pieces. */
export const DEFAULT_END_ALLOWANCE = 2
/** Width of a bias cording strip. */
export const CORDING_STRIP_WIDTH = 1.5

const EPS = 1e-6

/** One piece to cut. `across` runs across the roll when the piece is cut up the roll. */
export type CutPiece = { name: string; cushion: string; across: number; along: number; direction: Direction }

export type PlacedCut = CutPiece & { x: number; y: number; w: number; h: number; turned: boolean }

export type FabricPlan = {
  width: number
  placed: PlacedCut[]
  /** Pieces too wide for the roll the way they have to run. */
  tooWide: CutPiece[]
  /** Roll used by the pieces, inches (no end allowance or cording). */
  piecesLength: number
  cordingStrips: number
  /** Roll set aside for bias cording, inches (an estimate). */
  cordingLength: number
  endAllowance: number
  /** Everything added up, inches. */
  totalLength: number
  /** Exact yards. */
  yards: number
  /** Yards to order: whole yards, rounded up. */
  orderYards: number
  /** Share of the used roll covered by pieces. */
  used: number
}

/** The cut pieces for one cushion line, from the Cushion Cut Dimensions formulas. */
export function piecesFor(cuts: AnyCuts, cushion: string, direction: Direction): CutPiece[] {
  const out: CutPiece[] = []
  const add = (name: string, qty: number, across: number, along: number) => {
    for (let i = 0; i < qty; i++) out.push({ name, cushion, across, along, direction })
  }
  if (cuts.kind === 'box') {
    // Plate: the cushion's width across the roll, front to back along it.
    add('plate', cuts.plate.qty, cuts.plate.width, cuts.plate.depth)
    // Strips: their length goes around the cushion, so it runs across the roll when cut up the roll.
    add('boxing', cuts.boxing.qty, cuts.boxing.x, cuts.boxing.z)
    add('zipper', cuts.zipper.qty, cuts.zipper.x, cuts.zipper.z)
  } else {
    add('wedgePanel', cuts.panel.qty, cuts.panel.width, cuts.panel.height)
    // The side piece is wedge-shaped; v1 gives it its full box (deep end × height).
    add('wedgeSide', cuts.side.qty, cuts.side.bottom, cuts.side.height)
  }
  return out
}

type Item = CutPiece & { idx: number; area: number }
type Free = { x: number; y: number; w: number; h: number }
type Spot = { x: number; y: number; w: number; h: number; turned: boolean }

/** Lay pieces on a strip `W` wide, in the given order. Returns the placements and the length used. */
function packStrip(items: Item[], W: number, gap: number, score: 'bl' | 'bssf' | 'baf') {
  // Each piece takes its size plus the gap; the strip gets one extra gap so the last piece fits flush.
  const BW = W + gap
  let free: Free[] = [{ x: 0, y: 0, w: BW, h: 1e7 }]
  const placed: { it: Item; s: Spot }[] = []
  let length = 0
  for (const it of items) {
    const tries: [number, number, boolean][] = []
    if (it.direction !== 'railroaded') tries.push([it.across + gap, it.along + gap, false])
    if (it.direction !== 'upTheRoll' && Math.abs(it.across - it.along) > EPS) tries.push([it.along + gap, it.across + gap, true])
    if (it.direction === 'railroaded' && Math.abs(it.across - it.along) <= EPS) tries.push([it.across + gap, it.along + gap, false])
    let best: (Spot & { s1: number; s2: number }) | null = null
    for (const f of free)
      for (const [w, h, turned] of tries) {
        if (w > f.w + EPS || h > f.h + EPS) continue
        let s1: number, s2: number
        if (score === 'bl') {
          s1 = f.y + h
          s2 = f.x
        } else if (score === 'bssf') {
          s1 = Math.max(length, f.y + h) * 1000 + Math.min(f.w - w, f.h - h)
          s2 = f.y
        } else {
          s1 = Math.max(length, f.y + h) * 1000 + Math.min(f.w - w, 1e5)
          s2 = f.x
        }
        if (!best || s1 < best.s1 - EPS || (Math.abs(s1 - best.s1) < EPS && s2 < best.s2)) best = { x: f.x, y: f.y, w, h, turned, s1, s2 }
      }
    if (!best) return null
    const p = best
    const out: Free[] = []
    for (const f of free) {
      if (p.x >= f.x + f.w - EPS || p.x + p.w <= f.x + EPS || p.y >= f.y + f.h - EPS || p.y + p.h <= f.y + EPS) {
        out.push(f)
        continue
      }
      if (p.x > f.x + EPS) out.push({ x: f.x, y: f.y, w: p.x - f.x, h: f.h })
      if (p.x + p.w < f.x + f.w - EPS) out.push({ x: p.x + p.w, y: f.y, w: f.x + f.w - p.x - p.w, h: f.h })
      if (p.y > f.y + EPS) out.push({ x: f.x, y: f.y, w: f.w, h: p.y - f.y })
      if (p.y + p.h < f.y + f.h - EPS) out.push({ x: f.x, y: p.y + p.h, w: f.w, h: f.y + f.h - p.y - p.h })
    }
    free = out.filter(
      (a, i) =>
        !out.some(
          (c, j) =>
            j !== i &&
            a.x >= c.x - EPS && a.y >= c.y - EPS && a.x + a.w <= c.x + c.w + EPS && a.y + a.h <= c.y + c.h + EPS &&
            (j < i || !(Math.abs(a.x - c.x) < EPS && Math.abs(a.y - c.y) < EPS && Math.abs(a.w - c.w) < EPS && Math.abs(a.h - c.h) < EPS)),
        ),
    )
    placed.push({ it, s: { x: p.x, y: p.y, w: p.w - gap, h: p.h - gap, turned: p.turned } })
    length = Math.max(length, p.y + p.h - gap)
  }
  return { placed, length }
}

/** Does a piece fit across the roll the way it has to run? */
function fitsRoll(p: CutPiece, W: number) {
  const up = p.across <= W + EPS
  const rr = p.along <= W + EPS
  return p.direction === 'upTheRoll' ? up : p.direction === 'railroaded' ? rr : up || rr
}

export type FabricOptions = { width: number; gap: number; endAllowance: number; cordingInches: number }

/** Lay out one fabric's pieces, trying several orders and scores and keeping the shortest. */
export function planFabric(pieces: CutPiece[], { width, gap, endAllowance, cordingInches }: FabricOptions): FabricPlan {
  const items: Item[] = []
  const tooWide: CutPiece[] = []
  pieces.forEach((p, idx) => {
    if (!(p.across > 0 && p.along > 0)) return
    if (fitsRoll(p, width)) items.push({ ...p, idx, area: p.across * p.along })
    else tooWide.push(p)
  })
  const long = (i: Item) => Math.max(i.across, i.along)
  const short = (i: Item) => Math.min(i.across, i.along)
  const orders: ((a: Item, b: Item) => number)[] = [
    (a, b) => b.area - a.area,
    (a, b) => long(b) - long(a) || b.area - a.area,
    (a, b) => short(b) - short(a) || b.area - a.area,
    (a, b) => b.across + b.along - (a.across + a.along),
  ]
  let best: NonNullable<ReturnType<typeof packStrip>> | null = null
  if (items.length)
    for (const o of orders)
      for (const sc of ['bl', 'bssf', 'baf'] as const) {
        const res = packStrip([...items].sort(o), width, gap, sc)
        if (res && (!best || res.length < best.length - EPS)) best = res
      }
  const placed: PlacedCut[] = (best?.placed ?? []).map(({ it, s }) => ({
    name: it.name,
    cushion: it.cushion,
    across: it.across,
    along: it.along,
    direction: it.direction,
    ...s,
  }))
  const piecesLength = best?.length ?? 0
  const strips = cordingStrips(cordingInches)
  // Bias cording, estimated by area: each 74" strip × 1½" wide, spread across the roll width.
  const cordingLength = strips > 0 ? Math.ceil((strips * BIAS_STRIP_LENGTH * CORDING_STRIP_WIDTH) / width - 1e-9) : 0
  const totalLength = (piecesLength > 0 || cordingLength > 0 ? endAllowance : 0) + piecesLength + cordingLength
  const yards = totalLength / 36
  const pieceArea = items.reduce((n, i) => n + i.area, 0)
  return {
    width,
    placed,
    tooWide,
    piecesLength,
    cordingStrips: strips,
    cordingLength,
    endAllowance: totalLength > 0 ? endAllowance : 0,
    totalLength,
    yards,
    orderYards: Math.ceil(yards - 1e-9),
    used: piecesLength > 0 ? pieceArea / (piecesLength * width) : 0,
  }
}
