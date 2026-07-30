import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  createMaterial,
  createTask,
  getErLineItems,
  getProject,
  lineItemToJob,
  setLineItemStatus,
  type ErLineItem,
  type MaterialCategory,
} from '../lib/data'
import { formatMinutes, formatDate } from '../lib/format'
import { StatusBadge, EmptyState, ErrorState, Tabs } from '../components/ui'
import { StagePipeline } from '../components/StagePipeline'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { QrModal } from '../components/QrModal'
import { Notes } from '../components/Notes'
import { FilesTab } from '../components/FilesTab'
import { Appointments } from '../components/Appointments'
import { localized } from '../lib/i18nText'
import { getProjectMaterials } from '../lib/data'
import type { JobWithStages } from '../lib/types'

/** Admin review of line items parsed from the ER proposal (S12): each
 *  suggestion becomes a task on a chosen job + stage, or gets dismissed. */
function ErLineItemsPanel({ jobs, onJobsChanged }: { jobs: JobWithStages[]; onJobsChanged: () => void }) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { projectId } = useParams()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: items } = useAsync(() => getErLineItems(projectId as string), [projectId, reloadKey])
  const [placing, setPlacing] = useState<ErLineItem | null>(null)
  const [mode, setMode] = useState<'task' | 'material'>('task')
  const [jobId, setJobId] = useState('')
  const [stageId, setStageId] = useState('')
  const [category, setCategory] = useState<MaterialCategory>('other')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)

  if (profile?.role !== 'admin') return null
  const open = (items ?? []).filter((it) => it.status === 'suggested')
  const accepted = (items ?? []).filter((it) => it.status === 'accepted')
  if (open.length === 0 && accepted.length === 0) return null

  function startPlacing(it: ErLineItem, asMode: 'task' | 'material') {
    const first = jobs[0]
    setJobId(first?.id ?? '')
    setStageId(first ? currentStageOf(first) : '')
    setCategory('other')
    setQty(it.quantity && it.quantity > 0 ? it.quantity : 1)
    setMode(asMode)
    setPlacing(it)
  }
  const currentStageOf = (j: JobWithStages) =>
    j.stages.find((s) => s.id === j.current_stage_id)?.id ?? j.stages[0]?.id ?? ''

  async function place() {
    if (!placing || !jobId || !profile) return
    setBusy(true)
    if (mode === 'task') {
      if (!stageId) return
      // Specs live on the project Scope, not the task (owner, 2026-07-27).
      const res = await createTask({
        jobId,
        jobStageId: stageId,
        name: placing.name,
        createdBy: profile.id,
      })
      if (!res.error && res.id) await setLineItemStatus(placing.id, 'accepted', { taskId: res.id })
    } else {
      const res = await createMaterial({
        jobId,
        name: placing.name,
        quantity: qty,
        category,
      })
      if (!res.error && res.id) await setLineItemStatus(placing.id, 'accepted', { materialId: res.id })
    }
    setBusy(false)
    setPlacing(null)
    setReloadKey((k) => k + 1)
  }

  async function dismiss(it: ErLineItem) {
    await setLineItemStatus(it.id, 'dismissed')
    setReloadKey((k) => k + 1)
  }

  const [actionError, setActionError] = useState<string | null>(null)

  async function makeJob(it: ErLineItem) {
    setBusy(true)
    setActionError(null)
    const res = await lineItemToJob(it.id)
    setBusy(false)
    setReloadKey((k) => k + 1)
    if (res.error) setActionError(t('common.error'))
    else onJobsChanged()
  }

  const selectedJob = jobs.find((j) => j.id === jobId)

  return (
    <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-300/80">
        {t('erItems.title')}
      </p>
      {actionError && <p className="mb-2 text-sm text-red-400">{actionError}</p>}
      <div className="flex flex-col gap-2">
        {open.map((it) => (
          <div key={it.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-100">
                  {it.name}
                  {it.quantity !== null && it.quantity > 1 && (
                    <span className="ml-1.5 text-xs text-slate-400">×{it.quantity}</span>
                  )}
                </p>
                {it.description && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-slate-500">{t('erItems.specs')}</summary>
                    <p className="mt-1 whitespace-pre-line text-xs text-slate-400">{it.description}</p>
                  </details>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void makeJob(it)}
                  className="rounded-lg bg-green-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {t('erItems.makeJob')}
                </button>
                <button
                  type="button"
                  onClick={() => startPlacing(it, 'task')}
                  className="rounded-lg bg-amber-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
                >
                  {t('erItems.makeTask')}
                </button>
                <button
                  type="button"
                  onClick={() => startPlacing(it, 'material')}
                  className="rounded-lg bg-blue-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  {t('erItems.makeMaterial')}
                </button>
                <button
                  type="button"
                  onClick={() => void dismiss(it)}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  {t('erItems.dismiss')}
                </button>
              </div>
            </div>
          </div>
        ))}
        {accepted.map((it) => (
          <p key={it.id} className="px-1 text-xs text-green-300/80">
            ✓ {it.name} —{' '}
            {it.job_id ? (
              <Link to={`/jobs/${it.job_id}`} className="hover:underline">
                {t('erItems.jobCreated')}
              </Link>
            ) : (
              t(it.material_id ? 'erItems.materialAdded' : 'erItems.taskCreated')
            )}
          </p>
        ))}
      </div>

      {placing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setPlacing(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-slate-900 p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-lg font-semibold">
              {t(mode === 'task' ? 'erItems.placeTitle' : 'erItems.placeMaterialTitle')}
            </h2>
            <p className="mb-3 text-sm text-slate-400">{placing.name}</p>
            {jobs.length > 1 && (
              <select
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value)
                  const j = jobs.find((x) => x.id === e.target.value)
                  setStageId(j ? currentStageOf(j) : '')
                }}
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_code} · {localized(j.name, j.name_i18n, i18n.language)}
                  </option>
                ))}
              </select>
            )}
            {mode === 'task' ? (
              <>
                <label className="mb-1 block text-xs text-slate-500">{t('createTask.stage')}</label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                >
                  {(selectedJob?.stages ?? [])
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.department?.name}
                      </option>
                    ))}
                </select>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t('materials.category')}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  >
                    {(['fabric', 'com', 'insert', 'foam', 'hardware', 'other'] as const).map((c) => (
                      <option key={c} value={c}>
                        {t(`materialCategory.${c}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">{t('materials.qty')}</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPlacing(null)}
                className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={busy || (mode === 'task' ? !stageId : !jobId)}
                onClick={() => void place()}
                className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy ? t('common.saving') : t(mode === 'task' ? 'createTask.create' : 'materials.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Read-only materials roll-up grouped by job (S05 Tab 3). */
function ProjectMaterials({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation()
  const { data: groups, loading } = useAsync(() => getProjectMaterials(projectId), [projectId])

  if (loading) return <p className="mt-5 text-sm text-slate-500">{t('common.loading')}</p>
  const nonEmpty = (groups ?? []).filter((g) => g.materials.length > 0)
  if (nonEmpty.length === 0) return <div className="mt-5"><EmptyState text={t('jobDetail.noMaterials')} /></div>

  return (
    <div className="mt-5 flex flex-col gap-5">
      {nonEmpty.map((g) => (
        <div key={g.job_code}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            <span className="font-mono text-amber-300/80">{g.job_code}</span> ·{' '}
            {localized(g.job_name, g.job_name_i18n, i18n.language)}
          </p>
          <div className="flex flex-col gap-2">
            {g.materials.map((m) => (
              <div key={m.id} className="flex justify-between gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {localized(m.name, m.name_i18n, i18n.language)}
                  <span className="ml-2 text-xs text-slate-500">
                    {m.quantity}{m.unit ? ` ${m.unit}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 text-xs ${m.is_arrived ? 'text-green-400' : m.is_ordered ? 'text-blue-300' : 'text-slate-500'}`}>
                  {m.is_arrived ? t('jobDetail.arrived') : m.is_ordered ? t('jobDetail.ordered') : t('jobDetail.notOrdered')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function JobRow({ job }: { job: JobWithStages }) {
  const { t, i18n } = useTranslation()
  const current = job.stages.find((s) => s.id === job.current_stage_id)
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-xl border border-slate-800 bg-slate-800/40 p-4 transition hover:border-slate-700 hover:bg-slate-800/70"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-mono font-semibold text-amber-300">{job.job_code}</span>
        <span className="text-xs text-slate-400">
          {current?.department?.name ?? t('jobDetail.complete')}
        </span>
      </div>
      <p className="mb-3 truncate text-sm text-slate-300">{localized(job.name, job.name_i18n, i18n.language)}</p>
      <StagePipeline stages={job.stages} />
    </Link>
  )
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: project, loading, error } = useAsync(
    () => getProject(projectId as string),
    [projectId, reloadKey],
  )
  const [tab, setTab] = useState('overview')
  const [showQr, setShowQr] = useState(false)

  if (loading) return <FullScreenLoader />
  if (error || !project) return <ErrorState text={t('common.error')} />

  const totalLabor = project.jobs.reduce((sum, j) => sum + j.total_labor_minutes, 0)
  const printAll = () =>
    void import('../lib/labels').then((m) =>
      m.printJobLabels(
        project.jobs.map((j) => ({ job_code: j.job_code, name: j.name, qr_code_uuid: j.qr_code_uuid })),
        project.client_name,
      ),
    )

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Link to="/projects" className="text-sm text-slate-400 hover:text-slate-200">
        ← {t('nav.projects')}
      </Link>

      <div className="mt-3 mb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {project.work_order_number ? `${project.work_order_number} · ` : ''}
          {project.client_name}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setShowQr(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t('qr.projectQr')}
          </button>
          {project.jobs.length > 0 && (
            <button
              type="button"
              onClick={printAll}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              {t('qr.printAll')}
            </button>
          )}
        </div>
      </div>

      {showQr && (
        <QrModal
          value={`${window.location.origin}/p/${project.qr_code_uuid}`}
          title={project.work_order_number ?? project.name}
          onClose={() => setShowQr(false)}
        />
      )}

      <Tabs
        tabs={[
          { key: 'overview', label: t('projectDetail.tabOverview') },
          { key: 'jobs', label: t('projectDetail.tabJobs') },
          { key: 'materials', label: t('jobDetail.tabMaterials') },
          { key: 'notes', label: t('jobDetail.tabNotes') },
          { key: 'files', label: t('jobDetail.tabFiles') },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'files' && (
        <div className="mt-5">
          <FilesTab projectId={project.id} />
        </div>
      )}

      {tab === 'materials' && <ProjectMaterials projectId={project.id} />}

      {tab === 'notes' && (
        <div className="mt-5">
          <Notes scope={{ projectId: project.id }} />
        </div>
      )}

      {tab === 'overview' && (
        <ErLineItemsPanel jobs={project.jobs} onJobsChanged={() => setReloadKey((k) => k + 1)} />
      )}
      {/* The portal document shows prices — admins only (owner requirement). */}
      {tab === 'overview' && profile?.role === 'admin' && project.er_portal_url && (
        <a
          href={project.er_portal_url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 block rounded-lg border border-slate-700 px-3 py-2.5 text-center text-sm text-amber-300/90 hover:bg-slate-800"
        >
          {t('projectDetail.viewWorkOrder')} ↗
        </a>
      )}
      {tab === 'overview' && (
        <div className="mt-5">
          <Appointments projectId={project.id} />
        </div>
      )}
      {tab === 'overview' && (
        <div className="mt-5 flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">{t('projectDetail.client')}</dt>
              <dd className="text-slate-200">{project.client_name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('projectDetail.totalLabor')}</dt>
              <dd className="text-slate-200">{formatMinutes(totalLabor, { h: t('units.h'), m: t('units.m') })}</dd>
            </div>
            {project.scheduled_start && (
              <div>
                <dt className="text-slate-500">{t('projectDetail.scheduledStart')}</dt>
                <dd className="text-slate-200">{formatDate(project.scheduled_start, i18n.language)}</dd>
              </div>
            )}
            {project.scheduled_end && (
              <div>
                <dt className="text-slate-500">{t('projectDetail.scheduledEnd')}</dt>
                <dd className="text-slate-200">{formatDate(project.scheduled_end, i18n.language)}</dd>
              </div>
            )}
          </dl>

          {project.description && (
            <div className="text-sm">
              <p className="mb-1 text-slate-500">{t('projectDetail.scope')}</p>
              <p className="whitespace-pre-line text-slate-300">{localized(project.description ?? '', project.description_i18n, i18n.language)}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm text-slate-500">{t('projectDetail.jobs')}</p>
            <div className="flex flex-col gap-2">
              {project.jobs.map((job) => {
                const current = job.stages.find((s) => s.id === job.current_stage_id)
                return (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5 text-sm hover:bg-slate-800/70"
                  >
                    <span>
                      <span className="font-mono font-medium text-amber-300">{job.job_code}</span>
                      <span className="ml-2 text-slate-400">{localized(job.name, job.name_i18n, i18n.language)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {current?.department?.name ?? t('jobDetail.complete')}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'jobs' && (
        <div className="mt-5 flex flex-col gap-3">
          {project.jobs.length === 0 ? (
            <EmptyState text={t('projectDetail.noJobs')} />
          ) : (
            project.jobs.map((job) => <JobRow key={job.id} job={job} />)
          )}
        </div>
      )}
    </div>
  )
}
