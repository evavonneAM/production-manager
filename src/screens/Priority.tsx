import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getPriorityProjects, saveProjectPriorities } from '../lib/data'
import { formatDate } from '../lib/format'
import { StatusBadge, EmptyState, ErrorState } from '../components/ui'
import { FullScreenLoader } from '../components/FullScreenLoader'
import type { Project } from '../lib/types'

type Row = Pick<Project, 'id' | 'name' | 'client_name' | 'status' | 'scheduled_end' | 'priority_rank'>

/** Priority Board (S04): ranked projects; Admin reorders (drag or arrows) and
 *  the save re-sequences every department queue on the floor. */
export default function Priority() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [reloadKey, setReloadKey] = useState(0)
  const { data, loading, error } = useAsync(getPriorityProjects, [reloadKey])
  const [rows, setRows] = useState<Row[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  useEffect(() => {
    if (data) setRows(data)
  }, [data])

  async function persist(next: Row[]) {
    setRows(next)
    setSaving(true)
    setSaveErr(null)
    const { error } = await saveProjectPriorities(next.map((r) => r.id))
    setSaving(false)
    if (error) {
      setSaveErr(t('common.error'))
      setReloadKey((k) => k + 1) // reload server truth
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return
    const next = [...rows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    void persist(next)
  }

  const todayIso = new Date().toISOString().slice(0, 10)

  if (loading && rows.length === 0) return <FullScreenLoader />
  if (error) return <ErrorState text={t('common.error')} />

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-semibold">{t('priority.title')}</h1>
      <p className="mb-4 text-sm text-slate-500">{isAdmin ? t('priority.hintAdmin') : t('priority.hintView')}</p>
      {saveErr && <ErrorState text={saveErr} />}
      {saving && <p className="mb-2 text-xs text-slate-500">{t('common.saving')}</p>}

      {rows.length === 0 ? (
        <EmptyState text={t('priority.empty')} />
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const overdue = r.scheduled_end && r.scheduled_end < todayIso
            return (
              <li
                key={r.id}
                draggable={isAdmin}
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragIdx !== null && dragIdx !== i) {
                    const next = [...rows]
                    const [item] = next.splice(dragIdx, 1)
                    next.splice(i, 0, item)
                    setRows(next)
                    setDragIdx(i)
                  }
                }}
                onDragEnd={() => {
                  setDragIdx(null)
                  void persist(rows)
                }}
                className={`flex items-center gap-3 rounded-xl border bg-slate-800/40 p-3 ${
                  dragIdx === i ? 'border-amber-500' : 'border-slate-800'
                } ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-200">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-100">{r.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {r.client_name}
                    {r.scheduled_end && (
                      <>
                        {' · '}
                        <span className={overdue ? 'text-red-400' : ''}>
                          {formatDate(r.scheduled_end, i18n.language)}
                          {overdue ? ' !' : ''}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <StatusBadge status={r.status} />
                {isAdmin && (
                  <span className="flex shrink-0 flex-col gap-0.5">
                    <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0}
                      className="rounded border border-slate-700 px-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30" aria-label="↑">↑</button>
                    <button type="button" onClick={() => move(i, i + 1)} disabled={i === rows.length - 1}
                      className="rounded border border-slate-700 px-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30" aria-label="↓">↓</button>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
