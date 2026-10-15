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
import {
  ADD_ONS,
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
import { cents, erToPlain, type NewLine } from '../../lib/estimates'
import { AddToEstimate } from '../../components/AddToEstimate'

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
  labor: 'customFoam',
  insert: 'tbd',
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
 * Rows copied from the spreadsheet: Name, Qty, Length, Depth, Thickness
 * (tab-separated). The old 7-column layout (with inside back height and
 * thickness) becomes a seat cushion plus a back cushion.
 */
function parsePasted(text: string): Row[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.split('\t').map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean))
    .filter((cells) => cells.slice(2).some((c) => parseInches(c) !== null))
    .flatMap(([name = '', qty = '', length = '', d = '', h = '', ibD = '', ibH = '']) => {
      const base = { name, qty: Math.max(1, parseInt(qty) || 1), length }
      const out = [blank({ ...base, depth: d, thickness: h })]
      if (ibD || ibH) out.push(blank({ ...base, name: name ? `${name} back` : '', part: 'back', depth: ibD, thickness: ibH }))
      return out
    })
}

function toSection(r: Row): Section | null {
  const length = parseInches(r.length)
  const d = parseInches(r.depth)
  const h = parseInches(r.thickness)
  if (length === null || d === null || h === null || length <= 0 || d <= 0 || h <= 0) return null
  return { length, qty: Math.max(1, r.qty || 1), d, h }
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

/** The Estimate Rocket description for one cushion card. */
function erTextFor(row: Row, section: Section): string {
  return estimateRocketText({
    qty: section.qty,
    width: formatInches(section.length),
    depth: formatInches(section.d),
    height: formatInches(section.h),
    confirmed: row.erConfirmed,
    sewingStyle: row.erStyle,
    insertLabel: row.part === 'back' ? 'Back Insert' : 'Seat Insert',
    insert: row.insert,
    yardsPerItem: row.erReversible ? yardageReversible(section.length) : yardageNonReversible(section.length),
    fabric: row.erFabric,
    direction: row.erDirection,
    center: row.erCenter,
    contrastWelt: row.erContrastWelt,
    weltFabric: row.erWeltFabric,
  })
}

/** Estimate Rocket description for one cushion part, ready to copy. */
function EstimateRocket({ row, section, update }: { row: Row; section: Section; update: (patch: Partial<Row>) => void }) {
  const { t } = useTranslation()
  const [msg, ctx] = message.useMessage()
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
            <Form.Item label={t('cushionPricing.erFabric')} htmlFor={`er-fab-${row.id}`} style={{ marginBottom: 12 }}>
              <Input id={`er-fab-${row.id}`} allowClear value={row.erFabric} onChange={(e) => update({ erFabric: e.target.value })} placeholder="To Be Determined (Price Not Included)" />
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
        const text = erTextFor(row, section)
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
      const labor = price(r.labor, s)
      const insert = price(r.insert, s)
      const addOns = sectionAddOns(r, labor)
      const eachPrice = labor + insert + addOns
      const yardsEach = wholeYards(r.erReversible ? yardageReversible(s.length) : yardageNonReversible(s.length))
      return [
        {
          key: r.id,
          name: r.name.trim() || t('cushionPricing.cushionN', { n: i + 1 }),
          qty: s.qty,
          labor,
          insert,
          addOns,
          each: eachPrice,
          total: eachPrice * s.qty,
          yardsEach,
          yards: yardsEach * s.qty,
        },
      ]
    })
    const sum = (k: 'total' | 'yards') => lines.reduce((n, l) => n + l[k], 0)
    const labor = lines.reduce((n, l) => n + l.labor * l.qty, 0)
    const insert = lines.reduce((n, l) => n + l.insert * l.qty, 0)
    const addOns = lines.reduce((n, l) => n + l.addOns * l.qty, 0)
    return { lines, labor, insert, addOns, total: sum('total'), yards: sum('yards') }
  }, [rows, sections, t])

  // Every priced cushion as one estimate line, with its Estimate Rocket text
  // (made plain) as the client-facing description.
  const estimateLines = (): NewLine[] =>
    rows.flatMap((r, i) => {
      const s = sections[i]
      const l = quote.lines.find((x) => x.key === r.id)
      if (!s || !l) return []
      return [
        {
          section: 'Cushions',
          name: `${l.name} – ${r.part === 'back' ? 'Back cushion' : 'Seat cushion'}`,
          description: erToPlain(erTextFor(r, s)),
          quantity: l.qty,
          unit: 'ea',
          unit_price: cents(l.each),
          source: 'cushionPricing',
        },
      ]
    })

  const addPasted = () => {
    const pasted = parsePasted(paste)
    if (!pasted.length) return
    setRows((rs) => [...rs.filter((r) => r.name || r.length), ...pasted])
    setPaste('')
  }

  const optionLabel = (o: PriceOption) => t(`cushionPricing.opt_${o.id}`)
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
                </Row>
                <Row gutter={12}>
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
                    <Form.Item label={t('cushionPricing.insert')} htmlFor={`ins-${r.id}`} style={{ marginBottom: 16 }}>
                      <Select id={`ins-${r.id}`} size="large" value={r.insert} onChange={(v) => update(r.id, { insert: v })} options={insertOptions} />
                    </Form.Item>
                  </Col>
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
                    { key: 'labor', label: t('cushionPricing.tabLabor'), children: <PriceTable section={s} group="labor" /> },
                    { key: 'insert', label: t('cushionPricing.tabInserts'), children: <PriceTable section={s} group="insert" /> },
                    {
                      key: 'yards',
                      label: t('cushionPricing.tabYardage'),
                      children: (
                        <Row gutter={16}>
                          <Col span={12}>
                            <Statistic title={t('cushionPricing.reversible')} value={wholeYards(yardageReversible(s.length)) * s.qty} suffix={t('calc.yd')} />
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {t('cushionPricing.yardsEach', { n: wholeYards(yardageReversible(s.length)), exact: yardageReversible(s.length).toFixed(2) })}
                            </Typography.Text>
                          </Col>
                          <Col span={12}>
                            <Statistic title={t('cushionPricing.nonReversible')} value={wholeYards(yardageNonReversible(s.length)) * s.qty} suffix={t('calc.yd')} />
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {t('cushionPricing.yardsEach', { n: wholeYards(yardageNonReversible(s.length)), exact: yardageNonReversible(s.length).toFixed(2) })}
                            </Typography.Text>
                          </Col>
                        </Row>
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

        <Card title={t('cushionPricing.quoteTitle')} extra={<AddToEstimate lines={estimateLines} disabled={quote.lines.length === 0} />}>
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
                  render: (_: unknown, l: { yardsEach: number; yards: number }) => (
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
