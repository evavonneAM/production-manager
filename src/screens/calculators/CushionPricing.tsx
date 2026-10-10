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
  INSERT_NAMES,
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
  length: string
  seatD: string
  seatH: string
  ibD: string
  ibH: string
  // Estimate Rocket text
  erConfirmed: boolean
  erStyle: string
  erSeatInsert: string
  erBackInsert: string
  erReversible: boolean
  erFabric: string
  erDirection: 'tbd' | 'upTheRoll' | 'railroaded'
  erCenter: string
  erContrastWelt: boolean
  erWeltFabric: string
}
type Section = { length: number; qty: number; seat: { d: number; h: number } | null; ib: { d: number; h: number } | null }

const DRAFT_KEY = 'pm-calc-cushion-pricing'
let nextId = 1
const blank = (patch: Partial<Row> = {}): Row => ({
  id: nextId++,
  name: '',
  qty: 1,
  length: '',
  seatD: '',
  seatH: '',
  ibD: '',
  ibH: '',
  erConfirmed: false,
  erStyle: 'To Be Determined',
  erSeatInsert: 'tbd',
  erBackInsert: 'tbd',
  erReversible: true,
  erFabric: '',
  erDirection: 'tbd',
  erCenter: '',
  erContrastWelt: false,
  erWeltFabric: '',
  ...patch,
})

function loadDraft(): Row[] {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Row[] | null
    if (Array.isArray(saved) && saved.length)
      return saved.map((r) => {
        const row = { ...blank(), ...r, id: nextId++ }
        if (!['tbd', 'upTheRoll', 'railroaded'].includes(row.erDirection)) row.erDirection = 'tbd'
        return row
      })
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return [blank()]
}

/** Rows copied from the spreadsheet: Name, Qty, Length, Seat D, Seat H, IB D, IB H (tab-separated). */
function parsePasted(text: string): Row[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.split('\t').map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean))
    .filter((cells) => cells.slice(2).some((c) => parseInches(c) !== null))
    .map(([name = '', qty = '', length = '', seatD = '', seatH = '', ibD = '', ibH = '']) =>
      blank({ name, qty: Math.max(1, parseInt(qty) || 1), length, seatD, seatH, ibD, ibH }),
    )
}

const pair = (d: string, h: string) => {
  const dd = parseInches(d)
  const hh = parseInches(h)
  return dd !== null && hh !== null && dd > 0 && hh > 0 ? { d: dd, h: hh } : null
}

function toSection(r: Row): Section | null {
  const length = parseInches(r.length)
  if (length === null || length <= 0) return null
  const seat = pair(r.seatD, r.seatH)
  const ib = pair(r.ibD, r.ibH)
  if (!seat && !ib) return null
  return { length, qty: Math.max(1, r.qty || 1), seat, ib }
}

const priceFor = (o: PriceOption, s: Section, part: 'seat' | 'ib') => {
  const p = s[part]
  return p ? o.price(s.length, p.d, p.h) : null
}

function InchField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  const bad = value.trim() !== '' && parseInches(value) === null
  return (
    <Form.Item label={label} htmlFor={id} validateStatus={bad ? 'error' : undefined} help={bad ? t('calc.badInches') : undefined} style={{ marginBottom: 16 }}>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" suffix={t('calc.in')} size="large" />
    </Form.Item>
  )
}

function PriceTable({ section, group }: { section: Section; group: PriceGroup }) {
  const { t } = useTranslation()
  const tooThick = (o: PriceOption, part: 'seat' | 'ib') => {
    const p = section[part]
    if (!p) return false
    return (o.maxBox !== undefined && p.h > o.maxBox) || (o.maxDiameter !== undefined && p.h > o.maxDiameter)
  }
  const cell = (o: PriceOption, part: 'seat' | 'ib') => {
    const v = priceFor(o, section, part)
    if (v === null) return <Typography.Text type="secondary">—</Typography.Text>
    return (
      <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
        <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(v)}</Typography.Text>
        {tooThick(o, part) && <Tag color="error">{t('cushionPricing.overMax')}</Tag>}
      </Space>
    )
  }
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
        { title: t('cushionPricing.seat'), key: 'seat', align: 'right', render: (_: unknown, o: PriceOption) => cell(o, 'seat') },
        { title: t('cushionPricing.ib'), key: 'ib', align: 'right', render: (_: unknown, o: PriceOption) => cell(o, 'ib') },
      ]}
    />
  )
}

