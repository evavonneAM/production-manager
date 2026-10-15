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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { formatInches, parseInches } from '../../lib/calculators/inches'
import { FOAM_TYPES } from '../../lib/foamTypes'
import { SHEET_L, SHEET_PRICE, SHEET_W, fitsSheet, planPlywood, type Board, type Sheet } from '../../lib/calculators/plywoodNesting'
import {
  ADD_ONS,
  FOAM_INSERTS,
  PRICE_OPTIONS,
  SEWING_STYLES,
  estimateRocketText,
  money,
  wholeYards,
  yardageNonReversible,
  yardageReversible,
  type PriceGroup,
  type PriceOption,
} from '../../lib/calculators/cushionPricing'

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
  backInsert: string
  backFoamType: string
  backFabric: string
  // Estimate Rocket text
  erConfirmed: boolean
  erStyle: string
  erReversible: boolean
  erFabric: string
  erDirection: 'tbd' | 'upTheRoll' | 'railroaded'
  erCenter: string
  erContrastWelt: boolean
  erWeltFabric: string
  // Add-ons folded into this cushion's price
  addWelting: boolean
  addTick: boolean
  com: 'none' | 'com15'
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
  backInsert: 'foam',
  backFoamType: '',
  backFabric: '',
  erConfirmed: false,
  erStyle: 'To Be Determined',
  erReversible: true,
  erFabric: '',
  erDirection: 'tbd',
  erCenter: '',
  erContrastWelt: false,
  erWeltFabric: '',
  addWelting: false,
  addTick: false,
  com: 'none',
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
          if (r.com !== 'com15') r.com = 'none'
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

/** The matching back cushion of a seat + back set, or null. */
function toBackSection(r: Row): Section | null {
  if (r.part !== 'seat' || !r.withBack) return null
  return toSection({ ...r, depth: r.backDepth, thickness: r.backThickness })
}

/** Yards for one cushion, reversible or not. */
const pieceYardsFor = (r: Row, x: Section) => (r.erReversible ? yardageReversible(x.length) : yardageNonReversible(x.length))

/** Reversible and non-reversible yards for one cushion (seat or back). */
function YardStats({ s, title }: { s: Section; title?: string }) {
  const { t } = useTranslation()
  const kinds = [
    ['reversible', yardageReversible(s.length)],
    ['nonReversible', yardageNonReversible(s.length)],
  ] as const
  return (
    <>
      {title && <Typography.Text strong>{title}</Typography.Text>}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        {kinds.map(([k, y]) => (
          <Col span={12} key={k}>
            <Statistic title={t(`cushionPricing.${k}`)} value={wholeYards(y) * s.qty} suffix={t('calc.yd')} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('cushionPricing.yardsEach', { n: wholeYards(y), exact: y.toFixed(2) })}
            </Typography.Text>
          </Col>
        ))}
      </Row>
    </>
  )
}

const priceFor = (o: PriceOption, s: Section) => o.price(s.length, s.d, s.h)

function InchField({ id, label, value, onChange, help }: { id: string; label: string; value: string; onChange: (v: string) => void; help?: string }) {
  const { t } = useTranslation()
  const bad = value.trim() !== '' && parseInches(value) === null
  return (
    <Form.Item label={label} htmlFor={id} validateStatus={bad ? 'error' : undefined} help={bad ? t('calc.badInches') : undefined} extra={help} style={{ marginBottom: 16 }}>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" suffix={t('calc.in')} size="large" />
    </Form.Item>
  )
}

