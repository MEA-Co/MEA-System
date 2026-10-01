-- Historical stage-3 operator snippet; unavailable after 20261001050017. No manual production execution is needed.
-- Operator-only rehearsal: preserve all data with ROLLBACK.
begin;
select private.migrate_legacy_question_responses();
select private.verify_legacy_question_response_migration();
rollback;
