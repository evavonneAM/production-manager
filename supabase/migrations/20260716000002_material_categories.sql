-- Sprint 9b — two more material categories to match the shop's real workflows
-- (owner request): foam and hardware/supplies. COM stays a distinct value but
-- is entered via the Fabric button's "customer's own material" checkbox.
alter type material_category add value if not exists 'foam';
alter type material_category add value if not exists 'hardware';
