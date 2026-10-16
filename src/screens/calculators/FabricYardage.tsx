import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Checkbox,
  Col,
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
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons'
import {
  cushionCuts,
  DEFAULT_HEIGHT_DEDUCTION,
  DEFAULT_LENGTH_DEDUCTION,
  HEIGHT_DEDUCTIONS,
  LENGTH_DEDUCTIONS,
  formatInches,
  parseInches,
  wedgeCuts,
  type AnyCuts,
  type ZipperStyle,
} from '../../lib/calculators/cushionCut'
import {
  CORDING_STRIP_WIDTH,
  DEFAULT_END_ALLOWANCE,
  DEFAULT_GAP,
  DEFAULT_USABLE_WIDTH,
  piecesFor,
  planFabric,
  type Direction,
  type FabricPlan,
  type PlacedCut,
} from '../../lib/calculators/fabricNesting'

type Shape = 'box' | 'wedge'

type Cushion = {
  id: number
  label: string
  fabric: string
  shape: Shape
  qty: number
  front: string
  sides: string
  height: string
  /** Wedge only: the thin end. */
  topDepth: string
  style: ZipperStyle
  heightDeduction: number
  lengthDeduction: number
  cording: boolean
  direction: Direction
}
type Settings = { widths: Record<string, number>; gap: number; endAllowance: number }
type Draft = { cushions: Cushion[]; settings: Settings }

const DRAFT_KEY = 'pm-calc-fabric-yardage'
const CUT_DRAFT_KEY = 'pm-calc-cushion-cut'
let nextId = 1
const blank = (): Cushion => ({
  id: nextId++,
  label: '',
  fabric: '',
  shape: 'box',
  qty: 1,
  front: '',
  sides: '',
  height: '',
  topDepth: '',
  style: 'back',
  heightDeduction: DEFAULT_HEIGHT_DEDUCTION,
  lengthDeduction: DEFAULT_LENGTH_DEDUCTION,
  cording: true,
  direction: 'either',
})
const blankSettings = (): Settings => ({ widths: {}, gap: DEFAULT_GAP, endAllowance: DEFAULT_END_ALLOWANCE })

function loadDraft(): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
    if (saved?.cushions?.length)
      return {
        cushions: saved.cushions.map((c) => ({ ...blank(), ...c, id: nextId++ })),
        settings: { ...blankSettings(), ...saved.settings },
      }
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return { cushions: [blank()], settings: blankSettings() }
}

/** The cushions saved by Cushion Cut Dimensions on this device. */
function loadCutDraft(): Cushion[] {
  try {
    const saved = JSON.parse(localStorage.getItem(CUT_DRAFT_KEY) ?? 'null') as
      | { rows?: Record<string, unknown>[] }
      | Record<string, unknown>[]
      | null
    const rows = Array.isArray(saved) ? saved : (saved?.rows ?? [])
    return rows.map((r) => {
      const dir = r.direction as string | undefined
      return {
        ...blank(),
        label: String(r.label ?? ''),
        fabric: String(r.fabric ?? ''),
        shape: r.shape === 'wedge' ? 'wedge' : 'box',
        qty: Number(r.qty) || 1,
        front: String(r.front ?? ''),
        sides: String(r.sides ?? ''),
        height: String(r.height ?? ''),
        topDepth: String(r.topDepth ?? ''),
        style: r.style === 'wrap' ? 'wrap' : 'back',
        heightDeduction: typeof r.heightDeduction === 'number' ? r.heightDeduction : DEFAULT_HEIGHT_DEDUCTION,
        lengthDeduction: typeof r.lengthDeduction === 'number' ? r.lengthDeduction : DEFAULT_LENGTH_DEDUCTION,
        cording: r.cording !== false,
        direction: dir === 'railroaded' || dir === 'upTheRoll' ? dir : 'either',
      }
    })
  } catch {
    return []
  }
}

