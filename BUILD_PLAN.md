# BUILD_PLAN.md — Production Manager

**This is the one plan for the app.** There is no other build plan. Decisions and the rules
the owner has set live in [`docs/DECISIONS.md`](docs/DECISIONS.md); standing instructions for
Claude live in `CLAUDE.md`. If work needs a new planning document, put it in `docs/` in this
repo and link it from here. Never keep plans in side copies of the repo (git worktrees);
delete a side copy once its branch is merged.

The file has three parts: **Live now**, **Next** (in order), and the **sprint history**
(Phase 1, Sprints 0–14, plus newer sprints) below it.

*Last updated 2026-10-23.*

---

## Live now

App: https://production-manager-henna.vercel.app (Vercel, updates within a minute of a merge).

- **Team sign-in:** Admin / Lead / Staff roles, email + password and Google sign-in, public
  sign-up off (people are added by an Admin). Privacy page.
- **What the team sees:** Tools and Profile only (PR #31). Testers (`users.is_tester`) see every
  page. To open a page to everyone, add it to `src/lib/openPages.ts`.
- **Tools (in the app):** Cushion Cut Dimensions (incl. wedge, board-mounted), Fabric Yardage
  (solid + patterned, roll layouts), Cushion Pricing (Admins), Upholstery Estimate with
  History check (Admins), Work Order Builder (drapery / roman / top treatments, Admins),
  Drapery Pleat, Leaf Bag, Floorplan Measure.
- **Still outside the app:** Ripplefold calculator (ripplefold-calculator.vercel.app).
- **Look:** Ant Design (`antd`), light mode default, Light / Dark / Auto per device.
- **Built but hidden from the team (Phase 1, Sprints 0–14):** projects, jobs, stages,
  inspections, tasks, clock-in, notes with translation, materials + Google Sheets sync,
  files, calendar, priority board, Estimate Rocket intake, labor reports.
- **In the database but not in the app's main code:** the estimates tables (Oct 15, branch
  `estimates`, PR #16). Decision 6: merge it, hidden from staff (Round 4 below).

---

## Next (in this order)

Code review of 2026-10-23 (review doc in the project): 16 findings. The owner approved
every fix except #10 (insert size warning), in five rounds:

- [ ] **Round 1: plan and security.** One plan (this file), `docs/DECISIONS.md`, updated
      `CLAUDE.md`; remove the side copies of the repo. Fixes #1 (priced PDFs readable through
      file storage), #3 (Sheets / Calendar / translation functions callable with the public
      key), #8 (page hiding opens everything when the profile fails to load), #9 (materials
      and jobs update locks miss newer columns).
- [ ] **Round 2: pricing match.** #4 one shared cushion price book for Cushion Pricing and
      Upholstery Estimate (clean seam $6, roll-layout yardage), #11 round each line to the
      cent. Waits until the corner-styles / outdoor-foam Cushion Pricing branch is live.
- [ ] **Round 3: people and shared computers.** #6 inactive people lose access, #7 queued
      clock-out, drafts and cached data tied to the person and cleared on sign-out. Before
      the remaining ~14 logins go out.
- [ ] **Round 4: estimates platform** (decisions 1–6 in `docs/DECISIONS.md`). Merge
      `estimates` (#5); move the 1,300-row price history into the database, Admins only (#2);
      every tool saves its inputs with each estimate line.
- [ ] **Round 5: clean-up.** #12 "moved" pages on the old standalone calculators (keep
      Floorplan Measure; Ripplefold until it moves in), #13 automated checks for the pricing
      and cutting math + fix the code checker's errors, #14 smaller first download, #15 no
      badge polling for non-testers, #16 "new version ready" instead of an instant reload.

After the review rounds:

- [ ] **Sprint 15: email ↔ project link** (planned, below).
- [ ] **Past projects:** finished jobs and projects leave the active lists and queues by
      default but stay in the app, searchable, with their notes, files, materials and labor.
      Nothing is deleted (owner, 2026-10-23).
- [ ] Ripplefold into the app (owner to send changes).
- [ ] Ant Design redesign of the main screens, one screen at a time.
- [ ] Upholstery piece formulas (parametric relationships), cutting formulas per style
      (owner to provide styles and formulas).
- [ ] Open the main pages to the team, one at a time, as the owner names them ready.

---

# Sprint history

Phase 1 was planned as a sprint-by-sprint build order: each sprint produces something
testable, done in order, each confirmed by the owner before the next. To start a sprint, say
*"Let's start Sprint N. Read the goal and tasks, propose a plan, and wait for my approval."*

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

