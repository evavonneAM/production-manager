import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAsync } from '../hooks/useAsync'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/data'
import { formatDate } from '../lib/format'
import { EmptyState, ErrorState } from '../components/ui'
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
  if (error) return <ErrorState text={t('common.error')} />

  const unread = (data ?? []).filter((n) => !n.is_read).length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('inbox.title')}</h1>
        {unread > 0 && (
          <button type="button" onClick={() => void onMarkAll()}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            {t('inbox.markAllRead')}
          </button>
        )}
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState text={t('inbox.empty')} />
      ) : (
        <div className="flex flex-col gap-2">
          {(data ?? []).map((n) => {
            const { title, body } = textOf(n, i18n.language)
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void open(n)}
                className={`rounded-xl border p-3 text-left transition hover:bg-slate-800/70 ${
                  n.is_read ? 'border-slate-800 bg-slate-800/30' : 'border-amber-600/40 bg-amber-600/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${n.is_read ? 'text-slate-300' : 'font-medium text-slate-100'}`}>
                    {!n.is_read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />}
                    {title}
                  </p>
                  <span className="shrink-0 text-xs text-slate-500">{formatDate(n.sent_at, i18n.language)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{body}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
