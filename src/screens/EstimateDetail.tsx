import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  ConfigProvider,
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
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CheckOutlined,
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
  createRevision,
  getReplaced,
  isLocked,
  depositAmount,
  groupTotals,
  saveGroups,
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
  type EstimateGroup,
  type EstimateFabric,
  type FabricKind,
  type FabricUse,
  fabricNeed,
  fabricNoCharge,
  retailPerYard,
  roomOrder,
  saveFabrics,
  syncFabricLines,
  type EstimateLine,
  type EstimateStatus,
  type NewLine,
  TOOL_ROUTES,
  type WorksheetTool,
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
  groups,
  fabrics,
  openTool,
  update,
  move,
  remove,
}: {
  line: EstimateLine
  index: number
  count: number
  sections: string[]
  groups: EstimateGroup[]
  fabrics: EstimateFabric[]
  /** Reopen this line's worksheet in its tool; undefined while there are unsaved changes. */
  openTool?: () => void
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
          {line.spec && (
            <Button type="link" size="small" disabled={!openTool} onClick={openTool} title={openTool ? undefined : t('estimates.saveFirst')}>
              {t('estimates.openIn', { tool: t(`tools.items.${line.spec.tool}.name`) })}
            </Button>
          )}
          <Button type="text" icon={<ArrowUpOutlined />} aria-label={t('estimates.moveUp')} disabled={index === 0} onClick={() => move(-1)} />
          <Button type="text" icon={<ArrowDownOutlined />} aria-label={t('estimates.moveDown')} disabled={index === count - 1} onClick={() => move(1)} />
          <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('estimates.removeLine')} onClick={remove} />
        </Space>
      }
    >
      <Form layout="vertical" component="div">
        <Row gutter={12}>
          {groups.length > 0 && (
            <Col xs={24}>
              <Form.Item label={t('estimates.room')} htmlFor={`room-${id}`} style={{ marginBottom: 12 }}>
                <Select
                  id={`room-${id}`}
                  value={line.group_id ?? ''}
                  onChange={(v) => update({ group_id: v || null })}
                  options={[
                    ...groups.map((g) => ({ value: g.id, label: g.name.trim() || t('estimates.unnamedRoom') })),
                    { value: '', label: t('estimates.noRoom') },
                  ]}
                />
              </Form.Item>
            </Col>
          )}
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
          <Col xs={24}>
            <FabricUses uses={line.fabric_uses ?? []} fabrics={fabrics} onChange={(fabric_uses) => update({ fabric_uses })} />
          </Col>
        </Row>
      </Form>
    </Card>
  )
}

