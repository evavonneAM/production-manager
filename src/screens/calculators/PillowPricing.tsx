import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Checkbox, Col, Form, Input, InputNumber, Popconfirm, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  INSERT_NAMES,
  PILLOW_ADD_ONS,
  PILLOW_LABOR,
  STANDARD_SIZES,
  insertMax,
  money,
  pillowPieces,
  pillowPrice,
  pillowYards,
  sizeText,
  styleText,
  type Pillow,
  type PillowInsert,
  type PillowShape,
  type PillowStyle,
} from '../../lib/calculators/pillowPricing'
import { cents, type NewLine } from '../../lib/estimates'
import { AddToEstimate, EstimateLinkBanner } from '../../components/AddToEstimate'
import { useEstimateLink } from '../../lib/estimateLink'

type Row = Pillow & {
  id: number
  name: string
  qty: number
  fabric: string
  contrastFabric: string
  com: boolean
}

const DRAFT_KEY = 'pm-calc-pillow-pricing'
let nextId = 1
const blank = (patch: Partial<Row> = {}): Row => ({
  id: nextId++,
  name: '',
  qty: 1,
  shape: 'square',
  w: 20,
  d: 20,
  style: 'knifeEdge',
  trim: 'self',
  flange: 2,
  insert: 'goose',
  outdoorTick: false,
  fabric: '',
  contrastFabric: '',
  com: false,
  ...patch,
})

function loadDraft(): Row[] {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Row>[] | null
    if (Array.isArray(saved) && saved.length) return saved.map((r) => blank({ ...r, id: nextId++ }))
  } catch {
    // Draft saving is a convenience only.
  }
  return [blank()]
}

const usesContrast = (r: Row) => r.trim === 'contrast' && r.style !== 'knifeEdge'
const fabricName = (r: Row) => (r.com ? 'COM' : r.fabric.trim())

/** Each pillow's own yards (rounded up on its own) of its body and contrast fabric. */
function rowYards(r: Row, label: string) {
  const { body, contrast, cordingInches } = pillowPieces(r, Math.max(1, r.qty), label)
  const contrastWelt = usesContrast(r) && r.style !== 'flange'
  const bodyPlan = pillowYards(body, contrastWelt ? 0 : cordingInches)
  const contrastPlan = usesContrast(r) ? pillowYards(contrast, contrastWelt ? cordingInches : 0) : null
  return { body: bodyPlan?.orderYards ?? 0, contrast: contrastPlan?.orderYards ?? 0 }
}