- [x] Upload from camera, library, or file picker via signed upload URLs (direct to Storage).
- [x] Thumbnail generation (Sharp Edge Function) for photos.
- [x] File Viewer (S10): full-screen photos with zoom; PDF viewer; download/share; delete
      (own files or Admin).
- [x] Attach at project, job, or inspection level.

**Done when:** I can photograph a component on my phone, upload it to a job, and a colleague
can open it.

---

## Sprint 11 — Calendar, priority board & notifications inbox

**Goal:** the management overview surfaces.

- [x] Calendar (S03): monthly/weekly, project bars by status, job-level toggle, drag to
      reschedule (Admin), overdue indicators.
- [x] Priority Board (S04): ranked projects, Admin drag-to-reorder; this feeds queue ordering.
- [x] Notifications Inbox (S15): per-language, unread badge, links to jobs/tasks; badge on the
      Inspection tab for pending count.
- [x] **Google Calendar (owner decision, 2026-07-16):** one-way flows via the existing
      sheets-sync service account (share a calendar with it, like the sheet): (a) push
      project/job schedules to a shared Google Calendar; (b) read the shared calendar and
      attach events whose titles contain a job/work-order code (e.g. "AM1234 — walkthrough")
      to that job/project — team will follow the code-in-title naming convention. Two-way
      editing deliberately deferred; these layers stack without rework if wanted later.

**Done when:** I can drag a project up the priority board and see it affect where its jobs
land in department queues; notifications show in my language.

**Status: complete (owner confirmed 2026-07-27).** Calendar/Priority/Inbox verified in-browser; GCal push+pull verified end-to-end (8/8 automated checks: push with correct dates, title dedupe, code-tagged pull onto AM1234-A, no self-import, idempotent, prune). Cron syncs every 15 min. Drag-to-reschedule shipped as tap-to-edit dialog (mobile-first); drag deferred.

---

## Sprint 12 — Estimate Rocket intake

**Goal:** work orders flow in from Estimate Rocket.

- [x] Webhook endpoint (Edge Function) validating the shared secret.
- [x] **First, inspect the real Zapier payload** to see whether line items are itemized.
- [x] If itemized: auto-create one job per line item with suffixes. If not: create one job +
      the manual "Split Job" UI on S05.
- [x] Update rules: never regress production state from an ER update; notify Admins of new
      work orders.
- [x] Manual "Re-sync" button.
- [x] **Email tracking-number capture (owner request, 2026-07-17; bundled here to share the
      Zapier/webhook session):** ingest shipping-confirmation emails via BOTH (a) a Zapier
      Zap with sender filters on the purchasing inbox and (b) a forwarding-address catch-all
      for the other stores; a webhook Edge Function (shared secret) regex-extracts tracking
      numbers + carrier (UPS 1Z…, FedEx 12/15-digit, USPS 20–22-digit) from subject/body;
      a **Tracking tab on the Ordering dashboard** lists captured numbers (carrier link,
      sender, date) with a manual **Match** to a material/job — no auto-linking without human
      confirm (false-positive safety); matched materials show a tracking chip. Later:
      auto-suggest matches by supplier/invoice-number. Deliberately NOT full-mailbox access.

**Status 2026-07-28: build complete; owner moved on to S13.** All app-side pieces
verified end-to-end (Zapier POST tests land correctly; email capture proven on real
shipping mail; line-item suggestions → task/material; Split Job; Re-sync; no-prices rule).
Sole open item is vendor-side: Estimate Rocket must enable live webhook events for all
three accounts (support ticket open with ER; Zap History shows the instant trigger never
fires despite API login + connection refresh + Zap re-toggle). When ER flips it on, work
orders flow in with no further changes. Also added post-plan: ER portal work-order link
(admin-only), line items → project Scope, "Add as material", sheets-sync grid growth fix.

**Progress 2026-07-27:** all three stores' ER Zaps live (Proposal Status Updated →
per-store URLs); payload NOT itemized → Split Job shipped; processor + Re-sync live
(first imports: HOV8655, RHU5957). Email capture: AM supplies inbox Zap live, Tracking
tab live; forwarding-address for the other two stores still pending.

**Done when:** creating a test work order in Estimate Rocket produces a project (and jobs) in
the app — and a forwarded shipping email surfaces its tracking number in the Tracking tab,
matchable to a material.

---

## Sprint 13 — Labor reports & CSV export

**Goal:** get the labor data out.

- [x] Reports screen (S18): filter by date/project/job/department/user.
- [x] Grouped summaries; estimated vs actual with variance flagging.
- [x] CSV export (UTF-8 with BOM so Cyrillic opens correctly in Excel), columns per SPEC.md
      Section 15, respecting active filters.
- [x] Access scoping: Admin all, Lead own department, Staff own history only.

