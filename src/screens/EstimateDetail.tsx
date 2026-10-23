import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  PlusOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { FullScreenLoader } from '../components/FullScreenLoader'
import {
  BUSINESSES,
  ESTIMATE_STATUSES,
  STATUS_COLOR,
  STORES,
  createEstimate,
  deleteEstimate,
  estimateCode,
  estimateTotal,
  getEstimate,
  lineTotal,
  listClients,
  money,
  saveClient,
  saveLines,
  updateEstimate,
  type Client,
  type EstimateFull,
  type EstimateLine,
  type EstimateStatus,
  type NewLine,
  type Store,
  errorText,
} from '../lib/estimates'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const blankLine = (patch: Partial<EstimateLine> = {}): EstimateLine => ({
  id: crypto.randomUUID(),
  section: null,
  name: '',
  description: null,
  quantity: 1,
  unit: null,
  unit_price: 0,
  source: null,
  ...patch,
})

type ClientDraft = Omit<Client, 'id'> & { id?: string }
const blankClient = (): ClientDraft => ({ name: '', company: null, email: null, phone: null, address: null, notes: null })

function ClientModal({ client, onClose, onSaved }: { client: ClientDraft; onClose: () => void; onSaved: (c: Client) => void }) {
  const { t } = useTranslation()
  const [c, setC] = useState<ClientDraft>(client)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof ClientDraft) => (e: { target: { value: string } }) => setC((x) => ({ ...x, [k]: e.target.value || null }))
  const save = async () => {
    setBusy(true)
    try {
      onSaved(await saveClient({ ...c, name: c.name.trim() }))
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      title={c.id ? t('estimates.editClient') : t('estimates.newClient')}
      onCancel={onClose}
      onOk={save}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !c.name?.trim(), loading: busy }}
    >
      {err && <Alert type="error" title={err} style={{ marginBottom: 12 }} />}
      <Form layout="vertical" component="div">
        <Form.Item label={t('estimates.clientName')} htmlFor="cl-name" required style={{ marginBottom: 12 }}>
          <Input id="cl-name" size="large" value={c.name} onChange={(e) => setC((x) => ({ ...x, name: e.target.value }))} />
        </Form.Item>
        <Form.Item label={t('estimates.company')} htmlFor="cl-co" style={{ marginBottom: 12 }}>
          <Input id="cl-co" value={c.company ?? ''} onChange={set('company')} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item label={t('estimates.phone')} htmlFor="cl-ph" style={{ marginBottom: 12 }}>
              <Input id="cl-ph" inputMode="tel" value={c.phone ?? ''} onChange={set('phone')} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label={t('estimates.email')} htmlFor="cl-em" style={{ marginBottom: 12 }}>
              <Input id="cl-em" inputMode="email" value={c.email ?? ''} onChange={set('email')} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label={t('estimates.address')} htmlFor="cl-ad" style={{ marginBottom: 12 }}>
          <Input.TextArea id="cl-ad" autoSize={{ minRows: 2, maxRows: 4 }} value={c.address ?? ''} onChange={set('address')} />
        </Form.Item>
        <Form.Item label={t('estimates.clientNotes')} htmlFor="cl-no" style={{ marginBottom: 0 }}>
          <Input.TextArea id="cl-no" autoSize={{ minRows: 1, maxRows: 4 }} value={c.notes ?? ''} onChange={set('notes')} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function LineCard({
  line,
  index,
  count,
  sections,
  update,
  move,
  remove,
}: {
  line: EstimateLine
  index: number
  count: number
  sections: string[]
  update: (patch: Partial<EstimateLine>) => void
  move: (dir: -1 | 1) => void
  remove: () => void
}) {
  const { t } = useTranslation()
  const id = line.id.slice(0, 8)
  return (
    <Card
      size="small"
      title={line.name.trim() || t('estimates.lineN', { n: index + 1 })}
      extra={
        <Space size={0}>
          <Button type="text" icon={<ArrowUpOutlined />} aria-label={t('estimates.moveUp')} disabled={index === 0} onClick={() => move(-1)} />
          <Button type="text" icon={<ArrowDownOutlined />} aria-label={t('estimates.moveDown')} disabled={index === count - 1} onClick={() => move(1)} />
          <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('estimates.removeLine')} onClick={remove} />
        </Space>
      }
    >
      <Form layout="vertical" component="div">
        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Form.Item label={t('estimates.section')} htmlFor={`sec-${id}`} extra={t('estimates.sectionHelp')} style={{ marginBottom: 12 }}>
              <AutoComplete
                id={`sec-${id}`}
                value={line.section ?? ''}
                options={sections.map((s) => ({ value: s }))}
                onChange={(v) => update({ section: v || null })}
                filterOption={(input, o) => String(o?.value ?? '').toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item label={t('estimates.item')} htmlFor={`name-${id}`} style={{ marginBottom: 12 }}>
              <Input id={`name-${id}`} value={line.name} onChange={(e) => update({ name: e.target.value })} />
            </Form.Item>
          </Col>
          <Col xs={8} sm={6}>
            <Form.Item label={t('estimates.qty')} htmlFor={`qty-${id}`} style={{ marginBottom: 12 }}>
              <InputNumber id={`qty-${id}`} min={0} value={line.quantity} onChange={(v) => update({ quantity: v ?? 0 })} style={{ width: '100%' }} inputMode="decimal" />
            </Form.Item>
          </Col>
          <Col xs={8} sm={5}>
            <Form.Item label={t('estimates.unit')} htmlFor={`unit-${id}`} style={{ marginBottom: 12 }}>
              <AutoComplete
                id={`unit-${id}`}
                value={line.unit ?? ''}
                options={['ea', 'pr', 'in', 'ft', 'yd', 'hr'].map((value) => ({ value }))}
                onChange={(v) => update({ unit: v || null })}
              />
            </Form.Item>
          </Col>
          <Col xs={8} sm={7}>
            <Form.Item label={t('estimates.unitPrice')} htmlFor={`price-${id}`} style={{ marginBottom: 12 }}>
              <InputNumber
                id={`price-${id}`}
                prefix="$"
                precision={2}
                value={line.unit_price}
                onChange={(v) => update({ unit_price: v ?? 0 })}
                style={{ width: '100%' }}
                inputMode="decimal"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item label={t('estimates.lineTotal')} style={{ marginBottom: 12 }}>
              <Typography.Text strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', lineHeight: '32px' }}>
                {money(lineTotal(line))}
              </Typography.Text>
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label={t('estimates.description')} htmlFor={`desc-${id}`} style={{ marginBottom: 0 }}>
              <Input.TextArea
                id={`desc-${id}`}
                autoSize={{ minRows: 1, maxRows: 14 }}
                value={line.description ?? ''}
                onChange={(e) => update({ description: e.target.value || null })}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  )
}

