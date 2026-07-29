import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getDirectory, getLaborReport, type LaborReportRow } from '../lib/data'
import { laborCsv, type LaborCsvRow } from '../lib/csv'
import { formatMinutes } from '../lib/format'
import { localized } from '../lib/i18nText'
import { EmptyState, ErrorState } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'

type Preset = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom'
type GroupBy = 'user' | 'department' | 'project' | 'job'

const day = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const monday = (d: Date) => {
    const x = new Date(d)
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
    return x
  }
  switch (preset) {
    case 'thisWeek': {
      const m = monday(now)
      return { from: day(m), to: day(now) }
    }
    case 'lastWeek': {
      const m = monday(now)
      const from = new Date(m)
      from.setDate(from.getDate() - 7)
      const to = new Date(m)
      to.setDate(to.getDate() - 1)
      return { from: day(from), to: day(to) }
    }
    case 'thisMonth':
      return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now) }
    case 'lastMonth':
      return {
        from: day(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: day(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    default:
      return { from: day(now), to: day(now) }
  }
}

const hhmm = (iso: string | null, locale: string) =>
  iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : ''

/** Labor reports (S18 / SPEC §15): filter, group, and export hours — never costs. */
export default function Reports() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [preset, setPreset] = useState<Preset>('thisWeek')
  const [custom, setCustom] = useState(presetRange('thisWeek'))
  const range = preset === 'custom' ? custom : presetRange(preset)

  const { data: logs, loading, error } = useAsync(
    () => getLaborReport(range.from, range.to),
    [range.from, range.to],
  )
  const { data: directory } = useAsync(getDirectory, [])

  const [projectF, setProjectF] = useState('all')
  const [jobF, setJobF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [userF, setUserF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('user')

  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string) => map.get(id) ?? '—'
  }, [directory])

  const deptOf = (r: LaborReportRow) => r.task?.stage?.department ?? null

  // Filter options come from the (RLS-scoped) data itself.
  const options = useMemo(() => {
    const uniq = <T,>(pairs: [string, T][]) => [...new Map(pairs).entries()]
    return {
      projects: uniq((logs ?? []).filter((r) => r.project).map((r) => [r.project!.id, r.project!.name])),
      jobs: uniq((logs ?? []).filter((r) => r.job).map((r) => [r.job!.id, r.job!.job_code])),
      depts: uniq((logs ?? []).map((r) => deptOf(r)).filter(Boolean).map((d) => [d!.id, d!.name])),
      users: uniq((logs ?? []).map((r) => [r.user_id, nameOf(r.user_id)] as [string, string])),
      statuses: [...new Set((logs ?? []).map((r) => r.task?.status).filter(Boolean))] as string[],
    }
  }, [logs, nameOf])

  const rows = useMemo(
    () =>
      (logs ?? []).filter(
        (r) =>
          (projectF === 'all' || r.project?.id === projectF) &&
          (jobF === 'all' || r.job?.id === jobF) &&
          (deptF === 'all' || deptOf(r)?.id === deptF) &&
          (userF === 'all' || r.user_id === userF) &&
          (statusF === 'all' || r.task?.status === statusF),
      ),
    [logs, projectF, jobF, deptF, userF, statusF],
  )

  const totalMin = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)

  // Grouped summary; est-vs-actual (full task totals) shown for job/project groups.
  const groups = useMemo(() => {
    const acc = new Map<string, { label: string; minutes: number; taskIds: Set<string>; estH: number; actualMin: number }>()
    for (const r of rows) {
      const key =
        groupBy === 'user' ? r.user_id
        : groupBy === 'department' ? deptOf(r)?.id ?? '—'
        : groupBy === 'project' ? r.project?.id ?? '—'
        : r.job?.id ?? '—'
      const label =
        groupBy === 'user' ? nameOf(r.user_id)
        : groupBy === 'department' ? deptOf(r)?.name ?? '—'
        : groupBy === 'project' ? r.project?.name ?? '—'
        : `${r.job?.job_code ?? '—'} · ${localized(r.job?.name ?? '', r.job?.name_i18n, i18n.language)}`
      const g = acc.get(key) ?? { label, minutes: 0, taskIds: new Set(), estH: 0, actualMin: 0 }
      g.minutes += r.duration_minutes ?? 0
      if (r.task && !g.taskIds.has(r.task.id)) {
        g.taskIds.add(r.task.id)
        g.estH += r.task.estimated_hours ?? 0
        g.actualMin += r.task.actual_minutes
      }
      acc.set(key, g)
    }
    return [...acc.values()].sort((a, b) => b.minutes - a.minutes)
  }, [rows, groupBy, nameOf, i18n.language])

  if (!profile) return null
  const canExport = profile.role === 'admin' || profile.role === 'lead'
  const units = { h: t('units.h'), m: t('units.m') }

  function download() {
    const csvRows: LaborCsvRow[] = rows.map((r) => ({
      date: day(new Date(r.clocked_in_at)),
      work_order: r.project?.work_order_number ?? '',
      job_code: r.job?.job_code ?? '',
      job_name: r.job?.name ?? '',
      department: deptOf(r)?.name ?? '',
      task: r.task?.name ?? '',
      user: nameOf(r.user_id),
      clock_in: hhmm(r.clocked_in_at, 'en-GB'),
      clock_out: hhmm(r.clocked_out_at, 'en-GB'),
      duration_minutes: r.duration_minutes ?? 0,
      flagged: r.admin_override,
    }))
    const blob = new Blob([laborCsv(csvRows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `labor_${range.from}_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const selectClass =
    'rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none'

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('reports.title')}</h1>
        {canExport && (
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={download}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {t('reports.export')}
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className={selectClass}>
          {(['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'custom'] as const).map((p) => (
            <option key={p} value={p}>{t(`reports.${p}`)}</option>
          ))}
        </select>
        {preset === 'custom' && (
          <>
            <input type="date" value={custom.from} max={custom.to}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={selectClass} />
            <input type="date" value={custom.to} min={custom.from}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={selectClass} />
          </>
        )}
        <select value={projectF} onChange={(e) => setProjectF(e.target.value)} className={selectClass}>
          <option value="all">{t('reports.allProjects')}</option>
          {options.projects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={jobF} onChange={(e) => setJobF(e.target.value)} className={selectClass}>
          <option value="all">{t('reports.allJobs')}</option>
          {options.jobs.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={deptF} onChange={(e) => setDeptF(e.target.value)} className={selectClass}>
          <option value="all">{t('reports.allDepartments')}</option>
          {options.depts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={userF} onChange={(e) => setUserF(e.target.value)} className={selectClass}>
          <option value="all">{t('reports.allPeople')}</option>
          {options.users.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={selectClass}>
          <option value="all">{t('reports.allStatuses')}</option>
          {options.statuses.map((s) => <option key={s} value={s}>{t(`taskStatus.${s}`)}</option>)}
        </select>
      </div>

      {loading && <FullScreenLoader />}
      {error && <ErrorState text={t('common.error')} />}
      {!loading && !error && rows.length === 0 && <EmptyState text={t('reports.empty')} />}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 p-1">
              {(['user', 'department', 'project', 'job'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupBy(g)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    groupBy === g ? 'bg-amber-600/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t(`reports.by_${g}`)}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-400">
              {t('reports.total')}: <span className="font-semibold text-slate-100">{formatMinutes(totalMin, units)}</span>
            </p>
          </div>

          <div className="mb-6 flex flex-col gap-1.5">
            {groups.map((g) => {
              const over = g.estH > 0 && g.actualMin > g.estH * 60
              const showEst = (groupBy === 'job' || groupBy === 'project') && g.estH > 0
              return (
                <div
                  key={g.label}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                    over && showEst ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-800 bg-slate-800/40'
                  }`}
                >
                  <span className="min-w-0 truncate text-slate-100">{g.label}</span>
                  <span className="shrink-0 text-slate-300">
                    {formatMinutes(g.minutes, units)}
                    {showEst && (
                      <span className={`ml-2 text-xs ${over ? 'text-amber-300' : 'text-slate-500'}`}>
                        {t('reports.estVsActual', {
                          est: `${g.estH}${units.h}`,
                          actual: formatMinutes(g.actualMin, units),
                        })}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('reports.entries')}</p>
          <div className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-200">
                    {nameOf(r.user_id)}
                    <span className="mx-1.5 text-slate-600">·</span>
                    {localized(r.task?.name ?? '—', r.task?.name_i18n, i18n.language)}
                  </span>
                  <span className="shrink-0 text-slate-300">
                    {formatMinutes(r.duration_minutes ?? 0, units)}
                    {r.admin_override && (
                      <span className="ml-1.5 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-300">
                        {t('reports.flagged')}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {day(new Date(r.clocked_in_at))} · {hhmm(r.clocked_in_at, i18n.language)}–{hhmm(r.clocked_out_at, i18n.language)}
                  {r.job && <> · <span className="font-mono">{r.job.job_code}</span></>}
                  {deptOf(r) && <> · {deptOf(r)!.name}</>}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
