# Decisions — Production Manager

The owner's decisions and standing rules, in one place. Newest first. When a rule changes,
add a new row and strike the old one; never keep a second copy elsewhere. The build order is
in [`BUILD_PLAN.md`](../BUILD_PLAN.md).

## Rules log

| Date | Rule |
| --- | --- |
| 2026-10-24 | Fabric is its own estimate line per fabric, yards summed from every item using it (each item rounded up on its own; typed override allowed). Price/yd = wholesale × 2, minimum $75. COM shows yards needed, no charge. Not chosen = "to be determined (not included)". |
| 2026-10-24 | Purchase list shows pooled yards (one roll, rounded once) as a suggestion beside the estimate's yards; the buyer picks or types their own. |
| 2026-10-24 | Estimates show "Estimated deposit: 50% to secure the job" (editable per estimate). Changes after Sent make a revised copy (e.g. HOV10001-R1). |
| 2026-10-24 | Window treatments: lining inside the drapery price; hardware own line at cost × 2; install $95 per shade, drapery ½ day $800 or full day $1,600. |
| 2026-10-24 | Board-mounted cushions: Velcro $5 per linear foot of the cushion's length, rounded up to the next foot. |
| 2026-10-24 | Estimates can be grouped by room or window (optional, just named). Each group holds its own fabric and subtotal; the client approves room by room, only approved rooms become jobs and fabric orders, and the deposit is 50% of approved rooms. |
| 2026-10-24 | Estimates have an "Install at" address separate from the client's (designer billed, install at the client's home). |
| 2026-10-27 | Pillows: $125 labor per pillow, any size; welting +$10; contrast flange +$30 (self flange free); inserts priced by the formulas on the PILLOW INSERT PRICING tab, unchanged (round 50/50 stays dia × 13). |
| 2026-10-27 | Client estimate look: white "Restoration Hardware" style (Gallery look with Catalog header), left-justified room titles, fabric in the Qty/Each columns, one font for all dollar amounts. See docs/estimate-items-plan.md. |
| 2026-10-23 | A client is a company (designer firm, business or household) with people under it. The client page shows all of the company's projects from every person. |
| 2026-10-23 | One person who works for several companies gets one client card per company plus a personal card (each with that role's email and address). When unsure, keep cards separate; merging later is easy. |
| 2026-10-23 | One estimate number shared by AM / HOV / RHU (no AM10001 and HOV10001 both). |
| 2026-10-23 | One plan only: `BUILD_PLAN.md` in this repo. Decisions here. No plans in side copies of the repo. |
| 2026-10-23 | QuickBooks is not used (since April 2026). Revenue for AM / HOV / RHU is tracked in the app. |
| 2026-10-23 | Finished jobs and projects stay in the app for reference; hide them from active lists, never delete. |
| 2026-10-23 | Cushion prices come from the Google Sheet "CUSHION PRICING + YARDAGE". Clean seam cover = W × $6, in every tool. |
| 2026-10-19 | Team members see only Tools and Profile; testers see every page. Unfinished pages are hidden, not locked. |
| 2026-10-16 | Stay on Vercel at production-manager-henna.vercel.app. |
| 2026-10-16 | Shop cuts cording / welting only on the bias. Cover = ordered size minus ¼" on width and depth. |
| 2026-10-16 | Pattern matching: 1" lost per seam joint (cutting offset). Fronts and sides align from the floor up; seat tops and inside backs center the motif. |
| 2026-10-16 | Example furniture in drawings uses real Restoration Hardware catalog sizes. |
| 2026-10-15 | Prices may be stored in the app, Admins only (replaces the 2026-07-27 "no prices anywhere" rule). `er_line_items` stays price-free. |
| 2026-10-13 | Pricing tools (Cushion Pricing, Upholstery Estimate, Work Order Builder) are Admins only. |
| 2026-10-13 | Drapery Pleat layout widths round to the NEAREST ⅛" (exception to the next rule). |
| 2026-10-09 | Cut sizes always round UP to the next ⅛", never down. Fabric yardage rounds up to whole yards per item, then × quantity. |
| 2026-10-09 | Cushion Cut height deduction is picked per cushion (¼, ½ default, 1, 1½). |
| 2026-10-08 | Design system: Ant Design (`antd`). |

## The 2026-10-15 architecture memo (answered 2026-10-23)

*Decision memo for Eva, 2026-10-15. Short on purpose: six decisions, options for each, my recommendation in bold. Once you pick, the next document is the data model and a phased plan, and BUILD_PLAN.md / CLAUDE.md / the tools index get updated to match.*

### Where things stood (checked in the code and the Sheet)

- **Production Manager** (Supabase + React, Vercel) runs the shop: projects → jobs → stages, tasks, labor, materials, files. Projects arrive from Estimate Rocket through Zapier (`er-intake`), with line items read off the ER proposal page into `er_line_items` (no prices).
- **Estimates in the app** (branch `estimates`, worktree `production-manager-estimates`): `clients`, `estimate_counters`, `estimates`, `estimate_lines` — Admin-only, with prices. The migration is **already applied to the live database**, but the branch is **not merged to `main`**, so the code on `main` doesn't know those tables exist. That mismatch should be closed one way or the other before anything else (decision 6).
- **Pricing tools** today: Upholstery Estimate and Cushion Pricing (in the app, "Add to estimate" sends lines into an estimate); Work Order Builder (my Ant Design build, drapery / roman / top treatments, roller parked; produces Estimate Rocket lines, a markdown work order and a price from the Horizons-based house price book — React package in `~/Developer/work-order-builder`, not yet in the app); drapery pleat, ripplefold, cushion cut, leaf bag calculators (no prices).
- **Price books live in code**: upholstery `TYPES`/upcharges in `calculators/upholstery.ts`, cushion pricing in `cushionPricing.ts`, the window price book in the Work Order Builder's `logic.js`/`roman.js`/`top.js`. The upholstery History check is 1,300 past ER prices **hard-coded** in `upholsteryHistory.ts`.
- **Job Database sheet** (Oct 12–14): 378 job codes linking QuickBooks estimates (HOV Creative Lab, 2025→), Drive work orders and Gmail threads; plus **all 3,801 Estimate Rocket projects and 12,337 line items** from the three accounts (2023→), $5.9M invoiced. 100 jobs flagged for review, none confirmed yet. This is the richest pricing history you have, and right now it lives only in a spreadsheet.
- Three stores (AM / HOV / RHU). *(Correction 2026-10-23: QuickBooks is no longer used, since April 2026.)*

### Decision 1 — What is the system of record?

| | Option | Trade-off |
|---|---|---|
| A | **The Google Sheet** stays the master; the app reads from it | Easy to eyeball and edit; no RLS, no relations, formulas drift, two-way sync already needed babysitting (Sprint 9). |
| B | **Supabase (the Production Manager database)** is the master; the Sheet becomes a read-only report the app exports | One home for clients, estimates, jobs, prices and history; RLS protects prices; every tool writes to the same place. Costs a one-time import and a reporting view. |
| C | Split: Supabase for live work, Sheet for history | Avoids the import, but the History check and "what did we charge last time" stay outside the app forever. |

**Recommendation: B.** The app already owns projects, jobs and now estimates. Import the Sheet's history once (decision 4), keep `sheets-sync` as an export, and stop editing the Sheet by hand.

**Owner's pick (2026-10-23): B.** The app's database is the master copy.

### Decision 2 — What is Estimate Rocket's role from here?

| | Option | Trade-off |
|---|---|---|
| A | Keep ER as the estimating and invoicing system; the app only intakes work orders | No switch-over; three ER subscriptions continue; prices and clients keep living outside the app; every estimate is retyped from the tools. |
| B | **Retire ER on a date.** Estimates, acceptance → project, invoices and payments all in the app (the five-step plan in `brand-logos/estimates-in-app.md`) | Step 1 is live in the database already. Needs: accepted-estimate → project, invoices/payments, client PDF — roughly three sprints. ER intake stays on during the overlap. |
| C | Hybrid for good: price in the app, paste lines into ER, ER sends the work order back | Least build, but the ER "line item text" output stays the integration forever and ER's line items still arrive without prices. |

**Recommendation: B**, with C as the bridge until B's steps 2–3 ship (the Work Order Builder already produces ER-formatted lines for exactly that). *(The QuickBooks sub-decision is moot: QuickBooks was dropped in April 2026.)*

**Owner's pick (2026-10-23): B, with C as the bridge.** No QuickBooks: the businesses stopped using it in April 2026, so revenue for all three businesses is tracked in the app.

### Decision 3 — What does each tool write, and where?

| | Option | Trade-off |
|---|---|---|
| A | Tools write **estimate lines only** (name, qty, unit price, description text) | Already works for upholstery and cushions. But the work order detail (widths, fullness, lining, yardage) survives only as prose in the description — can't be re-opened, re-priced or turned into a cut sheet. |
| B | Tools write estimate lines **plus a structured spec** (`estimate_lines.spec jsonb`, with `tool`, `tool_version`, `price_book_version`) | Any line can be re-opened in its tool, re-priced when the price book changes, and turned into the job's work order / cut sheet when the estimate is accepted. Small schema change, no new tables. |
| C | A separate `window_specs` / `piece_specs` table per product family | Cleanest for reporting, but a table per product type grows fast (drapery, roman, top, roller, cushion, upholstery…). |

**Recommendation: B.** One rule for every tool: *a tool never saves a price without the inputs that produced it.* Concretely — Work Order Builder → lines + spec + markdown work order; Upholstery Estimate → lines + piece spec; Cushion Pricing → lines + cushion spec; the no-price calculators (pleat, ripplefold, cushion cut, leaf bag) → attach their cut sheet to the **job** (`files`/`notes`), never to an estimate.

**Owner's pick (2026-10-23): B.**

### Decision 4 — Where do price books and history live?

| | Option | Trade-off |
|---|---|---|
| A | **Price books stay in code** (TS/JS constants), versioned by git | Zero build; Claude Code edits them with you. Changing a price means a deploy; no audit trail of "what was the price in March". |
| B | `price_books` table, Admin-editable in the app | Prices change without a deploy; every line records which version priced it. Needs an editor screen and migration of three price books. |
| C | **Code now, table later** — but every line stores `price_book_version` from day one | Nothing to build today; the version stamp makes the later move painless. |

**Recommendation: C.** Separately, **history goes into Supabase now**: import the Sheet's ER Projects / ER Lines / QuickBooks Estimate Lines / Invoices into read-only `history_*` tables (Admin-only RLS). Then the upholstery History check queries the database instead of a 1,300-row constant, and the same check becomes available for drapery, romans and cushions.

**Owner's pick (2026-10-23): C**, and the price history moves into the database now (Admins only).

### Decision 5 — How is the inbox / work-order pull used?

The Sheet's Jobs tab links QB estimates to Drive work orders and Gmail threads, with 100 rows needing review. Options: **A** finish the review in the Sheet, then import once (my recommendation — the review UI already exists there and it's a one-time clean-up); **B** import as-is and review inside the app (needs a review screen first); **C** import only the ER data and drop the QB/Drive/Gmail linkage.