function PriceTable({ section, group }: { section: Section; group: PriceGroup }) {
  const { t } = useTranslation()
  const tooThick = (o: PriceOption) =>
    (o.maxBox !== undefined && section.h > o.maxBox) || (o.maxDiameter !== undefined && section.h > o.maxDiameter)
  const cell = (o: PriceOption) => (
    <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
      <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(priceFor(o, section))}</Typography.Text>
      {tooThick(o) && <Tag color="error">{t('cushionPricing.overMax')}</Tag>}
    </Space>
  )
  return (
    <Table
      size="small"
      pagination={false}
      rowKey="id"
      dataSource={PRICE_OPTIONS.filter((o) => o.group === group)}
      columns={[
        {
          title: t('cushionPricing.option'),
          dataIndex: 'id',
          render: (_: string, o: PriceOption) => (
            <>
              <div>{t(`cushionPricing.opt_${o.id}`)}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {o.formula}
                {o.maxBox ? ` · ${t('cushionPricing.maxBox', { n: o.maxBox })}` : ''}
                {o.maxDiameter ? ` · ${t('cushionPricing.maxDia', { n: o.maxDiameter })}` : ''}
              </Typography.Text>
            </>
          ),
        },
        { title: t('cushionPricing.priceEach'), key: 'price', align: 'right', render: (_: unknown, o: PriceOption) => cell(o) },
      ]}
    />
  )
}

/** Price table for a cushion, or for the seat and back of a set. */
function SetTables({ seat, back, group }: { seat: Section; back: Section | null; group: PriceGroup }) {
  const { t } = useTranslation()
  if (!back) return <PriceTable section={seat} group={group} />
  return (
    <>
      <Typography.Text strong>{t('cushionPricing.seat')}</Typography.Text>
      <PriceTable section={seat} group={group} />
      <Typography.Text strong style={{ display: 'block', marginTop: 12 }}>
        {t('cushionPricing.ib')}
      </Typography.Text>
      <PriceTable section={back} group={group} />
    </>
  )
}

/** Estimate Rocket description for one cushion part, ready to copy. */
function EstimateRocket({ row, section, update }: { row: Row; section: Section; update: (patch: Partial<Row>) => void }) {
  const { t } = useTranslation()
  const [msg, ctx] = message.useMessage()
  const backSection = toBackSection(row)
  const yards = pieceYardsFor(row, section)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      msg.success(t('cushionPricing.copied'))
    } catch {
      msg.error(t('cushionPricing.copyFailed'))
    }
  }

  return (
    <>
      {ctx}
      <Form layout="vertical" component="div">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item label={t('cushionPricing.erStyle')} htmlFor={`er-style-${row.id}`} style={{ marginBottom: 12 }}>
              <Select
                id={`er-style-${row.id}`}
                showSearch
                value={row.erStyle}
                onChange={(v) => update({ erStyle: v })}
                options={SEWING_STYLES.map((v) => ({ value: v, label: v }))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('cushionPricing.erDims')} style={{ marginBottom: 12 }}>
              <Checkbox checked={row.erConfirmed} onChange={(e) => update({ erConfirmed: e.target.checked })}>
                {t('cushionPricing.erConfirmed')}
              </Checkbox>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('cushionPricing.erDirection')} style={{ marginBottom: 12 }}>
              <Segmented
                block
                value={row.erDirection}
                onChange={(v) => update({ erDirection: v as Row['erDirection'] })}
                options={[
                  { value: 'tbd', label: t('cushionPricing.erTbd') },
                  { value: 'upTheRoll', label: t('cushionCut.upTheRoll') },
                  { value: 'railroaded', label: t('cushionCut.railroaded') },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('cushionPricing.erCenter')} htmlFor={`er-ctr-${row.id}`} extra={t('cushionPricing.erCenterHelp')} style={{ marginBottom: 12 }}>
              <Input id={`er-ctr-${row.id}`} allowClear value={row.erCenter} onChange={(e) => update({ erCenter: e.target.value })} placeholder={t('cushionPricing.erCenterPlaceholder')} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('cushionPricing.erWelt')} style={{ marginBottom: 12 }}>
              <Checkbox checked={row.erContrastWelt} onChange={(e) => update({ erContrastWelt: e.target.checked })}>
                {t('cushionPricing.erContrastWelt')}
              </Checkbox>
            </Form.Item>
          </Col>
          {row.erContrastWelt && (
            <Col xs={24} sm={12}>
              <Form.Item label={t('cushionPricing.erWeltFabric')} htmlFor={`er-welt-${row.id}`} style={{ marginBottom: 12 }}>
                <Input id={`er-welt-${row.id}`} allowClear value={row.erWeltFabric} onChange={(e) => update({ erWeltFabric: e.target.value })} placeholder="To Be Determined (Price Not Included)" />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
      {[row.part].map((key) => {
        const text = estimateRocketText({
          qty: section.qty,
          width: formatInches(section.length),
          depth: formatInches(section.d),
          height: formatInches(section.h),
          confirmed: row.erConfirmed,
          sewingStyle: row.erStyle,
          insertLabel: key === 'back' ? 'Back Insert' : 'Seat Insert',
          insert: row.insert,
          yardsPerItem: yards,
          fabric: row.erFabric,
          direction: row.erDirection,
          center: row.erCenter,
          contrastWelt: row.erContrastWelt,
          weltFabric: row.erWeltFabric,
          plan: row.plan,
          foamType: row.foamType,
          back: backSection
            ? {
                depth: formatInches(backSection.d),
                height: formatInches(backSection.h),
                insert: row.backInsert,
                foamType: row.backFoamType,
                yardsPerItem: pieceYardsFor(row, backSection),
                fabric: row.backFabric,
              }
            : undefined,
        })
        return (
          <Card
            key={key}
            size="small"
            type="inner"
            title={t(key === 'back' ? 'cushionPricing.ib' : 'cushionPricing.seat')}
            extra={
              <Button type="primary" icon={<CopyOutlined />} onClick={() => copy(text)}>
                {t('cushionPricing.copy')}
              </Button>
            }
            style={{ marginTop: 12 }}
          >
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12, maxHeight: 220, overflow: 'auto' }}>{text}</pre>
          </Card>
        )
      })}
    </>
  )
}

