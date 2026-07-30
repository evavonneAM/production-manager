-- Line items are now reconciled on every event (edits inside a proposal must
-- flow in) — positions shift during reconciliation, so the once-only insert
-- key has to go. Idempotency now lives in the name-matching sync logic.
alter table er_line_items drop constraint er_line_items_proposal_id_position_key;
create index idx_er_line_items_proposal on er_line_items (proposal_id);
