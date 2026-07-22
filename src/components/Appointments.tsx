import { useTranslation } from 'react-i18next'
import { useAsync } from '../hooks/useAsync'
import { getAppointments } from '../lib/data'

/** Upcoming Google Calendar events matched to this job/project by code-in-title
 *  (the owner's "everything for a client in one place"). */
export function Appointments({ projectId, jobId }: { projectId?: string; jobId?: string }) {
  const { t, i18n } = useTranslation()
  const { data } = useAsync(() => getAppointments({ projectId, jobId }), [projectId, jobId])

  if (!data || data.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/20 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {t('calendar.appointments')}
      </p>
      <div className="flex flex-col gap-1.5">
        {data.map((ev) => {
          const when = new Date(ev.starts_at)
          const dateLabel = when.toLocaleDateString(i18n.language, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            ...(ev.all_day ? {} : { hour: '2-digit', minute: '2-digit' }),
          })
          return (
            <div key={ev.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-slate-200">
                {ev.title}
                {ev.location && <span className="ml-1 text-xs text-slate-500">· {ev.location}</span>}
              </span>
              <span className="shrink-0 text-xs text-sky-300">{dateLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
