import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, CopyOutlined, DeleteOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons'
import { formatInches, parseInches } from '../../lib/calculators/inches'
import { FOAM_TYPES } from '../../lib/foamTypes'
import { SHEET_L, SHEET_PRICE, SHEET_W, fitsSheet, planPlywood, type Board, type Sheet } from '../../lib/calculators/plywoodNesting'
import { ADD_ONS, FOAM_INSERTS, PRICE_OPTIONS, SEWING_STYLES, estimateRocketText, money, slashStyle, type PriceOption } from '../../lib/calculators/cushionPricing'
import { DEFAULT_HEIGHT_DEDUCTION, cushionCuts } from '../../lib/calculators/cushionCut'
import {
  DEFAULT_END_ALLOWANCE,
  DEFAULT_EXTRA,
  DEFAULT_GAP,
  DEFAULT_LISTED_WIDTH,
  DEFAULT_SELVAGE_TRIM,
  piecesFor,
  planFabric,
  type CutPiece,
  type DirectionChoice,
  type FabricOptions,
  type FabricPlan,
} from '../../lib/calculators/fabricNesting'
import { RollDiagram } from '../../components/FabricRollDiagram'

type Row = {
  id: number
  name: string
  qty: number
  /** Side to side — the zipper side. */
  length: string
  /** Depth (seat) or height (back). */
  depth: string
  thickness: string
  /** Seat or back cushion — only changes the Estimate Rocket wording. */
  part: 'seat' | 'back'
  labor: string
  insert: string
  /** Foam type for inserts with foam; empty = not picked yet. */
  foamType: string
  /** Custom sewn, or upholstered to plywood (adds plywood). */
  plan: 'sewn' | 'plywood'
  /** Seat with a matching back cushion on the same line (same length). */
  withBack: boolean
  backDepth: string
  backThickness: string
  backLabor: string
  backStyle: string
  backInsert: string
  backFoamType: string
  backFabric: string
  backDirection: 'tbd' | 'upTheRoll' | 'railroaded'
  backCenter: string
  /** Pattern repeat of the back fabric, inches; empty = plain. */
  backRepeat: string
  backHalfDrop: boolean
  backWeltFabric: string
  // Estimate Rocket text
  erConfirmed: boolean
  erStyle: string
  erFabric: string
  erDirection: 'tbd' | 'upTheRoll' | 'railroaded'
  erCenter: string
  /** Pattern repeat of the fabric, inches; empty = plain. */
  erRepeat: string
  erHalfDrop: boolean
  erContrastWelt: boolean
  erWeltFabric: string
  // Add-ons folded into this cushion's price
  addTick: boolean
  com: 'none' | 'com15'
  /** On the same Estimate Rocket line as the cushion above, sharing its style, fill and fabric. */
  joinAbove: boolean
  /** Rows of Velcro (0 = none), the length of the cushion. */
  velcroRows: 0 | 1 | 2
}
type Section = { length: number; qty: number; d: number; h: number }

/** Older drafts had a seat and an inside back on one card. */
type OldRow = Partial<Row> & { seatD?: string; seatH?: string; ibD?: string; ibH?: string; erSeatInsert?: string; erBackInsert?: string }

const DRAFT_KEY = 'pm-calc-cushion-pricing'
let nextId = 1
const blank = (patch: Partial<Row> = {}): Row => ({
  id: nextId++,
  name: '',
  qty: 1,
  length: '',
  depth: '',
  thickness: '',
  part: 'seat',
  labor: 'cleanSeam',
  insert: 'foam',
  foamType: '',
  plan: 'sewn',
  withBack: false,
  backDepth: '',
  backThickness: '',
  backLabor: 'cleanSeam',
  backStyle: 'To Be Determined',
  backInsert: 'foam',
  backFoamType: '',
  backFabric: '',
  backDirection: 'tbd',
  backCenter: '',
  backRepeat: '',
  backHalfDrop: false,
  backWeltFabric: '',
  erConfirmed: false,
  erStyle: 'To Be Determined',
  erFabric: '',
  erDirection: 'tbd',
  erCenter: '',
  erRepeat: '',
  erHalfDrop: false,
  erContrastWelt: false,
  erWeltFabric: '',
  addTick: false,
  com: 'none',
  joinAbove: false,
  velcroRows: 0,
  ...patch,
})

function loadDraft(): Row[] {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as OldRow[] | null
    if (Array.isArray(saved) && saved.length)
      return saved.flatMap((old) => {
        const { seatD, seatH, ibD, ibH, erSeatInsert, erBackInsert, ...rest } = old
        const fix = (r: Row) => {
          if (!['tbd', 'upTheRoll', 'railroaded'].includes(r.erDirection)) r.erDirection = 'tbd'
          // The back used to share the seat's labor and style.
          if (old.backLabor === undefined) r.backLabor = r.labor
          if (old.backStyle === undefined) r.backStyle = r.erStyle
          if (r.com !== 'com15') r.com = 'none'
          r.erStyle = slashStyle(r.erStyle)
          r.backStyle = slashStyle(r.backStyle)
          // Labor used to include foam; now it is the cover only and foam is the insert.
          const cover = ({ customFoam: 'cleanSeam', frenchFoam: 'frenchCover' } as Record<string, string>)[r.labor]
          if (cover) {
            r.labor = cover
            if (!r.insert || r.insert === 'tbd') r.insert = 'foam'
          }
          return r
        }
        if (seatD === undefined && ibD === undefined) return [fix({ ...blank(), ...rest, id: nextId++ })]
        // Split an old seat + inside back card into two cushions.
        const out: Row[] = []
        if (seatD || seatH || !(ibD || ibH))
          out.push(fix({ ...blank(), ...rest, id: nextId++, part: 'seat', depth: seatD ?? '', thickness: seatH ?? '', insert: erSeatInsert ?? 'tbd' }))
        if (ibD || ibH)
          out.push(
            fix({
              ...blank(),
              ...rest,
              id: nextId++,
              name: rest.name ? `${rest.name} back` : '',
              part: 'back',
              depth: ibD ?? '',
              thickness: ibH ?? '',
              insert: erBackInsert ?? 'tbd',
            }),
          )
        return out
      })
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return [blank()]
}

/**
 * Rows copied from the spreadsheet: Name, Qty, Length, Depth, Thickness,
 * then optionally Back height, Back thickness, Seat fabric, Back fabric.
 * Columns are tab-separated (or separated by |). A row with back sizes
 * becomes one seat + matching back cushion.
 */
