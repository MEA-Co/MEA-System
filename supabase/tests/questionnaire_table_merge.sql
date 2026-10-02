begin;
do $$ begin
 if to_regclass('public.questionnaire_versions') is not null then raise exception 'Duplicate questionnaire storage remains'; end if;
 if to_regclass('private.questionnaire_owners_before_merge') is not null then raise exception 'Old parent storage remains'; end if;
 if to_regclass('private.questionnaire_owners') is not null then raise exception 'Obsolete parent adapter remains'; end if;
 if exists(select 1 from public.questionnaires where created_by is null or legacy_parent_id is null or owner_created_at is null) then raise exception 'Missing parent metadata'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='questionnaires' and column_name='version_number') then raise exception 'Obsolete version number'; end if;
 if not exists(select 1 from pg_constraint where conname='questionnaire_questions_questionnaire_id_fkey' and confrelid='public.questionnaires'::regclass) then raise exception 'Placement FK lost'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.response_sessions'::regclass and confrelid='public.questionnaires'::regclass and confdeltype='n') then raise exception 'Response preservation FK lost'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prosrc like '%public.questionnaire_versions%') then raise exception 'Stale function reference'; end if;
 if exists(select 1 from information_schema.columns where table_schema in ('public','private') and column_name in ('version_id','origin_version_id')) then raise exception 'Old questionnaire column names'; end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and ('p_version_id'=any(p.proargnames) or p.prosrc like '%versionId%')) then raise exception 'Old RPC identifier contract'; end if;
end $$;
rollback;
