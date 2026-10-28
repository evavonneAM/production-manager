import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Col, Empty, Input, Modal, Row, Space, Statistic, Tag, Typography, theme } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getTask, getDirectory, getActiveSession, clockIn, clockOut, completeTask, approveTask, rejectTask, deleteTask, cancelTask } from '../lib/data'
import { clockOutResilient } from '../lib/offlineClock'
import { type AppLanguage } from '../i18n'
import { formatMinutes } from '../lib/format'
import { Notes } from '../components/Notes'
import { EditTaskModal } from '../components/EditTaskModal'
import { localized } from '../lib/i18nText'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { LiveTimer } from '../components/LiveTimer'
import type { TaskStatus } from '../lib/types'

const TASK_TAG_COLOR: Record<TaskStatus, string> = {
  pending_approval: 'orange',
  unstarted: 'default',
  in_progress: 'processing',
  paused: 'gold',
  completed: 'success',
  cancelled: 'default',
}

function SectionLabel({ children }: { children: string }) {
  const { token } = theme.useToken()
  return (
    <Typography.Text
      style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
    >
      {children}
    </Typography.Text>
  )
}

export default function TaskDetail() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { profile, refreshProfile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: task, loading, error: loadErr } = useAsync(
    () => getTask(taskId as string),
    [taskId, reloadKey],
  )
  const { data: directory } = useAsync(getDirectory, [])
  const { data: active } = useAsync(() => getActiveSession(profile?.id ?? ''), [profile?.id, reloadKey])

  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }, [directory])

  if (loading) return <FullScreenLoader />
  if (loadErr || !task || !profile) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  const myActive = profile.active_task_id
  const isActive = myActive === task.id
  const hasOtherActive = !!myActive && myActive !== task.id
  const stageDept = task.stage?.department?.id ?? null

  const clockable =
    (task.status === 'unstarted' || task.status === 'paused') &&
    (profile.role === 'admin' || // admins may pick up any workable task
      task.assigned_user_id === profile.id ||
      (task.assigned_user_id === null && stageDept === profile.department_id))

  const completable =
    task.status !== 'completed' &&
    task.status !== 'cancelled' &&
    task.status !== 'pending_approval' &&
    (task.assigned_user_id === profile.id ||
      profile.role === 'admin' ||
      (profile.role === 'lead' && stageDept === profile.department_id))

  const isPending = task.status === 'pending_approval'
  const canApprove =
    isPending &&
    (profile.role === 'admin' || (profile.role === 'lead' && stageDept === profile.department_id))

  const isAdmin = profile.role === 'admin'
  // Hard-delete would cascade away labor logs; with logged time we archive instead (SPEC §9).
  const hasLoggedTime = task.labor_logs.length > 0 || task.actual_minutes > 0

  async function run(fn: () => Promise<{ error: string | null }>) {
    setError(null)
    setBusy(true)
    const { error } = await fn()
    await refreshProfile()
    setBusy(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else setReloadKey((k) => k + 1)
  }

  const onClockIn = () => {
    if (hasOtherActive) setConfirmSwitch(true)
    else void run(() => clockIn(task.id))
  }
  const onSwitch = async () => {
    setConfirmSwitch(false)
    await run(async () => {
      const out = await clockOut()
      if (out.error) return out
      return clockIn(task.id)
    })
  }

  const logs = [...task.labor_logs].sort((a, b) => b.clocked_in_at.localeCompare(a.clocked_in_at))
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  async function onConfirmDelete() {
    setConfirmDelete(false)
    if (hasLoggedTime) {
      await run(() => cancelTask(task!.id))
    } else {
      setBusy(true)
      const { error } = await deleteTask(task!.id)
      setBusy(false)
      if (error) setError(t('common.error'))
      else navigate(task!.job ? `/jobs/${task!.job.id}` : '/my-work', { replace: true })
    }
  }

  const stat = (title: string, value: string) => (
    <Col span={12}>
      <Card size="small" style={{ height: '100%' }}>
        <Statistic title={title} value={value} styles={{ content: { fontSize: 16 } }} />
      </Card>
    </Col>
  )

  const onClockOut = () =>
    void run(async () => {
      const res = await clockOutResilient()
      if (res.queued) setError(t('taskDetail.clockOutQueued'))
      return { error: res.error }
    })

  return (
    <div style={{ maxWidth: 672, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      {task.job && (
        <Link to={`/jobs/${task.job.id}`}>
          <Typography.Text type="secondary">
            <ArrowLeftOutlined /> <span style={{ fontFamily: token.fontFamilyCode }}>{task.job.job_code}</span> · {task.job.name}
          </Typography.Text>
        </Link>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, margin: '12px 0 16px' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {localized(task.name, task.name_i18n, i18n.language)}
        </Typography.Title>
        <Tag color={TASK_TAG_COLOR[task.status]} style={{ marginInlineEnd: 0, marginTop: 6 }}>
          {t(`taskStatus.${task.status}`)}
        </Tag>
      </div>

      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {isAdmin && (
          <Space size={8}>
            <Button size="small" icon={<EditOutlined />} disabled={busy} onClick={() => setEditing(true)}>
              {t('taskEdit.edit')}
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={busy} onClick={() => setConfirmDelete(true)}>
              {t('taskEdit.delete')}
            </Button>
          </Space>
        )}

        {/* Pending approval */}
        {isPending && (
          <Card style={{ borderColor: token.colorWarningBorder, background: token.colorWarningBg }} styles={{ body: { padding: 16 } }}>
            <Typography.Paragraph style={{ marginBottom: canApprove ? 12 : 0 }}>{t('taskDetail.pendingApprovalInfo')}</Typography.Paragraph>
            {canApprove &&
              (rejecting ? (
                <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                  <Input.TextArea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder={t('inspection.rejectNotePlaceholder')}
                    rows={2}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button block onClick={() => setRejecting(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      block
                      danger
                      type="primary"
                      loading={busy}
                      disabled={!rejectNote.trim()}
                      onClick={() => void run(() => rejectTask(task.id, rejectNote.trim(), i18n.language as AppLanguage))}
                    >
                      {t('inspection.confirmReject')}
                    </Button>
                  </div>
                </Space>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button block danger disabled={busy} onClick={() => setRejecting(true)}>
                    {t('inspection.reject')}
                  </Button>
                  <Button
                    block
                    type="primary"
                    loading={busy}
                    style={{ background: token.colorSuccess }}
                    onClick={() => void run(() => approveTask(task.id))}
                  >
                    {t('inspection.approve')}
                  </Button>
                </div>
              ))}
          </Card>
        )}

        {error && <Alert type="error" showIcon title={error} />}

        {/* Clock controls */}
        {isActive ? (
          <Card style={{ borderColor: token.colorPrimary, borderWidth: 1.5 }} styles={{ body: { padding: 16 } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography.Text style={{ color: token.colorPrimary, fontWeight: 600 }}>● {t('taskDetail.clockedIn')}</Typography.Text>
              {active && (
                <span style={{ fontFamily: token.fontFamilyCode, fontSize: 20, fontWeight: 600 }}>
                  <LiveTimer since={active.clocked_in_at} />
                </span>
              )}
            </div>
            <Button type="primary" size="large" block loading={busy} onClick={onClockOut} style={{ marginTop: 14 }}>
              {t('myWork.clockOut')}
            </Button>
            {completable && (
              <Button size="large" block icon={<CheckOutlined />} disabled={busy} onClick={() => void run(() => completeTask(task.id))} style={{ marginTop: 8 }}>
                {t('taskDetail.markComplete')}
              </Button>
            )}
          </Card>
        ) : (
          (clockable || completable) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {clockable && (
                <Button type="primary" size="large" block loading={busy} onClick={onClockIn}>
                  {t('taskDetail.clockIn')}
                </Button>
              )}
              {completable && (
                <Button size="large" block icon={<CheckOutlined />} disabled={busy} onClick={() => void run(() => completeTask(task.id))}>
                  {t('taskDetail.markComplete')}
                </Button>
              )}
            </div>
          )
        )}

        <Row gutter={[12, 12]}>
          {stat(t('taskDetail.department'), task.stage?.department?.name ?? '—')}
          {stat(t('taskDetail.assignee'), task.assigned_user_id ? nameOf(task.assigned_user_id) : t('jobDetail.unassigned'))}
          {stat(t('jobDetail.estimated'), `${task.estimated_hours ?? 0}${t('units.h')}`)}
          {stat(t('jobDetail.actual'), formatMinutes(task.actual_minutes, { h: t('units.h'), m: t('units.m') }))}
        </Row>

        {task.instructions && (
          <Card size="small" styles={{ body: { padding: 16 } }}>
            <SectionLabel>{t('createTask.instructions')}</SectionLabel>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{task.instructions}</Typography.Paragraph>
          </Card>
        )}

        {/* Clock log */}
        <section>
          <SectionLabel>{t('taskDetail.clockLog')}</SectionLabel>
          {logs.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('taskDetail.noLog')} />
          ) : (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {logs.map((log) => (
                <Card key={log.id} size="small" styles={{ body: { padding: '10px 12px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <Typography.Text strong style={{ display: 'block' }}>{nameOf(log.user_id)}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {fmtTime(log.clocked_in_at)} – {log.clocked_out_at ? fmtTime(log.clocked_out_at) : t('taskDetail.active')}
                        {log.admin_override ? ` · ${t('taskDetail.autoClosed')}` : ''}
                      </Typography.Text>
                    </div>
                    <Typography.Text>
                      {log.duration_minutes != null
                        ? formatMinutes(log.duration_minutes, { h: t('units.h'), m: t('units.m') })
                        : '…'}
                    </Typography.Text>
                  </div>
                </Card>
              ))}
            </Space>
          )}
        </section>

        {/* Task-level notes */}
        {task.job && (
          <section>
            <SectionLabel>{t('jobDetail.tabNotes')}</SectionLabel>
            <Notes scope={{ projectId: task.job.project_id, jobId: task.job.id, taskId: task.id }} />
          </section>
        )}
      </Space>

      {/* Admin: edit task */}
      {editing && (
        <EditTaskModal
          task={task}
          directory={directory ?? []}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setReloadKey((k) => k + 1)
          }}
        />
      )}

      {/* Admin: delete / cancel confirmation */}
      <Modal
        open={confirmDelete}
        title={hasLoggedTime ? t('taskEdit.cancelTitle') : t('taskEdit.deleteTitle')}
        onCancel={() => setConfirmDelete(false)}
        onOk={() => void onConfirmDelete()}
        okText={hasLoggedTime ? t('taskEdit.cancelConfirm') : t('taskEdit.deleteConfirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={busy}
      >
        {hasLoggedTime ? t('taskEdit.cancelBody') : t('taskEdit.deleteBody')}
      </Modal>

      {/* Switch-task confirmation (S08) */}
      <Modal
        open={confirmSwitch}
        title={t('taskDetail.switchTitle')}
        onCancel={() => setConfirmSwitch(false)}
        onOk={() => void onSwitch()}
        okText={t('taskDetail.switchConfirm')}
        cancelText={t('common.cancel')}
      >
        {t('taskDetail.switchBody')}
      </Modal>
    </div>
  )
}
