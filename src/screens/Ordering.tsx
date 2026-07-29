import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { EmptyState, ErrorState } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'

type Filter = 'needs' | 'payment' | 'ordered' | 'arrived' | 'tracking'

// Fabric + COM share a section (COM rows get their own little chip).
const SECTIONS: { key: string; cats: string[] }[] = [
  { key: 'fabric', cats: ['fabric', 'com'] },
  { key: 'insert', cats: ['insert'] },
  { key: 'foam', cats: ['foam'] },
  { key: 'hardware', cats: ['hardware'] },
  { key: 'other', cats: ['other'] },
]

const CARRIER_LABEL: Record<string, string> = { ups: 'UPS', fedex: 'FedEx', usps: 'USPS', other: '—' }

function statusOf(m: { is_arrived: boolean; is_ordered: boolean; payment_required: boolean }) {
  if (m.is_arrived) return 'arrived' as const
  if (m.is_ordered) return 'ordered' as const
  if (m.payment_required) return 'payment' as const
  return 'needs' as const
}

/** Ordering dashboard (owner request, Sprint 9b): everything across all jobs,
 *  grouped by category, filtered by procurement state. Procurement + Admin.
 *  Sprint 12 adds the Tracking tab: captured shipping numbers, human-matched. */
export default function Ordering() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [filter, setFilter] = useState<Filter>('needs')
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [matching, setMatching] = useState<TrackingNumber | null>(null)
  const [search, setSearch] = useState('')
  // Procurement batches orders per vendor — grouping is switchable (owner request).
  const [groupMode, setGroupMode] = useState<'category' | 'vendor'>('category')

  const { data: departments } = useAsync(getDepartments, [])
  const { data: materials, loading, error } = useAsync(getAllMaterials, [reloadKey])
  const { data: tracking } = useAsync(getTrackingNumbers, [reloadKey])

  const procurementId = useMemo(
    () => departments?.find((d) => d.name === 'Procurement')?.id,
    [departments],
  )
  const eligible =
    profile?.role === 'admin' || (!!procurementId && profile?.department_id === procurementId)

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { needs: 0, payment: 0, ordered: 0, arrived: 0, tracking: 0 }
    for (const m of materials ?? []) c[statusOf(m)]++
    c.tracking = (tracking ?? []).filter((tn) => tn.status === 'captured').length
    return c
  }, [materials, tracking])

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
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <ErrorState text={t('ordering.notEligible')} />
      </div>
    )
  }
  if (loading || !departments) return <FullScreenLoader />
  if (error) return <ErrorState text={t('common.error')} />

  const filtered = (materials ?? []).filter((m) => filter !== 'tracking' && statusOf(m) === filter)

  async function advance(m: (typeof filtered)[number]) {
    setBusyId(m.id)
    if (!m.is_ordered) await setMaterialStatus(m.id, { is_ordered: true })
    else await setMaterialStatus(m.id, { is_arrived: true })
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

  const chip = (key: Filter, style: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
        filter === key ? style : 'bg-slate-800 text-slate-400 hover:text-slate-200'
      }`}
    >
      {t(`ordering.${key}`)} · {counts[key]}
    </button>
  )

  const trackingChip = (tn: TrackingNumber) => {
    const url = carrierTrackingUrl(tn)
    const label = `${CARRIER_LABEL[tn.carrier]} ${tn.tracking_number}`
    return url ? (
      <a
        key={tn.id}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block max-w-full truncate rounded bg-purple-500/15 px-1.5 py-0.5 font-mono text-[10px] text-purple-300 hover:underline"
      >
        {label} ↗
      </a>
    ) : (
      <span key={tn.id} className="mt-1 inline-block rounded bg-purple-500/15 px-1.5 py-0.5 font-mono text-[10px] text-purple-300">
        {label}
      </span>
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('ordering.title')}</h1>
        <button
          type="button"
          onClick={() => void syncSheetsNow().then(() => setReloadKey((k) => k + 1))}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          {t('materials.syncNow')}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {chip('needs', 'bg-red-500/20 text-red-300')}
        {chip('payment', 'bg-orange-500/20 text-orange-300')}
        {chip('ordered', 'bg-blue-500/20 text-blue-300')}
        {chip('arrived', 'bg-green-500/20 text-green-300')}
        {chip('tracking', 'bg-purple-500/20 text-purple-300')}
      </div>

      {filter === 'tracking' ? (
        trackingRows.length === 0 ? (
          <EmptyState text={t('tracking.empty')} />
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
            {trackingRows.map((tn) => {
              const url = carrierTrackingUrl(tn)
              return (
                <div key={tn.id} className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-100">
                        <span className="mr-2 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300">
                          {CARRIER_LABEL[tn.carrier]}
                        </span>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="font-mono hover:underline">
                            {tn.tracking_number} ↗
                          </a>
                        ) : (
                          <span className="font-mono">{tn.tracking_number}</span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {[tn.sender, tn.email_date ? formatDate(tn.email_date, i18n.language) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {tn.subject && <p className="truncate text-xs text-slate-500">{tn.subject}</p>}
                      {tn.status === 'matched' && tn.material && (
                        <p className="mt-1 text-xs text-green-300/90">
                          {t('tracking.matchedTo')}{' '}
                          {tn.material.job ? (
                            <Link
                              to={`/jobs/${tn.material.job.id}?tab=materials&m=${tn.material.id}`}
                              className="hover:underline"
                            >
                              {localized(tn.material.name, tn.material.name_i18n, i18n.language)}
                              {' · '}
                              <span className="font-mono">{tn.material.job.job_code}</span>
                            </Link>
                          ) : (
                            localized(tn.material.name, tn.material.name_i18n, i18n.language)
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {tn.status === 'captured' ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === tn.id}
                            onClick={() => setMatching(tn)}
                            className="rounded-lg bg-purple-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50"
                          >
                            {t('tracking.match')}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === tn.id}
                            onClick={() => void doDismiss(tn)}
                            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                          >
                            {t('tracking.dismiss')}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === tn.id}
                          onClick={() => void doMatch(tn, null)}
                          className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                        >
                          {t('tracking.unmatch')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState text={t('ordering.empty')} />
      ) : (
        <>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-800 p-1 self-start w-fit">
          {(['category', 'vendor'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupMode(g)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                groupMode === g ? 'bg-amber-600/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t(`ordering.group_${g}`)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {(groupMode === 'category'
            ? SECTIONS.filter((sec) => filtered.some((m) => sec.cats.includes(m.category))).map((sec) => ({
                key: sec.key,
                label: t(`materialCategory.${sec.key}`),
                items: filtered.filter((m) => sec.cats.includes(m.category)),
              }))
            : [...new Set(filtered.map((m) => m.supplier ?? ''))]
                .sort((a, b) => a.localeCompare(b))
                .map((v) => ({
                  key: v || '(none)',
                  label:
                    v === 'Use Inventory' ? t('materials.useInventory') : v || t('ordering.noVendor'),
                  items: filtered.filter((m) => (m.supplier ?? '') === v),
                }))
          ).map((sec) => (
            <div key={sec.key} className="rounded-xl border border-slate-800 bg-slate-800/20 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {sec.label} · {sec.items.length}
              </h2>
              <div className="flex flex-col gap-2">
                {sec.items
                  .map((m) => (
                    <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-100">
                            {localized(m.name, m.name_i18n, i18n.language)}
                            {(m.category === 'com' || groupMode === 'vendor') && (
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
                          {m.description && (
                            <p className="mt-0.5 truncate text-xs text-slate-500">{m.description}</p>
                          )}
                          {m.product_url && (
                            <a href={m.product_url} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs text-blue-300/90 hover:underline">
                              {t('materials.productLink')} ↗
                            </a>
                          )}
                          {m.job && (
                            <Link
                              to={`/jobs/${m.job.id}?tab=materials&m=${m.id}`}
                              className="mt-1 inline-block text-xs text-amber-300/90 hover:underline"
                            >
                              <span className="font-mono">{m.job.job_code}</span>
                              {m.job.project ? ` · ${m.job.project.client_name}` : ''}
                            </Link>
                          )}
                          {(trackingByMaterial.get(m.id) ?? []).map(trackingChip)}
                        </div>
                        {filter !== 'arrived' && (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => void advance(m)}
                            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${
                              !m.is_ordered ? 'bg-blue-600/80 hover:bg-blue-500' : 'bg-green-600/80 hover:bg-green-500'
                            }`}
                          >
                            {!m.is_ordered ? t('materials.markOrdered') : t('materials.markArrived')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {matching && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setMatching(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-slate-900 p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold">{t('tracking.matchTitle')}</h2>
            <p className="mb-3 font-mono text-xs text-slate-400">
              {CARRIER_LABEL[matching.carrier]} {matching.tracking_number}
            </p>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tracking.search')}
              className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            {pickerMaterials.length === 0 ? (
              <EmptyState text={t('ordering.empty')} />
            ) : (
              <div className="flex flex-col gap-1.5">
                {pickerMaterials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={busyId === matching.id}
                    onClick={() => void doMatch(matching, m.id)}
                    className="rounded-lg border border-slate-800 bg-slate-800/40 p-3 text-left hover:border-purple-500/50 disabled:opacity-50"
                  >
                    <p className="text-sm text-slate-100">{localized(m.name, m.name_i18n, i18n.language)}</p>
                    <p className="text-xs text-slate-500">
                      {m.job ? `${m.job.job_code}${m.job.project ? ` · ${m.job.project.client_name}` : ''} · ` : ''}
                      {m.supplier ?? ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMatching(null)}
              className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
