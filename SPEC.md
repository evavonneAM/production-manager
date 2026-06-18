# Production Manager — Product Specification

**Furniture Production Management App**
Version 2.0 · June 2026
*Confidential — Internal Use Only*

> Version 2.0 adds: multi-item work orders (job codes), stage inspection & approval workflow, automatic department hand-off, the Lead role, task creation with approval, labor CSV export, two-way materials sync, and the resolved decisions from v1.0.

---

## Table of Contents

1. Project Overview
2. Users, Roles & Departments
3. Work Orders, Jobs & Job Codes
4. Production Pipeline: Stages, Inspection & Hand-Off
5. Multilingual System
6. Screen Inventory
7. Screen Specifications
8. QR Code System & Clock-In Flow
9. Task Management Rules
10. Database Schema
11. Estimate Rocket Integration
12. Materials Tracking (Two-Way Sync)
13. File Attachments
14. Notifications
15. Labor Reports & CSV Export
16. Tech Stack & Infrastructure
17. Security & Permissions
18. Decision Log (Resolved Questions)
19. Remaining Open Items

---

## 1. Project Overview

### Purpose

Production Manager is a phone-first Progressive Web App (PWA) for a furniture production business. It enables staff across all departments to manage projects, track production schedules, assign and log tasks, scan QR codes attached to components, and communicate in their preferred language — English, Russian, or Spanish. It also works on desktop computers in any modern browser, so shop computers can be used wherever phones are impractical.

### Goals

- Give every team member instant access to project status from their phone or a shop computer.
- Split multi-item work orders into individually tracked jobs with their own job codes (e.g. AM1234-A, AM1234-B).
- Route each job through a defined sequence of department stages, with mandatory inspection and approval between stages.
- Automatically hand approved jobs to the next department's queue, ordered by priority.
- Enforce accurate labor tracking by requiring clock-out before switching tasks.
- Eliminate language barriers through automatic note translation.
- Connect work orders from Estimate Rocket directly into the app.
- Track materials from order to delivery with two-way spreadsheet sync and QR-linked component tags.

### Key Constraints

- Phone-first design; fully usable on a 390px wide mobile screen **and** on desktop browsers.
- 15–30 concurrent users across multiple departments.
- Three supported languages: English (EN), Russian (RU), Spanish (ES).
- QR scanning uses the phone camera — no dedicated scanning hardware required.
- QR labels printed on a thermal label printer (recommended models in Section 8).
- Estimate Rocket integration via Zapier webhooks.
- Notifications are in-app only (no push, no email) — see Section 14.

### Success Criteria

- A multi-item work order from Estimate Rocket is split into job codes automatically, each trackable on its own.
- A completed stage cannot move to the next department without an inspector's approval.
- An approved job appears in the next department's queue, positioned by priority, with zero manual steps.
- A user can scan a QR code and clock into a job task in under 10 seconds.
- A note written in Russian is readable in English and Spanish by other users within 5 seconds.
- Labor hours per job and per project are automatically accumulated from clock-in/clock-out events and exportable to CSV.

---

## 2. Users, Roles & Departments

### User Profile Fields

| Field | Type | Notes |
|---|---|---|
| Full name | Text | Displayed on tasks and notes |
| Email | Email | Used for login |
| Phone number | Text | Optional |
| Profile photo | Image | Avatar shown on tasks and clock-in events |
| Department | Enum | See department list below |
| Role | Enum | Admin, Lead, or Staff |
| Language preference | Enum | EN, RU, or ES — controls all UI text and note display |
| Active task | FK → Task | Null if not clocked in; enforces one-task rule |

### Roles

**Admin**

- Can create, edit, and delete projects and jobs.
- Can assign tasks to any user or department.
- Can inspect and approve/reject completed stages for ANY department.
- Approves or rejects staff-created tasks.
- Can view all labor logs, run reports, and export CSV.
- Can manage user accounts, departments, and stage routing templates.
- Can adjust project and job priority ordering.
- Can trigger Estimate Rocket re-sync and materials spreadsheet sync.

**Lead (Department Lead)**

- All Staff abilities, plus:
- Can inspect and approve/reject completed stages for THEIR OWN department's outgoing work (see Section 4).
- Can reorder priority within their own department's queue.
- Can approve staff-created tasks within their own department.
- Can view labor logs for users in their own department.

**Staff**

- Can view all projects and jobs (read access is company-wide).
- Has a personal "My Work" list and a department queue showing only their own/department's assignments.
- Can create tasks — these enter a "Pending Approval" state until an Admin or their department Lead approves (see Section 9).
- Can clock in/out of tasks assigned to them or their department.
- Can add notes and attach files to any project.
- Can update materials status (mark ordered/arrived) via QR scan.
- Cannot delete projects, manage users, or inspect stages.

### Departments

Departments are configurable by an Admin. The initial set:

| Department | Typical Responsibilities |
|---|---|
| Design | Drawings, specifications, client approvals |
| Procurement | Material ordering and delivery tracking |
| Stripping | Removing old materials and finishes |
| Carpentry | Building, repairing, assembling, and finishing wood (sanding, staining, lacquering) |
| Foam | Base layers, webbing, springing, and foam application |
| Sewing | Patterning, cutting, and sewing |
| Upholstering | Upholstery and trim application |
| Installation | On-site delivery and installation |
| Management | Oversight, scheduling, client communication |

> Departments are not hard-coded — Admins can add, rename, or archive departments in Settings. The default stage routing (Section 4) references these departments and updates automatically if they are renamed.

---

## 3. Work Orders, Jobs & Job Codes

### Concept

A work order (project) from Estimate Rocket may contain multiple line items — for example, a work order for a restaurant might include a bar top, six tables, and a host stand. Each item must be tracked independently because items move through production at different speeds and may be inspected and handed off separately.

