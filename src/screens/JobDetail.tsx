import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getJob, getDirectory, getJobInspections, submitStage } from '../lib/data'
import { formatMinutes, formatDate } from '../lib/format'
import { EmptyState, ErrorState, Tabs, TaskStatusBadge } from '../components/ui'
import { StagePipeline } from '../components/StagePipeline'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { QrModal } from '../components/QrModal'
import { CreateTaskModal } from '../components/CreateTaskModal'
import { Notes } from '../components/Notes'
import { MaterialsTab } from '../components/MaterialsTab'
import { FilesTab } from '../components/FilesTab'
import { Appointments } from '../components/Appointments'
import { localized } from '../lib/i18nText'
import type { JobDetail as JobDetailT, StageWithDept, Task, JobInspection } from '../lib/types'

function CurrentStageCard({ job, onChanged }: { job: JobDetailT; onChanged: () => void }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = job.stages.find((s) => s.id === job.current_stage_id)
  if (!current) return null
  const tasks = job.tasks.filter((tk) => tk.job_stage_id === current.id)
  const done = tasks.filter((tk) => tk.status === 'completed').length
  const allComplete = tasks.length > 0 && done === tasks.length

  const canSubmit =
    (current.status === 'queued' || current.status === 'in_progress') &&
    (profile?.role === 'admin' ||
      (profile?.role === 'lead' && current.department?.id === profile?.department_id))

  async function doSubmit() {
    setBusy(true)
    setError(null)
    const { error } = await submitStage(current!.id)
    setBusy(false)
    setConfirm(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else onChanged()
  }

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

      {current.status === 'pending_inspection' ? (
        <p className="mt-3 rounded-lg bg-amber-600/10 px-3 py-2 text-center text-sm text-amber-300">
          {t('jobDetail.awaitingInspection')}
        </p>
      ) : (
        canSubmit && (
          <>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={() => setConfirm(true)}
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
            >
              {t('jobDetail.submitForInspection')}
            </button>
          </>
        )
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">{t('jobDetail.submitConfirmTitle')}</h2>
            <p className="mb-5 text-sm text-slate-400">
              {allComplete ? t('jobDetail.submitConfirmBody') : t('jobDetail.submitIncompleteWarn')}
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => void doSubmit()} disabled={busy} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60">
                {t('jobDetail.submitForInspection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TasksTab({ job, nameOf }: { job: JobDetailT; nameOf: (id: string | null) => string }) {
  const { t, i18n } = useTranslation()
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
                <Link
                  key={task.id}
                  to={`/tasks/${task.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 hover:bg-slate-800/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{localized(task.name, task.name_i18n, i18n.language)}</p>
                    <p className="text-xs text-slate-500">
                      {task.assigned_user_id
                        ? nameOf(task.assigned_user_id)
                        : t('jobDetail.unassigned')}
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </Link>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}

function HistoryTab({
  job,
  inspections,
  nameOf,
}: {
  job: JobDetailT
  inspections: JobInspection[]
  nameOf: (id: string | null) => string
}) {
  const { t, i18n } = useTranslation()
  type Event = { label: string; note?: string; when: string }
  const events: Event[] = []

  for (const s of job.stages) {
    if (s.entered_at)
      events.push({ label: t('jobDetail.enteredStage', { dept: s.department?.name }), when: s.entered_at })
  }
  for (const insp of inspections) {
    const dept = insp.job_stage?.department?.name
    const who = nameOf(insp.inspector_id)
    if (insp.decision === 'approved') {
      events.push({ label: t('jobDetail.inspApproved', { dept, name: who }), when: insp.decided_at })
    } else {
      events.push({
        label: t('jobDetail.inspRejected', { dept, name: who }),
        note: insp.note?.original_text ?? undefined,
        when: insp.decided_at,
      })
    }
  }

  events.sort((a, b) => a.when.localeCompare(b.when))
  if (events.length === 0) return <EmptyState text={t('jobDetail.noHistory')} />

  return (
    <ul className="flex flex-col gap-3">
      {events.map((e, i) => (
        <li key={i} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-slate-300">{e.label}</span>
            <span className="shrink-0 text-slate-500">{formatDate(e.when, i18n.language)}</span>
          </div>
          {e.note && <p className="mt-0.5 text-xs italic text-slate-500">"{e.note}"</p>}
        </li>
      ))}
    </ul>
  )
}

export default function JobDetail() {
  const { jobId } = useParams()
  const [searchParams] = useSearchParams()
  const { t, i18n } = useTranslation()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: job, loading, error } = useAsync(() => getJob(jobId as string), [jobId, reloadKey])
  const { data: directory } = useAsync(getDirectory, [])
  const { data: inspections } = useAsync(() => getJobInspections(jobId as string), [jobId, reloadKey])
  // Deep links may open a specific tab (e.g. material QR -> materials, files).
  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState(
    requestedTab && ['tasks', 'materials', 'notes', 'files', 'history'].includes(requestedTab)
      ? requestedTab
      : 'tasks',
  )
  const highlightMaterial = searchParams.get('m')
  const [showQr, setShowQr] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)

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

      <div className="mt-3 mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-3xl font-bold text-amber-300">{job.job_code}</h1>
          <p className="mt-1 text-slate-300">{localized(job.name, job.name_i18n, i18n.language)}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowQr(true)}
          aria-label={t('qr.showQr')}
          className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
          </svg>
        </button>
      </div>

      {showQr && (
        <QrModal
          value={`${window.location.origin}/j/${job.qr_code_uuid}`}
          title={job.job_code}
          onClose={() => setShowQr(false)}
          onPrint={() =>
            void import('../lib/labels').then((m) =>
              m.printJobLabels(
                [{ job_code: job.job_code, name: job.name, qr_code_uuid: job.qr_code_uuid }],
                job.project?.client_name ?? '',
              ),
            )
          }
        />
      )}

      <div className="mb-5 rounded-xl border border-slate-800 bg-slate-800/20 p-4">
        <StagePipeline stages={job.stages} />
      </div>

      <div className="mb-5">
        <CurrentStageCard job={job} onChanged={() => setReloadKey((k) => k + 1)} />
      </div>

      <div className="mb-5">
        <Appointments jobId={job.id} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
          <p className="text-xs text-slate-500">{t('jobDetail.estimated')}</p>
          <p className="text-slate-200">{estHours}{t('units.h')}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
          <p className="text-xs text-slate-500">{t('jobDetail.actual')}</p>
          <p className="text-slate-200">{formatMinutes(actualMin, { h: t('units.h'), m: t('units.m') })}</p>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-5">
        {tab === 'tasks' && (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowCreateTask(true)}
              className="self-start rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              ＋ {t('createTask.add')}
            </button>
            <TasksTab job={job} nameOf={nameOf} />
          </div>
        )}
        {tab === 'materials' && (
          <MaterialsTab
            job={job}
            highlightId={highlightMaterial}
            onChanged={() => setReloadKey((k) => k + 1)}
          />
        )}
        {tab === 'notes' &&
          (job.project ? (
            <Notes scope={{ projectId: job.project.id, jobId: job.id }} />
          ) : (
            <EmptyState text={t('jobDetail.noNotes')} />
          ))}
        {tab === 'files' &&
          (job.project ? (
            <FilesTab projectId={job.project.id} jobId={job.id} />
          ) : (
            <EmptyState text={t('jobDetail.noFiles')} />
          ))}
        {tab === 'history' && (
          <HistoryTab job={job} inspections={inspections ?? []} nameOf={nameOf} />
        )}
      </div>

      {showCreateTask && (
        <CreateTaskModal
          jobId={job.id}
          stages={job.stages}
          directory={directory ?? []}
          defaultStageId={job.current_stage_id ?? undefined}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => {
            setShowCreateTask(false)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
