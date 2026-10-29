import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Avatar, Button, Card, Empty, Tag, Typography, theme } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getPriorityProjects, saveProjectPriorities } from '../lib/data'
import { formatDate } from '../lib/format'
import { FullScreenLoader } from '../components/FullScreenLoader'
import type { Project, ProjectStatus } from '../lib/types'

const PROJECT_TAG_COLOR: Record<ProjectStatus, string> = {
  estimate: 'default',
  scheduled: 'purple',
  in_progress: 'processing',
  on_hold: 'orange',
  complete: 'success',
  delivered: 'cyan',
}

type Row = Pick<Project, 'id' | 'name' | 'client_name' | 'status' | 'scheduled_end' | 'priority_rank'>

/** Priority Board (S04): ranked projects; Admin reorders (drag or arrows) and
 *  the save re-sequences every department queue on the floor. */
export default function Priority() {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
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
  if (error) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  return (
    <div style={{ maxWidth: 672, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {t('priority.title')}
      </Typography.Title>
      <Typography.Text type="secondary">{isAdmin ? t('priority.hintAdmin') : t('priority.hintView')}</Typography.Text>
      {saveErr && <Alert type="error" showIcon title={saveErr} style={{ marginTop: 12 }} />}
      <Typography.Text type="secondary" style={{ display: 'block', minHeight: 20, marginTop: 8, fontSize: 12 }}>
        {saving ? t('common.saving') : ''}
      </Typography.Text>

      {rows.length === 0 ? (
        <Empty description={t('priority.empty')} style={{ marginTop: 32 }} />
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          {rows.map((r, i) => {
            const overdue = r.scheduled_end && r.scheduled_end < todayIso
            return (
              <div
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                  background: dragIdx === i ? token.colorPrimaryBg : undefined,
                  cursor: isAdmin ? 'grab' : undefined,
                }}
              >
                <Avatar size={28} style={{ flexShrink: 0, background: i < 3 ? token.colorPrimary : token.colorFillSecondary, color: i < 3 ? '#fff' : token.colorText, fontWeight: 600 }}>
                  {i + 1}
                </Avatar>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Typography.Text strong ellipsis style={{ display: 'block' }}>
                    {r.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
                    {r.client_name}
                    {r.scheduled_end && (
                      <>
                        {' · '}
                        <span style={overdue ? { color: token.colorError, fontWeight: 600 } : undefined}>
                          {formatDate(r.scheduled_end, i18n.language)}
                          {overdue ? ' !' : ''}
                        </span>
                      </>
                    )}
                  </Typography.Text>
                </div>
                <Tag color={PROJECT_TAG_COLOR[r.status]} style={{ marginInlineEnd: 0 }}>
                  {t(`projectStatus.${r.status}`)}
                </Tag>
                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                    <Button size="small" type="text" icon={<ArrowUpOutlined />} onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="↑" />
                    <Button size="small" type="text" icon={<ArrowDownOutlined />} onClick={() => move(i, i + 1)} disabled={i === rows.length - 1} aria-label="↓" />
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
