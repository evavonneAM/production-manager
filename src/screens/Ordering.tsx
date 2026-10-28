import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Badge, Button, Card, Col, Empty, Input, Modal, Row, Segmented, Space, Tag, Typography, theme } from 'antd'
import { ExportOutlined, SyncOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  carrierTrackingUrl,
  dismissTracking,
  getAllMaterials,
  getDepartments,
  getTrackingNumbers,
  matchTracking,
  setMaterialStatus,
  syncSheetsNow,
  type TrackingNumber,
} from '../lib/data'
import { localized } from '../lib/i18nText'
import { formatDate } from '../lib/format'
import { FullScreenLoader } from '../components/FullScreenLoader'

type Filter = 'needs' | 'payment' | 'expected' | 'ordered' | 'arrived' | 'tracking'

// Fabric + COM share a section (COM rows get their own little chip).
const SECTIONS: { key: string; cats: string[] }[] = [
  { key: 'fabric', cats: ['fabric', 'com'] },
  { key: 'insert', cats: ['insert'] },
  { key: 'foam', cats: ['foam'] },
  { key: 'hardware', cats: ['hardware'] },
  { key: 'other', cats: ['other'] },
]

// Badge colour per procurement state (filter buttons).
const FILTER_COLOR: Record<Filter, string> = {
  needs: 'red',
  payment: 'orange',
  expected: 'cyan',
  ordered: 'blue',
  arrived: 'green',
  tracking: 'purple',
}

const CARRIER_LABEL: Record<string, string> = { ups: 'UPS', fedex: 'FedEx', usps: 'USPS', other: '—' }

function statusOf(m: { is_arrived: boolean; is_ordered: boolean; payment_required: boolean; category: string }) {
  if (m.is_arrived) return 'arrived' as const
  // COMs are never ordered — the client sends them; they sit in "expected"
  // until the front desk checks them in.
  if (m.category === 'com') return 'expected' as const
  if (m.is_ordered) return 'ordered' as const
  if (m.payment_required) return 'payment' as const
  return 'needs' as const
}

/** Ordering dashboard (owner request, Sprint 9b): everything across all jobs,
 *  grouped by category, filtered by procurement state. Procurement + Admin.
 *  Sprint 12 adds the Tracking tab: captured shipping numbers, human-matched. */