In the app, every line item becomes a **JOB**. Jobs are the unit of production tracking; the project is the container that groups them.

### Job Code Format

Each job receives a unique, human-readable job code derived from the work order number:

| Entity | Code | Example |
|---|---|---|
| Work order (project) | `[WO number]` | AM1234 |
| First job (single-item orders) | `[WO number]` | AM1234 (no suffix when only one item) |
| Jobs in multi-item orders | `[WO number]-[letter]` | AM1234-A, AM1234-B, AM1234-C ... |
| Beyond 26 items | `[WO number]-[double letter]` | AM1234-AA, AM1234-AB ... |

### Job Creation Rules

- When a work order arrives from Estimate Rocket with multiple line items, the app creates one job per line item, suffixed A, B, C... in line-item order.
- If the Zapier payload does not itemize line items (depends on Estimate Rocket's trigger data), the project is created with a single job and an Admin can split it into multiple jobs manually from the project screen.
- Admins can add, merge, or split jobs at any time before production starts on them.
- Each job has its own: name/description, stage routing, tasks, QR code, materials list, labor total, and status.
- The project-level QR code still exists and opens the project overview; each job also gets its own QR code that opens that job directly.

### Job Fields

| Field | Notes |
|---|---|
| Job code | AM1234-A — unique across the whole system |
| Name | e.g. "Walnut bar top, 14ft" |
| Description | From the work order line item, editable |
| Current stage | Which department stage the job is in now |
| Stage status | In Progress / Pending Inspection / Approved / Rejected |
| Priority rank | Position within the current department's queue |
| Labor total | Accumulated minutes from all tasks on this job |
| QR code | Deep link to the job page |

> Project status (Section 7, S02) is now derived from its jobs: a project is "Complete" only when every job has passed its final stage.

---

## 4. Production Pipeline: Stages, Inspection & Hand-Off

### Stage Routing

Every job follows a routing — an ordered sequence of department stages. The default routing template is:

```
Design → Procurement → Fabrication → Finishing → Installation
```

- Admins can edit the default routing template in Settings.
- Admins can customize the routing per job (e.g. a refinishing-only job might skip Design and Fabrication).
- A job is always in exactly one stage at a time.

### Stage Lifecycle

| Stage status | Meaning | Set by |
|---|---|---|
| Queued | Job is in this department's queue, work not started | System (on hand-off) |
| In Progress | At least one task in this stage has been clocked into | System (on first clock-in) |
| Pending Inspection | Department marked the stage complete; awaiting inspector | Lead or Admin (or last task completion) |
| Approved | Inspector approved; job moves to next stage | Inspector |
| Rejected | Inspector rejected; job returns to In Progress with notes | Inspector |

### Marking a Stage Complete

- When all tasks in the current stage are marked Completed, the app prompts: "All tasks complete. Submit this stage for inspection?"
- A Lead or Admin can also submit a stage for inspection manually, even if not every task is formally completed (with a confirmation warning).
- On submission, the stage status becomes Pending Inspection and the job appears on the Inspection Queue (screen S16).

### Inspection (the Pending Page)

The Inspection Queue (S16) is the production manager's control point. It lists every job whose current stage is Pending Inspection.

**Who can inspect**

- Any Admin can inspect any stage.
- A department Lead can inspect stages completed by THEIR OWN department (i.e. the Fabrication lead signs off Fabrication's outgoing work).
- The inspector cannot be the same user who submitted the stage, unless they are an Admin. This keeps a second set of eyes on the work where possible.

**Inspection actions**

| Action | What happens |
|---|---|
| Approve | Stage status → Approved. The job immediately moves to the next stage in its routing. It is inserted into the next department's queue, positioned according to its priority rank relative to jobs already in that queue (see Hand-Off below). The next department's Lead and members receive an in-app notification. |
| Reject | Inspector must enter a rejection note (translated like all notes). Stage status → In Progress (returned). The department Lead and the users who worked the stage are notified. The job stays in the same department until resubmitted. |

- Every inspection decision is recorded permanently: inspector, timestamp, decision, and note. The job's history tab shows the full inspection trail.
- Photos can be attached to an inspection (e.g. photo of a defect on rejection).

### Automatic Hand-Off & Queue Ordering

When a stage is approved:

- The job's current stage advances to the next department in its routing.
- The new stage status is Queued.
- The job is inserted into the receiving department's queue. Insertion position is determined by the job's project priority rank (from the Priority Board, S04): the queue stays sorted so higher-priority projects' jobs sit above lower-priority ones. Jobs of equal priority are ordered by arrival time (first in, first out).
- The receiving department's Lead can manually reorder their queue afterwards — manual ordering overrides the automatic position until the next re-sort.
- If the job has reached the END of its routing and the final stage is approved, the job status becomes Complete. When all jobs in a project are Complete, the app prompts an Admin to mark the project Complete.

### Example Flow

| Step | Event |
|---|---|
| 1 | Work order AM1234 arrives with 3 items → jobs AM1234-A, -B, -C created, all Queued in Design |
| 2 | Design finishes drawings for AM1234-A; Lead submits stage → Pending Inspection |
| 3 | Admin reviews drawings on the Inspection Queue, taps Approve |
| 4 | AM1234-A auto-moves to Procurement's queue, slotted above two lower-priority jobs |
| 5 | Meanwhile AM1234-B is still In Progress in Design — jobs move independently |
| 6 | Procurement later submits AM1234-A; the Procurement Lead's inspection finds a missing hardware order → Reject with note "Hinges not ordered" |
| 7 | AM1234-A returns to Procurement In Progress; assigned user notified; hinges ordered; stage resubmitted and approved |

---

## 5. Multilingual System

### UI Language

All interface text — labels, buttons, status messages, navigation items — is rendered in the user's chosen language, set in the user profile and changeable at any time with immediate effect. All static UI strings are stored in i18n translation files. Locales: `en`, `ru`, `es`.

### Note Translation

- User writes a note in any language (input language is not restricted).
- On save, the app sends the text to the DeepL API requesting translations into all three supported languages.
- The note stores all three translations (en_text, ru_text, es_text) plus original_text and original_language.
- Each user sees the version in their preferred language, with a label such as "Originally written in Russian".
- If translation fails, the original text is shown to all users with a warning banner and the app retries in the background.
- Inspection rejection notes are notes — they are translated the same way.

### Translation API

Recommended: **DeepL API**. Highest quality for Russian and Spanish. Free tier: 500,000 characters/month — sufficient for this team size. Pro tier ($6.99/month) removes the cap.

### What Is and Is Not Translated

| Content | Translated? | Notes |
|---|---|---|
| User notes | Yes | All three languages stored on save |
| Inspection rejection notes | Yes | Same pipeline as user notes |
| Project / job names | No | Single canonical name from the work order |
| Task names | No | Short operational labels |
| Status values | Yes | Via UI i18n strings |
| File names | No | Preserved as uploaded |
| In-app notifications | Yes | Stored per-language; user sees their own |

---

## 6. Screen Inventory

| Screen ID | Screen Name | Access |
|---|---|---|
| S01 | Login | Public |
| S02 | Home / Project Overview | All users |
| S03 | Calendar View | All users |
| S04 | Priority Board | All users (edit: Admin only) |
| S05 | Project Detail | All users |
| S05a | Job Detail | All users |
| S06 | Task Detail | All users (clock-in: assigned) |
| S07 | QR Scanner | All users |
| S08 | Clock-In Confirmation | All users |
| S09 | Materials Tracker | All users (edit: Procurement + Admin) |
| S10 | File Viewer | All users |
| S11 | Add / Edit Note | All users |
| S12 | User Profile & Settings | Own profile (Admin: all) |
| S13 | Admin: User Management | Admin only |
| S14 | Admin: Department & Routing Settings | Admin only |
| S15 | Notifications Inbox | All users |
| S16 | Inspection Queue (Pending Page) | Admin + Leads (view: all users) |
| S17 | My Work / Department Queue | All users |
| S18 | Labor Reports & Export | Admin (Leads: own department) |

### Navigation Structure

Bottom navigation bar with 5 tabs (visible on all authenticated screens):

- My Work (S17 — the user's personal default landing screen)
- Projects (S02)
- Calendar (S03)
- Inspection (S16 — badge shows pending count; visible to all, actionable by inspectors)
- Profile (S12)

A floating QR scan button is always visible at bottom center, above the tab bar.

On desktop, the bottom tab bar becomes a left sidebar; all screens use a wider two-column layout where appropriate. Functionality is identical.

---

## 7. Screen Specifications

### S01 — Login

- Fields: Email, Password. Button: Sign In. Link: Forgot Password.
- No self-registration — accounts created by Admin only.
- Biometric login (Face ID / fingerprint) after first sign-in.

### S02 — Home / Project Overview

- Displays all projects as a scrollable card list — company-wide visibility for all roles.
- Each project card shows: project name, work order number, client, status badge, scheduled dates, job count with per-stage breakdown (e.g. "2 in Fabrication, 1 in Finishing"), materials readiness dot, total labor hours, latest photo thumbnail.
- Filter bar: Status, Department, Client. Search: project/job name, job code, client.
- Sort: by date (default), priority, status, recently updated.
- Tapping a card → S05. Admin sees "+" to create a project manually.

**Project status values**

| Status | Color | Meaning |
|---|---|---|
| Estimate | Gray | Work order received, not yet scheduled |
| Scheduled | Blue | On the calendar, no job started |
| In Progress | Amber | At least one job is in production |
| On Hold | Orange | Paused — materials or client |
| Complete | Green | All jobs passed final stage |
| Delivered | Teal | Delivered and/or installed |

### S03 — Calendar View

- Monthly view default, toggle to weekly.
- Each project appears as a bar spanning scheduled start–end. Color = status.
- Toggle to show individual jobs instead of whole projects.
- Tap a bar → S05 (or S05a in job mode).
- Admin can drag to reschedule (confirmation prompt).
- Red dot deadline indicators on overdue items. "Today" button.

### S04 — Priority Board

- All active projects in a ranked vertical list (1 = highest).
- Row: rank, project name, client, status, due date, urgency indicator.
- Admin drags to reorder; saved immediately. Others view only.
- Project priority feeds the automatic queue insertion when jobs are handed between departments (Section 4).

> Department Leads reorder their own department queue on S17 — that is queue-level ordering. S04 is company-level project priority.

### S05 — Project Detail

Organized into tabs:

**Tab 1: Overview**

- Project name, client, work order number, status badge (Admin can change), scheduled dates (Admin edits), scope description.
- Jobs summary: each job with its code, name, current stage, stage status — tap to open S05a.
- Total labor hours across all jobs. Project QR code button (full-screen, printable).

**Tab 2: Jobs**

- Full job list with stage pipeline visualization per job (Design ✓ → Procurement ✓ → Fabrication ● → ...).
- Admin: add job, split a job into multiple, edit a job's stage routing.

**Tab 3: Materials**

- Materials across all jobs, grouped by job. See Section 12.

**Tab 4: Notes**

- Chronological project-level notes; author avatar/name, timestamp, text in viewer's language, original-language label. "Add Note" → S11.

**Tab 5: Files**

- Grid of photos and PDFs across the project. Upload via camera or file picker. Tap → S10. Max 50 MB/file. Delete: own files or Admin.

### S05a — Job Detail

The job is the production unit; this screen is where shop-floor work happens.

- Header: job code (large, e.g. AM1234-A), job name, parent project link.
- Stage pipeline bar showing all stages in routing, completed/current/upcoming, with inspection status icons.
- Current stage card: department, stage status, assigned tasks, "Submit for Inspection" button (Lead/Admin, enabled when tasks complete).
- Tabs: Tasks (this job's tasks grouped by stage), Materials (this job's components), Notes (job-level notes), Files, History (full audit: stage transitions, inspections with notes, hand-offs).
- Job QR code button — prints a label deep-linking to this job.
- Labor summary: estimated vs actual hours for this job.

### S06 — Task Detail

- Task name, job code, stage/department, assigned user (if specific), creator, approval status.
- Status: Pending Approval, Unstarted, In Progress, Paused, Completed, Cancelled.
- Estimated vs actual hours; full clock-in/out log (user, timestamps, duration).
- Clock In (assigned user with no active task) → S08. Clock Out (currently clocked-in user).
- Mark Complete (assigned user or Admin/Lead, with confirmation).
- Task-level notes.
- If task is Pending Approval: Admin or the department's Lead sees Approve / Reject buttons here and in their notification.

### S07 — QR Scanner

- Camera with scan overlay. Recognizes project, job, and component QR codes.
- Project QR → S05. Job QR → S05a, or S08 if the user has clockable tasks on it. Component QR → that component in S09.
- If user has an active task elsewhere: routed through the clock-out warning (Section 8).
- Unrecognized code → error. Manual job-code entry fallback (type "AM1234-A").

### S08 — Clock-In Confirmation

- Shows project, job code, task, assignment.
- If user has an active task elsewhere: warning with active task name; must clock out first (one-tap clock-out offered, then proceeds).
- Clock In: timestamp recorded, user.active_task set, task → In Progress, stage → In Progress if it was Queued.

### S11 — Add / Edit Note

- Plain-text area (warning above 2,000 characters). Detected-language indicator.
- Save triggers translation to all three languages.
- Users edit only their own notes; Admin can delete any.

### S12 — User Profile & Settings

- Edit name, photo, phone. Language selector (EN/RU/ES), immediate effect. Change password.
- Own labor history: all clock events with job code, task, duration.

### S13 — Admin: User Management

- List users: name, email, department, role (Admin/Lead/Staff), last active.
- Create user (sends welcome email with setup link), edit role/department, reset password, deactivate (preserves history).

### S14 — Admin: Department & Routing Settings

- Add / rename / archive departments.
- Edit the default stage routing template (ordered department list).
- Assign which user is the Lead of each department.

### S15 — Notifications Inbox

- Chronological list, in the user's language, each linking to the relevant job/task. Unread badge on the nav. Mark-all-read.

### S16 — Inspection Queue (Pending Page)

The control point for stage approvals.

- Lists every job whose current stage is Pending Inspection, ordered by project priority.
- Each row: job code, job name, stage/department, who submitted, when, time waiting.
- Filter by department. Badge count on the nav tab.
- All users can view the queue (transparency); only eligible inspectors see Approve/Reject actions on each item (Admins anywhere; Leads for their own department's submissions; submitter cannot self-inspect unless Admin).
- Tapping a row opens an inspection panel: job summary, this stage's tasks and hours, attached files, photo viewer, Approve button, Reject button with mandatory note field and optional photo attachment.
- Approve → automatic hand-off (Section 4). Reject → returns to department with notification.

### S17 — My Work / Department Queue

The default landing screen after login. Two sub-tabs:

**My Tasks**

- Tasks assigned specifically to the current user, plus the task they are clocked into (pinned at top with live timer).
- Grouped: Active, Up Next (by job priority), Pending Approval (tasks they created), Recently Completed.

**Department Queue**

- All jobs currently Queued or In Progress in the user's department, in queue order.
- Department Leads can drag to reorder this queue (overrides automatic priority insertion).
- Each job row: job code, name, stage status, task completion (3/5 tasks), waiting-since time.

> This satisfies the requirement that everyone can SEE everything (S02) while each user and department works from a focused list of their own (S17).

### S18 — Labor Reports & Export

- Filters: date range, project, job, department, user.
- Summary table: total hours by project/job/user/department (groupable).
- Estimated vs actual hours comparison per job.
- "Export CSV" button: downloads the filtered labor log as a CSV (Excel-compatible) — see Section 15 for column layout.
- Access: Admin sees everything; Leads see their own department; Staff see only their own history (via S12).

---

## 8. QR Code System & Clock-In Flow

### QR Code Levels

| Level | URL pattern | Opens |
|---|---|---|
| Project | `https://app.yourcompany.com/p/[PROJECT_UUID]` | Project Detail (S05) |
| Job | `https://app.yourcompany.com/j/[JOB_UUID]` | Job Detail (S05a) or clock-in |
| Component | `https://app.yourcompany.com/j/[JOB_UUID]/m/[COMPONENT_ID]` | Materials entry (S09) |

Phone cameras scanning these QR codes open the app directly to the right place. In practice, JOB-level QR codes are what gets stickered to components — they identify both the work order and the specific item (AM1234-B) at a glance.

### Thermal Label Printing

The team will purchase a thermal label printer. Recommended setup:

| Item | Recommendation | Notes |
|---|---|---|
| Printer | Zebra ZD421 (~$300) or Dymo LabelWriter 550 Turbo (~$120) | Zebra is the shop-floor workhorse: faster, tougher, takes wider media. Dymo is cheaper and fine for office printing. |
| Label size | 2.25" × 1.25" thermal labels | Fits QR (minimum 0.8"/2cm for reliable phone scanning) + job code + name |
| Label content | QR code, job code (large bold text), job name, client | Job code must be readable without scanning |
| Adhesive | Removable adhesive labels for finished surfaces; permanent for raw stock | Avoid permanent adhesive on finished furniture |

- The app generates a print-ready PDF sized to the configured label dimensions (label size is set once in Admin Settings).
- Printing goes through the device/computer's standard print dialog to the thermal printer. Batch printing: from a project, print labels for all jobs at once.

> Direct-to-printer integration (bypassing the print dialog) is possible later via Zebra Browser Print, but the PDF route works with any printer from day one.

### Clock-In Flow — Step by Step

| Step | Action | System Response |
|---|---|---|
| 1 | User taps floating QR button | Camera opens with scan overlay |
| 2 | User scans the job QR on a component tag | Job UUID extracted, job looked up |
| 3a | User has NO active task | S05a opens with clock-in prompts on their available tasks |
| 3b | User's ACTIVE task is on this job | S06 for that task — clock out or continue |
| 3c | User's ACTIVE task is elsewhere | S08 warning — one-tap clock-out offered, then proceed |
| 4 | User selects task, taps Clock In | Timestamp recorded, active_task set, task → In Progress, stage → In Progress |
| 5 | User taps Clock Out when done | Duration calculated, labor_log closed, totals updated on task, job, project |

### One-Active-Task Enforcement

- `users.active_task_id` (nullable FK) — set on clock-in, cleared on clock-out.
- Clock-in is blocked everywhere while it is set (except the active task itself).
- Auto clock-out safety net: any session open longer than 12 hours is automatically closed at the 12-hour mark and flagged for Admin review (`admin_override = true`, flag note "auto-closed"). Prevents phantom 30-hour entries when someone forgets to clock out or a phone dies.
- Admin and the user's Lead can manually clock out any user in their scope.

---

## 9. Task Management Rules

### Task Creation & Approval

Anyone can create a task, but staff-created tasks require approval before becoming active:

| Creator | Approval needed? | Approver |
|---|---|---|
| Admin | No — active immediately | — |
| Lead | No — active immediately, within their own department; other departments' tasks need Admin approval | Admin (cross-department only) |
| Staff | Yes — task enters "Pending Approval" | Admin, or the Lead of the task's department |

- Pending tasks are visible (grayed) on the job's task list and on the creator's My Work tab.
- The approver gets an in-app notification with one-tap Approve/Reject; rejection requires a short note.
- Approved tasks become Unstarted and clockable. Rejected tasks are archived with the note visible to the creator.

### Task Assignment

- Tasks belong to a job and a stage (department). Assignment to a specific user is optional — unassigned tasks can be picked up by any department member.
- Admin/Lead can reassign anytime; blocked while someone is clocked in.

### Task Status Lifecycle

| Status | Trigger |
|---|---|
| Pending Approval | Created by Staff (or by Lead outside their department) |
| Unstarted | Created by Admin/Lead, or approved |
| In Progress | User clocks in |
| Paused | User clocks out without completing |
| Completed | User, Lead, or Admin marks complete |
| Cancelled | Admin cancels — labor hours preserved |

### Stage & Project Completion

- All tasks in a stage Completed → prompt to submit the stage for inspection (Section 4).
- Final stage of a job approved → job Complete.
- All jobs Complete → prompt Admin to mark project Complete.

---

## 10. Database Schema

Supabase (PostgreSQL) data model. All tables include `created_at` and `updated_at` timestamps.

### users

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| email | Text | UNIQUE, NOT NULL | Login |
| full_name | Text | NOT NULL | |
| phone | Text | Nullable | |
| avatar_url | Text | Nullable | |
| department_id | UUID | FK → departments | |
| role | Enum | default 'staff' | 'admin', 'lead', 'staff' |
| language | Enum | default 'en' | 'en', 'ru', 'es' |
| active_task_id | UUID | FK → tasks, Nullable | Null if not clocked in |
| is_active | Boolean | default true | |

### departments

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| name | Text | NOT NULL | |
| lead_user_id | UUID | FK → users, Nullable | The department Lead |
| default_routing_position | Integer | Nullable | Position in default stage routing; null = not in default routing |
| is_archived | Boolean | default false | |

### projects

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| name | Text | NOT NULL | |
| client_name | Text | NOT NULL | |
| work_order_number | Text | UNIQUE, Nullable | e.g. AM1234, from Estimate Rocket |
| estimate_rocket_id | Text | Nullable | External ID for sync |
| description | Text | Nullable | |
| status | Enum | default 'estimate' | See S02 |
| priority_rank | Integer | Nullable | Lower = higher priority; drives queue insertion |
| scheduled_start | Date | Nullable | |
| scheduled_end | Date | Nullable | |
| qr_code_uuid | UUID | UNIQUE, NOT NULL | |
| thumbnail_url | Text | Nullable | |
| total_labor_minutes | Integer | default 0 | Denormalized sum |

### jobs *(new in v2.0)*

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| project_id | UUID | FK → projects, NOT NULL | |
| job_code | Text | UNIQUE, NOT NULL | AM1234-A; equals WO number for single-item orders |
| suffix | Text | Nullable | 'A', 'B', ... 'AA'; null for single-item |
| name | Text | NOT NULL | e.g. "Walnut bar top, 14ft" |
| description | Text | Nullable | From work order line item |
| status | Enum | default 'queued' | 'queued', 'in_production', 'complete', 'cancelled' |
| current_stage_id | UUID | FK → job_stages, Nullable | The stage the job is in now |
| queue_position | Integer | Nullable | Position within current department's queue |
| qr_code_uuid | UUID | UNIQUE, NOT NULL | |
| total_labor_minutes | Integer | default 0 | |

### job_stages *(new in v2.0)*

One row per stage in a job's routing. Created when the job is created, from the routing template (customizable per job).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| job_id | UUID | FK → jobs, NOT NULL | |
| department_id | UUID | FK → departments, NOT NULL | |
| sequence | Integer | NOT NULL | 1, 2, 3... order within the routing |
| status | Enum | default 'upcoming' | 'upcoming', 'queued', 'in_progress', 'pending_inspection', 'approved', 'rejected' |
| submitted_by | UUID | FK → users, Nullable | Who submitted for inspection |
| submitted_at | Timestamptz | Nullable | |
| entered_at | Timestamptz | Nullable | When the job arrived at this stage |
| approved_at | Timestamptz | Nullable | |

### inspections *(new in v2.0)*

Permanent record of every inspection decision. A rejected-then-approved stage has two rows.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| job_stage_id | UUID | FK → job_stages, NOT NULL | |
| inspector_id | UUID | FK → users, NOT NULL | |
| decision | Enum | NOT NULL | 'approved' or 'rejected' |
| note_id | UUID | FK → notes, Nullable | Required for rejections (translated note) |
| decided_at | Timestamptz | NOT NULL | |

### tasks

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| job_id | UUID | FK → jobs, NOT NULL | Tasks belong to jobs (changed in v2.0) |
| job_stage_id | UUID | FK → job_stages, NOT NULL | Which stage this task is part of |
| name | Text | NOT NULL | |
| assigned_user_id | UUID | FK → users, Nullable | Null = any dept member |
| status | Enum | default 'unstarted' | Adds 'pending_approval' (v2.0) |
| created_by | UUID | FK → users, NOT NULL | For the approval workflow |
| approved_by | UUID | FK → users, Nullable | |
| estimated_hours | Numeric | Nullable | |
| actual_minutes | Integer | default 0 | |
| due_date | Date | Nullable | |
| instructions | Text | Nullable | |

### labor_logs

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users, NOT NULL | |
| task_id | UUID | FK → tasks, NOT NULL | |
| job_id | UUID | FK → jobs, NOT NULL | Denormalized (v2.0) |
| project_id | UUID | FK → projects, NOT NULL | Denormalized |
| clocked_in_at | Timestamptz | NOT NULL | |
| clocked_out_at | Timestamptz | Nullable | Null = active |
| duration_minutes | Integer | Nullable | |
| admin_override | Boolean | default false | Manual or auto-12h clock-out |

### notes

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| project_id | UUID | FK → projects, NOT NULL | |
| job_id | UUID | FK → jobs, Nullable | If job-level note |
| task_id | UUID | FK → tasks, Nullable | If task-level note |
| author_id | UUID | FK → users, NOT NULL | |
| original_text | Text | NOT NULL | |
| original_language | Enum | NOT NULL | |
| en_text / ru_text / es_text | Text | Nullable | Translations |
| translation_status | Enum | default 'pending' | 'pending', 'done', 'failed' |

### materials

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| job_id | UUID | FK → jobs, NOT NULL | Materials belong to jobs (v2.0) |
| name | Text | NOT NULL | |
| description | Text | Nullable | |
| quantity | Numeric | NOT NULL | |
| unit | Text | Nullable | |
| supplier | Text | Nullable | |
| is_ordered / ordered_at | Bool / Timestamptz | | |
| is_arrived / arrived_at | Bool / Timestamptz | | |
| qr_code_uuid | UUID | UNIQUE, Nullable | Component-level tags |
| sheet_row_ref | Text | Nullable | Spreadsheet row anchor for two-way sync |
| sync_source | Enum | default 'app' | 'app' or 'sheet' — who last wrote this row |

### files

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| project_id | UUID | FK → projects, NOT NULL | |
| job_id | UUID | FK → jobs, Nullable | |
| inspection_id | UUID | FK → inspections, Nullable | Photos attached to an inspection |
| uploaded_by | UUID | FK → users, NOT NULL | |
| file_name | Text | NOT NULL | |
| file_type | Enum | NOT NULL | 'photo' or 'pdf' |
| storage_path | Text | NOT NULL | |
| file_size_bytes | Integer | NOT NULL | |
| thumbnail_path | Text | Nullable | |

### notifications

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users, NOT NULL | Recipient |
| type | Enum | NOT NULL | See Section 14 |
| title_en/ru/es, body_en/ru/es | Text | NOT NULL | Per-language |
| related_job_id | UUID | FK → jobs, Nullable | |
| related_task_id | UUID | FK → tasks, Nullable | |
| is_read | Boolean | default false | |
| sent_at | Timestamptz | NOT NULL | |

---

## 11. Estimate Rocket Integration

### Flow

- A work order is created or updated in Estimate Rocket.
- Estimate Rocket triggers a Zapier Zap ('New Work Order' / 'Work Order Updated').
- The Zap POSTs a JSON webhook to: `https://app.yourcompany.com/api/webhooks/estimate-rocket`
- The app validates the shared-secret header and creates/updates the project.

### Multi-Item Handling (v2.0)

- If the Zapier payload includes itemized line items, the app creates one job per line item with suffixes A, B, C... in line-item order.
- If the payload contains only a single description (Zapier triggers for Estimate Rocket vary in how much line-item detail they expose), the project is created with one job, and an Admin splits it into jobs from S05 Tab 2. Splitting takes under a minute: tap "Split Job", enter the item names, the app assigns suffixes.

> **Action item during build:** inspect the actual Zapier trigger payload from your Estimate Rocket account to see whether line items come through. This determines whether job-splitting is automatic or a quick manual step.

### Expected Payload

```json
{
  "work_order_number": "AM1234",
  "client_name": "Smith Residence",
  "description": "Custom kitchen — bar top, 6 tables, host stand",
  "line_items": [
    { "name": "Bar top" },
    { "name": "Dining table", "qty": 6 }
  ],
  "status": "approved",
  "estimate_rocket_id": "er_abc123"
}
```

### Update & Conflict Rules

- Matching `work_order_number` → update project fields (name, client, description).
- The app never regresses production state from an Estimate Rocket update: stages, jobs, and statuses beyond 'Estimate' are untouched.
- New work order → project created with status 'Estimate'; all Admins notified.
- Admins have a manual "Re-sync" button on S05.

---

## 12. Materials Tracking (Two-Way Sync)

### Overview

Each job has a materials list. Procurement and Admins manage it; anyone can update ordered/arrived status by scanning a component QR. The list syncs both ways with the team's Google Sheets materials spreadsheet.

### Two-Way Google Sheets Sync

Decision from v1.0 review: two-way sync is in scope for Phase 1. Design:

- Connection: a Supabase Edge Function uses the Google Sheets API with a service account that has edit access to the materials spreadsheet.
- **Sheet → App:** the function polls the sheet every 5 minutes (and on-demand via a "Sync Now" button). New/changed rows create or update material records. Each row is anchored by `sheet_row_ref`.
- **App → Sheet:** when a material is changed in the app (e.g. marked Arrived via QR scan), the Edge Function writes the change back to the matching sheet row within seconds.
- Conflict rule: most-recent change wins, and every sync writes a "Last updated by [App/Sheet] at [time]" value into a sync-status column on the sheet so conflicts are visible.
- Required sheet structure: one row per material with columns for job code, name, quantity, unit, supplier, ordered (checkbox), arrived (checkbox). A template sheet is provided during setup; existing spreadsheets are migrated to this column layout once.

> Excel files are supported as one-way import only (upload .xlsx → parse rows). True two-way sync requires the live Google Sheets API — a static .xlsx file has no change feed. If the team currently uses Excel, the recommendation is to move the materials sheet to Google Sheets.

### Status Updates via QR

- Scanning a component QR opens that material entry; user taps Mark as Ordered / Mark as Arrived; timestamps recorded; sheet updated.
- When all materials for a job are arrived, the job's department Lead and Admins are notified.

### Readiness Indicator

- Gray: no materials list. Red: not all arrived. Green: all arrived. Shown on project cards (S02) and job rows (S17).

---

## 13. File Attachments

| Type | Extensions | Max Size | Thumbnail |
|---|---|---|---|
| Photo | .jpg, .jpeg, .png, .heic, .webp | 50 MB | Auto, 300×300 |
| PDF | .pdf | 50 MB | Document icon |

- Private Supabase Storage bucket; access via signed URLs (1-hour expiry), gated by authentication.
- Paths: `/projects/[project_id]/[file_id].[ext]`; thumbnails under `/thumbs/`.
- Upload from camera, photo library, or file picker; direct-to-storage signed upload URLs.
- Files can attach at project level, job level, or to an inspection (defect photos).
- Viewer (S10): full-screen photos with pinch-zoom; PDFs via native viewer with pdf.js fallback; download and share buttons; delete with confirmation (own files or Admin).

---

## 14. Notifications

Decision from v1.0 review: **in-app notifications only.** No push notifications, no email. The notification inbox (S15) with its unread badge is the single channel; this also removes all iOS-version constraints.

### Notification Types

| Type | Trigger | Sent to |
|---|---|---|
| task_assigned | Task assigned to a user | Assigned user |
| task_assigned_dept | Task assigned to department only | Department members |
| task_approval_request | Staff creates a task | Admins + that department's Lead |
| task_approved / task_rejected | Approval decision on a created task | Task creator |
| stage_pending_inspection | Stage submitted for inspection | Eligible inspectors |
| stage_approved | Inspector approves a stage | Receiving department's Lead + members |
| stage_rejected | Inspector rejects a stage | Submitting department's Lead + users who worked the stage |
| job_arrived_in_queue | Job lands in a department queue | That department's Lead |
| task_due_soon / task_overdue | 24h before / after due date | Assigned user (+ Admin if overdue) |
| material_arrived_all | All materials for a job arrived | Job's department Lead + Admins |
| project_created | New work order from Estimate Rocket | Admins |
| note_added | Note added to a job/project | Users with tasks on that job |
| clock_in_long | Clocked in > 8 hours | That user + their Lead |

- All notification text is stored in three languages; each user sees their own.
- Badge counts appear on the Inspection tab (pending inspections) and the inbox bell (unread).

---

## 15. Labor Reports & CSV Export

Decision from v1.0 review: labor reporting with CSV/Excel export is in scope.

### Report Screen (S18)

- Filters: date range, project, job, department, user, task status.
- Groupable summary: hours by project, by job, by user, by department.
- Per-job estimated vs actual hours with variance highlighting (over-estimate rows flagged amber).

### CSV Export Columns

| Column | Example |
|---|---|
| date | 2026-06-10 |
| work_order | AM1234 |
| job_code | AM1234-B |
| job_name | Dining table (walnut) |
| department | Fabrication |
| task | CNC leg profiles |
| user | Sergei Volkov |
| clock_in | 07:42 |
| clock_out | 11:15 |
| duration_minutes | 213 |
| flagged | FALSE (TRUE if admin_override / auto clock-out) |

- Export respects the active filters — export exactly what is on screen.
- File is UTF-8 CSV with BOM so Cyrillic names open correctly in Excel.
- Access: Admin exports anything; Leads export their own department; Staff have no export (own history viewable in S12).

---

## 16. Tech Stack & Infrastructure

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React (Vite) | Single codebase for phone and desktop |
| Delivery | Progressive Web App (PWA) | Installable on phones; runs in any desktop browser; offline read cache |
| Styling | Tailwind CSS | Mobile-first responsive; sidebar layout on desktop |
| Backend / DB | Supabase (PostgreSQL) | Database, auth, real-time, storage, edge functions |
| Auth | Supabase Auth | Email/password, JWT sessions, RLS |
| Real-time | Supabase Realtime | Live queues, inspection badge counts, clock events |
| Storage | Supabase Storage | Photos and PDFs |
| Translation | DeepL API | Notes across EN/RU/ES |
| QR generate | `qrcode` (npm) | Labels and on-screen codes |
| QR scan | `html5-qrcode` (npm) | Camera scanning in browser |
| Label PDFs | `jsPDF` (npm) | Thermal-label-sized PDF generation |
| Work orders | Zapier + Webhooks | Estimate Rocket pipeline |
| Sheets sync | Google Sheets API (service account) | Two-way materials sync via Edge Function |
| Hosting | Vercel or Netlify | CDN, free tier sufficient |
| Images | Sharp (Edge Function) | Thumbnails on upload |

### Offline Behavior

Decision from v1.0 review: ideally offline, desktop fallback acceptable. The implementation plan:

- **Phase 1: offline READ** — the PWA service worker caches the user's My Work list, their department queue, and recently viewed jobs, so spotty shop WiFi never blocks looking up a job. Desktop browsers on wired shop computers provide the always-connected fallback.
- **Phase 1: clock-out resilience** — if connectivity drops while clocked in, the clock-out action is stored locally and synced when the connection returns; the timestamp used is when the user tapped, not when sync happened.
- **Phase 2 (optional): full offline WRITE** (notes, status changes queued offline). Adds significant complexity; only build if Phase 1 proves insufficient in practice.

### Cost

- Supabase Pro $25/mo (recommended for backups) + DeepL ~$7/mo + hosting free tier = roughly $35–50/month total. No servers to maintain.

---

## 17. Security & Permissions

### Authentication

- All routes protected; Supabase Auth JWT sessions; tokens in httpOnly cookies; 8-character password minimum.

### Row-Level Security Matrix

| Table | Read | Write |
|---|---|---|
| projects / jobs | All authenticated | Admin (Leads: queue_position in own dept) |
| job_stages | All authenticated | System + Admin; submit-for-inspection: Lead/Admin |
| inspections | All authenticated | Eligible inspectors only (enforced in policy: admin role, or lead of the submitting department, and not the submitter) |
| tasks | All authenticated | Create: anyone (status forced to pending_approval for staff); approve: Admin / dept Lead; status updates: assigned user |
| labor_logs | Own + dept Lead + Admin | System clock in/out; override: Admin/Lead |
| notes | All authenticated | Create: anyone; delete: own + Admin |
| files | All authenticated | Upload: anyone; delete: own + Admin |
| materials | All authenticated | Procurement + Admin (status flags: anyone via QR) |
| users | Own + Admin | Own profile fields; role/dept: Admin |
| notifications | Own only | System only |

### Webhook & Sync Security

- Estimate Rocket webhook validates `X-Webhook-Secret` header; 401 otherwise; secret in environment variables.
- Google Sheets service account credentials stored as Supabase secrets, never client-side.
- File URLs signed, 1-hour expiry.

---

## 18. Decision Log (Resolved Questions)

The open questions from v1.0, with the decisions now baked into this spec:

| # | Question | Decision | Where in spec |
|---|---|---|---|
| 1 | Project visibility | All staff see all projects; every user/department also gets a focused "My Work / Department Queue" view | S17, Section 7 |
| 2 | Offline mode | Offline read + clock-out resilience in Phase 1; desktop browser access as the wired fallback; full offline write deferred to Phase 2 | Section 16 |
| 3 | Estimate Rocket plan | Zapier option confirmed available; verify line-item payload detail during build | Section 11 |
| 4 | Email notifications | No — in-app only | Section 14 |
| 5 | Task creation | Anyone can create; staff-created tasks require Admin or department Lead approval before becoming active | Section 9 |
| 6 | Labor reports | Yes — report screen with CSV/Excel export | Section 15, S18 |
| 7 | Spreadsheet sync | Two-way Google Sheets sync in Phase 1; Excel import-only | Section 12 |
| 8 | Label printer | Thermal printer to be purchased — Zebra ZD421 or Dymo 550 Turbo recommended; 2.25×1.25" labels | Section 8 |
| 9 | iOS baseline | Moot — in-app notifications only, no iOS push constraints | Section 14 |
| 10 | Spanish app name | No — single app name | — |
| 11 | Inspectors | Any Admin, plus department Leads for their own department's outgoing work; submitter cannot self-inspect unless Admin | Section 4 |
| 12 | Multi-item work orders | One job per line item with job codes AM1234-A, -B, ...; auto-split when payload itemizes, one-minute manual split otherwise | Section 3 |
| 13 | Stage workflow | Pending Inspection queue with approve/reject; approval auto-hands the job to the next department's queue ordered by project priority | Section 4, S16 |

---

## 19. Remaining Open Items

Smaller items to resolve during the build — none block starting development:

| # | Item | Notes |
|---|---|---|
| 1 | Estimate Rocket payload shape | Inspect the real Zapier trigger data: does it itemize line items? Determines auto vs manual job splitting (Section 11). |
| 2 | Materials sheet migration | Current spreadsheets need to be reshaped once into the sync template column layout (Section 12). |
| 3 | Default routing per job type | Optional refinement: routing templates per product category (e.g. "refinish-only" skips Design/Fabrication) instead of editing per job. |
| 4 | Who is each department's Lead? | Assign in S14 at setup; affects inspection rights and approvals. |
| 5 | Label size confirmation | Buy the printer first, confirm the exact label stock, then set dimensions in Admin Settings. |
| 6 | Inspection SLA | Optional: alert Admins if a job sits in Pending Inspection more than N hours. Easy to add later. |

---

*End of Specification — Production Manager v2.0 · June 2026*
