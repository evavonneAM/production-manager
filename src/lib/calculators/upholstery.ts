// Upholstery estimate — same math as the upholstery-estimator page, which
// follows "How to price upholstery labor": base labor, cushions, foam,
// yardage, supplies, then upcharges.

export type Kind = 'chair' | 'ottoman' | 'love' | 'sofa'

export type FurnitureType = { id: string; name: string; up: number; slip: number | null; yd: number; kind: Kind; note: string }

export const TYPES: FurnitureType[] = [
  { id: 'parsons', name: 'Parsons Chair', up: 225, slip: null, yd: 2, kind: 'chair', note: 'Usually a dining chair. Common upcharge: decorative band.' },
  { id: 'slipper', name: 'Slipper Chair', up: 670, slip: 545, yd: 4, kind: 'chair', note: 'No arms. Common upcharges: cushions, skirts, decorative band.' },
  { id: 'arm', name: 'Arm Chair', up: 850, slip: 730, yd: 6, kind: 'chair', note: 'Common upcharges: cushions, barrel chair upcharge, arm covers, skirts, decorative band.' },
  { id: 'wing', name: 'Wingback Chair', up: 1250, slip: 1095, yd: 8, kind: 'chair', note: 'Common upcharges: cushions, arm covers, skirts, decorative band.' },
  { id: 'frenchA', name: 'French Chair (armless)', up: 500, slip: null, yd: 2, kind: 'chair', note: 'Armless. Common upcharges: gimp or double welt cord.' },
  { id: 'frenchW', name: 'French Chair (with arms)', up: 565, slip: null, yd: 3, kind: 'chair', note: 'With arms. Common upcharges: gimp or double welt cord.' },
  { id: 'bergere', name: 'Bergere Chair', up: 670, slip: null, yd: 5, kind: 'chair', note: 'A barrel chair with decorative wood. Common upcharges: cushions, gimp or double welt cord.' },
  { id: 'ottoman', name: 'Ottoman', up: 425, slip: 272, yd: 3, kind: 'ottoman', note: 'Common upcharges: cushions, skirts, decorative band.' },
  { id: 'love', name: 'Love Seat', up: 1750, slip: 1465, yd: 12, kind: 'love', note: 'Base covers up to 60 in. Common upcharges: additional length, skirts, arm covers, cushions, decorative band.' },
  { id: 'sofa', name: 'Sofa', up: 2250, slip: 1945, yd: 12, kind: 'sofa', note: 'Base covers up to 72 in. Yardage: 6 ft 12, 7 ft 14, 9 ft 16. Common upcharges: additional length, skirts, arm covers, cushions, decorative band.' },
]

/** Widest measurement covered by the base price; inches over it are charged. */
export const OVERSIZE_LIMIT: Partial<Record<Kind, number>> = { chair: 32, love: 60, sofa: 72 }

/**
 * Trim length (gimp, double welt cord, nailheads) from the piece's size:
 * width × w + depth × d + height × h + extra inches. From the workroom's trim sheet.
 */
export const TRIM_RULES: Record<string, { w: number; d: number; h: number; extra: number }> = {
  parsons: { w: 2, d: 2, h: 0, extra: 0 },
  slipper: { w: 2, d: 2, h: 0, extra: 0 },
  arm: { w: 3, d: 4, h: 2, extra: 0 },
  wing: { w: 2, d: 2, h: 0, extra: 36 },
  frenchA: { w: 2, d: 2, h: 0, extra: 60 },
  frenchW: { w: 2, d: 2, h: 0, extra: 96 },
  bergere: { w: 3, d: 4, h: 2, extra: 36 },
  ottoman: { w: 2, d: 2, h: 0, extra: 0 },
  love: { w: 2, d: 2, h: 0, extra: 36 },
  sofa: { w: 2, d: 2, h: 0, extra: 36 },
}

