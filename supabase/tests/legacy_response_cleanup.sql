begin;
do $$ begin
 if to_regclass('public.questionnaire_answers') is not null or to_regclass('public.questionnaire_responses') is not null then raise exception 'Legacy tables remain'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc ~ 'questionnaire_(answers|responses)') then raise exception 'Dangling legacy references'; end if;
 if to_regprocedure('private.assert_legacy_response_migrated(uuid)') is not null or to_regprocedure('private.migrate_legacy_question_responses()') is not null or to_regprocedure('private.verify_legacy_question_response_migration()') is not null then raise exception 'Legacy helpers remain'; end if;
end $$;
rollback;
