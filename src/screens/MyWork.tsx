import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Badge, Button, Card, Empty, Segmented, Space, Tag, Typography, theme } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getMyWork, getActiveSession, clockOut, getPendingApprovals, approveTask, getBadgeCounts } from '../lib/data'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { LiveTimer } from '../components/LiveTimer'
import { localized } from '../lib/i18nText'
import type { TaskStatus, TaskWithJob, DeptQueueJob, PendingApproval } from '../lib/types'

const TASK_TAG_COLOR: Record<TaskStatus, string> = {
  pending_approval: 'orange',
  unstarted: 'default',
  in_progress: 'processing',
  paused: 'gold',
  completed: 'success',
  cancelled: 'default',
}

function StatusTag({ status }: { status: TaskStatus }) {
  const { t } = useTranslation()
  return (
    <Tag color={TASK_TAG_COLOR[status]} style={{ marginInlineEnd: 0 }}>
      {t(`taskStatus.${status}`)}
    </Tag>
  )
}

function JobCode({ code }: { code: string }) {
  const { token } = theme.useToken()
  return <span style={{ fontFamily: token.fontFamilyCode, color: token.colorPrimary }}>{code}</span>
}

/** One tappable row: title + job line on the left, anything (tag, button) on the right. */
function Row({ to, title, sub, extra }: { to?: string; title: ReactNode; sub?: ReactNode; extra?: ReactNode }) {
  const body = (
    <div style={{ minWidth: 0, flex: 1 }}>
      <Typography.Text strong ellipsis style={{ display: 'block' }}>
        {title}
      </Typography.Text>
      {sub && (
        <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
          {sub}
        </Typography.Text>
      )}
    </div>
  )
  return (
    <Card hoverable={!!to} size="small" styles={{ body: { padding: '10px 12px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {to ? (
          <Link to={to} style={{ minWidth: 0, flex: 1, color: 'inherit' }}>
            {body}
          </Link>
        ) : (
          body
        )}
        {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
      </div>
    </Card>
  )
}

function TaskRow({ task }: { task: TaskWithJob }) {
  const { i18n } = useTranslation()
  return (
    <Row
      to={`/tasks/${task.id}`}
      title={localized(task.name, task.name_i18n, i18n.language)}
      sub={
        task.job && (
          <>
            <JobCode code={task.job.job_code} /> · {localized(task.job.name, task.job.name_i18n, i18n.language)}
          </>
        )
      }
      extra={<StatusTag status={task.status} />}
    />
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { token } = theme.useToken()
  return (
    <section>
      <Typography.Text
        type="secondary"
        style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
      >
        {title}
      </Typography.Text>
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        {children}
      </Space>
    </section>
  )
}

function DeptQueueRow({ job }: { job: DeptQueueJob }) {
  const { t, i18n } = useTranslation()
  const done = job.tasks.filter((tk) => tk.status === 'completed').length
  const matStatus =
    job.materials.length === 0 ? 'default' : job.materials.every((m) => m.is_arrived) ? 'success' : 'error'
  return (
    <Row
      to={`/jobs/${job.id}`}
      title={
        <>
          <JobCode code={job.job_code} />{' '}
          <Typography.Text type="secondary">{localized(job.name, job.name_i18n, i18n.language)}</Typography.Text>
        </>
      }
      sub={<Badge status={matStatus} text={t('myWork.tasksProgress', { done, total: job.tasks.length })} />}
    />
  )
}

function ApprovalRow({ task, onApproved }: { task: PendingApproval; onApproved: () => void }) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const [busy, setBusy] = useState(false)
  async function approve() {
    setBusy(true)
    await approveTask(task.id)
    setBusy(false)
    onApproved()
  }
  return (
    <Row
      to={`/tasks/${task.id}`}
      title={localized(task.name, task.name_i18n, i18n.language)}
      sub={task.job && <JobCode code={task.job.job_code} />}
      extra={
        <Button
          type="primary"
          size="small"
          loading={busy}
          onClick={() => void approve()}
          style={{ background: token.colorSuccess }}
        >
          {t('inspection.approve')}
        </Button>
      }
    />
  )
}

export default function MyWork() {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { profile, refreshProfile } = useAuth()
  const [tab, setTab] = useState<'mine' | 'dept'>('mine')
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uid = profile?.id ?? ''
  const { data, loading, error: loadErr } = useAsync(
    () => getMyWork(uid, profile?.department_id ?? null),
    [uid, profile?.department_id, reloadKey],
  )
  const { data: active } = useAsync(() => getActiveSession(uid), [uid, reloadKey])
  const { data: badges } = useAsync(getBadgeCounts, [reloadKey])
  const { data: approvals } = useAsync(
    () => getPendingApprovals(profile?.role ?? '', profile?.department_id ?? null),
    [profile?.role, profile?.department_id, reloadKey],
  )

  const groups = useMemo(() => {
    const list = data?.myTasks ?? []
    const activeId = profile?.active_task_id ?? null
    return {
      active: list.find((tk) => tk.id === activeId) ?? null,
      upNext: list.filter(
        (tk) => tk.assigned_user_id === uid && tk.id !== activeId && (tk.status === 'unstarted' || tk.status === 'paused'),
      ),
      pending: list.filter((tk) => tk.created_by === uid && tk.status === 'pending_approval'),
      completed: list.filter((tk) => tk.assigned_user_id === uid && tk.status === 'completed').slice(0, 5),
    }
  }, [data, profile?.active_task_id, uid])

  async function onClockOut() {
    setError(null)
    setBusy(true)
    const { error } = await clockOut()
    await refreshProfile()
    setBusy(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else setReloadKey((k) => k + 1)
  }

  if (!profile) return <FullScreenLoader />

  const nothing =
    !groups.active &&
    groups.upNext.length === 0 &&
    groups.pending.length === 0 &&
    groups.completed.length === 0 &&
    (approvals?.length ?? 0) === 0

  return (
    <div style={{ maxWidth: 672, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('nav.myWork')}
        </Typography.Title>
        <Link to="/inbox" aria-label={t('inbox.title')} className="md:hidden">
          <Badge count={badges?.unread ?? 0} overflowCount={9} size="small">
            <Button icon={<BellOutlined />} />
          </Badge>
        </Link>
      </div>

      <Segmented
        block
        value={tab}
        onChange={(k) => setTab(k as 'mine' | 'dept')}
        options={[
          { value: 'mine', label: t('myWork.myTasks') },
          { value: 'dept', label: t('myWork.deptQueue') },
        ]}
      />

      {loading && <FullScreenLoader />}
      {loadErr && <Alert type="error" showIcon title={t('common.error')} style={{ marginTop: 20 }} />}

      {!loading && !loadErr && tab === 'mine' && (
        <Space orientation="vertical" size={24} style={{ width: '100%', marginTop: 20 }}>
          {error && <Alert type="error" showIcon title={error} />}

          {(approvals?.length ?? 0) > 0 && (
            <Section title={t('myWork.awaitingApproval')}>
              {approvals!.map((tk) => (
                <ApprovalRow key={tk.id} task={tk} onApproved={() => setReloadKey((k) => k + 1)} />
              ))}
            </Section>
          )}

          {groups.active && (
            <Section title={t('myWork.active')}>
              <Card style={{ borderColor: token.colorPrimary, borderWidth: 1.5 }} styles={{ body: { padding: 16 } }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge status="processing" text={<Typography.Text style={{ color: token.colorPrimary, fontWeight: 600 }}>{t('taskStatus.in_progress')}</Typography.Text>} />
                  {active && (
                    <span style={{ fontFamily: token.fontFamilyCode, fontSize: 20, fontWeight: 600 }}>
                      <LiveTimer since={active.clocked_in_at} />
                    </span>
                  )}
                </div>
                <Link to={`/tasks/${groups.active.id}`} style={{ display: 'block', marginTop: 8, color: 'inherit' }}>
                  <Typography.Text strong style={{ display: 'block', fontSize: 16 }}>
                    {groups.active.name}
                  </Typography.Text>
                  {groups.active.job && (
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      <JobCode code={groups.active.job.job_code} /> · {groups.active.job.name}
                    </Typography.Text>
                  )}
                </Link>
                <Button type="primary" size="large" block loading={busy} onClick={() => void onClockOut()} style={{ marginTop: 14 }}>
                  {t('myWork.clockOut')}
                </Button>
              </Card>
            </Section>
          )}

          {groups.upNext.length > 0 && (
            <Section title={t('myWork.upNext')}>
              {groups.upNext.map((tk) => <TaskRow key={tk.id} task={tk} />)}
            </Section>
          )}
          {groups.pending.length > 0 && (
            <Section title={t('myWork.pendingApproval')}>
              {groups.pending.map((tk) => <TaskRow key={tk.id} task={tk} />)}
            </Section>
          )}
          {groups.completed.length > 0 && (
            <Section title={t('myWork.recentlyCompleted')}>
              {groups.completed.map((tk) => <TaskRow key={tk.id} task={tk} />)}
            </Section>
          )}

          {nothing && <Empty description={t('myWork.noTasks')} style={{ marginTop: 32 }} />}
        </Space>
      )}

      {!loading && !loadErr && tab === 'dept' && (
        <div style={{ marginTop: 20 }}>
          {(data?.deptQueue.length ?? 0) === 0 ? (
            <Empty description={t('myWork.noQueue')} style={{ marginTop: 32 }} />
          ) : (
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {data!.deptQueue.map((job) => <DeptQueueRow key={job.id} job={job} />)}
            </Space>
          )}
        </div>
      )}
    </div>
  )
}
