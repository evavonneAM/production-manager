-- Owner requirement (2026-07-27): no prices anywhere in the production app.
-- Drop the money columns from line-item suggestions — the app never needs
-- them, and not storing them is the strongest guarantee they can't leak.
alter table er_line_items drop column unit_price;
alter table er_line_items drop column total;
