import type { Database } from './database.types'

type Tables = Database['public']['Tables']
type Views = Database['public']['Views']
export type Enums = Database['public']['Enums']

export type Project = Tables['projects']['Row']
export type Job = Tables['jobs']['Row']
export type JobStage = Tables['job_stages']['Row']
export type Task = Tables['tasks']['Row']
export type Department = Tables['departments']['Row']
export type Material = Tables['materials']['Row']
export type Note = Tables['notes']['Row']
export type FileRow = Tables['files']['Row']
export type LaborLog = Tables['labor_logs']['Row']
export type DirectoryUser = Views['user_directory']['Row']

export type ProjectStatus = Enums['project_status']
export type JobStatus = Enums['job_status']
export type StageStatus = Enums['stage_status']
export type TaskStatus = Enums['task_status']

// ---- Shapes returned by the nested queries in data.ts -----------------------

export type DepartmentRef = Pick<Department, 'id' | 'name'>

export type StageWithDept = JobStage & { department: DepartmentRef | null }

/** A job as shown on the project-overview cards (current stage + dept only). */
export type JobOverview = Pick<
  Job,
  'id' | 'job_code' | 'name' | 'status' | 'queue_position'
> & {
  current_stage: (Pick<JobStage, 'sequence' | 'status'> & {
    department: DepartmentRef | null
  }) | null
  materials: Pick<Material, 'id' | 'is_arrived'>[]
}

export type ProjectOverview = Project & { jobs: JobOverview[] }

/** A job with its full stage routing (project detail + job detail). */
export type JobWithStages = Job & { stages: StageWithDept[] }

export type ProjectDetail = Project & { jobs: JobWithStages[] }

export type JobDetail = Job & {
  project: Pick<Project, 'id' | 'name' | 'work_order_number' | 'client_name'> | null
  stages: StageWithDept[]
  tasks: Task[]
  materials: Material[]
  notes: Note[]
  files: FileRow[]
}

export type JobRef = Pick<Job, 'id' | 'job_code' | 'name' | 'name_i18n'>

/** A task with its parent job — used in My Work and the clock-in confirmation. */
export type TaskWithJob = Task & { job: JobRef | null }

/** A pending task shown to an approver (My Work "Awaiting your approval"). */
export type PendingApproval = Task & {
  job: JobRef | null
  stage: { department_id: string } | null
}

/** Task Detail (S06): task + job + stage/dept + its full clock log. */
export type TaskFull = Task & {
  job: (JobRef & { project_id: string }) | null
  stage: (Pick<JobStage, 'id' | 'sequence'> & { department: DepartmentRef | null }) | null
  labor_logs: LaborLog[]
}

/** A job row in the department queue (S17). */
export type DeptQueueJob = Pick<
  Job,
  'id' | 'job_code' | 'name' | 'name_i18n' | 'status' | 'queue_position'
> & {
  current_stage: { department_id: string; status: StageStatus } | null
  tasks: Pick<Task, 'id' | 'status'>[]
  materials: Pick<Material, 'id' | 'is_arrived'>[]
}

export type MyWork = {
  myTasks: TaskWithJob[]
  deptQueue: DeptQueueJob[]
}

/** A stage awaiting inspection (S16 queue). */
export type InspectionQueueItem = {
  id: string // job_stage id
  submitted_at: string | null
  submitted_by: string | null
  department: DepartmentRef | null
  job:
    | {
        id: string
        job_code: string
        name: string
        name_i18n: Job['name_i18n']
        project: { id: string; name: string; client_name: string; priority_rank: number | null } | null
      }
    | null
  tasks: Pick<Task, 'id' | 'name' | 'name_i18n' | 'status' | 'actual_minutes' | 'estimated_hours'>[]
}

/** One inspection decision, for a job's History tab. */
export type JobInspection = {
  decision: 'approved' | 'rejected'
  decided_at: string
  inspector_id: string
  job_stage: { sequence: number; department: DepartmentRef | null } | null
  note:
    | {
        original_text: string
        en_text: string | null
        ru_text: string | null
        es_text: string | null
        original_language: 'en' | 'ru' | 'es'
      }
    | null
}
