import { useMemo, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Empty, Segmented, Tag, Typography, theme } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getDirectory, getLaborReport, type LaborReportRow } from '../lib/data'
import { laborCsv, type LaborCsvRow } from '../lib/csv'
import { formatMinutes } from '../lib/format'
import { localized } from '../lib/i18nText'
import { FullScreenLoader } from '../components/FullScreenLoader'

type Preset = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom'
type GroupBy = 'user' | 'department' | 'project' | 'job'

const day = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const monday = (d: Date) => {
    const x = new Date(d)
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
    return x
  }
  switch (preset) {
    case 'thisWeek': {
      const m = monday(now)
      return { from: day(m), to: day(now) }
    }
    case 'lastWeek': {
      const m = monday(now)
      const from = new Date(m)
      from.setDate(from.getDate() - 7)
      const to = new Date(m)
      to.setDate(to.getDate() - 1)
      return { from: day(from), to: day(to) }
    }
    case 'thisMonth':
      return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now) }
    case 'lastMonth':
      return {
        from: day(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: day(new Date(now.getFullYear(), now.getMonth(), 0)),
      }
    default:
      return { from: day(now), to: day(now) }
  }
}

const hhmm = (iso: string | null, locale: string) =>
  iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) : ''

/** Labor reports (S18 / SPEC §15): filter, group, and export hours — never costs. */
export default function Reports() {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const { profile } = useAuth()
  const [preset, setPreset] = useState<Preset>('thisWeek')
  const [custom, setCustom] = useState(presetRange('thisWeek'))
  const range = preset === 'custom' ? custom : presetRange(preset)

  const { data: logs, loading, error } = useAsync(
    () => getLaborReport(range.from, range.to),
    [range.from, range.to],
  )
  const { data: directory } = useAsync(getDirectory, [])

  const [projectF, setProjectF] = useState('all')
  const [jobF, setJobF] = useState('all')
  const [deptF, setDeptF] = useState('all')
  const [userF, setUserF] = useState('all')
  const [statusF, setStatusF] = useState('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('user')

  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string) => map.get(id) ?? '—'
  }, [directory])

  const deptOf = (r: LaborReportRow) => r.task?.stage?.department ?? null

  // Filter options come from the (RLS-scoped) data itself.
  const options = useMemo(() => {
    const uniq = <T,>(pairs: [string, T][]) => [...new Map(pairs).entries()]
    return {
      projects: uniq((logs ?? []).filter((r) => r.project).map((r) => [r.project!.id, r.project!.name])),
      jobs: uniq((logs ?? []).filter((r) => r.job).map((r) => [r.job!.id, r.job!.job_code])),
      depts: uniq((logs ?? []).map((r) => deptOf(r)).filter(Boolean).map((d) => [d!.id, d!.name])),
      users: uniq((logs ?? []).map((r) => [r.user_id, nameOf(r.user_id)] as [string, string])),
      statuses: [...new Set((logs ?? []).map((r) => r.task?.status).filter(Boolean))] as string[],
    }
  }, [logs, nameOf])

  const rows = useMemo(
    () =>
      (logs ?? []).filter(
        (r) =>
          (projectF === 'all' || r.project?.id === projectF) &&
          (jobF === 'all' || r.job?.id === jobF) &&
          (deptF === 'all' || deptOf(r)?.id === deptF) &&
          (userF === 'all' || r.user_id === userF) &&
          (statusF === 'all' || r.task?.status === statusF),
      ),
    [logs, projectF, jobF, deptF, userF, statusF],
  )

  const totalMin = rows.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)

  // Grouped summary; est-vs-actual (full task totals) shown for job/project groups.
  const groups = useMemo(() => {
    const acc = new Map<string, { label: string; minutes: number; taskIds: Set<string>; estH: number; actualMin: number }>()
    for (const r of rows) {
      const key =
        groupBy === 'user' ? r.user_id
        : groupBy === 'department' ? deptOf(r)?.id ?? '—'
        : groupBy === 'project' ? r.project?.id ?? '—'
        : r.job?.id ?? '—'
      const label =
        groupBy === 'user' ? nameOf(r.user_id)
        : groupBy === 'department' ? deptOf(r)?.name ?? '—'
        : groupBy === 'project' ? r.project?.name ?? '—'
        : `${r.job?.job_code ?? '—'} · ${localized(r.job?.name ?? '', r.job?.name_i18n, i18n.language)}`
      const g = acc.get(key) ?? { label, minutes: 0, taskIds: new Set(), estH: 0, actualMin: 0 }
      g.minutes += r.duration_minutes ?? 0
      if (r.task && !g.taskIds.has(r.task.id)) {
        g.taskIds.add(r.task.id)
        g.estH += r.task.estimated_hours ?? 0
        g.actualMin += r.task.actual_minutes
      }
      acc.set(key, g)
    }
    return [...acc.values()].sort((a, b) => b.minutes - a.minutes)
  }, [rows, groupBy, nameOf, i18n.language])

  if (!profile) return null
  const canExport = profile.role === 'admin' || profile.role === 'lead'
  const units = { h: t('units.h'), m: t('units.m') }

  function download() {
    const csvRows: LaborCsvRow[] = rows.map((r) => ({
      date: day(new Date(r.clocked_in_at)),
      work_order: r.project?.work_order_number ?? '',
      job_code: r.job?.job_code ?? '',
      job_name: r.job?.name ?? '',
      department: deptOf(r)?.name ?? '',
      task: r.task?.name ?? '',
      user: nameOf(r.user_id),
      clock_in: hhmm(r.clocked_in_at, 'en-GB'),
      clock_out: hhmm(r.clocked_out_at, 'en-GB'),
      duration_minutes: r.duration_minutes ?? 0,
      flagged: r.admin_override,
    }))
    const blob = new Blob([laborCsv(csvRows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `labor_${range.from}_${range.to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Native <select> / date inputs (Ant Select has frozen in the owner's browser), styled like Ant inputs.
  const selectStyle: CSSProperties = {
    height: 32,
    padding: '0 8px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
    maxWidth: '100%',
  }
  const sectionLabel = (text: string) => (
    <Typography.Text
      style={{ display: 'block', margin: '20px 0 6px', fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
    >
      {text}
    </Typography.Text>
  )
  const rowStyle = (last: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px',
    borderBottom: last ? 'none' : `1px solid ${token.colorBorderSecondary}`,
  })

  return (
    <div style={{ maxWidth: 896, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('reports.title')}
        </Typography.Title>
        {canExport && (
          <Button type="primary" icon={<DownloadOutlined />} disabled={rows.length === 0} onClick={download}>
            {t('reports.export')}
          </Button>
        )}
      </div>

      <Card size="small" styles={{ body: { padding: 12 } }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} style={selectStyle}>
            {(['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'custom'] as const).map((p) => (
              <option key={p} value={p}>{t(`reports.${p}`)}</option>
            ))}
          </select>
          {preset === 'custom' && (
            <>
              <input type="date" value={custom.from} max={custom.to}
                onChange={(e) => setCustom({ ...custom, from: e.target.value })} style={selectStyle} />
              <input type="date" value={custom.to} min={custom.from}
                onChange={(e) => setCustom({ ...custom, to: e.target.value })} style={selectStyle} />
            </>
          )}
          <select value={projectF} onChange={(e) => setProjectF(e.target.value)} style={selectStyle}>
            <option value="all">{t('reports.allProjects')}</option>
            {options.projects.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={jobF} onChange={(e) => setJobF(e.target.value)} style={selectStyle}>
            <option value="all">{t('reports.allJobs')}</option>
            {options.jobs.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={deptF} onChange={(e) => setDeptF(e.target.value)} style={selectStyle}>
            <option value="all">{t('reports.allDepartments')}</option>
            {options.depts.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={userF} onChange={(e) => setUserF(e.target.value)} style={selectStyle}>
            <option value="all">{t('reports.allPeople')}</option>
            {options.users.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={selectStyle}>
            <option value="all">{t('reports.allStatuses')}</option>
            {options.statuses.map((s) => <option key={s} value={s}>{t(`taskStatus.${s}`)}</option>)}
          </select>
        </div>
      </Card>

      {loading && <FullScreenLoader />}
      {error && <Alert type="error" showIcon title={t('common.error')} style={{ marginTop: 16 }} />}
      {!loading && !error && rows.length === 0 && <Empty description={t('reports.empty')} style={{ marginTop: 40 }} />}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Scrolls sideways on narrow phones rather than cutting the labels. */}
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <Segmented
              value={groupBy}
              onChange={(v) => setGroupBy(v as GroupBy)}
              options={(['user', 'department', 'project', 'job'] as const).map((g) => ({ value: g, label: t(`reports.by_${g}`) }))}
            />
          </div>

          <Card style={{ marginTop: 12 }} styles={{ body: { padding: 0 } }}>
            <div style={{ ...rowStyle(false), background: token.colorFillQuaternary }}>
              <Typography.Text strong>{t('reports.total')}</Typography.Text>
              <Typography.Text strong style={{ fontSize: 18 }}>
                {formatMinutes(totalMin, units)}
              </Typography.Text>
            </div>
            {groups.map((g, i) => {
              const over = g.estH > 0 && g.actualMin > g.estH * 60
              const showEst = (groupBy === 'job' || groupBy === 'project') && g.estH > 0
              return (
                <div key={g.label} style={rowStyle(i === groups.length - 1)}>
                  <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
                    {g.label}
                  </Typography.Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {showEst && (
                      <Tag color={over ? 'gold' : 'default'} variant="filled" style={{ marginInlineEnd: 0 }}>
                        {t('reports.estVsActual', {
                          est: `${g.estH}${units.h}`,
                          actual: formatMinutes(g.actualMin, units),
                        })}
                      </Tag>
                    )}
                    <Typography.Text strong>{formatMinutes(g.minutes, units)}</Typography.Text>
                  </div>
                </div>
              )
            })}
          </Card>

          {sectionLabel(t('reports.entries'))}
          <Card styles={{ body: { padding: 0 } }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{ ...rowStyle(i === rows.length - 1), alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text ellipsis style={{ display: 'block' }}>
                    <Typography.Text strong>{nameOf(r.user_id)}</Typography.Text>
                    {' · '}
                    {localized(r.task?.name ?? '—', r.task?.name_i18n, i18n.language)}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ display: 'block', fontSize: 13 }}>
                    {day(new Date(r.clocked_in_at))} · {hhmm(r.clocked_in_at, i18n.language)}–{hhmm(r.clocked_out_at, i18n.language)}
                    {r.job && (
                      <>
                        {' · '}
                        <span style={{ fontFamily: token.fontFamilyCode, color: token.colorPrimary }}>{r.job.job_code}</span>
                      </>
                    )}
                    {deptOf(r) && <> · {deptOf(r)!.name}</>}
                  </Typography.Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {r.admin_override && (
                    <Tag color="gold" variant="filled" style={{ marginInlineEnd: 0 }}>
                      {t('reports.flagged')}
                    </Tag>
                  )}
                  <Typography.Text>{formatMinutes(r.duration_minutes ?? 0, units)}</Typography.Text>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
