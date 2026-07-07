import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  getInspectionQueue,
  getDirectory,
  approveStage,
  rejectStage,
} from '../lib/data'
import { formatMinutes } from '../lib/format'
import { EmptyState, ErrorState, TaskStatusBadge } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { localized } from '../lib/i18nText'
import type { InspectionQueueItem } from '../lib/types'
import { type AppLanguage } from '../i18n'

function waitingMinutes(since: string | null): number {
  if (!since) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000))
}

export default function Inspection() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [deptFilter, setDeptFilter] = useState('all')
  const [selected, setSelected] = useState<InspectionQueueItem | null>(null)

  const { data, loading, error } = useAsync(getInspectionQueue, [reloadKey])
  const { data: directory } = useAsync(getDirectory, [])
  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }, [directory])

  const departments = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of data ?? []) if (it.department) m.set(it.department.id, it.department.name)
    return [...m.entries()]
  }, [data])

  const items = (data ?? []).filter(
    (it) => deptFilter === 'all' || it.department?.id === deptFilter,
  )

  function refresh() {
    setSelected(null)
    setReloadKey((k) => k + 1)
  }

  if (loading) return <FullScreenLoader />
  if (error) return <ErrorState text={t('common.error')} />

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('nav.inspection')}</h1>

      {departments.length > 1 && (
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="mb-4 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
        >
          <option value="all">{t('inspection.allDepartments')}</option>
          {departments.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      )}

      {items.length === 0 ? (
        <EmptyState text={t('inspection.empty')} />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setSelected(it)}
              className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-left hover:bg-slate-800/70"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono font-semibold text-amber-300">{it.job?.job_code}</span>
                <span className="text-xs text-slate-500">{it.department?.name}</span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-300">
                {it.job ? localized(it.job.name, it.job.name_i18n, i18n.language) : ''}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t('inspection.submittedBy', { name: nameOf(it.submitted_by) })} ·{' '}
                {t('inspection.waiting', {
                  time: formatMinutes(waitingMinutes(it.submitted_at), { h: t('units.h'), m: t('units.m') }),
                })}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <InspectionPanel
          item={selected}
          canInspect={
            profile?.role === 'admin' ||
            (profile?.role === 'lead' &&
              selected.department?.id === profile?.department_id &&
              selected.submitted_by !== profile?.id)
          }
          onClose={() => setSelected(null)}
          onDone={refresh}
        />
      )}
    </div>
  )
}

function InspectionPanel({
  item,
  canInspect,
  onClose,
  onDone,
}: {
  item: InspectionQueueItem
  canInspect: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onApprove() {
    setBusy(true)
    setError(null)
    const { error } = await approveStage(item.id)
    setBusy(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else onDone()
  }

  async function onReject() {
    if (!note.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await rejectStage(item.id, note.trim(), i18n.language as AppLanguage)
    setBusy(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="font-mono text-lg font-bold text-amber-300">{item.job?.job_code}</p>
          <p className="text-sm text-slate-400">
            {item.job?.name} · {item.department?.name}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('inspection.tasksHeader')}
          </p>
          {item.tasks.length === 0 ? (
            <p className="text-sm text-slate-500">{t('jobDetail.noTasks')}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {item.tasks.map((tk) => (
                <div key={tk.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-300">{localized(tk.name, tk.name_i18n, i18n.language)}</span>
                  <TaskStatusBadge status={tk.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <ErrorState text={error} />}

        {!canInspect ? (
          <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400">
            {t('inspection.notEligible')}
          </p>
        ) : rejecting ? (
          <div className="flex flex-col gap-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('inspection.rejectNotePlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void onReject()}
                disabled={busy || !note.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {t('inspection.confirmReject')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="flex-1 rounded-lg border border-red-600/60 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-600/10"
            >
              {t('inspection.reject')}
            </button>
            <button
              type="button"
              onClick={() => void onApprove()}
              disabled={busy}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-60"
            >
              {t('inspection.approve')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
