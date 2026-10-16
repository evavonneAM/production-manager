// Fabric yardage for cushions: lay every cut piece for one fabric onto the roll
// (MaxRects, the same method as the plywood nesting) and measure how much roll
// it takes. No pattern repeat yet; one-way (nap) fabrics are handled.
//
// Rules from the cutter's rulebook:
// - Every piece of a fabric is cut the same way: all up the roll or all railroaded.
//   Railroad when it fits, because it saves yardage.
// - Usable width = the width the mill lists, less 1½" off each selvage (the cutter's ruler line).
// - Pieces share cut lines; if a gap is used it is at least ½".
// - A piece wider than the roll is joined: a center as wide as the roll allows and
//   two mirrored ends (never a seam down the middle). Plate ends at least 5",
//   boxing/zipper ends at least 3". Each join takes ½" + ½" of seam allowance.
// - Bias cording comes from one block at the end: strips × 1¾" + 24", at least 60".
// - Extra for flaws: enough for one spare plate, or a percentage.
// - The order is rounded up to whole yards.
// - One-way fabrics (velvet, mohair, chenille, directional prints) are cut up the roll
//   with every piece pointing the same way: plates back edge first, boxing and zipper
//   top edge first, so the nap runs from back to front and down the boxing.
//   Railroading a one-way fabric needs approval.

import { cordingStrips, type AnyCuts } from './cushionCut'

/** Which way every piece of a fabric is cut. */
export type Direction = 'railroaded' | 'upTheRoll'
export type DirectionChoice = Direction | 'auto'

/** What the mill usually lists; the office always gives the real one. */
export const DEFAULT_LISTED_WIDTH = 54
/** Each side: the cutter draws a straight line 1½"–2" in from the selvage and builds every cut off it. */
export const DEFAULT_SELVAGE_TRIM = 1.5
/** Gap between pieces; 0 = pieces share a cut line. */
export const DEFAULT_GAP = 0
export const GAP_CHOICES = [0, 0.5, 1] as const
/** Squared off the first end of the cut before laying out pieces. */
export const DEFAULT_END_ALLOWANCE = 2
/** Width of a bias cording strip. */
export const CORDING_STRIP_WIDTH = 1.75
/** Bias block: strips × strip width + this, and never shorter than the minimum. */
export const CORDING_BLOCK_EXTRA = 24
export const CORDING_BLOCK_MIN = 60
/** Seam allowance taken by each join (½" on each side of the seam). */
export const JOIN_ALLOWANCE = 1
/** Shortest end piece when a plate is joined (seams on the face stay symmetrical). */
export const MIN_PLATE_END = 5
/** Shortest piece joined into a boxing or zipper strip. */
export const MIN_STRIP_END = 3

/** Extra for flaws: one spare plate (the cushion default), or a share of the layout. */
export type Extra = 'plate' | number
export const EXTRA_CHOICES: Extra[] = ['plate', 0, 0.1, 0.15, 0.2]
export const DEFAULT_EXTRA: Extra = 'plate'

const EPS = 1e-6

export type PieceName = 'plate' | 'boxing' | 'zipper' | 'wedgePanel' | 'wedgeSide' | 'sparePlate'

/** One piece to cut. `across` runs across the roll when the piece is cut up the roll. */
export type CutPiece = {
  name: PieceName
  cushion: string
  across: number
  along: number
  /** Set when a too-wide piece was joined: which part (center or end) and the pieces it makes. */
  join?: { part: 'center' | 'end'; of: number }
}

export type PlacedCut = CutPiece & { x: number; y: number; w: number; h: number }

export type Joined = { cushion: string; name: PieceName; center: number; end: number; pieces: number; count: number }

