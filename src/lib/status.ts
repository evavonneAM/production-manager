import type { ProjectStatus, StageStatus, TaskStatus } from './types'

// Tailwind classes per project status (SPEC §7 S02 colour table).
export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  estimate: 'bg-slate-500/15 text-slate-300',
  scheduled: 'bg-blue-500/15 text-blue-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  on_hold: 'bg-orange-500/15 text-orange-300',
  complete: 'bg-green-500/15 text-green-300',
  delivered: 'bg-teal-500/15 text-teal-300',
}

export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  pending_approval: 'bg-orange-500/15 text-orange-300',
  unstarted: 'bg-slate-500/15 text-slate-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  paused: 'bg-blue-500/15 text-blue-300',
  completed: 'bg-green-500/15 text-green-300',
  cancelled: 'bg-slate-700/40 text-slate-400',
}

export const ALL_PROJECT_STATUSES: ProjectStatus[] = [
  'estimate',
  'scheduled',
  'in_progress',
  'on_hold',
  'complete',
  'delivered',
]

// A stage's place in the pipeline, used to pick its icon/colour.
export type StagePhase = 'done' | 'current' | 'rejected' | 'upcoming'

export function stagePhase(status: StageStatus): StagePhase {
  if (status === 'approved') return 'done'
  if (status === 'rejected') return 'rejected'
  if (status === 'in_progress' || status === 'pending_inspection' || status === 'queued') {
    return 'current'
  }
  return 'upcoming'
}
