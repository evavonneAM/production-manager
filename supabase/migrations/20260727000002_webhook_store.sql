-- Each store has its own Estimate Rocket account; its Zap tags the store in
-- the webhook URL (?store=AM|HOV|RHU) so job codes get the right prefix.
alter table webhook_events add column store text check (store in ('AM', 'HOV', 'RHU'));
