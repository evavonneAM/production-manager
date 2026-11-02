import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Empty, Modal, Progress, Tag, Typography, theme } from 'antd'
import { CarOutlined, DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, QrcodeOutlined, ShopOutlined, SyncOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getDepartments, setMaterialStatus, deleteMaterial, syncSheetsNow, MATERIAL_CATEGORIES, type MaterialCategory } from '../lib/data'
import { localized } from '../lib/i18nText'
import { MaterialModal } from './MaterialModal'
import { QrModal } from './QrModal'
import { materialDeepLink } from '../lib/labels'
import type { JobDetail as JobDetailT, Material } from '../lib/types'

export function MaterialsTab({
  job,
  highlightId,
  onChanged,
}: {
  job: JobDetailT
  highlightId?: string | null
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const { data: departments } = useAsync(getDepartments, [])
  const [modal, setModal] = useState<{ open: boolean; material: Material | null; category: MaterialCategory }>({
    open: false,
    material: null,
    category: 'other',
  })
  const [qrFor, setQrFor] = useState<Material | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Material | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const procurementId = useMemo(
    () => departments?.find((d) => d.name === 'Procurement')?.id,
    [departments],
  )
  const canManage =
    profile?.role === 'admin' || (!!procurementId && profile?.department_id === procurementId)

  async function flip(m: Material, patch: { is_ordered?: boolean; is_arrived?: boolean }) {
    setBusyId(m.id)
    await setMaterialStatus(m.id, patch)
    setBusyId(null)
    onChanged()
  }

  async function onDelete() {
    if (!confirmDelete) return
    await deleteMaterial(confirmDelete.id)
    setConfirmDelete(null)
    onChanged()
  }

  async function onSyncNow() {
    setSyncing(true)
    setSyncMsg(null)
    const { error } = await syncSheetsNow()
    setSyncing(false)
    setSyncMsg(error ? t('materials.syncFailed') : t('materials.syncDone'))
    if (!error) onChanged()
  }

  const materials = [...job.materials].sort((a, b) => a.created_at.localeCompare(b.created_at))

  // Same states and colours as the Ordering screen.
  const stateOf = (m: Material) =>
    m.is_arrived
      ? { color: 'green', label: t('jobDetail.arrived') }
      : (m.received_quantity ?? 0) > 0
        ? { color: 'gold', label: t('ordering.receivedOf', { got: m.received_quantity, qty: m.quantity, unit: m.unit ?? '' }) }
        : m.category === 'com'
          ? { color: 'cyan', label: t('jobDetail.expected') }
          : m.is_ordered
            ? { color: 'blue', label: t('jobDetail.ordered') }
            : m.payment_required
              ? { color: 'orange', label: t('materials.paymentRequiredShort') }
              : { color: 'red', label: t('jobDetail.notOrdered') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        {canManage ? (
          // Native <select> (Ant Select has frozen in the owner's browser), styled like a button.
          <label
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 12px',
              color: '#fff',
              background: token.colorPrimary,
              borderRadius: token.borderRadius,
              cursor: 'pointer',
            }}
          >
            <PlusOutlined /> {t('materials.add')}
            <select
              value=""
              aria-label={t('materials.add')}
              onChange={(e) => e.target.value && setModal({ open: true, material: null, category: e.target.value as MaterialCategory })}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            >
              <option value="">{t('materials.add')}</option>
              {MATERIAL_CATEGORIES.filter((cat) => cat !== 'com').map((cat) => (
                <option key={cat} value={cat}>
                  {t(`materialCategory.${cat}`)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        {profile?.role === 'admin' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {syncMsg && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {syncMsg}
              </Typography.Text>
            )}
            <Button icon={<SyncOutlined spin={syncing} />} disabled={syncing} onClick={() => void onSyncNow()}>
              {syncing ? t('materials.syncing') : t('materials.syncNow')}
            </Button>
          </div>
        )}
      </div>

      {materials.length === 0 ? (
        <Empty description={t('jobDetail.noMaterials')} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          {materials.map((m, i) => {
            const highlighted = m.id === highlightId
            const st = stateOf(m)
            return (
              <div
                key={m.id}
                style={{
                  padding: '12px 14px',
                  background: highlighted ? token.colorPrimaryBg : undefined,
                  borderBottom: i === materials.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <Typography.Text strong>{localized(m.name, m.name_i18n, i18n.language)}</Typography.Text>
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                      {m.quantity}
                      {m.unit ? ` ${m.unit}` : ''}
                      {m.supplier ? ` · ${m.supplier}` : ''}
                    </Typography.Text>
                    {m.description && (
                      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                        {m.description}
                      </Typography.Text>
                    )}
                  </div>
                  <Tag color={st.color} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                    {st.label}
                  </Tag>
                </div>
                {(m.received_quantity ?? 0) > 0 && !m.is_arrived && (
                  <Progress
                    percent={Math.min(100, Math.round(((m.received_quantity ?? 0) / Math.max(m.quantity, 1)) * 100))}
                    showInfo={false}
                    size="small"
                    strokeColor={token.colorWarning}
                    style={{ margin: '2px 0 0', maxWidth: 220 }}
                  />
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {m.category !== 'other' && <Tag variant="filled">{t(`materialCategory.${m.category}`)}</Tag>}
                  {m.fulfillment === 'pickup' && (
                    <Tag icon={<ShopOutlined />} color="orange" variant="filled">
                      {t('ordering.pickup')}
                    </Tag>
                  )}
                  {m.fulfillment === 'delivery' && (
                    <Tag icon={<CarOutlined />} variant="filled">
                      {t('ordering.delivery')}
                    </Tag>
                  )}
                  {m.product_url && (
                    <a href={m.product_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                      {t('materials.productLink')} <ExportOutlined />
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  {m.category !== 'com' && !m.is_ordered && !m.is_arrived && (
                    <Button size="small" type="primary" disabled={busyId === m.id} onClick={() => void flip(m, { is_ordered: true })}>
                      {t('materials.markOrdered')}
                    </Button>
                  )}
                  {!m.is_arrived && (
                    <Button
                      size="small"
                      type="primary"
                      disabled={busyId === m.id}
                      style={{ background: token.colorSuccess }}
                      onClick={() => void flip(m, { is_arrived: true, is_ordered: true })}
                    >
                      {t('materials.markArrived')}
                    </Button>
                  )}
                  {m.is_arrived && (
                    <Button size="small" disabled={busyId === m.id} onClick={() => void flip(m, { is_arrived: false })}>
                      {t('materials.undoArrived')}
                    </Button>
                  )}
                  <span style={{ flex: 1 }} />
                  {m.qr_code_uuid && (
                    <Button size="small" type="text" icon={<QrcodeOutlined />} aria-label={t('qr.showQr')} onClick={() => setQrFor(m)} />
                  )}
                  {canManage && (
                    <>
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        aria-label={t('materials.edit')}
                        onClick={() => setModal({ open: true, material: m, category: (m.category as MaterialCategory) ?? 'other' })}
                      />
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('notes.delete')} onClick={() => setConfirmDelete(m)} />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      )}

      {modal.open && (
        <MaterialModal
          jobId={job.id}
          material={modal.material}
          category={modal.category}
          onClose={() => setModal({ open: false, material: null, category: 'other' })}
          onSaved={() => {
            setModal({ open: false, material: null, category: 'other' })
            onChanged()
          }}
        />
      )}

      {qrFor && qrFor.qr_code_uuid && (
        <QrModal
          value={materialDeepLink(job.qr_code_uuid, qrFor.qr_code_uuid)}
          title={localized(qrFor.name, qrFor.name_i18n, i18n.language)}
          onClose={() => setQrFor(null)}
          onPrint={() =>
            void import('../lib/labels').then((m) =>
              m.printMaterialLabel({
                jobCode: job.job_code,
                jobQrUuid: job.qr_code_uuid,
                materialName: localized(qrFor.name, qrFor.name_i18n, i18n.language),
                materialQrUuid: qrFor.qr_code_uuid!,
                qtyLine: `${qrFor.quantity}${qrFor.unit ? ' ' + qrFor.unit : ''}`,
              }),
            )
          }
        />
      )}

      <Modal
        open={!!confirmDelete}
        title={t('materials.deleteTitle')}
        onCancel={() => setConfirmDelete(null)}
        onOk={() => void onDelete()}
        okText={t('taskEdit.deleteConfirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
      >
        {t('materials.deleteBody')}
      </Modal>
    </div>
  )
}
