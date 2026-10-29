import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Badge, Button, Card, Empty, Typography, theme } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useAsync } from '../hooks/useAsync'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/data'
import { formatDate } from '../lib/format'
import { FullScreenLoader } from '../components/FullScreenLoader'
import type { Notification } from '../lib/types'

function textOf(n: Notification, lang: string): { title: string; body: string } {
  const l = ['en', 'ru', 'es'].includes(lang) ? (lang as 'en' | 'ru' | 'es') : 'en'
  return { title: n[`title_${l}`], body: n[`body_${l}`] }
}

/** Notifications Inbox (S15) — per-language, unread highlighted, tap to open. */
export default function Inbox() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [reloadKey, setReloadKey] = useState(0)
  const { data, loading, error } = useAsync(getNotifications, [reloadKey])

  async function open(n: Notification) {
    if (!n.is_read) await markNotificationRead(n.id)
    if (n.related_task_id) navigate(`/tasks/${n.related_task_id}`)
    else if (n.related_job_id) navigate(`/jobs/${n.related_job_id}`)
    else setReloadKey((k) => k + 1)
  }

  async function onMarkAll() {
    await markAllNotificationsRead()
    setReloadKey((k) => k + 1)
  }

  if (loading) return <FullScreenLoader />
  if (error) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  const unread = (data ?? []).filter((n) => !n.is_read).length

  return (
    <div style={{ maxWidth: 672, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('inbox.title')}
        </Typography.Title>
        {unread > 0 && (
          <Button icon={<CheckOutlined />} onClick={() => void onMarkAll()}>
            {t('inbox.markAllRead')}
          </Button>
        )}
      </div>

      {(data?.length ?? 0) === 0 ? (
        <Empty description={t('inbox.empty')} style={{ marginTop: 40 }} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          {(data ?? []).map((n, i, all) => {
            const { title, body } = textOf(n, i18n.language)
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => void open(n)}
                onKeyDown={(e) => e.key === 'Enter' && void open(n)}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: n.is_read ? undefined : token.colorPrimaryBg,
                  borderBottom: i === all.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <span style={{ width: 8, paddingTop: 2, flexShrink: 0 }}>{!n.is_read && <Badge status="processing" />}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <Typography.Text strong={!n.is_read}>{title}</Typography.Text>
                    <Typography.Text type="secondary" style={{ flexShrink: 0, fontSize: 12 }}>
                      {formatDate(n.sent_at, i18n.language)}
                    </Typography.Text>
                  </div>
                  <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13, marginTop: 2 }}>
                    {body}
                  </Typography.Text>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
