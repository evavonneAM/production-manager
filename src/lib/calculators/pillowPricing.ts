// Pillow pricing (owner, 2026-10-27; docs/estimate-items-plan.md, "Pillows").
// Price each = $125 labor (any size) + insert + add-ons. Insert formulas are
// the owner's sheet "CUSHION PRICING + YARDAGE", tab PILLOW INSERT PRICING,
// used unchanged (round 50/50 stays dia × 13). All sizes in inches.
import {
  DEFAULT_END_ALLOWANCE,
  DEFAULT_GAP,
  DEFAULT_LISTED_WIDTH,
  DEFAULT_SELVAGE_TRIM,
  planFabric,
  type CutPiece,
  type FabricPlan,
} from './fabricNesting'

export const PILLOW_LABOR = 125
export const PILLOW_ADD_ONS = { welt: 10, contrastFlange: 30, outdoorTick: 10 }

export type PillowShape = 'square' | 'bolster' | 'round'
export type PillowStyle = 'knifeEdge' | 'welted' | 'flange' | 'butterfly'
/** Welt or flange in the pillow's own fabric, or a contrast fabric. */
export type TrimFabric = 'self' | 'contrast'
export type PillowInsert = 'none' | 'celeste' | 'wg' | 'goose'

export const INSERT_NAMES: Record<PillowInsert, string> = {
  none: 'Use Existing / None',
  celeste: 'Celeste',
  wg: '50/50 WG Down',
  goose: '25/75 Goose Down',
}
export const STYLE_NAMES: Record<PillowStyle, string> = {
  knifeEdge: 'Knife Edge',
  welted: 'Knife Edge/Welted',
  flange: 'Flange',
  butterfly: 'Butterfly Corner',
}

/** Sizes from the owner's sheet, to pick from (any size can be typed). */
export const STANDARD_SIZES: { label: string; shape: PillowShape; w: number; d: number }[] = [
  { label: 'Small 16 × 16', shape: 'square', w: 16, d: 16 },
  { label: 'Medium 18 × 18', shape: 'square', w: 18, d: 18 },
  { label: 'Large 20 × 20', shape: 'square', w: 20, d: 20 },
  { label: 'Large 22 × 22', shape: 'square', w: 22, d: 22 },
  { label: 'Oversized 24 × 24', shape: 'square', w: 24, d: 24 },
  { label: 'Oversized 26 × 26', shape: 'square', w: 26, d: 26 },
  { label: 'Lumbar 12 × 18', shape: 'square', w: 18, d: 12 },
  { label: 'Lumbar 12 × 24', shape: 'square', w: 24, d: 12 },
  { label: 'Lumbar 14 × 36', shape: 'square', w: 36, d: 14 },
  { label: 'Bolster 18 × 6', shape: 'bolster', w: 18, d: 6 },
  { label: 'Bolster 24 × 8', shape: 'bolster', w: 24, d: 8 },
]

/** Largest insert diameter by shape and insert (from the sheet). */
export function insertMax(shape: PillowShape, insert: PillowInsert): number | null {
  if (shape === 'bolster') return insert === 'celeste' ? 10 : insert === 'none' ? null : 8
  if (shape === 'round') return insert === 'none' ? null : 20
  return null
}

/**
 * Insert price each. Square / rectangle (lumbar): W × D. Bolster: by length L
 * (`w`), diameter `d`. Round: by diameter (`w`).
 */
export function insertPrice(shape: PillowShape, insert: PillowInsert, w: number, d: number): number {
  if (insert === 'none') return 0
  if (shape === 'bolster') return insert === 'celeste' ? w * 4.5 : insert === 'wg' ? w / 0.072 : w / 0.2
  if (shape === 'round') return insert === 'celeste' ? w * 2.2 : insert === 'wg' ? w * 13 : w * 2.9
  const a = w * d
  return insert === 'celeste' ? a / 7.4 : insert === 'wg' ? a / 2.25 : a / 5
}

export type Pillow = {
  shape: PillowShape
  /** Width (square), length (bolster) or diameter (round). */
  w: number
  /** Height (square) or diameter (bolster); unused for round. */
  d: number
  style: PillowStyle
  /** Welted: the welt. Flange: the flange. Butterfly: the welt ('none' = no welt). */
  trim: TrimFabric | 'none'
  /** Flange only, typed (no standard size yet, owner 2026-10-27). */
  flange: number
  insert: PillowInsert
  outdoorTick: boolean
}

