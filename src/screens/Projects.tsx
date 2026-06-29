import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAsync } from '../hooks/useAsync'
import { getProjectsOverview } from '../lib/data'
import { ALL_PROJECT_STATUSES } from '../lib/status'
import { formatMinutes } from '../lib/format'
import { StatusBadge, EmptyState, ErrorState } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'
import type { ProjectOverview, ProjectStatus } from '../lib/types'

type SortKey = 'date' | 'priority' | 'status' | 'updated'

function materialsDot(project: ProjectOverview): 'gray' | 'red' | 'green' {
  const mats = project.jobs.flatMap((j) => j.materials)
  if (mats.length === 0) return 'gray'
  return mats.every((m) => m.is_arrived) ? 'green' : 'red'
}

function ProjectCard({ project }: { project: ProjectOverview }) {
  const { t } = useTranslation()
  const jobCount = project.jobs.length

  // Per-stage breakdown: count jobs by their current department.
  const breakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const job of project.jobs) {
      const dept = job.current_stage?.department?.name
      if (dept) counts.set(dept, (counts.get(dept) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [project.jobs])

  const dot = materialsDot(project)
  const dotColor =
    dot === 'green' ? 'bg-green-500' : dot === 'red' ? 'bg-red-500' : 'bg-slate-600'

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-xl border border-slate-800 bg-slate-800/40 p-4 transition hover:border-slate-700 hover:bg-slate-800/70"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{project.name}</h3>
          <p className="truncate text-sm text-slate-400">
            {project.work_order_number ? `${project.work_order_number} · ` : ''}
            {project.client_name}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>{t('projects.jobsCount', { count: jobCount })}</span>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          {t('projects.materials')}
        </span>
        <span>{formatMinutes(project.total_labor_minutes, { h: t('units.h'), m: t('units.m') })}</span>
      </div>

      {breakdown.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {breakdown
            .map(([dept, count]) => t('projects.inStage', { count, dept }))
            .join(' · ')}
        </p>
      )}
    </Link>
  )
}

export default function Projects() {
  const { t } = useTranslation()
  const { data, loading, error } = useAsync(getProjectsOverview, [])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('date')

  const projects = useMemo(() => {
    let list = data ?? []
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => {
        const inProject =
          p.name.toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q) ||
          (p.work_order_number ?? '').toLowerCase().includes(q)
        const inJobs = p.jobs.some(
          (j) =>
            j.job_code.toLowerCase().includes(q) || j.name.toLowerCase().includes(q),
        )
        return inProject || inJobs
      })
    }
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter)

    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sort) {
        case 'priority':
          return (a.priority_rank ?? 9999) - (b.priority_rank ?? 9999)
        case 'status':
          return a.status.localeCompare(b.status)
        case 'updated':
          return b.updated_at.localeCompare(a.updated_at)
        default:
          return b.created_at.localeCompare(a.created_at)
      }
    })
    return sorted
  }, [data, search, statusFilter, sort])

  const selectClass =
    'rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">{t('nav.projects')}</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('projects.searchPlaceholder')}
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
          className={selectClass}
        >
          <option value="all">{t('projects.allStatuses')}</option>
          {ALL_PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`projectStatus.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className={selectClass}
        >
          <option value="date">{t('projects.sortDate')}</option>
          <option value="priority">{t('projects.sortPriority')}</option>
          <option value="status">{t('projects.sortStatus')}</option>
          <option value="updated">{t('projects.sortUpdated')}</option>
        </select>
      </div>

      {loading && <FullScreenLoader />}
      {error && <ErrorState text={t('common.error')} />}
      {!loading && !error && projects.length === 0 && (
        <EmptyState text={data?.length ? t('projects.noResults') : t('projects.noProjects')} />
      )}

      <div className="flex flex-col gap-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  )
}