function parsePasted(text: string): Row[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => (l.includes('\t') ? l.split('\t') : l.split('|')).map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean))
    .filter((cells) => cells.slice(2).some((c) => parseInches(c) !== null))
    .map(([name = '', qty = '', length = '', d = '', h = '', backD = '', backH = '', fabric = '', backFabric = '']) =>
      blank({
        name,
        qty: Math.max(1, parseInt(qty) || 1),
        length,
        depth: d,
        thickness: h,
        withBack: !!(backD || backH),
        backDepth: backD,
        backThickness: backH,
        erFabric: fabric,
        backFabric,
      }),
    )
}

function toSection(r: Row): Section | null {
  const length = parseInches(r.length)
  const d = parseInches(r.depth)
  const h = parseInches(r.thickness)
  if (length === null || d === null || h === null || length <= 0 || d <= 0 || h <= 0) return null
  return { length, qty: Math.max(1, r.qty || 1), d, h }
}

/**
 * The card a joined card shares its line with: the nearest card above that is not itself
 * joined. A seat with a matching back can't lead a shared line. Null when the card stands alone.
 */
function leadOf(rows: Row[], i: number): number | null {
  if (i === 0) return null
  let j = i - 1
  while (j > 0 && rows[j].joinAbove) j--
  const lead = rows[j]
  return lead.part === 'seat' && lead.withBack ? null : j
}

const joinedAt = (rows: Row[], i: number) => rows[i].joinAbove && leadOf(rows, i) !== null

/** A joined card takes everything but its own name, sizes and Confirmed from the card it joins. */
function effectiveRow(rows: Row[], i: number): Row {
  const r = rows[i]
  const j = joinedAt(rows, i) ? leadOf(rows, i) : null
  if (j === null) return r
  const { id, name, qty, length, depth, thickness, erConfirmed, joinAbove } = r
  return { ...rows[j], id, name, qty, length, depth, thickness, erConfirmed, joinAbove }
}

/**
 * The picks of the card's own cushion. A card switched to Back shows (and edits) the back
 * fields, so its price and Estimate Rocket text must read those too.
 */
function mainPicks(r: Row) {
  return r.part === 'back'
    ? { labor: r.backLabor, style: r.backStyle, insert: r.backInsert, foamType: r.backFoamType, fabric: r.backFabric, direction: r.backDirection, center: r.backCenter, weltFabric: r.backWeltFabric }
    : { labor: r.labor, style: r.erStyle, insert: r.insert, foamType: r.foamType, fabric: r.erFabric, direction: r.erDirection, center: r.erCenter, weltFabric: r.erWeltFabric }
}

/** The matching back cushion of a seat + back set, or null. */
function toBackSection(r: Row): Section | null {
  if (r.part !== 'seat' || !r.withBack) return null
  return toSection({ ...r, depth: r.backDepth, thickness: r.backThickness })
}

/**
 * Cut pieces for cushions upholstered to plywood, from the workroom's cut list sheet
 * (finished sizes, no deduction): one plate W+1 × D+1, and one boxing strip that goes all
 * the way around the board and wraps under it, 2W+2D+1 long × H+2½ wide. Welted styles
 * get cording around the top and the bottom edge.
 */
function boardPieces(x: Section, welted: boolean): { pieces: CutPiece[]; cording: number } {
  const around = 2 * x.length + 2 * x.d + 1
  const pieces: CutPiece[] = []
  for (let i = 0; i < x.qty; i++) {
    pieces.push({ name: 'plate', cushion: '', across: x.length + 1, along: x.d + 1 })
    pieces.push({ name: 'boxing', cushion: '', across: around, along: x.h + 2.5 })
  }
  return { pieces, cording: welted ? 2 * around * x.qty : 0 }
}

/**
 * Yards to order for every cushion of one part of a line (all `qty` of them): the cut pieces
 * laid out on a 54" roll the way Fabric Yardage does it, with one spare plate and the bias
 * cording for welted styles. Sewn cushions use the Cushion Cut pieces (both plates in the
 * fabric); upholstered-to-plywood cushions use the board cut list.
 */
/** Layouts already worked out, by their inputs (a page render asks for the same line several times). */
const planCache = new Map<string, FabricPlan>()

/** The cut pieces and roll options for one part (seat or back) of a line. */
function lineInputs(r: Row, x: Section, side: 'seat' | 'back'): { pieces: CutPiece[]; opts: FabricOptions } {
  const back = side === 'back'
  const style = back ? r.backStyle : r.erStyle
  const dir = back ? r.backDirection : r.erDirection
  const repeat = parseInches(back ? r.backRepeat : r.erRepeat) ?? 0
  const halfDrop = back ? r.backHalfDrop : r.erHalfDrop
  let pieces: CutPiece[]
  let cording: number
  if (r.plan === 'plywood') ({ pieces, cording } = boardPieces(x, isWelted(style)))
  else {
    const cuts = cushionCuts({
      qty: x.qty,
      front: x.length,
      sides: x.d,
      height: x.h,
      style: 'back',
      heightDeduction: DEFAULT_HEIGHT_DEDUCTION,
      cording: isWelted(style),
    })
    pieces = piecesFor(cuts, '')
    cording = cuts.cording
  }
  const opts: FabricOptions = {
    listedWidth: DEFAULT_LISTED_WIDTH,
    selvageTrim: DEFAULT_SELVAGE_TRIM,
    direction: (dir === 'tbd' ? 'auto' : dir) as DirectionChoice,
    gap: DEFAULT_GAP,
    endAllowance: DEFAULT_END_ALLOWANCE,
    cordingInches: cording,
    together: false,
    extra: DEFAULT_EXTRA,
    oneWay: false,
    pattern: repeat > 0 ? { vertical: repeat, horizontal: repeat, halfDrop } : null,
  }
  return { pieces, opts }
}

function cachedPlan(pieces: CutPiece[], opts: FabricOptions): FabricPlan {
  const key = JSON.stringify([pieces, opts])
  let plan = planCache.get(key)
  if (!plan) {
    if (planCache.size > 200) planCache.clear()
    plan = planFabric(pieces, opts)
    planCache.set(key, plan)
  }
  return plan
}

const linePlan = (r: Row, x: Section, side: 'seat' | 'back') => {
  const { pieces, opts } = lineInputs(r, x, side)
  return cachedPlan(pieces, opts)
}

const lineYards = (r: Row, x: Section, side: 'seat' | 'back') => linePlan(r, x, side).orderYards

const priceFor = (o: PriceOption, s: Section) => o.price(s.length, s.d, s.h)

