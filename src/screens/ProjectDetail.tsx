import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Col, Empty, InputNumber, Modal, Row, Space, Statistic, Tabs, Tag, Typography, theme } from 'antd'
import { ArrowLeftOutlined, ExportOutlined, PrinterOutlined, QrcodeOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  createMaterial,
  createTask,
  getErLineItems,
  getProject,
  lineItemToJob,
  setLineItemStatus,
  type ErLineItem,
  type MaterialCategory,
} from '../lib/data'
import { formatMinutes, formatDate } from '../lib/format'
import { StagePipeline } from '../components/StagePipeline'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { QrModal } from '../components/QrModal'
import { Notes } from '../components/Notes'
import { FilesTab } from '../components/FilesTab'
import { Appointments } from '../components/Appointments'
import { localized } from '../lib/i18nText'
import { getProjectMaterials } from '../lib/data'
import type { JobWithStages, ProjectStatus } from '../lib/types'

const PROJECT_TAG_COLOR: Record<ProjectStatus, string> = {
  estimate: 'default',
  scheduled: 'purple',
  in_progress: 'processing',
  on_hold: 'orange',
  complete: 'success',
  delivered: 'cyan',
}

function SectionLabel({ children }: { children: ReactNode }) {
  const { token } = theme.useToken()
  return (
    <Typography.Text
      style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
    >
      {children}
    </Typography.Text>
  )
}

function JobCode({ code }: { code: string }) {
  const { token } = theme.useToken()
  return <span style={{ fontFamily: token.fontFamilyCode, fontWeight: 600, color: token.colorPrimary }}>{code}</span>
}

/** Native <select> (Ant Select has frozen in the owner's browser), styled like an Ant input. */
function useSelectStyle() {
  const { token } = theme.useToken()
  return {
    width: '100%',
    height: 36,
    padding: '0 10px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
  }
}

/** Admin review of line items parsed from the ER proposal (S12): each
 *  suggestion becomes a task on a chosen job + stage, or gets dismissed. */
