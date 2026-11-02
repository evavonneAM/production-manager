import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Badge, Button, Card, Empty, Input, Space, Tag, Typography, theme } from 'antd'
import { SyncOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getProjectsOverview, requestErResync } from '../lib/data'
import { ALL_PROJECT_STATUSES } from '../lib/status'
import { formatMinutes } from '../lib/format'
import { FullScreenLoader } from '../components/FullScreenLoader'
import type { ProjectOverview, ProjectStatus } from '../lib/types'

type SortKey = 'date' | 'priority' | 'status' | 'updated'

function materialsDot(project: ProjectOverview): 'gray' | 'red' | 'green' {
  const mats = project.jobs.flatMap((j) => j.materials)
  if (mats.length === 0) return 'gray'
  return mats.every((m) => m.is_arrived) ? 'green' : 'red'
}

const PROJECT_TAG_COLOR: Record<ProjectStatus, string> = {
  estimate: 'default',
  scheduled: 'purple',
  in_progress: 'processing',
  on_hold: 'orange',
  complete: 'success',
  delivered: 'cyan',
}

function ProjectCard({ project }: { project: ProjectOverview }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const jobCount = project.jobs.length

  // Per-stage breakdown: count jobs by their current department.
  const breakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const job of project.jobs) {
      const dept = job.current_stage?.department?.name
      if (dept) counts.set(dept, (counts.get(dept) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [project.jobs])

  const dot = materialsDot(project)
  const dotStatus = dot === 'green' ? 'success' : dot === 'red' ? 'error' : 'default'

  return (
    <Link to={`/projects/${project.id}`} style={{ display: 'block', color: 'inherit' }}>
      <Card hoverable size="small" styles={{ body: { padding: 14 } }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 16 }}>
              {project.name}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
              {project.work_order_number && (
                <>
                  <span style={{ fontFamily: token.fontFamilyCode, color: token.colorPrimary }}>
                    {project.work_order_number}
                  </span>
                  {' · '}
                </>
              )}
              {project.client_name}
            </Typography.Text>
          </div>
          <Tag color={PROJECT_TAG_COLOR[project.status]} style={{ marginInlineEnd: 0 }}>
            {t(`projectStatus.${project.status}`)}
          </Tag>
        </div>

        <Space size={16} wrap style={{ marginTop: 10, fontSize: 13, color: token.colorTextSecondary }}>
          <span>{t('projects.jobsCount', { count: jobCount })}</span>
          <Badge status={dotStatus} text={<span style={{ color: token.colorTextSecondary, fontSize: 13 }}>{t('projects.materials')}</span>} />
          <span>{formatMinutes(project.total_labor_minutes, { h: t('units.h'), m: t('units.m') })}</span>
        </Space>

        {breakdown.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {breakdown.map(([dept, count]) => (
              <Tag key={dept} variant="filled" style={{ marginInlineEnd: 0 }}>
                {t('projects.inStage', { count, dept })}
              </Tag>
            ))}
          </div>
        )}
      </Card>
    </Link>
  )
}

export default function Projects() {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const [reloadKey, setReloadKey] = useState(0)
  const { data, loading, error } = useAsync(getProjectsOverview, [reloadKey])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('date')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  async function resync() {
    setSyncing(true)
    setSyncMsg(null)
    const res = await requestErResync()
    setSyncing(false)
    setSyncMsg(
      res.error
        ? t('projects.resyncFailed')
        : t('projects.resyncDone', { created: res.created, updated: res.updated }),
    )
    if (!res.error && (res.created > 0 || res.updated > 0)) setReloadKey((k) => k + 1)
  }

  const projects = useMemo(() => {
    let list = data ?? []
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => {
        const inProject =
          p.name.toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q) ||
          (p.work_order_number ?? '').toLowerCase().includes(q)
        const inJobs = p.jobs.some(
          (j) =>
            j.job_code.toLowerCase().includes(q) || j.name.toLowerCase().includes(q),
        )
        return inProject || inJobs
      })
    }
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter)

    const sorted = [...list]
    sorted.sort((a, b) => {
      switch (sort) {
        case 'priority':
          return (a.priority_rank ?? 9999) - (b.priority_rank ?? 9999)
        case 'status':
          return a.status.localeCompare(b.status)
        case 'updated':
          return b.updated_at.localeCompare(a.updated_at)
        default:
          return b.created_at.localeCompare(a.created_at)
      }
    })
    return sorted
  }, [data, search, statusFilter, sort])

  // Native <select> (Ant Select has frozen in the owner's browser), styled like an Ant input.
  const selectStyle = {
    flex: 1,
    height: 40,
    padding: '0 10px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
  }

  return (
    <div style={{ maxWidth: 768, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('nav.projects')}
        </Typography.Title>
        {profile?.role === 'admin' && (
          <Space size={8}>
            {syncMsg && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{syncMsg}</Typography.Text>}
            <Button icon={<SyncOutlined />} loading={syncing} onClick={() => void resync()}>
              {syncing ? t('materials.syncing') : t('projects.resyncEr')}
            </Button>
          </Space>
        )}
      </div>

      <Input.Search
        size="large"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('projects.searchPlaceholder')}
        aria-label={t('projects.searchPlaceholder')}
      />

      <div style={{ display: 'flex', gap: 8, margin: '10px 0 20px' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
          style={selectStyle}
        >
          <option value="all">{t('projects.allStatuses')}</option>
          {ALL_PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`projectStatus.${s}`)}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={selectStyle}>
          <option value="date">{t('projects.sortDate')}</option>
          <option value="priority">{t('projects.sortPriority')}</option>
          <option value="status">{t('projects.sortStatus')}</option>
          <option value="updated">{t('projects.sortUpdated')}</option>
        </select>
      </div>

      {loading && <FullScreenLoader />}
      {error && <Alert type="error" showIcon title={t('common.error')} />}
      {!loading && !error && projects.length === 0 && (
        <Empty description={data?.length ? t('projects.noResults') : t('projects.noProjects')} style={{ marginTop: 32 }} />
      )}

      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </Space>
    </div>
  )
}
