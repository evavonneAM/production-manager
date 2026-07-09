import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { updateTask } from '../lib/data'
import type { TaskFull, DirectoryUser } from '../lib/types'

export function EditTaskModal({
  task,
  directory,
  onClose,
  onSaved,
}: {
  task: TaskFull
  directory: DirectoryUser[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(task.name)
  const [assignee, setAssignee] = useState(task.assigned_user_id ?? '')
  const [estHours, setEstHours] = useState(task.estimated_hours != null ? String(task.estimated_hours) : '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [instructions, setInstructions] = useState(task.instructions ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stageDept = task.stage?.department?.id
  const members = directory.filter((u) => u.is_active && u.department_id === stageDept)
  // SPEC §9: reassignment is blocked while someone is clocked into the task.
  const assigneeLocked = task.status === 'in_progress'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const patch: Parameters<typeof updateTask>[1] = {
      estimated_hours: estHours ? Number(estHours) : null,
      due_date: dueDate || null,
      instructions: instructions.trim() || null,
    }
    if (name.trim() !== task.name) patch.name = name.trim()
    if (!assigneeLocked) patch.assigned_user_id = assignee || null
    const { error } = await updateTask(task.id, patch)
    setBusy(false)
    if (error) setError(t('common.error'))
    else onSaved()
  }

  const field = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"
      >
        <h2 className="text-lg font-semibold">{t('taskEdit.title')}</h2>

        <label className="text-sm text-slate-300">
          {t('createTask.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required className={`mt-1 ${field}`} />
        </label>

        <label className="text-sm text-slate-300">
          {t('createTask.assignee')}
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={assigneeLocked}
            className={`mt-1 ${field} disabled:opacity-50`}
          >
            <option value="">{t('jobDetail.unassigned')}</option>
            {members.map((u) => (
              <option key={u.id ?? ''} value={u.id ?? ''}>
                {u.full_name}
              </option>
            ))}
          </select>
          {assigneeLocked && (
            <span className="mt-1 block text-xs text-slate-500">{t('taskEdit.assigneeLocked')}</span>
          )}
        </label>

        <div className="flex gap-3">
          <label className="flex-1 text-sm text-slate-300">
            {t('createTask.estHours')}
            <input type="number" min="0" step="0.5" value={estHours} onChange={(e) => setEstHours(e.target.value)} className={`mt-1 ${field}`} />
          </label>
          <label className="flex-1 text-sm text-slate-300">
            {t('createTask.dueDate')}
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`mt-1 ${field}`} />
          </label>
        </div>

        <label className="text-sm text-slate-300">
          {t('createTask.instructions')}
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className={`mt-1 ${field}`} />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy || !name.trim()} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60">
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
