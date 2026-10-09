import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, FilePdfOutlined, PlusOutlined } from '@ant-design/icons'
import {
  BIAS_STRIP_LENGTH,
  cordingByFabric,
  cordingStrips,
  cushionCuts,
  formatInches,
  parseInches,
  type CushionCuts,
  type FoamWrap,
  type ZipperStyle,
} from '../../lib/calculators/cushionCut'
import {
  downloadCushionWorkOrder,
  type FabricDirection,
  type WorkOrderCushion,
  type WorkOrderJob,
} from '../../lib/calculators/cushionCutPdf'

type Row = {
  id: number
  label: string
  fabric: string
  style: ZipperStyle
  direction: FabricDirection
  foamWrap: FoamWrap
  foamNotes: string
  qty: number
  front: string
  sides: string
  height: string
}
type Draft = { job: WorkOrderJob; rows: Row[] }

const DRAFT_KEY = 'pm-calc-cushion-cut'
let nextId = 1
const blank = (): Row => ({
  id: nextId++,
  label: '',
  fabric: '',
  style: 'back',
  direction: 'none',
  foamWrap: 'none',
  foamNotes: '',
  qty: 1,
  front: '',
  sides: '',
  height: '',
})
const blankJob = (): WorkOrderJob => ({ client: '', workOrder: '', sidemark: '' })

function loadDraft(): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | Row[] | null
    // Early drafts were just the row list.
    const rows = Array.isArray(saved) ? saved : saved?.rows
    if (rows?.length) {
      return {
        job: { ...blankJob(), ...(Array.isArray(saved) ? {} : saved?.job) },
        rows: rows.map((r) => ({ ...blank(), ...r, id: nextId++ })),
      }
    }
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return { job: blankJob(), rows: [blank()] }
}

/** One measurement field that accepts workroom fractions like 20 1/2. */
function InchField({
  id,
  label,
  value,
  onChange,
  help,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  help?: string
}) {
  const { t } = useTranslation()
  const bad = value.trim() !== '' && parseInches(value) === null
  return (
    <Form.Item
      label={label}
      htmlFor={id}
      validateStatus={bad ? 'error' : undefined}
      help={bad ? t('calc.badInches') : undefined}
      extra={help}
      style={{ marginBottom: 20 }}
    >
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        suffix={t('calc.in')}
        size="large"
      />
    </Form.Item>
  )
}

function CutsTable({ cuts }: { cuts: CushionCuts }) {
  const { t } = useTranslation()
  const rows = [
    { key: 'plate', piece: t('cushionCut.plate'), qty: cuts.plate.qty, size: `${formatInches(cuts.plate.width)} × ${formatInches(cuts.plate.depth)}` },
    { key: 'boxing', piece: t('cushionCut.boxing'), qty: cuts.boxing.qty, size: `${formatInches(cuts.boxing.x)} × ${formatInches(cuts.boxing.z)}` },
    { key: 'zipper', piece: t('cushionCut.zipper'), qty: cuts.zipper.qty, size: `${formatInches(cuts.zipper.x)} × ${formatInches(cuts.zipper.z)}` },
    {
      key: 'foam',
      piece: t('cushionCut.foam'),
      qty: cuts.foam.qty,
      size: `${formatInches(cuts.foam.width)} × ${formatInches(cuts.foam.depth)} × ${formatInches(cuts.foam.height)}`,
    },
    {
      key: 'cording',
      piece: t('cushionCut.cording'),
      qty: '',
      size: `${formatInches(cuts.cording)} · ${t('cushionCut.strips', { count: cordingStrips(cuts.cording) })}`,
    },
  ]
  return (
    <Table
      size="small"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: t('cushionCut.piece'), dataIndex: 'piece' },
        { title: t('cushionCut.qty'), dataIndex: 'qty', align: 'center', width: 64 },
        {
          title: t('cushionCut.cutSize'),
          dataIndex: 'size',
          align: 'right',
          render: (s: string) => <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{s}</Typography.Text>,
        },
      ]}
    />
  )
}

