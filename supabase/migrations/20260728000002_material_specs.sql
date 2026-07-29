-- Owner's materials-form sketches (2026-07-28): each category gets structured
-- fields (direction, insert type/blend, foam type, dimensions, custom-order,
-- vendor lists). Stored raw in `specs` so edit forms can refill; the visible
-- description is composed from them at save time (sheet sync unchanged).
alter table materials add column specs jsonb;
alter table materials add column product_url text; -- hardware "Link to product"
