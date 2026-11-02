import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Empty, Input, Modal, Space, Tag, Typography, theme } from 'antd'
import { CameraOutlined, CheckOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  getInspectionQueue,
  getDirectory,
  approveStage,
  rejectStage,
  getLatestRejectionId,
} from '../lib/data'
import { uploadFile } from '../lib/files'
import { formatMinutes } from '../lib/format'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { localized } from '../lib/i18nText'
import type { InspectionQueueItem, TaskStatus } from '../lib/types'
import { type AppLanguage } from '../i18n'

const TASK_TAG_COLOR: Record<TaskStatus, string> = {
  pending_approval: 'orange',
  unstarted: 'default',
  in_progress: 'processing',
  paused: 'gold',
  completed: 'success',
  cancelled: 'default',
}

function waitingMinutes(since: string | null): number {
  if (!since) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000))
}

export default function Inspection() {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [deptFilter, setDeptFilter] = useState('all')
  const [selected, setSelected] = useState<InspectionQueueItem | null>(null)

  const { data, loading, error } = useAsync(getInspectionQueue, [reloadKey])
  const { data: directory } = useAsync(getDirectory, [])
  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }, [directory])

  const departments = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of data ?? []) if (it.department) m.set(it.department.id, it.department.name)
    return [...m.entries()]
  }, [data])

  const items = (data ?? []).filter(
    (it) => deptFilter === 'all' || it.department?.id === deptFilter,
  )

  function refresh() {
    setSelected(null)
    setReloadKey((k) => k + 1)
  }

  if (loading) return <FullScreenLoader />
  if (error) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  return (
    <div style={{ maxWidth: 672, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <Typography.Title level={3} style={{ margin: '0 0 16px' }}>
        {t('nav.inspection')}
      </Typography.Title>

      {departments.length > 1 && (
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          aria-label={t('inspection.allDepartments')}
          style={{
            height: 32,
            padding: '0 8px',
            marginBottom: 16,
            fontSize: 14,
            color: token.colorText,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorder}`,
            borderRadius: token.borderRadius,
          }}
        >
          <option value="all">{t('inspection.allDepartments')}</option>
          {departments.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      )}

      {items.length === 0 ? (
        <Empty description={t('inspection.empty')} style={{ marginTop: 40 }} />
      ) : (
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          {items.map((it) => (
            <Card key={it.id} hoverable size="small" onClick={() => setSelected(it)} styles={{ body: { padding: 14 } }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: token.fontFamilyCode, fontWeight: 600, color: token.colorPrimary }}>{it.job?.job_code}</span>
                <Tag style={{ marginInlineEnd: 0 }}>{it.department?.name}</Tag>
              </div>
              <Typography.Text strong ellipsis style={{ display: 'block', marginTop: 4 }}>
                {it.job ? localized(it.job.name, it.job.name_i18n, i18n.language) : ''}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {t('inspection.submittedBy', { name: nameOf(it.submitted_by) })} ·{' '}
                {t('inspection.waiting', {
                  time: formatMinutes(waitingMinutes(it.submitted_at), { h: t('units.h'), m: t('units.m') }),
                })}
              </Typography.Text>
            </Card>
          ))}
        </Space>
      )}

      {selected && (
        <InspectionPanel
          item={selected}
          canInspect={
            profile?.role === 'admin' ||
            (profile?.role === 'lead' &&
              selected.department?.id === profile?.department_id &&
              selected.submitted_by !== profile?.id)
          }
          onClose={() => setSelected(null)}
          onDone={refresh}
        />
      )}
    </div>
  )
}

function InspectionPanel({
  item,
  canInspect,
  onClose,
  onDone,
}: {
  item: InspectionQueueItem
  canInspect: boolean
  onClose: () => void
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onApprove() {
    setBusy(true)
    setError(null)
    const { error } = await approveStage(item.id)
    setBusy(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else onDone()
  }

  async function onReject() {
    if (!note.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await rejectStage(item.id, note.trim(), i18n.language as AppLanguage)
    if (error) {
      setBusy(false)
      setError(t([`clockError.${error}`, 'common.error']))
      return
    }
    // Optional defect photo, attached to the inspection record just created.
    if (photo && profile && item.job?.project) {
      const inspectionId = await getLatestRejectionId(item.id)
      await uploadFile({
        file: photo,
        scope: { projectId: item.job.project.id, jobId: item.job.id, inspectionId },
        userId: profile.id,
      })
    }
    setBusy(false)
    onDone()
  }

  return (
    <Modal open onCancel={onClose} footer={null} title={null} destroyOnHidden>
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontFamily: token.fontFamilyCode, color: token.colorPrimary }}>
            {item.job?.job_code}
          </Typography.Title>
          <Typography.Text type="secondary">
            {item.job?.name} · {item.department?.name}
          </Typography.Text>
        </div>

        <div>
          <Typography.Text
            style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
          >
            {t('inspection.tasksHeader')}
          </Typography.Text>
          {item.tasks.length === 0 ? (
            <Typography.Text type="secondary">{t('jobDetail.noTasks')}</Typography.Text>
          ) : (
            <Card size="small" styles={{ body: { padding: 0 } }}>
              {item.tasks.map((tk, i) => (
                <div
                  key={tk.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 12px',
                    borderBottom: i === item.tasks.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <Typography.Text ellipsis>{localized(tk.name, tk.name_i18n, i18n.language)}</Typography.Text>
                  <Tag color={TASK_TAG_COLOR[tk.status]} style={{ marginInlineEnd: 0 }}>
                    {t(`taskStatus.${tk.status}`)}
                  </Tag>
                </div>
              ))}
            </Card>
          )}
        </div>

        {error && <Alert type="error" showIcon title={error} />}

        {!canInspect ? (
          <Alert type="info" title={t('inspection.notEligible')} />
        ) : rejecting ? (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Input.TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('inspection.rejectNotePlaceholder')}
              rows={3}
              autoFocus
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  border: `1px dashed ${token.colorBorder}`,
                  borderRadius: token.borderRadius,
                }}
              >
                <CameraOutlined /> {t('inspection.attachPhoto')}
              </span>
              {photo && (
                <Typography.Text type="secondary" ellipsis style={{ fontSize: 12, minWidth: 0 }}>
                  {photo.name}
                </Typography.Text>
              )}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button block size="large" onClick={() => setRejecting(false)}>
                {t('common.cancel')}
              </Button>
              <Button block size="large" danger type="primary" loading={busy} disabled={!note.trim()} onClick={() => void onReject()}>
                {t('inspection.confirmReject')}
              </Button>
            </div>
          </Space>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button block size="large" danger disabled={busy} onClick={() => setRejecting(true)}>
              {t('inspection.reject')}
            </Button>
            <Button
              block
              size="large"
              type="primary"
              icon={<CheckOutlined />}
              loading={busy}
              style={{ background: token.colorSuccess }}
              onClick={() => void onApprove()}
            >
              {t('inspection.approve')}
            </Button>
          </div>
        )}
      </Space>
    </Modal>
  )
}
