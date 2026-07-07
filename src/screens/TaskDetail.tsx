import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getTask, getDirectory, getActiveSession, clockIn, clockOut, completeTask } from '../lib/data'
import { formatMinutes } from '../lib/format'
import { ErrorState, Tabs, TaskStatusBadge } from '../components/ui'
import { Notes } from '../components/Notes'
import { localized } from '../lib/i18nText'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { LiveTimer } from '../components/LiveTimer'

export default function TaskDetail() {
  const { taskId } = useParams()
  const { t, i18n } = useTranslation()
  const { profile, refreshProfile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSwitch, setConfirmSwitch] = useState(false)

  const { data: task, loading, error: loadErr } = useAsync(
    () => getTask(taskId as string),
    [taskId, reloadKey],
  )
  const { data: directory } = useAsync(getDirectory, [])
  const { data: active } = useAsync(() => getActiveSession(profile?.id ?? ''), [profile?.id, reloadKey])

  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }, [directory])

  if (loading) return <FullScreenLoader />
  if (loadErr || !task || !profile) return <ErrorState text={t('common.error')} />

  const myActive = profile.active_task_id
  const isActive = myActive === task.id
  const hasOtherActive = !!myActive && myActive !== task.id
  const stageDept = task.stage?.department?.id ?? null

  const clockable =
    (task.status === 'unstarted' || task.status === 'paused') &&
    (task.assigned_user_id === profile.id ||
      (task.assigned_user_id === null && stageDept === profile.department_id))

  const completable =
    task.status !== 'completed' &&
    task.status !== 'cancelled' &&
    task.status !== 'pending_approval' &&
    (task.assigned_user_id === profile.id ||
      profile.role === 'admin' ||
      (profile.role === 'lead' && stageDept === profile.department_id))

  async function run(fn: () => Promise<{ error: string | null }>) {
    setError(null)
    setBusy(true)
    const { error } = await fn()
    await refreshProfile()
    setBusy(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else setReloadKey((k) => k + 1)
  }

  const onClockIn = () => {
    if (hasOtherActive) setConfirmSwitch(true)
    else void run(() => clockIn(task.id))
  }
  const onSwitch = async () => {
    setConfirmSwitch(false)
    await run(async () => {
      const out = await clockOut()
      if (out.error) return out
      return clockIn(task.id)
    })
  }

  const logs = [...task.labor_logs].sort((a, b) => b.clocked_in_at.localeCompare(a.clocked_in_at))
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {task.job && (
        <Link to={`/jobs/${task.job.id}`} className="text-sm text-slate-400 hover:text-slate-200">
          ← <span className="font-mono">{task.job.job_code}</span> · {task.job.name}
        </Link>
      )}

      <div className="mt-3 mb-5 flex items-start justify-between gap-3">
        <h1 className="text-xl font-semibold">{localized(task.name, task.name_i18n, i18n.language)}</h1>
        <TaskStatusBadge status={task.status} />
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">{t('taskDetail.department')}</dt>
          <dd className="text-slate-200">{task.stage?.department?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('taskDetail.assignee')}</dt>
          <dd className="text-slate-200">
            {task.assigned_user_id ? nameOf(task.assigned_user_id) : t('jobDetail.unassigned')}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('jobDetail.estimated')}</dt>
          <dd className="text-slate-200">{task.estimated_hours ?? 0}{t('units.h')}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('jobDetail.actual')}</dt>
          <dd className="text-slate-200">{formatMinutes(task.actual_minutes, { h: t('units.h'), m: t('units.m') })}</dd>
        </div>
      </dl>

      {/* Clock controls */}
      <div className="mb-6 flex flex-col gap-3">
        {error && <ErrorState text={error} />}

        {isActive && active && (
          <div className="flex items-center justify-between rounded-lg bg-amber-600/10 px-3 py-2 text-amber-200">
            <span className="text-sm">{t('taskDetail.clockedIn')}</span>
            <span className="font-mono text-lg"><LiveTimer since={active.clocked_in_at} /></span>
          </div>
        )}

        <div className="flex gap-3">
          {isActive ? (
            <button
              type="button"
              onClick={() => void run(clockOut)}
              disabled={busy}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
            >
              {t('myWork.clockOut')}
            </button>
          ) : (
            clockable && (
              <button
                type="button"
                onClick={onClockIn}
                disabled={busy}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {t('taskDetail.clockIn')}
              </button>
            )
          )}
          {completable && (
            <button
              type="button"
              onClick={() => void run(() => completeTask(task.id))}
              disabled={busy}
              className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60"
            >
              {t('taskDetail.markComplete')}
            </button>
          )}
        </div>
      </div>

      {/* Clock log */}
      <Tabs tabs={[{ key: 'log', label: t('taskDetail.clockLog') }]} active="log" onChange={() => {}} />
      <div className="mt-4 flex flex-col gap-2">
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{t('taskDetail.noLog')}</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 text-sm">
              <div>
                <p>{nameOf(log.user_id)}</p>
                <p className="text-xs text-slate-500">
                  {fmtTime(log.clocked_in_at)} – {log.clocked_out_at ? fmtTime(log.clocked_out_at) : t('taskDetail.active')}
                  {log.admin_override ? ` · ${t('taskDetail.autoClosed')}` : ''}
                </p>
              </div>
              <span className="text-slate-300">
                {log.duration_minutes != null
                  ? formatMinutes(log.duration_minutes, { h: t('units.h'), m: t('units.m') })
                  : '…'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Task-level notes */}
      {task.job && (
        <div className="mt-8 border-t border-slate-800 pt-6">
          <p className="mb-3 text-sm font-medium text-slate-300">{t('jobDetail.tabNotes')}</p>
          <Notes scope={{ projectId: task.job.project_id, jobId: task.job.id, taskId: task.id }} />
        </div>
      )}

      {/* Switch-task confirmation (S08) */}
      {confirmSwitch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setConfirmSwitch(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">{t('taskDetail.switchTitle')}</h2>
            <p className="mb-5 text-sm text-slate-400">{t('taskDetail.switchBody')}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSwitch(false)}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void onSwitch()}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
              >
                {t('taskDetail.switchConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
