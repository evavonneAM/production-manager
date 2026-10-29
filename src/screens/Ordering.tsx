import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Col,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
  message,
  theme,
} from 'antd'
import { CarOutlined, CopyOutlined, ExportOutlined, MailOutlined, MoreOutlined, PlusOutlined, ShopOutlined, SyncOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  carrierTrackingUrl,
  dismissTracking,
  getAllMaterials,
  getDepartments,
  getDirectory,
  getTrackingNumbers,
  matchTracking,
  receiveMaterial,
  setMaterialFulfillment,
  setMaterialStatus,
  syncSheetsNow,
  type TrackingNumber,
} from '../lib/data'
import { getSupplyRequests, setSupplyRequestStatus, useRequestPhotos, type SupplyRequestStatus } from '../lib/supplyRequests'
import { SupplyRequestCard, SupplyRequestModal } from '../components/SupplyRequests'
import { localized } from '../lib/i18nText'
import { formatDate } from '../lib/format'
import { buildOrderEmail, copyOrderEmail } from '../lib/orderEmail'
import { FullScreenLoader } from '../components/FullScreenLoader'

type Tab = 'fabric' | 'supplies' | 'requests'
type State = 'needs' | 'payment' | 'expected' | 'ordered' | 'partial' | 'here'
type Filter = 'open' | State

const FABRIC_CATS = ['fabric', 'com']

// Supplies sections in the owner's order (2026-10-29). 'hardware' is legacy and
// shows with 'other' as Components/Other.
const SUPPLY_SECTIONS: { key: string; cats: string[] }[] = [
  { key: 'insert', cats: ['insert'] },
  { key: 'foam', cats: ['foam'] },
  { key: 'upholstery_supplies', cats: ['upholstery_supplies'] },
  { key: 'drapery_supplies', cats: ['drapery_supplies'] },
  { key: 'drapery_hardware', cats: ['drapery_hardware'] },
  { key: 'other', cats: ['other', 'hardware'] },
  { key: 'wood_shop', cats: ['wood_shop'] },
]

const STATE_COLOR: Record<State, string> = {
  needs: 'red',
  payment: 'orange',
  expected: 'cyan',
  ordered: 'blue',
  partial: 'gold',
  here: 'green',
}
const STATE_LABEL: Record<State, string> = {
  needs: 'ordering.needs',
  payment: 'ordering.payment',
  expected: 'ordering.expected',
  ordered: 'ordering.ordered',
  partial: 'ordering.partial',
  here: 'ordering.here',
}

const CARRIER_LABEL: Record<string, string> = { ups: 'UPS', fedex: 'FedEx', usps: 'USPS', other: '—' }

type Mat = Awaited<ReturnType<typeof getAllMaterials>>[number]

function stateOf(m: Mat): State {
  if (m.is_arrived) return 'here'
  if ((m.received_quantity ?? 0) > 0) return 'partial'
  // COMs are never ordered — the client sends them; they sit in "expected"
  // until the front desk checks them in.
  if (m.category === 'com') return 'expected'
  if (m.is_ordered) return 'ordered'
  if (m.payment_required) return 'payment'
  return 'needs'
}

const fmtQty = (n: number) => String(Math.round(n * 100) / 100)

/** Ordering (owner redesign, 2026-10-29): a list in three tabs. Fabric shows
 *  every fabric with partly-received progress and tracking; Supplies groups by
 *  the workroom's categories or by vendor, with pickup vs delivery; Requests
 *  holds what the team has asked for. Procurement + Admin. */
