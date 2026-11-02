import { useTranslation } from 'react-i18next'
import { Card, Typography, theme } from 'antd'
import { CalendarOutlined } from '@ant-design/icons'
import { useAsync } from '../hooks/useAsync'
import { getAppointments } from '../lib/data'

/** Upcoming Google Calendar events matched to this job/project by code-in-title
 *  (the owner's "everything for a client in one place"). */
export function Appointments({ projectId, jobId }: { projectId?: string; jobId?: string }) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { data } = useAsync(() => getAppointments({ projectId, jobId }), [projectId, jobId])

  if (!data || data.length === 0) return null

  return (
    <Card size="small" styles={{ body: { padding: 14 } }}>
      <Typography.Text
        style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
      >
        <CalendarOutlined /> {t('calendar.appointments')}
      </Typography.Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((ev) => {
          const when = new Date(ev.starts_at)
          const dateLabel = when.toLocaleDateString(i18n.language, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            ...(ev.all_day ? {} : { hour: '2-digit', minute: '2-digit' }),
          })
          return (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <Typography.Text ellipsis style={{ minWidth: 0 }}>
                {ev.title}
                {ev.location && (
                  <Typography.Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
                    · {ev.location}
                  </Typography.Text>
                )}
              </Typography.Text>
              <Typography.Text style={{ flexShrink: 0, fontSize: 12, color: token.colorPrimary }}>{dateLabel}</Typography.Text>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
