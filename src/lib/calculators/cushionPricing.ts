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
const outdoorFoam = (w: number, d: number, h: number) => ((w * d * h) / 144) * 12 + 30

// Labor is the cover only; foam and every other fill is picked as the insert, so it is never charged twice.
export const PRICE_OPTIONS: PriceOption[] = [
  { id: 'cleanSeam', group: 'labor', formula: 'W × $6', price: (w) => w * 6 },
  { id: 'frenchCover', group: 'labor', formula: 'W × $18', price: (w) => w * 18 },

  { id: 'foam', group: 'insert', formula: '(W×D×H)/144 × $7 + $30', price: foam },
  { id: 'outdoorFoam', group: 'insert', formula: '(W×D×H)/144 × $12 + $30', price: outdoorFoam },
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
/** Yardage is ordered in whole yards: round up per item. */
export const wholeYards = (n: number) => Math.ceil(n - 1e-9)

/** Flat add-ons from the price sheet. */
export const ADD_ONS = {
  throwPillow: 125,
  welting: 10,
  outdoorTick: 10,
  com15: 1.15,
  /** Velcro, per foot of the total length: one row or two rows. */
  velcro1: 5,
  velcro2: 10,
}

export const money = (n: number) => (isFinite(n) ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—')

// ── Estimate Rocket line text ─────────────────────────────────────────
// Matches the workroom's Estimate Rocket template so it can be pasted as is.
// Always English: it goes on the client's estimate.

export const SEWING_STYLES = [
  'To Be Determined',
  'Boxed/Clean Seam',
  'Boxed/Self Welted',
  'Boxed/French Seam',
  'Boxed/Baseball Stitch',
  'Boxed/French Mattress',
  'Boxed/Contrast Welted',
  'Boxed/Flange',
  'Knife Edge/Clean Seam',
  'Knife Edge/Self Welted',
  'Knife Edge/French Seam',
  'Knife Edge/Baseball Stitch',
  'Knife Edge/French Mattress',
  'Knife Edge/Contrast Welted',
  'Knife Edge/Flange',
  'Knife Edge/Butterfly Corner',
  'Knife Edge/Butterfly Corner Self Welted',
  'Pocket Corner',
  'Pocket Corner/Self Welted',
  'Closed Corner/Self Welted',
] as const

/** Styles used to read "Boxed-Welted"; saved drafts get the current names (plain welted is self welted). */
export const slashStyle = (style: string) =>
  style.replace(/^(Boxed|Knife Edge|Pocket Corner|Closed Corner)-/, '$1/').replace(/^(Boxed|Knife Edge|Pocket Corner|Closed Corner)\/Welted$/, '$1/Self Welted')

/** Insert names as they read on the estimate. */
export const INSERT_NAMES: Record<string, string> = {
  tbd: 'To Be Determined',
  existing: 'Use Existing',
  foam: 'High Density/Resiliency Foam',
  outdoorFoam: 'Outdoor Foam',
  celesteSolid: 'Solid Celeste',
  celesteEnv: 'Celeste Envelope w/ Foam',
  wgSolid: '50/50 WG Down Solid',
  wgEnv: '50/50 WG Down Envelope w/ Foam',
  gooseSolid: '25/75 Goose Down Solid',
  gooseEnv: '25/75 Goose Down Envelope w/ Foam',
  bolster: 'Foam Bolster',
  plywood: 'Plywood',
}

/** Inserts that have foam in them, so a foam type can be picked. */
export const FOAM_INSERTS = ['foam', 'celesteEnv', 'wgEnv', 'gooseEnv', 'bolster']

/** Insert name for the estimate, with the foam type when one is picked. */
export const insertName = (insert: string, foamType = '') =>
  (INSERT_NAMES[insert] ?? insert) + (foamType && FOAM_INSERTS.includes(insert) ? ` (${foamType})` : '')

/** Style and fabric for one cushion of the line (the seat, or a matching back). */
export type EstimateRocketPart = {
  sewingStyle: string
  insert: string
  foamType: string
  yardsPerItem: number
  /** Yards for every cushion of the line together, from the roll layout; when set it is printed as is. */
  yardsTotal?: number
  fabric: string
  direction: 'tbd' | 'upTheRoll' | 'railroaded'
  /** What the fabric is centered on (pattern, motif, stripe…). */
  center: string
  /** Contrast welt fabric; empty = no contrast welt line. */
  weltFabric: string
}

export type EstimateRocketInput = EstimateRocketPart & {
  qty: number
  width: string
  depth: string
  height: string
  confirmed: boolean
  insertLabel: 'Seat Insert' | 'Back Insert'
  /** Custom sewn, or upholstered to plywood. */
  plan: 'sewn' | 'plywood'
  /** Several cushions on one line (same style, fill and fabric): one Dimensions entry each. */
  sizes?: { qty: number; width: string; depth: string; height: string; confirmed: boolean }[]
  /** Designer whose specifications these are; empty = "According To Design Specifications". */
  designer?: string
  /** Rows of Velcro on the base (0 = none). */
  velcroRows?: number
  /** A matching back cushion on the same line (seat + back set). */
  back?: EstimateRocketPart & { depth: string; height: string }
}

const DIRECTION_TEXT = { tbd: 'To Be Determined', upTheRoll: 'Up The Roll', railroaded: 'Railroaded' } as const

function directionLine(direction: EstimateRocketPart['direction'], center: string): string {
  const c = center.trim()
  if (direction === 'tbd' && !c) return 'To Be Determined'
  return c ? `${DIRECTION_TEXT[direction]} - Centered: ${c}` : DIRECTION_TEXT[direction]
}

/** Yards per item from a whole-line total: whole numbers as is, otherwise to one decimal. */
const perItem = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function fabricLines(label: string, qty: number, p: EstimateRocketPart): string[] {
  return [
    p.yardsTotal !== undefined
      ? `* **${label} Yardage:** ${p.yardsTotal} Yards of Fabric Required in TOTAL (${perItem(p.yardsTotal / qty)} Yards Per Item)`
      : `* **${label} Yardage:** ${wholeYards(p.yardsPerItem) * qty} Yards of Fabric Required in TOTAL (${wholeYards(p.yardsPerItem)} Yards Per Item)`,
    `* **${label} Fabric:** ${p.fabric.trim() || 'To Be Determined (Price Not Included)'}`,
    `* **${label} Fabric Direction/Center:** ${directionLine(p.direction, p.center)}`,
    ...(p.weltFabric.trim() ? [`* **${label === 'Body' ? '' : `${label} `}Contrast Welt:** ${p.weltFabric.trim()}`] : []),
  ]
}

export function estimateRocketText(e: EstimateRocketInput): string {
  const dims = (label: string, d: string, h: string) =>
    `* **${label}:** QTY ${e.qty} @ ${e.width}W x ${d}D x ${h}H - ${e.confirmed ? 'Confirmed' : 'Not Confirmed'}`
  return [
    '____',
    `<center>_According To ${e.designer?.trim() ? `${e.designer.trim()} ` : ''}Design Specifications_</center>`,
    '____',
    '#### Plan:',
    e.plan === 'plywood' ? '* **Custom Upholstered To Plywood**' : '* **Custom Sewn**',
    ...(e.back
      ? [dims('Seat Dimensions', e.depth, e.height), dims('Back Dimensions', e.back.depth, e.back.height)]
      : e.sizes?.length
        ? ['* **Dimensions:** ', ...e.sizes.map((z) => ` * QTY ${z.qty} @ ${z.width}W x ${z.depth}D x ${z.height}H - ${z.confirmed ? 'Confirmed' : 'Not Confirmed'}`)]
        : [dims('Dimensions', e.depth, e.height)]),
    '',
    '#### Style:',
    ...(e.back ? [`* **Seat Sewing Style:** ${e.sewingStyle}`, `* **Back Sewing Style:** ${e.back.sewingStyle}`] : [`* **Sewing Style:** ${e.sewingStyle}`]),
    '* **Zipper:** Standard',
    ...(e.velcroRows ? [`* **Modifications:** ${e.velcroRows === 2 ? 'Two Rows' : 'One Row'} 2" Adhesive Backed Black Velcro Attached to Base`] : []),
    '',
    '#### Fill:',
    `* **${e.back ? 'Seat Insert' : e.insertLabel}:** ${insertName(e.insert, e.foamType)}`,
    ...(e.back ? [`* **Back Insert:** ${insertName(e.back.insert, e.back.foamType)}`] : []),
    '',
    '#### Fabric:',
    ...fabricLines(e.back ? 'Seat' : 'Body', e.qty, e),
    ...(e.back ? fabricLines('Back', e.qty, e.back) : []),
  ].join('\n')
}