export default function Ordering() {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('fabric')
  const [filter, setFilter] = useState<Filter>('open')
  const [groupMode, setGroupMode] = useState<'category' | 'vendor'>('category')
  const [pickupOnly, setPickupOnly] = useState(false)
  const [vendorF, setVendorF] = useState('all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [receiving, setReceiving] = useState<Mat | null>(null)
  const [receiveAmount, setReceiveAmount] = useState<number | null>(null)
  const [showTracking, setShowTracking] = useState(false)
  const [matching, setMatching] = useState<TrackingNumber | null>(null)
  const [search, setSearch] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [emailFor, setEmailFor] = useState<Mat[] | null>(null)
  const [toast, toastHolder] = message.useMessage()
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey((k) => k + 1)

  const { data: departments } = useAsync(getDepartments, [])
  const { data: materials, loading, error } = useAsync(getAllMaterials, [reloadKey])
  const { data: tracking } = useAsync(getTrackingNumbers, [reloadKey])
  const { data: requests } = useAsync(getSupplyRequests, [reloadKey])
  const { data: directory } = useAsync(getDirectory, [])

  const procurementId = useMemo(() => departments?.find((d) => d.name === 'Procurement')?.id, [departments])
  const eligible = profile?.role === 'admin' || (!!procurementId && profile?.department_id === procurementId)

  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string) => map.get(id) ?? ''
  }, [directory])

  const shownRequests = useMemo(
    () => (requests ?? []).filter((r) => showDone || r.status !== 'done'),
    [requests, showDone],
  )
  const requestPhotos = useRequestPhotos(tab === 'requests' ? shownRequests : [])

  // Everything in the current tab, before the status filter (for the counts).
  const inTab = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (materials ?? []).filter(
      (m) =>
        (tab === 'fabric' ? FABRIC_CATS.includes(m.category) : !FABRIC_CATS.includes(m.category)) &&
        (vendorF === 'all' || (m.supplier ?? '') === vendorF) &&
        (!pickupOnly || tab !== 'supplies' || m.fulfillment === 'pickup') &&
        (!needle ||
          [m.name, m.supplier ?? '', m.description ?? '', m.job?.job_code ?? '', m.job?.project?.client_name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    )
  }, [materials, tab, vendorF, pickupOnly, q])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { open: 0, needs: 0, payment: 0, expected: 0, ordered: 0, partial: 0, here: 0 }
    for (const m of inTab) {
      const s = stateOf(m)
      c[s]++
      if (s !== 'here') c.open++
    }
    return c
  }, [inTab])

  const shown = inTab.filter((m) => (filter === 'open' ? stateOf(m) !== 'here' : stateOf(m) === filter))

  const vendorOptions = useMemo(
    () => [...new Set((materials ?? []).map((m) => m.supplier ?? ''))].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [materials],
  )

  // material_id → its matched tracking numbers (shown on the row).
  const trackingByMaterial = useMemo(() => {
    const map = new Map<string, TrackingNumber[]>()
    for (const tn of tracking ?? []) {
      if (tn.status === 'matched' && tn.material_id) map.set(tn.material_id, [...(map.get(tn.material_id) ?? []), tn])
    }
    return map
  }, [tracking])
  const toMatch = (tracking ?? []).filter((tn) => tn.status === 'captured')

  if (!profile || (departments && !eligible)) {
    return (
      <div style={{ maxWidth: 768, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        <Alert type="warning" showIcon title={t('ordering.notEligible')} />
      </div>
    )
  }
  if (loading || !departments) return <FullScreenLoader />
  if (error) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  const byId = new Map((materials ?? []).map((m) => [m.id, m]))
  const selectedMats = selected.map((id) => byId.get(id)).filter((m): m is Mat => !!m)

  async function bulk(fn: (m: Mat) => Promise<unknown>) {
    setBusy(true)
    for (const m of selectedMats) await fn(m)
    setBusy(false)
    setSelected([])
    reload()
  }
  const markOrdered = () => bulk((m) => setMaterialStatus(m.id, { is_ordered: true }))
  const markHere = () => bulk((m) => setMaterialStatus(m.id, { is_ordered: true, is_arrived: true }))
  async function setFulfillment(f: 'pickup' | 'delivery') {
    setBusy(true)
    await setMaterialFulfillment(selected, f)
    setBusy(false)
    setSelected([])
    reload()
  }
  async function confirmReceive() {
    if (!receiving || !receiveAmount) return
    setBusy(true)
    await receiveMaterial(receiving, receiveAmount)
    setBusy(false)
    setReceiving(null)
    setSelected([])
    reload()
  }
  async function moveRequest(id: string, status: SupplyRequestStatus) {
    await setSupplyRequestStatus(id, status, profile!.id)
    reload()
  }
  async function doMatch(tn: TrackingNumber, materialId: string | null) {
    setBusy(true)
    await matchTracking(tn.id, materialId)
    setBusy(false)
    setMatching(null)
    setSearch('')
    reload()
  }
  async function doDismiss(tn: TrackingNumber) {
    setBusy(true)
    await dismissTracking(tn.id)
    setBusy(false)
    reload()
  }

  // Not-yet-ordered items first; a vendor with nothing waiting gets all of them.
  const openEmail = (items: Mat[]) => {
    const waiting = items.filter((m) => !m.is_ordered && !m.is_arrived)
    setEmailFor(waiting.length ? waiting : items)
  }
  const email = emailFor ? buildOrderEmail(emailFor) : null
  const emailVendors = [...new Set((emailFor ?? []).map((m) => m.supplier ?? ''))]
  async function copyEmail() {
    if (!email) return
    if (await copyOrderEmail(email)) void toast.success(t('ordering.copied'))
    else void toast.error(t('ordering.copyFailed'))
  }
  async function emailMarkOrdered() {
    if (!emailFor) return
    setBusy(true)
    for (const m of emailFor) if (!m.is_ordered) await setMaterialStatus(m.id, { is_ordered: true })
    setBusy(false)
    setEmailFor(null)
    setSelected([])
    reload()
  }

  const sectionLabel = (text: string) => (
    <Typography.Text
      style={{ display: 'block', margin: '18px 0 6px', fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
    >
      {text}
    </Typography.Text>
  )
  const code = (c: string) => <span style={{ fontFamily: token.fontFamilyCode }}>{c}</span>

  // Native <select> (Ant Select has frozen in the owner's browser), styled like an Ant input.
  const selectStyle: CSSProperties = {
    height: 32,
    padding: '0 8px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
  }

  const groups: { key: string; label: string; items: Mat[] }[] =
    tab === 'fabric'
      ? [{ key: 'all', label: '', items: shown }]
      : groupMode === 'category'
        ? SUPPLY_SECTIONS.map((sec) => ({
            key: sec.key,
            label: t(`materialCategory.${sec.key}`),
            items: shown.filter((m) => sec.cats.includes(m.category)),
          })).filter((g) => g.items.length > 0)
        : [...new Set(shown.map((m) => m.supplier ?? ''))]
            .sort((a, b) => a.localeCompare(b))
            .map((v) => ({
              key: v || '(none)',
              label: v === 'Use Inventory' ? t('materials.useInventory') : v || t('ordering.noVendor'),
              items: shown.filter((m) => (m.supplier ?? '') === v),
            }))

  const row = (m: Mat, last: boolean) => {
    const st = stateOf(m)
    const got = m.received_quantity ?? 0
    return (
      <div
        key={m.id}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '10px 12px',
          borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Checkbox
          checked={selected.includes(m.id)}
          onChange={(e) => setSelected(e.target.checked ? [...selected, m.id] : selected.filter((x) => x !== m.id))}
          style={{ marginTop: 2 }}
          aria-label={m.name}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <Typography.Text strong ellipsis>
              {localized(m.name, m.name_i18n, i18n.language)}
            </Typography.Text>
            <Tag color={STATE_COLOR[st]} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
              {t(STATE_LABEL[st])}
            </Tag>
          </div>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
            {st === 'partial'
              ? t('ordering.receivedOf', { got: fmtQty(got), qty: fmtQty(m.quantity), unit: m.unit ?? '' })
              : `${fmtQty(m.quantity)}${m.unit ? ` ${m.unit}` : ''}`}
            {m.supplier ? ` · ${m.supplier === 'Use Inventory' ? t('materials.useInventory') : m.supplier}` : ''}
            {m.job && (
              <>
                {' · '}
                <Link to={`/jobs/${m.job.id}?tab=materials&m=${m.id}`}>
                  {code(m.job.job_code)}
                  {m.job.project ? ` · ${m.job.project.client_name}` : ''}
                </Link>
              </>
            )}
          </Typography.Text>
          {m.description && (
            <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
              {m.description}
            </Typography.Text>
          )}
          {st === 'partial' && (
            <Progress
              percent={Math.min(100, Math.round((got / Math.max(m.quantity, 1)) * 100))}
              showInfo={false}
              size="small"
              strokeColor={token.colorWarning}
              style={{ margin: '2px 0 0', maxWidth: 220 }}
            />
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {m.fulfillment === 'pickup' && (
              <Tag icon={<ShopOutlined />} color="orange" bordered={false}>
                {t('ordering.pickup')}
              </Tag>
            )}
            {m.fulfillment === 'delivery' && (
              <Tag icon={<CarOutlined />} bordered={false}>
                {t('ordering.delivery')}
              </Tag>
            )}
            {(trackingByMaterial.get(m.id) ?? []).map((tn) => {
              const url = carrierTrackingUrl(tn)
              const label = `${CARRIER_LABEL[tn.carrier]} ${tn.tracking_number}`
              return (
                <Tag key={tn.id} color="purple" bordered={false} style={{ fontFamily: token.fontFamilyCode }}>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {label} <ExportOutlined />
                    </a>
                  ) : (
                    label
                  )}
                </Tag>
              )
            })}
            {tab === 'supplies' && groupMode === 'vendor' && <Tag bordered={false}>{t(`materialCategory.${m.category}`)}</Tag>}
            {m.product_url && (
              <a href={m.product_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                {t('materials.productLink')} <ExportOutlined />
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  const filters: Filter[] =
    tab === 'fabric' ? ['open', 'needs', 'payment', 'expected', 'ordered', 'partial', 'here'] : ['open', 'needs', 'payment', 'ordered', 'partial', 'here']

  // Matching picker: unarrived materials (that's what a shipment can be).
  const pickerMaterials = (materials ?? [])
    .filter((m) => !m.is_arrived)
    .filter((m) => {
      const needle = search.trim().toLowerCase()
      return (
        !needle ||
        [m.name, m.supplier ?? '', m.job?.job_code ?? '', m.job?.project?.client_name ?? ''].join(' ').toLowerCase().includes(needle)
      )
    })

  const openRequests = (requests ?? []).filter((r) => r.status === 'new').length

  return (
    <div style={{ maxWidth: 1152, width: '100%', margin: '0 auto', padding: `24px 16px ${selected.length ? 96 : 24}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('ordering.title')}
        </Typography.Title>
        <Button icon={<SyncOutlined />} onClick={() => void syncSheetsNow().then(reload)}>
          {t('materials.syncNow')}
        </Button>
      </div>

      {toMatch.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('ordering.trackingToMatch', { count: toMatch.length })}
          action={
            <Button size="small" onClick={() => setShowTracking(true)}>
              {t('tracking.match')}
            </Button>
          }
        />
      )}

      <Segmented
        block
        size="large"
        value={tab}
        onChange={(v) => {
          setTab(v as Tab)
          setSelected([])
          setFilter('open')
        }}
        options={[
          { value: 'fabric', label: t('ordering.tabFabric') },
          { value: 'supplies', label: t('ordering.tabSupplies') },
          { value: 'requests', label: `${t('ordering.tabRequests')}${openRequests ? ` · ${openRequests}` : ''}` },
        ]}
      />

      {tab === 'requests' ? (
        <>
          <Button type="primary" icon={<PlusOutlined />} block size="large" style={{ marginTop: 14 }} onClick={() => setRequesting(true)}>
            {t('supplyRequests.button')}
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, margin: '12px 0' }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {t('ordering.showDone')}
            </Typography.Text>
            <Switch size="small" checked={showDone} onChange={setShowDone} />
          </div>
          {shownRequests.length === 0 ? (
            <Empty description={t('ordering.noRequests')} style={{ marginTop: 32 }} />
          ) : (
            <Row gutter={[12, 12]}>
              {shownRequests.map((r) => (
                <Col key={r.id} xs={24} lg={12}>
                <SupplyRequestCard
                  req={r}
                  photos={requestPhotos}
                  who={nameOf(r.requested_by)}
                  actions={
                    r.status === 'new' ? (
                      <>
                        <Button size="small" onClick={() => void moveRequest(r.id, 'ordered')}>
                          {t('supplyRequests.markOrdered')}
                        </Button>
                        <Button size="small" type="primary" onClick={() => void moveRequest(r.id, 'done')}>
                          {t('supplyRequests.markDone')}
                        </Button>
                      </>
                    ) : r.status === 'ordered' ? (
                      <Button size="small" type="primary" onClick={() => void moveRequest(r.id, 'done')}>
                        {t('supplyRequests.markDone')}
                      </Button>
                    ) : null
                  }
                />
                </Col>
              ))}
            </Row>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {filters.map((f) => (
              <Button key={f} size="small" shape="round" type={filter === f ? 'primary' : 'default'} onClick={() => setFilter(f)}>
                {t(f === 'open' ? 'ordering.open' : STATE_LABEL[f])} · {counts[f]}
              </Button>
            ))}
            {tab === 'supplies' && (
              <Button
                size="small"
                shape="round"
                icon={<ShopOutlined />}
                type={pickupOnly ? 'primary' : 'default'}
                ghost={pickupOnly}
                onClick={() => setPickupOnly((v) => !v)}
              >
                {t('ordering.pickupOnly')}
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <Input.Search
              allowClear
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('ordering.search')}
              aria-label={t('ordering.search')}
              style={{ flex: '1 1 200px', maxWidth: 420 }}
            />
            <select value={vendorF} onChange={(e) => setVendorF(e.target.value)} style={selectStyle} aria-label={t('ordering.allVendors')}>
              <option value="all">{t('ordering.allVendors')}</option>
              {vendorOptions.map((v) => (
                <option key={v} value={v}>
                  {v === 'Use Inventory' ? t('materials.useInventory') : v}
                </option>
              ))}
            </select>
            {tab === 'supplies' && (
              <Segmented
                value={groupMode}
                onChange={(v) => setGroupMode(v as 'category' | 'vendor')}
                options={(['category', 'vendor'] as const).map((g) => ({ value: g, label: t(`ordering.group_${g}`) }))}
              />
            )}
          </div>

          {shown.length === 0 ? (
            <Empty description={t('ordering.empty')} style={{ marginTop: 40 }} />
          ) : (
            // Computers: supply sections side by side in two columns.
            <Row gutter={[20, 0]}>
              {groups.map((g) => (
                <Col key={g.key} xs={24} lg={tab === 'supplies' ? 12 : 24}>
                  {g.label ? (
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                      {sectionLabel(`${g.label} · ${g.items.length}`)}
                      {groupMode === 'vendor' && (
                        <Button size="small" type="link" icon={<MailOutlined />} onClick={() => openEmail(g.items)} style={{ marginBottom: 2 }}>
                          {t('ordering.orderEmail')}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div style={{ height: 14 }} />
                  )}
                  <Card styles={{ body: { padding: 0 } }}>{g.items.map((m, i) => row(m, i === g.items.length - 1))}</Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      {/* Bulk actions for the checked rows */}
      {selected.length > 0 && tab !== 'requests' && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            background: token.colorBgContainer,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: '0 -2px 8px rgba(0,0,0,.06)',
          }}
        >
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong style={{ flex: 1 }}>
              {t('ordering.selected', { count: selected.length })}
            </Typography.Text>
            <Button disabled={busy} onClick={() => void markOrdered()}>
              {t('materials.markOrdered')}
            </Button>
            <Button type="primary" disabled={busy} onClick={() => void markHere()}>
              {t('ordering.markHere')}
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  ...(selectedMats.length === 1
                    ? [{ key: 'partial', label: t('ordering.receivedSome') }]
                    : []),
                  { key: 'email', label: t('ordering.orderEmail'), icon: <MailOutlined /> },
                  { key: 'pickup', label: t('ordering.setPickup'), icon: <ShopOutlined /> },
                  { key: 'delivery', label: t('ordering.setDelivery'), icon: <CarOutlined /> },
                ],
                onClick: ({ key }) => {
                  if (key === 'email') setEmailFor(selectedMats)
                  else if (key === 'partial') {
                    const m = selectedMats[0]
                    setReceiveAmount(Math.max(0, m.quantity - (m.received_quantity ?? 0)) || null)
                    setReceiving(m)
                  } else void setFulfillment(key as 'pickup' | 'delivery')
                },
              }}
            >
              <Button icon={<MoreOutlined />} aria-label={t('ordering.more')} disabled={busy} />
            </Dropdown>
          </div>
        </div>
      )}

      {toastHolder}
      <Modal
        open={!!emailFor}
        title={t('ordering.orderEmailTitle', {
          vendor: emailVendors.length === 1 ? emailVendors[0] || t('ordering.noVendor') : t('ordering.severalVendors'),
        })}
        onCancel={() => setEmailFor(null)}
        width={900}
        footer={
          <Space wrap style={{ justifyContent: 'flex-end' }}>
            <Button disabled={busy} onClick={() => void emailMarkOrdered()}>
              {t('ordering.markTheseOrdered')}
            </Button>
            <Button type="primary" icon={<CopyOutlined />} onClick={() => void copyEmail()}>
              {t('ordering.copyEmail')}
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary">{t('ordering.orderEmailHelp')}</Typography.Paragraph>
        {email && (
          <div
            // Built from escaped item fields in lib/orderEmail.
            dangerouslySetInnerHTML={{ __html: email.html }}
            style={{
              padding: 16,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              background: '#fff',
              color: '#222',
              fontSize: 13,
              overflowX: 'auto',
              userSelect: 'text',
            }}
          />
        )}
      </Modal>

      {/* Part of an order came in */}
      <Modal
        open={!!receiving}
        title={t('ordering.receivedTitle')}
        onCancel={() => setReceiving(null)}
        onOk={() => void confirmReceive()}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !receiveAmount }}
        confirmLoading={busy}
        destroyOnHidden
      >
        {receiving && (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Typography.Text strong>{localized(receiving.name, receiving.name_i18n, i18n.language)}</Typography.Text>
            <Typography.Text type="secondary">
              {t('ordering.receivedHelp', {
                got: fmtQty(receiving.received_quantity ?? 0),
                qty: fmtQty(receiving.quantity),
                unit: receiving.unit ?? '',
              })}
            </Typography.Text>
            <InputNumber
              min={0}
              value={receiveAmount}
              onChange={(v) => setReceiveAmount(v)}
              addonAfter={receiving.unit ?? undefined}
              style={{ width: '100%' }}
              autoFocus
            />
          </Space>
        )}
      </Modal>

      {/* Captured tracking numbers waiting to be attached to a material */}
      <Modal open={showTracking} title={t('ordering.tracking')} onCancel={() => setShowTracking(false)} footer={null}>
        {toMatch.length === 0 ? (
          <Empty description={t('tracking.empty')} />
        ) : (
          <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            {toMatch.map((tn) => {
              const url = carrierTrackingUrl(tn)
              return (
                <Card key={tn.id} size="small" styles={{ body: { padding: 12 } }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <Tag color="purple">{CARRIER_LABEL[tn.carrier]}</Tag>
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" style={{ fontFamily: token.fontFamilyCode }}>
                          {tn.tracking_number} <ExportOutlined />
                        </a>
                      ) : (
                        code(tn.tracking_number)
                      )}
                      <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
                        {[tn.sender, tn.email_date ? formatDate(tn.email_date, i18n.language) : null].filter(Boolean).join(' · ')}
                      </Typography.Text>
                      {tn.subject && (
                        <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
                          {tn.subject}
                        </Typography.Text>
                      )}
                    </div>
                    <Space orientation="vertical" size={6} style={{ flexShrink: 0, alignItems: 'stretch' }}>
                      <Button size="small" type="primary" disabled={busy} onClick={() => setMatching(tn)}>
                        {t('tracking.match')}
                      </Button>
                      <Button size="small" disabled={busy} onClick={() => void doDismiss(tn)}>
                        {t('tracking.dismiss')}
                      </Button>
                    </Space>
                  </div>
                </Card>
              )
            })}
          </Space>
        )}
      </Modal>

      <Modal
        open={!!matching}
        title={t('tracking.matchTitle')}
        onCancel={() => setMatching(null)}
        footer={<Button onClick={() => setMatching(null)}>{t('common.cancel')}</Button>}
        destroyOnHidden
      >
        {matching && (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Typography.Text type="secondary" style={{ fontFamily: token.fontFamilyCode }}>
              {CARRIER_LABEL[matching.carrier]} {matching.tracking_number}
            </Typography.Text>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('tracking.search')} allowClear />
            {pickerMaterials.length === 0 ? (
              <Empty description={t('ordering.empty')} />
            ) : (
              <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pickerMaterials.map((m) => (
                  <Card
                    key={m.id}
                    size="small"
                    hoverable
                    onClick={() => !busy && void doMatch(matching, m.id)}
                    styles={{ body: { padding: '8px 12px' } }}
                  >
                    <Typography.Text strong style={{ display: 'block' }}>
                      {localized(m.name, m.name_i18n, i18n.language)}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {m.job ? `${m.job.job_code}${m.job.project ? ` · ${m.job.project.client_name}` : ''} · ` : ''}
                      {m.supplier ?? ''}
                    </Typography.Text>
                  </Card>
                ))}
              </div>
            )}
          </Space>
        )}
      </Modal>

      <SupplyRequestModal
        open={requesting}
        onClose={() => setRequesting(false)}
        onSent={() => {
          setRequesting(false)
          reload()
        }}
      />
    </div>
  )
}