function ErLineItemsPanel({ jobs, onJobsChanged }: { jobs: JobWithStages[]; onJobsChanged: () => void }) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const { token } = theme.useToken()
  const selectStyle = useSelectStyle()
  const { projectId } = useParams()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: items } = useAsync(() => getErLineItems(projectId as string), [projectId, reloadKey])
  const [placing, setPlacing] = useState<ErLineItem | null>(null)
  const [mode, setMode] = useState<'task' | 'material'>('task')
  const [jobId, setJobId] = useState('')
  const [stageId, setStageId] = useState('')
  const [category, setCategory] = useState<MaterialCategory>('other')
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (profile?.role !== 'admin') return null
  const open = (items ?? []).filter((it) => it.status === 'suggested')
  const accepted = (items ?? []).filter((it) => it.status === 'accepted')
  if (open.length === 0 && accepted.length === 0) return null

  function startPlacing(it: ErLineItem, asMode: 'task' | 'material') {
    const first = jobs[0]
    setJobId(first?.id ?? '')
    setStageId(first ? currentStageOf(first) : '')
    setCategory('other')
    setQty(it.quantity && it.quantity > 0 ? it.quantity : 1)
    setMode(asMode)
    setPlacing(it)
  }
  const currentStageOf = (j: JobWithStages) =>
    j.stages.find((s) => s.id === j.current_stage_id)?.id ?? j.stages[0]?.id ?? ''

  async function place() {
    if (!placing || !jobId || !profile) return
    setBusy(true)
    if (mode === 'task') {
      if (!stageId) return
      // Specs live on the project Scope, not the task (owner, 2026-07-27).
      const res = await createTask({
        jobId,
        jobStageId: stageId,
        name: placing.name,
        createdBy: profile.id,
      })
      if (!res.error && res.id) await setLineItemStatus(placing.id, 'accepted', { taskId: res.id })
    } else {
      const res = await createMaterial({
        jobId,
        name: placing.name,
        quantity: qty,
        category,
      })
      if (!res.error && res.id) await setLineItemStatus(placing.id, 'accepted', { materialId: res.id })
    }
    setBusy(false)
    setPlacing(null)
    setReloadKey((k) => k + 1)
  }

  async function dismiss(it: ErLineItem) {
    await setLineItemStatus(it.id, 'dismissed')
    setReloadKey((k) => k + 1)
  }

  async function makeJob(it: ErLineItem) {
    setBusy(true)
    setActionError(null)
    const res = await lineItemToJob(it.id)
    setBusy(false)
    setReloadKey((k) => k + 1)
    if (res.error) setActionError(t('common.error'))
    else onJobsChanged()
  }

  const selectedJob = jobs.find((j) => j.id === jobId)

  const label = (text: string) => (
    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
      {text}
    </Typography.Text>
  )

  return (
    <Card style={{ borderColor: token.colorPrimaryBorder }} styles={{ body: { padding: 16 } }}>
      <SectionLabel>{t('erItems.title')}</SectionLabel>
      {actionError && <Alert type="error" showIcon title={actionError} style={{ marginBottom: 8 }} />}
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        {open.map((it) => (
          <Card key={it.id} size="small" styles={{ body: { padding: 12 } }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong>
                  {it.name}
                  {it.quantity !== null && it.quantity > 1 && (
                    <Typography.Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                      ×{it.quantity}
                    </Typography.Text>
                  )}
                </Typography.Text>
                {it.description && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: token.colorTextTertiary }}>{t('erItems.specs')}</summary>
                    <Typography.Paragraph type="secondary" style={{ whiteSpace: 'pre-line', fontSize: 12, margin: '4px 0 0' }}>
                      {it.description}
                    </Typography.Paragraph>
                  </details>
                )}
              </div>
              <Space orientation="vertical" size={6} style={{ flexShrink: 0, alignItems: 'stretch' }}>
                <Button size="small" type="primary" style={{ background: token.colorSuccess }} disabled={busy} onClick={() => void makeJob(it)}>
                  {t('erItems.makeJob')}
                </Button>
                <Button size="small" type="primary" onClick={() => startPlacing(it, 'task')}>
                  {t('erItems.makeTask')}
                </Button>
                <Button size="small" onClick={() => startPlacing(it, 'material')}>
                  {t('erItems.makeMaterial')}
                </Button>
                <Button size="small" type="text" onClick={() => void dismiss(it)}>
                  {t('erItems.dismiss')}
                </Button>
              </Space>
            </div>
          </Card>
        ))}
        {accepted.map((it) => (
          <Typography.Text key={it.id} type="success" style={{ fontSize: 12, paddingInline: 4 }}>
            ✓ {it.name} —{' '}
            {it.job_id ? (
              <Link to={`/jobs/${it.job_id}`}>{t('erItems.jobCreated')}</Link>
            ) : (
              t(it.material_id ? 'erItems.materialAdded' : 'erItems.taskCreated')
            )}
          </Typography.Text>
        ))}
      </Space>

      <Modal
        open={!!placing}
        title={t(mode === 'task' ? 'erItems.placeTitle' : 'erItems.placeMaterialTitle')}
        onCancel={() => setPlacing(null)}
        onOk={() => void place()}
        okText={t(mode === 'task' ? 'createTask.create' : 'materials.add')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: mode === 'task' ? !stageId : !jobId }}
        confirmLoading={busy}
        destroyOnHidden
      >
        {placing && (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Typography.Text type="secondary">{placing.name}</Typography.Text>
            {jobs.length > 1 && (
              <select
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value)
                  const j = jobs.find((x) => x.id === e.target.value)
                  setStageId(j ? currentStageOf(j) : '')
                }}
                style={selectStyle}
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_code} · {localized(j.name, j.name_i18n, i18n.language)}
                  </option>
                ))}
              </select>
            )}
            {mode === 'task' ? (
              <div>
                {label(t('createTask.stage'))}
                <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={selectStyle}>
                  {(selectedJob?.stages ?? [])
                    .slice()
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.department?.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <Row gutter={8}>
                <Col span={12}>
                  {label(t('materials.category'))}
                  <select value={category} onChange={(e) => setCategory(e.target.value as MaterialCategory)} style={selectStyle}>
                    {(['fabric', 'com', 'insert', 'foam', 'hardware', 'other'] as const).map((c) => (
                      <option key={c} value={c}>
                        {t(`materialCategory.${c}`)}
                      </option>
                    ))}
                  </select>
                </Col>
                <Col span={12}>
                  {label(t('materials.qty'))}
                  <InputNumber min={0} value={qty} onChange={(v) => setQty(Number(v ?? 0))} style={{ width: '100%' }} />
                </Col>
              </Row>
            )}
          </Space>
        )}
      </Modal>
    </Card>
  )
}

