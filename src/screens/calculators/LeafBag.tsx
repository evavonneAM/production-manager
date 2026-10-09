import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Col, Collapse, Form, Input, InputNumber, Popconfirm, Row, Space, Statistic, Table, Typography } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, FilePdfOutlined, PlusOutlined, TagsOutlined } from '@ant-design/icons'
import { formatInches, parseInches } from '../../lib/calculators/inches'
import { leafBagCuts, type LeafBagCuts } from '../../lib/calculators/leafBag'
import { downloadLeafBagLabels, downloadLeafBagWorkOrder, type LeafBagLine } from '../../lib/calculators/leafBagPdf'

type Row = { id: number; job: string; qty: number; leafWidth: string; leafDepth: string; bagWidth: string; bagDepth: string }

const DRAFT_KEY = 'pm-calc-leaf-bag'
let nextId = 1
const blank = (patch: Partial<Row> = {}): Row => ({
  id: nextId++,
  job: '',
  qty: 1,
  leafWidth: '',
  leafDepth: '',
  bagWidth: '',
  bagDepth: '',
  ...patch,
})

function loadDraft(): Row[] {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Row[] | null
    if (Array.isArray(saved) && saved.length) return saved.map((r) => ({ ...blank(), ...r, id: nextId++ }))
  } catch {
    // Storage unavailable or corrupt — start fresh.
  }
  return [blank()]
}

/** Rows copied from the spreadsheet: Job #, Leaf W, Leaf D, Bag W, Bag D, Qty (tab-separated). */
function parsePasted(text: string): Row[] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.split('\t').map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean))
    // Skip a header row if one was copied.
    .filter((cells) => !/job/i.test(cells[0] ?? '') || cells.slice(1).some((c) => parseInches(c) !== null))
    .map(([job = '', lw = '', ld = '', bw = '', bd = '', qty = '']) =>
      blank({ job, leafWidth: lw, leafDepth: ld, bagWidth: bw, bagDepth: bd, qty: Math.max(1, parseInt(qty) || 1) }),
    )
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
      style={{ marginBottom: 20 }}
    >
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" suffix={t('calc.in')} size="large" />
    </Form.Item>
  )
}

function CutsTable({ cuts }: { cuts: LeafBagCuts }) {
  const { t } = useTranslation()
  const f = formatInches
  return (
    <Table
      size="small"
      pagination={false}
      dataSource={[
        { key: 'lb', piece: t('leafBag.longBottom'), qty: cuts.qty, size: `${f(cuts.longBottom.width)} × ${f(cuts.longBottom.length)}` },
        { key: 'st', piece: t('leafBag.shortTop'), qty: cuts.qty, size: `${f(cuts.shortTop.width)} × ${f(cuts.shortTop.length)}` },
      ]}
      columns={[
        { title: t('cushionCut.piece'), dataIndex: 'piece' },
        { title: t('cushionCut.qty'), dataIndex: 'qty', align: 'center', width: 64 },
        {
          title: t('leafBag.cutSize'),
          dataIndex: 'size',
          align: 'right',
          render: (s: string) => <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{s}</Typography.Text>,
        },
      ]}
    />
  )
}

