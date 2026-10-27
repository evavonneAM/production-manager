import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Col, Empty, Input, Modal, Row, Space, Statistic, Tabs, Tag, Timeline, Typography, theme } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, QrcodeOutlined, ScissorOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { deleteJob, getJob, getDirectory, getJobInspections, splitJob, submitStage, updateJob } from '../lib/data'
import { formatMinutes, formatDate } from '../lib/format'
import { StagePipeline } from '../components/StagePipeline'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { QrModal } from '../components/QrModal'
import { CreateTaskModal } from '../components/CreateTaskModal'
import { Notes } from '../components/Notes'
import { MaterialsTab } from '../components/MaterialsTab'
import { FilesTab } from '../components/FilesTab'
import { Appointments } from '../components/Appointments'
import { localized } from '../lib/i18nText'
import type { JobDetail as JobDetailT, StageWithDept, Task, TaskStatus, JobInspection } from '../lib/types'

/** Admin: rename a job / edit its scope (owner feedback 2026-07-30 — split
 *  jobs kept the project title with no way to say which piece they were). */
function EditJobDialog({
  job,
  onClose,
  onSaved,
  onDeleted,
}: {
  job: JobDetailT
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(job.name)
  const [scope, setScope] = useState(job.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const res = await updateJob(job.id, { name: name.trim(), description: scope.trim() || null })
    setBusy(false)
    if (res.error) setError(t('common.error'))
    else onSaved()
  }

  async function doDelete() {
    setBusy(true)
    setError(null)
    const res = await deleteJob(job.id)
    setBusy(false)
    if (res.error) {
      setConfirmDelete(false)
      setError(res.error.includes('has_labor') ? t('jobEdit.hasLabor') : t('common.error'))
    } else onDeleted()
  }

  return (
    <Modal
      open
      title={t('jobEdit.title')}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('jobEdit.name')}</Typography.Text>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('projectDetail.scope')}</Typography.Text>
          <Input.TextArea value={scope} onChange={(e) => setScope(e.target.value)} rows={8} />
        </div>
        {error && <Alert type="error" showIcon title={error} />}
        {confirmDelete ? (
          <Alert
            type="error"
            title={t('jobEdit.deleteTitle')}
            description={
              <>
                <div>{t('jobEdit.deleteBody')}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button block onClick={() => setConfirmDelete(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button block danger type="primary" loading={busy} onClick={() => void doDelete()}>
                    {t('jobEdit.deleteConfirm')}
                  </Button>
                </div>
              </>
            }
          />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button block onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button block type="primary" loading={busy} disabled={!name.trim()} onClick={() => void save()}>
                {t('common.save')}
              </Button>
            </div>
            <Button block danger icon={<DeleteOutlined />} onClick={() => setConfirmDelete(true)}>
              {t('jobEdit.delete')}
            </Button>
          </>
        )}
      </Space>
    </Modal>
  )
}

/** Admin: split an imported single job into -A/-B/… pieces (S12; ER sends no
 *  line items). The original keeps all its state and becomes -A. */
function SplitJobDialog({ job, onClose, onDone }: { job: JobDetailT; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const [names, setNames] = useState<string[]>([''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function doSplit() {
    setBusy(true)
    setError(null)
    const res = await splitJob(job.id, names)
    setBusy(false)
    if (res.error) setError(t('common.error'))
    else onDone()
  }

  return (
    <Modal
      open
      title={t('splitJob.title')}
      onCancel={onClose}
      onOk={() => void doSplit()}
      okText={t('splitJob.confirm')}
      cancelText={t('common.cancel')}
      confirmLoading={busy}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">{t('splitJob.explain', { code: job.job_code })}</Typography.Paragraph>
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        {names.map((n, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text code style={{ width: 72, flexShrink: 0 }}>
              {job.job_code}-{String.fromCharCode(66 + i)}
            </Typography.Text>
            <Input
              value={n}
              onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={t('splitJob.namePlaceholder')}
            />
            {names.length > 1 && (
              <Button aria-label={t('common.cancel')} onClick={() => setNames(names.filter((_, j) => j !== i))}>
                ✕
              </Button>
            )}
          </div>
        ))}
      </Space>
      {names.length < 10 && (
        <Button type="link" icon={<PlusOutlined />} onClick={() => setNames([...names, ''])} style={{ paddingInline: 0, marginTop: 4 }}>
          {t('splitJob.addPiece')}
        </Button>
      )}
      {error && <Alert type="error" showIcon title={error} style={{ marginTop: 8 }} />}
    </Modal>
  )
}

function CurrentStageCard({ job, onChanged }: { job: JobDetailT; onChanged: () => void }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = job.stages.find((s) => s.id === job.current_stage_id)
  if (!current) return null
  const tasks = job.tasks.filter((tk) => tk.job_stage_id === current.id)
  const done = tasks.filter((tk) => tk.status === 'completed').length
  const allComplete = tasks.length > 0 && done === tasks.length

  const canSubmit =
    (current.status === 'queued' || current.status === 'in_progress') &&
    (profile?.role === 'admin' ||
      (profile?.role === 'lead' && current.department?.id === profile?.department_id))

  async function doSubmit() {
    setBusy(true)
    setError(null)
    const { error } = await submitStage(current!.id)
    setBusy(false)
    setConfirm(false)
    if (error) setError(t([`clockError.${error}`, 'common.error']))
    else onChanged()
  }

  return (
    <Card style={{ borderColor: token.colorPrimary, borderWidth: 1.5 }} styles={{ body: { padding: 16 } }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('jobDetail.currentStage')}</Typography.Text>
          <Typography.Text strong style={{ display: 'block', fontSize: 16 }}>{current.department?.name}</Typography.Text>
        </div>
        <Typography.Text type="secondary">{t('jobDetail.tasksDone', { done, total: tasks.length })}</Typography.Text>
      </div>

      {current.status === 'pending_inspection' ? (
        <Alert type="warning" title={t('jobDetail.awaitingInspection')} style={{ marginTop: 12, textAlign: 'center' }} />
      ) : (
        canSubmit && (
          <>
            {error && <Alert type="error" showIcon title={error} style={{ marginTop: 8 }} />}
            <Button type="primary" size="large" block loading={busy} onClick={() => setConfirm(true)} style={{ marginTop: 14 }}>
              {t('jobDetail.submitForInspection')}
            </Button>
          </>
        )
      )}

      <Modal
        open={confirm}
        title={t('jobDetail.submitConfirmTitle')}
        onCancel={() => setConfirm(false)}
        onOk={() => void doSubmit()}
        okText={t('jobDetail.submitForInspection')}
        cancelText={t('common.cancel')}
        confirmLoading={busy}
      >
        {allComplete ? t('jobDetail.submitConfirmBody') : t('jobDetail.submitIncompleteWarn')}
      </Modal>
    </Card>
  )
}

const TASK_TAG_COLOR: Record<TaskStatus, string> = {
  pending_approval: 'orange',
  unstarted: 'default',
  in_progress: 'processing',
  paused: 'gold',
  completed: 'success',
  cancelled: 'default',
}

function SectionLabel({ children }: { children: string | undefined }) {
  const { token } = theme.useToken()
  return (
    <Typography.Text
      style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
    >
      {children}
    </Typography.Text>
  )
}

function TasksTab({ job, nameOf }: { job: JobDetailT; nameOf: (id: string | null) => string }) {
  const { t, i18n } = useTranslation()
  if (job.tasks.length === 0) return <Empty description={t('jobDetail.noTasks')} />

  // Group tasks by stage, in routing order.
  const byStage = new Map<string, Task[]>()
  for (const task of job.tasks) {
    const arr = byStage.get(task.job_stage_id) ?? []
    arr.push(task)
    byStage.set(task.job_stage_id, arr)
  }
  const orderedStages = [...job.stages].sort((a, b) => a.sequence - b.sequence)

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      {orderedStages
        .filter((stage) => byStage.has(stage.id))
        .map((stage: StageWithDept) => (
          <section key={stage.id}>
            <SectionLabel>{stage.department?.name}</SectionLabel>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {byStage.get(stage.id)!.map((task) => (
                <Link key={task.id} to={`/tasks/${task.id}`} style={{ display: 'block', color: 'inherit' }}>
                  <Card hoverable size="small" styles={{ body: { padding: '10px 12px' } }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <Typography.Text strong ellipsis style={{ display: 'block' }}>
                          {localized(task.name, task.name_i18n, i18n.language)}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          {task.assigned_user_id ? nameOf(task.assigned_user_id) : t('jobDetail.unassigned')}
                        </Typography.Text>
                      </div>
                      <Tag color={TASK_TAG_COLOR[task.status]} style={{ marginInlineEnd: 0 }}>
                        {t(`taskStatus.${task.status}`)}
                      </Tag>
                    </div>
                  </Card>
                </Link>
              ))}
            </Space>
          </section>
        ))}
    </Space>
  )
}

function HistoryTab({
  job,
  inspections,
  nameOf,
}: {
  job: JobDetailT
  inspections: JobInspection[]
  nameOf: (id: string | null) => string
}) {
  const { t, i18n } = useTranslation()
  type Event = { label: string; note?: string; when: string }
  const events: Event[] = []

  for (const s of job.stages) {
    if (s.entered_at)
      events.push({ label: t('jobDetail.enteredStage', { dept: s.department?.name }), when: s.entered_at })
  }
  for (const insp of inspections) {
    const dept = insp.job_stage?.department?.name
    const who = nameOf(insp.inspector_id)
    if (insp.decision === 'approved') {
      events.push({ label: t('jobDetail.inspApproved', { dept, name: who }), when: insp.decided_at })
    } else {
      events.push({
        label: t('jobDetail.inspRejected', { dept, name: who }),
        note: insp.note?.original_text ?? undefined,
        when: insp.decided_at,
      })
    }
  }

  events.sort((a, b) => a.when.localeCompare(b.when))
  if (events.length === 0) return <Empty description={t('jobDetail.noHistory')} />

  return (
    <Card styles={{ body: { padding: '20px 16px 4px' } }}>
      <Timeline
        items={events.map((e) => ({
          content: (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <Typography.Text>{e.label}</Typography.Text>
                <Typography.Text type="secondary" style={{ flexShrink: 0 }}>
                  {formatDate(e.when, i18n.language)}
                </Typography.Text>
              </div>
              {e.note && (
                <Typography.Text type="secondary" italic style={{ fontSize: 13 }}>
                  "{e.note}"
                </Typography.Text>
              )}
            </>
          ),
        }))}
      />
    </Card>
  )
}

export default function JobDetail() {
  const { jobId } = useParams()
  const [searchParams] = useSearchParams()
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: job, loading, error } = useAsync(() => getJob(jobId as string), [jobId, reloadKey])
  const { data: directory } = useAsync(getDirectory, [])
  const { data: inspections } = useAsync(() => getJobInspections(jobId as string), [jobId, reloadKey])
  // Deep links may open a specific tab (e.g. material QR -> materials, files).
  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState(
    requestedTab && ['tasks', 'materials', 'notes', 'files', 'history'].includes(requestedTab)
      ? requestedTab
      : 'tasks',
  )
  const highlightMaterial = searchParams.get('m')
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [showQr, setShowQr] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [showEditJob, setShowEditJob] = useState(false)

  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—')
  }, [directory])

  if (loading) return <FullScreenLoader />
  if (error || !job) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  const estHours = job.tasks.reduce((s, tk) => s + (tk.estimated_hours ?? 0), 0)
  const actualMin = job.tasks.reduce((s, tk) => s + tk.actual_minutes, 0)

  const tabs = [
    { key: 'tasks', label: t('jobDetail.tabTasks') },
    { key: 'materials', label: t('jobDetail.tabMaterials') },
    { key: 'notes', label: t('jobDetail.tabNotes') },
    { key: 'files', label: t('jobDetail.tabFiles') },
    { key: 'history', label: t('jobDetail.tabHistory') },
  ]

  return (
    <div style={{ maxWidth: 768, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      {job.project && (
        <Link to={`/projects/${job.project.id}`}>
          <Typography.Text type="secondary">
            <ArrowLeftOutlined /> {job.project.name}
          </Typography.Text>
        </Link>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, margin: '12px 0 20px' }}>
        <div style={{ minWidth: 0 }}>
          <Typography.Title level={2} style={{ margin: 0, fontFamily: token.fontFamilyCode, color: token.colorPrimary }}>
            {job.job_code}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 15 }}>
            {localized(job.name, job.name_i18n, i18n.language)}
          </Typography.Text>
          {profile?.role === 'admin' && (
            <Space size={8} style={{ display: 'flex', marginTop: 10 }}>
              <Button size="small" icon={<EditOutlined />} onClick={() => setShowEditJob(true)}>
                {t('jobEdit.button')}
              </Button>
              {job.suffix === null && (
                <Button size="small" icon={<ScissorOutlined />} onClick={() => setShowSplit(true)}>
                  {t('splitJob.button')}
                </Button>
              )}
            </Space>
          )}
        </div>
        <Button size="large" icon={<QrcodeOutlined />} aria-label={t('qr.showQr')} onClick={() => setShowQr(true)} />
      </div>

      {job.description && (
        <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
          <SectionLabel>{t('projectDetail.scope')}</SectionLabel>
          <Typography.Paragraph style={{ whiteSpace: 'pre-line', margin: 0 }}>
            {localized(job.description, job.description_i18n, i18n.language)}
          </Typography.Paragraph>
        </Card>
      )}

      {showEditJob && (
        <EditJobDialog
          job={job}
          onClose={() => setShowEditJob(false)}
          onSaved={() => {
            setShowEditJob(false)
            setReloadKey((k) => k + 1)
          }}
          onDeleted={() => navigate(job.project ? `/projects/${job.project.id}` : '/projects', { replace: true })}
        />
      )}

      {showSplit && (
        <SplitJobDialog
          job={job}
          onClose={() => setShowSplit(false)}
          onDone={() => {
            setShowSplit(false)
            setReloadKey((k) => k + 1)
          }}
        />
      )}

      {showQr && (
        <QrModal
          value={`${window.location.origin}/j/${job.qr_code_uuid}`}
          title={job.job_code}
          onClose={() => setShowQr(false)}
          onPrint={() =>
            void import('../lib/labels').then((m) =>
              m.printJobLabels(
                [{ job_code: job.job_code, name: job.name, qr_code_uuid: job.qr_code_uuid }],
                job.project?.client_name ?? '',
              ),
            )
          }
        />
      )}

      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
        <StagePipeline stages={job.stages} />
      </Card>

      <div style={{ marginBottom: 16 }}>
        <CurrentStageCard job={job} onChanged={() => setReloadKey((k) => k + 1)} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Appointments jobId={job.id} />
      </div>

      <Row gutter={12} style={{ marginBottom: 8 }}>
        <Col span={12}>
          <Card size="small">
            <Statistic title={t('jobDetail.estimated')} value={`${estHours}${t('units.h')}`} styles={{ content: { fontSize: 20 } }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic
              title={t('jobDetail.actual')}
              value={formatMinutes(actualMin, { h: t('units.h'), m: t('units.m') })}
              styles={{ content: { fontSize: 20 } }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={tab} onChange={setTab} items={tabs} />

      <div>
        {tab === 'tasks' && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Button icon={<PlusOutlined />} onClick={() => setShowCreateTask(true)}>
              {t('createTask.add')}
            </Button>
            <TasksTab job={job} nameOf={nameOf} />
          </Space>
        )}
        {tab === 'materials' && (
          <MaterialsTab
            job={job}
            highlightId={highlightMaterial}
            onChanged={() => setReloadKey((k) => k + 1)}
          />
        )}
        {tab === 'notes' &&
          (job.project ? (
            <Notes scope={{ projectId: job.project.id, jobId: job.id }} />
          ) : (
            <Empty description={t('jobDetail.noNotes')} />
          ))}
        {tab === 'files' &&
          (job.project ? (
            <FilesTab projectId={job.project.id} jobId={job.id} />
          ) : (
            <Empty description={t('jobDetail.noFiles')} />
          ))}
        {tab === 'history' && (
          <HistoryTab job={job} inspections={inspections ?? []} nameOf={nameOf} />
        )}
      </div>

      {showCreateTask && (
        <CreateTaskModal
          jobId={job.id}
          stages={job.stages}
          directory={directory ?? []}
          defaultStageId={job.current_stage_id ?? undefined}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => {
            setShowCreateTask(false)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