const MATERIAL_TAG: Record<string, { color: string; key: string }> = {
  arrived: { color: 'success', key: 'jobDetail.arrived' },
  expected: { color: 'cyan', key: 'jobDetail.expected' },
  ordered: { color: 'processing', key: 'jobDetail.ordered' },
  notOrdered: { color: 'default', key: 'jobDetail.notOrdered' },
}

/** Read-only materials roll-up grouped by job (S05 Tab 3). */
function ProjectMaterials({ projectId }: { projectId: string }) {
  const { t, i18n } = useTranslation()
  const { data: groups, loading } = useAsync(() => getProjectMaterials(projectId), [projectId])

  if (loading) return <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
  const nonEmpty = (groups ?? []).filter((g) => g.materials.length > 0)
  if (nonEmpty.length === 0) return <Empty description={t('jobDetail.noMaterials')} />

  return (
    <Space orientation="vertical" size={20} style={{ width: '100%' }}>
      {nonEmpty.map((g) => (
        <section key={g.job_code}>
          <SectionLabel>
            <JobCode code={g.job_code} /> · {localized(g.job_name, g.job_name_i18n, i18n.language)}
          </SectionLabel>
          <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            {g.materials.map((m) => {
              const state = m.is_arrived ? 'arrived' : m.category === 'com' ? 'expected' : m.is_ordered ? 'ordered' : 'notOrdered'
              return (
                <Card key={m.id} size="small" styles={{ body: { padding: '10px 12px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <Typography.Text strong ellipsis style={{ display: 'block' }}>
                        {localized(m.name, m.name_i18n, i18n.language)}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {m.quantity}
                        {m.unit ? ` ${m.unit}` : ''}
                        {m.supplier ? ` · ${m.supplier}` : ''}
                      </Typography.Text>
                    </div>
                    <Tag color={MATERIAL_TAG[state].color} style={{ marginInlineEnd: 0 }}>
                      {t(MATERIAL_TAG[state].key)}
                    </Tag>
                  </div>
                </Card>
              )
            })}
          </Space>
        </section>
      ))}
    </Space>
  )
}

function JobRow({ job }: { job: JobWithStages }) {
  const { t, i18n } = useTranslation()
  const current = job.stages.find((s) => s.id === job.current_stage_id)
  return (
    <Link to={`/jobs/${job.id}`} style={{ display: 'block', color: 'inherit' }}>
      <Card hoverable size="small" styles={{ body: { padding: 14 } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <JobCode code={job.job_code} />
            <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
              {localized(job.name, job.name_i18n, i18n.language)}
            </Typography.Text>
          </div>
          <Tag style={{ marginInlineEnd: 0 }}>{current?.department?.name ?? t('jobDetail.complete')}</Tag>
        </div>
        <div style={{ marginTop: 12 }}>
          <StagePipeline stages={job.stages} />
        </div>
      </Card>
    </Link>
  )
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data: project, loading, error } = useAsync(
    () => getProject(projectId as string),
    [projectId, reloadKey],
  )
  const [tab, setTab] = useState('overview')
  const [showQr, setShowQr] = useState(false)

  if (loading) return <FullScreenLoader />
  if (error || !project) return <Alert type="error" showIcon title={t('common.error')} style={{ margin: 16 }} />

  const totalLabor = project.jobs.reduce((sum, j) => sum + j.total_labor_minutes, 0)
  const printAll = () =>
    void import('../lib/labels').then((m) =>
      m.printJobLabels(
        project.jobs.map((j) => ({ job_code: j.job_code, name: j.name, qr_code_uuid: j.qr_code_uuid })),
        project.client_name,
      ),
    )

  return (
    <div style={{ maxWidth: 768, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <Link to="/projects">
        <Typography.Text type="secondary">
          <ArrowLeftOutlined /> {t('nav.projects')}
        </Typography.Text>
      </Link>

      <div style={{ margin: '12px 0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {project.name}
          </Typography.Title>
          <Tag color={PROJECT_TAG_COLOR[project.status]} style={{ marginInlineEnd: 0, marginTop: 6 }}>
            {t(`projectStatus.${project.status}`)}
          </Tag>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 15 }}>
          {project.work_order_number && (
            <>
              <JobCode code={project.work_order_number} />
              {' · '}
            </>
          )}
          {project.client_name}
        </Typography.Text>
        <Space size={8} style={{ display: 'flex', marginTop: 12 }}>
          <Button icon={<QrcodeOutlined />} onClick={() => setShowQr(true)}>
            {t('qr.projectQr')}
          </Button>
          {project.jobs.length > 0 && (
            <Button icon={<PrinterOutlined />} onClick={printAll}>
              {t('qr.printAll')}
            </Button>
          )}
        </Space>
      </div>

      {showQr && (
        <QrModal
          value={`${window.location.origin}/p/${project.qr_code_uuid}`}
          title={project.work_order_number ?? project.name}
          onClose={() => setShowQr(false)}
        />
      )}

      <Tabs
        activeKey={tab}
        onChange={setTab}
        tabBarGutter={20}
        items={[
          { key: 'overview', label: t('projectDetail.tabOverview') },
          { key: 'jobs', label: t('projectDetail.tabJobs') },
          { key: 'materials', label: t('jobDetail.tabMaterials') },
          { key: 'notes', label: t('jobDetail.tabNotes') },
          { key: 'files', label: t('jobDetail.tabFiles') },
        ]}
      />

      {tab === 'files' && <FilesTab projectId={project.id} />}

      {tab === 'materials' && <ProjectMaterials projectId={project.id} />}

      {tab === 'notes' && <Notes scope={{ projectId: project.id }} />}

      {tab === 'overview' && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col span={12}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic title={t('projectDetail.client')} value={project.client_name} styles={{ content: { fontSize: 16 } }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic
                  title={t('projectDetail.totalLabor')}
                  value={formatMinutes(totalLabor, { h: t('units.h'), m: t('units.m') })}
                  styles={{ content: { fontSize: 16 } }}
                />
              </Card>
            </Col>
            {project.scheduled_start && (
              <Col span={12}>
                <Card size="small" style={{ height: '100%' }}>
                  <Statistic
                    title={t('projectDetail.scheduledStart')}
                    value={formatDate(project.scheduled_start, i18n.language)}
                    styles={{ content: { fontSize: 16 } }}
                  />
                </Card>
              </Col>
            )}
            {project.scheduled_end && (
              <Col span={12}>
                <Card size="small" style={{ height: '100%' }}>
                  <Statistic
                    title={t('projectDetail.scheduledEnd')}
                    value={formatDate(project.scheduled_end, i18n.language)}
                    styles={{ content: { fontSize: 16 } }}
                  />
                </Card>
              </Col>
            )}
          </Row>

          <ErLineItemsPanel jobs={project.jobs} onJobsChanged={() => setReloadKey((k) => k + 1)} />

          {/* The portal document shows prices — admins only (owner requirement). */}
          {profile?.role === 'admin' && project.er_portal_url && (
            <Button block icon={<ExportOutlined />} href={project.er_portal_url} target="_blank" rel="noreferrer">
              {t('projectDetail.viewWorkOrder')}
            </Button>
          )}

          <Appointments projectId={project.id} />

          {project.description && (
            <Card size="small" styles={{ body: { padding: 16 } }}>
              <SectionLabel>{t('projectDetail.scope')}</SectionLabel>
              <Typography.Paragraph style={{ whiteSpace: 'pre-line', margin: 0 }}>
                {localized(project.description ?? '', project.description_i18n, i18n.language)}
              </Typography.Paragraph>
            </Card>
          )}

          <section>
            <SectionLabel>{t('projectDetail.jobs')}</SectionLabel>
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              {project.jobs.map((job) => {
                const current = job.stages.find((s) => s.id === job.current_stage_id)
                return (
                  <Link key={job.id} to={`/jobs/${job.id}`} style={{ display: 'block', color: 'inherit' }}>
                    <Card hoverable size="small" styles={{ body: { padding: '10px 12px' } }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text ellipsis style={{ minWidth: 0 }}>
                          <JobCode code={job.job_code} />{' '}
                          <Typography.Text type="secondary">{localized(job.name, job.name_i18n, i18n.language)}</Typography.Text>
                        </Typography.Text>
                        <Tag style={{ marginInlineEnd: 0 }}>{current?.department?.name ?? t('jobDetail.complete')}</Tag>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </Space>
          </section>
        </Space>
      )}

      {tab === 'jobs' &&
        (project.jobs.length === 0 ? (
          <Empty description={t('projectDetail.noJobs')} />
        ) : (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            {project.jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </Space>
        ))}
    </div>
  )
}