/** Leaf bags: bag size in, long bottom and short top cuts out, plus labels. */
export default function LeafBag() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[]>(loadDraft)
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState<'' | 'list' | 'labels'>('')

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rows))
    } catch {
      // Draft saving is a convenience only.
    }
  }, [rows])

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const lines = useMemo(
    () =>
      rows.map((r): LeafBagLine | null => {
        const bw = parseInches(r.bagWidth)
        const bd = parseInches(r.bagDepth)
        if (bw === null || bd === null || bw <= 0 || bd <= 0) return null
        const qty = Math.max(1, r.qty || 1)
        return {
          job: r.job.trim(),
          leafWidth: parseInches(r.leafWidth),
          leafDepth: parseInches(r.leafDepth),
          bagWidth: bw,
          bagDepth: bd,
          cuts: leafBagCuts({ qty, bagWidth: bw, bagDepth: bd }),
        }
      }),
    [rows],
  )
  const done = lines.filter((l): l is LeafBagLine => l !== null)
  const bags = done.reduce((n, l) => n + l.cuts.qty, 0)

  const addPasted = () => {
    const pasted = parsePasted(paste)
    if (!pasted.length) return
    // Fill the empty starter card instead of leaving it blank above the pasted rows.
    setRows((rs) => [...rs.filter((r) => r.job || r.bagWidth || r.bagDepth), ...pasted])
    setPaste('')
  }

  const run = async (kind: 'list' | 'labels') => {
    setBusy(kind)
    try {
      await (kind === 'list' ? downloadLeafBagWorkOrder(done) : downloadLeafBagLabels(done))
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '16px 16px 48px' }}>
      <Link to="/tools">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('tools.title')}
        </Button>
      </Link>
      <Typography.Title level={3} style={{ marginTop: 4, marginBottom: 4 }}>
        {t('tools.items.leafBag.name')}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t('leafBag.intro')}</Typography.Paragraph>

      <Alert type="info" showIcon title={t('leafBag.ruleTitle')} description={t('leafBag.rule')} style={{ marginBottom: 16 }} />

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Collapse
          items={[
            {
              key: 'paste',
              label: t('leafBag.pasteTitle'),
              children: (
                <>
                  <Typography.Paragraph type="secondary">{t('leafBag.pasteHelp')}</Typography.Paragraph>
                  <Input.TextArea
                    id="leaf-paste"
                    aria-label={t('leafBag.pasteTitle')}
                    autoSize={{ minRows: 4, maxRows: 12 }}
                    value={paste}
                    onChange={(e) => setPaste(e.target.value)}
                    placeholder={'AM1234-A\t20\t40\t20 1/2\t42\t2'}
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
          const line = lines[i]
          return (
            <Card
              key={r.id}
              title={r.job.trim() || t('leafBag.bagN', { n: i + 1 })}
              extra={
                rows.length > 1 && (
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                    aria-label={t('leafBag.remove')}
                  />
                )
              }
            >
              <Form layout="vertical" component="div">
                <Row gutter={12}>
                  <Col xs={24} sm={16}>
                    <Form.Item label={t('leafBag.job')} htmlFor={`job-${r.id}`} extra={t('leafBag.jobHelp')} style={{ marginBottom: 20 }}>
                      <Input id={`job-${r.id}`} size="large" allowClear value={r.job} onChange={(e) => update(r.id, { job: e.target.value })} placeholder="AM1234-A" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item label={t('cushionCut.howMany')} htmlFor={`qty-${r.id}`} style={{ marginBottom: 20 }}>
                      <InputNumber id={`qty-${r.id}`} size="large" min={1} precision={0} value={r.qty} onChange={(v) => update(r.id, { qty: v ?? 1 })} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <InchField id={`bw-${r.id}`} label={t('leafBag.bagWidth')} help={t('leafBag.bagHelp')} value={r.bagWidth} onChange={(v) => update(r.id, { bagWidth: v })} />
                  </Col>
                  <Col xs={24} sm={12}>
                    <InchField id={`bd-${r.id}`} label={t('leafBag.bagDepth')} help={t('leafBag.bagHelp')} value={r.bagDepth} onChange={(v) => update(r.id, { bagDepth: v })} />
                  </Col>
                  <Col xs={24} sm={12}>
                    <InchField id={`lw-${r.id}`} label={t('leafBag.leafWidth')} help={t('leafBag.leafHelp')} value={r.leafWidth} onChange={(v) => update(r.id, { leafWidth: v })} />
                  </Col>
                  <Col xs={24} sm={12}>
                    <InchField id={`ld-${r.id}`} label={t('leafBag.leafDepth')} help={t('leafBag.leafHelp')} value={r.leafDepth} onChange={(v) => update(r.id, { leafDepth: v })} />
                  </Col>
                </Row>
              </Form>
              {line ? (
                <CutsTable cuts={line.cuts} />
              ) : (
                <Typography.Text type="secondary">{t('leafBag.fillIn')}</Typography.Text>
              )}
            </Card>
          )
        })}

        <Button type="dashed" block size="large" icon={<PlusOutlined />} onClick={() => setRows((rs) => [...rs, blank()])}>
          {t('leafBag.add')}
        </Button>

        <Card title={t('cushionCut.totals')}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic title={t('leafBag.totalJobs')} value={done.length} />
            </Col>
            <Col span={12}>
              <Statistic title={t('leafBag.totalBags')} value={bags} />
            </Col>
          </Row>
        </Card>

        <Space wrap>
          <Button type="primary" size="large" icon={<FilePdfOutlined />} loading={busy === 'list'} disabled={!done.length} onClick={() => run('list')}>
            {t('leafBag.pdf')}
          </Button>
          <Button size="large" icon={<TagsOutlined />} loading={busy === 'labels'} disabled={!done.length} onClick={() => run('labels')}>
            {t('leafBag.labels')}
          </Button>
          <Popconfirm title={t('leafBag.clearConfirm')} okText={t('cushionCut.clear')} cancelText={t('common.cancel')} onConfirm={() => setRows([blank()])}>
            <Button size="large" danger>
              {t('cushionCut.clear')}
            </Button>
          </Popconfirm>
        </Space>
      </Space>
    </div>
  )
}
