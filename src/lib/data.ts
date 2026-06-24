import { supabase } from './supabase'
import type {
  ProjectOverview,
  ProjectDetail,
  JobDetail,
  DirectoryUser,
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
