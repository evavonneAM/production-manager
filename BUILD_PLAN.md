# BUILD_PLAN.md — Production Manager

A sprint-by-sprint build order for Claude Code. Each sprint produces something testable.
Do them **in order** — later sprints depend on earlier ones. Don't skip ahead, and don't
start a sprint until the previous one is committed and I've confirmed it works.

How to use this with Claude Code: at the start of a sprint, say *"Let's start Sprint N. Read
the goal and tasks, propose a plan, and wait for my approval."* Work task by task. Commit
after each working task.

A "sprint" here is a unit of work, not a fixed number of days. Expect roughly 1–2 sessions
each, more for the workflow engine.

---

## Sprint 0 — Foundation & scaffolding

**Goal:** an empty but running React PWA, connected to Supabase, deployable, in git.

- [ ] Initialize a React + Vite project with Tailwind CSS configured.
- [ ] Configure it as an installable PWA (manifest, service worker, app icon placeholder).
- [ ] Set up `.env.example` and `.gitignore` (ignore `.env`, `node_modules`, build output).
- [ ] Initialize git, make the first commit, connect to a GitHub repo.
- [ ] Create the Supabase project connection (client setup, env vars for URL + anon key).
- [ ] Deploy a "hello world" build to Vercel/Netlify to prove the pipeline works end to end.
- [ ] Confirm the app installs to a phone home screen and opens.

**Done when:** I can open the deployed URL on my phone, install it, and see a placeholder home screen.

---

## Sprint 1 — Data model (the whole schema)

**Goal:** every table from SPEC.md Section 10 exists in Supabase with relationships and RLS.

- [ ] Create all tables: users, departments, projects, jobs, job_stages, inspections, tasks,
      labor_logs, notes, materials, files, notifications.
- [ ] Set up foreign keys, enums, defaults, and timestamps exactly per the spec.
- [ ] Write Row-Level Security policies per the matrix in SPEC.md Section 17. Start strict.
- [ ] Seed a small set of test data: a few departments, a handful of users (one Admin, one
      Lead, two Staff), one project with two jobs, each with stages.
- [ ] Document the schema decisions in a short `docs/schema-notes.md`.

**Done when:** I can browse the seeded data in the Supabase dashboard and the relationships
hold together. No UI yet.

---

## Sprint 2 — Authentication & user profiles

**Goal:** people can log in; the app knows who they are, their role, department, and language.

- [ ] Supabase Auth email/password login (S01). No self-registration.
- [ ] Protected routes — unauthenticated users get the login screen.
- [ ] Session handling; stay logged in across app restarts.
- [ ] Profile screen (S12): edit name, photo, phone; language selector (en/ru/es).
- [ ] Set up the i18n framework now, with all three locale files, so every later screen adds
      its strings in three languages from the start.
- [ ] Language change takes effect immediately, no reload.

**Done when:** I can log in as the seeded Admin, switch the UI to Russian and back, and
log out.

---

## Sprint 3 — Projects & jobs (read + display)

**Goal:** see the work. The Home overview and the project/job detail screens, read-only.

- [ ] Home / Project Overview (S02): project cards with status, job counts, per-stage
      breakdown, search, filter, sort.
- [ ] Project Detail (S05): overview tab, jobs tab with the stage pipeline visualization.
- [ ] Job Detail (S05a): job code header, stage pipeline bar, tabs (Tasks, Materials, Notes,
      Files, History) — read-only for now.
- [ ] Desktop layout (sidebar nav) alongside the mobile bottom-tab layout.

**Done when:** I can browse from the home list into a project, into a job, and see its stages
laid out, on both phone and desktop.

---

## Sprint 4 — Tasks, clock-in/out & labor tracking

**Goal:** the core daily action — clock into a task, work, clock out, time is recorded.

- [ ] Task Detail (S06): show task, status, assignment, labor log.
- [ ] Clock-in / clock-out logic with the **one-active-task** rule enforced.
- [ ] Clock-In Confirmation (S08), including the "clock out of your other task first" flow.
- [ ] Labor logs accumulate onto task, job, and project totals.
- [ ] 12-hour auto clock-out safety net with flagging.
- [ ] My Work / Department Queue (S17) — the personal landing screen.

**Done when:** as a Staff user I can clock into a task, see a live timer, clock out, and the
logged minutes show up on the job — and I'm blocked from clocking into a second task.

---

## Sprint 5 — QR codes

**Goal:** scan to navigate and clock in; print labels.

- [ ] Generate project, job, and component QR codes (deep-link URLs).
- [ ] QR Scanner (S07) using the phone camera; route to project/job/component correctly.
- [ ] Scanning a job QR offers clock-in if the user has tasks there.
- [ ] Generate thermal-label-sized PDF labels (job code + QR + name + client), single and batch.
- [ ] Manual job-code entry fallback.

**Done when:** I can print a job label, scan it with my phone, land on the job, and clock in
from that scan.

---

## Sprint 6 — The workflow engine (inspection & hand-off)

**Goal:** the heart of the app. This is the highest-risk sprint — go slow, test hard.
Use Opus here.

- [ ] "Submit stage for inspection" — triggered when all stage tasks complete, or manually by
      a Lead/Admin.
- [ ] Inspection Queue (S16): list pending stages, ordered by project priority; eligibility
      rules for who can inspect; submitter-can't-self-inspect enforced in RLS.
- [ ] Approve action → advance stage, set next stage Queued, **insert into receiving
      department's queue ordered by project priority**, notify that department.
- [ ] Reject action → mandatory translated note, optional defect photo, return job to stage,
      notify.
