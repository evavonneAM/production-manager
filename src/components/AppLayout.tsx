import { useMemo, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getDepartments } from '../lib/data'

type Tab = { to: string; key: string; icon: ReactNode }

// Simple inline stroke icons (no icon-library dependency).
const I = {
  myWork: (
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
  ),
  projects: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  calendar: (
    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
  ),
  inspection: <path d="m9 12 2 2 4-4M12 3l8 4v5c0 4.5-3 7.5-8 9-5-1.5-8-4.5-8-9V7l8-4Z" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />,
}

const TABS: Tab[] = [
  { to: '/my-work', key: 'nav.myWork', icon: I.myWork },
  { to: '/projects', key: 'nav.projects', icon: I.projects },
  { to: '/calendar', key: 'nav.calendar', icon: I.calendar },
  { to: '/inspection', key: 'nav.inspection', icon: I.inspection },
  { to: '/profile', key: 'nav.profile', icon: I.profile },
]

function TabIcon({ icon }: { icon: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {icon}
    </svg>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: departments } = useAsync(getDepartments, [])
  // Ordering dashboard is for the people who order things (desktop sidebar only).
  const showOrdering = useMemo(() => {
    if (profile?.role === 'admin') return true
    const proc = departments?.find((d) => d.name === 'Procurement')
    return !!proc && profile?.department_id === proc.id
  }, [profile, departments])

  return (
    <div className="min-h-full bg-slate-900 text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-slate-800 bg-slate-950 px-3 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-700 text-sm font-bold">
            PM
          </div>
          <span className="font-semibold">{t('common.appName')}</span>
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-amber-600/15 text-amber-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <TabIcon icon={tab.icon} />
              {t(tab.key)}
            </NavLink>
          ))}
          {showOrdering && (
            <NavLink
              to="/ordering"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-amber-600/15 text-amber-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`
              }
            >
              <TabIcon icon={<path d="M6 6h15l-1.5 9h-12L5 3H2m5 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm10 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />} />
              {t('ordering.title')}
            </NavLink>
          )}
        </nav>
        <button
          type="button"
          onClick={() => navigate('/scan')}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
        >
          {t('nav.scan')}
        </button>
      </aside>

      {/* Content */}
      <div className="flex min-h-full flex-col pb-24 md:ml-60 md:pb-0">{children}</div>

      {/* Mobile floating QR button */}
      <button
        type="button"
        onClick={() => navigate('/scan')}
        aria-label={t('nav.scan')}
        className="fixed bottom-12 left-1/2 z-20 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg ring-4 ring-slate-900 md:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
        </svg>
      </button>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.map((tab, i) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-amber-400' : 'text-slate-500'
              } ${i === 2 ? 'mr-8' : ''} ${i === 3 ? 'ml-8' : ''}`
            }
          >
            <TabIcon icon={tab.icon} />
            {t(tab.key)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