/** Decorative banding inches: ottoman all the way around, slipper chair front and sides, others across the front. */
export function bandingInches(typeId: string, kind: Kind, w: number, d: number): number | null {
  if (!(w > 0)) return null
  if (kind === 'ottoman') return d > 0 ? 2 * w + 2 * d : null
  if (typeId === 'slipper') return d > 0 ? w + 2 * d : null
  return w
}

/** Upcharges priced by length, filled from TRIM_RULES. */
export const TRIM_UPCHARGES = ['gimp', 'welt', 'nail']

/** The skirt upcharge that fits a piece. */
export const skirtFor = (kind: Kind) => (kind === 'sofa' ? 'skirtS' : kind === 'love' ? 'skirtL' : 'skirtC')

/** Trim inches for a piece, or null while a needed measurement is missing. */
export function trimInches(typeId: string, w: number, d: number, h: number): number | null {
  const r = TRIM_RULES[typeId]
  if (!r || !(w > 0) || !(d > 0) || (r.h > 0 && !(h > 0))) return null
  return r.w * w + r.d * d + r.h * h + r.extra
}

/** Trim inches as a quantity in the upcharge's unit, rounded up to a whole foot or yard. */
export const trimQty = (inches: number, unit: string) => Math.ceil(inches / (unit === 'Yard' ? 36 : 12) - 1e-9)

export type Upcharge = { id: string; name: string; price: number; unit: string; note: string }

export const UPCHARGES: Upcharge[] = [
  { id: 'armcov', name: 'Arm Covers', price: 67.5, unit: 'Pair', note: '' },
  { id: 'barrel', name: 'Barrel Chair upcharge', price: 180, unit: 'Item', note: '' },
  { id: 'buttons', name: 'Buttons', price: 8.25, unit: 'Each', note: '' },
  { id: 'ties', name: 'Coordinating Ties', price: 45, unit: 'Pair', note: '' },
  { id: 'band', name: 'Decorative Banding', price: 7.5, unit: 'Foot', note: '' },
  { id: 'welt', name: 'Double welt cord', price: 25.5, unit: 'Foot', note: '' },
  { id: 'gimp', name: 'Gimp', price: 25.5, unit: 'Yard', note: '' },
  { id: 'nail', name: 'Nailheads', price: 31.25, unit: 'Foot', note: '' },
  { id: 'skirtC', name: 'Skirts - Chair or ottoman', price: 225, unit: 'Item', note: '' },
  { id: 'skirtL', name: 'Skirts - Loveseat', price: 345, unit: 'Item', note: '' },
  { id: 'skirtS', name: 'Skirts - Sofa', price: 465, unit: 'Item', note: '' },
  { id: 'biotick', name: 'Celeste Bio Tick (outdoor insert)', price: 10, unit: 'Piece', note: 'Add per insert piece.' },
  { id: 'preshrink', name: 'Preshrinking - For Slipcovers', price: 12.5, unit: 'Yard', note: '' },
]

export type Rates = {
  clean: number
  french: number
  foamRate: number
  foamFee: number
  outdoorFoamRate: number
  pillow: number
  welt: number
  supplies: number
  overUp: number
  overSlip: number
  pct: number
  channelsPct: number
  tuftingPct: number
}

export const DEFAULT_RATES: Rates = {
  clean: 6,
  french: 18,
  foamRate: 7,
  foamFee: 30,
  outdoorFoamRate: 12,
  pillow: 125,
  welt: 10,
  supplies: 15,
  overUp: 15,
  overSlip: 12.5,
  pct: 20,
  channelsPct: 15,
  tuftingPct: 30,
}

/** Cushion labor is the cover only; foam and other fills are chosen as the insert. */
export type CushionStyle = 'clean' | 'french' | 'pillow'
export type CushionInsert = '' | 'foam' | 'outdoorFoam' | 'celeste' | 'celesteEnv' | 'wg' | 'wgEnv' | 'goose' | 'gooseEnv' | 'bolster' | 'ply'

