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
import { ArrowLeftOutlined, CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { parseInches } from '../../lib/calculators/inches'
import {
  DEFAULT_RATES,
  INSERT_NAMES,
  STYLE_NAMES,
  TYPES,
  UPCHARGES,
  estimate,
  money,
  estimateRocketText,
  type CushionInsert,
  type CushionStyle,
  type Line,
  type Rates,
} from '../../lib/calculators/upholstery'

type CushionRow = {
  id: number
  name: string
  qty: number
  w: string
  d: string
  h: string
  style: CushionStyle
  insert: CushionInsert
  reversible: boolean
  welt: boolean
  attached: boolean
}

type Draft = {
  job: string
  typeId: string
  service: 'up' | 'slip'
  width: string
  cushions: CushionRow[]
  yards: number | null
  fabricPerYard: number | null
  com: boolean
  cushionYards: boolean
  mohair: boolean
  white: boolean
  upcharges: Record<string, { qty: number | null; price: number | null }>
  fabric: string
  direction: 'tbd' | 'upTheRoll' | 'railroaded'
  center: string
}

const DRAFT_KEY = 'pm-calc-upholstery'
const RATES_KEY = 'pm-calc-upholstery-rates'
let nextId = 1

const blankCushion = (prev?: CushionRow): CushionRow => ({
  id: nextId++,
  name: '',
  qty: 1,
  w: prev?.w ?? '',
  d: prev?.d ?? '',
  h: prev?.h ?? '',
  style: prev?.style ?? 'cleanFoam',
  insert: '',
  reversible: prev?.reversible ?? false,
  welt: false,
  attached: false,
})

const blankDraft = (): Draft => ({
  job: '',
  typeId: 'arm',
  service: 'up',
  width: '',
  cushions: [],
  yards: null,
  fabricPerYard: null,
  com: false,
  cushionYards: true,
  mohair: false,
  white: false,
  upcharges: {},
  fabric: '',
  direction: 'tbd',
  center: '',
})

function load<T extends object>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...(JSON.parse(v) as T) } : fallback
  } catch {
    return fallback
  }
}

function loadDraft(): Draft {
  const d = load(DRAFT_KEY, blankDraft())
  return { ...d, cushions: (d.cushions ?? []).map((c) => ({ ...blankCushion(), ...c, id: nextId++ })) }
}

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

function Step({ n, title, extra, children }: { n: number; title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card
      title={
        <Space>
          <span
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: '#1677ff',
              color: '#fff',
              fontSize: 13,
            }}
          >
            {n}
          </span>
          {title}
        </Space>
      }
      extra={extra}
    >
      {children}
    </Card>
  )
}

