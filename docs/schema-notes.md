# Schema notes — Sprint 1

Plain-language record of the database design and the decisions behind it. The
authoritative table-by-table spec is SPEC.md §10; the security rules are SPEC.md §17.
The SQL lives in `supabase/migrations/`.

## The shape of the data

- **projects** are the container (one work order, e.g. `AM1234`).
- **jobs** are the real unit of production (`AM1234-A`, `-B`). Tasks, materials, labor,
  notes, and QR codes all hang off **jobs**, never projects.
- **job_stages** — one row per department leg of a job's route. A job moves through its
  stages in `sequence` order. The job's `current_stage_id` points at where it is now.
- **tasks** belong to a job *and* a stage. People clock into tasks; **labor_logs** record
  each clock-in/out.
- **inspections** are a permanent log — a rejected-then-approved stage is two rows.
- **notes** store the original text plus English/Russian/Spanish translations.
- **notifications** store title/body in all three languages; each user reads their own.

## Decisions worth knowing

1. **Users are tied to login accounts.** A profile in the `users` table shares its id with
   the Supabase Auth account. When an account is created, a database trigger
   (`handle_new_user`) automatically makes the matching profile row. Sprint 2 (login)
   depends on this.

2. **Security is enforced in the database, not just the app** (Row-Level Security). Even if
   someone bypassed the app, the database refuses reads/writes they aren't allowed. Examples:
   staff can read every project but can't edit one; a user only sees their own notifications;
   an inspector can't approve their own submitted work unless they're an Admin.

3. **A few rules need "guards" beyond the basic security policies**, because the policies can
   only allow/deny a whole row, not rewrite values:
   - Staff-created tasks always start as *Pending Approval* (so do tasks a Lead creates for
     another department).
   - A Lead can reorder jobs in their own department but can't change anything else about them.
   - Anyone can mark a material *ordered*/*arrived* (e.g. by scanning its QR), but only
     Procurement or an Admin can edit a material's details.
   - Only an Admin can change a user's role or department.

4. **A "directory" view.** The spec restricts the `users` table to "own + admin" reads, but
   the app must show coworkers' names and avatars on tasks and notes. So a small read-only
   view (`user_directory`) exposes just the safe fields (name, avatar, department, role) to
   everyone signed in, while the full `users` table stays locked down.

5. **Some totals are stored, not computed live** (`total_labor_minutes` on jobs/projects, and
   the job/project columns on labor logs). They exist now but are filled in by the clock-in/out
   logic in Sprint 4.

## Departments & default routing (seed data)

Nine departments, matching the real shop (SPEC §2). The default route a new job follows:

`Design → Procurement → Stripping → Carpentry → Foam → Sewing → Upholstering → Installation`

**Management** is oversight — it exists as a department but isn't a production stage, so it
has no routing position. All of this is editable in the app later (Admin settings, Sprint 11).

## Test accounts (seeded)

Created by `npm run seed`. Shared dev password: **`ProdMgr!2026`**.

| Email | Name | Role | Department | Language |
|---|---|---|---|---|
| admin@houseofvonne.test | Ava Admin | Admin | Management | English |
| lead@houseofvonne.test | Liam Lead | Lead | Carpentry | English |
| staff1@houseofvonne.test | Sergei Volkov | Staff | Carpentry | Russian |
| staff2@houseofvonne.test | Sofía Reyes | Staff | Sewing | Spanish |

Plus one project **AM1234** with two jobs (**AM1234-A**, **AM1234-B**), each routed through
all 8 production stages, and two sample tasks on AM1234-A's Design stage (one active, one
left *Pending Approval* to prove the staff-task rule works).

## How the schema is applied

Version-controlled migration files in `supabase/migrations/`, applied with the Supabase CLI
(`npx supabase db push`) against the hosted project. Seed data is loaded with `npm run seed`
(a Node script using the service-role key, read from the git-ignored `.env`). No local
database/Docker is required.
