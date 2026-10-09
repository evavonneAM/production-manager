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