export type FabricPlan = {
  /** Usable width the pieces are laid on. */
  width: number
  direction: Direction
  /** One-way fabric: every piece points the same way along the roll. */
  oneWay: boolean
  placed: PlacedCut[]
  /** Pieces too big for the roll even when joined. */
  tooWide: CutPiece[]
  /** Pieces that had to be joined, one line per cushion and piece. */
  joined: Joined[]
  /** Roll used by the pieces, inches (no end allowance or cording). */
  piecesLength: number
  cordingStrips: number
  /** Roll set aside for the bias cording block, inches. */
  cordingLength: number
  endAllowance: number
  /** Everything added up, inches. */
  totalLength: number
  /** Exact yards for the layout. */
  yards: number
  extra: Extra
  /** Layout yards plus the extra for flaws (a spare plate is already in the layout). */
  yardsWithExtra: number
  /** Yards to order: rounded up to whole yards. */
  orderYards: number
  /** Share of the used roll covered by pieces. */
  used: number
}

/** The cut pieces for one cushion line, from the Cushion Cut Dimensions formulas. */
export function piecesFor(cuts: AnyCuts, cushion: string): CutPiece[] {
  const out: CutPiece[] = []
  const add = (name: PieceName, qty: number, across: number, along: number) => {
    for (let i = 0; i < qty; i++) out.push({ name, cushion, across, along })
  }
  if (cuts.kind === 'box') {
    // Plate: the cushion's width across the roll, front to back along it.
    add('plate', cuts.plate.qty, cuts.plate.width, cuts.plate.depth)
    // Strips go around the cushion, so their length runs across the roll when cut up the roll.
    add('boxing', cuts.boxing.qty, cuts.boxing.x, cuts.boxing.z)
    add('zipper', cuts.zipper.qty, cuts.zipper.x, cuts.zipper.z)
  } else {
    add('wedgePanel', cuts.panel.qty, cuts.panel.width, cuts.panel.height)
    // The side piece is wedge-shaped; it gets its full box (deep end × height).
    add('wedgeSide', cuts.side.qty, cuts.side.bottom, cuts.side.height)
  }
  return out
}

/** Bias cording block length for a number of strips. */
export const cordingBlock = (strips: number) =>
  strips > 0 ? Math.max(CORDING_BLOCK_MIN, strips * CORDING_STRIP_WIDTH + CORDING_BLOCK_EXTRA) : 0

const up8 = (x: number) => Math.ceil(x * 8 - 1e-9) / 8
const down8 = (x: number) => Math.floor(x * 8 + 1e-9) / 8

/**
 * Split a piece `len` long into a center and two mirrored ends so every part is
 * at most `W`. Returns null when it can't be done in three parts.
 */
export function splitSymmetric(len: number, W: number, minEnd: number): { center: number; end: number } | null {
  const total = len + 2 * JOIN_ALLOWANCE
  let center = down8(Math.min(W, total - 2 * minEnd))
  let end = up8((total - center) / 2)
  if (end < minEnd - EPS) {
    end = minEnd
    center = total - 2 * end
  }
  if (center > W + EPS || end > W + EPS || center <= 0) return null
  return { center, end }
}

type Item = CutPiece & { w: number; h: number; area: number }
type Free = { x: number; y: number; w: number; h: number }

/** Lay pieces on a strip `W` wide, in the given order. Returns the placements and the length used. */
function packStrip(items: Item[], W: number, gap: number, score: 'bl' | 'bssf' | 'baf', maxLen = 1e7) {
  // Each piece takes its size plus the gap; the strip gets one extra gap so the last piece fits flush.
  const BW = W + gap
  const bounded = maxLen < 1e7
  let free: Free[] = [{ x: 0, y: 0, w: BW, h: bounded ? maxLen + gap : 1e7 }]
  const placed: { it: Item; x: number; y: number }[] = []
  let length = 0
  for (const it of items) {
    const w = it.w + gap
    const h = it.h + gap
    let best: { x: number; y: number; s1: number; s2: number } | null = null
    for (const f of free) {
      if (w > f.w + EPS || h > f.h + EPS) continue
      let s1: number, s2: number
      if (score === 'bl') {
        s1 = f.y + h
        s2 = f.x
      } else if (bounded) {
        // A fixed length of roll: the classic best-short-side / best-area fits.
        const a = f.w - w
        const c = f.h - h
        s1 = score === 'bssf' ? Math.min(a, c) : f.w * f.h - w * h
        s2 = score === 'bssf' ? Math.max(a, c) : Math.min(a, c)
      } else if (score === 'bssf') {
        s1 = Math.max(length, f.y + h) * 1000 + Math.min(f.w - w, f.h - h)
        s2 = f.y
      } else {
        s1 = Math.max(length, f.y + h) * 1000 + Math.min(f.w - w, 1e5)
        s2 = f.x
      }
      if (!best || s1 < best.s1 - EPS || (Math.abs(s1 - best.s1) < EPS && s2 < best.s2)) best = { x: f.x, y: f.y, s1, s2 }
    }
    if (!best) return null
    const p = { x: best.x, y: best.y, w, h }
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
    placed.push({ it, x: p.x, y: p.y })
    length = Math.max(length, p.y + p.h - gap)
  }
  return { placed, length }
}