/** Pillow pricing: $125 labor + insert + add-ons each, fabric yards from the cut pieces. Admins only. */
export default function PillowPricing() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[]>(loadDraft)
  const est = useEstimateLink((input) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify((input as { rows?: unknown })?.rows ?? []))
    } catch {
      // Draft saving is a convenience only.
    }
    setRows(loadDraft())
  })

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rows))
    } catch {
      // Draft saving is a convenience only.
    }
  }, [rows])

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const quote = useMemo(() => {
    const lines = rows
      .map((r, i) => {
        if (!(r.w > 0) || (r.shape === 'bolster' && !(r.d > 0)) || (r.shape === 'square' && !(r.d > 0))) return null
        const label = r.name.trim() || t('pillowPricing.pillowN', { n: i + 1 })
        const price = pillowPrice(r)
        const max = insertMax(r.shape, r.insert)
        const dia = r.shape === 'bolster' ? r.d : r.shape === 'round' ? r.w : 0
        return { key: r.id, row: r, label, ...price, total: price.each * r.qty, yards: rowYards(r, label), tooBig: max !== null && dia > max }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
    return { lines, total: lines.reduce((n, l) => n + l.total, 0) }
  }, [rows, t])

  const estimateLines = (): NewLine[] =>
    quote.lines.map((l) => {
      const r = l.row
      const contrast = usesContrast(r)
      return {
        section: 'Pillows',
        name: l.label,
        description: [
          `• Style: ${styleText(r)}, ${sizeText(r)}`,
          `• Insert: ${INSERT_NAMES[r.insert]}`,
          ...(r.outdoorTick ? ['• Tick: Celeste Bio (outdoor)'] : []),
        ].join('\n'),
        quantity: r.qty,
        unit: 'ea',
        unit_price: cents(l.each),
        source: 'pillowPricing',
        fabric_uses: [
          { fabric_id: null, role: 'Body', yards: l.yards.body, name: fabricName(r) },
          ...(contrast ? [{ fabric_id: null, role: r.style === 'flange' ? 'Flange' : 'Welt', yards: l.yards.contrast, name: r.contrastFabric.trim() }] : []),
        ].filter((u) => u.yards > 0),
      }
    })

  const shapeOpts = [
    { value: 'square', label: t('pillowPricing.shape_square') },
    { value: 'bolster', label: t('pillowPricing.shape_bolster') },
    { value: 'round', label: t('pillowPricing.shape_round') },
  ]
  const styleOpts = (['knifeEdge', 'welted', 'flange', 'butterfly'] as const).map((s) => ({ value: s, label: t(`pillowPricing.style_${s}`) }))

  return (
    <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>
      <Link to="/tools">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('tools.title')}
        </Button>
      </Link>
      <EstimateLinkBanner link={est.link} error={est.error} />
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
        {t('tools.items.pillowPricing.name')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {t('pillowPricing.intro', {
          labor: money(PILLOW_LABOR),
          welt: money(PILLOW_ADD_ONS.welt),
          flange: money(PILLOW_ADD_ONS.contrastFlange),
          tick: money(PILLOW_ADD_ONS.outdoorTick),
        })}
      </Typography.Paragraph>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {rows.map((r, i) => {
          const q = quote.lines.find((l) => l.key === r.id)
          const isSquare = r.shape === 'square'
          return (
            <Card
              key={r.id}
              title={r.name.trim() || t('pillowPricing.pillowN', { n: i + 1 })}
              extra={
                rows.length > 1 && (
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('pillowPricing.remove')} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} />
                )
              }
            >
              <Form layout="vertical" component="div">
                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('pillowPricing.name')} htmlFor={`pn-${r.id}`} style={{ marginBottom: 12 }}>
                      <Input id={`pn-${r.id}`} size="large" value={r.name} placeholder={t('pillowPricing.namePlaceholder')} onChange={(e) => update(r.id, { name: e.target.value })} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Item label={t('pillowPricing.qty')} htmlFor={`pq-${r.id}`} style={{ marginBottom: 12 }}>
                      <InputNumber id={`pq-${r.id}`} size="large" min={1} precision={0} value={r.qty} onChange={(v) => update(r.id, { qty: v ?? 1 })} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Item label={t('pillowPricing.standard')} htmlFor={`ps-${r.id}`} style={{ marginBottom: 12 }}>
                      <Select
                        id={`ps-${r.id}`}
                        size="large"
                        placeholder={t('pillowPricing.pickSize')}
                        value={null}
                        onChange={(v: number) => {
                          const s = STANDARD_SIZES[v]
                          update(r.id, { shape: s.shape, w: s.w, d: s.d })
                        }}
                        options={STANDARD_SIZES.map((s, k) => ({ value: k, label: s.label }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label={t('pillowPricing.shape')} style={{ marginBottom: 12 }}>
                      <Segmented block value={r.shape} onChange={(v) => update(r.id, { shape: v as PillowShape })} options={shapeOpts} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={8}>
                    <Form.Item label={t(isSquare ? 'pillowPricing.width' : r.shape === 'bolster' ? 'pillowPricing.length' : 'pillowPricing.diameter')} style={{ marginBottom: 12 }}>
                      <InputNumber size="large" min={0} value={r.w} onChange={(v) => update(r.id, { w: v ?? 0 })} suffix={t('calc.in')} style={{ width: '100%' }} inputMode="decimal" />
                    </Form.Item>
                  </Col>
                  {r.shape !== 'round' && (
                    <Col xs={12} sm={8}>
                      <Form.Item label={t(isSquare ? 'pillowPricing.height' : 'pillowPricing.diameter')} style={{ marginBottom: 12 }}>
                        <InputNumber size="large" min={0} value={r.d} onChange={(v) => update(r.id, { d: v ?? 0 })} suffix={t('calc.in')} style={{ width: '100%' }} inputMode="decimal" />
                      </Form.Item>
                    </Col>
                  )}
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('pillowPricing.insert')} style={{ marginBottom: 12 }}>
                      <Select
                        size="large"
                        value={r.insert}
                        onChange={(v: PillowInsert) => update(r.id, { insert: v })}
                        options={(['goose', 'wg', 'celeste', 'none'] as const).map((k) => ({ value: k, label: INSERT_NAMES[k] }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('pillowPricing.style')} style={{ marginBottom: 12 }}>
                      <Select
                        size="large"
                        value={r.style}
                        onChange={(v: PillowStyle) => update(r.id, { style: v, trim: v === 'butterfly' ? 'none' : r.trim === 'none' ? 'self' : r.trim })}
                        options={styleOpts}
                      />
                    </Form.Item>
                  </Col>
                  {r.style !== 'knifeEdge' && (
                    <Col xs={24} sm={12}>
                      <Form.Item label={t(r.style === 'flange' ? 'pillowPricing.flangeFabric' : 'pillowPricing.weltFabric')} style={{ marginBottom: 12 }}>
                        <Segmented
                          block
                          value={r.trim}
                          onChange={(v) => update(r.id, { trim: v as Row['trim'] })}
                          options={[
                            ...(r.style === 'butterfly' ? [{ value: 'none', label: t('pillowPricing.noWelt') }] : []),
                            { value: 'self', label: t('pillowPricing.self') },
                            { value: 'contrast', label: t('pillowPricing.contrast') },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  )}
                  {r.style === 'flange' && (
                    <Col xs={12} sm={8}>
                      <Form.Item label={t('pillowPricing.flangeSize')} style={{ marginBottom: 12 }}>
                        <InputNumber size="large" min={0} value={r.flange} onChange={(v) => update(r.id, { flange: v ?? 0 })} suffix={t('calc.in')} style={{ width: '100%' }} inputMode="decimal" />
                      </Form.Item>
                    </Col>
                  )}
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('pillowPricing.fabric')} style={{ marginBottom: 12 }}>
                      <Input size="large" value={r.fabric} disabled={r.com} placeholder="Kravet 34521 Linen, Natural" onChange={(e) => update(r.id, { fabric: e.target.value })} />
                    </Form.Item>
                  </Col>
                  {usesContrast(r) && (
                    <Col xs={24} sm={12}>
                      <Form.Item label={t('pillowPricing.contrastFabricName')} style={{ marginBottom: 12 }}>
                        <Input size="large" value={r.contrastFabric} onChange={(e) => update(r.id, { contrastFabric: e.target.value })} />
                      </Form.Item>
                    </Col>
                  )}
                  <Col xs={24}>
                    <Space wrap size={[24, 8]}>
                      <Checkbox checked={r.com} onChange={(e) => update(r.id, { com: e.target.checked })}>
                        {t('pillowPricing.com')}
                      </Checkbox>
                      <Checkbox checked={r.outdoorTick} onChange={(e) => update(r.id, { outdoorTick: e.target.checked })}>
                        {t('pillowPricing.tick', { price: money(PILLOW_ADD_ONS.outdoorTick) })}
                      </Checkbox>
                    </Space>
                  </Col>
                </Row>
              </Form>
              {q ? (
                <Space wrap size={[24, 8]} style={{ marginTop: 12 }}>
                  <Typography.Text>
                    {t('pillowPricing.each')}: <b>{money(q.each)}</b>
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t('pillowPricing.breakdown', { labor: money(q.labor), insert: money(q.insert), addOns: money(q.addOns) })}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t('pillowPricing.yards', { n: q.yards.body })}
                    {q.yards.contrast ? ` · ${t('pillowPricing.contrastYards', { n: q.yards.contrast })}` : ''}
                  </Typography.Text>
                  {q.tooBig && <Tag color="error">{t('pillowPricing.overMax', { n: insertMax(r.shape, r.insert) })}</Tag>}
                </Space>
              ) : (
                <Typography.Text type="secondary">{t('pillowPricing.fillIn')}</Typography.Text>
              )}
            </Card>
          )
        })}

        <Button type="dashed" block size="large" icon={<PlusOutlined />} onClick={() => setRows((rs) => [...rs, blank()])}>
          {t('pillowPricing.add')}
        </Button>

        <Card
          title={t('pillowPricing.quoteTitle')}
          extra={
            <AddToEstimate
              tool="pillowPricing"
              input={() => ({ rows })}
              link={est.link}
              lines={estimateLines}
              disabled={quote.lines.length === 0 || est.loading}
            />
          }
        >
          {quote.lines.length > 0 && (
            <Table
              size="small"
              pagination={false}
              rowKey="key"
              dataSource={quote.lines}
              scroll={{ x: true }}
              columns={[
                { title: t('pillowPricing.name'), dataIndex: 'label' },
                { title: t('pillowPricing.qty'), key: 'qty', align: 'center', render: (_: unknown, l) => l.row.qty },
                { title: t('pillowPricing.each'), dataIndex: 'each', align: 'right', render: (n: number) => money(n) },
                { title: t('pillowPricing.lineTotal'), dataIndex: 'total', align: 'right', render: (n: number) => <b>{money(n)}</b> },
                {
                  title: t('pillowPricing.fabricCol'),
                  key: 'yd',
                  align: 'right',
                  render: (_: unknown, l) => `${l.yards.body} yd${l.yards.contrast ? ` + ${l.yards.contrast} yd` : ''}`,
                },
              ]}
            />
          )}
          <Statistic title={t('pillowPricing.total')} value={money(quote.total)} style={{ marginTop: 16 }} />
          <Alert type="info" showIcon style={{ marginTop: 16 }} title={t('pillowPricing.yardsNote')} />
        </Card>

        <Popconfirm title={t('pillowPricing.clearConfirm')} okText={t('cushionCut.clear')} cancelText={t('common.cancel')} onConfirm={() => setRows([blank()])}>
          <Button size="large" danger>
            {t('cushionCut.clear')}
          </Button>
        </Popconfirm>
      </Space>
    </div>
  )
}
