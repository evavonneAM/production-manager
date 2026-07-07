import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getNotes, addNote, deleteNote, requestTranslation, getDirectory } from '../lib/data'
import { formatDate } from '../lib/format'
import { Avatar } from './Avatar'
import { EmptyState } from './ui'
import type { Note } from '../lib/types'
import type { AppLanguage } from '../i18n'

type Scope = { projectId: string; jobId?: string; taskId?: string }

function textFor(note: Note, lang: string): string {
  const key = `${lang}_text` as 'en_text' | 'ru_text' | 'es_text'
  return note[key] || note.original_text
}

export function Notes({ scope }: { scope: Scope }) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: notes, loading } = useAsync(() => getNotes(scope), [
    scope.projectId,
    scope.jobId,
    scope.taskId,
    reloadKey,
  ])
  const { data: directory } = useAsync(getDirectory, [])
  const authorOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string) => map.get(id) ?? '—'
  }, [directory])

  const lang = i18n.language

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || !profile) return
    setBusy(true)
    await addNote({ scope, authorId: profile.id, text: text.trim(), language: lang as AppLanguage })
    setText('')
    setBusy(false)
    setReloadKey((k) => k + 1)
  }

  async function onRetry(id: string) {
    await requestTranslation('notes', id)
    setReloadKey((k) => k + 1)
  }

  async function onDelete(id: string) {
    await deleteNote(id)
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onAdd} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('notes.placeholder')}
          rows={2}
          maxLength={2000}
          className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="self-end rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {busy ? t('notes.posting') : t('notes.add')}
        </button>
      </form>

      {loading && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {!loading && (notes?.length ?? 0) === 0 && <EmptyState text={t('notes.empty')} />}

      <div className="flex flex-col gap-3">
        {(notes ?? []).map((note) => {
          const translated = note.original_language !== lang
          const missing = translated && !note[`${lang}_text` as 'en_text' | 'ru_text' | 'es_text']
          const canDelete = note.author_id === profile?.id || profile?.role === 'admin'
          return (
            <div key={note.id} className="rounded-xl border border-slate-800 bg-slate-800/40 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar name={authorOf(note.author_id)} size={24} />
                  <span className="text-sm text-slate-300">{authorOf(note.author_id)}</span>
                </div>
                <span className="text-xs text-slate-500">{formatDate(note.created_at, lang)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{textFor(note, lang)}</p>
              {translated && !missing && (
                <p className="mt-1 text-xs text-slate-500">
                  {t('notes.originallyIn', { lang: t(`languages.${note.original_language}`) })}
                </p>
              )}
              {missing && (
                <div className="mt-1 flex items-center gap-2 text-xs text-amber-400/80">
                  <span>
                    {note.translation_status === 'failed'
                      ? t('notes.translationFailed')
                      : t('notes.translating')}
                  </span>
                  {note.translation_status === 'failed' && (
                    <button type="button" onClick={() => void onRetry(note.id)} className="underline">
                      {t('scan.tryAgain')}
                    </button>
                  )}
                </div>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => void onDelete(note.id)}
                  className="mt-2 text-xs text-slate-500 hover:text-red-400"
                >
                  {t('notes.delete')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
