import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getDepartments, setMaterialStatus, deleteMaterial, syncSheetsNow } from '../lib/data'
import { localized } from '../lib/i18nText'
import { EmptyState } from './ui'
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
  const { profile } = useAuth()
  const { data: departments } = useAsync(getDepartments, [])
  const [modal, setModal] = useState<{ open: boolean; material: Material | null }>({ open: false, material: null })
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {canManage ? (
          <button
            type="button"
            onClick={() => setModal({ open: true, material: null })}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            + {t('materials.add')}
          </button>
        ) : (
          <span />
        )}
        {profile?.role === 'admin' && (
          <div className="flex items-center gap-2">
            {syncMsg && <span className="text-xs text-slate-500">{syncMsg}</span>}
            <button
              type="button"
              onClick={() => void onSyncNow()}
              disabled={syncing}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {syncing ? t('materials.syncing') : t('materials.syncNow')}
            </button>
          </div>
        )}
      </div>

      {materials.length === 0 ? (
        <EmptyState text={t('jobDetail.noMaterials')} />
      ) : (
        materials.map((m) => {
          const highlighted = m.id === highlightId
          return (
            <div
              key={m.id}
              className={`rounded-xl border p-3 ${
                highlighted ? 'border-amber-500 bg-amber-500/10' : 'border-slate-800 bg-slate-800/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-100">
                    {localized(m.name, m.name_i18n, i18n.language)}
                    {m.category !== 'other' && (
                      <span className="ml-2 rounded bg-slate-700/60 px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-slate-400">
                        {t(`materialCategory.${m.category}`)}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.quantity}
                    {m.unit ? ` ${m.unit}` : ''}
                    {m.supplier ? ` · ${m.supplier}` : ''}
                  </p>
                  {m.description && <p className="mt-0.5 text-xs text-slate-500">{m.description}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.is_arrived
                      ? 'bg-green-500/15 text-green-300'
                      : m.is_ordered
                        ? 'bg-blue-500/15 text-blue-300'
                        : m.payment_required
                          ? 'bg-orange-500/15 text-orange-300'
                          : 'bg-slate-500/15 text-slate-300'
                  }`}
                >
                  {m.is_arrived
                    ? t('jobDetail.arrived')
                    : m.is_ordered
                      ? t('jobDetail.ordered')
                      : m.payment_required
                        ? t('materials.paymentRequiredShort')
                        : t('jobDetail.notOrdered')}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {!m.is_ordered && !m.is_arrived && (
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => void flip(m, { is_ordered: true })}
                    className="rounded-lg bg-blue-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {t('materials.markOrdered')}
                  </button>
                )}
                {!m.is_arrived && (
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => void flip(m, { is_arrived: true, is_ordered: true })}
                    className="rounded-lg bg-green-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {t('materials.markArrived')}
                  </button>
                )}
                {m.is_arrived && (
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => void flip(m, { is_arrived: false })}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {t('materials.undoArrived')}
                  </button>
                )}

                <span className="flex-1" />

                {m.qr_code_uuid && (
                  <button
                    type="button"
                    onClick={() => setQrFor(m)}
                    aria-label={t('qr.showQr')}
                    className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
                    </svg>
                  </button>
                )}
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => setModal({ open: true, material: m })}
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                    >
                      {t('materials.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(m)}
                      className="rounded-lg border border-red-900/60 px-2.5 py-1.5 text-xs text-red-400/90 hover:bg-red-600/10"
                    >
                      {t('notes.delete')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })
      )}

      {modal.open && (
        <MaterialModal
          jobId={job.id}
          material={modal.material}
          onClose={() => setModal({ open: false, material: null })}
          onSaved={() => {
            setModal({ open: false, material: null })
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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">{t('materials.deleteTitle')}</h2>
            <p className="mb-5 text-sm text-slate-400">{t('materials.deleteBody')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => void onDelete()} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500">
                {t('taskEdit.deleteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
