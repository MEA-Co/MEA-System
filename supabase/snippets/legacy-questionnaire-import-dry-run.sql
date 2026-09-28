-- Run after installing 20260928042153_import_legacy_text_questionnaire.sql.
-- The function runs all guards and inserts, then the transaction rolls them back.
-- IDs returned here are temporary; do not use them as the final imported IDs.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select private.import_legacy_text_questionnaire(
  'dbc59647-e728-4d17-b312-b12fd2c8cd82'::uuid,
  16
) as import_preview;
rollback;
