// Cushion cut dimensions — same formulas as the original cushion-cut-dims
// calculator. Inputs are the ORDERED size. The cover is made to the finished
// size: ¼" off width and depth, and the chosen deduction off the height.
// Foam is cut to the ordered size.

export type ZipperStyle = 'wrap' | 'back'

export type FoamWrap = 'none' | 'lightDacron' | 'heavyDacron' | 'envelope'

export type CushionInput = {
  qty: number
  /** Front & zipper edge, inches. */
  front: number
  /** Sides (depth), inches. */
  sides: number
  /** Ordered height, inches. */
  height: number
  style: ZipperStyle
  /** Inches taken off the ordered height for the finished boxing height. */
  heightDeduction: number
  /** False when the cushion has no cording. */
  cording: boolean
}

export type CushionCuts = {
  kind: 'box'
  finishedWidth: number
  finishedDepth: number
  finishedHeight: number
  deduction: number
  plate: { qty: number; width: number; depth: number }
  boxing: { qty: number; x: number; z: number }
  zipper: { qty: number; x: number; z: number }
  /** Total cording for this line, inches (0 when the cushion has none). */
  cording: number
  /** Foam is cut to the ordered size. */
  foam: { qty: number; width: number; depth: number; height: number }
}

/** Cording is cut on the bias from 54" fabric: a strip is about 74" long
 *  (the 54" square's diagonal, rounded down a little). */
export const BIAS_STRIP_LENGTH = 74

/** Strips to cut for a length of cording, rounded up. */
export function cordingStrips(inches: number): number {
  return inches > 0 ? Math.ceil(inches / BIAS_STRIP_LENGTH - 1e-9) : 0
}

/** Cording per fabric, so strips are counted from each fabric's own total. */
export function cordingByFabric(items: { fabric: string; cording: number }[]): { fabric: string; inches: number; strips: number }[] {
  const map = new Map<string, number>()
  for (const it of items) {
    const key = it.fabric.trim()
    map.set(key, (map.get(key) ?? 0) + it.cording)
  }
  return [...map.entries()].map(([fabric, inches]) => ({ fabric, inches, strips: cordingStrips(inches) }))
}

/** Taken off the ordered width and depth for the finished cover. */
export const COVER_DEDUCTION = 0.25

/** Height deductions the workroom uses; ½" unless the job says otherwise. */
export const HEIGHT_DEDUCTIONS = [0.25, 0.5, 1, 1.5] as const
export const DEFAULT_HEIGHT_DEDUCTION = 0.5

export function cushionCuts({ qty, front, sides, height, style, heightDeduction: deduction, cording: hasCording }: CushionInput): CushionCuts {
  const c = front - COVER_DEDUCTION
  const d = sides - COVER_DEDUCTION
  const e = height - deduction
  const plate = { qty: qty * 2, width: c + 1, depth: d + 1 }
  const foam = { qty, width: front, depth: sides, height }
  const cording = hasCording ? (c + d) * 2 * 2 * qty : 0
  const zipZ = e / 2 + 1.25
  if (style === 'back') {
    return {
      kind: 'box',
      finishedWidth: c,
      finishedDepth: d,
      finishedHeight: e,
      deduction,
      plate,
      boxing: { qty, x: d + d + c + 5, z: e + 1 },
      zipper: { qty: qty * 2, x: c - 3, z: zipZ },
      cording,
      foam,
    }
  }
  return {
    kind: 'box',
    finishedWidth: c,
    finishedDepth: d,
    finishedHeight: e,
    deduction,
    plate,
    boxing: { qty, x: c + d + 2, z: e + 1 },
    zipper: { qty: qty * 2, x: c + d + 2, z: zipZ },
    cording,
    foam,
  }
}

// ── Wedge (back) cushion ────────────────────────────────────────────
// Stands on its deep end: `bottom` is the deep end, `top` the thin end,
// `height` is bottom to top. The straight side is plumb; the sloped side is
// the back rest. One main panel wraps the whole profile and closes with a
// full-length zipper centered on the bottom; two side pieces close the ends.

/** Wedge length deductions; ½" unless the job says otherwise. */
export const LENGTH_DEDUCTIONS = [0.5, 1] as const
export const DEFAULT_LENGTH_DEDUCTION = 0.5

export type WedgeInput = {
  qty: number
  length: number
  height: number
  bottom: number
  top: number
  lengthDeduction: number
  cording: boolean
}

export type WedgeCuts = {
  kind: 'wedge'
  finishedLength: number
  deduction: number
  /** Length of the sloped back-rest side. */
  slope: number
  /** Wraps the profile; ½" each end, ¾" at each zipper edge. */
  panel: { qty: number; width: number; height: number }
  /** Wedge-shaped ends with ½" seam allowance all around. */
  side: { qty: number; height: number; top: number; bottom: number }
  zipper: { qty: number; length: number }
  /** Around both side pieces (0 when the cushion has no cording). */
  cording: number
  foam: { qty: number; length: number; height: number; bottom: number; top: number }
}

/** Workroom rule: sizes round UP to the next ⅛", never down. */
const up8 = (x: number) => Math.ceil(x * 8 - 1e-9) / 8

export function wedgeCuts({ qty, length, height: h, bottom: b, top: t, lengthDeduction, cording: hasCording }: WedgeInput): WedgeCuts {
  const l = length - lengthDeduction
  const run = b - t
  const slope = Math.hypot(h, run)
  const perimeter = h + b + t + slope
  // A ½" offset of the profile: the sloped edge moves out ½" square to itself,
  // which widens each end by ½"/cos and shifts it by ½"·tan along the slope.
  const tan = run / h
  const sec = slope / h
  return {
    kind: 'wedge',
    finishedLength: l,
    deduction: lengthDeduction,
    slope,
    panel: { qty, width: up8(l + 1), height: up8(perimeter + 1.5) },
    side: { qty: qty * 2, height: up8(h + 1), top: up8(t + 0.5 + 0.5 * sec - 0.5 * tan), bottom: up8(b + 0.5 + 0.5 * sec + 0.5 * tan) },
    zipper: { qty, length: l },
    cording: hasCording ? perimeter * 2 * qty : 0,
    foam: { qty, length, height: h, bottom: b, top: t },
  }
}

export type AnyCuts = CushionCuts | WedgeCuts

export { formatInches, parseInches } from './inches'