/** The fabric an item uses (body, welt, back…) and its yards. */
function FabricUses({ uses, fabrics, onChange }: { uses: FabricUse[]; fabrics: EstimateFabric[]; onChange: (u: FabricUse[] | null) => void }) {
  const { t } = useTranslation()
  const set = (i: number, patch: Partial<FabricUse>) => onChange(uses.map((u, j) => (j === i ? { ...u, ...patch } : u)))
  return (
    <div style={{ marginTop: 12 }}>
      <Typography.Text type="secondary">{t('estimates.fabricUses')}</Typography.Text>
      {uses.map((u, i) => (
        <Space.Compact key={i} style={{ width: '100%', marginTop: 6 }}>
          <Select
            aria-label={t('estimates.fabric')}
            placeholder={t('estimates.pickFabric')}
            value={u.fabric_id ?? undefined}
            onChange={(v) => set(i, { fabric_id: v })}
            options={fabrics.map((f) => ({ value: f.id, label: f.name.trim() || t(`estimates.fabricKinds.${f.kind}`) }))}
            style={{ flex: 2, minWidth: 0 }}
          />
          <Input aria-label={t('estimates.fabricRole')} value={u.role} onChange={(e) => set(i, { role: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
          <InputNumber
            aria-label={t('estimates.yards')}
            min={0}
            precision={0}
            suffix="yd"
            value={u.yards}
            onChange={(v) => set(i, { yards: v ?? 0 })}
            style={{ width: 96 }}
          />
          <Button icon={<DeleteOutlined />} aria-label={t('estimates.removeFabricUse')} onClick={() => onChange(uses.filter((_, j) => j !== i))} />
        </Space.Compact>
      ))}
      <div>
        <Button
          type="link"
          size="small"
          icon={<PlusOutlined />}
          disabled={fabrics.length === 0}
          title={fabrics.length === 0 ? t('estimates.addFabricFirst') : undefined}
          onClick={() => onChange([...uses, { fabric_id: fabrics[0]?.id ?? null, role: uses.length ? 'Welt' : 'Body', yards: 1 }])}
          style={{ paddingInline: 0 }}
        >
          {t('estimates.addFabricUse')}
        </Button>
      </div>
    </div>
  )
}

/** A room's line for one fabric: yards added up from its items, or typed over. */
function FabricLineCard({
  line,
  fabric,
  need,
  update,
}: {
  line: EstimateLine
  fabric: EstimateFabric | undefined
  need: number
  update: (patch: Partial<EstimateLine>) => void
}) {
  const { t } = useTranslation()
  const free = fabricNoCharge(fabric)
  return (
    <Card size="small" style={{ background: 'var(--ant-color-fill-quaternary, #fafafa)' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="center" wrap>
        <div>
          <Typography.Text strong>{line.name}</Typography.Text>
          <div>
            <Typography.Text type="secondary">
              {line.qty_override ? t('estimates.yardsTyped', { n: need }) : t('estimates.yardsAdded')}
            </Typography.Text>
          </div>
        </div>
        <Space wrap align="center">
          <InputNumber
            aria-label={t('estimates.yards')}
            min={0}
            precision={0}
            suffix="yd"
            value={line.quantity}
            onChange={(v) => update({ quantity: v ?? 0, qty_override: true })}
            style={{ width: 100 }}
          />
          {line.qty_override && (
            <Button size="small" onClick={() => update({ quantity: need, qty_override: false })}>
              {t('estimates.useAdded', { n: need })}
            </Button>
          )}
          <Typography.Text type="secondary">× {free ? '—' : money(line.unit_price)}</Typography.Text>
          <Typography.Text strong style={{ minWidth: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {free ? '—' : money(lineTotal(line))}
          </Typography.Text>
        </Space>
      </Space>
    </Card>
  )
}

/** The job's fabrics: picked once, used by any item. */
function FabricsCard({
  fabrics,
  lines,
  sidemarkDefault,
  onChange,
  onRemove,
}: {
  fabrics: EstimateFabric[]
  lines: EstimateLine[]
  sidemarkDefault: string
  onChange: (f: EstimateFabric[]) => void
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()
  const set = (id: string, patch: Partial<EstimateFabric>) => onChange(fabrics.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  const totalYards = (id: string) =>
    lines.filter((l) => (l.kind ?? 'item') === 'item').reduce((n, l) => n + (l.fabric_uses ?? []).filter((u) => u.fabric_id === id).reduce((m, u) => m + u.yards, 0), 0)
  return (
    <Card
      title={t('estimates.fabrics')}
      extra={
        <Button
          icon={<PlusOutlined />}
          onClick={() => onChange([...fabrics, { id: crypto.randomUUID(), kind: 'fabric', name: '', vendor: null, sidemark: null, wholesale: null }])}
        >
          {t('estimates.addFabric')}
        </Button>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        {t('estimates.fabricsHelp')}
      </Typography.Paragraph>
      {fabrics.length === 0 && <Typography.Text type="secondary">{t('estimates.noFabrics')}</Typography.Text>}
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {fabrics.map((f) => (
          <Card key={f.id} size="small">
            <Form layout="vertical" component="div">
              <Row gutter={12}>
                <Col xs={24} sm={8}>
                  <Form.Item label={t('estimates.fabricKind')} style={{ marginBottom: 8 }}>
                    <Select
                      value={f.kind}
                      onChange={(kind: FabricKind) => set(f.id, { kind })}
                      options={(['fabric', 'com', 'tbd'] as const).map((k) => ({ value: k, label: t(`estimates.fabricKinds.${k}`) }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={16}>
                  <Form.Item label={t('estimates.fabricName')} style={{ marginBottom: 8 }}>
                    <Input value={f.name} placeholder="Kravet 34521 Linen, Natural" onChange={(e) => set(f.id, { name: e.target.value })} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Item label={t('estimates.vendor')} style={{ marginBottom: 8 }}>
                    <Input value={f.vendor ?? ''} onChange={(e) => set(f.id, { vendor: e.target.value || null })} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Item label={t('estimates.sidemark')} style={{ marginBottom: 8 }}>
                    <Input value={f.sidemark ?? ''} placeholder={sidemarkDefault} onChange={(e) => set(f.id, { sidemark: e.target.value || null })} />
                  </Form.Item>
                </Col>
                {f.kind === 'fabric' && (
                  <Col xs={12} sm={4}>
                    <Form.Item label={t('estimates.wholesale')} style={{ marginBottom: 8 }}>
                      <InputNumber
                        prefix="$"
                        min={0}
                        precision={2}
                        value={f.wholesale}
                        onChange={(v) => set(f.id, { wholesale: v })}
                        style={{ width: '100%' }}
                        inputMode="decimal"
                      />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={12} sm={4}>
                  <Form.Item label={t('estimates.clientPerYard')} style={{ marginBottom: 8 }}>
                    <Typography.Text strong style={{ lineHeight: '32px' }}>
                      {f.kind === 'fabric' ? (f.wholesale ? money(retailPerYard(f)) : '—') : t('estimates.noCharge')}
                    </Typography.Text>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
              <Typography.Text type="secondary">{t('estimates.fabricYardsAll', { n: totalYards(f.id) })}</Typography.Text>
              <Popconfirm title={t('estimates.removeFabricConfirm')} okText={t('estimates.removeFabric')} cancelText={t('common.cancel')} onConfirm={() => onRemove(f.id)}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />}>
                  {t('estimates.removeFabric')}
                </Button>
              </Popconfirm>
            </Space>
          </Card>
        ))}
      </Space>
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
  install_same: boolean
  install_name: string | null
  install_address: string | null
  deposit_pct: number
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
    install_same: true,
    install_name: null,
    install_address: null,
    deposit_pct: 50,
  })
  const [lines, setLines] = useState<EstimateLine[]>(() =>
    ((location.state as { lines?: NewLine[] } | null)?.lines ?? []).map((l) => blankLine(l)),
  )
  const [groups, setGroups] = useState<EstimateGroup[]>([])
  const [fabrics, setFabrics] = useState<EstimateFabric[]>([])
  const [removedFabrics, setRemovedFabrics] = useState<string[]>([])
  const [removedGroups, setRemovedGroups] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [clientEdit, setClientEdit] = useState<ClientDraft | null>(null)
  const [replaced, setReplaced] = useState<{ code: string; date: string; id: string } | null>(null)
  // Sent, Accepted and Declined are kept as the client saw them: only the status changes.
  const locked = !!loaded && isLocked(loaded)

  useEffect(() => {
    listClients().then(setClients, (e) => setLoadError(e.message))
    if (isNew) return
    getEstimate(estimateId!).then(
      (e) => {
        setLoaded(e)
        if (e.replaces_id)
          getReplaced(e.replaces_id).then(
            (r) => r && setReplaced({ id: r.id, code: estimateCode(r), date: r.estimate_date }),
            () => setReplaced(null),
          )
        setFields({
          store: e.store,
          client_id: e.client_id,
          title: e.title,
          status: e.status,
          estimate_date: e.estimate_date,
          notes: e.notes,
          terms: e.terms,
          install_same: e.install_same,
          install_name: e.install_name,
          install_address: e.install_address,
          deposit_pct: e.deposit_pct,
        })
        setLines(e.lines)
        setGroups(e.groups)
        setFabrics(e.fabrics)
        setRemovedGroups([])
        setRemovedFabrics([])
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

  const changeFabrics = (next: EstimateFabric[]) => {
    setFabrics(next)
    setLines((ls) => syncFabricLines(ls, next).lines)
    setDirty(true)
  }
  const removeFabric = (id: string) => {
    const next = fabrics.filter((f) => f.id !== id)
    setFabrics(next)
    setLines((ls) =>
      syncFabricLines(
        ls.map((l) => (l.fabric_uses?.some((u) => u.fabric_id === id) ? { ...l, fabric_uses: l.fabric_uses.filter((u) => u.fabric_id !== id) } : l)),
        next,
      ).lines,
    )
    if (loaded?.fabrics.some((f) => f.id === id)) setRemovedFabrics((r) => [...r, id])
    setDirty(true)
  }

  const set = (patch: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...patch }))
    setDirty(true)
  }
  // Fabric lines follow the items: every change to lines re-adds them.
  const editLines = (fn: (ls: EstimateLine[]) => EstimateLine[]) => setLines((ls) => syncFabricLines(fn(ls), fabrics).lines)
  const updateLine = (id: string, patch: Partial<EstimateLine>) => {
    editLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    setDirty(true)
  }
  /** Swaps a line with its neighbour in the same room (or among lines not in a room). */
  const moveLine = (id: string, dir: -1 | 1) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.id === id)
      const room = ls[i].group_id ?? null
      let j = i + dir
      while (j >= 0 && j < ls.length && ((ls[j].group_id ?? null) !== room || ls[j].kind === 'fabric')) j += dir
      if (j < 0 || j >= ls.length) return ls
      const next = [...ls]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setDirty(true)
  }
  const addLine = (groupId: string | null) => {
    setLines((ls) => {
      const inRoom = ls.filter((l) => (l.group_id ?? null) === groupId)
      return [...ls, blankLine({ section: inRoom[inRoom.length - 1]?.section ?? null, unit: 'ea', group_id: groupId })]
    })
    setDirty(true)
  }
  // Tools open tied to this saved estimate; unsaved edits would be lost, so save first.
  const openToolFor = (l: EstimateLine) =>
    l.spec && loaded && !dirty && !locked
      ? () => navigate(`${TOOL_ROUTES[l.spec!.tool]}?estimate=${loaded.id}&worksheet=${l.spec!.worksheet}`)
      : undefined
  const addFromTool = (tool: WorksheetTool, groupId: string | null) => {
    if (!loaded) return
    navigate(`${TOOL_ROUTES[tool]}?estimate=${loaded.id}${groupId ? `&group=${groupId}` : ''}`)
  }
  const toolButtons = (groupId: string | null) =>
    !isNew && !locked && (
      <>
        {(['cushionPricing', 'upholstery', 'pillowPricing'] as const).map((tool) => (
          <Button
            key={tool}
            icon={<PlusOutlined />}
            disabled={dirty}
            title={dirty ? t('estimates.saveFirst') : undefined}
            onClick={() => addFromTool(tool, groupId)}
          >
            {t(`estimates.add_${tool}`)}
          </Button>
        ))}
      </>
    )
  const addGroup = () => {
    const g: EstimateGroup = { id: crypto.randomUUID(), name: '', approved: true }
    setGroups((gs) => [...gs, g])
    // The first room collects the lines already on the estimate.
    if (groups.length === 0) editLines((ls) => ls.map((l) => ({ ...l, group_id: g.id })))
    setDirty(true)
  }
  const updateGroup = (id: string, patch: Partial<EstimateGroup>) => {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    setDirty(true)
  }
  const moveGroup = (i: number, dir: -1 | 1) => {
    setGroups((gs) => {
      const next = [...gs]
      ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
      return next
    })
    setDirty(true)
  }
  const removeGroup = (id: string) => {
    setGroups((gs) => gs.filter((g) => g.id !== id))
    editLines((ls) => ls.map((l) => (l.group_id === id ? { ...l, group_id: null } : l)))
    if (loaded?.groups.some((g) => g.id === id)) setRemovedGroups((r) => [...r, id])
    setDirty(true)
  }
  const removeLine = (id: string) => {
    editLines((ls) => ls.filter((l) => l.id !== id))
    setDirty(true)
  }

  const sections = useMemo(() => [...new Set(lines.map((l) => l.section?.trim()).filter((s): s is string => !!s))], [lines])
  const total = estimateTotal(lines)
  const totals = groupTotals(groups, lines)
  const deposit = depositAmount(groups, lines, fields.deposit_pct)
  const groupIds = new Set(groups.map((g) => g.id))
  const looseLines = lines.filter((l) => !l.group_id || !groupIds.has(l.group_id))
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
        install_same: fields.install_same,
        install_name: fields.install_same ? null : fields.install_name?.trim() || null,
        install_address: fields.install_same ? null : fields.install_address?.trim() || null,
        deposit_pct: fields.deposit_pct,
      })
      // Lines first move off rooms being removed, then rooms, then lines.
      await saveGroups(loaded.id, groups, [])
      await saveFabrics(loaded.id, fabrics, [])
      const removedIds = loaded.lines.filter((l) => !lines.some((x) => x.id === l.id)).map((l) => l.id)
      await saveLines(loaded.id, lines, removedIds)
      if (removedGroups.length) await saveGroups(loaded.id, [], removedGroups)
      if (removedFabrics.length) await saveFabrics(loaded.id, [], removedFabrics)
      const fresh = await getEstimate(loaded.id)
      setLoaded(fresh)
      setLines(fresh.lines)
      setGroups(fresh.groups)
      setFabrics(fresh.fabrics)
      setRemovedGroups([])
      setRemovedFabrics([])
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
      await downloadEstimatePdf({ ...loaded, ...fields, client, lines, groups, fabrics }, replaced ? { code: replaced.code, date: replaced.date } : null)
    } catch (e) {
      msg.error(errorText(e))
    }
  }

  const revise = async () => {
    if (!loaded) return
    setBusy(true)
    try {
      const id = await createRevision(loaded.id)
      navigate(`/estimates/${id}`)
    } catch (e) {
      msg.error(errorText(e))
    } finally {
      setBusy(false)
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

  const renderLine = (l: EstimateLine, i: number, count: number) =>
    l.kind === 'fabric' ? (
      <FabricLineCard
        key={l.id}
        line={l}
        fabric={fabrics.find((f) => f.id === l.fabric_id)}
        need={l.fabric_id ? fabricNeed(lines, l.fabric_id, l.group_id) : 0}
        update={(patch) => updateLine(l.id, patch)}
      />
    ) : (
      <LineCard
        key={l.id}
        line={l}
        index={i}
        count={count}
        sections={sections}
        groups={groups}
        fabrics={fabrics}
        openTool={openToolFor(l)}
        update={(patch) => updateLine(l.id, patch)}
        move={(dir) => moveLine(l.id, dir)}
        remove={() => removeLine(l.id)}
      />
    )

  if (loadError) return <Alert type="error" title={loadError} style={{ margin: 24 }} />
  if (!isNew && !loaded) return <FullScreenLoader />

  return (
    <ConfigProvider componentDisabled={locked}>
    <div style={{ maxWidth: 880, width: '100%', margin: '0 auto', padding: '16px 16px 120px' }}>
      {ctx}
      <Link to="/estimates">
        <Button type="link" disabled={false} icon={<ArrowLeftOutlined />} style={{ paddingInline: 0 }}>
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
      {replaced && (
        <Typography.Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
          {t('estimates.revisionOf', { n: loaded?.revision, code: replaced.code })}{' '}
          <Link to={`/estimates/${replaced.id}`}>
            <Button type="link" size="small" disabled={false} style={{ paddingInline: 0 }}>
              {t('estimates.openReplaced')}
            </Button>
          </Link>
        </Typography.Paragraph>
      )}
      {locked && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          title={t('estimates.lockedTitle', { status: t(`estimates.statuses.${loaded!.status}`) })}
          description={t('estimates.lockedBody')}
          action={
            <Button type="primary" disabled={false} loading={busy} onClick={revise}>
              {t('estimates.revise')}
            </Button>
          }
        />
      )}

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
                  disabled={false}
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

        <Space style={{ width: '100%', justifyContent: 'space-between', marginTop: 8 }} align="center" wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('estimates.lines')}
          </Typography.Title>
          {!isNew && (
            <Button icon={<PlusOutlined />} onClick={addGroup}>
              {t('estimates.addRoom')}
            </Button>
          )}
        </Space>
        {lines.length === 0 && groups.length === 0 && <Typography.Text type="secondary">{t('estimates.noLines')}</Typography.Text>}
        {groups.length > 0 && <Typography.Text type="secondary">{t('estimates.roomsHelp')}</Typography.Text>}

        {totals.rooms.map(({ group: g, total: sub }, gi) => {
          const inRoom = lines.filter((l) => l.group_id === g.id)
          return (
            <div key={g.id} style={{ border: '1px solid var(--ant-color-border-secondary, #e5e5e5)', borderRadius: 10, padding: 12 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} align="center" wrap>
                <Input
                  size="large"
                  aria-label={t('estimates.roomName')}
                  placeholder={t('estimates.roomPlaceholder')}
                  value={g.name}
                  onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                  style={{ minWidth: 200, fontWeight: 600 }}
                />
                <Space size={4} wrap align="center">
                  <Switch checked={g.approved} onChange={(v) => updateGroup(g.id, { approved: v })} aria-label={t('estimates.clientApproved')} />
                  <Typography.Text type={g.approved ? undefined : 'secondary'}>{t('estimates.clientApproved')}</Typography.Text>
                  <Button type="text" icon={<ArrowUpOutlined />} aria-label={t('estimates.moveUp')} disabled={gi === 0} onClick={() => moveGroup(gi, -1)} />
                  <Button type="text" icon={<ArrowDownOutlined />} aria-label={t('estimates.moveDown')} disabled={gi === groups.length - 1} onClick={() => moveGroup(gi, 1)} />
                  <Popconfirm
                    title={t('estimates.removeRoomConfirm')}
                    okText={t('estimates.removeRoom')}
                    cancelText={t('common.cancel')}
                    onConfirm={() => removeGroup(g.id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('estimates.removeRoom')} />
                  </Popconfirm>
                </Space>
              </Space>
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                {inRoom.length === 0 && <Typography.Text type="secondary">{t('estimates.emptyRoom')}</Typography.Text>}
                {roomOrder(inRoom).map((l, i) => renderLine(l, i, inRoom.filter((x) => x.kind !== 'fabric').length))}
                <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                  <Space wrap>
                    {toolButtons(g.id)}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => addLine(g.id)}>
                      {t('estimates.addLine')}
                    </Button>
                  </Space>
                  <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {t('estimates.roomSubtotal', { name: g.name.trim() || t('estimates.unnamedRoom') })}: {money(sub)}
                  </Typography.Text>
                </Space>
              </Space>
            </div>
          )
        })}

        {groups.length > 0 && looseLines.length > 0 && (
          <Typography.Title level={5} style={{ margin: '8px 0 0' }}>
            {t('estimates.noRoom')}
          </Typography.Title>
        )}
        {roomOrder(looseLines).map((l, i) => renderLine(l, i, looseLines.filter((x) => x.kind !== 'fabric').length))}
        {groups.length === 0 && (
          <Space wrap style={{ width: '100%' }}>
            {toolButtons(null)}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => addLine(null)}>
              {t('estimates.addLine')}
            </Button>
          </Space>
        )}
        {!isNew && dirty && <Typography.Text type="secondary">{t('estimates.saveFirst')}</Typography.Text>}

        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Statistic title={t('estimates.total')} value={money(total)} valueStyle={{ fontWeight: 700 }} />
            </Col>
            {!isNew && (
              <Col xs={24} sm={12}>
                <Statistic title={t('estimates.depositTitle', { pct: fields.deposit_pct })} value={money(deposit)} />
                <Space style={{ marginTop: 8 }} wrap>
                  <InputNumber
                    aria-label={t('estimates.depositPct')}
                    min={0}
                    max={100}
                    precision={0}
                    suffix="%"
                    value={fields.deposit_pct}
                    onChange={(v) => set({ deposit_pct: v ?? 0 })}
                    style={{ width: 100 }}
                  />
                  {groups.length > 0 && <Typography.Text type="secondary">{t('estimates.depositRooms')}</Typography.Text>}
                </Space>
              </Col>
            )}
          </Row>
        </Card>

        {!isNew && (
          <FabricsCard
            fabrics={fabrics}
            lines={lines}
            sidemarkDefault={[client?.name, fields.title.trim()].filter(Boolean).join(' / ')}
            onChange={changeFabrics}
            onRemove={removeFabric}
          />
        )}

        {!isNew && (
          <Card title={t('estimates.installAt')}>
            <Segmented
              block
              value={fields.install_same ? 'same' : 'different'}
              onChange={(v) => set({ install_same: v === 'same' })}
              options={[
                { value: 'same', label: t('estimates.installSame') },
                { value: 'different', label: t('estimates.installDifferent') },
              ]}
            />
            {fields.install_same ? (
              <Typography.Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
                {client?.address?.trim() ? client.address : t('estimates.installSameHelp')}
              </Typography.Paragraph>
            ) : (
              <Form layout="vertical" component="div" style={{ marginTop: 12 }}>
                <Form.Item label={t('estimates.installName')} htmlFor="est-iname" extra={t('estimates.installNameHelp')} style={{ marginBottom: 12 }}>
                  <Input id="est-iname" value={fields.install_name ?? ''} onChange={(e) => set({ install_name: e.target.value })} />
                </Form.Item>
                <Form.Item label={t('estimates.address')} htmlFor="est-iaddr" style={{ marginBottom: 0 }}>
                  <Input.TextArea
                    id="est-iaddr"
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    value={fields.install_address ?? ''}
                    onChange={(e) => set({ install_address: e.target.value })}
                  />
                </Form.Item>
              </Form>
            )}
          </Card>
        )}

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
            okButtonProps={{ danger: true, disabled: false }}
            cancelButtonProps={{ disabled: false }}
            cancelText={t('common.cancel')}
            onConfirm={remove}
          >
            <Button danger disabled={false} icon={<DeleteOutlined />}>
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
              {!isNew && (
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                  {t('estimates.depositShort')}: {money(deposit)}
                </Typography.Text>
              )}
              {!isNew && (
                <Typography.Text type={dirty ? 'warning' : 'success'} style={{ marginLeft: 8, fontWeight: 400 }}>
                  {dirty ? t('estimates.unsaved') : t('estimates.allSaved')}
                </Typography.Text>
              )}
            </Typography.Text>
            {isNew ? (
              <Button type="primary" size="large" loading={busy} onClick={create}>
                {t('estimates.create')}
              </Button>
            ) : (
              <>
                <Button size="large" disabled={false} icon={<FilePdfOutlined />} onClick={pdf}>
                  {t('estimates.pdf')}
                </Button>
                <Button
                  type="primary"
                  size="large"
                  loading={busy}
                  disabled={!dirty}
                  icon={dirty ? undefined : <CheckOutlined />}
                  onClick={save}
                >
                  {dirty ? t('common.save') : t('estimates.saved')}
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
    </ConfigProvider>
  )
}
