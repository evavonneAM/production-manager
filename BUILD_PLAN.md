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

- [x] Initialize a React + Vite project with Tailwind CSS configured.
- [x] Configure it as an installable PWA (manifest, service worker, app icon placeholder).
- [x] Set up `.env.example` and `.gitignore` (ignore `.env`, `node_modules`, build output).
- [x] Initialize git, make the first commit, connect to a GitHub repo.
- [x] Create the Supabase project connection (client setup, env vars for URL + anon key).
- [x] Deploy a "hello world" build to Vercel/Netlify to prove the pipeline works end to end.
- [x] Confirm the app installs to a phone home screen and opens.

**Done when:** I can open the deployed URL on my phone, install it, and see a placeholder home screen.

---

## Sprint 1 — Data model (the whole schema)

**Goal:** every table from SPEC.md Section 10 exists in Supabase with relationships and RLS.

- [x] Create all tables: users, departments, projects, jobs, job_stages, inspections, tasks,
      labor_logs, notes, materials, files, notifications.
- [x] Set up foreign keys, enums, defaults, and timestamps exactly per the spec.
- [x] Write Row-Level Security policies per the matrix in SPEC.md Section 17. Start strict.
- [x] Seed a small set of test data: a few departments, a handful of users (one Admin, one
      Lead, two Staff), one project with two jobs, each with stages.
- [x] Document the schema decisions in a short `docs/schema-notes.md`.

**Done when:** I can browse the seeded data in the Supabase dashboard and the relationships
hold together. No UI yet.

---

## Sprint 2 — Authentication & user profiles

**Goal:** people can log in; the app knows who they are, their role, department, and language.

- [x] Supabase Auth email/password login (S01). No self-registration.
- [x] Protected routes — unauthenticated users get the login screen.
- [x] Session handling; stay logged in across app restarts.
- [x] Profile screen (S12): edit name, phone; language selector (en/ru/es).
      (Photo upload deferred to Sprint 10 — Files & photos — where Storage is set up.)
- [x] Set up the i18n framework now, with all three locale files, so every later screen adds
      its strings in three languages from the start.
- [x] Language change takes effect immediately, no reload.

**Done when:** I can log in as the seeded Admin, switch the UI to Russian and back, and
log out.

---

## Sprint 3 — Projects & jobs (read + display)

**Goal:** see the work. The Home overview and the project/job detail screens, read-only.

- [x] Home / Project Overview (S02): project cards with status, job counts, per-stage
      breakdown, search, filter, sort.
- [x] Project Detail (S05): overview tab, jobs tab with the stage pipeline visualization.
- [x] Job Detail (S05a): job code header, stage pipeline bar, tabs (Tasks, Materials, Notes,
      Files, History) — read-only for now.
- [x] Desktop layout (sidebar nav) alongside the mobile bottom-tab layout.

**Done when:** I can browse from the home list into a project, into a job, and see its stages
laid out, on both phone and desktop.

---

## Sprint 4 — Tasks, clock-in/out & labor tracking

**Goal:** the core daily action — clock into a task, work, clock out, time is recorded.

- [x] Task Detail (S06): show task, status, assignment, labor log.
- [x] Clock-in / clock-out logic with the **one-active-task** rule enforced.
- [x] Clock-In Confirmation (S08), including the "clock out of your other task first" flow.
- [x] Labor logs accumulate onto task, job, and project totals.
- [x] 12-hour auto clock-out safety net with flagging.
- [x] My Work / Department Queue (S17) — the personal landing screen.
- [x] (Pulled forward from Sprint 14) Auto-updating PWA: polls for new builds and refreshes.

**Done when:** as a Staff user I can clock into a task, see a live timer, clock out, and the
logged minutes show up on the job — and I'm blocked from clocking into a second task.

---

## Sprint 5 — QR codes

**Goal:** scan to navigate and clock in; print labels.

- [x] Generate project, job, and component QR codes (deep-link URLs).
- [x] QR Scanner (S07) using the phone camera; route to project/job/component correctly.
- [x] Scanning a job QR lands on the job (clock-in available there via its tasks).
- [x] Generate thermal-label-sized PDF labels (job code + QR + name + client), single and batch.
- [x] Manual job-code entry fallback.

**Done when:** I can print a job label, scan it with my phone, land on the job, and clock in
from that scan.

---

## Sprint 6 — The workflow engine (inspection & hand-off)

**Goal:** the heart of the app. This is the highest-risk sprint — go slow, test hard.
Use Opus here.

- [x] "Submit stage for inspection" — manually by a Lead/Admin (UI prompts when all tasks
      complete; owner chose human-confirmed submit over auto-submit).
- [x] Inspection Queue (S16): list pending stages, ordered by project priority; eligibility
      rules for who can inspect; submitter-can't-self-inspect enforced in RLS + functions.
- [x] Approve action → advance stage, set next stage Queued, **insert into receiving
      department's queue ordered by project priority**, notify that department.
- [x] Reject action → mandatory note, return job to stage, notify. (Defect photo deferred
      to Sprint 10 — Files & photos.)
- [x] Final-stage approval marks the job Complete. (All-jobs-complete → project Complete
      prompt deferred to the Admin project controls.)
- [x] Inspection history recorded permanently and shown on the job History tab.
- [x] Write explicit tests for the hand-off ordering with several jobs of different priorities.