/** Pack one set of pieces, trying several orders and scores and keeping the shortest. */
function packBest(items: Item[], width: number, gap: number, cushionOrder: string[]) {
  // With a cushion order, sorting happens inside each cushion and the cushions stay in sequence.
  const rank = (i: Item) => cushionOrder.indexOf(i.cushion)
  const orders: ((a: Item, b: Item) => number)[] = [
    (a, b) => b.area - a.area,
    (a, b) => b.h - a.h || b.area - a.area,
    (a, b) => b.w - a.w || b.area - a.area,
    (a, b) => b.w + b.h - (a.w + a.h),
  ]
  const sorted = orders.map((o) => [...items].sort((a, b) => rank(a) - rank(b) || o(a, b)))
  const tryAll = (maxLen?: number) => {
    let best: NonNullable<ReturnType<typeof packStrip>> | null = null
    for (const list of sorted)
      for (const sc of ['bl', 'bssf', 'baf'] as const) {
        const res = packStrip(list, width, gap, sc, maxLen)
        if (res && (!best || res.length < best.length - EPS)) best = res
      }
    return best
  }
  let best = tryAll()
  if (!best) return null
  // Then squeeze: try shorter fixed lengths of roll, which lets pieces fill the
  // width in rows the way a cutter would, and keep the shortest layout that fits.
  let lo = Math.max(
    items.reduce((n, i) => n + (i.w + gap) * (i.h + gap), 0) / (width + gap) - gap,
    Math.max(...items.map((i) => i.h)),
  )
  let hi = best.length
  for (let k = 0; k < 14 && hi - lo > 0.25; k++) {
    const mid = (lo + hi) / 2
    const res = tryAll(mid)
    if (res && res.length <= mid + EPS) {
      if (res.length < best.length - EPS) best = res
      hi = res.length
    } else lo = mid
  }
  return best
}

export type FabricOptions = {
  /** Width the mill lists. */
  listedWidth: number
  /** Trimmed off each selvage. */
  selvageTrim: number
  direction: DirectionChoice
  gap: number
  endAllowance: number
  /** Total cording for this fabric, inches. */
  cordingInches: number
  /** Keep each cushion's pieces together on the roll, the way the cutters lay it out. */
  together: boolean
  extra: Extra
  /** One-way fabric (nap or directional print). */
  oneWay: boolean
}

/** Lay out one fabric's pieces on the roll and work out the yards to order. */
export function planFabric(pieces: CutPiece[], opts: FabricOptions): FabricPlan {
  // One-way fabric goes up the roll unless someone chose otherwise (that needs approval).
  if (opts.direction === 'auto' && opts.oneWay) return planOneWay(pieces, opts, 'upTheRoll')
  if (opts.direction === 'auto') {
    // "If we can railroad we will": railroad unless up the roll needs no joins and
    // takes fewer yards. Joined plates are decided with the client, never picked here.
    const rr = planOneWay(pieces, opts, 'railroaded')
    const up = planOneWay(pieces, opts, 'upTheRoll')
    const clean = (p: FabricPlan) => !p.tooWide.length && !p.joined.length
    if (clean(up) && (!clean(rr) || up.orderYards < rr.orderYards)) return up
    return rr.tooWide.length && !up.tooWide.length ? up : rr
  }
  return planOneWay(pieces, opts, opts.direction)
}

