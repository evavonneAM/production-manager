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

/** Decimal inches → nearest ⅛" as text, e.g. 20.5 → 20 1/2". */
export function formatInches(dec: number): string {
  if (!isFinite(dec)) return '—'
  const neg = dec < 0 ? '-' : ''
  dec = Math.abs(dec)
  let w = Math.floor(dec)
  let e = Math.round((dec - w) * 8)
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
