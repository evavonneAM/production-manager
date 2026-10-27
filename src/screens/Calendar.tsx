import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Grid, Modal, Segmented, Space, Typography, theme } from 'antd'
import { LeftOutlined, RightOutlined, SyncOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import {
  getCalendarProjects,
  getCalendarEvents,
  getErAppointments,
  updateProjectSchedule,
  syncGcalNow,
  syncErCalendarsNow,
  type CalendarProject,
  type CalendarEvent,
  type ErAppointment,
  type ErBusiness,
} from '../lib/data'
import type { ProjectStatus } from '../lib/types'
import { localized } from '../lib/i18nText'
import { FullScreenLoader } from '../components/FullScreenLoader'

const DAY = 86400e3
const toUTC = (isoDate: string) => new Date(isoDate + 'T00:00:00Z').getTime()

const BUSINESSES: ErBusiness[] = ['AM', 'HOV', 'RHU']
// One colour per Estimate Rocket account; production bars use the status colours below.
const BUSINESS_COLOR: Record<ErBusiness, string> = { AM: '#1d39c4', HOV: '#c41d7f', RHU: '#d46b08' }
const STATUS_BAR: Record<ProjectStatus, { bg: string; fg: string }> = {
  estimate: { bg: '#f0f0f0', fg: '#595959' },
  scheduled: { bg: '#efdbff', fg: '#391085' },
  in_progress: { bg: '#bae0ff', fg: '#003eb3' },
  on_hold: { bg: '#ffe7ba', fg: '#873800' },
  complete: { bg: '#d9f7be', fg: '#135200' },
  delivered: { bg: '#b5f5ec', fg: '#00474f' },
}

type Show = 'all' | 'production' | 'er' | ErBusiness

type Bar = {
  key: string
  label: string
  status: ProjectStatus
  start: string
  end: string
  overdue: boolean
  project: CalendarProject
}

/** Something shown inside a day: an ER appointment or a code-tagged Google event. */
type DayItem =
  | { kind: 'er'; id: string; at: number; ev: ErAppointment }
  | { kind: 'gcal'; id: string; at: number; ev: CalendarEvent }

export default function Calendar() {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  // Phones: day cells are too narrow for titles, so they show coloured marks and a tap opens the day.
  const compact = !Grid.useBreakpoint().sm

  const [anchor, setAnchor] = useState(() => {
    const now = new Date()
    return Date.UTC(now.getFullYear(), now.getMonth(), 1)
  })
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [jobLevel, setJobLevel] = useState(false)
  const [show, setShow] = useState<Show>('all')
  const [reloadKey, setReloadKey] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState<CalendarProject | null>(null)
  const [openAppt, setOpenAppt] = useState<ErAppointment | null>(null)
  const [openDay, setOpenDay] = useState<number | null>(null)

  // Visible range: month grid padded to full weeks (weeks start Monday).
  const range = useMemo(() => {
    const a = new Date(anchor)
    if (mode === 'week') {
      const dow = (a.getUTCDay() + 6) % 7
      const start = anchor - dow * DAY
      return { start, end: start + 7 * DAY, weeks: 1 }
    }
    const first = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1)
    const startPad = (new Date(first).getUTCDay() + 6) % 7
    const start = first - startPad * DAY
    const last = Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0)
    const endPad = 6 - (new Date(last).getUTCDay() + 6) % 7
    const end = last + (endPad + 1) * DAY
    return { start, end, weeks: Math.round((end - start) / (7 * DAY)) }
  }, [anchor, mode])

  // Appointment times are local; pad the window a day each side so none fall off the edges.
  const fromIso = new Date(range.start - DAY).toISOString()
  const toIso = new Date(range.end + DAY).toISOString()
  const { data: projects, loading, error } = useAsync(getCalendarProjects, [reloadKey])
  const { data: events } = useAsync(() => getCalendarEvents(fromIso, toIso), [fromIso, toIso, reloadKey])
  const { data: appts } = useAsync(() => getErAppointments(fromIso, toIso), [fromIso, toIso, reloadKey])

  const todayUTC = useMemo(() => {
    const n = new Date()
    return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
  }, [])

  const showProduction = show === 'all' || show === 'production'
  const showEr = (b: ErBusiness) => show === 'all' || show === 'er' || show === b

  const bars: Bar[] = useMemo(() => {
    if (!showProduction) return []
    const out: Bar[] = []
    for (const p of projects ?? []) {
      if (!p.scheduled_start) continue
      const end = p.scheduled_end ?? p.scheduled_start
      const overdue = toUTC(end) < todayUTC && p.status !== 'complete' && p.status !== 'delivered'
      if (jobLevel) {
        for (const j of p.jobs) {
          out.push({
            key: j.id,
            label: `${j.job_code} · ${localized(j.name, j.name_i18n, i18n.language)}`,
            status: p.status,
            start: p.scheduled_start,
            end,
            overdue,
            project: p,
          })
        }
      } else {
        out.push({
          key: p.id,
          label: [p.work_order_number, p.client_name].filter(Boolean).join(' · '),
          status: p.status,
          start: p.scheduled_start,
          end,
          overdue,
          project: p,
        })
      }
    }
    return out
  }, [projects, jobLevel, i18n.language, todayUTC, showProduction])

  // Each item filed under its local calendar day (as a UTC-midnight key, like the grid).
  const itemsByDay = useMemo(() => {
    const map = new Map<number, DayItem[]>()
    const add = (allDay: boolean, startsAt: string, item: Omit<DayItem, 'at'> & { at?: number }) => {
      const d = new Date(startsAt)
      const key = allDay
        ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
      const list = map.get(key) ?? []
      list.push({ ...item, at: allDay ? 0 : d.getTime() } as DayItem)
      map.set(key, list)
    }
    for (const ev of appts ?? []) if (showEr(ev.business)) add(ev.all_day, ev.starts_at, { kind: 'er', id: ev.id, ev })
    if (showProduction) for (const ev of events ?? []) add(ev.all_day, ev.starts_at, { kind: 'gcal', id: ev.id, ev })
    for (const list of map.values()) list.sort((a, b) => a.at - b.at)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appts, events, show])

  if (loading) return <FullScreenLoader />

  const monthLabel = new Date(anchor).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const rangeLabel =
    mode === 'week'
      ? `${new Date(range.start).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${new Date(range.end - DAY).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
      : monthLabel
  const move = (dir: -1 | 1) =>
    setAnchor((a) => (mode === 'week' ? a + dir * 7 * DAY : Date.UTC(new Date(a).getUTCFullYear(), new Date(a).getUTCMonth() + dir, 1)))
  const goToday = () => {
    const n = new Date()
    setAnchor(mode === 'week' ? Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) : Date.UTC(n.getFullYear(), n.getMonth(), 1))
  }
  const weeks = Array.from({ length: range.weeks }, (_, w) => range.start + w * 7 * DAY)

  async function onSync() {
    setSyncing(true)
    await Promise.all([syncGcalNow(), syncErCalendarsNow()])
    setSyncing(false)
    setReloadKey((k) => k + 1)
  }

  // Native <select> (Ant Select has frozen in the owner's browser), styled like an Ant input.
  const selectStyle: CSSProperties = {
    height: 32,
    padding: '0 8px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
  }

  const unscheduled = (projects ?? []).filter((p) => !p.scheduled_start && p.status !== 'complete' && p.status !== 'delivered')

  return (
    <div style={{ maxWidth: 1152, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('nav.calendar')}
        </Typography.Title>
        <Space size={12}>
          <Button icon={<SyncOutlined spin={syncing} />} disabled={syncing} onClick={() => void onSync()} aria-label={t('calendar.syncNow')}>
            {!compact && (syncing ? t('materials.syncing') : t('calendar.syncNow'))}
          </Button>
          <Link to="/priority">{t('priority.title')} →</Link>
        </Space>
      </div>

      {error && <Alert type="error" showIcon title={t('common.error')} style={{ marginBottom: 16 }} />}

      <Card styles={{ body: { padding: 12 } }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Button icon={<LeftOutlined />} onClick={() => move(-1)} aria-label="previous" />
          <Typography.Text strong style={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize', fontSize: 16 }}>
            {rangeLabel}
          </Typography.Text>
          <Button icon={<RightOutlined />} onClick={() => move(1)} aria-label="next" />
          <Button onClick={goToday}>{t('calendar.today')}</Button>
          <span style={{ flex: 1 }} />
          <select value={show} onChange={(e) => setShow(e.target.value as Show)} style={selectStyle} aria-label={t('calendar.show')}>
            <option value="all">{t('calendar.showAll')}</option>
            <option value="production">{t('calendar.showProduction')}</option>
            <option value="er">{t('calendar.showEr')}</option>
            {BUSINESSES.map((b) => (
              <option key={b} value={b}>
                {t('calendar.showBusiness', { business: b })}
              </option>
            ))}
          </select>
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as 'month' | 'week')}
            options={[
              { value: 'month', label: t('calendar.monthView') },
              { value: 'week', label: t('calendar.weekView') },
            ]}
          />
          {showProduction && (
            <Button type={jobLevel ? 'primary' : 'default'} ghost={jobLevel} onClick={() => setJobLevel((v) => !v)}>
              {t('calendar.jobLevel')}
            </Button>
          )}
        </div>

        {/* Colour key */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 12, color: token.colorTextSecondary }}>
          {BUSINESSES.filter(showEr).map((b) => (
            <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: BUSINESS_COLOR[b] }} />
              {t('calendar.erKey', { business: b })}
            </span>
          ))}
          {showProduction && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 9, borderRadius: 2, background: STATUS_BAR.in_progress.bg }} />
              {t('calendar.productionKey')}
            </span>
          )}
        </div>

        {/* Weekday header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            paddingBottom: 4,
            textAlign: 'center',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            color: token.colorTextTertiary,
          }}
        >
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>{new Date(range.start + i * DAY).toLocaleDateString(i18n.language, { weekday: 'short', timeZone: 'UTC' })}</span>
          ))}
        </div>

        {weeks.map((weekStart) => (
          <WeekRow
            key={weekStart}
            weekStart={weekStart}
            bars={bars}
            itemsByDay={itemsByDay}
            todayUTC={todayUTC}
            perDay={mode === 'week' ? 8 : 3}
            compact={compact}
            inMonth={(d) => mode === 'week' || new Date(d).getUTCMonth() === new Date(anchor).getUTCMonth()}
            onBarClick={(p) => (isAdmin ? setEditing(p) : navigate(`/projects/${p.id}`))}
            onApptClick={setOpenAppt}
            onMore={setOpenDay}
          />
        ))}

        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
          {isAdmin ? t('calendar.adminHint') : t('calendar.viewHint')} {t('calendar.erHint')}
        </Typography.Text>
      </Card>

      {/* Unscheduled projects — the admin's entry point to give them dates. */}
      {isAdmin && showProduction && unscheduled.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <Typography.Text
            style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: token.colorTextTertiary }}
          >
            {t('calendar.unscheduled')}
          </Typography.Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {unscheduled.map((p) => (
              <Button key={p.id} style={{ borderStyle: 'dashed' }} onClick={() => setEditing(p)}>
                {[p.work_order_number, p.client_name].filter(Boolean).join(' · ')}
              </Button>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <ScheduleDialog
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setReloadKey((k) => k + 1)
          }}
        />
      )}

      <Modal open={!!openAppt} onCancel={() => setOpenAppt(null)} footer={null} title={openAppt?.title}>
        {openAppt && <ApptDetails appt={openAppt} />}
      </Modal>

      <Modal
        open={openDay !== null}
        onCancel={() => setOpenDay(null)}
        footer={null}
        title={openDay !== null && new Date(openDay).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
      >
        <Space orientation="vertical" size={6} style={{ width: '100%' }}>
          {(openDay !== null ? itemsByDay.get(openDay) ?? [] : []).map((it) => (
            <ItemChip
              key={it.id}
              item={it}
              large
              onClick={() => {
                if (it.kind === 'er') {
                  setOpenDay(null)
                  setOpenAppt(it.ev)
                }
              }}
            />
          ))}
        </Space>
      </Modal>
    </div>
  )
}

/** Short title for a day cell: ER titles repeat the business code and status
 *  ("AM Jane Doe Work Order - Pending Completion" -> "Jane Doe"). */
function shortTitle(item: DayItem) {
  if (item.kind !== 'er') return item.ev.title
  const short = item.ev.title
    .replace(/^(AM|HO|HOV|RU|RHU)\s+/, '')
    .replace(/\s+-\s+Pending Completion$/i, '')
    .replace(/\s+Work Order$/i, '')
    .trim()
  return short || item.ev.title
}

/** An ER deadline still in the feed (so still pending) whose date has passed. */
function pastDue(item: DayItem) {
  if (item.kind !== 'er') return false
  const n = new Date()
  return new Date(item.ev.starts_at).getTime() < Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())
}

function timeLabel(iso: string, lang: string) {
  return new Date(iso).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' })
}

function ItemChip({ item, onClick, large }: { item: DayItem; onClick: () => void; large?: boolean }) {
  const { i18n } = useTranslation()
  const { token } = theme.useToken()
  const color = item.kind === 'er' ? BUSINESS_COLOR[item.ev.business] : token.colorTextSecondary
  const time = item.ev.all_day ? null : timeLabel(item.ev.starts_at, i18n.language)
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.ev.title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        minWidth: 0,
        padding: large ? '6px 8px' : '1px 4px',
        fontSize: large ? 14 : 11,
        lineHeight: large ? '20px' : '16px',
        textAlign: 'left',
        color: token.colorText,
        background: `${color}14`,
        border: 'none',
        borderLeft: `3px solid ${color}`,
        borderRadius: 3,
        cursor: item.kind === 'er' ? 'pointer' : 'default',
      }}
    >
      {pastDue(item) && <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: token.colorError }} />}
      {item.kind === 'er' && large && <span style={{ fontWeight: 600, color }}>{item.ev.business}</span>}
      {time && <span style={{ color: token.colorTextSecondary, flexShrink: 0 }}>{time}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortTitle(item)}</span>
    </button>
  )
}

function ApptDetails({ appt }: { appt: ErAppointment }) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const day = new Date(appt.starts_at).toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(appt.all_day ? { timeZone: 'UTC' } : {}),
  })
  const when = appt.all_day
    ? day
    : `${day}, ${timeLabel(appt.starts_at, i18n.language)}${appt.ends_at ? ` – ${timeLabel(appt.ends_at, i18n.language)}` : ''}`
  return (
    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: BUSINESS_COLOR[appt.business], fontWeight: 600 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: BUSINESS_COLOR[appt.business] }} />
        {t('calendar.erKey', { business: appt.business })}
      </span>
      <Typography.Text strong>{when}</Typography.Text>
      {appt.location && (
        <a href={`https://maps.google.com/?q=${encodeURIComponent(appt.location)}`} target="_blank" rel="noreferrer">
          <EnvironmentOutlined /> {appt.location}
        </a>
      )}
      {appt.description && (
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0, color: token.colorTextSecondary }}>
          {appt.description}
        </Typography.Paragraph>
      )}
      {appt.project_id && <Link to={`/projects/${appt.project_id}`}>{t('calendar.openProject')} →</Link>}
      {appt.er_url && (
        <a href={appt.er_url} target="_blank" rel="noreferrer">
          {t('calendar.openInEr')} →
        </a>
      )}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('calendar.erReadOnly')}
      </Typography.Text>
    </Space>
  )
}