> Deferred (owner: "note it for later", 2026-06-30): per-job stage on/off editor + default
> routing templates per product type, so jobs that skip Stripping/Carpentry etc. are set up
> without editing the DB. The engine already supports partial routes; only the UI is missing.
> Build with the Admin Settings work (S14).

**Done when:** I can push a job through Design → approve → watch it land correctly positioned
in Procurement's queue, reject it from Procurement with a note, and see the whole trail in
History.

---

## Sprint 7 — Notes & translation

**Goal:** cross-language communication.

- [x] DeepL integration via an Edge Function (key never exposed to the client).
- [x] Add/Edit Note (S11): on save, translate to en/ru/es, store all three plus original.
- [x] Notes display in each viewer's language with an "originally written in X" label.
- [x] Graceful failure: show original + warning, retry in background.
- [x] Notes at project, job, and task level.
- [x] **Auto-translate work-description fields too** (decided in Sprint 3): on create/edit,
      translate and store en/ru/es for job names + descriptions, project descriptions,
      material item names (e.g. "6 dining chairs"), and task names — so non-English staff
      can read what the work is. Job codes and client names stay canonical. This revises
      the SPEC §5 "names not translated" decision at the owner's request. Reuses the same
      DeepL Edge Function + a stored-translations pattern (like notes). Touches the schema
      (translation columns/table) → plan in Plan Mode.

**Done when:** I write a note in English, my colleague's account set to Russian sees it in
Russian within a few seconds — and a job named in English shows up readable in Russian too.

---

## Sprint 8 — Task creation & approval workflow

**Goal:** anyone can create tasks; staff-created ones need approval.

- [x] Create-task UI available to all roles.
- [x] Staff-created tasks enter Pending Approval; Admin/Lead approve or reject.
- [x] Approval notifications with one-tap approve/reject (My Work "awaiting your approval").
- [x] Approved tasks become clockable; rejected tasks archived with the note.
- [x] (Owner request, post-sprint) Admin can edit any task — including pending ones before
      approving — and delete tasks (archives as Cancelled instead when time is logged).

**Done when:** a Staff user creates a task, the department Lead gets a notification and
approves it, and it becomes available to clock into.

---

## Sprint 9 — Materials & two-way Google Sheets sync

**Goal:** track materials; keep them in sync with the spreadsheet.

- [x] Materials Tracker (S09): list per job, mark ordered/arrived. (Enriched per the owner's
      real workflow: categories, payment-required gate, details; pricing stays in office sheets.)
- [x] Update status via component QR scan (deep link opens the Materials tab, item highlighted).
- [x] Google Sheets two-way sync via Edge Function (service account): pg_cron every 5 min +
      "Sync Now" + sync-on-change; snapshot-based three-way merge, app wins conflicts with a
      visible note; new sheet rows (keyed by job code) become materials.
- [x] Template sheet auto-created on first sync (owner chose "start fresh" — no migration;
      the three legacy processing sheets remain office/accounting tools).
- [x] Materials readiness indicator (gray/red/green) on cards and job rows.

**Done when:** marking a material "arrived" in the app updates the Google Sheet, and a change
in the sheet shows up in the app after a sync. ✅ Owner-confirmed round trip 2026-07-16.

### Sprint 9b — materials category buttons + ordering dashboard (owner request)

- [ ] Category-first entry: Fabric (with a COM checkbox) · Pillow Inserts · Foam ·
      Hardware/Supplies buttons, each opening a short tailored form.
- [ ] New categories `foam` + `hardware` in the DB enum, sheet Category column, and sync.
- [ ] Ordering dashboard (Procurement + Admin, desktop-first): all jobs' materials grouped
      by category with filters — Needs ordering / Payment required / Ordered / Arrived.
- [ ] Owner sketches may refine layout after first pass.

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
- [ ] **Google Calendar (owner decision, 2026-07-16):** one-way flows via the existing
      sheets-sync service account (share a calendar with it, like the sheet): (a) push
      project/job schedules to a shared Google Calendar; (b) read the shared calendar and
      attach events whose titles contain a job/work-order code (e.g. "AM1234 — walkthrough")
      to that job/project — team will follow the code-in-title naming convention. Two-way
      editing deliberately deferred; these layers stack without rework if wanted later.

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
- [ ] **Email tracking-number capture (owner request, 2026-07-17; bundled here to share the
      Zapier/webhook session):** ingest shipping-confirmation emails via BOTH (a) a Zapier
      Zap with sender filters on the purchasing inbox and (b) a forwarding-address catch-all
      for the other stores; a webhook Edge Function (shared secret) regex-extracts tracking
      numbers + carrier (UPS 1Z…, FedEx 12/15-digit, USPS 20–22-digit) from subject/body;
      a **Tracking tab on the Ordering dashboard** lists captured numbers (carrier link,
      sender, date) with a manual **Match** to a material/job — no auto-linking without human
      confirm (false-positive safety); matched materials show a tracking chip. Later:
      auto-suggest matches by supplier/invoice-number. Deliberately NOT full-mailbox access.

**Done when:** creating a test work order in Estimate Rocket produces a project (and jobs) in
the app — and a forwarded shipping email surfaces its tracking number in the Tracking tab,
matchable to a material.

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