function InchField({ id, label, value, onChange, help }: { id: string; label: string; value: string; onChange: (v: string) => void; help?: string }) {
  const { t } = useTranslation()
  const bad = value.trim() !== '' && parseInches(value) === null
  return (
    <Form.Item
      label={label}
      htmlFor={id}
      validateStatus={bad ? 'error' : undefined}
      help={bad ? t('calc.badInches') : undefined}
      extra={help}
      style={{ marginBottom: 16 }}
    >
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" suffix={t('calc.in')} size="large" />
    </Form.Item>
  )
}

/** Velcro runs the length of the cushion, counted in whole feet (rounded up). */
const velcroFeet = (length: number) => Math.ceil(length / 12 - 1e-9)
const velcroPrice = (rows: Row['velcroRows'], length: number) =>
  rows ? velcroFeet(length) * (rows === 2 ? ADD_ONS.velcro2 : ADD_ONS.velcro1) : 0

/** Add-ons for one of this cushion, given its labor price each. */
/** Welting comes with the sewing style: any "Welted" style gets it. */
const isWelted = (style: string) => /welt/i.test(style)

function sectionAddOns(r: Row, labor: number, welted: boolean): number {
  return (welted ? ADD_ONS.welting : 0) + (r.addTick ? ADD_ONS.outdoorTick : 0) + (r.com === 'com15' ? labor * (ADD_ONS.com15 - 1) : 0)
}

/** Plywood sheets for the job: count, cost and a layout of each 4 × 8 sheet. */
function PlywoodSheets({ plan }: { plan: ReturnType<typeof planPlywood> }) {
  const { t } = useTranslation()
  return (
    <Card
      title={t('cushionPricing.plywoodTitle')}
      extra={
        plan.sheets.length > 0 && (
          <Button icon={<FilePdfOutlined />} onClick={() => void import('../../lib/calculators/plywoodPdf').then((m) => m.downloadPlywoodPdf(plan))}>
            {t('cushionPricing.plywoodPdf')}
          </Button>
        )
      }
    >
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        {t('cushionPricing.plywoodSummary', { sheets: plan.sheets.length, pieces: plan.pieces, price: money(SHEET_PRICE), cost: money(plan.cost) })}
      </Typography.Paragraph>
      {plan.tooBig.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          title={t('cushionPricing.plywoodTooBig')}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {plan.tooBig.map((x) => (
                <li key={x.name}>
                  {x.name}: {formatInches(x.length)} × {formatInches(x.depth)}
                </li>
              ))}
            </ul>
          }
        />
      )}
      <Row gutter={[12, 12]}>
        {plan.sheets.map((sh, i) => (
          <Col xs={12} sm={6} key={i}>
            <SheetDiagram sheet={sh} n={i + 1} of={plan.sheets.length} />
          </Col>
        ))}
      </Row>
    </Card>
  )
}

