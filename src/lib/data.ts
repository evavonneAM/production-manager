import { supabase } from './supabase'
import type {
  ProjectOverview,
  ProjectDetail,
  JobDetail,
  DirectoryUser,
  TaskFull,
  TaskWithJob,
  DeptQueueJob,
  MyWork,
  InspectionQueueItem,
  JobInspection,
  Note,
  PendingApproval,
} from './types'

type NoteScope = { projectId: string; jobId?: string | null; taskId?: string | null }
type TranslatableTable = 'notes' | 'jobs' | 'projects' | 'materials' | 'tasks'

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

/** Projects for the home overview, each with its jobs' current stage + dept. */
export async function getProjectsOverview(): Promise<ProjectOverview[]> {
  const { data, error } = await client()
    .from('projects')
    .select(
      `*,
       jobs:jobs (
         id, job_code, name, status, queue_position,
         current_stage:job_stages!jobs_current_stage_id_fkey (
           sequence, status,
           department:departments ( id, name )
         ),
         materials:materials ( id, is_arrived )
       )`,
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ProjectOverview[]
}

/** One project with every job and its full stage routing. */
export async function getProject(id: string): Promise<ProjectDetail> {
  const { data, error } = await client()
    .from('projects')
    .select(
      `*,
       jobs:jobs (
         *,
         stages:job_stages!job_stages_job_id_fkey (
           *,
           department:departments ( id, name )
         )
       )`,
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as ProjectDetail
}

/** One job with stages, tasks, materials, notes, and files. */
export async function getJob(id: string): Promise<JobDetail> {
  const { data, error } = await client()
    .from('jobs')
    .select(
      `*,
       project:projects ( id, name, work_order_number, client_name ),
       stages:job_stages!job_stages_job_id_fkey (
         *,
         department:departments ( id, name )
       ),
       tasks:tasks ( * ),
       materials:materials ( * ),
       notes:notes ( * ),
       files:files ( * )`,
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as JobDetail
}

/** The safe-fields directory of all users, for showing names/avatars. */
export async function getDirectory(): Promise<DirectoryUser[]> {
  const { data, error } = await client().from('user_directory').select('*')
  if (error) throw error
  return (data ?? []) as DirectoryUser[]
}

// ---- QR deep-link resolvers (look up by qr_code_uuid) -----------------------

export async function getProjectIdByQr(qr: string): Promise<string | null> {
  const { data } = await client().from('projects').select('id').eq('qr_code_uuid', qr).maybeSingle()
  return data?.id ?? null
}

export async function getJobByQr(qr: string): Promise<{ id: string } | null> {
  const { data } = await client().from('jobs').select('id').eq('qr_code_uuid', qr).maybeSingle()
  return data
}

export async function getMaterialJobIdByQr(qr: string): Promise<string | null> {
  const { data } = await client().from('materials').select('job_id').eq('qr_code_uuid', qr).maybeSingle()
  return data?.job_id ?? null
}

/** Resolve a typed job code (manual entry fallback) to a job id. */
export async function getJobIdByCode(code: string): Promise<string | null> {
  const { data } = await client().from('jobs').select('id').eq('job_code', code).maybeSingle()
  return data?.id ?? null
}

/** One task with its job, stage/dept, and full clock log (S06). */
export async function getTask(id: string): Promise<TaskFull> {
  const { data, error } = await client()
    .from('tasks')
    .select(
      `*,
       job:jobs ( id, job_code, name, name_i18n, project_id ),
       stage:job_stages!tasks_job_stage_id_fkey ( id, sequence, department:departments ( id, name ) ),
       labor_logs:labor_logs ( * )`,
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as TaskFull
}

/** My Work (S17): the caller's tasks + their department's current queue. */
export async function getMyWork(userId: string, departmentId: string | null): Promise<MyWork> {
  const c = client()

  const { data: myTasks, error: tErr } = await c
    .from('tasks')
    .select(`*, job:jobs ( id, job_code, name, name_i18n )`)
    .or(`assigned_user_id.eq.${userId},created_by.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (tErr) throw tErr

  let deptQueue: DeptQueueJob[] = []
  if (departmentId) {
    const { data: jobs, error: jErr } = await c
      .from('jobs')
      .select(
        `id, job_code, name, name_i18n, status, queue_position,
         current_stage:job_stages!jobs_current_stage_id_fkey ( department_id, status ),
         tasks:tasks ( id, status )`,
      )
      .in('status', ['queued', 'in_production'])
    if (jErr) throw jErr
    deptQueue = ((jobs ?? []) as unknown as DeptQueueJob[])
      .filter((j) => j.current_stage?.department_id === departmentId)
      .sort((a, b) => (a.queue_position ?? 9999) - (b.queue_position ?? 9999))
  }

  return { myTasks: (myTasks ?? []) as unknown as TaskWithJob[], deptQueue }
}

/** The caller's currently-open session (for the live timer), or null. */
export async function getActiveSession(
  userId: string,
): Promise<{ task_id: string; clocked_in_at: string } | null> {
  const { data, error } = await client()
    .from('labor_logs')
    .select('task_id, clocked_in_at')
    .eq('user_id', userId)
    .is('clocked_out_at', null)
    .order('clocked_in_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// ---- Notes & translation (S11, DeepL Edge Function) -------------------------

/** Ask the server to translate a row's field(s) into en/ru/es and store them. */
export async function requestTranslation(table: TranslatableTable, id: string): Promise<void> {
  try {
    await client().functions.invoke('translate', { body: { table, id } })
  } catch {
    /* status stays pending/failed; a retry can re-invoke */
  }
}

/** Notes at the most specific level given (task → job → project). */
export async function getNotes(scope: NoteScope): Promise<Note[]> {
  let q = client().from('notes').select('*').order('created_at', { ascending: false })
  if (scope.taskId) q = q.eq('task_id', scope.taskId)
  else if (scope.jobId) q = q.eq('job_id', scope.jobId).is('task_id', null)
  else q = q.eq('project_id', scope.projectId).is('job_id', null).is('task_id', null)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Note[]
}

/** Add a note (shows immediately in its original language), then kick off translation. */
export async function addNote(params: {
  scope: NoteScope
  authorId: string
  text: string
  language: 'en' | 'ru' | 'es'
}): Promise<{ error: string | null; id?: string }> {
  const { data, error } = await client()
    .from('notes')
    .insert({
      project_id: params.scope.projectId,
      job_id: params.scope.jobId ?? null,
      task_id: params.scope.taskId ?? null,
      author_id: params.authorId,
      original_text: params.text,
      original_language: params.language,
      translation_status: 'pending',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  await requestTranslation('notes', data.id)
  return { error: null, id: data.id }
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await client().from('notes').delete().eq('id', id)
  if (error) throw error
}

// ---- Task creation & approval (S06, S09 rules) ------------------------------

export async function createTask(fields: {
  jobId: string
  jobStageId: string
  name: string
  assignedUserId?: string | null
  estimatedHours?: number | null
  dueDate?: string | null
  instructions?: string | null
  createdBy: string
}): Promise<{ error: string | null; id?: string }> {
  const { data, error } = await client()
    .from('tasks')
    .insert({
      job_id: fields.jobId,
      job_stage_id: fields.jobStageId,
      name: fields.name,
      assigned_user_id: fields.assignedUserId ?? null,
      estimated_hours: fields.estimatedHours ?? null,
      due_date: fields.dueDate ?? null,
      instructions: fields.instructions ?? null,
      created_by: fields.createdBy,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  await requestTranslation('tasks', data.id)
  return { error: null, id: data.id }
}

export async function approveTask(id: string): Promise<ClockResult> {
  const { error } = await client().rpc('approve_task', { p_task_id: id })
  return { error: error ? error.message : null }
}

export async function rejectTask(
  id: string,
  note: string,
  language: 'en' | 'ru' | 'es',
): Promise<ClockResult> {
  const { data, error } = await client().rpc('reject_task', {
    p_task_id: id,
    p_note_text: note,
    p_note_language: language,
  })
  if (error) return { error: error.message }
  if (data) await requestTranslation('notes', data as string)
  return { error: null }
}

/** Admin edit of a task's details (RLS: tasks_admin). Re-translates a changed name. */
export async function updateTask(
  id: string,
  patch: {
    name?: string
    assigned_user_id?: string | null
    estimated_hours?: number | null
    due_date?: string | null
    instructions?: string | null
  },
): Promise<ClockResult> {
  const { error } = await client().from('tasks').update(patch).eq('id', id)
  if (error) return { error: error.message }
  if (patch.name !== undefined) await requestTranslation('tasks', id)
  return { error: null }
}

/** Admin hard-delete — only for tasks with no logged time (else use cancelTask). */
export async function deleteTask(id: string): Promise<ClockResult> {
  const { error } = await client().from('tasks').delete().eq('id', id)
  return { error: error ? error.message : null }
}

/** Admin cancel — archives the task but preserves its logged hours (SPEC §9). */
export async function cancelTask(id: string): Promise<ClockResult> {
  const { error } = await client().from('tasks').update({ status: 'cancelled' }).eq('id', id)
  return { error: error ? error.message : null }
}

/** Pending tasks the caller may approve (Admin: all; Lead: their department). */
export async function getPendingApprovals(
  role: string,
  departmentId: string | null,
): Promise<PendingApproval[]> {
  if (role !== 'admin' && role !== 'lead') return []
  const { data, error } = await client()
    .from('tasks')
    .select(
      `*, job:jobs ( id, job_code, name, name_i18n ),
       stage:job_stages!tasks_job_stage_id_fkey ( department_id )`,
    )
    .eq('status', 'pending_approval')
  if (error) throw error
  let list = (data ?? []) as unknown as PendingApproval[]
  if (role === 'lead') list = list.filter((tk) => tk.stage?.department_id === departmentId)
  return list
}

// ---- Inspection / workflow (S16) --------------------------------------------

/** Stages awaiting inspection, ordered by project priority. */
export async function getInspectionQueue(): Promise<InspectionQueueItem[]> {
  const { data, error } = await client()
    .from('job_stages')
    .select(
      `id, submitted_at, submitted_by,
       department:departments ( id, name ),
       job:jobs!job_stages_job_id_fkey ( id, job_code, name, name_i18n, project:projects ( name, client_name, priority_rank ) ),
       tasks:tasks ( id, name, name_i18n, status, actual_minutes, estimated_hours )`,
    )
    .eq('status', 'pending_inspection')
  if (error) throw error
  const items = (data ?? []) as unknown as InspectionQueueItem[]
  return items.sort(
    (x, y) => (x.job?.project?.priority_rank ?? 9e9) - (y.job?.project?.priority_rank ?? 9e9),
  )
}

/** Inspection decisions for one job (History tab). */
export async function getJobInspections(jobId: string): Promise<JobInspection[]> {
  const { data, error } = await client()
    .from('inspections')
    .select(
      `decision, decided_at, inspector_id,
       job_stage:job_stages!inner ( job_id, sequence, department:departments ( id, name ) ),
       note:notes ( original_text, en_text, ru_text, es_text, original_language )`,
    )
    .eq('job_stage.job_id', jobId)
    .order('decided_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as JobInspection[]
}

export async function submitStage(stageId: string): Promise<ClockResult> {
  const { error } = await client().rpc('submit_stage_for_inspection', { p_job_stage_id: stageId })
  return { error: error ? error.message : null }
}

export async function approveStage(stageId: string): Promise<ClockResult> {
  const { error } = await client().rpc('approve_stage', { p_job_stage_id: stageId })
  return { error: error ? error.message : null }
}

export async function rejectStage(
  stageId: string,
  note: string,
  language: 'en' | 'ru' | 'es',
): Promise<ClockResult> {
  const { error } = await client().rpc('reject_stage', {
    p_job_stage_id: stageId,
    p_note_text: note,
    p_note_language: language,
  })
  return { error: error ? error.message : null }
}

// ---- Clock actions (server-side RPC; see clock_functions migration) ---------

export type ClockResult = { error: string | null }

export async function clockIn(taskId: string): Promise<ClockResult> {
  const { error } = await client().rpc('clock_in', { p_task_id: taskId })
  return { error: error ? error.message : null }
}

export async function clockOut(): Promise<ClockResult> {
  const { error } = await client().rpc('clock_out')
  return { error: error ? error.message : null }
}

export async function completeTask(taskId: string): Promise<ClockResult> {
  const { error } = await client().rpc('complete_task', { p_task_id: taskId })
  return { error: error ? error.message : null }
}
