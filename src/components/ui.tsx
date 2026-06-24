import { useTranslation } from 'react-i18next'
import type { ProjectStatus, TaskStatus } from '../lib/types'
import { PROJECT_STATUS_STYLE, TASK_STATUS_STYLE } from '../lib/status'

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${PROJECT_STATUS_STYLE[status]}`}>
      {t(`projectStatus.${status}`)}
    </span>
  )
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation()
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_STYLE[status]}`}>
      {t(`taskStatus.${status}`)}
    </span>
  )
}

export function EmptyState({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-slate-500">{text}</div>
}

export function ErrorState({ text }: { text: string }) {
  return (
    <div className="m-4 rounded-lg bg-red-500/10 p-4 text-center text-sm text-red-400">
      {text}
    </div>
  )
}

export type TabDef = { key: string; label: string }

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
            active === tab.key
              ? 'border-amber-500 text-amber-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
