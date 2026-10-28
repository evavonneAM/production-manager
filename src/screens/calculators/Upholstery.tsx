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
import { FURNITURE_PHOTOS } from '../../assets/furniture'
import {
  DEFAULT_RATES,
  INSERT_NAMES,
  MATCH_ORIGINAL,
  USE_EXISTING,
  STYLE_NAMES,
  TYPES,
  UPCHARGES,
  TRIM_UPCHARGES,
  trimInches,
  trimQty,
  skirtFor,
  bandingInches,
  estimate,
  money,
  estimateRocketText,
  type CushionInsert,
  type CushionStyle,
  type Line,
  type Rates,
} from '../../lib/calculators/upholstery'
import { INSERT_NAMES as ER_INSERTS, SEWING_STYLES, slashStyle } from '../../lib/calculators/cushionPricing'
import UpholsteryHistoryCheck from './UpholsteryHistoryCheck'

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
  mohair: boolean
  white: boolean
  channels: boolean
  tufting: boolean
  preshrink: boolean
  /** Checkbox extras: trim, skirt, arm covers, barrel. */
  extras: Record<string, boolean>
  upcharges: Record<string, { qty: number | null; price: number | null }>
  fabric: string
  direction: 'tbd' | 'upTheRoll' | 'railroaded'
  center: string
  // Estimate Rocket template
  according: 'design' | 'designer'
  depth: string
  height: string
  confirmed: boolean
  seatStyle: string
  backStyle: string
  armStyle: string
  seatInsert: string
  backInsert: string
  quotedSolid: boolean
  quotedRailroaded: boolean
}

const TRIM_NEEDS_HEIGHT = new Set(['arm', 'club', 'barrel', 'swivel', 'lounge', 'bergere'])
/** Pieces with arms (arm covers apply). */
const ARMED = new Set(['arm', 'club', 'barrel', 'swivel', 'lounge', 'wing', 'frenchW', 'bergere', 'love', 'sofa'])
/** Extras priced by a count the estimator types in. */
const COUNTED: [string, 'each' | 'pair' | 'ft' | 'piece'][] = [
  ['buttons', 'each'],
  ['ties', 'pair'],
  ['biotick', 'piece'],
]

/** How many of an upcharge the draft asks for: checkboxes become quantities. */
function extraQty(d: Draft, id: string): number {
  if (COUNTED.some(([c]) => c === id)) return d.upcharges[id]?.qty ?? 0
  const kind = (TYPES.find((x) => x.id === d.typeId) ?? TYPES[2]).kind
  if (TRIM_UPCHARGES.includes(id)) {
    const inches = trimInches(d.typeId, parseInches(d.width) ?? 0, parseInches(d.depth) ?? 0, parseInches(d.height) ?? 0)
    return d.extras[id] && inches !== null ? trimQty(inches, UPCHARGES.find((u) => u.id === id)!.unit) : 0
  }
  if (id === skirtFor(kind)) return d.extras.skirt ? 1 : 0
  if (id === 'band') {
    const inches = bandingInches(d.typeId, kind, parseInches(d.width) ?? 0, parseInches(d.depth) ?? 0)
    return d.extras.band && inches !== null ? trimQty(inches, 'Foot') : 0
  }
  if (id === 'armcov') return d.extras.armcov && ARMED.has(d.typeId) ? 1 : 0
  if (id === 'barrel') return d.extras.barrel && kind === 'chair' && d.typeId !== 'barrel' ? 1 : 0
  return 0
}

/** One checkbox line in step 4: name and detail on the left, price on the right. */
function ExtraRow({
  checked,
  disabled,
  onChange,
  label,
  detail,
  amount,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
  label: string
  detail?: string
  amount?: number
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderTop: '1px solid rgba(5,5,5,0.06)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Checkbox checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ flex: 1, minWidth: 0 }}>
        {label}
        {detail && <Typography.Text type="secondary">{` · ${detail}`}</Typography.Text>}
      </span>
      {amount !== undefined && <Typography.Text strong={checked}>{money(amount)}</Typography.Text>}
    </label>
  )
}