function SheetDiagram({ sheet, n, of }: { sheet: Sheet; n: number; of: number }) {
  const { t } = useTranslation()
  return (
    <div>
      <Typography.Text strong style={{ fontSize: 12 }}>
        {t('cushionPricing.sheetN', { n, of, pct: Math.round(sheet.used * 100) })}
      </Typography.Text>
      <svg viewBox={`-1 -1 ${SHEET_W + 2} ${SHEET_L + 2}`} style={{ width: '100%', maxHeight: 220, display: 'block' }} role="img" aria-label={`Sheet ${n}`}>
        <rect x={0} y={0} width={SHEET_W} height={SHEET_L} fill="#eef0f3" stroke="#555" strokeWidth={0.5} />
        {sheet.pieces.map((p, k) => (
          <g key={k}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#d4e3f2" stroke="#1677ff" strokeWidth={0.5} />
            <text
              x={p.x + p.w / 2}
              y={p.y + p.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.max(2, Math.min(4, Math.min(p.w, p.h) / 4, Math.max(p.w, p.h) / 10))}
              fill="#222"
              transform={p.h > p.w ? `rotate(-90 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}
            >
              {formatInches(Math.max(p.w, p.h))} × {formatInches(Math.min(p.w, p.h))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Small feet → inches and inches → yards helpers from the original page. */
function Converters() {
  const { t } = useTranslation()
  const [ft, setFt] = useState<number | null>(null)
  const [inch, setInch] = useState<number | null>(null)
  const [inches, setInches] = useState<number | null>(null)
  const total = (ft ?? 0) * 12 + (inch ?? 0)
  return (
    <Row gutter={[16, 12]}>
      <Col xs={24} md={14}>
        <Typography.Text strong>{t('cushionPricing.ftToIn')}</Typography.Text>
        <Space wrap style={{ display: 'flex', marginTop: 6 }}>
          <InputNumber aria-label={t('cushionPricing.feet')} min={0} value={ft} onChange={setFt} addonAfter="ft" style={{ width: 120 }} />
          <InputNumber aria-label={t('cushionPricing.inches')} min={0} value={inch} onChange={setInch} addonAfter="in" style={{ width: 120 }} />
          <Typography.Text strong>= {Number.isInteger(total) ? total : total.toFixed(3)}″</Typography.Text>
        </Space>
      </Col>
      <Col xs={24} md={10}>
        <Typography.Text strong>{t('cushionPricing.inToYd')}</Typography.Text>
        <Space wrap style={{ display: 'flex', marginTop: 6 }}>
          <InputNumber aria-label={t('cushionPricing.inches')} min={0} value={inches} onChange={setInches} addonAfter="in" style={{ width: 140 }} />
          <Typography.Text strong>
            = {inches === null ? '—' : (inches / 36).toFixed(3)} {t('calc.yd')}
          </Typography.Text>
        </Space>
      </Col>
    </Row>
  )
}

/** Estimate Rocket text for one cushion line (with its matching back when it has one). */
function erTextFor(r: Row, s: Section, more: { r: Row; s: Section }[] = []): string {
  const b = more.length ? null : toBackSection(r)
  const m = mainPicks(r)
  const side = r.part === 'back' ? 'back' : 'seat'
  const all = [{ r, s }, ...more]
  const count = all.reduce((n, x) => n + x.s.qty, 0)
  let yardsTotal = lineYards(r, s, side)
  if (more.length) {
    // Every cushion of the line is laid out on one roll together.
    const inputs = all.map((x) => lineInputs(x.r, x.s, side))
    const opts = { ...inputs[0].opts, cordingInches: inputs.reduce((n, x) => n + x.opts.cordingInches, 0) }
    yardsTotal = cachedPlan(inputs.flatMap((x) => x.pieces), opts).orderYards
  }
  const welt = (style: string, f: string) => (isWelted(style) ? f : '')
  return estimateRocketText({
    qty: count,
    sizes: more.length
      ? all.map((x) => ({ qty: x.s.qty, width: formatInches(x.s.length), depth: formatInches(x.s.d), height: formatInches(x.s.h), confirmed: x.r.erConfirmed }))
      : undefined,
    width: formatInches(s.length),
    depth: formatInches(s.d),
    height: formatInches(s.h),
    confirmed: r.erConfirmed,
    insertLabel: r.part === 'back' ? 'Back Insert' : 'Seat Insert',
    plan: r.plan,
    sewingStyle: m.style,
    insert: m.insert,
    foamType: m.foamType,
    yardsPerItem: yardsTotal / count,
    yardsTotal,
    fabric: m.fabric,
    direction: m.direction,
    center: m.center,
    weltFabric: welt(m.style, m.weltFabric),
    back: b
      ? {
          depth: formatInches(b.d),
          height: formatInches(b.h),
          sewingStyle: r.backStyle,
          insert: r.backInsert,
          foamType: r.backFoamType,
          yardsPerItem: lineYards(r, b, 'back') / b.qty,
          yardsTotal: lineYards(r, b, 'back'),
          fabric: r.backFabric,
          direction: r.backDirection,
          center: r.backCenter,
          weltFabric: welt(r.backStyle, r.backWeltFabric),
        }
      : undefined,
  })
}

/** One line of the quote breakdown: what was picked and what it costs. */
type Pick = { label: string; amount: number }

/** Cushion pricing: section sizes in, labor / insert prices and yardage out, with a quote total. */
export default function CushionPricing() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[]>(loadDraft)
  const [paste, setPaste] = useState('')
  const [msg, msgCtx] = message.useMessage()

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rows))
    } catch {
      // Draft saving is a convenience only.
    }
  }, [rows])

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const sections = useMemo(() => rows.map(toSection), [rows])
  const effRows = useMemo(() => rows.map((_, i) => effectiveRow(rows, i)), [rows])
  // Estimate Rocket lines: a card and the cards joined under it.
  const erGroups = useMemo(() => {
    const groups: { lead: number; members: number[] }[] = []
    rows.forEach((_, i) => {
      if (!sections[i]) return
      const j = joinedAt(rows, i) ? leadOf(rows, i)! : i
      const g = groups.find((x) => x.lead === j)
      if (g) g.members.push(i)
      else groups.push({ lead: j, members: [i] })
    })
    return groups
  }, [rows, sections])
  const erTextForGroup = (g: { members: number[] }) => {
    const [first, ...rest] = g.members.map((i) => ({ r: effRows[i], s: sections[i]! }))
    return erTextFor(first.r, first.s, rest)
  }
  const optionLabel = (id: string) => (id === 'none' ? t('cushionPricing.none') : t(`cushionPricing.opt_${id}`))
  const insertLabel = (id: string) => (id === 'tbd' ? t('cushionPricing.insertTbd') : id === 'existing' ? t('cushionPricing.insertExisting') : optionLabel(id))

  const quote = useMemo(() => {
    const price = (id: string, s: Section) => {
      const o = PRICE_OPTIONS.find((x) => x.id === id)
      return o ? priceFor(o, s) : 0
    }
    const lines = effRows.flatMap((r, i) => {
      const s = sections[i]
      if (!s) return []
      const b = toBackSection(r)
      // One cushion of the line: its picks and their prices.
      const part = (x: Section, labor: string, insert: string, style: string) => {
        const welted = isWelted(style)
        const l = price(labor, x)
        const ins = price(insert, x)
        const picks: Pick[] = []
        if (labor !== 'none') picks.push({ label: optionLabel(labor), amount: l })
        if (ins) picks.push({ label: insertLabel(insert), amount: ins })
        if (welted) picks.push({ label: t('cushionPricing.pickWelting'), amount: ADD_ONS.welting })
        if (r.addTick) picks.push({ label: t('cushionPricing.pickTick'), amount: ADD_ONS.outdoorTick })
        if (r.com === 'com15') picks.push({ label: t('cushionPricing.pickCom'), amount: l * (ADD_ONS.com15 - 1) })
        const v = velcroPrice(r.velcroRows, x.length)
        if (v) picks.push({ label: t('cushionPricing.pickVelcro', { rows: r.velcroRows, ft: velcroFeet(x.length) }), amount: v })
        return { labor: l, insert: ins, addOns: sectionAddOns(r, l, welted) + v, picks }
      }
      const m = mainPicks(r)
      const seat = part(s, m.labor, m.insert, m.style)
      const back = b ? part(b, r.backLabor, r.backInsert, r.backStyle) : null
      const labor = seat.labor + (back?.labor ?? 0)
      const insert = seat.insert + (back?.insert ?? 0)
      const addOns = seat.addOns + (back?.addOns ?? 0)
      const eachPrice = labor + insert + addOns
      // Seat and back are laid out separately: they can be different fabrics. Yards are for the whole line.
      const seatPlan = linePlan(r, s, r.part === 'back' ? 'back' : 'seat')
      const backPlan = b ? linePlan(r, b, 'back') : null
      const seatYards = seatPlan.orderYards
      const backYards = backPlan?.orderYards ?? 0
      const yards = seatYards + backYards
      return [
        {
          key: r.id,
          name: (r.name.trim() || t('cushionPricing.cushionN', { n: i + 1 })) + (b ? ` (${t('cushionPricing.seatAndBack')})` : ''),
          qty: s.qty,
          seatPicks: seat.picks,
          backPicks: back?.picks ?? null,

          partLabel: r.part === 'back' ? t('cushionPricing.ib') : t('cushionPricing.seat'),
          labor,
          insert,
          addOns,
          each: eachPrice,
          total: eachPrice * s.qty,
          yardsEach: yards / s.qty,
          yards,
          seatYards,
          backYards,
          seatPlan,
          backPlan,
          seatFabric: (r.part === 'back' ? r.backFabric : r.erFabric).trim(),
          backFabric: r.backFabric.trim(),
        },
      ]
    })
    // Upholstered to plywood: every board for the job is nested onto full sheets, charged per sheet.
    const boards: Board[] = effRows.flatMap((r, i) => {
      const s = sections[i]
      if (!s || r.plan !== 'plywood') return []
      const name = r.name.trim() || t('cushionPricing.cushionN', { n: i + 1 })
      const b = toBackSection(r)
      return [
        { name, qty: s.qty, length: s.length, depth: s.d },
        ...(b ? [{ name: `${name} (${t('cushionPricing.ib').toLowerCase()})`, qty: b.qty, length: b.length, depth: b.d }] : []),
      ]
    })
    const plywood = planPlywood(boards)
    // Ordering: every part in the same fabric (same direction and repeat) goes on one roll together.
    // A part without a fabric name stays on its own.
    type Part = { label: string; fabric: string; pieces: CutPiece[]; opts: FabricOptions; yards: number }
    const parts: Part[] = effRows.flatMap((r, i) => {
      const s = sections[i]
      if (!s) return []
      const name = r.name.trim() || t('cushionPricing.cushionN', { n: i + 1 })
      const b = toBackSection(r)
      const mk = (x: Section, side: 'seat' | 'back', fabric: string, label: string): Part => {
        const { pieces, opts } = lineInputs(r, x, side)
        return { label, fabric: fabric.trim(), pieces: pieces.map((p) => ({ ...p, cushion: label })), opts, yards: cachedPlan(pieces, opts).orderYards }
      }
      const mainSide = r.part === 'back' ? 'back' : 'seat'
      return [
        mk(s, mainSide, mainSide === 'back' ? r.backFabric : r.erFabric, b ? `${name} ${t('cushionPricing.seat').toLowerCase()}` : name),
        ...(b ? [mk(b, 'back', r.backFabric, `${name} ${t('cushionPricing.ib').toLowerCase()}`)] : []),
      ]
    })
    const groups = new Map<string, Part[]>()
    parts.forEach((p, k) => {
      const { cordingInches: _c, ...same } = p.opts
      void _c
      const key = p.fabric ? JSON.stringify([p.fabric.toLowerCase(), same]) : `#${k}`
      groups.set(key, [...(groups.get(key) ?? []), p])
    })
    const fabrics = [...groups.values()].map((list) => {
      const pieces = list.flatMap((p) => p.pieces)
      const opts = { ...list[0].opts, cordingInches: list.reduce((n, p) => n + p.opts.cordingInches, 0) }
      return { fabric: list[0].fabric, labels: list.map((p) => p.label), separate: list.reduce((n, p) => n + p.yards, 0), plan: cachedPlan(pieces, opts) }
    })
    const orderYards = fabrics.reduce((n, f) => n + f.plan.orderYards, 0)
    const sum = (k: 'total' | 'yards') => lines.reduce((n, l) => n + l[k], 0)
    const labor = lines.reduce((n, l) => n + l.labor * l.qty, 0)
    const insert = lines.reduce((n, l) => n + l.insert * l.qty, 0)
    const addOns = lines.reduce((n, l) => n + l.addOns * l.qty, 0)
    return { lines, labor, insert, addOns, plywood, total: sum('total') + plywood.cost, yards: sum('yards'), fabrics, orderYards }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effRows, sections, t])

  const addPasted = () => {
    const pasted = parsePasted(paste)
    if (!pasted.length) return
    setRows((rs) => [...rs.filter((r) => r.name || r.length), ...pasted])
    setPaste('')
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      msg.success(t('cushionPricing.copied'))
    } catch {
      msg.error(t('cushionPricing.copyFailed'))
    }
  }

  const foamOptions = FOAM_TYPES.map((v) => ({ value: v, label: v }))
  const laborOptions = [
    { value: 'none', label: t('cushionPricing.none') },
    ...PRICE_OPTIONS.filter((o) => o.group === 'labor').map((o) => ({ value: o.id, label: optionLabel(o.id) })),
  ]
  const insertOptions = [
    { value: 'tbd', label: t('cushionPricing.insertTbd') },
    { value: 'existing', label: t('cushionPricing.insertExisting') },
    ...PRICE_OPTIONS.filter((o) => o.group === 'insert').map((o) => ({ value: o.id, label: optionLabel(o.id) })),
  ]
  const styleOptions = SEWING_STYLES.map((v) => ({ value: v, label: v }))
  const directionOptions = [
    { value: 'tbd', label: t('cushionPricing.erTbd') },
    { value: 'upTheRoll', label: t('cushionPricing.dirUpTheRoll') },
    { value: 'railroaded', label: t('cushionPricing.dirRailroaded') },
  ]
  const tbd = 'To Be Determined (Price Not Included)'

  /** A labelled field in the seat / back grid. */
  const field = (key: string, label: string, control: React.ReactNode) => (
    <Form.Item label={label} htmlFor={key} style={{ marginBottom: 16 }}>
      {control}
    </Form.Item>
  )

  /** Fields for one cushion of the card: labor, style, insert, foam, fabric, direction, centered, welt. */
  const partFields = (r: Row, side: 'seat' | 'back') => {
    const back = side === 'back'
    const P = t(back ? 'cushionPricing.partBack' : 'cushionPricing.partSeat')
    const id = (k: string) => `${k}-${side}-${r.id}`
    const v = back
      ? {
          labor: r.backLabor,
          style: r.backStyle,
          insert: r.backInsert,
          foam: r.backFoamType,
          fabric: r.backFabric,
          dir: r.backDirection,
          center: r.backCenter,
          welt: r.backWeltFabric,
          repeat: r.backRepeat,
        }
      : {
          labor: r.labor,
          style: r.erStyle,
          insert: r.insert,
          foam: r.foamType,
          fabric: r.erFabric,
          dir: r.erDirection,
          center: r.erCenter,
          welt: r.erWeltFabric,
          repeat: r.erRepeat,
        }
    const halfDrop = back ? r.backHalfDrop : r.erHalfDrop
    const set = (k: keyof typeof v, val: string) => {
      const map = back
        ? {
            labor: 'backLabor',
            style: 'backStyle',
            insert: 'backInsert',
            foam: 'backFoamType',
            fabric: 'backFabric',
            dir: 'backDirection',
            center: 'backCenter',
            welt: 'backWeltFabric',
            repeat: 'backRepeat',
          }
        : {
            labor: 'labor',
            style: 'erStyle',
            insert: 'insert',
            foam: 'foamType',
            fabric: 'erFabric',
            dir: 'erDirection',
            center: 'erCenter',
            welt: 'erWeltFabric',
            repeat: 'erRepeat',
          }
      update(r.id, { [map[k]]: val } as Partial<Row>)
    }
    return {
      labor: field(
        id('labor'),
        t('cushionPricing.fLabor', { part: P }),
        <Select id={id('labor')} size="large" value={v.labor} onChange={(x) => set('labor', x)} options={laborOptions} />,
      ),
      style: field(
        id('style'),
        t('cushionPricing.fStyle', { part: P }),
        <Select id={id('style')} size="large" showSearch value={v.style} onChange={(x) => set('style', x)} options={styleOptions} />,
      ),
      insert: field(
        id('insert'),
        t('cushionPricing.fInsert', { part: P }),
        <Select id={id('insert')} size="large" value={v.insert} onChange={(x) => set('insert', x)} options={insertOptions} />,
      ),
      foam: FOAM_INSERTS.includes(v.insert)
        ? field(
            id('foam'),
            t('cushionPricing.fFoam', { part: P }),
            <Select
              id={id('foam')}
              size="large"
              allowClear
              placeholder={t('cushionPricing.foamTbd')}
              value={v.foam || undefined}
              onChange={(x) => set('foam', x ?? '')}
              options={foamOptions}
            />,
          )
        : null,
      fabric: field(
        id('fabric'),
        t('cushionPricing.fFabric', { part: P }),
        <Input id={id('fabric')} size="large" allowClear value={v.fabric} onChange={(e) => set('fabric', e.target.value)} placeholder={tbd} />,
      ),
      dir: field(
        id('dir'),
        t('cushionPricing.fDirection', { part: P }),
        <Select id={id('dir')} size="large" value={v.dir} onChange={(x) => set('dir', x)} options={directionOptions} />,
      ),
      center: field(
        id('center'),
        t('cushionPricing.fCenter', { part: P }),
        <Input
          id={id('center')}
          size="large"
          allowClear
          value={v.center}
          onChange={(e) => set('center', e.target.value)}
          placeholder={t('cushionPricing.erCenterPlaceholder')}
        />,
      ),
      repeat: field(
        id('repeat'),
        t('cushionPricing.fRepeat', { part: P }),
        <Space.Compact style={{ width: '100%' }}>
          <Input
            id={id('repeat')}
            size="large"
            allowClear
            inputMode="decimal"
            value={v.repeat}
            onChange={(e) => set('repeat', e.target.value)}
            placeholder={t('cushionPricing.repeatPlain')}
            suffix={t('calc.in')}
            status={v.repeat.trim() !== '' && parseInches(v.repeat) === null ? 'error' : undefined}
          />
          <Select
            size="large"
            style={{ width: 150 }}
            disabled={!(parseInches(v.repeat) ?? 0)}
            value={halfDrop ? 'halfDrop' : 'straight'}
            onChange={(x) => update(r.id, (back ? { backHalfDrop: x === 'halfDrop' } : { erHalfDrop: x === 'halfDrop' }) as Partial<Row>)}
            options={(['straight', 'halfDrop'] as const).map((m) => ({ value: m, label: t(`fabricYardage.match_${m}`) }))}
          />
        </Space.Compact>,
      ),
      welt: isWelted(v.style)
        ? field(
            id('welt'),
            t('cushionPricing.fWelt', { part: P }),
            <Input
              id={id('welt')}
              size="large"
              allowClear
              value={v.welt}
              onChange={(e) => set('welt', e.target.value)}
              placeholder={t('cushionPricing.weltSame')}
            />,
          )
        : null,
    }
  }

  /** Two fields side by side (either can be empty). */
  const pair = (left: React.ReactNode, right: React.ReactNode, key: string) =>
    left || right ? (
      <Row gutter={12} key={key}>
        <Col xs={24} sm={12}>
          {left}
        </Col>
        <Col xs={24} sm={12}>
          {right}
        </Col>
      </Row>
    ) : null

  const anyPlywood = quote.plywood.pieces > 0 || quote.plywood.tooBig.length > 0

  return (
    <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>
      {msgCtx}
      <Link to="/tools">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('tools.title')}
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
        {t('tools.items.cushionPricing.name')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('cushionPricing.intro')}</Typography.Paragraph>

      <Alert
        type="info"
        showIcon
        title={t('cushionPricing.addOnsTitle')}
        description={t('cushionPricing.addOns', {
          pillow: money(ADD_ONS.throwPillow),
          welt: money(ADD_ONS.welting),
          tick: money(ADD_ONS.outdoorTick),
        })}
        style={{ marginBottom: 16 }}
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Collapse
          items={[
            { key: 'conv', label: t('cushionPricing.converters'), children: <Converters /> },
            {
              key: 'paste',
              label: t('cushionPricing.pasteTitle'),
              children: (
                <>
                  <Typography.Paragraph type="secondary">{t('cushionPricing.pasteHelp')}</Typography.Paragraph>
                  <Input.TextArea
                    id="pricing-paste"
                    aria-label={t('cushionPricing.pasteTitle')}
                    autoSize={{ minRows: 4, maxRows: 12 }}
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder={'3A\t1\t74\t25\t4'}
                    style={{ fontFamily: 'monospace' }}
                  />
                  <Button type="primary" style={{ marginTop: 12 }} disabled={!paste.trim()} onClick={addPasted}>
                    {t('leafBag.pasteAdd')}
                  </Button>
                </>
              ),
            },
          ]}
        />

        {rows.map((r, i) => {
          const s = sections[i]
          const joined = joinedAt(rows, i)
          const canJoin = i > 0 && !(r.part === 'seat' && r.withBack) && leadOf(rows, i) !== null
          const set = !joined && r.part === 'seat' && r.withBack
          const seat = partFields(r, r.part)
          const back = set ? partFields(r, 'back') : null
          return (
            <Card
              key={r.id}
              title={r.name.trim() || t('cushionPricing.cushionN', { n: i + 1 })}
              extra={
                rows.length > 1 && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('cushionPricing.remove')}
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  />
                )
              }
            >
              <Form layout="vertical" component="div">
                <Row gutter={12}>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('cushionPricing.name')} htmlFor={`name-${r.id}`} style={{ marginBottom: 8 }}>
                      <Input
                        id={`name-${r.id}`}
                        size="large"
                        allowClear
                        value={r.name}
                        onChange={(e) => update(r.id, { name: e.target.value })}
                        placeholder="3A"
                      />
                    </Form.Item>
                  </Col>
                  {!joined && (<Col xs={24} sm={8}>
                    <Form.Item label={t('cushionPricing.part')} style={{ marginBottom: 8 }}>
                      <Segmented
                        block
                        size="large"
                        value={r.part}
                        onChange={(v) => update(r.id, { part: v as Row['part'] })}
                        options={[
                          { value: 'seat', label: t('cushionPricing.seat') },
                          { value: 'back', label: t('cushionPricing.ib') },
                        ]}
                      />
                    </Form.Item>
                  </Col>)}
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('cushionPricing.howMany')} htmlFor={`qty-${r.id}`} style={{ marginBottom: 8 }}>
                      <InputNumber
                        id={`qty-${r.id}`}
                        size="large"
                        min={1}
                        precision={0}
                        value={r.qty}
                        onChange={(v) => update(r.id, { qty: v ?? 1 })}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Checkbox checked={r.erConfirmed} onChange={(e) => update(r.id, { erConfirmed: e.target.checked })} style={{ marginBottom: 12 }}>
                      {t('cushionPricing.dimsConfirmed')}
                    </Checkbox>
                  </Col>
                  {canJoin && (
                    <Col xs={24}>
                      <Checkbox checked={r.joinAbove} onChange={(e) => update(r.id, { joinAbove: e.target.checked })} style={{ marginBottom: 4 }}>
                        {t('cushionPricing.joinAbove')}
                      </Checkbox>
                      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13, marginBottom: 12 }}>
                        {joined
                          ? t('cushionPricing.joinedNote', { name: rows[leadOf(rows, i)!].name.trim() || t('cushionPricing.cushionN', { n: leadOf(rows, i)! + 1 }) })
                          : t('cushionPricing.joinHelp')}
                      </Typography.Text>
                    </Col>
                  )}
                  <Col xs={24} sm={8}>
                    <InchField
                      id={`len-${r.id}`}
                      label={t('cushionPricing.length')}
                      help={t('cushionPricing.lengthHelp')}
                      value={r.length}
                      onChange={(v) => update(r.id, { length: v })}
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <InchField
                      id={`d-${r.id}`}
                      label={t('cushionPricing.depth')}
                      help={t('cushionPricing.depthHelp')}
                      value={r.depth}
                      onChange={(v) => update(r.id, { depth: v })}
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <InchField id={`h-${r.id}`} label={t('cushionPricing.thickness')} value={r.thickness} onChange={(v) => update(r.id, { thickness: v })} />
                  </Col>
                  {!joined && r.part === 'seat' && (
                    <Col xs={24}>
                      <Checkbox checked={r.withBack} onChange={(e) => update(r.id, { withBack: e.target.checked })} style={{ marginBottom: 12 }}>
                        {t('cushionPricing.withBack')}
                      </Checkbox>
                    </Col>
                  )}
                  {set && (
                    <>
                      <Col xs={12} sm={{ span: 8, offset: 8 }}>
                        <InchField
                          id={`bd-${r.id}`}
                          label={t('cushionPricing.backHeight')}
                          value={r.backDepth}
                          onChange={(v) => update(r.id, { backDepth: v })}
                        />
                      </Col>
                      <Col xs={12} sm={8}>
                        <InchField
                          id={`bh-${r.id}`}
                          label={t('cushionPricing.backThickness')}
                          value={r.backThickness}
                          onChange={(v) => update(r.id, { backThickness: v })}
                        />
                      </Col>
                    </>
                  )}
                  {!joined && (<Col xs={24}>
                    <Form.Item label={t('cushionPricing.plan')} style={{ marginBottom: 8 }}>
                      <Segmented
                        block
                        size="large"
                        value={r.plan}
                        onChange={(v) => update(r.id, { plan: v as Row['plan'] })}
                        options={[
                          { value: 'sewn', label: t('cushionPricing.planSewn') },
                          { value: 'plywood', label: t('cushionPricing.planPlywood') },
                        ]}
                      />
                    </Form.Item>
                    {r.plan === 'plywood' && (
                      <>
                        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                          {t('cushionPricing.plywoodNote', { price: money(SHEET_PRICE) })}
                        </Typography.Text>
                        {[sections[i], toBackSection(r)].some((x) => x && !fitsSheet(x.length, x.d)) && (
                          <Alert type="warning" showIcon style={{ marginTop: 8 }} title={t('cushionPricing.plywoodCardTooBig')} />
                        )}
                      </>
                    )}
                    <div style={{ height: 16 }} />
                  </Col>)}
                </Row>

                {!joined && (<>{back
                  ? [
                      pair(seat.labor, back.labor, 'labor'),
                      pair(seat.style, back.style, 'style'),
                      pair(seat.insert, back.insert, 'insert'),
                      pair(seat.foam, back.foam, 'foam'),
                      pair(seat.fabric, back.fabric, 'fabric'),
                      pair(seat.dir, back.dir, 'dir'),
                      pair(seat.center, back.center, 'center'),
                      pair(seat.repeat, back.repeat, 'repeat'),
                      pair(seat.welt, back.welt, 'welt'),
                    ]
                  : [
                      pair(seat.labor, seat.style, 'labor'),
                      pair(seat.insert, seat.foam, 'insert'),
                      pair(seat.fabric, seat.dir, 'fabric'),
                      pair(seat.welt, seat.center, 'center'),
                      pair(seat.repeat, null, 'repeat'),
                    ]}

                <Form.Item label={t('cushionPricing.addOnsLabel')} extra={t('cushionPricing.addOnsHelp')} style={{ marginBottom: 0 }}>
                  <Space wrap size={[24, 8]}>
                    <Checkbox checked={r.addTick} onChange={(e) => update(r.id, { addTick: e.target.checked })}>
                      {t('cushionPricing.addTick', { price: money(ADD_ONS.outdoorTick) })}
                    </Checkbox>
                    <Checkbox checked={r.com === 'com15'} onChange={(e) => update(r.id, { com: e.target.checked ? 'com15' : 'none' })}>
                      {t('cushionPricing.com15')}
                    </Checkbox>
                  </Space>
                </Form.Item>
                <Row gutter={12} style={{ marginTop: 12 }}>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('cushionPricing.velcro')} htmlFor={`velcro-${r.id}`} extra={t('cushionPricing.velcroHelp')} style={{ marginBottom: 0 }}>
                      <Select
                        id={`velcro-${r.id}`}
                        size="large"
                        value={r.velcroRows}
                        onChange={(v) => update(r.id, { velcroRows: v })}
                        options={[
                          { value: 0, label: t('cushionPricing.velcroNone') },
                          { value: 1, label: t('cushionPricing.velcro1', { price: money(ADD_ONS.velcro1) }) },
                          { value: 2, label: t('cushionPricing.velcro2', { price: money(ADD_ONS.velcro2) }) },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row></>)}
              </Form>
              {!s && (
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
                  {t('cushionPricing.fillIn')}
                </Typography.Text>
              )}
            </Card>
          )
        })}

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <Button type="dashed" block size="large" icon={<PlusOutlined />} onClick={() => setRows((rs) => [...rs, blank()])}>
              {t('cushionPricing.add')}
            </Button>
          </Col>
          <Col xs={24} sm={12}>
            {/* Same specs as the last cushion; only the name is cleared, so just the quantity and sizes need changing. */}
            <Button
              block
              size="large"
              icon={<CopyOutlined />}
              disabled={!rows.length}
              onClick={() => setRows((rs) => (rs.length ? [...rs, { ...rs[rs.length - 1], id: nextId++, name: '' }] : rs))}
            >
              {t('cushionPricing.duplicateLast')}
            </Button>
          </Col>
        </Row>

        {anyPlywood && <PlywoodSheets plan={quote.plywood} />}

        {quote.fabrics.length > 0 && (
          <Card title={t('cushionPricing.fabricMapsTitle')}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              {t('cushionPricing.fabricMapsHelp', { order: quote.orderYards, separate: quote.yards })}
            </Typography.Paragraph>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              {quote.fabrics.map((f, k) => (
                <div key={k}>
                  <Typography.Text strong>
                    {f.fabric || t('cushionPricing.fabricUnnamed')} — {t('cushionPricing.ydTotal', { n: f.plan.orderYards })} (
                    {t(`fabricYardage.${f.plan.direction}`)})
                  </Typography.Text>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {f.labels.join(', ')}
                      {f.labels.length > 1 && f.separate !== f.plan.orderYards ? ` · ${t('cushionPricing.separately', { n: f.separate })}` : ''}
                    </Typography.Text>
                  </div>
                  <RollDiagram
                    plan={f.plan}
                    cushionIndex={(c) => Math.max(0, f.labels.indexOf(c))}
                    pieceLabel={(p) =>
                      (f.labels.length > 1 && p.cushion ? `${p.cushion} · ` : '') +
                      t(`fabricYardage.piece_${p.name}`) +
                      (p.join ? ` (${t(`fabricYardage.join_${p.join.part}`)})` : '')
                    }
                  />
                </div>
              ))}
            </Space>
          </Card>
        )}

        <Card title={t('cushionPricing.quoteTitle')}>
          {quote.lines.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              scroll={{ x: true }}
              dataSource={quote.lines}
              columns={[
                {
                  title: t('cushionPricing.name'),
                  dataIndex: 'name',
                  render: (name: string, l) => (
                    <>
                      <Typography.Text strong>{name}</Typography.Text>
                      {(
                        [
                          [l.backPicks ? t('cushionPricing.seat') : l.partLabel, l.seatPicks],
                          ...(l.backPicks ? [[t('cushionPricing.ib'), l.backPicks] as const] : []),
                        ] as const
                      ).map(([label, picks]) => (
                        <div key={label} style={{ fontSize: 12 }}>
                          <Typography.Text type="secondary">
                            {label}: {picks.map((p) => `${p.label} ${money(p.amount)}`).join(' · ')}
                          </Typography.Text>
                        </div>
                      ))}
                    </>
                  ),
                },
                { title: t('cushionCut.qty'), dataIndex: 'qty', align: 'center', width: 56 },
                { title: t('cushionPricing.each'), dataIndex: 'each', align: 'right', render: (n: number) => money(n) },
                {
                  title: t('cushionPricing.lineTotal'),
                  dataIndex: 'total',
                  align: 'right',
                  render: (n: number) => <Typography.Text strong>{money(n)}</Typography.Text>,
                },
                {
                  title: t('cushionPricing.fabric'),
                  key: 'yards',
                  align: 'right',
                  render: (_: unknown, l) =>
                    l.backYards ? (
                      <>
                        <div>{t('cushionPricing.ydSeat', { n: l.seatYards })}</div>
                        <div>{t('cushionPricing.ydBack', { n: l.backYards })}</div>
                      </>
                    ) : (
                      <>
                        <div>{t('cushionPricing.ydTotal', { n: l.yards })}</div>
                        {l.qty > 1 && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {t('cushionPricing.ydEachAbout', { n: Number.isInteger(l.yardsEach) ? l.yardsEach : l.yardsEach.toFixed(1) })}
                          </Typography.Text>
                        )}
                      </>
                    ),
                },
              ]}
            />
          ) : (
            <Typography.Text type="secondary">{t('cushionPricing.fillIn')}</Typography.Text>
          )}
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={12} sm={6}>
              <Statistic title={t('cushionPricing.tabLabor')} value={money(quote.labor)} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title={t('cushionPricing.insert')} value={money(quote.insert)} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title={t('cushionPricing.addOnsCol')} value={money(quote.addOns)} />
            </Col>
            {quote.plywood.pieces > 0 && (
              <Col xs={12} sm={6}>
                <Statistic title={t('cushionPricing.plywoodStat', { n: quote.plywood.sheets.length })} value={money(quote.plywood.cost)} />
              </Col>
            )}
            <Col xs={12} sm={6}>
              <Statistic title={t('cushionPricing.total')} value={money(quote.total)} valueStyle={{ fontWeight: 700 }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title={t('cushionPricing.fabricTotal')} value={quote.orderYards} suffix={t('calc.yd')} />
            </Col>
          </Row>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
            {t('cushionPricing.yardageHow')}
          </Typography.Paragraph>
        </Card>

        {quote.lines.length > 0 && (
          <Card
            title={t('cushionPricing.erTitle')}
            extra={
              erGroups.length > 1 && (
                <Button icon={<CopyOutlined />} onClick={() => copy(erGroups.map(erTextForGroup).join('\n\n'))}>
                  {t('cushionPricing.copyAll')}
                </Button>
              )
            }
          >
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {erGroups.map((g) => {
                const text = erTextForGroup(g)
                return (
                  <Card
                    key={rows[g.lead].id}
                    size="small"
                    type="inner"
                    title={g.members.map((i) => rows[i].name.trim() || t('cushionPricing.cushionN', { n: i + 1 })).join(', ')}
                    extra={
                      <Button type="primary" icon={<CopyOutlined />} onClick={() => copy(text)}>
                        {t('cushionPricing.copy')}
                      </Button>
                    }
                  >
                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 220, overflow: 'auto' }}>{text}</pre>
                  </Card>
                )
              })}
            </Space>
          </Card>
        )}

        <Popconfirm
          title={t('cushionPricing.clearConfirm')}
          okText={t('cushionCut.clear')}
          cancelText={t('common.cancel')}
          onConfirm={() => setRows([blank()])}
        >
          <Button size="large" danger>
            {t('cushionCut.clear')}
          </Button>
        </Popconfirm>
      </Space>
    </div>
  )
}
