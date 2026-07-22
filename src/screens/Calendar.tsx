import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  getCalendarProjects,
  getCalendarEvents,
  updateProjectSchedule,
  type CalendarProject,
  type CalendarEvent,
} from '../lib/data'
import { PROJECT_STATUS_STYLE } from '../lib/status'
import { localized } from '../lib/i18nText'
import { ErrorState } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'

const DAY = 86400e3
const toUTC = (isoDate: string) => new Date(isoDate + 'T00:00:00Z').getTime()

type Bar = {
  key: string
  label: string
  status: CalendarProject['status']
  start: string
  end: string
  overdue: boolean
  project: CalendarProject
}

export default function Calendar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [anchor, setAnchor] = useState(() => {
    const now = new Date()
    return Date.UTC(now.getFullYear(), now.getMonth(), 1)
  })
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [jobLevel, setJobLevel] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [editing, setEditing] = useState<CalendarProject | null>(null)

  // Visible range: month grid padded to full weeks (weeks start Monday).
  const range = useMemo(() => {
    const a = new Date(anchor)
    if (mode === 'week') {
      const dow = (a.getUTCDay() + 6) % 7
      const start = anchor - dow * DAY
      return { start, end: start + 7 * DAY, weeks: 1 }
    }
    const first = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1)
    const startPad = (new Date(first).getUTCDay() + 6) % 7
    const start = first - startPad * DAY
    const last = Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0)
    const endPad = 6 - (new Date(last).getUTCDay() + 6) % 7
    const end = last + (endPad + 1) * DAY
    return { start, end, weeks: Math.round((end - start) / (7 * DAY)) }
  }, [anchor, mode])

  const { data: projects, loading, error } = useAsync(getCalendarProjects, [reloadKey])
  const { data: events } = useAsync(
    () => getCalendarEvents(new Date(range.start).toISOString(), new Date(range.end).toISOString()),
    [range.start, range.end, reloadKey],
  )

  const todayUTC = useMemo(() => {
    const n = new Date()
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
  }, [])

  const bars: Bar[] = useMemo(() => {
    const out: Bar[] = []
    for (const p of projects ?? []) {
      if (!p.scheduled_start) continue
      const end = p.scheduled_end ?? p.scheduled_start
      const overdue = toUTC(end) < todayUTC && p.status !== 'complete' && p.status !== 'delivered'
      if (jobLevel) {
        for (const j of p.jobs) {
          out.push({
            key: j.id,
            label: `${j.job_code} · ${localized(j.name, j.name_i18n, i18n.language)}`,
            status: p.status,
            start: p.scheduled_start,
            end,
            overdue,
            project: p,
          })
        }
      } else {
        out.push({
          key: p.id,
          label: [p.work_order_number, p.client_name].filter(Boolean).join(' · '),
          status: p.status,
          start: p.scheduled_start,
          end,
          overdue,
          project: p,
        })
      }
    }
    return out
  }, [projects, jobLevel, i18n.language, todayUTC])

  if (loading) return <FullScreenLoader />
  if (error) return <ErrorState text={t('common.error')} />

  const monthLabel = new Date(anchor).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const step = mode === 'week' ? 7 * DAY : 0

  const weeks = Array.from({ length: range.weeks }, (_, w) => range.start + w * 7 * DAY)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('nav.calendar')}</h1>
        <Link to="/priority" className="text-sm text-amber-400 hover:underline">
          {t('priority.title')} →
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          onClick={() => setAnchor((a) => (mode === 'week' ? a - step : Date.UTC(new Date(a).getUTCFullYear(), new Date(a).getUTCMonth() - 1, 1)))}>
          ←
        </button>
        <span className="min-w-40 text-center font-medium capitalize">{mode === 'week' ? `${new Date(range.start).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${new Date(range.end - DAY).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : monthLabel}</span>
        <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          onClick={() => setAnchor((a) => (mode === 'week' ? a + step : Date.UTC(new Date(a).getUTCFullYear(), new Date(a).getUTCMonth() + 1, 1)))}>
          →
        </button>
        <button type="button" className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          onClick={() => { const n = new Date(); setAnchor(mode === 'week' ? Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) : Date.UTC(n.getFullYear(), n.getMonth(), 1)) }}>
          {t('calendar.today')}
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => setMode((m) => (m === 'month' ? 'week' : 'month'))}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
          {mode === 'month' ? t('calendar.weekView') : t('calendar.monthView')}
        </button>
        <button type="button" onClick={() => setJobLevel((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-sm ${jobLevel ? 'border-amber-500 text-amber-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
          {t('calendar.jobLevel')}
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-800 pb-1 text-center text-[11px] uppercase tracking-wide text-slate-500">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>
            {new Date(range.start + i * DAY).toLocaleDateString(i18n.language, { weekday: 'short', timeZone: 'UTC' })}
          </span>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((weekStart) => (
        <WeekRow
          key={weekStart}
          weekStart={weekStart}
          bars={bars}
          events={events ?? []}
          todayUTC={todayUTC}
          inMonth={(d) => mode === 'week' || new Date(d).getUTCMonth() === new Date(anchor).getUTCMonth()}
          onBarClick={(p) => (isAdmin ? setEditing(p) : navigate(`/projects/${p.id}`))}
        />
      ))}

      <p className="mt-3 text-xs text-slate-500">{isAdmin ? t('calendar.adminHint') : t('calendar.viewHint')}</p>

      {/* Unscheduled projects — the admin's entry point to give them dates. */}
      {isAdmin && (projects ?? []).some((p) => !p.scheduled_start && p.status !== 'complete' && p.status !== 'delivered') && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t('calendar.unscheduled')}
          </p>
          <div className="flex flex-wrap gap-2">
            {(projects ?? [])
              .filter((p) => !p.scheduled_start && p.status !== 'complete' && p.status !== 'delivered')
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEditing(p)}
                  className="rounded-lg border border-dashed border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:border-amber-500 hover:text-amber-300"
                >
                  {[p.work_order_number, p.client_name].filter(Boolean).join(' · ')}
                </button>
              ))}
          </div>
        </div>
      )}

      {editing && (
        <ScheduleDialog
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

function WeekRow({
  weekStart,
  bars,
  events,
  todayUTC,
  inMonth,
  onBarClick,
}: {
  weekStart: number
  bars: Bar[]
  events: CalendarEvent[]
  todayUTC: number
  inMonth: (dayUTC: number) => boolean
  onBarClick: (p: CalendarProject) => void
}) {
  const weekEnd = weekStart + 7 * DAY

  // Bars overlapping this week, packed into lanes.
  const segs = bars
    .map((b) => ({ b, s: toUTC(b.start), e: toUTC(b.end) + DAY }))
    .filter(({ s, e }) => s < weekEnd && e > weekStart)
    .sort((x, y) => x.s - y.s)
  const lanes: { b: Bar; colStart: number; colEnd: number }[][] = []
  for (const { b, s, e } of segs) {
    const colStart = Math.max(0, Math.round((Math.max(s, weekStart) - weekStart) / DAY))
    const colEnd = Math.min(7, Math.round((Math.min(e, weekEnd) - weekStart) / DAY))
    let lane = lanes.find((l) => l.every((x) => colEnd <= x.colStart || colStart >= x.colEnd))
    if (!lane) {
      if (lanes.length >= 3) continue // "+ more" omitted for simplicity
      lane = []
      lanes.push(lane)
    }
    lane.push({ b, colStart, colEnd })
  }

  const dayEvents = (dayUTC: number) =>
    events.filter((ev) => {
      const t = new Date(ev.starts_at).getTime()
      return t >= dayUTC && t < dayUTC + DAY
    })

  return (
    <div className="relative border-b border-slate-800/70">
      {/* Day cells */}
      <div className="grid min-h-24 grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => {
          const day = weekStart + i * DAY
          const isToday = day === todayUTC
          return (
            <div key={i} className={`border-l border-slate-800/40 p-1 first:border-l-0 ${inMonth(day) ? '' : 'opacity-40'}`}>
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? 'bg-amber-600 font-semibold text-white' : 'text-slate-500'}`}>
                {new Date(day).getUTCDate()}
              </span>
              <div className="mt-0.5 flex flex-col gap-0.5">
                {dayEvents(day).slice(0, 2).map((ev) => (
                  <span key={ev.id} title={ev.title} className="truncate rounded bg-sky-500/20 px-1 text-[9px] leading-4 text-sky-300">
                    {ev.title}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {/* Bars overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex flex-col gap-0.5 px-0.5">
        {lanes.map((lane, li) => (
          <div key={li} className="grid grid-cols-7 gap-0.5">
            {lane
              .sort((a, b) => a.colStart - b.colStart)
              .map(({ b, colStart, colEnd }) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onBarClick(b.project)}
                  style={{ gridColumn: `${colStart + 1} / ${colEnd + 1}` }}
                  className={`pointer-events-auto truncate rounded px-1.5 py-0.5 text-left text-[10px] leading-4 ${PROJECT_STATUS_STYLE[b.status]} ring-1 ring-inset ring-white/10 hover:ring-amber-400/60`}
                  title={b.label}
                >
                  {b.overdue && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />}
                  {b.label}
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function ScheduleDialog({
  project,
  onClose,
  onSaved,
}: {
  project: CalendarProject
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [start, setStart] = useState(project.scheduled_start ?? '')
  const [end, setEnd] = useState(project.scheduled_end ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSave() {
    setBusy(true)
    setError(null)
    const { error } = await updateProjectSchedule(project.id, start || null, end || start || null)
    setBusy(false)
    if (error) setError(t('common.error'))
    else onSaved()
  }

  const field = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{t('calendar.scheduleTitle')}</h2>
        <p className="text-sm text-slate-400">
          {[project.work_order_number, project.client_name, project.name].filter(Boolean).join(' · ')}
        </p>
        <label className="text-sm text-slate-300">
          {t('projectDetail.scheduledStart')}
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1 ${field}`} />
        </label>
        <label className="text-sm text-slate-300">
          {t('projectDetail.scheduledEnd')}
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={`mt-1 ${field}`} />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={() => void onSave()} disabled={busy} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60">
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
