import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAsync } from '../hooks/useAsync'
import { getProject } from '../lib/data'
import { formatMinutes, formatDate } from '../lib/format'
import { StatusBadge, EmptyState, ErrorState, Tabs } from '../components/ui'
import { StagePipeline } from '../components/StagePipeline'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { QrModal } from '../components/QrModal'
import type { JobWithStages } from '../lib/types'

function JobRow({ job }: { job: JobWithStages }) {
  const { t } = useTranslation()
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
      <p className="mb-3 truncate text-sm text-slate-300">{job.name}</p>
      <StagePipeline stages={job.stages} />
    </Link>
  )
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const { t, i18n } = useTranslation()
  const { data: project, loading, error } = useAsync(
    () => getProject(projectId as string),
    [projectId],
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
        ]}
        active={tab}
        onChange={setTab}
      />

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
              <p className="text-slate-300">{project.description}</p>
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
                      <span className="ml-2 text-slate-400">{job.name}</span>
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
