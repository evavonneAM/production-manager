// Upholstery estimate — same math as the upholstery-estimator page, which
// follows "How to price upholstery labor": base labor, cushions, foam,
// yardage, supplies, then upcharges.

export type Kind = 'chair' | 'ottoman' | 'love' | 'sofa'

export type FurnitureType = { id: string; name: string; up: number; slip: number | null; yd: number; kind: Kind; note: string }

export const TYPES: FurnitureType[] = [
  { id: 'parsons', name: 'Parsons Chair', up: 180, slip: null, yd: 2, kind: 'chair', note: 'Usually a dining chair. Common upcharge: decorative band.' },
  { id: 'slipper', name: 'Slipper Chair', up: 535, slip: 435, yd: 4, kind: 'chair', note: 'No arms. Common upcharges: cushions, skirts, decorative band.' },
  { id: 'arm', name: 'Arm Chair', up: 700, slip: 600, yd: 10, kind: 'chair', note: 'Common upcharges: cushions, barrel chair upcharge, arm covers, skirts, decorative band.' },
  { id: 'wing', name: 'Wingback Chair', up: 800, slip: 700, yd: 10, kind: 'chair', note: 'Common upcharges: cushions, arm covers, skirts, decorative band.' },
  { id: 'frenchA', name: 'French Chair (armless)', up: 400, slip: null, yd: 1.5, kind: 'chair', note: 'Armless. Common upcharges: gimp or double welt cord.' },
  { id: 'frenchW', name: 'French Chair (with arms)', up: 450, slip: null, yd: 4, kind: 'chair', note: 'With arms. Common upcharges: gimp or double welt cord.' },
  { id: 'bergere', name: 'Bergere Chair', up: 535, slip: null, yd: 4, kind: 'chair', note: 'A barrel chair with decorative wood. Common upcharges: cushions, gimp or double welt cord.' },
  { id: 'ottoman', name: 'Ottoman', up: 200, slip: 125, yd: 2.5, kind: 'ottoman', note: 'Common upcharges: cushions, skirts, decorative band.' },
  { id: 'love', name: 'Love Seat', up: 900, slip: 750, yd: 12, kind: 'love', note: 'Base covers up to 60 in. Common upcharges: additional length, skirts, arm covers, cushions, decorative band.' },
  { id: 'sofa', name: 'Sofa', up: 1100, slip: 950, yd: 12, kind: 'sofa', note: 'Base covers up to 72 in. Yardage: 6 ft 12, 7 ft 14, 9 ft 16. Common upcharges: additional length, skirts, arm covers, cushions, decorative band.' },
]

/** Widest measurement covered by the base price; inches over it are charged. */
export const OVERSIZE_LIMIT: Partial<Record<Kind, number>> = { chair: 32, love: 60, sofa: 72 }

export type Upcharge = { id: string; name: string; price: number; unit: string; note: string }

export const UPCHARGES: Upcharge[] = [
  { id: 'armcov', name: 'Arm Covers', price: 54, unit: 'Pair', note: '' },
  { id: 'barrel', name: 'Barrel Chair upcharge', price: 144, unit: 'Item', note: '' },
  { id: 'buttons', name: 'Buttons', price: 6.6, unit: 'Each', note: '' },
  { id: 'channels', name: 'Channels', price: 30, unit: 'Each', note: '' },
  { id: 'ties', name: 'Coordinating Ties', price: 36, unit: 'Pair', note: '' },
  { id: 'band', name: 'Decorative Banding', price: 6, unit: 'Foot', note: '' },
  { id: 'welt', name: 'Double welt cord', price: 20.4, unit: 'Foot', note: '' },
  { id: 'gimp', name: 'Gimp', price: 20.4, unit: 'Yard', note: '' },
  { id: 'nail', name: 'Nailheads', price: 16.8, unit: 'Foot', note: '' },
  { id: 'skirtC', name: 'Skirts - Chair or ottoman', price: 120, unit: 'Item', note: '' },
  { id: 'skirtL', name: 'Skirts - Loveseat', price: 150, unit: 'Item', note: '' },
  { id: 'skirtS', name: 'Skirts - Sofa', price: 200, unit: 'Item', note: '' },
  {
    id: 'biscuit',
    name: 'Tufting - Biscuit',
    price: 12,
    unit: 'Patch',
    note: 'For an upholstered panel (biscuit tufted cushions have their own rate). Fabric is quilted and a button goes at each patch corner. Does not include button.',
  },
  { id: 'diamond', name: 'Tufting - Diamond', price: 24, unit: 'Each', note: 'Does not include button.' },
  { id: 'biotick', name: 'Celeste Bio Tick (outdoor insert)', price: 10, unit: 'Piece', note: 'Add per insert piece.' },
  { id: 'preshrink', name: 'Preshrinking - For Slipcovers', price: 10, unit: 'Yard', note: '' },
]

