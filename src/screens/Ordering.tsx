import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getAllMaterials, getDepartments, setMaterialStatus, syncSheetsNow } from '../lib/data'
import { localized } from '../lib/i18nText'
import { EmptyState, ErrorState } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'

type Filter = 'needs' | 'payment' | 'ordered' | 'arrived'

// Fabric + COM share a section (COM rows get their own little chip).
const SECTIONS: { key: string; cats: string[] }[] = [
  { key: 'fabric', cats: ['fabric', 'com'] },
  { key: 'insert', cats: ['insert'] },
  { key: 'foam', cats: ['foam'] },
  { key: 'hardware', cats: ['hardware'] },
  { key: 'other', cats: ['other'] },
]

function statusOf(m: { is_arrived: boolean; is_ordered: boolean; payment_required: boolean }): Filter {
  if (m.is_arrived) return 'arrived'
  if (m.is_ordered) return 'ordered'
  if (m.payment_required) return 'payment'
  return 'needs'
}

/** Ordering dashboard (owner request, Sprint 9b): everything across all jobs,
 *  grouped by category, filtered by procurement state. Procurement + Admin. */
export default function Ordering() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [filter, setFilter] = useState<Filter>('needs')
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: departments } = useAsync(getDepartments, [])
  const { data: materials, loading, error } = useAsync(getAllMaterials, [reloadKey])

  const procurementId = useMemo(
    () => departments?.find((d) => d.name === 'Procurement')?.id,
    [departments],
  )
  const eligible =
    profile?.role === 'admin' || (!!procurementId && profile?.department_id === procurementId)

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { needs: 0, payment: 0, ordered: 0, arrived: 0 }
    for (const m of materials ?? []) c[statusOf(m)]++
    return c
  }, [materials])

  if (!profile || (departments && !eligible)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <ErrorState text={t('ordering.notEligible')} />
      </div>
    )
  }
  if (loading || !departments) return <FullScreenLoader />
  if (error) return <ErrorState text={t('common.error')} />

  const filtered = (materials ?? []).filter((m) => statusOf(m) === filter)

  async function advance(m: (typeof filtered)[number]) {
    setBusyId(m.id)
    if (!m.is_ordered) await setMaterialStatus(m.id, { is_ordered: true })
    else await setMaterialStatus(m.id, { is_arrived: true })
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState text={t('ordering.empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.filter((sec) => filtered.some((m) => sec.cats.includes(m.category))).map((sec) => (
            <div key={sec.key} className="rounded-xl border border-slate-800 bg-slate-800/20 p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t(`materialCategory.${sec.key}`)}
              </h2>
              <div className="flex flex-col gap-2">
                {filtered
                  .filter((m) => sec.cats.includes(m.category))
                  .map((m) => (
                    <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-100">
                            {localized(m.name, m.name_i18n, i18n.language)}
                            {m.category === 'com' && (
                              <span className="ml-2 rounded bg-slate-700/60 px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wide text-slate-400">
                                {t('materialCategory.com')}
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
                          {m.job && (
                            <Link
                              to={`/jobs/${m.job.id}?tab=materials&m=${m.id}`}
                              className="mt-1 inline-block text-xs text-amber-300/90 hover:underline"
                            >
                              <span className="font-mono">{m.job.job_code}</span>
                              {m.job.project ? ` · ${m.job.project.client_name}` : ''}
                            </Link>
                          )}
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
      )}
    </div>
  )
}