- [ ] Final-stage approval marks the job Complete; all jobs complete prompts project Complete.
- [ ] Inspection history recorded permanently and shown on the job History tab.
- [ ] Write explicit tests for the hand-off ordering with several jobs of different priorities.

**Done when:** I can push a job through Design → approve → watch it land correctly positioned
in Procurement's queue, reject it from Procurement with a note, and see the whole trail in
History.

---

## Sprint 7 — Notes & translation

**Goal:** cross-language communication.

- [ ] DeepL integration via an Edge Function (key never exposed to the client).
- [ ] Add/Edit Note (S11): on save, translate to en/ru/es, store all three plus original.
- [ ] Notes display in each viewer's language with an "originally written in X" label.
- [ ] Graceful failure: show original + warning, retry in background.
- [ ] Notes at project, job, and task level.

**Done when:** I write a note in English, my colleague's account set to Russian sees it in
Russian within a few seconds.

---

## Sprint 8 — Task creation & approval workflow

**Goal:** anyone can create tasks; staff-created ones need approval.

- [ ] Create-task UI available to all roles.
- [ ] Staff-created tasks enter Pending Approval; Admin/Lead approve or reject.
- [ ] Approval notifications with one-tap approve/reject.
- [ ] Approved tasks become clockable; rejected tasks archived with the note.

**Done when:** a Staff user creates a task, the department Lead gets a notification and
approves it, and it becomes available to clock into.

---

## Sprint 9 — Materials & two-way Google Sheets sync

**Goal:** track materials; keep them in sync with the spreadsheet.

- [ ] Materials Tracker (S09): list per job, mark ordered/arrived.
- [ ] Update status via component QR scan.
- [ ] Google Sheets two-way sync via Edge Function (service account): poll every 5 min +
      "Sync Now"; write app changes back; last-write-wins with a visible sync-status column.
- [ ] Provide the template sheet column layout; plan a one-time migration of the existing sheet.
- [ ] Materials readiness indicator (gray/red/green) on cards and job rows.

**Done when:** marking a material "arrived" in the app updates the Google Sheet, and a change
in the sheet shows up in the app after a sync.

---

## Sprint 10 — Files & photos

**Goal:** attach and view photos and PDFs.

- [ ] Upload from camera, library, or file picker via signed upload URLs (direct to Storage).
- [ ] Thumbnail generation (Sharp Edge Function) for photos.
- [ ] File Viewer (S10): full-screen photos with zoom; PDF viewer; download/share; delete
      (own files or Admin).
- [ ] Attach at project, job, or inspection level.

**Done when:** I can photograph a component on my phone, upload it to a job, and a colleague
can open it.

---

## Sprint 11 — Calendar, priority board & notifications inbox

**Goal:** the management overview surfaces.

- [ ] Calendar (S03): monthly/weekly, project bars by status, job-level toggle, drag to
      reschedule (Admin), overdue indicators.
- [ ] Priority Board (S04): ranked projects, Admin drag-to-reorder; this feeds queue ordering.
- [ ] Notifications Inbox (S15): per-language, unread badge, links to jobs/tasks; badge on the
      Inspection tab for pending count.

**Done when:** I can drag a project up the priority board and see it affect where its jobs
land in department queues; notifications show in my language.

---

## Sprint 12 — Estimate Rocket intake

**Goal:** work orders flow in from Estimate Rocket.

- [ ] Webhook endpoint (Edge Function) validating the shared secret.
- [ ] **First, inspect the real Zapier payload** to see whether line items are itemized.
- [ ] If itemized: auto-create one job per line item with suffixes. If not: create one job +
      the manual "Split Job" UI on S05.
- [ ] Update rules: never regress production state from an ER update; notify Admins of new
      work orders.
- [ ] Manual "Re-sync" button.

**Done when:** creating a test work order in Estimate Rocket produces a project (and jobs) in
the app.

---

## Sprint 13 — Labor reports & CSV export

**Goal:** get the labor data out.

- [ ] Reports screen (S18): filter by date/project/job/department/user.
- [ ] Grouped summaries; estimated vs actual with variance flagging.
- [ ] CSV export (UTF-8 with BOM so Cyrillic opens correctly in Excel), columns per SPEC.md
      Section 15, respecting active filters.
- [ ] Access scoping: Admin all, Lead own department, Staff own history only.

**Done when:** I can filter to last month's Fabrication labor and download a clean CSV that
opens correctly in Excel.

---

## Sprint 14 — Offline, polish & hardening

**Goal:** make it robust for daily shop use.

- [ ] Offline read cache (service worker) for My Work, department queue, recent jobs.
- [ ] Clock-out resilience offline (queue the action, sync on reconnect, keep the tap time).
- [ ] Real-time updates verified across devices (queues, inspection badges, clock events).
- [ ] Full RLS audit against SPEC.md Section 17.
- [ ] Empty states, loading states, error messages — all in three languages.
- [ ] Final pass on phone + desktop layouts.

**Done when:** I can look up a job with the phone in airplane mode, and a clock-out done
offline syncs correctly when I reconnect.

---

## A note on sequencing risk

Sprint 6 (the workflow engine) is where the project succeeds or struggles. Everything before
it is comparatively standard app-building; the inspection → approval → priority-ordered
hand-off logic is the part unique to your business and the part worth slowing down for.
Build it on Opus, write tests for the queue-ordering math, and don't rush my review of it.

If usage limits become a problem mid-build, that's the signal to look at Max — not the
Anthropic Console, which is a separate pay-per-use developer product your app doesn't need.