/** Cushion cut dimensions: ordered cushion size in, plate/boxing/zipper/cording cuts out. */
export default function CushionCut() {
  const { t } = useTranslation()
  const [initial] = useState(loadDraft)
  const [rows, setRows] = useState<Row[]>(initial.rows)
  const [job, setJob] = useState<WorkOrderJob>(initial.job)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ job, rows }))
    } catch {
      // Draft saving is a convenience only.
    }
  }, [job, rows])

  const update = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const results = useMemo(
    () =>
      rows.map((r) => {
        const front = parseInches(r.front)
        const sides = parseInches(r.sides)
        const height = parseInches(r.height)
        if (front === null || sides === null || height === null || height <= 0) return null
        return cushionCuts({ qty: Math.max(1, r.qty || 1), front, sides, height, style: r.style })
      }),
    [rows],
  )

  const done = results.filter((c): c is CushionCuts => c !== null)

  const downloadPdf = async () => {
    const cushions: WorkOrderCushion[] = []
    rows.forEach((r, i) => {
      const cuts = results[i]
      if (!cuts) return
      cushions.push({
        name: r.label.trim(),
        qty: Math.max(1, r.qty || 1),
        fabric: r.fabric.trim(),
        style: r.style,
        direction: r.direction,
        width: parseInches(r.front)!,
        depth: parseInches(r.sides)!,
        height: parseInches(r.height)!,
        foamWrap: r.foamWrap,
        foamNotes: r.foamNotes.trim(),
        cuts,
      })
    })
    setPdfBusy(true)
    try {
      await downloadCushionWorkOrder(job, cushions)
    } finally {
      setPdfBusy(false)
    }
  }
  const totals = done.reduce(
    (a, c) => ({ cording: a.cording + c.cording, plates: a.plates + c.plate.qty, zippers: a.zippers + c.zipper.qty }),
    { cording: 0, plates: 0, zippers: 0 },
  )
  const byFabric = cordingByFabric(
    rows.flatMap((r, i) => (results[i] ? [{ fabric: r.fabric, cording: results[i]!.cording }] : [])),
  )
  const totalStrips = byFabric.reduce((n, f) => n + f.strips, 0)

  return (
    <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>
      <Link to="/tools" className="no-print">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('tools.title')}
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
        {t('tools.items.cushionCut.name')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('cushionCut.intro')}</Typography.Paragraph>

      <Alert type="info" showIcon title={t('cushionCut.ruleTitle')} description={t('cushionCut.rule')} style={{ marginBottom: 16 }} />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card title={t('cushionCut.jobTitle')} extra={<Typography.Text type="secondary">{t('cushionCut.optional')}</Typography.Text>}>
          <Form layout="vertical" component="div">
            <Row gutter={12}>
              {(['workOrder', 'client', 'sidemark'] as const).map((k) => (
                <Col xs={24} sm={8} key={k}>
                  <Form.Item label={t(`cushionCut.${k}`)} htmlFor={`job-${k}`} style={{ marginBottom: 8 }}>
                    <Input id={`job-${k}`} size="large" value={job[k]} onChange={(e) => setJob((j) => ({ ...j, [k]: e.target.value }))} />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
          <Typography.Text type="secondary">{t('cushionCut.jobHelp')}</Typography.Text>
        </Card>

        {rows.map((r, i) => {
          const cuts = results[i]
          return (
            <Card
              key={r.id}
              title={
                <Space size={8} wrap>
                  {r.label.trim() || t('cushionCut.cushionN', { n: i + 1 })}
                  {r.direction !== 'none' && <Tag color="purple">{t(`cushionCut.${r.direction}`)}</Tag>}
                </Space>
              }
              extra={
                rows.length > 1 && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    aria-label={t('cushionCut.remove')}
                    className="no-print"
                  />
                )
              }
            >
              <Form layout="vertical" component="div">
                <Row gutter={12}>
                  <Col xs={24}>
                    <Form.Item
                      label={t('cushionCut.name')}
                      htmlFor={`name-${r.id}`}
                      extra={t('cushionCut.nameHelp')}
                      style={{ marginBottom: 20 }}
                    >
                      <Input
                        id={`name-${r.id}`}
                        size="large"
                        allowClear
                        value={r.label}
                        onChange={(e) => update(r.id, { label: e.target.value })}
                        placeholder={t('cushionCut.namePlaceholder')}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={16}>
                    <Form.Item label={t('cushionCut.zipperStyle')} extra={t(`cushionCut.${r.style}Help`)} style={{ marginBottom: 20 }}>
                      <Segmented
                        block
                        size="large"
                        value={r.style}
                        onChange={(v) => update(r.id, { style: v as ZipperStyle })}
                        options={[
                          { value: 'back', label: t('cushionCut.back') },
                          { value: 'wrap', label: t('cushionCut.wrap') },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('cushionCut.howMany')} htmlFor={`qty-${r.id}`} style={{ marginBottom: 20 }}>
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
                    <Form.Item
                      label={t('cushionCut.fabric')}
                      htmlFor={`fabric-${r.id}`}
                      extra={t('cushionCut.fabricHelp')}
                      style={{ marginBottom: 20 }}
                    >
                      <Input
                        id={`fabric-${r.id}`}
                        size="large"
                        allowClear
                        value={r.fabric}
                        onChange={(e) => update(r.id, { fabric: e.target.value })}
                        placeholder={t('cushionCut.fabricPlaceholder')}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item label={t('cushionCut.direction')} extra={t('cushionCut.directionHelp')} style={{ marginBottom: 20 }}>
                      <Space size={24} wrap>
                        {(['railroaded', 'upTheRoll'] as const).map((d) => (
                          <Checkbox
                            key={d}
                            checked={r.direction === d}
                            onChange={(e) => update(r.id, { direction: e.target.checked ? d : 'none' })}
                          >
                            {t(`cushionCut.${d}`)}
                          </Checkbox>
                        ))}
                      </Space>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <InchField id={`front-${r.id}`} label={t('cushionCut.front')} help={t('cushionCut.frontHelp')} value={r.front} onChange={(v) => update(r.id, { front: v })} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <InchField id={`sides-${r.id}`} label={t('cushionCut.sides')} help={t('cushionCut.sidesHelp')} value={r.sides} onChange={(v) => update(r.id, { sides: v })} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <InchField id={`height-${r.id}`} label={t('cushionCut.height')} help={t('cushionCut.heightHelp')} value={r.height} onChange={(v) => update(r.id, { height: v })} />
                  </Col>
                  <Col xs={24} sm={10}>
                    <Form.Item label={t('cushionCut.foamWrap')} htmlFor={`wrap-${r.id}`} style={{ marginBottom: 20 }}>
                      <Select
                        id={`wrap-${r.id}`}
                        size="large"
                        value={r.foamWrap}
                        onChange={(v) => update(r.id, { foamWrap: v })}
                        options={(['none', 'lightDacron', 'heavyDacron', 'envelope'] as const).map((w) => ({
                          value: w,
                          label: t(`cushionCut.wrap_${w}`),
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={14}>
                    <Form.Item
                      label={t('cushionCut.foamNotes')}
                      htmlFor={`foam-${r.id}`}
                      extra={t('cushionCut.foamNotesHelp')}
                      style={{ marginBottom: 20 }}
                    >
                      <Input.TextArea
                        id={`foam-${r.id}`}
                        autoSize={{ minRows: 2, maxRows: 5 }}
                        value={r.foamNotes}
                        onChange={(e) => update(r.id, { foamNotes: e.target.value })}
                        placeholder={t('cushionCut.foamNotesPlaceholder')}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>

              {cuts ? (
                <>
                  <div style={{ margin: '4px 0 12px' }}>
                    <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px' }}>
                      {t('cushionCut.finishes', {
                        ordered: formatInches(cuts.finishedHeight + cuts.deduction),
                        finished: formatInches(cuts.finishedHeight),
                        less: formatInches(cuts.deduction),
                      })}
                    </Tag>
                  </div>
                  <CutsTable cuts={cuts} />
                </>
              ) : (
                <Typography.Text type="secondary">{t('cushionCut.fillIn')}</Typography.Text>
              )}
            </Card>
          )
        })}

        <Button type="dashed" block size="large" icon={<PlusOutlined />} onClick={() => setRows((rs) => [...rs, blank()])} className="no-print">
          {t('cushionCut.add')}
        </Button>

        <Card title={t('cushionCut.totals')}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Statistic title={t('cushionCut.totalCording')} value={formatInches(totals.cording)} suffix={<Typography.Text type="secondary" style={{ fontSize: 14 }}>({(totals.cording / 36).toFixed(2)} {t('calc.yd')})</Typography.Text>} />
            </Col>
            <Col xs={24} sm={12}>
              <Statistic title={t('cushionCut.totalStrips', { len: BIAS_STRIP_LENGTH })} value={totalStrips} />
            </Col>
            <Col xs={12} sm={12}>
              <Statistic title={t('cushionCut.totalPlates')} value={totals.plates} />
            </Col>
            <Col xs={12} sm={12}>
              <Statistic title={t('cushionCut.totalZippers')} value={totals.zippers} />
            </Col>
          </Row>
          {byFabric.length > 1 && (
            <Table
              size="small"
              pagination={false}
              style={{ marginTop: 16 }}
              rowKey="fabric"
              dataSource={byFabric}
              columns={[
                { title: t('cushionCut.fabric'), dataIndex: 'fabric', render: (f: string) => f || t('cushionCut.noFabric') },
                { title: t('cushionCut.cording'), dataIndex: 'inches', align: 'right', render: (n: number) => formatInches(n) },
                { title: t('cushionCut.stripsCol'), dataIndex: 'strips', align: 'right', render: (n: number) => <Typography.Text strong>{n}</Typography.Text> },
              ]}
            />
          )}
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            {t('cushionCut.stripsHelp', { len: BIAS_STRIP_LENGTH })}
          </Typography.Paragraph>
        </Card>

        <Space wrap className="no-print">
          <Button type="primary" size="large" icon={<FilePdfOutlined />} onClick={downloadPdf} loading={pdfBusy} disabled={!done.length}>
            {t('cushionCut.pdf')}
          </Button>
          <Popconfirm
            title={t('cushionCut.clearConfirm')}
            okText={t('cushionCut.clear')}
            cancelText={t('common.cancel')}
            onConfirm={() => {
              setRows([blank()])
              setJob(blankJob())
            }}
          >
            <Button size="large" danger>
              {t('cushionCut.clear')}
            </Button>
          </Popconfirm>
        </Space>
      </Space>
    </div>
  )
}