const DRAFT_KEY = 'pm-calc-upholstery'
// v2: prices moved to $125/hr. Only rates changed from the defaults are saved,
// so new default prices reach everyone.
const RATES_KEY = 'pm-calc-upholstery-rates-v2'
let nextId = 1

const blankCushion = (prev?: CushionRow): CushionRow => ({
  id: nextId++,
  name: '',
  qty: 1,
  w: prev?.w ?? '',
  d: prev?.d ?? '',
  h: prev?.h ?? '',
  style: prev?.style ?? 'clean',
  insert: prev?.insert ?? 'foam',
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
  mohair: false,
  white: false,
  channels: false,
  tufting: false,
  preshrink: false,
  extras: {},
  upcharges: {},
  fabric: '',
  direction: 'tbd',
  center: '',
  according: 'design',
  depth: '',
  height: '',
  confirmed: false,
  seatStyle: MATCH_ORIGINAL,
  backStyle: MATCH_ORIGINAL,
  armStyle: MATCH_ORIGINAL,
  seatInsert: USE_EXISTING,
  backInsert: USE_EXISTING,
  quotedSolid: true,
  quotedRailroaded: false,
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
  return {
    ...d,
    seatStyle: slashStyle(d.seatStyle),
    backStyle: slashStyle(d.backStyle),
    armStyle: slashStyle(d.armStyle),
    cushions: (d.cushions ?? []).map((c) => {
      const row = { ...blankCushion(), ...c, id: nextId++ }
      // Styles "with foam" are gone: labor is the cover only and foam is the insert.
      const style = row.style as string
      if (style === 'cleanFoam' || style === 'frenchFoam') {
        row.style = style === 'cleanFoam' ? 'clean' : 'french'
        if (!row.insert) row.insert = 'foam'
      }
      return row
    }),
  }
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
      localStorage.setItem(RATES_KEY, JSON.stringify(Object.fromEntries(Object.entries(rates).filter(([k, v]) => DEFAULT_RATES[k as keyof Rates] !== v))))
    } catch {
      // Saving is a convenience only.
    }
  }, [draft, rates])

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setExtra = (id: string, on: boolean) => setDraft((d) => ({ ...d, extras: { ...d.extras, [id]: on } }))
  const upcharge = (id: string) => UPCHARGES.find((u) => u.id === id)!
  const priceOf = (id: string) => draft.upcharges[id]?.price ?? upcharge(id).price
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
          mohair: draft.mohair,
          white: draft.white,
          channels: draft.channels,
          tufting: draft.tufting,
          preshrink: draft.service === 'slip' && draft.preshrink,
          upcharges: Object.fromEntries(
            UPCHARGES.map((u) => [u.id, { qty: extraQty(draft, u.id), price: draft.upcharges[u.id]?.price ?? u.price }]),
          ),
    }),
    [draft],
  )
  const est = useMemo(() => estimate(input, rates), [input, rates])
  const trimIn = trimInches(draft.typeId, parseInches(draft.width) ?? 0, parseInches(draft.depth) ?? 0, parseInches(draft.height) ?? 0)
  const erText = estimateRocketText({
    according: draft.according,
    service: est.service,
    width: draft.width,
    depth: draft.depth,
    height: draft.height,
    confirmed: draft.confirmed,
    seatStyle: draft.seatStyle,
    backStyle: draft.backStyle,
    armStyle: draft.armStyle,
    seatInsert: draft.seatInsert,
    backInsert: draft.backInsert,
    yards: est.yards,
    quotedSolid: draft.quotedSolid,
    quotedRailroaded: draft.quotedRailroaded,
    com: draft.com,
    fabric: draft.fabric,
    direction: draft.direction,
    center: draft.center,
  })
  const styleOptions = [MATCH_ORIGINAL, ...SEWING_STYLES].map((v) => ({ value: v, label: v }))
  const insertOptions = [
    USE_EXISTING,
    ...Object.entries(ER_INSERTS)
      .filter(([k]) => k !== 'existing')
      .map(([, v]) => v),
  ].map((v) => ({ value: v, label: v }))

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
    ['french', 'French mattress cover ($ / in of W)'],
    ['foamRate', 'Foam ($ / board ft)'],
    ['foamFee', 'Foam fee ($ / cushion)'],
    ['outdoorFoamRate', 'Outdoor foam ($ / board ft)'],
    ['pillow', 'Throw pillow ($ each)'],
    ['welt', 'Welting ($ / piece)'],
    ['supplies', 'Upholstery supplies ($ / yard)'],
    ['overUp', 'Oversize upholstery ($ / inch)'],
    ['overSlip', 'Oversize slipcover ($ / inch)'],
    ['pct', 'Mohair / white fabric (%)'],
    ['channelsPct', 'Channels (% of base labor)'],
    ['tuftingPct', 'Tufting (% of base labor)'],
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
                    optionLabelProp="title"
                    options={TYPES.map((x) => ({
                      value: x.id,
                      title: x.name,
                      label: (
                        <Space>
                          <img src={FURNITURE_PHOTOS[x.id]} alt="" width={36} height={36} style={{ objectFit: 'contain', background: '#fff', borderRadius: 4 }} />
                          {x.name}
                        </Space>
                      ),
                    }))}
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
              <Col xs={24} sm={8}>
                <InchField
                  id="u-width"
                  label={t('upholstery.width')}
                  value={draft.width}
                  onChange={(v) => set({ width: v })}
                  help={est.limit ? t('upholstery.oversizeOver', { n: est.limit }) : t('upholstery.oversizeNone')}
                />
              </Col>
              <Col xs={12} sm={8}>
                <InchField id="u-depth" label={t('upholstery.depth')} value={draft.depth} onChange={(v) => set({ depth: v })} />
              </Col>
              <Col xs={12} sm={8}>
                <InchField id="u-height" label={t('upholstery.height')} value={draft.height} onChange={(v) => set({ height: v })} />
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('upholstery.dims')} style={{ marginBottom: 16 }}>
                  <Checkbox checked={draft.confirmed} onChange={(e) => set({ confirmed: e.target.checked })}>
                    {t('cushionPricing.erConfirmed')}
                  </Checkbox>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('upholstery.job')} htmlFor="u-job" style={{ marginBottom: 16 }}>
                  <Input id="u-job" size="large" allowClear value={draft.job} onChange={(e) => set({ job: e.target.value })} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <img
              src={FURNITURE_PHOTOS[type.id]}
              alt={type.name}
              width={120}
              height={120}
              style={{ objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 6, border: '1px solid rgba(0,0,0,.06)' }}
            />
            <Alert style={{ flex: '1 1 260px' }} type="info" showIcon title={type.note + (slipMissing ? ` ${t('upholstery.noSlip')}` : '')} />
          </div>
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
                    cushions: Math.round(est.cushionYards * 100) / 100,
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
              <Col xs={24}>
                <Form.Item label={t('upholstery.quoted')} extra={t('upholstery.quotedHelp')} style={{ marginBottom: 16 }}>
                  <Space size={24} wrap>
                    <Checkbox checked={draft.quotedSolid} onChange={(e) => set({ quotedSolid: e.target.checked })}>
                      {t('upholstery.solid')}
                    </Checkbox>
                    <Checkbox checked={draft.quotedRailroaded} onChange={(e) => set({ quotedRailroaded: e.target.checked })}>
                      {t('cushionCut.railroaded')}
                    </Checkbox>
                  </Space>
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <Typography.Text type="secondary">{t('upholstery.suppliesNote')}</Typography.Text>
        </Step>

        <Step n={4} title={t('upholstery.s4')}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t('upholstery.trimTitle')}
          </Typography.Title>
          {trimIn === null && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 8 }}
              title={t(TRIM_NEEDS_HEIGHT.has(draft.typeId) ? 'upholstery.trimNeedWDH' : 'upholstery.trimNeedWD')}
            />
          )}
          {TRIM_UPCHARGES.map((id) => {
            const u = upcharge(id)
            const qty = trimIn !== null ? trimQty(trimIn, u.unit) : null
            return (
              <ExtraRow
                key={id}
                checked={qty !== null && !!draft.extras[id]}
                disabled={qty === null}
                onChange={(on) => setExtra(id, on)}
                label={u.name}
                detail={qty !== null ? `${qty} ${t(`upholstery.trimUnit.${u.unit === 'Yard' ? 'yd' : 'ft'}`)}` : undefined}
                amount={qty !== null ? qty * priceOf(id) : undefined}
              />
            )
          })}

          {(() => {
            const inches = bandingInches(draft.typeId, type.kind, parseInches(draft.width) ?? 0, parseInches(draft.depth) ?? 0)
            const qty = inches !== null ? trimQty(inches, 'Foot') : null
            return (
              <ExtraRow
                checked={qty !== null && !!draft.extras.band}
                disabled={qty === null}
                onChange={(on) => setExtra('band', on)}
                label={upcharge('band').name}
                detail={qty !== null ? `${qty} ${t('upholstery.trimUnit.ft')}` : undefined}
                amount={qty !== null ? qty * priceOf('band') : undefined}
              />
            )
          })()}

          <Typography.Title level={5}>{t('upholstery.addOnsTitle')}</Typography.Title>
          <ExtraRow
            checked={!!draft.extras.skirt}
            onChange={(on) => setExtra('skirt', on)}
            label={upcharge(skirtFor(type.kind)).name}
            amount={priceOf(skirtFor(type.kind))}
          />
          {ARMED.has(draft.typeId) && (
            <ExtraRow checked={!!draft.extras.armcov} onChange={(on) => setExtra('armcov', on)} label={t('upholstery.armCovers')} amount={priceOf('armcov')} />
          )}
          {type.kind === 'chair' && draft.typeId !== 'barrel' && (
            <ExtraRow checked={!!draft.extras.barrel} onChange={(on) => setExtra('barrel', on)} label={upcharge('barrel').name} amount={priceOf('barrel')} />
          )}
          {est.service === 'slip' && (
            <ExtraRow
              checked={draft.preshrink}
              onChange={(on) => set({ preshrink: on })}
              label={t('upholstery.preshrink')}
              detail={`${est.yards} ${t('upholstery.trimUnit.yd')}`}
              amount={est.yards * priceOf('preshrink')}
            />
          )}
          <ExtraRow checked={draft.channels} onChange={(on) => set({ channels: on })} label={t('upholstery.channelsShort')} detail={t('upholstery.pctBase', { pct: rates.channelsPct })} />
          <ExtraRow checked={draft.tufting} onChange={(on) => set({ tufting: on })} label={t('upholstery.tuftingShort')} detail={t('upholstery.pctBase', { pct: rates.tuftingPct })} />
          <ExtraRow checked={draft.mohair} onChange={(on) => set({ mohair: on })} label={t('upholstery.mohairShort')} detail={t('upholstery.pctLabor', { pct: rates.pct })} />
          <ExtraRow checked={draft.white} onChange={(on) => set({ white: on })} label={t('upholstery.whiteShort')} detail={t('upholstery.pctLabor', { pct: rates.pct })} />

          <Typography.Title level={5}>{t('upholstery.countTitle')}</Typography.Title>
          {COUNTED.map(([id, unitKey]) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderTop: '1px solid rgba(5,5,5,0.06)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{upcharge(id).name}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {money(priceOf(id))} / {t(`upholstery.per.${unitKey}`)}
                </Typography.Text>
              </div>
              <InputNumber
                aria-label={`${upcharge(id).name} ${t('cushionCut.qty')}`}
                min={0}
                placeholder="0"
                value={draft.upcharges[id]?.qty ?? null}
                onChange={(v) => set({ upcharges: { ...draft.upcharges, [id]: { price: draft.upcharges[id]?.price ?? null, qty: v } } })}
                style={{ width: 90 }}
              />
            </div>
          ))}
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
                  <Typography.Title level={5} style={{ marginTop: 20 }}>
                    {t('upholstery.extraPrices')}
                  </Typography.Title>
                  <Row gutter={[12, 12]}>
                    {UPCHARGES.map((u) => (
                      <Col xs={24} sm={12} key={u.id}>
                        <Typography.Text>
                          {u.name} ($ / {u.unit.toLowerCase()})
                        </Typography.Text>
                        <InputNumber
                          min={0}
                          value={priceOf(u.id)}
                          onChange={(v) => set({ upcharges: { ...draft.upcharges, [u.id]: { qty: draft.upcharges[u.id]?.qty ?? null, price: v } } })}
                          style={{ width: '100%', marginTop: 4 }}
                        />
                      </Col>
                    ))}
                  </Row>
                  <Space style={{ marginTop: 12 }} wrap>
                    <Typography.Text type="secondary">{t('upholstery.ratesHelp')}</Typography.Text>
                    <Button
                      size="small"
                      onClick={() => {
                        setRates({ ...DEFAULT_RATES })
                        set({ upcharges: Object.fromEntries(Object.entries(draft.upcharges).map(([k, v]) => [k, { ...v, price: null }])) })
                      }}
                    >
                      {t('upholstery.ratesReset')}
                    </Button>
                  </Space>
                </>
              ),
            },
          ]}
        />

        <Step n={5} title={t('upholstery.s5style')}>
          <Form layout="vertical" component="div">
            <Row gutter={12}>
              <Col xs={24}>
                <Form.Item label={t('upholstery.according')} style={{ marginBottom: 16 }}>
                  <Segmented
                    block
                    value={draft.according}
                    onChange={(v) => set({ according: v as Draft['according'] })}
                    options={[
                      { value: 'design', label: 'Design Specifications' },
                      { value: 'designer', label: 'Designer' },
                    ]}
                  />
                </Form.Item>
              </Col>
              {(
                [
                  ['seatStyle', 'upholstery.seatStyle'],
                  ['backStyle', 'upholstery.backStyle'],
                  ['armStyle', 'upholstery.armStyle'],
                ] as const
              ).map(([k, label]) => (
                <Col xs={24} sm={8} key={k}>
                  <Form.Item label={t(label)} htmlFor={`u-${k}`} extra={k === 'armStyle' ? t('upholstery.armHelp') : undefined} style={{ marginBottom: 16 }}>
                    <Select id={`u-${k}`} size="large" showSearch value={draft[k]} onChange={(v) => set({ [k]: v } as Partial<Draft>)} options={styleOptions} />
                  </Form.Item>
                </Col>
              ))}
              {(
                [
                  ['seatInsert', 'cushionPricing.erSeatInsert'],
                  ['backInsert', 'cushionPricing.erBackInsert'],
                ] as const
              ).map(([k, label]) => (
                <Col xs={24} sm={12} key={k}>
                  <Form.Item label={t(label)} htmlFor={`u-${k}`} style={{ marginBottom: 16 }}>
                    <Select id={`u-${k}`} size="large" value={draft[k]} onChange={(v) => set({ [k]: v } as Partial<Draft>)} options={insertOptions} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        </Step>

        <Step
          n={6}
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
          <UpholsteryHistoryCheck typeId={draft.typeId} service={est.service} width={parseInches(draft.width) ?? 0} labor={est.labor} />
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
