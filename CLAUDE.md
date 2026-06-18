# CLAUDE.md — Production Manager

This file gives you (Claude Code) the standing context for this project. Read it at the
start of every session. The authoritative product spec lives in `SPEC.md` in this folder —
when this file and the spec disagree, the spec wins, and you should ask me before deviating
from either.

---

## What we are building

**Production Manager** — a phone-first Progressive Web App (PWA) for a furniture production
business. Staff across departments manage projects, track a multi-stage production pipeline,
log labor by scanning QR codes, and communicate across three languages (English, Russian,
Spanish). It must also work on desktop browsers (shop computers).

Full detail is in `SPEC.md` (v2.0). Key concepts you must internalize:

- **Project** = a work order from Estimate Rocket (e.g. `AM1234`). A container.
- **Job** = one line item within a work order (e.g. `AM1234-A`, `AM1234-B`). The unit of
  production tracking. Each job has its own QR code, tasks, materials, stage routing, and
  labor total. Single-item orders use the bare work-order number with no suffix.
- **Stage** = one department's leg of a job's journey. Jobs flow through an ordered routing:
  Design → Procurement → Fabrication → Finishing → Installation (editable).
- **Inspection** = when a department finishes a stage, the job goes to a Pending Inspection
  queue. An eligible inspector approves or rejects. Approval auto-hands the job to the next
  department's queue, ordered by project priority. Rejection returns it with a note.
- **Task** = a unit of work inside a stage that users clock into. One active task per user.

---

## Tech stack (do not substitute without asking)

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Delivery | PWA (installable, offline read cache, service worker) |
| Styling | Tailwind CSS |
| Backend / DB / Auth / Storage | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| Translation | DeepL API |
| QR generation | `qrcode` npm package |
| QR scanning | `html5-qrcode` npm package |
| Label PDFs | `jsPDF` |
| Work order intake | Zapier webhook → Supabase Edge Function |
| Materials sync | Google Sheets API (two-way) via Edge Function |
| Hosting | Vercel or Netlify |
| Image thumbnails | Sharp (Edge Function) |

Languages supported in UI and notes: **en, ru, es**. The app must be fully usable at 390px
width and on desktop.

---

## How I want you to work

1. **Plan before building.** For any non-trivial feature, propose a short plan and wait for
   my go-ahead before writing code. Use Plan Mode for anything touching the schema or the
   workflow engine.
2. **Work in small, reviewable chunks.** One sprint task at a time (see `BUILD_PLAN.md`).
   After each chunk: summarize what changed, how to test it, and stop for my review.
3. **Commit to git after every working chunk.** Use clear messages. Never proceed to the
   next task with uncommitted working code. If something breaks, we roll back.
4. **Explain like I am not a developer.** I own the product, not the codebase. When you ask
   me to decide something, give me the plain-language tradeoff, not just the technical term.
5. **Never hardcode secrets.** All keys (Supabase, DeepL, Zapier secret, Google service
   account) go in environment variables / Supabase secrets. `.env` is git-ignored.
6. **Test on phone early.** Remind me to test new screens on an actual phone over the local
   network, not just the desktop preview.
7. **Ask, don't assume.** If a spec detail is ambiguous (e.g. exact Estimate Rocket payload
   shape), flag it and ask rather than inventing a requirement.

---

## Architectural rules that are easy to get wrong

- **Jobs, not projects, are the production unit.** Tasks, materials, labor logs, and QR
  clock-ins all attach to a **job**. Projects only aggregate. Do not attach tasks directly
  to projects.
- **One active task per user.** Enforced via `users.active_task_id`. Clock-in is blocked
  everywhere while it is set. Auto clock-out any session open longer than 12 hours and flag
  it (`admin_override = true`).
- **Inspector cannot self-inspect** unless they are an Admin. Enforce in the RLS policy, not
  just the UI. Admins inspect anything; Leads inspect only their own department's outgoing
  stages.
- **Approval triggers automatic hand-off.** On approve: advance the job's stage, set the new
  stage to Queued, insert into the receiving department's queue ordered by the project's
  `priority_rank`, notify that department. This is the core workflow engine — get it right
  and well-tested.
- **Notes store all three languages.** On save, call DeepL for en/ru/es, store all three plus
  the original. Each user reads their own language. Rejection notes use the same pipeline.
- **Notifications are in-app only.** No push, no email. Store title/body per language.
- **Translations and sync go through Edge Functions**, never from the client with secrets
  exposed.
- **Row-Level Security is the real boundary.** The frontend is not trusted. Every table needs
  RLS policies matching the matrix in SPEC.md Section 17.

---

## Roles

- **Admin** — full control; inspects any stage; approves any task; manages users/departments.
- **Lead** — staff abilities + inspects own department's outgoing work, reorders own queue,
  approves staff-created tasks in own department.
- **Staff** — sees everything (read), works from a focused "My Work" list, can create tasks
  but they need approval before becoming active.

---

## Definition of done (per feature)

- Works on phone (390px) and desktop.
- RLS policies written and tested for any new table.
- UI strings added to all three i18n locale files (en/ru/es).
- No secrets in code; env vars documented in `.env.example`.
- Committed to git with a clear message.
- I have been told how to test it.

---

## Things NOT in Phase 1 (don't build yet)

- Full offline *write* (offline read + clock-out resilience only).
- Direct-to-printer integration (generate label PDFs through the print dialog instead).
- Email/push notifications.
- Excel two-way sync (Google Sheets only; Excel is import-only).