type Fields = {
  store: Store
  client_id: string | null
  title: string
  status: EstimateStatus
  estimate_date: string
  notes: string | null
  terms: string | null
}

/** One estimate (or a new one at /estimates/new). Admins only. */
export default function EstimateDetail() {
  const { t } = useTranslation()
  const { estimateId } = useParams()
  const isNew = estimateId === 'new'
  const navigate = useNavigate()
  const location = useLocation()
  const [msg, ctx] = message.useMessage()

  const [loaded, setLoaded] = useState<EstimateFull | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [fields, setFields] = useState<Fields>({
    store: 'HOV',
    client_id: null,
    title: '',
    status: 'draft',
    estimate_date: today(),
    notes: null,
    terms: null,
  })
  const [lines, setLines] = useState<EstimateLine[]>(() =>
    ((location.state as { lines?: NewLine[] } | null)?.lines ?? []).map((l) => blankLine(l)),
  )
  const [removed, setRemoved] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [clientEdit, setClientEdit] = useState<ClientDraft | null>(null)

  useEffect(() => {
    listClients().then(setClients, (e) => setLoadError(e.message))
    if (isNew) return
    getEstimate(estimateId!).then(
      (e) => {
        setLoaded(e)
        setFields({
          store: e.store,
          client_id: e.client_id,
          title: e.title,
          status: e.status,
          estimate_date: e.estimate_date,
          notes: e.notes,
          terms: e.terms,
        })
        setLines(e.lines)
        setRemoved([])
        setDirty(false)
      },
      (e) => setLoadError(e.message),
    )
  }, [estimateId, isNew])

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty || isNew) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, isNew])

  const set = (patch: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...patch }))
    setDirty(true)
  }
  const updateLine = (id: string, patch: Partial<EstimateLine>) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    setDirty(true)
  }
  const moveLine = (i: number, dir: -1 | 1) => {
    setLines((ls) => {
      const next = [...ls]
      ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
      return next
    })
    setDirty(true)
  }
  const removeLine = (id: string) => {
    setLines((ls) => ls.filter((l) => l.id !== id))
    if (loaded?.lines.some((l) => l.id === id)) setRemoved((r) => [...r, id])
    setDirty(true)
  }

  const sections = useMemo(() => [...new Set(lines.map((l) => l.section?.trim()).filter((s): s is string => !!s))], [lines])
  const total = estimateTotal(lines)
  const client = clients.find((c) => c.id === fields.client_id) ?? null
  const business = BUSINESSES[fields.store]

  const create = async () => {
    setBusy(true)
    try {
      const id = await createEstimate(
        { store: fields.store, client_id: fields.client_id, title: fields.title.trim(), estimate_date: fields.estimate_date },
        lines,
      )
      navigate(`/estimates/${id}`, { replace: true })
    } catch (e) {
      msg.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!loaded) return
    setBusy(true)
    try {
      await updateEstimate(loaded.id, {
        client_id: fields.client_id,
        title: fields.title.trim(),
        status: fields.status,
        estimate_date: fields.estimate_date,
        notes: fields.notes?.trim() || null,
        terms: fields.terms?.trim() || null,
      })
      await saveLines(loaded.id, lines, removed)
      const fresh = await getEstimate(loaded.id)
      setLoaded(fresh)
      setLines(fresh.lines)
      setRemoved([])
      setDirty(false)
      msg.success(t('estimates.saved'))
    } catch (e) {
      msg.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const pdf = async () => {
    if (!loaded) return
    try {
      const { downloadEstimatePdf } = await import('../lib/estimatePdf')
      await downloadEstimatePdf({ ...loaded, ...fields, client, lines })
    } catch (e) {
      msg.error(errorText(e))
    }
  }

  const remove = async () => {
    if (!loaded) return
    try {
      setDirty(false)
      await deleteEstimate(loaded.id)
      navigate('/estimates', { replace: true })
    } catch (e) {
      msg.error(errorText(e))
    }
  }

  if (loadError) return <Alert type="error" title={loadError} style={{ margin: 24 }} />
  if (!isNew && !loaded) return <FullScreenLoader />

  return (
    <div style={{ maxWidth: 880, width: '100%', margin: '0 auto', padding: '16px 16px 120px' }}>
      {ctx}
      <Link to="/estimates">
        <Button type="link" icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
          {t('estimates.title')}
        </Button>
      </Link>

      <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 4 }} align="center" wrap>
        <Space size={12} align="center">
          <img src={business.logo} alt="" height={40} style={{ maxWidth: 140, objectFit: 'contain', background: '#fff', borderRadius: 4, padding: 4 }} />
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {loaded ? estimateCode(loaded) : t('estimates.new')}
            </Typography.Title>
            <Typography.Text type="secondary">{business.name}</Typography.Text>
          </div>
        </Space>
        {loaded && <Tag color={STATUS_COLOR[fields.status]}>{t(`estimates.statuses.${fields.status}`)}</Tag>}
      </Space>

      <Space orientation="vertical" size={16} style={{ width: '100%', marginTop: 16 }}>
        <Card>
          <Form layout="vertical" component="div">
            {isNew ? (
              <Form.Item label={t('estimates.business')} extra={t('estimates.businessHelp')} style={{ marginBottom: 16 }}>
                <Segmented
                  block
                  size="large"
                  value={fields.store}
                  onChange={(v) => set({ store: v as Store })}
                  options={STORES.map((s) => ({ value: s, label: s, title: BUSINESSES[s].name }))}
                />
              </Form.Item>
            ) : (
              <Form.Item label={t('estimates.status')} style={{ marginBottom: 16 }}>
                <Segmented
                  block
                  value={fields.status}
                  onChange={(v) => set({ status: v as EstimateStatus })}
                  options={ESTIMATE_STATUSES.map((s) => ({ value: s, label: t(`estimates.statuses.${s}`) }))}
                />
              </Form.Item>
            )}
            <Form.Item label={t('estimates.client')} htmlFor="est-client" style={{ marginBottom: 16 }}>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  id="est-client"
                  size="large"
                  showSearch
                  allowClear
                  placeholder={t('estimates.pickClient')}
                  value={fields.client_id ?? undefined}
                  onChange={(v) => set({ client_id: v ?? null })}
                  optionFilterProp="label"
                  options={clients.map((c) => ({ value: c.id, label: c.company ? `${c.name} (${c.company})` : c.name }))}
                  style={{ flex: 1, minWidth: 0 }}
                />
                {client && <Button size="large" icon={<EditOutlined />} aria-label={t('estimates.editClient')} onClick={() => setClientEdit(client)} />}
                <Button size="large" icon={<UserAddOutlined />} onClick={() => setClientEdit(blankClient())}>
                  {t('estimates.newClientShort')}
                </Button>
              </Space.Compact>
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} sm={16}>
                <Form.Item label={t('estimates.projectTitle')} htmlFor="est-title" extra={t('estimates.projectTitleHelp')} style={{ marginBottom: 0 }}>
                  <Input id="est-title" size="large" value={fields.title} onChange={(e) => set({ title: e.target.value })} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label={t('estimates.date')} htmlFor="est-date" style={{ marginBottom: 0 }}>
                  <Input id="est-date" type="date" size="large" value={fields.estimate_date} onChange={(e) => e.target.value && set({ estimate_date: e.target.value })} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <Typography.Title level={4} style={{ margin: '8px 0 0' }}>
          {t('estimates.lines')}
        </Typography.Title>
        {lines.length === 0 && <Typography.Text type="secondary">{t('estimates.noLines')}</Typography.Text>}
        {lines.map((l, i) => (
          <LineCard
            key={l.id}
            line={l}
            index={i}
            count={lines.length}
            sections={sections}
            update={(patch) => updateLine(l.id, patch)}
            move={(dir) => moveLine(i, dir)}
            remove={() => removeLine(l.id)}
          />
        ))}
        <Button
          type="dashed"
          block
          size="large"
          icon={<PlusOutlined />}
          onClick={() => {
            setLines((ls) => [...ls, blankLine({ section: ls[ls.length - 1]?.section ?? null, unit: 'ea' })])
            setDirty(true)
          }}
        >
          {t('estimates.addLine')}
        </Button>
        <Typography.Text type="secondary">{t('estimates.fromTools')}</Typography.Text>

        <Card>
          <Statistic title={t('estimates.total')} value={money(total)} valueStyle={{ fontWeight: 700 }} />
        </Card>

        {!isNew && (
          <Card>
            <Form layout="vertical" component="div">
              <Form.Item label={t('estimates.notes')} htmlFor="est-notes" extra={t('estimates.onPdf')} style={{ marginBottom: 16 }}>
                <Input.TextArea id="est-notes" autoSize={{ minRows: 2, maxRows: 10 }} value={fields.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
              </Form.Item>
              <Form.Item label={t('estimates.terms')} htmlFor="est-terms" extra={t('estimates.onPdf')} style={{ marginBottom: 0 }}>
                <Input.TextArea id="est-terms" autoSize={{ minRows: 2, maxRows: 10 }} value={fields.terms ?? ''} onChange={(e) => set({ terms: e.target.value })} />
              </Form.Item>
            </Form>
          </Card>
        )}

        {!isNew && (
          <Popconfirm
            title={t('estimates.deleteConfirm')}
            okText={t('estimates.delete')}
            okButtonProps={{ danger: true }}
            cancelText={t('common.cancel')}
            onConfirm={remove}
          >
            <Button danger icon={<DeleteOutlined />}>
              {t('estimates.delete')}
            </Button>
          </Popconfirm>
        )}
      </Space>

      {/* Sticky action bar */}
      <div
        className="fixed inset-x-0 bottom-24 z-10 md:bottom-0 md:left-60 print:hidden"
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 16px 12px', pointerEvents: 'auto' }}>
          <Card size="small" styles={{ body: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } }}>
            <Typography.Text strong style={{ marginRight: 'auto', fontVariantNumeric: 'tabular-nums' }}>
              {t('estimates.total')}: {money(total)}
              {dirty && !isNew && (
                <Typography.Text type="warning" style={{ marginLeft: 8, fontWeight: 400 }}>
                  {t('estimates.unsaved')}
                </Typography.Text>
              )}
            </Typography.Text>
            {isNew ? (
              <Button type="primary" size="large" loading={busy} onClick={create}>
                {t('estimates.create')}
              </Button>
            ) : (
              <>
                <Button size="large" icon={<FilePdfOutlined />} onClick={pdf}>
                  {t('estimates.pdf')}
                </Button>
                <Button type="primary" size="large" loading={busy} disabled={!dirty} onClick={save}>
                  {t('common.save')}
                </Button>
              </>
            )}
          </Card>
        </div>
      </div>

      {clientEdit && (
      <ClientModal
        key={clientEdit.id ?? 'new'}
        client={clientEdit}
        onClose={() => setClientEdit(null)}
        onSaved={(c) => {
          setClients((cs) => [...cs.filter((x) => x.id !== c.id), c].sort((a, b) => a.name.localeCompare(b.name)))
          set({ client_id: c.id })
          setClientEdit(null)
        }}
      />
      )}
    </div>
  )
}