function planOneWay(pieces: CutPiece[], opts: FabricOptions, direction: Direction): FabricPlan {
  const { gap, endAllowance, cordingInches, together, extra } = opts
  const width = Math.max(1, opts.listedWidth - 2 * opts.selvageTrim)

  // One spare plate: a copy of the largest plate, laid out with everything else.
  const all = [...pieces]
  if (extra === 'plate') {
    const plates = pieces.filter((p) => p.name === 'plate' || p.name === 'wedgePanel')
    const biggest = plates.sort((a, b) => b.across * b.along - a.across * a.along)[0]
    if (biggest) all.push({ ...biggest, name: 'sparePlate', cushion: '' })
  }

  const items: Item[] = []
  const tooWide: CutPiece[] = []
  const joinedMap = new Map<string, Joined>()
  const push = (p: CutPiece) => {
    const [w, h] = direction === 'upTheRoll' ? [p.across, p.along] : [p.along, p.across]
    items.push({ ...p, w, h, area: w * h })
  }
  for (const p of all) {
    if (!(p.across > 0 && p.along > 0)) continue
    // The dimension that runs across the roll.
    const acrossLen = direction === 'upTheRoll' ? p.across : p.along
    if (acrossLen <= width + EPS) {
      push(p)
      continue
    }
    // Too wide across the roll: join it from a center and two mirrored ends.
    const isPlate = p.name === 'plate' || p.name === 'wedgePanel' || p.name === 'sparePlate'
    const split = splitSymmetric(acrossLen, width, isPlate ? MIN_PLATE_END : MIN_STRIP_END)
    if (!split) {
      tooWide.push(p)
      continue
    }
    const mk = (len: number, part: 'center' | 'end'): CutPiece =>
      direction === 'upTheRoll'
        ? { ...p, across: len, join: { part, of: 3 } }
        : { ...p, along: len, join: { part, of: 3 } }
    push(mk(split.center, 'center'))
    push(mk(split.end, 'end'))
    push(mk(split.end, 'end'))
    const key = `${p.cushion}|${p.name}`
    const j = joinedMap.get(key)
    if (j) j.count++
    else joinedMap.set(key, { cushion: p.cushion, name: p.name, center: split.center, end: split.end, pieces: 3, count: 1 })
  }

  // Together: cushions go down the roll one after the other, each cushion's pieces laid
  // as a group; a later cushion may still use a gap the earlier one left. The spare
  // plate goes last. Otherwise every piece is sorted freely to use the least fabric.
  const order: string[] = []
  for (const it of items) if (it.cushion && !order.includes(it.cushion)) order.push(it.cushion)
  order.push('')
  let res = items.length ? packBest(items, width, gap, order) : null
  if (!together && items.length) {
    const free = packBest(items, width, gap, [])
    if (free && (!res || free.length < res.length - EPS)) res = free
  }
  const placed: PlacedCut[] = (res?.placed ?? []).map(({ it, x, y }) => ({
    name: it.name,
    cushion: it.cushion,
    across: it.across,
    along: it.along,
    join: it.join,
    x,
    y,
    w: it.w,
    h: it.h,
  }))
  const piecesLength = res?.length ?? 0
  const strips = cordingStrips(cordingInches)
  const cordingLength = cordingBlock(strips)
  const totalLength = (piecesLength > 0 || cordingLength > 0 ? endAllowance : 0) + piecesLength + cordingLength
  const yards = totalLength / 36
  const yardsWithExtra = typeof extra === 'number' ? yards * (1 + extra) : yards
  const pieceArea = items.reduce((n, i) => n + i.area, 0)
  return {
    width,
    direction,
    oneWay: opts.oneWay,
    placed,
    tooWide,
    joined: [...joinedMap.values()],
    piecesLength,
    cordingStrips: strips,
    cordingLength,
    endAllowance: totalLength > 0 ? endAllowance : 0,
    totalLength,
    yards,
    extra,
    yardsWithExtra,
    orderYards: Math.ceil(yardsWithExtra - 1e-9),
    used: piecesLength > 0 ? pieceArea / (piecesLength * width) : 0,
  }
}
