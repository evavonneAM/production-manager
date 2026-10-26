// Fabric yardage for cushions: lay every cut piece for one fabric onto the roll
// (MaxRects, the same method as the plywood nesting) and measure how much roll
// it takes. One-way (nap) fabrics and pattern repeats (straight or half-drop) are handled.
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
// - Patterned fabric (for estimating): every plate, boxing strip and wedge piece is cut
//   with a motif centered on it, so it can only sit where the pattern puts a motif.
//   Zipper strips are hidden at the back and go anywhere. Up the roll unless railroading
//   is chosen (a designer or work order has to approve it). A strip too long for the
//   roll is joined so the center and both ends still land on a motif. Where the motifs
//   fall across the roll is luck, so the yardage is the worst of four starting points.

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

export type PlacedCut = CutPiece & {
  x: number
  y: number
  w: number
  h: number
  /** Patterned fabric: the piece is cut with a motif centered on it. */
  matched?: boolean
}

/** A pattern repeat, as the mill lists it (inches). Half-drop: every other column is dropped half a repeat. */
export type Pattern = { vertical: number; horizontal: number; halfDrop: boolean }

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
  /** Patterned fabric only: the repeat used. */
  pattern?: Pattern
  /** Patterned fabric: pieces that could not be centered on a motif (they can't land on one across the roll). */
  offCenter: number
  /** Patterned fabric: the yards were raised to the plain-fabric layout, which came out longer. */
  heldAtPlain?: boolean
}

