// Cushion pricing — same formulas as the original cushion-pricing calculator
// (CUSTOM CUSHION LABOR PRICE + YA and CUSHION INSERT PRICING sheets).
// W = section length, D = depth, H = thickness, all inches. Prices are per piece.

export type PriceGroup = 'labor' | 'insert'

export type PriceOption = {
  id: string
  group: PriceGroup
  /** Short formula shown under the name. */
  formula: string
  /** Largest thickness (box) this option is made in, if limited. */
  maxBox?: number
  /** Largest bolster diameter, if limited. */
  maxDiameter?: number
  price: (w: number, d: number, h: number) => number
}

const foam = (w: number, d: number, h: number) => ((w * d * h) / 144) * 7 + 30

export const PRICE_OPTIONS: PriceOption[] = [
  { id: 'cleanSeam', group: 'labor', formula: 'W × $7', price: (w) => w * 7 },
  { id: 'customFoam', group: 'labor', formula: 'W × $6 + foam', price: (w, d, h) => w * 6 + foam(w, d, h) },
  { id: 'frenchCover', group: 'labor', formula: 'W × $18', price: (w) => w * 18 },
  { id: 'frenchFoam', group: 'labor', formula: 'W × $13 + (W×D×H)/144 × $6 + $25', price: (w, d, h) => w * 13 + ((w * d * h) / 144) * 6 + 25 },

  { id: 'foam', group: 'insert', formula: '(W×D×H)/144 × $7 + $30', price: foam },
  { id: 'celesteSolid', group: 'insert', formula: '(W×D) ÷ 4', maxBox: 6, price: (w, d) => (w * d) / 4 },
  { id: 'celesteEnv', group: 'insert', formula: '(W×D) ÷ 7.8 + foam at H − 1"', maxBox: 6, price: (w, d, h) => (w * d) / 7.8 + foam(w, d, h - 1) },
  { id: 'wgSolid', group: 'insert', formula: '(W×D) ÷ 0.87', maxBox: 6, price: (w, d) => (w * d) / 0.87 },
  { id: 'wgEnv', group: 'insert', formula: '(W×D) ÷ 2.24 + foam at H − 1"', maxBox: 6, price: (w, d, h) => (w * d) / 2.24 + foam(w, d, h - 1) },
  { id: 'gooseSolid', group: 'insert', formula: '(W×D) ÷ 3.2', maxBox: 6, price: (w, d) => (w * d) / 3.2 },
  { id: 'gooseEnv', group: 'insert', formula: '(W×D) ÷ 4.5 + foam at H − 1"', maxBox: 6, price: (w, d, h) => (w * d) / 4.5 + foam(w, d, h - 1) },
  { id: 'bolster', group: 'insert', formula: 'W ÷ 0.27', maxDiameter: 8, price: (w) => w / 0.27 },
  { id: 'plywood', group: 'insert', formula: '(W×D) ÷ 46', price: (w, d) => (w * d) / 46 },
]

/** Yards of fabric per piece, from the section length only. */
export const yardageReversible = (w: number) => (w * 2 + 20) / 36
export const yardageNonReversible = (w: number) => (w + 10) / 36

/** Flat add-ons from the price sheet. */
export const ADD_ONS = {
  throwPillow: 125,
  welting: 10,
  outdoorTick: 10,
  com15: 1.15,
  com25Line: 0.15,
}

export const money = (n: number) =>
  isFinite(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

// ── Estimate Rocket line text ─────────────────────────────────────────
// Matches the workroom's Estimate Rocket template so it can be pasted as is.
// Always English: it goes on the client's estimate.

export const SEWING_STYLES = [
  'To Be Determined',
  'Boxed-Clean Seam',
  'Boxed-Welted',
  'Boxed-French Seam',
  'Boxed-Baseball Stitch',
  'Boxed-French Mattress',
  'Boxed-Flange',
  'Knife Edge-Clean Seam',
  'Knife Edge-Welted',
  'Knife Edge-French Seam',
  'Knife Edge-Baseball Stitch',
  'Knife Edge-French Mattress',
  'Knife Edge-Flange',
  'Knife Edge-Butterfly Corner',
  'Pocket Corner',
  'Pocket Corner-Welted',
  'Closed Corner-Welted',
] as const

/** Insert names as they read on the estimate. */
export const INSERT_NAMES: Record<string, string> = {
  tbd: 'To Be Determined',
  existing: 'Use Existing',
  foam: 'Foam',
  celesteSolid: 'Solid Celeste',
  celesteEnv: 'Celeste Envelope w/ Foam',
  wgSolid: '50/50 WG Down Solid',
  wgEnv: '50/50 WG Down Envelope w/ Foam',
  gooseSolid: '25/75 Goose Down Solid',
  gooseEnv: '25/75 Goose Down Envelope w/ Foam',
  bolster: 'Foam Bolster',
  plywood: 'Plywood',
}

export type EstimateRocketInput = {
  qty: number
  width: string
  depth: string
  height: string
  confirmed: boolean
  sewingStyle: string
  insertLabel: 'Seat Insert' | 'Back Insert'
  insert: string
  yardsPerItem: number
  fabric: string
  direction: string
}

/** Yards shown on the estimate, rounded up to the next hundredth. */
const yd = (n: number) => (Math.ceil(n * 100 - 1e-9) / 100).toFixed(2)

export function estimateRocketText(e: EstimateRocketInput): string {
  return [
    '____',
    '<center>_According To Design Specifications_</center>',
    '____',
    '#### Plan:',
    '* **Custom Sewn**',
    `* **Dimensions:** QTY ${e.qty} @ ${e.width}W x ${e.depth}D x ${e.height}H - ${e.confirmed ? 'Confirmed' : 'Not Confirmed'}`,
    '',
    '#### Style:',
    `* **Sewing Style:** ${e.sewingStyle}`,
    '* **Zipper:** Standard',
    '',
    '#### Fill:',
    `* **${e.insertLabel}:** ${INSERT_NAMES[e.insert] ?? e.insert}`,
    '',
    '#### Fabric:',
    `* **Body Yardage:** ${yd(e.yardsPerItem * e.qty)} Yards of Fabric Required in TOTAL (${yd(e.yardsPerItem)} Yards Per Item)`,
    `* **Body Fabric:** ${e.fabric.trim() || 'To Be Determined (Price Not Included)'}`,
    `* **Body Fabric Direction/Center:** ${e.direction.trim() || 'To Be Determined'}`,
  ].join('\n')
}