export const STYLE_NAMES: Record<CushionStyle, string> = {
  clean: 'Clean seam, cover only',
  french: 'French mattress, cover only',
  pillow: 'Throw pillow',
}

export const INSERT_NAMES: Record<CushionInsert, string> = {
  '': 'No insert',
  foam: 'High Density/Resiliency Foam (insert only)',
  outdoorFoam: 'Outdoor Foam',
  celeste: 'Solid Celeste',
  celesteEnv: 'Celeste envelope w/ foam',
  wg: '50/50 WG down, solid',
  wgEnv: '50/50 WG down envelope w/ foam',
  goose: '25/75 goose down, solid',
  gooseEnv: '25/75 goose down envelope w/ foam',
  bolster: 'Foam bolster',
  ply: 'Plywood',
}

export type Cushion = {
  name: string
  qty: number
  w: number
  d: number
  h: number
  style: CushionStyle
  insert: CushionInsert
  reversible: boolean
  welt: boolean
  attached: boolean
}

export type EstimateInput = {
  typeId: string
  service: 'up' | 'slip'
  width: number
  cushions: Cushion[]
  /** Yards for the piece; null uses the chart (sofas by length). */
  yards: number | null
  fabricPerYard: number
  com: boolean
  mohair: boolean
  white: boolean
  channels: boolean
  tufting: boolean
  /** Preshrink every yard of fabric (slipcovers). */
  preshrink: boolean
  upcharges: Record<string, { qty: number; price: number }>
}

export type Line = { section: string; item: string; desc: string; qty: number; rate: number; amount: number }

export type Estimate = {
  lines: Line[]
  labor: number
  foam: number
  fabric: number
  supplies: number
  total: number
  /** Yards charged (piece + cushions), rounded up once to whole yards. */
  yards: number
  pieceYards: number
  cushionYards: number
  type: FurnitureType
  limit: number | undefined
  service: 'up' | 'slip'
}

const q = (n: number) => String(Math.round(n * 100) / 100)
const sofaYards = (w: number) => (w > 84 ? 16 : w > 72 ? 14 : 12)
/** Yardage is ordered in whole yards: round up. */
const wholeYards = (n: number) => Math.ceil(n - 1e-9)

