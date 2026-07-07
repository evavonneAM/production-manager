-- Sprint 7 — translation storage for work-description fields.
-- Each column holds { "en": "...", "ru": "...", "es": "..." }; null means not yet
-- translated (the UI falls back to the original canonical value). The DeepL Edge
-- Function fills these. Notes already carry en/ru/es text + translation_status.

alter table jobs      add column name_i18n        jsonb;
alter table jobs      add column description_i18n jsonb;
alter table projects  add column description_i18n jsonb;
alter table materials add column name_i18n        jsonb;
alter table tasks     add column name_i18n        jsonb;