/** Estimate Rocket description for one cushion part, ready to copy. */
function EstimateRocket({ row, section, update }: { row: Row; section: Section; update: (patch: Partial<Row>) => void }) {
  const { t } = useTranslation()
  const [msg, ctx] = message.useMessage()
  const insertOptions = Object.entries(INSERT_NAMES).map(([value, label]) => ({ value, label }))
  const yards = row.erReversible ? yardageReversible(section.length) : yardageNonReversible(section.length)
  const parts = (
    [
      ['seat', 'Seat Insert', section.seat, row.erSeatInsert],
      ['ib', 'Back Insert', section.ib, row.erBackInsert],
    ] as const
  ).filter(([, , p]) => p !== null)

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
          {section.seat && (
            <Col xs={24} sm={12}>
              <Form.Item label={t('cushionPricing.erSeatInsert')} htmlFor={`er-si-${row.id}`} style={{ marginBottom: 12 }}>
                <Select id={`er-si-${row.id}`} value={row.erSeatInsert} onChange={(v) => update({ erSeatInsert: v })} options={insertOptions} />
              </Form.Item>
            </Col>
          )}
          {section.ib && (
            <Col xs={24} sm={12}>
              <Form.Item label={t('cushionPricing.erBackInsert')} htmlFor={`er-bi-${row.id}`} style={{ marginBottom: 12 }}>
                <Select id={`er-bi-${row.id}`} value={row.erBackInsert} onChange={(v) => update({ erBackInsert: v })} options={insertOptions} />
              </Form.Item>
            </Col>
          )}
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
          <Col xs={24}>
            <Checkbox checked={row.erReversible} onChange={(e) => update({ erReversible: e.target.checked })} style={{ marginBottom: 12 }}>
              {t('cushionPricing.reversibleFabric')}
            </Checkbox>
          </Col>
        </Row>
      </Form>
      {parts.map(([key, label, p, insert]) => {
        const text = estimateRocketText({
          qty: section.qty,
          width: formatInches(section.length),
          depth: formatInches(p!.d),
          height: formatInches(p!.h),
          confirmed: row.erConfirmed,
          sewingStyle: row.erStyle,
          insertLabel: label,
          insert,
          yardsPerItem: yards,
          fabric: row.erFabric,
          direction: row.erDirection,
          center: row.erCenter,
          contrastWelt: row.erContrastWelt,
          weltFabric: row.erWeltFabric,
        })
        return (
          <Card
            key={key}
            size="small"
            type="inner"
            title={t(`cushionPricing.${key}`)}
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
  const [laborId, setLaborId] = useState('customFoam')
  const [insertId, setInsertId] = useState('none')
  const [reversible, setReversible] = useState(true)

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
    const each = (id: string, s: Section) => {
      const o = PRICE_OPTIONS.find((x) => x.id === id)
      return o ? (priceFor(o, s, 'seat') ?? 0) + (priceFor(o, s, 'ib') ?? 0) : 0
    }
    const lines = rows.flatMap((r, i) => {
      const s = sections[i]
      if (!s) return []
      const labor = each(laborId, s)
      const insert = each(insertId, s)
      const yardsEach = wholeYards(reversible ? yardageReversible(s.length) : yardageNonReversible(s.length))
      return [{ key: r.id, name: r.name.trim() || t('cushionPricing.sectionN', { n: i + 1 }), qty: s.qty, labor, insert, each: labor + insert, total: (labor + insert) * s.qty, yardsEach, yards: yardsEach * s.qty }]
    })
    const sum = (k: 'total' | 'yards') => lines.reduce((n, l) => n + l[k], 0)
    const labor = lines.reduce((n, l) => n + l.labor * l.qty, 0)
    const insert = lines.reduce((n, l) => n + l.insert * l.qty, 0)
    return { lines, labor, insert, total: sum('total'), yards: sum('yards') }
  }, [rows, sections, laborId, insertId, reversible, t])

  const addPasted = () => {
    const pasted = parsePasted(paste)
    if (!pasted.length) return
    setRows((rs) => [...rs.filter((r) => r.name || r.length), ...pasted])
    setPaste('')
  }

  const optionLabel = (o: PriceOption) => t(`cushionPricing.opt_${o.id}`)

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
                    placeholder={'3A\t1\t74\t25\t4\t24\t6'}
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
              title={r.name.trim() || t('cushionPricing.sectionN', { n: i + 1 })}
              extra={
                rows.length > 1 && (
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('cushionPricing.remove')} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
                )
              }
            >
              <Form layout="vertical" component="div">
                <Row gutter={12}>
                  <Col xs={24} sm={10}>
                    <Form.Item label={t('cushionPricing.name')} htmlFor={`name-${r.id}`} style={{ marginBottom: 16 }}>
                      <Input id={`name-${r.id}`} size="large" allowClear value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} placeholder="3A" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Item label={t('cushionCut.howMany')} htmlFor={`qty-${r.id}`} style={{ marginBottom: 16 }}>
                      <InputNumber id={`qty-${r.id}`} size="large" min={1} precision={0} value={r.qty} onChange={(v) => update(r.id, { qty: v ?? 1 })} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={8}>
                    <InchField id={`len-${r.id}`} label={t('cushionPricing.length')} value={r.length} onChange={(v) => update(r.id, { length: v })} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <InchField id={`sd-${r.id}`} label={t('cushionPricing.seatD')} value={r.seatD} onChange={(v) => update(r.id, { seatD: v })} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <InchField id={`sh-${r.id}`} label={t('cushionPricing.seatH')} value={r.seatH} onChange={(v) => update(r.id, { seatH: v })} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <InchField id={`id-${r.id}`} label={t('cushionPricing.ibD')} value={r.ibD} onChange={(v) => update(r.id, { ibD: v })} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <InchField id={`ih-${r.id}`} label={t('cushionPricing.ibH')} value={r.ibH} onChange={(v) => update(r.id, { ibH: v })} />
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

        <Card title={t('cushionPricing.quoteTitle')}>
          <Typography.Paragraph type="secondary">{t('cushionPricing.quoteHelp')}</Typography.Paragraph>
          <Form layout="vertical" component="div">
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item label={t('cushionPricing.tabLabor')} htmlFor="quote-labor" style={{ marginBottom: 12 }}>
                  <Select
                    id="quote-labor"
                    size="large"
                    value={laborId}
                    onChange={setLaborId}
                    options={[
                      { value: 'none', label: t('cushionPricing.none') },
                      ...PRICE_OPTIONS.filter((o) => o.group === 'labor').map((o) => ({ value: o.id, label: optionLabel(o) })),
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('cushionPricing.insert')} htmlFor="quote-insert" style={{ marginBottom: 12 }}>
                  <Select
                    id="quote-insert"
                    size="large"
                    value={insertId}
                    onChange={setInsertId}
                    options={[
                      { value: 'none', label: t('cushionPricing.none') },
                      ...PRICE_OPTIONS.filter((o) => o.group === 'insert').map((o) => ({ value: o.id, label: optionLabel(o) })),
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Checkbox checked={reversible} onChange={(e) => setReversible(e.target.checked)}>
              {t('cushionPricing.reversibleFabric')}
            </Checkbox>
          </Form>
          {quote.lines.length > 0 && (
            <Table
              size="small"
              pagination={false}
              style={{ marginTop: 16 }}
              dataSource={quote.lines}
              columns={[
                { title: t('cushionPricing.name'), dataIndex: 'name' },
                { title: t('cushionCut.qty'), dataIndex: 'qty', align: 'center', width: 56 },
                { title: t('cushionPricing.each'), dataIndex: 'each', align: 'right', render: (n: number) => money(n) },
                {
                  title: t('cushionPricing.lineTotal'),
                  dataIndex: 'total',
                  align: 'right',
                  render: (n: number) => <Typography.Text strong>{money(n)}</Typography.Text>,
                },
                { title: t('cushionPricing.fabric'), dataIndex: 'yards', align: 'right', render: (n: number) => `${n} ${t('calc.yd')}` },
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
              <Statistic title={t('cushionPricing.total')} value={money(quote.total)} valueStyle={{ fontWeight: 700 }} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title={t('cushionPricing.fabric')} value={quote.yards} suffix={t('calc.yd')} />
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