/** The cut pieces for one cushion line, from the Cushion Cut Dimensions formulas. */
export function piecesFor(cuts: AnyCuts, cushion: string): CutPiece[] {
  const out: CutPiece[] = []
  const add = (name: PieceName, qty: number, across: number, along: number) => {
    for (let i = 0; i < qty; i++) out.push({ name, cushion, across, along })
  }
  if (cuts.kind === 'board') {
    // Board-mounted: one plate on top and one boxing strip around the board, no zipper.
    add('plate', cuts.plate.qty, cuts.plate.width, cuts.plate.depth)
    add('boxing', cuts.boxing.qty, cuts.boxing.x, cuts.boxing.z)
  } else if (cuts.kind === 'box') {
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
export const cordingBlock = (strips: number) => (strips > 0 ? Math.max(CORDING_BLOCK_MIN, strips * CORDING_STRIP_WIDTH + CORDING_BLOCK_EXTRA) : 0)

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

/**
 * A strip too long to cut in three parts (a board-mounted boxing goes all the way round)
 * is cut in more equal parts: 5, 7, 9… Each join takes the usual seam allowance.
 * Returns the part length and count, or null.
 */
export function splitStrip(len: number, W: number, minEnd: number): { part: number; count: number } | null {
  for (let n = 5; n <= 15; n += 2) {
    const part = up8((len + (n - 1) * JOIN_ALLOWANCE) / n)
    if (part <= W + EPS && part >= minEnd - EPS) return { part, count: n }
  }
  return null
}

type Item = CutPiece & { w: number; h: number; area: number }
type Free = { x: number; y: number; w: number; h: number }

/** Lay pieces on a strip `W` wide, in the given order. Returns the placements and the length used. */
/** `holes`: open space inside the box (relative to its corner) that other pieces may use. */
type Box = { w: number; h: number; area: number; cushion: string; holes?: Free[] }

function packStrip<T extends Box>(items: T[], W: number, gap: number, score: 'bl' | 'bssf' | 'baf', maxLen = 1e7) {
  // Each piece takes its size plus the gap; the strip gets one extra gap so the last piece fits flush.
  const BW = W + gap
  const bounded = maxLen < 1e7
  let free: Free[] = [{ x: 0, y: 0, w: BW, h: bounded ? maxLen + gap : 1e7 }]
  const placed: { it: T; x: number; y: number }[] = []
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
    // Open space inside a block (the staircase beside shorter strips) stays usable.
    for (const hole of it.holes ?? []) if (hole.w > EPS && hole.h > EPS) out.push({ x: p.x + hole.x, y: p.y + hole.y, w: hole.w, h: hole.h })
    free = out.filter(
      (a, i) =>
        !out.some(
          (c, j) =>
            j !== i &&
            a.x >= c.x - EPS &&
            a.y >= c.y - EPS &&
            a.x + a.w <= c.x + c.w + EPS &&
            a.y + a.h <= c.y + c.h + EPS &&
            (j < i || !(Math.abs(a.x - c.x) < EPS && Math.abs(a.y - c.y) < EPS && Math.abs(a.w - c.w) < EPS && Math.abs(a.h - c.h) < EPS)),
        ),
    )
    placed.push({ it, x: p.x, y: p.y })
    length = Math.max(length, p.y + p.h - gap)
  }
  return { placed, length }
}

/** Pack one set of pieces, trying several orders and scores and keeping the shortest. */
function packBest<T extends Box>(items: T[], width: number, gap: number, cushionOrder: string[]) {
  // With a cushion order, sorting happens inside each cushion and the cushions stay in sequence.
  const rank = (i: T) => cushionOrder.indexOf(i.cushion)
  const orders: ((a: T, b: T) => number)[] = [
    (a, b) => b.area - a.area,
    (a, b) => b.h - a.h || b.area - a.area,
    (a, b) => b.w - a.w || b.area - a.area,
    (a, b) => b.w + b.h - (a.w + a.h),
  ]
  const sorted = orders.map((o) => [...items].sort((a, b) => rank(a) - rank(b) || o(a, b)))
  const tryAll = (maxLen?: number) => {
    let best: NonNullable<ReturnType<typeof packStrip<T>>> | null = null
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
  let lo = Math.max(items.reduce((n, i) => n + (i.w + gap) * (i.h + gap), 0) / (width + gap) - gap, Math.max(...items.map((i) => i.h)))
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

const STRIPS: PieceName[] = ['boxing', 'zipper']

/** A rectangle of pieces the cutter marks and cuts as one: a grid of same-size plates, or a bundle of strips. */
type Block = Box & {
  parts: { it: Item; dx: number; dy: number }[]
  /** Strip bundles: which side of the block holds the longest lanes. */
  longSide?: 'near' | 'far'
}

type GridStyle = 'wide' | 'balanced' | 'column'

/**
 * Group pieces into blocks, the way the cutters lay out: same-size plates in a tidy
 * grid (one straight line cuts a whole row), and every boxing and zipper strip
 * together in one bundle of lanes, apart from the plates. With `looseZippers`, the boxing
 * goes down as its own bundle and each zipper strip is tucked into whatever gap fits it.
 */
function makeBlocks(
  items: Item[],
  W: number,
  gap: number,
  style: (w: number, h: number) => GridStyle,
  byCushion: boolean,
  mirror: boolean,
  looseZippers = false,
  /** Widest a strip bundle may be: narrower than the roll when the strips run down the open fabric beside a plate column. */
  bundleWidth = W,
): Block[] {
  const blocks: Block[] = []
  const groupKey = (i: Item) => (byCushion ? i.cushion : '')
  const groups = new Map<string, Item[]>()
  for (const it of items) {
    if (looseZippers && it.name === 'zipper') {
      blocks.push({ w: it.w, h: it.h, area: it.area, cushion: byCushion ? it.cushion : '', parts: [{ it, dx: 0, dy: 0 }] })
      continue
    }
    const kind = STRIPS.includes(it.name) ? 'strip' : 'plate'
    const key = kind === 'strip' ? `${groupKey(it)}|strip` : `${groupKey(it)}|${it.w}|${it.h}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(it)
  }
  for (const [key, list] of groups) {
    const cushion = byCushion ? list[0].cushion : ''
    if (key.endsWith('|strip')) blocks.push(...stripBundles(list, bundleWidth, gap, cushion, mirror))
    else blocks.push(...plateGrids(list, W, gap, style(list[0].w, list[0].h), cushion))
  }
  return blocks
}

/** Same-size plates in full grid rows; any leftovers form one short row of their own. */
function plateGrids(list: Item[], W: number, gap: number, style: GridStyle, cushion: string): Block[] {
  const { w, h } = list[0]
  const n = list.length
  const maxCols = Math.max(1, Math.floor((W + gap + EPS) / (w + gap)))
  const cols = style === 'column' ? 1 : style === 'wide' ? Math.min(n, maxCols) : Math.ceil(n / Math.ceil(n / Math.min(n, maxCols)))
  const grid = (pieces: Item[], c: number): Block => {
    const rows = Math.ceil(pieces.length / c)
    const parts = pieces.map((it, k) => ({ it, dx: (k % c) * (w + gap), dy: Math.floor(k / c) * (h + gap) }))
    const bw = c * w + (c - 1) * gap
    const bh = rows * h + (rows - 1) * gap
    return { w: bw, h: bh, area: bw * bh, cushion, parts }
  }
  const full = Math.floor(n / cols) * cols
  const out = [grid(list.slice(0, full), cols)]
  if (full < n) out.push(grid(list.slice(full), n - full))
  return out.filter((b) => b.parts.length)
}

/**
 * Strips laid in lanes along their length, short ones end to end in the same lane,
 * lanes side by side. Lanes run along the roll when the strips do (railroaded), or
 * across it when they are cut up the roll.
 */
/** `mirror` puts the longest lanes on the other side, so they can sit on whichever roll edge the bundle lands on. */
function stripBundles(list: Item[], W: number, gap: number, cushion: string, mirror: boolean): Block[] {
  const along = list.every((i) => i.h >= i.w)
  const long = (i: Item) => (along ? i.h : i.w)
  const short = (i: Item) => (along ? i.w : i.h)
  const laneLen = Math.max(...list.map(long))
  const lanes: { width: number; used: number; items: Item[]; offset?: number; bundle?: Block }[] = []
  for (const it of [...list].sort((a, b) => short(b) - short(a) || long(b) - long(a))) {
    const lane = lanes.find((l) => Math.abs(l.width - short(it)) < EPS && l.used + gap + long(it) <= laneLen + EPS)
    if (lane) {
      lane.items.push(it)
      lane.used += gap + long(it)
    } else lanes.push({ width: short(it), used: long(it), items: [it] })
  }
  // Longest lanes on the outside edge, getting shorter toward the middle (the cutters' habit):
  // the staircase of open fabric this leaves can take another piece, like a spare plate.
  lanes.sort((a, b) => b.used - a.used)
  // Lanes side by side; when they run along the roll, a bundle is never wider than the roll.
  const bundles: Block[] = []
  // Each bundle is as long as its own longest lane (lanes are sorted longest first).
  const bundleLen = new Map<Block, number>()
  let cur: Block | null = null
  let offset = 0
  for (const lane of lanes) {
    if (cur && along && offset + lane.width > W + EPS) {
      bundles.push(cur)
      cur = null
    }
    if (!cur) {
      cur = { w: 0, h: 0, area: 0, cushion, parts: [], holes: [], longSide: along ? (mirror ? 'far' : 'near') : undefined }
      offset = 0
      bundleLen.set(cur, lane.used)
    }
    lane.bundle = cur
    let pos = 0
    for (const it of lane.items) {
      cur.parts.push(along ? { it, dx: offset, dy: pos } : { it, dx: pos, dy: offset })
      pos += long(it) + gap
    }
    lane.offset = offset
    offset += lane.width + gap
    const len = bundleLen.get(cur)!
    if (along) {
      cur.w = offset - gap
      cur.h = len
    } else {
      cur.w = len
      cur.h = offset - gap
    }
    cur.area = cur.w * cur.h
  }
  if (cur) bundles.push(cur)
  // Open fabric beyond the end of each shorter lane, out to the bundle's far side.
  for (const lane of lanes) {
    const b = lane.bundle!
    const rest = bundleLen.get(b)! - lane.used - gap
    if (rest <= EPS) continue
    const o = lane.offset!
    b.holes!.push(along ? { x: o, y: lane.used + gap, w: b.w - o + gap, h: rest + gap } : { x: lane.used + gap, y: o, w: rest + gap, h: b.h - o + gap })
  }
  if (mirror && along)
    for (const b of bundles) {
      for (const part of b.parts) part.dx = b.w - part.dx - part.it.w
      for (const hole of b.holes!) hole.x = b.w + gap - (hole.x + hole.w)
    }
  return bundles
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
  /** Pattern repeat; leave out (or 0") for a plain fabric. */
  pattern?: Pattern | null
}

/** Lay out one fabric's pieces on the roll and work out the yards to order. */
export function planFabric(pieces: CutPiece[], opts: FabricOptions): FabricPlan {
  // Patterned fabric goes up the roll unless railroading was chosen on purpose.
  if (opts.pattern && opts.pattern.vertical > 0) {
    const direction = opts.direction === 'auto' ? 'upTheRoll' : opts.direction
    const pat = planPattern(pieces, opts, direction, opts.pattern)
    // A pattern never takes less fabric than the same job in a plain fabric: if the
    // pattern layout packs tighter than the cutter-friendly plain layout, hold the
    // estimate at the plain yardage.
    const plain = planOneWay(pieces, { ...opts, pattern: null }, direction)
    if (plain.yardsWithExtra > pat.yardsWithExtra + EPS)
      return { ...pat, yards: plain.yards, yardsWithExtra: plain.yardsWithExtra, orderYards: plain.orderYards, heldAtPlain: true }
    return pat
  }
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

  const items: Item[] = []
  const tooWide: CutPiece[] = []
  const joinedMap = new Map<string, Joined>()
  /** Turn pieces into roll-oriented items, joining any that are too wide for the roll. */
  const toItems = (list: CutPiece[], out: Item[], track: boolean) => {
    const push = (p: CutPiece) => {
      const [w, h] = direction === 'upTheRoll' ? [p.across, p.along] : [p.along, p.across]
      out.push({ ...p, w, h, area: w * h })
    }
    for (const p of list) {
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
      const many = !split && !isPlate ? splitStrip(acrossLen, width, MIN_STRIP_END) : null
      if (many) {
        for (let k = 0; k < many.count; k++) {
          const part = k === (many.count - 1) / 2 ? 'center' : 'end'
          push(direction === 'upTheRoll' ? { ...p, across: many.part, join: { part, of: many.count } } : { ...p, along: many.part, join: { part, of: many.count } })
        }
        if (!track) continue
        const key = `${p.cushion}|${p.name}`
        const j = joinedMap.get(key)
        if (j) j.count++
        else joinedMap.set(key, { cushion: p.cushion, name: p.name, center: many.part, end: many.part, pieces: many.count, count: 1 })
        continue
      }
      if (!split) {
        if (track) tooWide.push(p)
        continue
      }
      const mk = (len: number, part: 'center' | 'end'): CutPiece =>
        direction === 'upTheRoll' ? { ...p, across: len, join: { part, of: 3 } } : { ...p, along: len, join: { part, of: 3 } }
      push(mk(split.center, 'center'))
      push(mk(split.end, 'end'))
      push(mk(split.end, 'end'))
      if (!track) continue
      const key = `${p.cushion}|${p.name}`
      const j = joinedMap.get(key)
      if (j) j.count++
      else joinedMap.set(key, { cushion: p.cushion, name: p.name, center: split.center, end: split.end, pieces: 3, count: 1 })
    }
  }

  // One spare plate: a copy of the largest plate, laid out with everything else.
  const plates = pieces.filter((p) => p.name === 'plate' || p.name === 'wedgePanel').sort((a, b) => b.across * b.along - a.across * a.along)
  const spare = (p: CutPiece): CutPiece => ({ ...p, name: 'sparePlate', cushion: '' })
  toItems(extra === 'plate' && plates[0] ? [...pieces, spare(plates[0])] : pieces, items, true)

  // Together: cushions go down the roll one after the other, each cushion's pieces laid
  // as a group; a later cushion may still use a gap the earlier one left. The spare
  // plate goes last. Otherwise every piece is sorted freely to use the least fabric.
  const order: string[] = []
  for (const it of items) if (it.cushion && !order.includes(it.cushion)) order.push(it.cushion)
  order.push('')
  // Pieces go down in blocks (plate grids, strip bundles); try a few grid shapes and keep the shortest.
  type Layout = { placed: { it: Block; x: number; y: number }[]; length: number }
  // Strip bundles whose longest lanes don't sit on a roll edge (the cutters keep them on the outside).
  const offEdge = (r: Layout) => r.placed.filter(({ it, x }) => (it.longSide === 'near' && x > EPS) || (it.longSide === 'far' && x + it.w < width - EPS)).length
  // Slide a strip bundle out to the roll edge on its long side when nothing is in the way.
  const toEdge = (r: Layout): Layout => {
    for (const p of r.placed) {
      if (!p.it.longSide) continue
      const target = p.it.longSide === 'near' ? 0 : width - p.it.w
      const lo = Math.min(p.x, target)
      const hi = Math.max(p.x, target) + p.it.w
      const blocked = r.placed.some((q) => q !== p && q.y < p.y + p.it.h - EPS && q.y + q.it.h > p.y + EPS && q.x < hi - EPS && q.x + q.it.w > lo + EPS)
      if (!blocked) p.x = target
    }
    return r
  }
  const layout = (list: Item[]) => {
    const pick: { best: Layout | null } = { best: null }
    // Grid shapes to try: the same shape for every plate size, and (for up to three sizes)
    // each size on its own as a single column or a wide grid, so a narrow column of plates
    // can sit beside the strips while the bigger plates go in rows after them.
    const sizes = [...new Set(list.filter((i) => !STRIPS.includes(i.name)).map((i) => `${i.w}x${i.h}`))]
    const shapes: ((w: number, h: number) => GridStyle)[] = (['wide', 'balanced', 'column'] as const).map((st) => () => st)
    if (sizes.length > 1 && sizes.length <= 3)
      for (let mask = 1; mask < (1 << sizes.length) - 1; mask++) shapes.push((w, h) => ((mask >> sizes.indexOf(`${w}x${h}`)) & 1 ? 'column' : 'wide'))
    const consider = (r0: Layout | null) => {
      const r = r0 && toEdge(r0)
      const best = pick.best
      if (r && (!best || r.length < best.length - EPS || (r.length < best.length + EPS && offEdge(r) < offEdge(best)))) pick.best = r
    }
    for (const style of shapes)
      for (const mirror of [false, true])
        for (const loose of [false, true]) consider(packBest(makeBlocks(list, width, gap, style, together, mirror, loose), width, gap, together ? order : []))
    // Strips beside the plates: one plate size in a single column down the roll, and the strips
    // in lanes down the open fabric beside it (the cutters' favorite: short, and few moves).
    const narrowest = Math.min(...list.filter((i) => STRIPS.includes(i.name)).map((i) => Math.min(i.w, i.h)))
    for (const key of sizes) {
      const side = width - Number(key.split('x')[0]) - gap
      if (!(side >= narrowest - EPS)) continue
      const style = (w: number, h: number) => (`${w}x${h}` === key ? 'column' : 'wide') as GridStyle
      for (const mirror of [false, true])
        for (const loose of [false, true])
          consider(packBest(makeBlocks(list, width, gap, style, together, mirror, loose, side), width, gap, together ? order : []))
    }
    return pick.best
  }
  let res = items.length ? layout(items) : null
  // A spare of each other plate size comes free when it fits in the open fabric already there.
  if (res && extra === 'plate') {
    const sizes = new Set([`${plates[0].across}x${plates[0].along}`])
    for (const p of plates) {
      const key = `${p.across}x${p.along}`
      if (sizes.has(key)) continue
      sizes.add(key)
      const more: Item[] = []
      toItems([spare(p)], more, false)
      const r = layout([...items, ...more])
      if (r && r.length <= res.length + EPS) {
        items.push(...more)
        res = r
      }
    }
  }
  const placed: PlacedCut[] = (res?.placed ?? []).flatMap(({ it: b, x, y }) =>
    b.parts.map(({ it, dx, dy }) => ({
      name: it.name,
      cushion: it.cushion,
      across: it.across,
      along: it.along,
      join: it.join,
      x: x + dx,
      y: y + dy,
      w: it.w,
      h: it.h,
    })),
  )
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
    offCenter: 0,
  }
}

// ── Patterned fabric ────────────────────────────────────────────────

type PItem = CutPiece & { w: number; h: number; matched: boolean }

/** Small seeded random numbers, so the same job always gives the same layout. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Where motif centers fall on the roll. Up the roll, motif columns run along the roll every
 * `horizontal` inches across it (half-drop: every other column drops half a repeat).
 * Railroaded, the pattern is turned: its vertical repeat runs across the roll.
 */
function lattice(pattern: Pattern, direction: Direction, ox: number) {
  const { vertical: V, horizontal: H, halfDrop } = pattern
  const drop = (k: number) => (halfDrop && Math.abs(k) % 2 === 1 ? V / 2 : 0)
  const mod = (a: number, m: number) => ((a % m) + m) % m
  /** Lowest motif center at or past `y0` (along) in column `i` / at or past `x0` (across) in row `j`. */
  const candidates = (fx: number, fy: number, w: number, h: number): [number, number][] => {
    const out: [number, number][] = []
    if (direction === 'upTheRoll') {
      const i0 = Math.ceil((fx + w / 2 - ox) / H - EPS)
      for (let i = i0; i < i0 + 3; i++) {
        const cx = ox + i * H
        const ph = drop(i)
        const cy = ph + Math.ceil((fy + h / 2 - ph) / V - EPS) * V
        out.push([cx - w / 2, cy - h / 2])
      }
    } else {
      const j0 = Math.ceil((fy + h / 2) / H - EPS)
      for (let j = j0; j < j0 + 3; j++) {
        const cy = j * H
        const ph = ox + drop(j)
        const cx = ph + Math.ceil((fx + w / 2 - ph) / V - EPS) * V
        out.push([cx - w / 2, cy - h / 2])
      }
    }
    return out
  }
  /** Can a piece `w` across land centered on a motif inside the usable width `W`? */
  const fitsAcross = (w: number, W: number) => {
    if (w > W + EPS) return false
    const phases = direction === 'upTheRoll' ? [{ p: ox, P: H }] : [{ p: ox, P: V }, ...(halfDrop ? [{ p: ox + V / 2, P: V }] : [])]
    return phases.some(({ p, P }) => mod(p - w / 2, P) + w <= W + EPS)
  }
  return { candidates, fitsAcross, period: direction === 'upTheRoll' ? H : V }
}

/** MaxRects, lowest piece end first; matched pieces may only sit centered on a motif. */
function packPattern(items: PItem[], W: number, gap: number, lat: ReturnType<typeof lattice>) {
  let free: Free[] = [{ x: 0, y: 0, w: W + gap, h: 1e7 }]
  const placed: { it: PItem; x: number; y: number }[] = []
  for (const it of items) {
    const w = it.w + gap
    const h = it.h + gap
    let best: { x: number; y: number; k1: number; k2: number } | null = null
    for (const f of free) {
      const spots: [number, number][] = it.matched ? lat.candidates(f.x, f.y, it.w, it.h) : [[f.x, f.y]]
      for (const [x, y] of spots) {
        if (x < f.x - EPS || y < f.y - EPS || x + w > f.x + f.w + EPS || y + h > f.y + f.h + EPS) continue
        const k1 = y + h
        if (!best || k1 < best.k1 - EPS || (Math.abs(k1 - best.k1) < EPS && x < best.k2)) best = { x, y, k1, k2: x }
      }
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
            a.x >= c.x - EPS &&
            a.y >= c.y - EPS &&
            a.x + a.w <= c.x + c.w + EPS &&
            a.y + a.h <= c.y + c.h + EPS &&
            (j < i || !(Math.abs(a.x - c.x) < EPS && Math.abs(a.y - c.y) < EPS && Math.abs(a.w - c.w) < EPS && Math.abs(a.h - c.h) < EPS)),
        ),
    )
    placed.push({ it, x: best.x, y: best.y })
  }
  const length = placed.reduce((n, { it, y }) => Math.max(n, y + it.h), 0)
  return { placed, length }
}

function planPattern(pieces: CutPiece[], opts: FabricOptions, direction: Direction, pattern: Pattern): FabricPlan {
  const { gap, endAllowance, cordingInches, extra } = opts
  const width = Math.max(1, opts.listedWidth - 2 * opts.selvageTrim)
  const pat: Pattern = { ...pattern, horizontal: pattern.horizontal > 0 ? pattern.horizontal : pattern.vertical }
  const plates = pieces.filter((p) => p.name === 'plate' || p.name === 'wedgePanel').sort((a, b) => b.across * b.along - a.across * a.along)
  const all = extra === 'plate' && plates[0] ? [...pieces, { ...plates[0], name: 'sparePlate' as const, cushion: '' }] : pieces
  const isPlate = (n: PieceName) => n === 'plate' || n === 'wedgePanel' || n === 'sparePlate'

  /** Pieces for one starting point of the pattern: joins depend on where the motifs fall. */
  const prepare = (lat: ReturnType<typeof lattice>) => {
    const items: PItem[] = []
    const tooWide: CutPiece[] = []
    const joined = new Map<string, Joined>()
    let offCenter = 0
    for (const p of all) {
      if (!(p.across > 0 && p.along > 0)) continue
      const matched = p.name !== 'zipper'
      const [w, h] = direction === 'upTheRoll' ? [p.across, p.along] : [p.along, p.across]
      const ok = (c: number) => (matched ? lat.fitsAcross(c, width) : c <= width + EPS)
      if (ok(w)) {
        items.push({ ...p, w, h, matched })
        continue
      }
      if (w <= width + EPS) {
        // Fits the roll but can't be centered on a motif: cut it where it fits, off center.
        items.push({ ...p, w, h, matched: false })
        offCenter++
        continue
      }
      const minEnd = isPlate(p.name) ? MIN_PLATE_END : MIN_STRIP_END
      const total = w + 2 * JOIN_ALLOWANCE
      const endOf = (c: number) => up8((total - c) / 2)
      let center = 0
      let endsMatched = matched
      for (let c = down8(width); c >= minEnd; c -= 0.125) {
        const e = endOf(c)
        if (ok(c) && e >= minEnd - EPS && ok(e)) {
          center = c
          break
        }
      }
      if (!center)
        for (let c = down8(width); c >= minEnd; c -= 0.125) {
          const e = endOf(c)
          if (ok(c) && e >= minEnd - EPS && e <= width + EPS) {
            center = c
            endsMatched = false
            offCenter++
            break
          }
        }
      if (!center && !isPlate(p.name)) {
        // Too long for three parts: equal parts all the way round, cut where they fit.
        const many = splitStrip(w, width, MIN_STRIP_END)
        if (many) {
          for (let k = 0; k < many.count; k++) {
            const part = k === (many.count - 1) / 2 ? 'center' : 'end'
            const piece: CutPiece = direction === 'upTheRoll' ? { ...p, across: many.part, join: { part, of: many.count } } : { ...p, along: many.part, join: { part, of: many.count } }
            items.push({ ...piece, w: many.part, h, matched: false })
          }
          offCenter++
          const key = `${p.cushion}|${p.name}`
          const j = joined.get(key)
          if (j) j.count++
          else joined.set(key, { cushion: p.cushion, name: p.name, center: many.part, end: many.part, pieces: many.count, count: 1 })
          continue
        }
      }
      if (!center) {
        tooWide.push(p)
        continue
      }
      const end = endOf(center)
      const mk = (len: number, part: 'center' | 'end', m: boolean): PItem => {
        const piece: CutPiece = direction === 'upTheRoll' ? { ...p, across: len, join: { part, of: 3 } } : { ...p, along: len, join: { part, of: 3 } }
        return { ...piece, w: len, h, matched: m }
      }
      items.push(mk(center, 'center', matched), mk(end, 'end', endsMatched), mk(end, 'end', endsMatched))
      const key = `${p.cushion}|${p.name}`
      const j = joined.get(key)
      if (j) j.count++
      else joined.set(key, { cushion: p.cushion, name: p.name, center, end, pieces: 3, count: 1 })
    }
    return { items, tooWide, joined: [...joined.values()], offCenter }
  }

  type Run = ReturnType<typeof prepare> & { placed: { it: PItem; x: number; y: number }[]; length: number }
  let worst: Run | null = null
  const period = direction === 'upTheRoll' ? pat.horizontal : pat.vertical
  for (let k = 0; k < 4; k++) {
    const lat = lattice(pat, direction, (period * k) / 4)
    const prep = prepare(lat)
    const orders: ((a: PItem, b: PItem) => number)[] = [
      (a, b) => Number(b.matched) - Number(a.matched) || b.w * b.h - a.w * a.h,
      (a, b) => b.w * b.h - a.w * a.h,
      (a, b) => b.w - a.w || b.h - a.h,
      (a, b) => b.h - a.h || b.w - a.w,
      (a, b) => Number(b.matched) - Number(a.matched) || b.w - a.w,
    ]
    const lists = orders.map((o) => [...prep.items].sort(o))
    const rand = rng(7 + k)
    for (let s = 0; s < 24; s++) {
      const q = [...lists[0]]
      for (let i = 0; i < q.length; i++) {
        const j = Math.min(q.length - 1, i + Math.floor(rand() * 4))
        ;[q[i], q[j]] = [q[j], q[i]]
      }
      lists.push(q)
    }
    let best: { placed: { it: PItem; x: number; y: number }[]; length: number } | null = null
    for (const list of lists) {
      const r = packPattern(list, width, gap, lat)
      if (r && (!best || r.length < best.length - EPS)) best = r
    }
    if (!best) continue
    if (!worst || best.length > worst.length + EPS) worst = { ...prep, ...best }
  }

  const placed: PlacedCut[] = (worst?.placed ?? []).map(({ it, x, y }) => ({
    name: it.name,
    cushion: it.cushion,
    across: it.across,
    along: it.along,
    join: it.join,
    x,
    y,
    w: it.w,
    h: it.h,
    matched: it.matched,
  }))
  const piecesLength = worst?.length ?? 0
  const strips = cordingStrips(cordingInches)
  const cordingLength = cordingBlock(strips)
  const totalLength = (piecesLength > 0 || cordingLength > 0 ? endAllowance : 0) + piecesLength + cordingLength
  const yards = totalLength / 36
  const yardsWithExtra = typeof extra === 'number' ? yards * (1 + extra) : yards
  const pieceArea = (worst?.items ?? []).reduce((n, i) => n + i.w * i.h, 0)
  return {
    width,
    direction,
    oneWay: opts.oneWay,
    placed,
    tooWide: worst?.tooWide ?? [],
    joined: worst?.joined ?? [],
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
    pattern: pat,
    offCenter: worst?.offCenter ?? 0,
  }
}