**Owner's pick (2026-10-23): A.**

### Decision 6 — Repo, branches and docs

- **Merge `estimates` to `main` first** (after a quick review), so `main` matches the live database. Keep feature branches short from here.
- **BUILD_PLAN.md:** add Sprint 15 "Estimates & pricing platform" with sub-sprints that follow the decisions above (15a merge + spec column + Work Order Builder into the app at `/tools/work-order`; 15b history import + History check from the DB; 15c accepted estimate → project; 15d invoices & payments; 15e revenue by store). Sprint 14 (offline/polish) stays, lower priority.
- **CLAUDE.md:** add the three new house rules — Supabase is the system of record; prices exist in the app but are Admin-only (the July rule is superseded); a tool never saves a price without its inputs. Add the Work Order Builder's house rules (one price for everyone; 1" per width spring-back; roman +8"; install $200/hr 3-hr min or $95/window).
- **Tools index (`src/lib/tools.tsx`):** add `workOrder` (group `drapery`, `adminOnly`, route `/tools/work-order`); later retire the external ripplefold/drapery URLs once the Builder covers them.
- **SPEC.md §17 (RLS):** add the estimates, history and price-book tables to the matrix.

**Owner's pick (2026-10-23): merge `estimates`** (hidden from staff). The BUILD_PLAN / CLAUDE.md items above were done in the one-plan clean-up of 2026-10-23, in the shape described in BUILD_PLAN.md.

### What was asked

Reply with your pick for each of the six (A/B/C, or "your default"), plus the HOV/QuickBooks sub-decision in 2. Then I'll write the data model (tables, columns, RLS) and the phased plan, and prepare the BUILD_PLAN / CLAUDE.md / tools-index edits as a Claude Code brief.
