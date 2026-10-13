import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Col, Form, Input, InputNumber, Popconfirm, Row, Space, Statistic, Typography, theme } from 'antd'
import { ArrowLeftOutlined, FilePdfOutlined } from '@ant-design/icons'
import { formatInches, parseInches } from '../../lib/calculators/inches'
import { DEFAULT_LEAD, DEFAULT_PLEATS, DEFAULT_RETURN, pleatLayout, segments, type PleatLayout } from '../../lib/calculators/draperyPleat'
import { downloadPleatWorkOrder } from '../../lib/calculators/draperyPleatPdf'

type Draft = { job: string; name: string; hemmed: string; finished: string; ret: string; lead: string; pleats: number }

const DRAFT_KEY = 'pm-calc-drapery-pleat'
const blank = (): Draft => ({
  job: '',
  name: '',
  hemmed: '',
  finished: '',
  ret: formatInches(DEFAULT_RETURN).replace('"', ''),
  lead: formatInches(DEFAULT_LEAD).replace('"', ''),
  pleats: DEFAULT_PLEATS,
})

function loadDraft(): Draft {
  try {
    const v = localStorage.getItem(DRAFT_KEY)
    return v ? { ...blank(), ...(JSON.parse(v) as Draft) } : blank()
  } catch {
    return blank()
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

/** Flat panel, lead edge on the left: lead | pleat space … pleat | return, with pins. */
function LayoutDiagram({ layout, ret, lead }: { layout: PleatLayout; ret: number; lead: number }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const segs = segments(layout, ret, lead)
  const total = segs.reduce((n, s) => n + s.width, 0)
  const W = 720
  const sc = (W - 2) / total
  const fill = { lead: token.colorPrimaryBg, return: token.colorPrimaryBg, pleat: token.colorWarningBg, space: token.colorSuccessBg }
  const pins = [0, ...segs.filter((s) => s.type === 'pleat').map((s) => s.from + s.width / 2), total]
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} 120`} width="100%" style={{ minWidth: 480, display: 'block' }} role="img" aria-label={t('draperyPleat.diagram')}>
        <text x={1} y={14} fontSize={12} fill={token.colorText}>
          {t('draperyPleat.leadEdge')}
        </text>
        <text x={W - 1} y={14} fontSize={12} textAnchor="end" fill={token.colorText}>
          {t('draperyPleat.return')}
        </text>
        {segs.map((s, i) => (
          <g key={i}>
            <rect x={1 + s.from * sc} y={24} width={s.width * sc} height={48} fill={fill[s.type]} stroke={token.colorBorder} />
            {s.width * sc > 26 && (
              <text x={1 + (s.from + s.width / 2) * sc} y={52} fontSize={11} textAnchor="middle" fill={token.colorText}>
                {formatInches(s.width)}
              </text>
            )}
          </g>
        ))}
        {pins.map((x, i) => (
          <g key={`p${i}`}>
            <line x1={1 + x * sc} x2={1 + x * sc} y1={72} y2={84} stroke={token.colorPrimary} />
            <circle cx={1 + x * sc} cy={88} r={4} fill={token.colorPrimary} />
          </g>
        ))}
        <text x={1} y={114} fontSize={11} fill={token.colorTextSecondary}>
          {t('draperyPleat.legend')}
        </text>
      </svg>
    </div>
  )
}

/** Drapery pleat layout for one panel: pleat and space widths, pins, and a work-order PDF. */
export default function DraperyPleat() {
  const { t } = useTranslation()
  const [d, setD] = useState<Draft>(loadDraft)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    } catch {
      // Draft saving is a convenience only.
    }
  }, [d])

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }))
  const nums = useMemo(
    () => ({
      hemmed: parseInches(d.hemmed) ?? 0,
      finished: parseInches(d.finished) ?? 0,
      ret: parseInches(d.ret) ?? 0,
      lead: parseInches(d.lead) ?? 0,
      pleats: d.pleats,
    }),
    [d],
  )
  const layout = useMemo(() => pleatLayout(nums), [nums])
  const tooNarrow = !layout && nums.hemmed > 0 && nums.finished > 0 && nums.hemmed <= nums.ret + nums.lead + nums.finished

  const pdf = async () => {
    if (!layout) return
    setBusy(true)
    try {
      await downloadPleatWorkOrder({ name: d.name.trim(), job: d.job.trim(), ...nums, layout })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>
      <Link to="/tools">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('tools.title')}
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
        {t('tools.items.drapery.name')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('draperyPleat.intro')}</Typography.Paragraph>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card title={t('draperyPleat.panel')}>
          <Form layout="vertical" component="div">
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item label={t('cushionCut.workOrder')} htmlFor="dp-job" style={{ marginBottom: 16 }}>
                  <Input id="dp-job" size="large" allowClear value={d.job} onChange={(e) => set({ job: e.target.value })} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t('draperyPleat.name')} htmlFor="dp-name" style={{ marginBottom: 16 }}>
                  <Input id="dp-name" size="large" allowClear value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('draperyPleat.namePlaceholder')} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <InchField id="dp-hemmed" label={t('draperyPleat.hemmed')} help={t('draperyPleat.hemmedHelp')} value={d.hemmed} onChange={(v) => set({ hemmed: v })} />
              </Col>
              <Col xs={24} sm={12}>
                <InchField id="dp-finished" label={t('draperyPleat.finished')} help={t('draperyPleat.finishedHelp')} value={d.finished} onChange={(v) => set({ finished: v })} />
              </Col>
              <Col xs={12} sm={8}>
                <InchField id="dp-return" label={t('draperyPleat.return')} help={t('draperyPleat.defaultIs', { v: formatInches(DEFAULT_RETURN) })} value={d.ret} onChange={(v) => set({ ret: v })} />
              </Col>
              <Col xs={12} sm={8}>
                <InchField id="dp-lead" label={t('draperyPleat.leadEdge')} help={t('draperyPleat.defaultIs', { v: formatInches(DEFAULT_LEAD) })} value={d.lead} onChange={(v) => set({ lead: v })} />
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label={t('draperyPleat.pleats')} htmlFor="dp-pleats" style={{ marginBottom: 16 }}>
                  <InputNumber id="dp-pleats" size="large" min={2} precision={0} value={d.pleats} onChange={(v) => set({ pleats: v ?? DEFAULT_PLEATS })} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card title={t('draperyPleat.results')}>
          {layout ? (
            <>
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8}>
                  <Statistic title={t('draperyPleat.pleatWidth')} value={formatInches(layout.pleatWidth)} valueStyle={{ fontWeight: 700 }} />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic title={t('draperyPleat.spaceWidth')} value={formatInches(layout.spaceWidth)} valueStyle={{ fontWeight: 700 }} />
                </Col>
                <Col xs={8} sm={8}>
                  <Statistic title={t('draperyPleat.pleats')} value={layout.pleats} />
                </Col>
                <Col xs={8} sm={8}>
                  <Statistic title={t('draperyPleat.spaces')} value={layout.spaces} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('draperyPleat.spacesHelp')}
                  </Typography.Text>
                </Col>
                <Col xs={8} sm={8}>
                  <Statistic title={t('draperyPleat.pins')} value={layout.pins} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('draperyPleat.pinsHelp')}
                  </Typography.Text>
                </Col>
              </Row>
              <div style={{ marginTop: 20 }}>
                <LayoutDiagram layout={layout} ret={nums.ret} lead={nums.lead} />
              </div>
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                {t('draperyPleat.adds', { total: formatInches(layout.total), hemmed: formatInches(nums.hemmed) })}
              </Typography.Paragraph>
            </>
          ) : tooNarrow ? (
            <Alert type="error" showIcon title={t('draperyPleat.tooNarrow')} />
          ) : (
            <Typography.Text type="secondary">{t('draperyPleat.fillIn')}</Typography.Text>
          )}
        </Card>

        <Space wrap>
          <Button type="primary" size="large" icon={<FilePdfOutlined />} loading={busy} disabled={!layout} onClick={pdf}>
            {t('draperyPleat.pdf')}
          </Button>
          <Popconfirm title={t('draperyPleat.clearConfirm')} okText={t('cushionCut.clear')} cancelText={t('common.cancel')} onConfirm={() => setD(blank())}>
            <Button size="large" danger>
              {t('cushionCut.clear')}
            </Button>
          </Popconfirm>
        </Space>
      </Space>
    </div>
  )
}
