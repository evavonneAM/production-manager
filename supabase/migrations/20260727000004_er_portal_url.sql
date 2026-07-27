-- Sprint 12 — link each imported project to its Estimate Rocket customer
-- portal (the live work-order document with line items; owner request
-- 2026-07-27). Built by er-intake from the payload's portal token.
alter table projects add column er_portal_url text;
