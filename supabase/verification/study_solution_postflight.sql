-- Read-only. Run immediately AFTER migration and BEFORE accepting new writes.
select count(*) as backup_rows from private.study_solution_backup_20261012;
select count(*) as mismatched_rows
from private.study_solution_backup_20261012 b
left join public.study s on s.id=b.id
where s.id is null or
 (case when b.row_data->>'deleted_at' is not null then to_jsonb(s) else
   to_jsonb(s) - array['updated_at','save_id'] end)
 is distinct from
 (case when b.row_data->>'deleted_at' is not null then b.row_data else
   (b.row_data - array['updated_at','save_id','values','revision']) || jsonb_build_object(
     'revision', (b.row_data->>'revision')::integer + 1,
     'values', jsonb_build_object('problemExperience','','periodEnabled',true) || (b.row_data->'values') ||
       case when b.row_data#>>'{values,problemSource}'='student' then '{"problemSource":"self"}'::jsonb else '{}'::jsonb end
   ) end);
select count(*) as invalid_active_rows from public.study where deleted_at is null and (
 jsonb_typeof(values->'problemExperience') is distinct from 'string' or
 jsonb_typeof(values->'periodEnabled') is distinct from 'boolean' or
 values->>'problemSource' not in ('self','template')
);
select md5(pg_get_functiondef('private.save_study(uuid,jsonb,jsonb,integer,uuid)'::regprocedure)) as save_hash;
select count(*) as public_backup_grants from information_schema.role_table_grants
where table_schema='private' and table_name='study_solution_backup_20261012'
and grantee in ('PUBLIC','anon','authenticated','service_role');