function cutsFor(c: Cushion): AnyCuts | null {
  const front = parseInches(c.front)
  const sides = parseInches(c.sides)
  const height = parseInches(c.height)
  const qty = Math.max(1, c.qty || 1)
  if (front === null || sides === null || height === null || height <= 0 || front <= 0 || sides <= 0) return null
  if (c.shape === 'wedge') {
    const top = parseInches(c.topDepth)
    if (top === null || top <= 0 || top > sides || front <= c.lengthDeduction) return null
    return wedgeCuts({ qty, length: front, height, bottom: sides, top, lengthDeduction: c.lengthDeduction, cording: c.cording })
  }
  if (height <= c.heightDeduction) return null
  return cushionCuts({ qty, front, sides, height, style: c.style, heightDeduction: c.heightDeduction, cording: c.cording })
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

const FILLS = ['#d4e3f2', '#f6e3c8', '#d9eedb', '#eedcf2', '#f5d6d6', '#d6eff0', '#ece9cf', '#e2e2e2']
const STROKES = ['#1677ff', '#d48806', '#389e0d', '#9254de', '#cf1322', '#08979c', '#7c6f00', '#595959']

/** The roll unrolled on the cutting table: first end on the left, the roll's width top to bottom. */
function RollDiagram({ plan, cushionIndex, pieceName }: { plan: FabricPlan; cushionIndex: (c: string) => number; pieceName: (n: string) => string }) {
  const { t } = useTranslation()
  const W = plan.width
  const L = plan.totalLength
  const PX = 4 // pixels per inch on screen
  const off = plan.endAllowance
  const cordX = off + plan.piecesLength
  const yards = Math.floor(L / 36 + 1e-9)
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('fabricYardage.diagram')}
      </Typography.Text>
      <div style={{ overflowX: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fafafa', marginTop: 4 }}>
        <svg width={(L + 2) * PX} height={(W + 8) * PX} viewBox={`-1 -6 ${L + 2} ${W + 8}`} role="img" aria-label={t('fabricYardage.diagram')} style={{ display: 'block' }}>
          <rect x={0} y={0} width={L} height={W} fill="#fff" stroke="#555" strokeWidth={0.4} />
          {off > 0 && (
            <g>
              <rect x={0} y={0} width={off} height={W} fill="#e8e8e8" />
              <text x={off / 2} y={W / 2} fontSize={1.6} textAnchor="middle" dominantBaseline="middle" fill="#666" transform={`rotate(-90 ${off / 2} ${W / 2})`}>
                {t('fabricYardage.firstEnd')}
              </text>
            </g>
          )}
          {plan.placed.map((p, k) => {
            const ci = cushionIndex(p.cushion) % FILLS.length
            const x = off + p.y
            const y = p.x
            // On screen the roll runs left to right, so a piece's length along the roll is its width here.
            const w = p.h
            const h = p.w
            const fs = Math.max(1.2, Math.min(3, Math.min(w, h) / 3.2, Math.max(w, h) / 11))
            const vertical = h > w * 1.4
            const cx = x + w / 2
            const cy = y + h / 2
            return (
              <g key={k}>
                <rect x={x} y={y} width={w} height={h} fill={FILLS[ci]} stroke={STROKES[ci]} strokeWidth={0.3} />
                <text x={cx} y={cy} fontSize={fs} textAnchor="middle" fill="#222" transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>
                  <tspan x={cx} dy={-fs * 0.2}>
                    {p.cushion ? `${p.cushion} · ` : ''}
                    {pieceName(p.name)}
                  </tspan>
                  <tspan x={cx} dy={fs * 1.1}>
                    {formatInches(p.turned ? p.along : p.across)} × {formatInches(p.turned ? p.across : p.along)}
                  </tspan>
                </text>
              </g>
            )
          })}
          {plan.cordingLength > 0 && (
            <g>
              <rect x={cordX} y={0} width={plan.cordingLength} height={W} fill="#fff7e6" stroke="#d48806" strokeWidth={0.3} strokeDasharray="1 0.6" />
              <text x={cordX + plan.cordingLength / 2} y={W / 2} fontSize={2} textAnchor="middle" dominantBaseline="middle" fill="#874d00" transform={`rotate(-90 ${cordX + plan.cordingLength / 2} ${W / 2})`}>
                {t('fabricYardage.cordingBlock')}
              </text>
            </g>
          )}
          {Array.from({ length: yards }, (_, i) => (i + 1) * 36).map((x) => (
            <g key={x}>
              <line x1={x} y1={-1.5} x2={x} y2={W} stroke="#ff4d4f" strokeWidth={0.25} strokeDasharray="0.8 0.8" />
              <text x={x} y={-2.4} fontSize={2.2} textAnchor="middle" fill="#cf1322">
                {t('fabricYardage.yd', { n: x / 36 })}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

/** Fabric yardage: cushion cut pieces laid out on the roll, plain fabric (version 1). */
export default function FabricYardage() {
  return (
    <AntApp>
      <FabricYardageScreen />
    </AntApp>
  )
}

function FabricYardageScreen() {
  const { t } = useTranslation()
  const { message } = AntApp.useApp()
  const [initial] = useState(loadDraft)
  const [cushions, setCushions] = useState<Cushion[]>(initial.cushions)
  const [settings, setSettings] = useState<Settings>(initial.settings)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ cushions, settings }))
    } catch {
      // Draft saving is a convenience only.
    }
  }, [cushions, settings])

  const update = (id: number, patch: Partial<Cushion>) => setCushions((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const cuts = useMemo(() => cushions.map(cutsFor), [cushions])

  const fabrics = useMemo(() => {
    const groups = new Map<string, { label: string; idx: number[] }>()
    cushions.forEach((c, i) => {
      if (!cuts[i]) return
      const key = c.fabric.trim()
      if (!groups.has(key)) groups.set(key, { label: key, idx: [] })
      groups.get(key)!.idx.push(i)
    })
    return [...groups.entries()].map(([key, g]) => {
      const width = settings.widths[key] ?? DEFAULT_USABLE_WIDTH
      const pieces = g.idx.flatMap((i) => piecesFor(cuts[i]!, cushions[i].label.trim() || t('fabricYardage.cushionN', { n: i + 1 }), cushions[i].direction))
      const cordingInches = g.idx.reduce((n, i) => n + cuts[i]!.cording, 0)
      const cushionNames = g.idx.map((i) => cushions[i].label.trim() || t('fabricYardage.cushionN', { n: i + 1 }))
      return { key, width, cushionNames, plan: planFabric(pieces, { width, gap: settings.gap, endAllowance: settings.endAllowance, cordingInches }) }
    })
  }, [cushions, cuts, settings, t])

  const pieceName = (n: string) => t(`fabricYardage.piece_${n}`)

  const importCuts = () => {
    const rows = loadCutDraft()
    const complete = rows.filter((r) => cutsFor(r))
    if (!complete.length) {
      message.info(t('fabricYardage.importNone'))
      return
    }
    setCushions(complete)
    message.success(t('fabricYardage.importDone', { count: complete.length }))
  }
  const hasEntries = cushions.some((c) => c.front || c.sides || c.height)

  return (
    <div style={{ maxWidth: 960, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>
      <Link to="/tools" className="no-print">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('tools.title')}
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
        {t('tools.items.fabricYardage.name')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('fabricYardage.intro')}</Typography.Paragraph>

      <Alert
        type="info"
        showIcon
        title={t('fabricYardage.v1Title')}
        description={t('fabricYardage.v1', { end: formatInches(DEFAULT_END_ALLOWANCE), strip: formatInches(CORDING_STRIP_WIDTH) })}
        style={{ marginBottom: 16 }}
      />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {hasEntries ? (
          <Popconfirm title={t('fabricYardage.importConfirm')} okText={t('fabricYardage.replace')} cancelText={t('common.cancel')} onConfirm={importCuts}>
            <Button size="large" icon={<ImportOutlined />} block>
              {t('fabricYardage.import')}
            </Button>
          </Popconfirm>
        ) : (
          <Button size="large" icon={<ImportOutlined />} block onClick={importCuts}>
            {t('fabricYardage.import')}
          </Button>
        )}

        {cushions.map((c, i) => {
          const done = cuts[i]
          return (
            <Card
              key={c.id}
              size="small"
              title={
                <Space size={8} wrap>
                  {c.label.trim() || t('fabricYardage.cushionN', { n: i + 1 })}
                  {c.qty > 1 && <Tag>× {c.qty}</Tag>}
                  {c.fabric.trim() && <Tag color="blue">{c.fabric.trim()}</Tag>}
                </Space>
              }
              extra={
                cushions.length > 1 && (
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('fabricYardage.remove')} onClick={() => setCushions((cs) => cs.filter((x) => x.id !== c.id))} />
                )
              }
            >
              <Form layout="vertical" component="div">
                <Row gutter={12}>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('fabricYardage.name')} htmlFor={`name-${c.id}`} style={{ marginBottom: 16 }}>
                      <Input id={`name-${c.id}`} size="large" value={c.label} placeholder={t('fabricYardage.namePlaceholder')} onChange={(e) => update(c.id, { label: e.target.value })} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label={t('fabricYardage.fabric')} htmlFor={`fabric-${c.id}`} extra={t('fabricYardage.fabricHelp')} style={{ marginBottom: 16 }}>
                      <Input id={`fabric-${c.id}`} size="large" value={c.fabric} placeholder={t('fabricYardage.fabricPlaceholder')} onChange={(e) => update(c.id, { fabric: e.target.value })} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={4}>
                    <Form.Item label={t('fabricYardage.qty')} htmlFor={`qty-${c.id}`} style={{ marginBottom: 16 }}>
                      <InputNumber id={`qty-${c.id}`} size="large" min={1} precision={0} value={c.qty} onChange={(v) => update(c.id, { qty: v ?? 1 })} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('fabricYardage.shape')} style={{ marginBottom: 16 }}>
                      <Segmented
                        block
                        size="large"
                        value={c.shape}
                        onChange={(v) => update(c.id, { shape: v as Shape })}
                        options={[
                          { value: 'box', label: t('fabricYardage.box') },
                          { value: 'wedge', label: t('fabricYardage.wedge') },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={16}>
                    <Form.Item label={t('fabricYardage.direction')} extra={t(`fabricYardage.${c.direction}Help`)} style={{ marginBottom: 16 }}>
                      <Segmented
                        block
                        size="large"
                        value={c.direction}
                        onChange={(v) => update(c.id, { direction: v as Direction })}
                        options={(['either', 'upTheRoll', 'railroaded'] as const).map((d) => ({ value: d, label: t(`fabricYardage.${d}`) }))}
                      />
                    </Form.Item>
                  </Col>
                  {c.shape === 'box' ? (
                    <>
                      <Col xs={8}>
                        <InchField id={`front-${c.id}`} label={t('fabricYardage.front')} value={c.front} onChange={(v) => update(c.id, { front: v })} />
                      </Col>
                      <Col xs={8}>
                        <InchField id={`sides-${c.id}`} label={t('fabricYardage.sides')} value={c.sides} onChange={(v) => update(c.id, { sides: v })} />
                      </Col>
                      <Col xs={8}>
                        <InchField id={`height-${c.id}`} label={t('fabricYardage.height')} value={c.height} onChange={(v) => update(c.id, { height: v })} />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('fabricYardage.zipper')} style={{ marginBottom: 16 }}>
                          <Segmented
                            block
                            size="large"
                            value={c.style}
                            onChange={(v) => update(c.id, { style: v as ZipperStyle })}
                            options={[
                              { value: 'back', label: t('fabricYardage.back') },
                              { value: 'wrap', label: t('fabricYardage.wrap') },
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={8}>
                        <Form.Item label={t('fabricYardage.deduction')} htmlFor={`ded-${c.id}`} style={{ marginBottom: 16 }}>
                          <Select
                            id={`ded-${c.id}`}
                            size="large"
                            value={c.heightDeduction}
                            onChange={(v) => update(c.id, { heightDeduction: v })}
                            options={HEIGHT_DEDUCTIONS.map((d) => ({ value: d, label: `−${formatInches(d)}` }))}
                          />
                        </Form.Item>
                      </Col>
                    </>
                  ) : (
                    <>
                      <Col xs={12} sm={6}>
                        <InchField id={`front-${c.id}`} label={t('fabricYardage.wedgeLength')} value={c.front} onChange={(v) => update(c.id, { front: v })} />
                      </Col>
                      <Col xs={12} sm={6}>
                        <InchField id={`height-${c.id}`} label={t('fabricYardage.height')} value={c.height} onChange={(v) => update(c.id, { height: v })} />
                      </Col>
                      <Col xs={12} sm={6}>
                        <InchField id={`sides-${c.id}`} label={t('fabricYardage.wedgeBottom')} value={c.sides} onChange={(v) => update(c.id, { sides: v })} />
                      </Col>
                      <Col xs={12} sm={6}>
                        <InchField id={`top-${c.id}`} label={t('fabricYardage.wedgeTop')} value={c.topDepth} onChange={(v) => update(c.id, { topDepth: v })} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Form.Item label={t('fabricYardage.deduction')} htmlFor={`lded-${c.id}`} style={{ marginBottom: 16 }}>
                          <Select
                            id={`lded-${c.id}`}
                            size="large"
                            value={c.lengthDeduction}
                            onChange={(v) => update(c.id, { lengthDeduction: v })}
                            options={LENGTH_DEDUCTIONS.map((d) => ({ value: d, label: `−${formatInches(d)}` }))}
                          />
                        </Form.Item>
                      </Col>
                    </>
                  )}
                  <Col xs={12} sm={8}>
                    <Form.Item label={t('fabricYardage.cording')} style={{ marginBottom: 16 }}>
                      <Checkbox checked={c.cording} onChange={(e) => update(c.id, { cording: e.target.checked })}>
                        {t('fabricYardage.hasCording')}
                      </Checkbox>
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
              {!done && <Typography.Text type="secondary">{t('fabricYardage.fillIn')}</Typography.Text>}
            </Card>
          )
        })}

        <Button type="dashed" block size="large" icon={<PlusOutlined />} onClick={() => setCushions((cs) => [...cs, { ...blank(), fabric: cs[cs.length - 1]?.fabric ?? '' }])}>
          {t('fabricYardage.add')}
        </Button>

        <Card size="small">
          <Row gutter={12}>
            <Col xs={12}>
              <Form.Item label={t('fabricYardage.gap')} extra={t('fabricYardage.gapHelp')} style={{ marginBottom: 0 }}>
                <Select
                  size="large"
                  value={settings.gap}
                  onChange={(v) => setSettings((s) => ({ ...s, gap: v }))}
                  options={[0, 0.125, 0.25, 0.5].map((g) => ({ value: g, label: g === 0 ? '0' : formatInches(g) }))}
                />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item label={t('fabricYardage.endAllowance')} style={{ marginBottom: 0 }}>
                <InputNumber size="large" min={0} max={36} step={0.5} value={settings.endAllowance} onChange={(v) => setSettings((s) => ({ ...s, endAllowance: v ?? 0 }))} suffix={t('calc.in')} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {fabrics.length === 0 && <Typography.Text type="secondary">{t('fabricYardage.empty')}</Typography.Text>}

        {fabrics.map(({ key, width, cushionNames, plan }) => {
          const cushionIndex = (name: string) => Math.max(0, cushionNames.indexOf(name))
          // Same piece, same size, same way on the roll: one line with a count.
          const lines = new Map<string, PlacedCut & { qty: number; key: string }>()
          for (const p of plan.placed) {
            const key = [p.cushion, p.name, p.across, p.along, p.turned].join('|')
            const line = lines.get(key)
            if (line) line.qty++
            else lines.set(key, { ...p, qty: 1, key })
          }
          const list = [...lines.values()].sort((a, b) => cushionIndex(a.cushion) - cushionIndex(b.cushion))
          return (
            <Card key={key || '-'} title={`${t('fabricYardage.rollTitle')}: ${key || t('fabricYardage.noFabric')}`}>
              <Row gutter={[16, 16]} align="bottom">
                <Col xs={24} sm={8}>
                  <Form.Item label={t('fabricYardage.width')} extra={t('fabricYardage.widthHelp')} style={{ marginBottom: 0 }}>
                    <InputNumber
                      size="large"
                      min={10}
                      max={150}
                      value={width}
                      onChange={(v) => setSettings((s) => ({ ...s, widths: { ...s.widths, [key]: v ?? DEFAULT_USABLE_WIDTH } }))}
                      suffix={t('calc.in')}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic title={t('fabricYardage.order')} value={t('fabricYardage.yardsN', { n: plan.orderYards })} />
                </Col>
                <Col xs={12} sm={8}>
                  <Typography.Text>{t('fabricYardage.exact', { len: formatInches(plan.totalLength), yd: plan.yards.toFixed(2) })}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('fabricYardage.breakdown', {
                      pieces: formatInches(plan.piecesLength),
                      end: formatInches(plan.endAllowance),
                      cording: formatInches(plan.cordingLength),
                    })}
                  </Typography.Text>
                </Col>
              </Row>
              <Space size={8} wrap style={{ margin: '12px 0' }}>
                <Tag>{t('fabricYardage.pieceCount', { count: plan.placed.length })}</Tag>
                {plan.cordingStrips > 0 && <Tag>{t('fabricYardage.cordingStrips', { count: plan.cordingStrips })}</Tag>}
                {plan.placed.length > 0 && <Tag>{t('fabricYardage.used', { pct: Math.round(plan.used * 100) })}</Tag>}
              </Space>
              {plan.tooWide.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  title={t('fabricYardage.tooWideTitle')}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {[...new Map(plan.tooWide.map((p) => [`${p.cushion}|${p.name}`, { ...p, n: plan.tooWide.filter((q) => q.cushion === p.cushion && q.name === p.name).length }])).values()].map((p, k) => (
                        <li key={k}>
                          {t('fabricYardage.tooWide', {
                            piece: `${p.cushion} · ${pieceName(p.name)}${p.n > 1 ? ` × ${p.n}` : ''}`,
                            size: `${formatInches(p.across)} × ${formatInches(p.along)}`,
                            width: formatInches(width),
                          })}
                        </li>
                      ))}
                    </ul>
                  }
                  style={{ marginBottom: 12 }}
                />
              )}
              {plan.totalLength > 0 && <RollDiagram plan={plan} cushionIndex={cushionIndex} pieceName={pieceName} />}
              {list.length > 0 && (
                <>
                  <Typography.Title level={5} style={{ marginTop: 16 }}>
                    {t('fabricYardage.cutList')}
                  </Typography.Title>
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="key"
                    dataSource={list}
                    columns={[
                      { title: t('fabricYardage.colPiece'), render: (_, p) => `${p.cushion} · ${pieceName(p.name)}` },
                      { title: t('fabricYardage.colQty'), dataIndex: 'qty', align: 'center', width: 56 },
                      {
                        title: t('fabricYardage.colSize'),
                        align: 'right',
                        render: (_, p) => (
                          <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {formatInches(p.across)} × {formatInches(p.along)}
                          </Typography.Text>
                        ),
                      },
                      { title: t('fabricYardage.colRuns'), render: (_, p) => (p.turned ? t('fabricYardage.runsRR') : t('fabricYardage.runsUp')) },
                    ]}
                  />
                </>
              )}
            </Card>
          )
        })}

        <Popconfirm
          title={t('fabricYardage.clearConfirm')}
          okText={t('fabricYardage.clear')}
          cancelText={t('common.cancel')}
          onConfirm={() => {
            setCushions([blank()])
            setSettings(blankSettings())
          }}
        >
          <Button size="large" danger>
            {t('fabricYardage.clear')}
          </Button>
        </Popconfirm>
      </Space>
    </div>
  )
}