function WeekRow({
  weekStart,
  bars,
  itemsByDay,
  todayUTC,
  perDay,
  compact,
  inMonth,
  onBarClick,
  onApptClick,
  onMore,
}: {
  weekStart: number
  bars: Bar[]
  itemsByDay: Map<number, DayItem[]>
  todayUTC: number
  perDay: number
  compact: boolean
  inMonth: (dayUTC: number) => boolean
  onBarClick: (p: CalendarProject) => void
  onApptClick: (a: ErAppointment) => void
  onMore: (dayUTC: number) => void
}) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const weekEnd = weekStart + 7 * DAY

  // Bars overlapping this week, packed into lanes.
  const segs = bars
    .map((b) => ({ b, s: toUTC(b.start), e: toUTC(b.end) + DAY }))
    .filter(({ s, e }) => s < weekEnd && e > weekStart)
    .sort((x, y) => x.s - y.s)
  const lanes: { b: Bar; colStart: number; colEnd: number }[][] = []
  for (const { b, s, e } of segs) {
    const colStart = Math.max(0, Math.round((Math.max(s, weekStart) - weekStart) / DAY))
    const colEnd = Math.min(7, Math.round((Math.min(e, weekEnd) - weekStart) / DAY))
    let lane = lanes.find((l) => l.every((x) => colEnd <= x.colStart || colStart >= x.colEnd))
    if (!lane) {
      if (lanes.length >= 3) continue // "+ more" omitted for simplicity
      lane = []
      lanes.push(lane)
    }
    lane.push({ b, colStart, colEnd })
  }

  const cell = (i: number, day: number): CSSProperties => ({
    minWidth: 0,
    padding: '3px 3px 0',
    borderLeft: i === 0 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
    opacity: inMonth(day) ? 1 : 0.45,
  })
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i * DAY)

  return (
    <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      {/* Day numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {days.map((day, i) => {
          const isToday = day === todayUTC
          return (
            <div key={i} style={cell(i, day)}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  fontSize: 12,
                  fontWeight: isToday ? 600 : 400,
                  color: isToday ? '#fff' : token.colorTextSecondary,
                  background: isToday ? token.colorPrimary : 'transparent',
                }}
              >
                {new Date(day).getUTCDate()}
              </span>
            </div>
          )
        })}
      </div>
      {/* Production bars across the week */}
      {lanes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 1px' }}>
          {lanes.map((lane, li) => (
            <div key={li} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
              {lane
                .sort((a, b) => a.colStart - b.colStart)
                .map(({ b, colStart, colEnd }) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => onBarClick(b.project)}
                    title={b.label}
                    style={{
                      gridColumn: `${colStart + 1} / ${colEnd + 1}`,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: '1px 6px',
                      fontSize: 11,
                      lineHeight: '16px',
                      textAlign: 'left',
                      color: STATUS_BAR[b.status].fg,
                      background: STATUS_BAR[b.status].bg,
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    {b.overdue && (
                      <span style={{ display: 'inline-block', width: 6, height: 6, marginRight: 4, borderRadius: '50%', background: token.colorError, verticalAlign: 'middle' }} />
                    )}
                    {b.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
      {/* Appointments under each day */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', minHeight: compact ? 30 : 62 }}>
        {days.map((day, i) => {
          const items = itemsByDay.get(day) ?? []
          if (compact) {
            return (
              <button
                key={i}
                type="button"
                disabled={items.length === 0}
                onClick={() => onMore(day)}
                aria-label={t('calendar.more', { count: items.length })}
                style={{ ...cell(i, day), display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 3, padding: 4, background: 'none', border: 'none', borderLeft: cell(i, day).borderLeft, cursor: items.length ? 'pointer' : 'default' }}
              >
                {items.slice(0, 6).map((it) => (
                  <span
                    key={it.id}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: it.kind === 'er' ? BUSINESS_COLOR[it.ev.business] : token.colorTextQuaternary,
                      boxShadow: pastDue(it) ? `0 0 0 2px ${token.colorError}` : undefined,
                    }}
                  />
                ))}
                {items.length > 6 && <span style={{ fontSize: 10, lineHeight: '8px', color: token.colorTextSecondary }}>+</span>}
              </button>
            )
          }
          return (
            <div key={i} style={{ ...cell(i, day), display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 4 }}>
              {items.slice(0, perDay).map((it) => (
                <ItemChip key={it.id} item={it} onClick={() => (it.kind === 'er' ? onApptClick(it.ev) : onMore(day))} />
              ))}
              {items.length > perDay && (
                <button
                  type="button"
                  onClick={() => onMore(day)}
                  style={{ padding: '0 4px', fontSize: 11, textAlign: 'left', color: token.colorPrimary, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {t('calendar.more', { count: items.length - perDay })}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleDialog({
  project,
  onClose,
  onSaved,
}: {
  project: CalendarProject
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [start, setStart] = useState(project.scheduled_start ?? '')
  const [end, setEnd] = useState(project.scheduled_end ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSave() {
    setBusy(true)
    setError(null)
    const { error } = await updateProjectSchedule(project.id, start || null, end || start || null)
    setBusy(false)
    if (error) setError(t('common.error'))
    else onSaved()
  }

  // Native date inputs, styled like Ant inputs.
  const field: CSSProperties = {
    display: 'block',
    width: '100%',
    height: 40,
    marginTop: 4,
    padding: '0 10px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
  }

  return (
    <Modal
      open
      onCancel={onClose}
      title={t('calendar.scheduleTitle')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      confirmLoading={busy}
      onOk={() => void onSave()}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {[project.work_order_number, project.client_name, project.name].filter(Boolean).join(' · ')}
        </Typography.Text>
        <label>
          {t('projectDetail.scheduledStart')}
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={field} />
        </label>
        <label>
          {t('projectDetail.scheduledEnd')}
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} style={field} />
        </label>
        {error && <Alert type="error" showIcon title={error} />}
      </Space>
    </Modal>
  )
}