export function estimate(s: EstimateInput, R: Rates): Estimate {
  const t = TYPES.find((x) => x.id === s.typeId) ?? TYPES[2]
  const svc = s.service === 'slip' && t.slip !== null ? 'slip' : 'up'
  const lines: Line[] = []
  let labor = 0
  let foamBd = 0
  let foamN = 0
  const add = (section: string, item: string, desc: string, qty: number, rate: number, isLabor: boolean) => {
    const amount = qty * rate
    lines.push({ section, item, desc, qty, rate, amount })
    if (isLabor) labor += amount
    return amount
  }

  add('Base labor', 'Upholstery Labor', `${t.name} – ${svc === 'slip' ? 'Slipcover' : 'Upholstery'}`, 1, svc === 'slip' ? t.slip! : t.up, true)
  const w = s.width
  const limit = OVERSIZE_LIMIT[t.kind]
  if (limit && w > limit) {
    add(
      'Base labor',
      'Upholstery Labor',
      `Oversize ${svc === 'slip' ? 'slipcover' : 'upholstery'} (${q(w)} in, over ${limit} in)`,
      w - limit,
      svc === 'slip' ? R.overSlip : R.overUp,
      true,
    )
  }

  // Cushions — formulas from the Cushion Pricing Calculator.
  const STY: Record<Exclude<CushionStyle, 'pillow'>, [string, number]> = {
    clean: [STYLE_NAMES.clean, R.clean],
    french: [STYLE_NAMES.french, R.french],
  }
  let foam = 0
  let cushYd = 0
  for (const c of s.cushions) {
    const n = Math.max(1, c.qty || 1)
    const { w: W, d: D, h: H } = c
    if (!(W > 0)) continue
    const bd = (W * D * H) / 144
    const nm = `${c.name || 'Cushion'} – ${q(W)}W${c.style === 'pillow' ? '' : ` x ${q(D)}D x ${q(H)}H`}`
    if (c.style === 'pillow') {
      add('Cushions', 'Cushion Labor', `${nm} – throw pillow, standard labor`, n, R.pillow, true)
    } else {
      const st = STY[c.style] ?? STY.clean
      add('Cushions', 'Cushion Labor', `${nm} – ${st[0]} (qty = inches of W)`, n * W, st[1], true)
    }
    const A = W * D
    const fp = (((H - 1) * A) / 144) * R.foamRate + R.foamFee
    const I: Partial<Record<CushionInsert, number>> = {
      foam: bd * R.foamRate + R.foamFee,
      outdoorFoam: bd * R.outdoorFoamRate + R.foamFee,
      celeste: A / 4,
      celesteEnv: A / 7.8 + fp,
      wg: A / 0.87,
      wgEnv: A / 2.24 + fp,
      goose: A / 3.2,
      gooseEnv: A / 4.5 + fp,
      bolster: W / 0.27,
      ply: A / 46,
    }
    const price = I[c.insert]
    if (price !== undefined) {
      if (c.insert === 'foam') {
        foam += n * price
        foamBd += n * bd
        foamN += n
      } else {
        add('Cushions', 'Cushion Labor', `${nm} – ${INSERT_NAMES[c.insert]} (each)`, n, price, false)
      }
    }
    if (c.welt) add('Cushions', 'Cushion Labor', `${nm} – welting (per piece)`, n, R.welt, true)
    if (c.attached) add('Cushions', 'Cushion Labor', `${nm} – attached cushion (in addition to cushion labor)`, n, 25, true)
    cushYd += n * (c.reversible ? (W * 2 + 20) / 36 : (W + 10) / 36)
  }
  if (foam > 0) {
    add(
      'Foam',
      'Foam',
      `Replacement foam, ${q(foamBd)} board ft across ${q(foamN)} cushion${foamN === 1 ? '' : 's'} – total amount`,
      1,
      Math.round(foam * 100) / 100,
      false,
    )
  }

  const pieceYards = s.yards ?? (t.kind === 'sofa' ? sofaYards(w) : t.yd)
  // The chart's yardage is for the frame only; cushion fabric is always added.
  const yards = wholeYards(pieceYards + cushYd)
  let fabric = 0
  let supplies = 0
  if (yards > 0) {
    if (s.fabricPerYard > 0) fabric = add('Yardage', 'Yardage', 'Fabric, yards', yards, s.fabricPerYard, false)
    supplies = add('Supplies', 'Upholstery Supplies', 'Standard supplies, qty = yardage', yards, R.supplies, false)
  }

  if (s.preshrink && yards > 0) {
    const p = s.upcharges.preshrink?.price ?? UPCHARGES.find((u) => u.id === 'preshrink')!.price
    add('Upcharges', 'Upholstery Labor', 'Preshrinking (yard)', yards, p, true)
  }
  for (const u of UPCHARGES) {
    const v = s.upcharges[u.id]
    if (u.id !== 'preshrink' && v && v.qty > 0) add('Upcharges', 'Upholstery Labor', `${u.name} (${u.unit.toLowerCase()})`, v.qty, v.price, true)
  }

  // Channels and tufting are a percentage of the base labor (piece + oversize).
  const baseLabor = lines.filter((l) => l.section === 'Base labor').reduce((n, l) => n + l.amount, 0)
  for (const [on, name, pct] of [
    [s.channels, 'Channels', R.channelsPct],
    [s.tufting, 'Tufting', R.tuftingPct],
  ] as const) {
    if (on) {
      const a = (baseLabor * pct) / 100
      lines.push({ section: 'Upcharges', item: 'Upholstery Labor', desc: `${name} – ${q(pct)}% of base labor`, qty: 1, rate: a, amount: a })
      labor += a
    }
  }

  const base = labor
  for (const [on, name] of [
    [s.mohair, 'Mohair'],
    [s.white, 'White fabric'],
  ] as const) {
    if (on) {
      const a = (base * R.pct) / 100
      lines.push({ section: 'Upcharges', item: 'Upholstery Labor', desc: `${name} – ${q(R.pct)}% of total labor`, qty: 1, rate: a, amount: a })
      labor += a
    }
  }
  if (s.com) {
    const a = base * 0.15
    lines.push({ section: 'Upcharges', item: 'Upholstery Labor', desc: 'COM – labor × 0.15', qty: 1, rate: a, amount: a })
  }

  const total = lines.reduce((n, l) => n + l.amount, 0)
  return { lines, labor, foam, fabric, supplies, total, yards, pieceYards, cushionYards: cushYd, type: t, limit, service: svc }
}

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Estimate Rocket text ──────────────────────────────────────────────
// The workroom's Estimate Rocket upholstery template, filled in. Always
// English: it goes on the client's estimate. Prices go on the line items.