export default function Ordering() {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const [filter, setFilter] = useState<Filter>('needs')
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [matching, setMatching] = useState<TrackingNumber | null>(null)
  const [search, setSearch] = useState('')
  // Procurement batches orders per vendor — grouping is switchable and a
  // single vendor can be filtered in (owner requests).
  const [groupMode, setGroupMode] = useState<'category' | 'vendor'>('category')
  const [vendorF, setVendorF] = useState('all')
  const [q, setQ] = useState('')

  const { data: departments } = useAsync(getDepartments, [])
  const { data: materials, loading, error } = useAsync(getAllMaterials, [reloadKey])
  const { data: tracking } = useAsync(getTrackingNumbers, [reloadKey])

  const procurementId = useMemo(
    () => departments?.find((d) => d.name === 'Procurement')?.id,
    [departments],
  )
  const eligible =
    profile?.role === 'admin' || (!!procurementId && profile?.department_id === procurementId)

  const vendorOptions = useMemo(
    () => [...new Set((materials ?? []).map((m) => m.supplier ?? ''))].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [materials],
  )
  const byVendor = useMemo(
    () => (materials ?? []).filter((m) => vendorF === 'all' || (m.supplier ?? '') === vendorF),
    [materials, vendorF],
  )

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { needs: 0, payment: 0, expected: 0, ordered: 0, arrived: 0, tracking: 0 }
    for (const m of byVendor) c[statusOf(m)]++
    c.tracking = (tracking ?? []).filter((tn) => tn.status === 'captured').length
    return c
  }, [byVendor, tracking])

  // material_id → its matched tracking rows (for chips on material cards).
  const trackingByMaterial = useMemo(() => {
    const map = new Map<string, TrackingNumber[]>()
    for (const tn of tracking ?? []) {
      if (tn.status === 'matched' && tn.material_id)
        map.set(tn.material_id, [...(map.get(tn.material_id) ?? []), tn])
    }
    return map
  }, [tracking])

  if (!profile || (departments && !eligible)) {
    return (
      <div style={{ maxWidth: 672, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        <Alert type="warning" showIcon title={t('ordering.notEligible')} />
      </div>
    )
  }
  if (loading || !departments) return <FullScreenLoader />
  if (error) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  const needle = q.trim().toLowerCase()
  const filtered = byVendor.filter(
    (m) =>
      filter !== 'tracking' &&
      statusOf(m) === filter &&
      (!needle ||
        [m.name, m.supplier ?? '', m.description ?? '', m.job?.job_code ?? '', m.job?.project?.client_name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle)),
  )

  async function advance(m: (typeof filtered)[number]) {
    setBusyId(m.id)
    if (m.category !== 'com' && !m.is_ordered) await setMaterialStatus(m.id, { is_ordered: true })
    else await setMaterialStatus(m.id, { is_arrived: true, is_ordered: true })
    setBusyId(null)
    setReloadKey((k) => k + 1)
  }

  async function doMatch(tn: TrackingNumber, materialId: string | null) {
    setBusyId(tn.id)
    await matchTracking(tn.id, materialId)
    setBusyId(null)
    setMatching(null)
    setSearch('')
    setReloadKey((k) => k + 1)
  }

  async function doDismiss(tn: TrackingNumber) {
    setBusyId(tn.id)
    await dismissTracking(tn.id)
    setBusyId(null)
    setReloadKey((k) => k + 1)
  }

  const chip = (key: Filter) => (
    <Button
      key={key}
      shape="round"
      size="small"
      type={filter === key ? 'primary' : 'default'}
      onClick={() => setFilter(key)}
    >
      <Badge color={FILTER_COLOR[key]} />
      {t(`ordering.${key}`)} · {counts[key]}
    </Button>
  )

  const trackingChip = (tn: TrackingNumber) => {
    const url = carrierTrackingUrl(tn)
    const label = `${CARRIER_LABEL[tn.carrier]} ${tn.tracking_number}`
    return (
      <Tag key={tn.id} color="purple" style={{ marginTop: 4, fontFamily: token.fontFamilyCode, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            {label} <ExportOutlined />
          </a>
        ) : (
          label
        )}
      </Tag>
    )
  }

  // Match picker: unarrived materials first (that's what a shipment can be).
  const pickerMaterials = (materials ?? [])
    .filter((m) => !m.is_arrived)
    .filter((m) => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return [m.name, m.supplier ?? '', m.job?.job_code ?? '', m.job?.project?.client_name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    })

  const trackingRows = (tracking ?? []).filter((tn) =>
    tn.status === 'captured' || tn.status === 'matched')

  const groups =
    groupMode === 'category'
      ? SECTIONS.filter((sec) => filtered.some((m) => sec.cats.includes(m.category))).map((sec) => ({
          key: sec.key,
          label: t(`materialCategory.${sec.key}`),
          items: filtered.filter((m) => sec.cats.includes(m.category)),
        }))
      : [...new Set(filtered.map((m) => m.supplier ?? ''))]
          .sort((a, b) => a.localeCompare(b))
          .map((v) => ({
            key: v || '(none)',
            label: v === 'Use Inventory' ? t('materials.useInventory') : v || t('ordering.noVendor'),
            items: filtered.filter((m) => (m.supplier ?? '') === v),
          }))

  const sectionLabel = (text: string) => (
    <Typography.Text
      style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
    >
      {text}
    </Typography.Text>
  )

  // Native <select> (Ant Select has frozen in the owner's browser), styled like an Ant input.
  const selectStyle = {
    height: 32,
    padding: '0 8px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
  }

  return (
    <div style={{ maxWidth: 1152, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('ordering.title')}
        </Typography.Title>
        <Button icon={<SyncOutlined />} onClick={() => void syncSheetsNow().then(() => setReloadKey((k) => k + 1))}>
          {t('materials.syncNow')}
        </Button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {(['needs', 'payment', 'expected', 'ordered', 'arrived', 'tracking'] as const).map(chip)}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Input.Search
          allowClear
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('ordering.search')}
          aria-label={t('ordering.search')}
          style={{ flex: '1 1 220px', maxWidth: 360 }}
        />
        <select value={vendorF} onChange={(e) => setVendorF(e.target.value)} style={selectStyle} aria-label={t('ordering.allVendors')}>
          <option value="all">{t('ordering.allVendors')}</option>
          {vendorOptions.map((v) => (
            <option key={v} value={v}>{v === 'Use Inventory' ? t('materials.useInventory') : v}</option>
          ))}
        </select>
        {filter !== 'tracking' && (
          <Segmented
            value={groupMode}
            onChange={(v) => setGroupMode(v as 'category' | 'vendor')}
            options={(['category', 'vendor'] as const).map((g) => ({ value: g, label: t(`ordering.group_${g}`) }))}
          />
        )}
      </div>

      {filter === 'tracking' ? (
        trackingRows.length === 0 ? (
          <Empty description={t('tracking.empty')} style={{ marginTop: 32 }} />
        ) : (
          <Space orientation="vertical" size={8} style={{ width: '100%', maxWidth: 672 }}>
            {trackingRows.map((tn) => {
              const url = carrierTrackingUrl(tn)
              return (
                <Card key={tn.id} size="small" styles={{ body: { padding: 12 } }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div>
                        <Tag color="purple">{CARRIER_LABEL[tn.carrier]}</Tag>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" style={{ fontFamily: token.fontFamilyCode }}>
                            {tn.tracking_number} <ExportOutlined />
                          </a>
                        ) : (
                          <span style={{ fontFamily: token.fontFamilyCode }}>{tn.tracking_number}</span>
                        )}
                      </div>
                      <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
                        {[tn.sender, tn.email_date ? formatDate(tn.email_date, i18n.language) : null].filter(Boolean).join(' · ')}
                      </Typography.Text>
                      {tn.subject && (
                        <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
                          {tn.subject}
                        </Typography.Text>
                      )}
                      {tn.status === 'matched' && tn.material && (
                        <Typography.Text type="success" style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
                          {t('tracking.matchedTo')}{' '}
                          {tn.material.job ? (
                            <Link to={`/jobs/${tn.material.job.id}?tab=materials&m=${tn.material.id}`}>
                              {localized(tn.material.name, tn.material.name_i18n, i18n.language)}
                              {' · '}
                              <span style={{ fontFamily: token.fontFamilyCode }}>{tn.material.job.job_code}</span>
                            </Link>
                          ) : (
                            localized(tn.material.name, tn.material.name_i18n, i18n.language)
                          )}
                        </Typography.Text>
                      )}
                    </div>
                    <Space orientation="vertical" size={6} style={{ flexShrink: 0, alignItems: 'stretch' }}>
                      {tn.status === 'captured' ? (
                        <>
                          <Button size="small" type="primary" disabled={busyId === tn.id} onClick={() => setMatching(tn)}>
                            {t('tracking.match')}
                          </Button>
                          <Button size="small" disabled={busyId === tn.id} onClick={() => void doDismiss(tn)}>
                            {t('tracking.dismiss')}
                          </Button>
                        </>
                      ) : (
                        <Button size="small" disabled={busyId === tn.id} onClick={() => void doMatch(tn, null)}>
                          {t('tracking.unmatch')}
                        </Button>
                      )}
                    </Space>
                  </div>
                </Card>
              )
            })}
          </Space>
        )
      ) : filtered.length === 0 ? (
        <Empty description={t('ordering.empty')} style={{ marginTop: 32 }} />
      ) : (
        <Row gutter={[20, 20]}>
          {groups.map((sec) => (
            <Col key={sec.key} xs={24} lg={12} xl={8}>
              {sectionLabel(`${sec.label} · ${sec.items.length}`)}
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {sec.items.map((m) => {
                  const toOrder = m.category !== 'com' && !m.is_ordered
                  return (
                    <Card key={m.id} size="small" styles={{ body: { padding: 12 } }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <Typography.Text strong>
                            {localized(m.name, m.name_i18n, i18n.language)}
                          </Typography.Text>
                          {(m.category === 'com' || groupMode === 'vendor') && (
                            <Tag bordered={false} style={{ marginLeft: 6 }}>
                              {t(`materialCategory.${m.category}`)}
                            </Tag>
                          )}
                          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                            {m.quantity}
                            {m.unit ? ` ${m.unit}` : ''}
                            {m.supplier ? ` · ${m.supplier}` : ''}
                          </Typography.Text>
                          {m.description && (
                            <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
                              {m.description}
                            </Typography.Text>
                          )}
                          {m.product_url && (
                            <a href={m.product_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', fontSize: 13 }}>
                              {t('materials.productLink')} <ExportOutlined />
                            </a>
                          )}
                          {m.job && (
                            <Link to={`/jobs/${m.job.id}?tab=materials&m=${m.id}`} style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
                              <span style={{ fontFamily: token.fontFamilyCode }}>{m.job.job_code}</span>
                              {m.job.project ? ` · ${m.job.project.client_name}` : ''}
                            </Link>
                          )}
                          {(trackingByMaterial.get(m.id) ?? []).map(trackingChip)}
                        </div>
                        {filter !== 'arrived' && (
                          <Button
                            size="small"
                            type="primary"
                            disabled={busyId === m.id}
                            onClick={() => void advance(m)}
                            style={toOrder ? undefined : { background: token.colorSuccess }}
                          >
                            {toOrder ? t('materials.markOrdered') : t('materials.markArrived')}
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </Space>
            </Col>
          ))}
        </Row>
      )}

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
                    onClick={() => busyId !== matching.id && void doMatch(matching, m.id)}
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
    </div>
  )
}