**Done when:** I can filter to last month's Fabrication labor and download a clean CSV that
opens correctly in Excel.

**Status: complete (owner confirmed 2026-07-28).** 6/6 CSV checks (BOM/Cyrillic/escaping),
7/7 scoping tests, in-browser walkthrough incl. Spanish staff view (own-only, no export).
Note: no real labor logged yet — clock-in rollout is the adoption step after Sprint 14.

---

## Sprint 14 — Offline, polish & hardening

**Goal:** make it robust for daily shop use.

- [x] Offline read cache (service worker) for My Work, department queue, recent jobs.
      *(In code: service worker caches database reads network-first. Not owner-verified.)*
- [x] Clock-out resilience offline (queue the action, sync on reconnect, keep the tap time).
      *(In code: `offlineClock.ts` + `clock_out(p_at)`. Not owner-verified. Review finding #7:
      the queue must be tied to the person on shared computers.)*
- [ ] Real-time updates verified across devices (queues, inspection badges, clock events).
- [x] Full RLS audit against SPEC.md Section 17. *(2026-07-30: 38 live checks across
      anon/staff/lead/admin — matrix matches spec; one finding fixed: internal definer
      helpers were PUBLIC-executable, incl. forgeable _notify. Note: server-side password
      minimum is Supabase default 6 vs app-enforced 8 — dashboard setting if wanted.)*
- [ ] Empty states, loading states, error messages — all in three languages.
- [ ] Final pass on phone + desktop layouts.

**Done when:** I can look up a job with the phone in airplane mode, and a clock-out done
offline syncs correctly when I reconnect.

---

## Sprint 15 — Email ↔ project link (planned, not started)

**Goal:** every email about a job shows up on that job's page, and Claude can turn new emails
into short notes that wait for approval. Owner chose "plan only" on 2026-10-23; no code until
the owner reviews this section.

**Why now:** the app isn't in daily use yet, so changing codes and notes is cheap. Today the
Job Database Google Sheet ("Job Database — Estimates, Work Orders & Emails") is the source of
truth: 378 jobs keyed by a 4-digit code, audit still open.

- [ ] **One job code everywhere (decide first).** Emails and the Sheet use a 4-digit code
      (e.g. 4323, the tail of "2606-1816-4323"); the app uses `AM1234-A`. Add a `short_code`
      on projects (unique per business) so a 4-digit number in an email finds exactly one
      project. *Open question for owner: is the 4-digit number the team's code going forward,
      and can the same number exist in two businesses (AM / HOV / RHU)?*
- [ ] **Notes approval step.** Extend `notes`: `status` (pending / approved / rejected,
      default approved for notes people type), `source` (manual / email), `email_link`,
      `suggested_stage` (a suggestion only, never applied automatically), `reviewed_by`,
      `reviewed_at`. A "Claude" system user is the author of email notes. Pending notes show
      on the project with Approve / Reject for Admins and Leads; translation runs only after
      approval. Nothing is ever deleted: rejected notes stay, hidden by default.
- [ ] **Emails tab on each project.** New `email_threads` table (project, Gmail thread id,
      subject, first sender, last date, link). One row per thread, separate from notes, so the
      page lists the whole conversation history.
- [ ] **How emails get linked** (any of these, all feed the same tables):
      1. *Code in the subject*, e.g. "[4323] Lathrop banquette". Team habit, no build.
      2. *Gmail label* "Project" on emails without a code; matched by client email, unsure
         matches go to a review list instead of guessing.
      3. *BCC / forward address* (like HubSpot's): reuse the Sprint 12 `email-intake` Zapier
         route; an email with a code becomes a pending note + email thread on that project.
- [ ] **Weekday morning Claude run.** Searches Gmail for new emails with codes or the label,
      writes one pending note per thread: who emailed, what was decided, next step + date,
      link. Reads the database through the Supabase connector; writes only pending rows.
- [ ] **Until projects live in the app:** the same run writes to a new "Email Notes" tab in
      the Job Database Sheet (its own tab, because the other tabs are rebuilt automatically),
      and approved rows move into the app later.

**Done when:** I put "[4323]" in an email subject, and the next morning that project shows the
thread on its Emails tab plus a pending note I can approve in one tap.

---

## A note on sequencing risk

Sprint 6 (the workflow engine) is where the project succeeds or struggles. Everything before
it is comparatively standard app-building; the inspection → approval → priority-ordered
hand-off logic is the part unique to your business and the part worth slowing down for.
Build it on Opus, write tests for the queue-ordering math, and don't rush my review of it.

If usage limits become a problem mid-build, that's the signal to look at Max — not the
Anthropic Console, which is a separate pay-per-use developer product your app doesn't need.
