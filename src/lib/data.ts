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
} from './types'

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
       job:jobs ( id, job_code, name, project_id ),
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
    .select(`*, job:jobs ( id, job_code, name )`)
    .or(`assigned_user_id.eq.${userId},created_by.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (tErr) throw tErr

  let deptQueue: DeptQueueJob[] = []
  if (departmentId) {
    const { data: jobs, error: jErr } = await c
      .from('jobs')
      .select(
        `id, job_code, name, status, queue_position,
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