export const hasWelt = (p: Pillow) => p.style === 'welted' || (p.style === 'butterfly' && p.trim !== 'none')

export function pillowPrice(p: Pillow) {
  const insert = insertPrice(p.shape, p.insert, p.w, p.d)
  const addOns =
    (hasWelt(p) ? PILLOW_ADD_ONS.welt : 0) +
    (p.style === 'flange' && p.trim === 'contrast' ? PILLOW_ADD_ONS.contrastFlange : 0) +
    (p.outdoorTick ? PILLOW_ADD_ONS.outdoorTick : 0)
  return { labor: PILLOW_LABOR, insert, addOns, each: PILLOW_LABOR + insert + addOns }
}

// ── Cut pieces, laid on the roll like cushions ─────────────────────────
// Every piece gets ½" seam allowance on each side (1" each way). A self flange
// is cut in one with the face (+ flange on every side); a contrast flange is
// four border strips per face in the contrast fabric. Welt is bias cording:
// the perimeter plus 6" for the join, per welted edge.
const SEAM = 1
const WELT_JOIN = 6

export function pillowPieces(p: Pillow, qty: number, label: string): { body: CutPiece[]; contrast: CutPiece[]; cordingInches: number } {
  const body: CutPiece[] = []
  const contrast: CutPiece[] = []
  const add = (to: CutPiece[], n: number, across: number, along: number) => {
    for (let i = 0; i < n * qty; i++) to.push({ name: 'plate', cushion: label, across, along })
  }
  let perimeter: number
  if (p.shape === 'bolster') {
    const circ = Math.PI * p.d
    add(body, 1, circ + SEAM, p.w + SEAM) // tube
    add(body, 2, p.d + SEAM, p.d + SEAM) // ends
    perimeter = 2 * circ
  } else if (p.shape === 'round') {
    add(body, 2, p.w + SEAM, p.w + SEAM)
    perimeter = Math.PI * p.w
  } else {
    const selfFlange = p.style === 'flange' && p.trim !== 'contrast' ? 2 * p.flange : 0
    add(body, 2, p.w + selfFlange + SEAM, p.d + selfFlange + SEAM)
    if (p.style === 'flange' && p.trim === 'contrast') {
      const f = p.flange + SEAM
      add(contrast, 4, p.w + 2 * p.flange + SEAM, f) // top + bottom, both faces
      add(contrast, 4, p.d + 2 * p.flange + SEAM, f) // sides, both faces
    }
    perimeter = 2 * (p.w + p.d)
  }
  const cordingInches = hasWelt(p) ? (perimeter + WELT_JOIN) * qty : 0
  return { body, contrast, cordingInches }
}

/** Yards to order for one set of pieces on a roll (whole yards, one spare plate). */
export function pillowYards(pieces: CutPiece[], cordingInches: number, listedWidth = DEFAULT_LISTED_WIDTH): FabricPlan | null {
  if (!pieces.length && !cordingInches) return null
  return planFabric(pieces, {
    listedWidth,
    selvageTrim: DEFAULT_SELVAGE_TRIM,
    direction: 'auto',
    gap: DEFAULT_GAP,
    endAllowance: DEFAULT_END_ALLOWANCE,
    cordingInches,
    together: true,
    extra: 'plate',
    oneWay: false,
    pattern: null,
  })
}

/** Size as it reads on the estimate: 22" x 22", Bolster 24" x 8" dia, Round 16" dia. */
export function sizeText(p: Pick<Pillow, 'shape' | 'w' | 'd'>) {
  const n = (x: number) => `${Math.round(x * 100) / 100}"`
  if (p.shape === 'bolster') return `${n(p.w)} L x ${n(p.d)} Dia`
  if (p.shape === 'round') return `${n(p.w)} Dia`
  return `${n(p.w)} x ${n(p.d)}`
}

export function styleText(p: Pillow) {
  const trim = p.trim === 'contrast' ? 'Contrast' : 'Self'
  if (p.style === 'welted') return `Knife Edge/${trim} Welted`
  if (p.style === 'flange') return `${trim} Flange ${Math.round(p.flange * 100) / 100}"`
  if (p.style === 'butterfly') return p.trim === 'none' ? 'Butterfly Corner' : `Butterfly Corner/${trim} Welted`
  return 'Knife Edge'
}

export const money = (n: number) =>
  isFinite(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