export const MATCH_ORIGINAL = 'Match Original'
export const USE_EXISTING = 'Use Existing (Additional Charge If New Needed)'

export type EstimateRocketDetails = {
  according: 'design' | 'designer'
  service: 'up' | 'slip'
  width: string
  depth: string
  height: string
  confirmed: boolean
  seatStyle: string
  backStyle: string
  armStyle: string
  seatInsert: string
  backInsert: string
  yards: number
  quotedSolid: boolean
  quotedRailroaded: boolean
  com: boolean
  fabric: string
  direction: 'tbd' | 'upTheRoll' | 'railroaded'
  center: string
}

const DIRECTION_TEXT = { tbd: 'To Be Determined', upTheRoll: 'Up the Roll', railroaded: 'Railroaded' } as const

export function estimateRocketText(d: EstimateRocketDetails): string {
  const dim = (v: string) => (v.trim() ? `${v.trim()}"` : '_"')
  const quoted = [d.quotedSolid && 'SOLID', d.quotedRailroaded && 'RAILROADED'].filter(Boolean).join('/')
  const c = d.center.trim()
  const dir = d.direction === 'tbd' && !c ? 'To Be Determined' : c ? `${DIRECTION_TEXT[d.direction]} - Centered: ${c}` : DIRECTION_TEXT[d.direction]
  const arm = d.armStyle === MATCH_ORIGINAL ? MATCH_ORIGINAL : `${d.armStyle} (Additional Charge if Changing Style)`
  return [
    '____',
    `<center>_According To ${d.according === 'designer' ? 'Designer' : 'Design Specifications'}_</center>`,
    '____',
    '### Plan:',
    `* Custom ${d.service === 'slip' ? 'Slipcover' : 'Reupholstery'}`,
    `* **Dimensions:** ${dim(d.width)}W x ${dim(d.depth)}D x ${dim(d.height)}H - ${d.confirmed ? 'Confirmed' : 'Not Confirmed'}`,
    '',
    '### Style:',
    `* **Seat Style:** ${d.seatStyle}`,
    `* **Back Style:** ${d.backStyle}`,
    `* **Arm Style:** ${arm}`,
    '',
    '### Fill:',
    `* **Seat Insert:** ${d.seatInsert}`,
    `* **Back Insert:** ${d.backInsert}`,
    '',
    '### Fabric:',
    `* **Body Yardage:** ${d.yards} Yards of Fabric Required in TOTAL (${d.yards} Yards Per)${quoted ? ` QUOTED ${quoted}` : ''}`,
    `* **Body Fabric:** ${d.com ? "Customer's Own Material (COM)" : d.fabric.trim() || 'To Be Determined (Price Not Included)'}`,
    `* **Fabric Direction/Center:** ${dir}`,
  ].join('\n')
}
