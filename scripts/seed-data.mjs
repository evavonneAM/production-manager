// Seeds the hosted Supabase project with test data for Sprint 1.
//
// Run with:  npm run seed
// Reads SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY from .env.
// The service-role key bypasses RLS — this script is for local/admin use ONLY and
// the key must never be committed or shipped to the browser.
//
// Idempotent: safe to run more than once. Existing rows are reused, not duplicated.

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Missing env vars. Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.',
  )
  process.exit(1)
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function check(error, context) {
  if (error) {
    console.error(`✗ ${context}:`, error.message)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// 1. Departments (9 real departments; Management is oversight, not in routing)
// ---------------------------------------------------------------------------
const DEPARTMENTS = [
  { name: 'Design', default_routing_position: 1 },
  { name: 'Procurement', default_routing_position: 2 },
  { name: 'Stripping', default_routing_position: 3 },
  { name: 'Carpentry', default_routing_position: 4 },
  { name: 'Foam', default_routing_position: 5 },
  { name: 'Sewing', default_routing_position: 6 },
  { name: 'Upholstering', default_routing_position: 7 },
  { name: 'Installation', default_routing_position: 8 },
  { name: 'Management', default_routing_position: null },
]

const { data: deptRows, error: deptErr } = await db
  .from('departments')
  .upsert(DEPARTMENTS, { onConflict: 'name' })
  .select()
check(deptErr, 'seed departments')
const deptId = Object.fromEntries(deptRows.map((d) => [d.name, d.id]))
console.log(`✓ departments (${deptRows.length})`)

// The ordered routing every new job follows.
const ROUTING = [
  'Design', 'Procurement', 'Stripping', 'Carpentry',
  'Foam', 'Sewing', 'Upholstering', 'Installation',
]

// ---------------------------------------------------------------------------
// 2. Test users (created in Supabase Auth; the on_auth_user_created trigger
//    creates their profile row, which we then fill in)
// ---------------------------------------------------------------------------
const PASSWORD = 'ProdMgr!2026' // shared dev password for all test accounts
const USERS = [
  { email: 'admin@houseofvonne.test',  full_name: 'Ava Admin',     role: 'admin', dept: 'Management', language: 'en' },
  { email: 'lead@houseofvonne.test',   full_name: 'Liam Lead',     role: 'lead',  dept: 'Carpentry',  language: 'en' },
  { email: 'staff1@houseofvonne.test', full_name: 'Sergei Volkov', role: 'staff', dept: 'Carpentry',  language: 'ru' },
  { email: 'staff2@houseofvonne.test', full_name: 'Sofía Reyes',   role: 'staff', dept: 'Sewing',     language: 'es' },
]

async function findAuthUserByEmail(email) {
  // Small team — one page is plenty.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  check(error, 'list auth users')
  return data.users.find((u) => u.email === email) || null
}

const userId = {}
for (const u of USERS) {
  let authUser = await findAuthUserByEmail(u.email)
  if (!authUser) {
    const { data, error } = await db.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    })
    check(error, `create auth user ${u.email}`)
    authUser = data.user
  }
  userId[u.email] = authUser.id

  // Fill in the profile (the trigger created it with defaults).
  const { error: upErr } = await db
    .from('users')
    .update({
      full_name: u.full_name,
      role: u.role,
      department_id: deptId[u.dept],
      language: u.language,
    })
    .eq('id', authUser.id)
  check(upErr, `update profile ${u.email}`)
}
console.log(`✓ users (${USERS.length}) — password for all: ${PASSWORD}`)

// Carpentry's Lead
check(
  (await db.from('departments').update({ lead_user_id: userId['lead@houseofvonne.test'] }).eq('id', deptId['Carpentry'])).error,
  'assign Carpentry lead',
)

// ---------------------------------------------------------------------------
// 3. One project with two jobs
// ---------------------------------------------------------------------------
const { data: project, error: projErr } = await db
  .from('projects')
  .upsert(
    {
      name: 'Smith Residence — Living Room',
      client_name: 'Smith Residence',
      work_order_number: 'AM1234',
      description: 'Reupholster sofa and two armchairs; refinish coffee table.',
      status: 'in_progress',
      priority_rank: 1,
    },
    { onConflict: 'work_order_number' },
  )
  .select()
  .single()
check(projErr, 'seed project')
console.log(`✓ project ${project.work_order_number}`)

const JOBS = [
  { job_code: 'AM1234-A', suffix: 'A', name: 'Walnut bar top, 14ft' },
  { job_code: 'AM1234-B', suffix: 'B', name: 'Set of 6 dining chairs' },
]

for (const j of JOBS) {
  const { data: job, error: jobErr } = await db
    .from('jobs')
    .upsert({ ...j, project_id: project.id, status: 'queued' }, { onConflict: 'job_code' })
    .select()
    .single()
  check(jobErr, `seed job ${j.job_code}`)

  // Build the job's routing: one job_stages row per department, in order.
  const stageRows = ROUTING.map((deptName, i) => ({
    job_id: job.id,
    department_id: deptId[deptName],
    sequence: i + 1,
    // The job starts queued in the first stage (Design); the rest are upcoming.
    status: i === 0 ? 'queued' : 'upcoming',
    entered_at: i === 0 ? new Date().toISOString() : null,
  }))
  const { data: stages, error: stageErr } = await db
    .from('job_stages')
    .upsert(stageRows, { onConflict: 'job_id,sequence' })
    .select()
  check(stageErr, `seed stages for ${j.job_code}`)

  // Point the job at its current (first) stage.
  const firstStage = stages.find((s) => s.sequence === 1)
  check(
    (await db.from('jobs').update({ current_stage_id: firstStage.id, queue_position: 1 }).eq('id', job.id)).error,
    `set current stage for ${j.job_code}`,
  )
  console.log(`✓ job ${j.job_code} with ${stages.length} stages`)

  // Sample tasks only on the first job's Design stage, and only once.
  if (j.job_code === 'AM1234-A') {
    const { count } = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('job_stage_id', firstStage.id)
    if (!count) {
      const { error: taskErr } = await db.from('tasks').insert([
        {
          job_id: job.id,
          job_stage_id: firstStage.id,
          name: 'Measure and draft bar-top drawings',
          assigned_user_id: userId['staff1@houseofvonne.test'],
          created_by: userId['admin@houseofvonne.test'], // admin-created → active immediately
          estimated_hours: 3,
        },
        {
          job_id: job.id,
          job_stage_id: firstStage.id,
          name: 'Source walnut slab options',
          created_by: userId['staff1@houseofvonne.test'], // staff-created → trigger forces pending_approval
          estimated_hours: 2,
        },
      ])
      check(taskErr, 'seed tasks')
      console.log('✓ sample tasks (1 active, 1 pending_approval)')
    }
  }
}

console.log('\n✅ Seed complete.')
