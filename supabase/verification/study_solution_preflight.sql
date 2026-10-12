-- Read-only. Run against the linked production project BEFORE migration.
select count(*) as total, count(*) filter(where deleted_at is null) as active,
 count(*) filter(where values->>'problemSource'='student') as student_source,
 count(*) filter(where jsonb_array_length(reports)>0) as with_files,
 count(*) filter(where coalesce(values->>'resultDiagnosis','')<>'') as legacy_diagnosis,
 count(*) filter(where deleted_at is null and (values ? 'problemExperience' or values ? 'periodEnabled')) as unexpected_new_fields,
 md5(pg_get_functiondef('private.save_study(uuid,jsonb,jsonb,integer,uuid)'::regprocedure)) as save_hash
from public.study;
select version from supabase_migrations.schema_migrations order by version desc limit 5;
