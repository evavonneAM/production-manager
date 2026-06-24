import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAsync } from '../hooks/useAsync'
import { getJob, getDirectory } from '../lib/data'
import { formatMinutes, formatDate } from '../lib/format'
import { EmptyState, ErrorState, Tabs, TaskStatusBadge } from '../components/ui'
import { StagePipeline } from '../components/StagePipeline'
import { FullScreenLoader } from '../components/FullScreenLoader'
import type { JobDetail as JobDetailT, StageWithDept, Task } from '../lib/types'

function CurrentStageCard({ job }: { job: JobDetailT }) {
  const { t } = useTranslation()
  const current = job.stages.find((s) => s.id === job.current_stage_id)
  if (!current) return null
  const tasks = job.tasks.filter((tk) => tk.job_stage_id === current.id)
  const done = tasks.filter((tk) => tk.status === 'completed').length

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">{t('jobDetail.currentStage')}</p>
          <p className="font-semibold">{current.department?.name}</p>
        </div>
        <span className="text-sm text-slate-400">
          {t('jobDetail.tasksDone', { done, total: tasks.length })}
        </span>
      </div>
      <button
        type="button"
        disabled
        title={t('jobDetail.comingLater')}
        className="mt-3 w-full cursor-not-allowed rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-500"
      >
        {t('jobDetail.submitForInspection')}
      </button>
    </div>
  )
}

function TasksTab({ job, nameOf }: { job: JobDetailT; nameOf: (id: string | null) => string }) {
  const { t } = useTranslation()
  if (job.tasks.length === 0) return <EmptyState text={t('jobDetail.noTasks')} />

  // Group tasks by stage, in routing order.
  const byStage = new Map<string, Task[]>()
  for (const task of job.tasks) {
    const arr = byStage.get(task.job_stage_id) ?? []
    arr.push(task)
    byStage.set(task.job_stage_id, arr)
  }
  const orderedStages = [...job.stages].sort((a, b) => a.sequence - b.sequence)

  return (
    <div className="flex flex-col gap-5">
      {orderedStages
        .filter((stage) => byStage.has(stage.id))
        .map((stage: StageWithDept) => (
          <div key={stage.id}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {stage.department?.name}
            </p>
            <div className="flex flex-col gap-2">
              {byStage.get(stage.id)!.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{task.name}</p>
                    <p className="text-xs text-slate-500">
                      {task.assigned_user_id
                        ? nameOf(task.assigned_user_id)
                        : t('jobDetail.unassigned')}
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

function HistoryTab({ job }: { job: JobDetailT }) {
  const { t, i18n } = useTranslation()
  const events = [...job.stages]
    .sort((a, b) => a.sequence - b.sequence)
    .flatMap((s) => {
      const rows: { label: string; when: string }[] = []
      if (s.entered_at)
        rows.push({ label: t('jobDetail.enteredStage', { dept: s.department?.name }), when: s.entered_at })
      if (s.approved_at)
        rows.push({ label: t('jobDetail.approvedStage', { dept: s.department?.name }), when: s.approved_at })
      return rows
    })
  if (events.length === 0) return <EmptyState text={t('jobDetail.noHistory')} />
  return (
    <ul className="flex flex-col gap-3">
      {events.map((e, i) => (
        <li key={i} className="flex justify-between gap-3 text-sm">
          <span className="text-slate-300">{e.label}</span>
          <span className="shrink-0 text-slate-500">{formatDate(e.when, i18n.language)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function JobDetail() {
  const { jobId } = useParams()
  const { t } = useTranslation()
  const { data: job, loading, error } = useAsync(() => getJob(jobId as string), [jobId])
  const { data: directory } = useAsync(getDirectory, [])
  const [tab, setTab] = useState('tasks')

  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }, [directory])

  if (loading) return <FullScreenLoader />
  if (error || !job) return <ErrorState text={t('common.error')} />

  const estHours = job.tasks.reduce((s, tk) => s + (tk.estimated_hours ?? 0), 0)
  const actualMin = job.tasks.reduce((s, tk) => s + tk.actual_minutes, 0)

  const tabs = [
    { key: 'tasks', label: t('jobDetail.tabTasks') },
    { key: 'materials', label: t('jobDetail.tabMaterials') },
    { key: 'notes', label: t('jobDetail.tabNotes') },
    { key: 'files', label: t('jobDetail.tabFiles') },
    { key: 'history', label: t('jobDetail.tabHistory') },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {job.project && (
        <Link
          to={`/projects/${job.project.id}`}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← {job.project.name}
        </Link>
      )}

      <div className="mt-3 mb-5">
        <h1 className="font-mono text-3xl font-bold text-amber-300">{job.job_code}</h1>
        <p className="mt-1 text-slate-300">{job.name}</p>
      </div>

      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-800/20 p-4">
        <StagePipeline stages={job.stages} />
      </div>

      <div className="mb-5">
        <CurrentStageCard job={job} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
          <p className="text-xs text-slate-500">{t('jobDetail.estimated')}</p>
          <p className="text-slate-200">{estHours}h</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
          <p className="text-xs text-slate-500">{t('jobDetail.actual')}</p>
          <p className="text-slate-200">{formatMinutes(actualMin)}</p>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'tasks' && <TasksTab job={job} nameOf={nameOf} />}
        {tab === 'materials' && (
          job.materials.length === 0 ? (
            <EmptyState text={t('jobDetail.noMaterials')} />
          ) : (
            <div className="flex flex-col gap-2">
              {job.materials.map((m) => (
                <div key={m.id} className="flex justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 text-sm">
                  <span>{m.name}</span>
                  <span className="text-slate-500">
                    {m.is_arrived ? t('jobDetail.arrived') : m.is_ordered ? t('jobDetail.ordered') : t('jobDetail.notOrdered')}
                  </span>
                </div>
              ))}
            </div>
          )
        )}
        {tab === 'notes' && <EmptyState text={t('jobDetail.noNotes')} />}
        {tab === 'files' && <EmptyState text={t('jobDetail.noFiles')} />}
        {tab === 'history' && <HistoryTab job={job} />}
      </div>
    </div>
  )
}
