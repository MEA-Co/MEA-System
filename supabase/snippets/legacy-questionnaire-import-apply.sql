-- Use only after the read-only check and dry-run succeed.
-- Existing source document and answers are not modified; creates a new draft.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select private.import_legacy_text_questionnaire(
  'dbc59647-e728-4d17-b312-b12fd2c8cd82'::uuid,
  16
) as import_result;
commit;