export type Rates = {
  clean: number
  cleanFoam: number
  french: number
  frenchFoam: number
  foamRate: number
  foamFee: number
  frenchFoamRate: number
  frenchFoamFee: number
  pillow: number
  welt: number
  supplies: number
  overUp: number
  overSlip: number
  pct: number
}

export const DEFAULT_RATES: Rates = {
  clean: 7,
  cleanFoam: 6,
  french: 18,
  frenchFoam: 13,
  foamRate: 7,
  foamFee: 30,
  frenchFoamRate: 6,
  frenchFoamFee: 25,
  pillow: 125,
  welt: 10,
  supplies: 15,
  overUp: 12,
  overSlip: 10,
  pct: 20,
}

export type CushionStyle = 'clean' | 'cleanFoam' | 'french' | 'frenchFoam' | 'pillow'
export type CushionInsert = '' | 'foam' | 'celeste' | 'celesteEnv' | 'wg' | 'wgEnv' | 'goose' | 'gooseEnv' | 'bolster' | 'ply'

export const STYLE_NAMES: Record<CushionStyle, string> = {
  clean: 'Clean seam, cover only',
  cleanFoam: 'Clean seam with foam',
  french: 'French mattress, cover only',
  frenchFoam: 'French mattress with foam',
  pillow: 'Throw pillow',
}

export const INSERT_NAMES: Record<CushionInsert, string> = {
  '': 'No insert',
  foam: 'Foam (insert only)',
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
  cushionYards: boolean
  mohair: boolean
  white: boolean
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
  const STY: Record<Exclude<CushionStyle, 'pillow'>, [string, number, 0 | 1 | 2]> = {
    clean: [STYLE_NAMES.clean, R.clean, 0],
    cleanFoam: [STYLE_NAMES.cleanFoam, R.cleanFoam, 1],
    french: [STYLE_NAMES.french, R.french, 0],
    frenchFoam: [STYLE_NAMES.frenchFoam, R.frenchFoam, 2],
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
      if (st[2]) {
        const rate = st[2] === 1 ? R.foamRate : R.frenchFoamRate
        const fee = st[2] === 1 ? R.foamFee : R.frenchFoamFee
        foam += n * (bd * rate + fee)
        foamBd += n * bd
        foamN += n
      }
    }
    const A = W * D
    const fp = (((H - 1) * A) / 144) * R.foamRate + R.foamFee
    const I: Partial<Record<CushionInsert, number>> = {
      foam: bd * R.foamRate + R.foamFee,
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
  const yards = wholeYards(pieceYards + (s.cushionYards ? cushYd : 0))
  let fabric = 0
  let supplies = 0
  if (yards > 0) {
    if (s.fabricPerYard > 0) fabric = add('Yardage', 'Yardage', 'Fabric, yards', yards, s.fabricPerYard, false)
    supplies = add('Supplies', 'Upholstery Supplies', 'Standard supplies, qty = yardage', yards, R.supplies, false)
  }

  for (const u of UPCHARGES) {
    const v = s.upcharges[u.id]
    if (v && v.qty > 0) add('Upcharges', 'Upholstery Labor', `${u.name} (${u.unit.toLowerCase()})`, v.qty, v.price, true)
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
