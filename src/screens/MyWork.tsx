import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getMyWork, getActiveSession, clockOut } from '../lib/data'
import { Tabs, EmptyState, ErrorState, TaskStatusBadge } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { LiveTimer } from '../components/LiveTimer'
import { localized } from '../lib/i18nText'
import type { TaskWithJob, DeptQueueJob } from '../lib/types'

function TaskRow({ task }: { task: TaskWithJob }) {
  const { i18n } = useTranslation()
  return (
    <Link
      to={`/tasks/${task.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 hover:bg-slate-800/70"
    >
      <div className="min-w-0">
        <p className="truncate text-sm">{localized(task.name, task.name_i18n, i18n.language)}</p>
        {task.job && (
          <p className="truncate text-xs text-slate-500">
            <span className="font-mono text-amber-300/80">{task.job.job_code}</span> ·{' '}
            {localized(task.job.name, task.job.name_i18n, i18n.language)}
          </p>
        )}
      </div>
      <TaskStatusBadge status={task.status} />
    </Link>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function DeptQueueRow({ job }: { job: DeptQueueJob }) {
  const { t, i18n } = useTranslation()
  const done = job.tasks.filter((tk) => tk.status === 'completed').length
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 hover:bg-slate-800/70"
    >
      <div className="min-w-0">
        <p className="truncate text-sm">
          <span className="font-mono font-medium text-amber-300">{job.job_code}</span>
          <span className="ml-2 text-slate-400">{localized(job.name, job.name_i18n, i18n.language)}</span>
        </p>
        <p className="text-xs text-slate-500">{t('myWork.tasksProgress', { done, total: job.tasks.length })}</p>
      </div>
    </Link>
  )
}

export default function MyWork() {
  const { t } = useTranslation()
  const { profile, refreshProfile } = useAuth()
  const [tab, setTab] = useState<'mine' | 'dept'>('mine')
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uid = profile?.id ?? ''
  const { data, loading, error: loadErr } = useAsync(
    () => getMyWork(uid, profile?.department_id ?? null),
    [uid, profile?.department_id, reloadKey],
  )
  const { data: active } = useAsync(() => getActiveSession(uid), [uid, reloadKey])

  const groups = useMemo(() => {
    const list = data?.myTasks ?? []
    const activeId = profile?.active_task_id ?? null
    return {
      active: list.find((tk) => tk.id === activeId) ?? null,
      upNext: list.filter(
        (tk) => tk.assigned_user_id === uid && tk.id !== activeId && (tk.status === 'unstarted' || tk.status === 'paused'),
      ),
      pending: list.filter((tk) => tk.created_by === uid && tk.status === 'pending_approval'),
      completed: list.filter((tk) => tk.assigned_user_id === uid && tk.status === 'completed').slice(0, 5),
    }
  }, [data, profile?.active_task_id, uid])

  async function onClockOut() {
    setError(null)
    setBusy(true)
    const { error } = await clockOut()
    await refreshProfile()
    setBusy(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else setReloadKey((k) => k + 1)
  }

  if (!profile) return <FullScreenLoader />

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('nav.myWork')}</h1>

      <Tabs
        tabs={[
          { key: 'mine', label: t('myWork.myTasks') },
          { key: 'dept', label: t('myWork.deptQueue') },
        ]}
        active={tab}
        onChange={(k) => setTab(k as 'mine' | 'dept')}
      />

      {loading && <FullScreenLoader />}
      {loadErr && <ErrorState text={t('common.error')} />}

      {!loading && !loadErr && tab === 'mine' && (
        <div className="mt-5 flex flex-col gap-6">
          {error && <ErrorState text={error} />}

          {/* Active (pinned) */}
          {groups.active && (
            <div className="rounded-xl border border-amber-600/40 bg-amber-600/10 p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-300">{t('myWork.active')}</p>
                {active && <span className="font-mono text-lg text-amber-200"><LiveTimer since={active.clocked_in_at} /></span>}
              </div>
              <Link to={`/tasks/${groups.active.id}`} className="block">
                <p className="text-sm">{groups.active.name}</p>
                {groups.active.job && (
                  <p className="text-xs text-slate-400">
                    <span className="font-mono text-amber-300/80">{groups.active.job.job_code}</span> · {groups.active.job.name}
                  </p>
                )}
              </Link>
              <button
                type="button"
                onClick={() => void onClockOut()}
                disabled={busy}
                className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {busy ? t('common.saving') : t('myWork.clockOut')}
              </button>
            </div>
          )}

          {groups.upNext.length > 0 && (
            <Section title={t('myWork.upNext')}>
              {groups.upNext.map((tk) => <TaskRow key={tk.id} task={tk} />)}
            </Section>
          )}
          {groups.pending.length > 0 && (
            <Section title={t('myWork.pendingApproval')}>
              {groups.pending.map((tk) => <TaskRow key={tk.id} task={tk} />)}
            </Section>
          )}
          {groups.completed.length > 0 && (
            <Section title={t('myWork.recentlyCompleted')}>
              {groups.completed.map((tk) => <TaskRow key={tk.id} task={tk} />)}
            </Section>
          )}

          {!groups.active &&
            groups.upNext.length === 0 &&
            groups.pending.length === 0 &&
            groups.completed.length === 0 && <EmptyState text={t('myWork.noTasks')} />}
        </div>
      )}

      {!loading && !loadErr && tab === 'dept' && (
        <div className="mt-5 flex flex-col gap-2">
          {(data?.deptQueue.length ?? 0) === 0 ? (
            <EmptyState text={t('myWork.noQueue')} />
          ) : (
            data!.deptQueue.map((job) => <DeptQueueRow key={job.id} job={job} />)
          )}
        </div>
      )}
    </div>
  )
}
