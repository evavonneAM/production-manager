import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { createTask } from '../lib/data'
import type { StageWithDept, DirectoryUser } from '../lib/types'

export function CreateTaskModal({
  jobId,
  stages,
  directory,
  defaultStageId,
  onClose,
  onCreated,
}: {
  jobId: string
  stages: StageWithDept[]
  directory: DirectoryUser[]
  defaultStageId?: string
  onClose: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const ordered = useMemo(() => [...stages].sort((a, b) => a.sequence - b.sequence), [stages])
  const [name, setName] = useState('')
  const [stageId, setStageId] = useState(defaultStageId ?? ordered[0]?.id ?? '')
  const [assignee, setAssignee] = useState('')
  const [estHours, setEstHours] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stageDept = ordered.find((s) => s.id === stageId)?.department?.id
  const members = directory.filter((u) => u.is_active && u.department_id === stageDept)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !profile) return
    setBusy(true)
    setError(null)
    const { error } = await createTask({
      jobId,
      jobStageId: stageId,
      name: name.trim(),
      assignedUserId: assignee || null,
      estimatedHours: estHours ? Number(estHours) : null,
      dueDate: dueDate || null,
      instructions: instructions.trim() || null,
      createdBy: profile.id,
    })
    setBusy(false)
    if (error) setError(t('common.error'))
    else onCreated()
  }

  const field = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"
      >
        <h2 className="text-lg font-semibold">{t('createTask.title')}</h2>

        <label className="text-sm text-slate-300">
          {t('createTask.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required className={`mt-1 ${field}`} />
        </label>

        <label className="text-sm text-slate-300">
          {t('createTask.stage')}
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={`mt-1 ${field}`}>
            {ordered.map((s) => (
              <option key={s.id} value={s.id}>
                {s.department?.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          {t('createTask.assignee')}
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`mt-1 ${field}`}>
            <option value="">{t('jobDetail.unassigned')}</option>
            {members.map((u) => (
              <option key={u.id ?? ''} value={u.id ?? ''}>
                {u.full_name}
              </option>
            ))}
          </select>
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
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className={`mt-1 ${field}`} />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy || !name.trim()} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60">
            {busy ? t('common.saving') : t('createTask.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