/** Add-ons for one of this cushion, given its labor price each. */
function sectionAddOns(r: Row, labor: number): number {
  return (
    (r.addWelting ? ADD_ONS.welting : 0) +
    (r.addTick ? ADD_ONS.outdoorTick : 0) +
    (r.com === 'com15' ? labor * (ADD_ONS.com15 - 1) : 0)
  )
}

/** Plywood sheets for the job: count, cost and a layout of each 4 × 8 sheet. */
function PlywoodSheets({ plan }: { plan: ReturnType<typeof planPlywood> }) {
  const { t } = useTranslation()
  return (
    <Card size="small" type="inner" title={t('cushionPricing.plywoodTitle')} style={{ marginTop: 16 }}>
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
          <Typography.Text strong>= {inches === null ? '—' : (inches / 36).toFixed(3)} {t('calc.yd')}</Typography.Text>
        </Space>
      </Col>
    </Row>
  )
}

/** Cushion pricing: section sizes in, labor / insert prices and yardage out, with a quote total. */
export default function CushionPricing() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[]>(loadDraft)
  const [paste, setPaste] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rows))
    } catch {
      // Draft saving is a convenience only.
    }
  }, [rows])

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const sections = useMemo(() => rows.map(toSection), [rows])

  const quote = useMemo(() => {
    const price = (id: string, s: Section) => {
      const o = PRICE_OPTIONS.find((x) => x.id === id)
      return o ? priceFor(o, s) : 0
    }
    const lines = rows.flatMap((r, i) => {
      const s = sections[i]
      if (!s) return []
      const b = toBackSection(r)
      const labor = price(r.labor, s) + (b ? price(r.labor, b) : 0)
      const insert = price(r.insert, s) + (b ? price(r.backInsert, b) : 0)
      const addOns = sectionAddOns(r, price(r.labor, s)) + (b ? sectionAddOns(r, price(r.labor, b)) : 0)
      const eachPrice = labor + insert + addOns
      // Seat and back round up separately: they can be different fabrics.
      const seatYards = wholeYards(pieceYardsFor(r, s))
      const backYards = b ? wholeYards(pieceYardsFor(r, b)) : 0
      const yardsEach = seatYards + backYards
      return [
        {
          key: r.id,
          name: (r.name.trim() || t('cushionPricing.cushionN', { n: i + 1 })) + (b ? ` (${t('cushionPricing.seatAndBack')})` : ''),
          qty: s.qty,
          labor,
          insert,
          addOns,
          each: eachPrice,
          total: eachPrice * s.qty,
          yardsEach,
          yards: yardsEach * s.qty,
          seatYards,
          backYards,
        },
      ]
    })
    // Upholstered to plywood: every board for the job is nested onto full sheets, charged per sheet.
    const boards: Board[] = rows.flatMap((r, i) => {
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
    const sum = (k: 'total' | 'yards') => lines.reduce((n, l) => n + l[k], 0)
    const labor = lines.reduce((n, l) => n + l.labor * l.qty, 0)
    const insert = lines.reduce((n, l) => n + l.insert * l.qty, 0)
    const addOns = lines.reduce((n, l) => n + l.addOns * l.qty, 0)
    return { lines, labor, insert, addOns, plywood, total: sum('total') + plywood.cost, yards: sum('yards') }
  }, [rows, sections, t])

  const addPasted = () => {
    const pasted = parsePasted(paste)
    if (!pasted.length) return
    setRows((rs) => [...rs.filter((r) => r.name || r.length), ...pasted])
    setPaste('')
  }

  const optionLabel = (o: PriceOption) => t(`cushionPricing.opt_${o.id}`)
  const foamOptions = FOAM_TYPES.map((v) => ({ value: v, label: v }))
  const insertOptions = [
    { value: 'tbd', label: t('cushionPricing.insertTbd') },
    { value: 'existing', label: t('cushionPricing.insertExisting') },
    ...PRICE_OPTIONS.filter((o) => o.group === 'insert').map((o) => ({ value: o.id, label: optionLabel(o) })),
  ]

  return (
    <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>
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
          return (
            <Card
              key={r.id}
              title={r.name.trim() || t('cushionPricing.cushionN', { n: i + 1 })}
              extra={
                rows.length > 1 && (
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('cushionPricing.remove')} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
                )
              }
            >
              <Form layout="vertical" component="div">
                <Row gutter={12}>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('cushionPricing.name')} htmlFor={`name-${r.id}`} style={{ marginBottom: 16 }}>
                      <Input id={`name-${r.id}`} size="large" allowClear value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="3A" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('cushionPricing.part')} style={{ marginBottom: 16 }}>
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
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('cushionCut.howMany')} htmlFor={`qty-${r.id}`} style={{ marginBottom: 16 }}>
                      <InputNumber id={`qty-${r.id}`} size="large" min={1} precision={0} value={r.qty} onChange={(v) => update(r.id, { qty: v ?? 1 })} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <InchField id={`len-${r.id}`} label={t('cushionPricing.length')} help={t('cushionPricing.lengthHelp')} value={r.length} onChange={(v) => update(r.id, { length: v })} />
                  </Col>
                  <Col xs={12} sm={8}>
                    <InchField id={`d-${r.id}`} label={t('cushionPricing.depth')} help={t('cushionPricing.depthHelp')} value={r.depth} onChange={(v) => update(r.id, { depth: v })} />
                  </Col>
                  <Col xs={12} sm={8}>
                    <InchField id={`h-${r.id}`} label={t('cushionPricing.thickness')} value={r.thickness} onChange={(v) => update(r.id, { thickness: v })} />
                  </Col>
                  {r.part === 'seat' && (
                    <Col xs={24}>
                      <Checkbox checked={r.withBack} onChange={(e) => update(r.id, { withBack: e.target.checked })} style={{ marginBottom: 16 }}>
                        {t('cushionPricing.withBack')}
                      </Checkbox>
                    </Col>
                  )}
                  {r.part === 'seat' && r.withBack && (
                    <>
                      <Col xs={12} sm={8}>
                        <InchField id={`bd-${r.id}`} label={t('cushionPricing.backHeight')} value={r.backDepth} onChange={(v) => update(r.id, { backDepth: v })} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <InchField id={`bh-${r.id}`} label={t('cushionPricing.backThickness')} value={r.backThickness} onChange={(v) => update(r.id, { backThickness: v })} />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('cushionPricing.backInsert')} htmlFor={`bins-${r.id}`} style={{ marginBottom: 16 }}>
                          <Select id={`bins-${r.id}`} size="large" value={r.backInsert} onChange={(v) => update(r.id, { backInsert: v })} options={insertOptions} />
                        </Form.Item>
                      </Col>
                      {FOAM_INSERTS.includes(r.backInsert) && (
                        <Col xs={24} sm={8}>
                          <Form.Item label={t('cushionPricing.backFoamType')} htmlFor={`bfoam-${r.id}`} style={{ marginBottom: 16 }}>
                            <Select id={`bfoam-${r.id}`} size="large" allowClear placeholder={t('cushionPricing.foamTbd')} value={r.backFoamType || undefined} onChange={(v) => update(r.id, { backFoamType: v ?? '' })} options={foamOptions} />
                          </Form.Item>
                        </Col>
                      )}

                    </>
                  )}
                </Row>
                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t(r.part === 'seat' && r.withBack ? 'cushionPricing.seatFabric' : 'cushionPricing.erFabric')} htmlFor={`er-fab-${r.id}`} style={{ marginBottom: 16 }}>
                      <Input
                        id={`er-fab-${r.id}`}
                        size="large"
                        allowClear
                        value={r.erFabric}
                        onChange={(e) => update(r.id, { erFabric: e.target.value })}
                        placeholder="To Be Determined (Price Not Included)"
                      />
                    </Form.Item>
                  </Col>
                  {r.part === 'seat' && r.withBack && (
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('cushionPricing.backFabric')} htmlFor={`bfab-${r.id}`} style={{ marginBottom: 16 }}>
                        <Input
                          id={`bfab-${r.id}`}
                          size="large"
                          allowClear
                          value={r.backFabric}
                          onChange={(e) => update(r.id, { backFabric: e.target.value })}
                          placeholder="To Be Determined (Price Not Included)"
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
                <Row gutter={12}>
                  <Col xs={24}>
                    <Form.Item label={t('cushionPricing.plan')} style={{ marginBottom: 16 }}>
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
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('cushionPricing.tabLabor')} htmlFor={`labor-${r.id}`} style={{ marginBottom: 16 }}>
                      <Select
                        id={`labor-${r.id}`}
                        size="large"
                        value={r.labor}
                        onChange={(v) => update(r.id, { labor: v })}
                        options={[
                          { value: 'none', label: t('cushionPricing.none') },
                          ...PRICE_OPTIONS.filter((o) => o.group === 'labor').map((o) => ({ value: o.id, label: optionLabel(o) })),
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t(r.part === 'seat' && r.withBack ? 'cushionPricing.seatInsert' : 'cushionPricing.insert')} htmlFor={`ins-${r.id}`} style={{ marginBottom: 16 }}>
                      <Select id={`ins-${r.id}`} size="large" value={r.insert} onChange={(v) => update(r.id, { insert: v })} options={insertOptions} />
                    </Form.Item>
                  </Col>
                  {FOAM_INSERTS.includes(r.insert) && (
                    <Col xs={24} sm={12}>
                      <Form.Item label={t(r.part === 'seat' && r.withBack ? 'cushionPricing.seatFoamType' : 'cushionPricing.foamType')} htmlFor={`foam-${r.id}`} style={{ marginBottom: 16 }}>
                        <Select id={`foam-${r.id}`} size="large" allowClear placeholder={t('cushionPricing.foamTbd')} value={r.foamType || undefined} onChange={(v) => update(r.id, { foamType: v ?? '' })} options={foamOptions} />
                      </Form.Item>
                    </Col>
                  )}
                  {r.plan === 'plywood' && (
                    <Col xs={24}>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                        {t('cushionPricing.plywoodNote', { price: money(SHEET_PRICE) })}
                      </Typography.Text>
                      {[sections[i], toBackSection(r)].some((x) => x && !fitsSheet(x.length, x.d)) && (
                        <Alert type="warning" showIcon style={{ marginBottom: 16 }} title={t('cushionPricing.plywoodCardTooBig')} />
                      )}
                    </Col>
                  )}
                  <Col xs={24}>
                    <Form.Item label={t('cushionPricing.addOnsLabel')} extra={t('cushionPricing.addOnsHelp')} style={{ marginBottom: 16 }}>
                      <Space wrap size={[24, 8]}>
                        <Checkbox checked={r.addWelting} onChange={(e) => update(r.id, { addWelting: e.target.checked })}>
                          {t('cushionPricing.addWelting', { price: money(ADD_ONS.welting) })}
                        </Checkbox>
                        <Checkbox checked={r.addTick} onChange={(e) => update(r.id, { addTick: e.target.checked })}>
                          {t('cushionPricing.addTick', { price: money(ADD_ONS.outdoorTick) })}
                        </Checkbox>
                        <Checkbox checked={r.com === 'com15'} onChange={(e) => update(r.id, { com: e.target.checked ? 'com15' : 'none' })}>
                          {t('cushionPricing.com15')}
                        </Checkbox>
                        <Checkbox checked={r.erReversible} onChange={(e) => update(r.id, { erReversible: e.target.checked })}>
                          {t('cushionPricing.reversibleFabric')}
                        </Checkbox>
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
              {s ? (
                <Tabs
                  size="small"
                  items={[
                    { key: 'labor', label: t('cushionPricing.tabLabor'), children: <SetTables seat={s} back={toBackSection(r)} group="labor" /> },
                    { key: 'insert', label: t('cushionPricing.tabInserts'), children: <SetTables seat={s} back={toBackSection(r)} group="insert" /> },
                    {
                      key: 'yards',
                      label: t('cushionPricing.tabYardage'),
                      children: (
                        <>
                          <YardStats s={s} title={toBackSection(r) ? t('cushionPricing.seat') : undefined} />
                          {toBackSection(r) && <YardStats s={toBackSection(r)!} title={t('cushionPricing.ib')} />}
                        </>
                      ),
                    },
                    {
                      key: 'er',
                      label: t('cushionPricing.tabEr'),
                      children: <EstimateRocket row={r} section={s} update={(patch) => update(r.id, patch)} />,
                    },
                  ]}
                />
              ) : (
                <Typography.Text type="secondary">{t('cushionPricing.fillIn')}</Typography.Text>
              )}
            </Card>
          )
        })}

        <Button type="dashed" block size="large" icon={<PlusOutlined />} onClick={() => setRows((rs) => [...rs, blank()])}>
          {t('cushionPricing.add')}
        </Button>

        <Card title={t('cushionPricing.quoteTitle')}>
          <Typography.Paragraph type="secondary">{t('cushionPricing.quoteHelp')}</Typography.Paragraph>
          {quote.lines.length > 0 && (
            <Table
              size="small"
              pagination={false}
              style={{ marginTop: 16 }}
              dataSource={quote.lines}
              columns={[
                { title: t('cushionPricing.name'), dataIndex: 'name' },
                { title: t('cushionCut.qty'), dataIndex: 'qty', align: 'center', width: 56 },
                { title: t('cushionPricing.addOnsCol'), dataIndex: 'addOns', align: 'right', render: (n: number) => (n ? money(n) : '—') },
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
                  render: (_: unknown, l: { yardsEach: number; yards: number; qty: number; seatYards: number; backYards: number }) =>
                    l.backYards ? (
                      <>
                        <div>{t('cushionPricing.ydSeat', { n: l.seatYards * l.qty })}</div>
                        <div>{t('cushionPricing.ydBack', { n: l.backYards * l.qty })}</div>
                      </>
                    ) : (
                      <>
                        <div>{t('cushionPricing.ydEach', { n: l.yardsEach })}</div>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {t('cushionPricing.ydTotal', { n: l.yards })}
                        </Typography.Text>
                      </>
                    ),
                },
              ]}
            />
          )}
          {(quote.plywood.pieces > 0 || quote.plywood.tooBig.length > 0) && <PlywoodSheets plan={quote.plywood} />}
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
              <Statistic title={t('cushionPricing.fabricTotal')} value={quote.yards} suffix={t('calc.yd')} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {quote.lines.length === 1
                  ? t('cushionPricing.fabricEachOne', { each: quote.lines[0].yardsEach, qty: quote.lines[0].qty })
                  : t('cushionPricing.fabricEachMany')}
              </Typography.Text>
            </Col>
          </Row>
        </Card>

        <Popconfirm title={t('cushionPricing.clearConfirm')} okText={t('cushionCut.clear')} cancelText={t('common.cancel')} onConfirm={() => setRows([blank()])}>
          <Button size="large" danger>
            {t('cushionCut.clear')}
          </Button>
        </Popconfirm>
      </Space>
    </div>
  )
}
