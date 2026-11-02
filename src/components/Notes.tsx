import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Empty, Input, Typography, theme } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getNotes, addNote, deleteNote, requestTranslation, getDirectory } from '../lib/data'
import { formatDate } from '../lib/format'
import { Avatar } from './Avatar'
import type { Note } from '../lib/types'
import type { AppLanguage } from '../i18n'

type Scope = { projectId: string; jobId?: string; taskId?: string }

function textFor(note: Note, lang: string): string {
  const key = `${lang}_text` as 'en_text' | 'ru_text' | 'es_text'
  return note[key] || note.original_text
}

export function Notes({ scope }: { scope: Scope }) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form onSubmit={onAdd} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('notes.placeholder')}
          rows={2}
          maxLength={2000}
        />
        <Button type="primary" htmlType="submit" loading={busy} disabled={!text.trim()} style={{ alignSelf: 'flex-end' }}>
          {t('notes.add')}
        </Button>
      </form>

      {loading && <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>}
      {!loading && (notes?.length ?? 0) === 0 && <Empty description={t('notes.empty')} />}

      {(notes?.length ?? 0) > 0 && (
        <Card styles={{ body: { padding: 0 } }}>
          {(notes ?? []).map((note, i, all) => {
            const translated = note.original_language !== lang
            const missing = translated && !note[`${lang}_text` as 'en_text' | 'ru_text' | 'es_text']
            const canDelete = note.author_id === profile?.id || profile?.role === 'admin'
            return (
              <div
                key={note.id}
                style={{ padding: '12px 14px', borderBottom: i === all.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={authorOf(note.author_id)} size={24} />
                    <Typography.Text strong>{authorOf(note.author_id)}</Typography.Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDate(note.created_at, lang)}
                    </Typography.Text>
                    {canDelete && (
                      <Button size="small" type="text" icon={<DeleteOutlined />} aria-label={t('notes.delete')} onClick={() => void onDelete(note.id)} />
                    )}
                  </div>
                </div>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{textFor(note, lang)}</Typography.Paragraph>
                {translated && !missing && (
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                    {t('notes.originallyIn', { lang: t(`languages.${note.original_language}`) })}
                  </Typography.Text>
                )}
                {missing && (
                  <Typography.Text type="warning" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                    {note.translation_status === 'failed' ? t('notes.translationFailed') : t('notes.translating')}
                    {note.translation_status === 'failed' && (
                      <Button size="small" type="link" onClick={() => void onRetry(note.id)}>
                        {t('scan.tryAgain')}
                      </Button>
                    )}
                  </Typography.Text>
                )}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
