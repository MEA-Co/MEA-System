-- Read-only: run and review before applying the migration.
select table_name,column_name,data_type,is_nullable
from information_schema.columns where table_schema='public'
  and (table_name in ('fields','majors','major_aliases','major_keywords','keyword_examples','university_sources','major_university_sources')
       or table_name like '%major%search%' or table_name like '%major%feedback%')
order by table_name,ordinal_position;
select tablename,rowsecurity from pg_tables where schemaname='public';
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public';
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','service_role') order by table_name,grantee;
select conrelid::regclass,conname,pg_get_constraintdef(oid) from pg_constraint
where conrelid in ('public.majors'::regclass,'public.major_aliases'::regclass);
select version();