/** Upholstery estimate: furniture, cushions, yardage and upcharges in; priced lines and Estimate Rocket text out. */
export default function Upholstery() {
  const { t } = useTranslation()
  const [msg, ctx] = message.useMessage()
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [rates, setRates] = useState<Rates>(() => load(RATES_KEY, { ...DEFAULT_RATES }))

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      localStorage.setItem(RATES_KEY, JSON.stringify(rates))
    } catch {
      // Saving is a convenience only.
    }
  }, [draft, rates])

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setCushion = (id: number, patch: Partial<CushionRow>) =>
    setDraft((d) => ({ ...d, cushions: d.cushions.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

  const input = useMemo(
    () => ({
          typeId: draft.typeId,
          service: draft.service,
          width: parseInches(draft.width) ?? 0,
          cushions: draft.cushions.map((c) => ({
            name: c.name,
            qty: c.qty,
            w: parseInches(c.w) ?? 0,
            d: parseInches(c.d) ?? 0,
            h: parseInches(c.h) ?? 0,
            style: c.style,
            insert: c.insert,
            reversible: c.reversible,
            welt: c.welt,
            attached: c.attached,
          })),
          yards: draft.yards,
          fabricPerYard: draft.fabricPerYard ?? 0,
          com: draft.com,
          cushionYards: draft.cushionYards,
          mohair: draft.mohair,
          white: draft.white,
          upcharges: Object.fromEntries(
            UPCHARGES.map((u) => [u.id, { qty: draft.upcharges[u.id]?.qty ?? 0, price: draft.upcharges[u.id]?.price ?? u.price }]),
          ),
    }),
    [draft],
  )
  const est = useMemo(() => estimate(input, rates), [input, rates])
  const erText = estimateRocketText(est, {
    job: draft.job,
    width: input.width,
    cushions: input.cushions,
    upcharges: input.upcharges,
    mohair: draft.mohair,
    white: draft.white,
    com: draft.com,
    fabric: draft.fabric,
    direction: draft.direction,
    center: draft.center,
  })

  const type = est.type
  const slipMissing = draft.service === 'slip' && type.slip === null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(erText)
      msg.success(t('upholstery.copied'))
    } catch {
      msg.error(t('cushionPricing.copyFailed'))
    }
  }

  const rateFields: [keyof Rates, string][] = [
    ['clean', 'Clean seam cover ($ / in of W)'],
    ['cleanFoam', 'Clean seam with foam ($ / in of W)'],
    ['french', 'French mattress cover ($ / in of W)'],
    ['frenchFoam', 'French mattress with foam ($ / in of W)'],
    ['foamRate', 'Foam ($ / board ft)'],
    ['foamFee', 'Foam fee ($ / cushion)'],
    ['frenchFoamRate', 'French foam ($ / board ft)'],
    ['frenchFoamFee', 'French foam fee ($ / cushion)'],
    ['pillow', 'Throw pillow ($ each)'],
    ['welt', 'Welting ($ / piece)'],
    ['supplies', 'Upholstery supplies ($ / yard)'],
    ['overUp', 'Oversize upholstery ($ / inch)'],
    ['overSlip', 'Oversize slipcover ($ / inch)'],
    ['pct', 'Mohair / white fabric (%)'],
  ]

  // Group estimate lines under section headers.
  const tableRows: (Line & { key: string; header?: boolean })[] = []
  let sec = ''
  est.lines.forEach((l, i) => {
    if (l.section !== sec) {
      sec = l.section
      tableRows.push({ ...l, key: `h-${i}`, header: true })
    }
    tableRows.push({ ...l, key: `l-${i}` })
  })

  return (
    <div style={{ maxWidth: 880, width: '100%', margin: '0 auto', padding: '16px 16px 120px' }}>
      {ctx}
      <Link to="/tools">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('tools.title')}
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
        {t('tools.items.upholstery.name')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('upholstery.intro')}</Typography.Paragraph>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Step
          n={1}
          title={t('upholstery.s1')}
          extra={
            <Popconfirm title={t('upholstery.newConfirm')} okText={t('upholstery.new')} cancelText={t('common.cancel')} onConfirm={() => setDraft(blankDraft())}>
              <Button>{t('upholstery.new')}</Button>
            </Popconfirm>
          }
        >
          <Form layout="vertical" component="div">
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item label={t('upholstery.type')} htmlFor="u-type" style={{ marginBottom: 16 }}>
                  <Select
                    id="u-type"
                    size="large"
                    value={draft.typeId}
                    onChange={(v) => set({ typeId: v })}
                    options={TYPES.map((x) => ({ value: x.id, label: `${x.name} — ${money(x.up)}` }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('upholstery.service')} style={{ marginBottom: 16 }}>
                  <Segmented
                    block
                    size="large"
                    value={draft.service}
                    onChange={(v) => set({ service: v as Draft['service'] })}
                    options={[
                      { value: 'up', label: t('upholstery.upholstery') },
                      { value: 'slip', label: t('upholstery.slipcover') },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <InchField
                  id="u-width"
                  label={t('upholstery.width')}
                  value={draft.width}
                  onChange={(v) => set({ width: v })}
                  help={est.limit ? t('upholstery.oversizeOver', { n: est.limit }) : t('upholstery.oversizeNone')}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('upholstery.job')} htmlFor="u-job" style={{ marginBottom: 16 }}>
                  <Input id="u-job" size="large" allowClear value={draft.job} onChange={(e) => set({ job: e.target.value })} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <Alert type="info" showIcon title={type.note + (slipMissing ? ` ${t('upholstery.noSlip')}` : '')} />
        </Step>

        <Step
          n={2}
          title={t('upholstery.s2')}
          extra={
            <Button icon={<PlusOutlined />} onClick={() => set({ cushions: [...draft.cushions, blankCushion(draft.cushions[draft.cushions.length - 1])] })}>
              {t('upholstery.addCushion')}
            </Button>
          }
        >
          {draft.cushions.length === 0 && <Typography.Paragraph type="secondary">{t('upholstery.noCushions')}</Typography.Paragraph>}
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            {draft.cushions.map((c, i) => (
              <Card
                key={c.id}
                size="small"
                type="inner"
                title={c.name.trim() || t('upholstery.cushionN', { n: i + 1 })}
                extra={
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('upholstery.removeCushion')}
                    onClick={() => set({ cushions: draft.cushions.filter((x) => x.id !== c.id) })}
                  />
                }
              >
                <Form layout="vertical" component="div">
                  <Row gutter={12}>
                    <Col xs={24} sm={16}>
                      <Form.Item label={t('cushionCut.name')} htmlFor={`c-name-${c.id}`} style={{ marginBottom: 16 }}>
                        <Input id={`c-name-${c.id}`} size="large" value={c.name} onChange={(e) => setCushion(c.id, { name: e.target.value })} placeholder={t('cushionCut.namePlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item label={t('cushionCut.howMany')} htmlFor={`c-qty-${c.id}`} style={{ marginBottom: 16 }}>
                        <InputNumber id={`c-qty-${c.id}`} size="large" min={1} precision={0} value={c.qty} onChange={(v) => setCushion(c.id, { qty: v ?? 1 })} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={8}>
                      <InchField id={`c-w-${c.id}`} label={t('upholstery.cw')} value={c.w} onChange={(v) => setCushion(c.id, { w: v })} />
                    </Col>
                    <Col xs={8}>
                      <InchField id={`c-d-${c.id}`} label={t('upholstery.cd')} value={c.d} onChange={(v) => setCushion(c.id, { d: v })} />
                    </Col>
                    <Col xs={8}>
                      <InchField id={`c-h-${c.id}`} label={t('upholstery.ch')} value={c.h} onChange={(v) => setCushion(c.id, { h: v })} />
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('upholstery.style')} htmlFor={`c-style-${c.id}`} style={{ marginBottom: 16 }}>
                        <Select
                          id={`c-style-${c.id}`}
                          size="large"
                          value={c.style}
                          onChange={(v) => setCushion(c.id, { style: v })}
                          options={(Object.keys(STYLE_NAMES) as CushionStyle[]).map((k) => ({ value: k, label: STYLE_NAMES[k] }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('upholstery.insert')} htmlFor={`c-ins-${c.id}`} style={{ marginBottom: 16 }}>
                        <Select
                          id={`c-ins-${c.id}`}
                          size="large"
                          value={c.insert}
                          onChange={(v) => setCushion(c.id, { insert: v })}
                          options={(Object.keys(INSERT_NAMES) as CushionInsert[]).map((k) => ({ value: k, label: INSERT_NAMES[k] }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Space wrap size={[24, 8]}>
                        <Checkbox checked={c.reversible} onChange={(e) => setCushion(c.id, { reversible: e.target.checked })}>
                          {t('cushionPricing.reversible')}
                        </Checkbox>
                        <Checkbox checked={c.welt} onChange={(e) => setCushion(c.id, { welt: e.target.checked })}>
                          {t('upholstery.welt', { price: money(rates.welt) })}
                        </Checkbox>
                        <Checkbox checked={c.attached} onChange={(e) => setCushion(c.id, { attached: e.target.checked })}>
                          {t('upholstery.attached')}
                        </Checkbox>
                      </Space>
                    </Col>
                  </Row>
                </Form>
              </Card>
            ))}
          </Space>
          <Space orientation="vertical" style={{ width: '100%', marginTop: 16 }}>
            <Checkbox checked={draft.com} onChange={(e) => set({ com: e.target.checked })}>
              {t('upholstery.com')}
            </Checkbox>
            <Checkbox checked={draft.cushionYards} onChange={(e) => set({ cushionYards: e.target.checked })}>
              {t('upholstery.cushionYards')}
            </Checkbox>
            <Alert type="warning" showIcon title={t('upholstery.cushionYardsWarn')} />
          </Space>
        </Step>

        <Step n={3} title={t('upholstery.s3')}>
          <Form layout="vertical" component="div">
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={t('upholstery.yards')}
                  htmlFor="u-yards"
                  extra={t('upholstery.yardsHint', {
                    piece: est.pieceYards,
                    cushions: draft.cushionYards ? Math.round(est.cushionYards * 100) / 100 : 0,
                    total: est.yards,
                  })}
                  style={{ marginBottom: 16 }}
                >
                  <InputNumber
                    id="u-yards"
                    size="large"
                    min={0}
                    value={draft.yards}
                    onChange={(v) => set({ yards: v })}
                    placeholder={String(est.pieceYards)}
                    addonAfter={t('calc.yd')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('upholstery.fabricPrice')} htmlFor="u-fab" extra={t('upholstery.fabricPriceHelp')} style={{ marginBottom: 16 }}>
                  <InputNumber id="u-fab" size="large" min={0} value={draft.fabricPerYard} onChange={(v) => set({ fabricPerYard: v })} addonBefore="$" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label={t('cushionPricing.erFabric')} htmlFor="u-fabname" style={{ marginBottom: 16 }}>
                  <Input
                    id="u-fabname"
                    size="large"
                    allowClear
                    disabled={draft.com}
                    value={draft.com ? "Customer's Own Material (COM)" : draft.fabric}
                    onChange={(e) => set({ fabric: e.target.value })}
                    placeholder="To Be Determined (Price Not Included)"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('cushionPricing.erDirection')} style={{ marginBottom: 16 }}>
                  <Segmented
                    block
                    size="large"
                    value={draft.direction}
                    onChange={(v) => set({ direction: v as Draft['direction'] })}
                    options={[
                      { value: 'tbd', label: t('cushionPricing.erTbd') },
                      { value: 'upTheRoll', label: t('cushionCut.upTheRoll') },
                      { value: 'railroaded', label: t('cushionCut.railroaded') },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('cushionPricing.erCenter')} htmlFor="u-center" extra={t('cushionPricing.erCenterHelp')} style={{ marginBottom: 16 }}>
                  <Input id="u-center" size="large" allowClear value={draft.center} onChange={(e) => set({ center: e.target.value })} placeholder={t('cushionPricing.erCenterPlaceholder')} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <Typography.Text type="secondary">{t('upholstery.suppliesNote')}</Typography.Text>
        </Step>

        <Step n={4} title={t('upholstery.s4')}>
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            scroll={{ x: true }}
            dataSource={UPCHARGES}
            columns={[
              {
                title: t('upholstery.item'),
                dataIndex: 'name',
                render: (name: string, u) => (
                  <>
                    <div>{name}</div>
                    {u.note && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{u.note}</Typography.Text>}
                  </>
                ),
              },
              {
                title: t('upholstery.price'),
                key: 'price',
                width: 120,
                render: (_: unknown, u) => (
                  <InputNumber
                    aria-label={`${u.name} price`}
                    min={0}
                    value={draft.upcharges[u.id]?.price ?? u.price}
                    onChange={(v) => set({ upcharges: { ...draft.upcharges, [u.id]: { qty: draft.upcharges[u.id]?.qty ?? null, price: v } } })}
                    style={{ width: '100%' }}
                  />
                ),
              },
              { title: t('upholstery.unit'), dataIndex: 'unit', width: 70 },
              {
                title: t('cushionCut.qty'),
                key: 'qty',
                width: 90,
                render: (_: unknown, u) => (
                  <InputNumber
                    aria-label={`${u.name} quantity`}
                    min={0}
                    value={draft.upcharges[u.id]?.qty ?? null}
                    placeholder="0"
                    onChange={(v) => set({ upcharges: { ...draft.upcharges, [u.id]: { price: draft.upcharges[u.id]?.price ?? null, qty: v } } })}
                    style={{ width: '100%' }}
                  />
                ),
              },
            ]}
          />
          <Space orientation="vertical" style={{ marginTop: 16 }}>
            <Checkbox checked={draft.mohair} onChange={(e) => set({ mohair: e.target.checked })}>
              {t('upholstery.mohair', { pct: rates.pct })}
            </Checkbox>
            <Checkbox checked={draft.white} onChange={(e) => set({ white: e.target.checked })}>
              {t('upholstery.white', { pct: rates.pct })}
            </Checkbox>
          </Space>
        </Step>

        <Collapse
          items={[
            {
              key: 'rates',
              label: t('upholstery.rates'),
              children: (
                <>
                  <Row gutter={[12, 12]}>
                    {rateFields.map(([k, label]) => (
                      <Col xs={24} sm={12} key={k}>
                        <Typography.Text>{label}</Typography.Text>
                        <InputNumber min={0} value={rates[k]} onChange={(v) => setRates((r) => ({ ...r, [k]: v ?? 0 }))} style={{ width: '100%', marginTop: 4 }} />
                      </Col>
                    ))}
                  </Row>
                  <Space style={{ marginTop: 12 }} wrap>
                    <Typography.Text type="secondary">{t('upholstery.ratesHelp')}</Typography.Text>
                    <Button size="small" onClick={() => setRates({ ...DEFAULT_RATES })}>
                      {t('upholstery.ratesReset')}
                    </Button>
                  </Space>
                </>
              ),
            },
          ]}
        />

        <Step
          n={5}
          title={t('upholstery.s5')}
          extra={
            <Button type="primary" icon={<CopyOutlined />} onClick={copy}>
              {t('upholstery.copy')}
            </Button>
          }
        >
          <Table
            size="small"
            pagination={false}
            scroll={{ x: true }}
            dataSource={tableRows}
            columns={[
              {
                title: t('upholstery.qbItem'),
                dataIndex: 'item',
                onCell: (r) => ({ colSpan: r.header ? 5 : 1 }),
                render: (v: string, r) => (r.header ? <Typography.Text strong>{r.section}</Typography.Text> : v),
              },
              { title: t('upholstery.desc'), dataIndex: 'desc', onCell: (r) => ({ colSpan: r.header ? 0 : 1 }) },
              {
                title: t('cushionCut.qty'),
                dataIndex: 'qty',
                align: 'right',
                onCell: (r) => ({ colSpan: r.header ? 0 : 1 }),
                render: (n: number) => Math.round(n * 100) / 100,
              },
              { title: t('upholstery.rate'), dataIndex: 'rate', align: 'right', onCell: (r) => ({ colSpan: r.header ? 0 : 1 }), render: (n: number) => money(n) },
              {
                title: t('upholstery.amount'),
                dataIndex: 'amount',
                align: 'right',
                onCell: (r) => ({ colSpan: r.header ? 0 : 1 }),
                render: (n: number) => <Typography.Text strong>{money(n)}</Typography.Text>,
              },
            ]}
          />
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={12} sm={4}>
              <Statistic title={t('upholstery.labor')} value={money(est.labor)} valueStyle={{ fontSize: 18 }} />
            </Col>
            <Col xs={12} sm={4}>
              <Statistic title={t('upholstery.foam')} value={money(est.foam)} valueStyle={{ fontSize: 18 }} />
            </Col>
            <Col xs={12} sm={5}>
              <Statistic title={t('upholstery.fabric')} value={money(est.fabric)} valueStyle={{ fontSize: 18 }} />
            </Col>
            <Col xs={12} sm={5}>
              <Statistic title={t('upholstery.supplies')} value={money(est.supplies)} valueStyle={{ fontSize: 18 }} />
            </Col>
            <Col xs={24} sm={6}>
              <Statistic title={t('upholstery.total')} value={money(est.total)} valueStyle={{ fontSize: 22, fontWeight: 700 }} />
            </Col>
          </Row>
          <Collapse
            style={{ marginTop: 16 }}
            items={[
              {
                key: 'er',
                label: t('upholstery.erPreview'),
                children: <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>{erText}</pre>,
              },
            ]}
          />
        </Step>
      </Space>
    </div>
  )
}
