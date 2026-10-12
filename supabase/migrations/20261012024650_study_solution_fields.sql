BEGIN;
-- Additive learning-method upgrade. Does not rewrite problem/checklist text or delete files.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
 IF md5(pg_get_functiondef('private.save_study(uuid,jsonb,jsonb,integer,uuid)'::regprocedure))
    <> '712012985cb0d8e2b7321198e6967ebc' THEN
   RAISE EXCEPTION 'Unexpected save_study definition; review drift before applying';
 END IF;
END $$;

-- Immutable pre-upgrade snapshot, unavailable through the Data API.
CREATE TABLE private.study_solution_backup_20261012 (
 id uuid PRIMARY KEY,
 row_data jsonb NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.study_solution_backup_20261012 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.study_solution_backup_20261012 FROM PUBLIC, anon, authenticated, service_role;
LOCK TABLE public.study IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO private.study_solution_backup_20261012(id,row_data)
SELECT id, to_jsonb(s) FROM public.study s;

UPDATE public.study
SET values = jsonb_build_object('problemExperience','','periodEnabled',true) || values ||
      CASE WHEN values->>'problemSource'='student' THEN '{"problemSource":"self"}'::jsonb ELSE '{}'::jsonb END,
    revision = revision + 1,
    save_id = gen_random_uuid(),
    updated_at = clock_timestamp()
WHERE deleted_at IS NULL;

-- Verify all original content, attachment manifests and identity were retained.
DO $$ BEGIN
 IF EXISTS (
   SELECT 1 FROM private.study_solution_backup_20261012 b
   LEFT JOIN public.study s ON s.id=b.id
   WHERE s.id IS NULL OR
     (CASE WHEN s.deleted_at IS NOT NULL THEN to_jsonb(s) ELSE
       (to_jsonb(s) - ARRAY['values','revision','save_id','updated_at']) ||
       jsonb_build_object('values', s.values - ARRAY['problemExperience','periodEnabled','problemSource']) END)
     IS DISTINCT FROM
     (CASE WHEN b.row_data->>'deleted_at' IS NOT NULL THEN b.row_data ELSE
       (b.row_data - ARRAY['values','revision','save_id','updated_at']) ||
       jsonb_build_object('values', (b.row_data->'values') - ARRAY['problemExperience','periodEnabled','problemSource']) END)
 ) THEN RAISE EXCEPTION 'Study content preservation check failed'; END IF;
END $$;

SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.save_study (
  p_id                uuid,
  p_values            jsonb,
  p_reports           jsonb,
  p_expected_revision integer,
  p_save_id           uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
 v public.study; k text; item jsonb; uid uuid := auth.uid(); n integer;
 required_keys text[] := array['category','subject','problemSource','problem','strategy','practiceGuide','checklist','followup'];
 text_keys text[] := array['title','category','subject','problemSource','problem','strategy','practiceGuide','practicePeriod','checklist','followup','customSubject','resultDiagnosis','problemExperience'];
begin
 if uid is null or not private.can_manage_study() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid request' using errcode='22023'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>2500000 then raise exception 'Invalid values' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
 select * into v from public.study where id=p_id for update;
 -- Old clients may omit the additive fields; retain previously saved values.
 p_values := jsonb_build_object(
   'problemExperience', coalesce(v.values->'problemExperience', '""'::jsonb),
   'periodEnabled', coalesce(v.values->'periodEnabled', 'true'::jsonb)
 ) || p_values;
 if p_values->>'problemSource'='student' then
   p_values := jsonb_set(p_values, '{problemSource}', '"self"'::jsonb);
 end if;
 if jsonb_typeof(p_values->'periodEnabled') is distinct from 'boolean' then
   raise exception 'Invalid periodEnabled' using errcode='22023';
 end if;
 if (p_values->>'periodEnabled')::boolean and (p_values->>'practicePeriod') !~ '[^[:space:]]' then
   raise exception 'Required field practicePeriod' using errcode='22023';
 end if;
 if p_values ? 'title' and (jsonb_typeof(p_values->'title') is distinct from 'string' or length(p_values->>'title')>100) then raise exception 'Invalid title' using errcode='22023'; end if;
 foreach k in array text_keys loop
   if k='title' and not (p_values ? 'title') then continue; end if;
   if jsonb_typeof(p_values->k) is distinct from 'string' or length(p_values->>k)>50000 then raise exception 'Invalid field %',k using errcode='22023'; end if;
 end loop;
 foreach k in array required_keys loop
   if (p_values->>k) !~ '[^[:space:]]' then raise exception 'Required field %',k using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_values) key where not(key=any(text_keys) or key in ('references','periodEnabled')))
   or p_values->>'category' not in ('내신','모의고사(수능)','기타')
   or p_values->>'subject' not in ('국어','영어','수학','사회','과학','기타')
   or p_values->>'problemSource' not in ('self','student','template')
 then raise exception 'Invalid study category or subject' using errcode='22023'; end if;
 if jsonb_typeof(p_values->'references') is distinct from 'array' then raise exception 'Invalid references' using errcode='22023'; end if;
 if jsonb_array_length(p_values->'references')>100 then raise exception 'Too many references' using errcode='22023'; end if;
 for item in select * from jsonb_array_elements(p_values->'references') loop
   if jsonb_typeof(item)<>'object' or item->>'clientKey' is null then raise exception 'Invalid reference' using errcode='22023'; end if;
   perform (item->>'clientKey')::uuid;
   foreach k in array array['title','selection','usage'] loop
     if jsonb_typeof(item->k) is distinct from 'string' or length(item->>k)>50000 then raise exception 'Invalid reference text' using errcode='22023'; end if;
   end loop;
 end loop;
 if p_reports is null or jsonb_typeof(p_reports)<>'array' then raise exception 'Invalid reports' using errcode='22023'; end if;
 if jsonb_array_length(p_reports)>10 then raise exception 'Too many files' using errcode='22023'; end if;
 if (select count(distinct r->>'path') from jsonb_array_elements(p_reports) r)<>jsonb_array_length(p_reports) then raise exception 'Duplicate files' using errcode='22023'; end if;
 -- Serialize inserts, updates and retries for the same id, including first saves.
 if v.id is not null then
   if v.owner_id<>uid then raise exception 'Forbidden' using errcode='42501'; end if;
   if v.deleted_at is not null then raise exception 'Deleted' using errcode='40001'; end if;
   if v.save_id=p_save_id then
     if v.values=p_values and v.reports=p_reports then return to_jsonb(v); end if;
     raise exception 'Reused save id' using errcode='40001';
   end if;
   if v.revision<>p_expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 elsif p_expected_revision<>0 then raise exception 'Missing activity' using errcode='40001'; end if;
 for item in select * from jsonb_array_elements(p_reports) loop
   if jsonb_typeof(item)<>'object' or item->>'path' is null or item->>'name' is null
     or length(item->>'name')>255 or item->>'name' !~* '\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$'
     or item->>'path' !~ ('^'||uid::text||'/'||p_id::text||'/[0-9a-f-]{36}\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$')
     or jsonb_typeof(item->'size') is distinct from 'number'
     or (item->>'size')::bigint not between 1 and 20971520
   then raise exception 'Invalid report' using errcode='22023'; end if;
   if jsonb_typeof(item->'clientKey') is distinct from 'string'
     or (item->>'clientKey') !~ '^[0-9a-f-]{36}$'
     or jsonb_typeof(item->'type') is distinct from 'string' or length(item->>'type')>200
     or jsonb_typeof(item->'lastModified') is distinct from 'number' or (item->>'lastModified') !~ '^[0-9]+$'
     or (item->>'size') !~ '^[0-9]+$'
     or (item->>'path') not like (uid::text||'/'||p_id::text||'/'||(item->>'clientKey')||'.%')
   then raise exception 'Invalid file metadata' using errcode='22023'; end if;
   perform (item->>'clientKey')::uuid;
   -- The object must already exist. Never accept a manifest that refers to another account or activity.
   select count(*) into n from storage.objects where bucket_id='study-reports' and name=item->>'path'
     and (metadata->>'size')::bigint=(item->>'size')::bigint;
   if n<>1 then raise exception 'Upload not found' using errcode='22023'; end if;
 end loop;
 if v.id is null then
   insert into public.study(id,owner_id,values,reports,save_id)
   values(p_id,uid,p_values,p_reports,p_save_id) returning * into v;
 else
   update public.study set values=p_values,reports=p_reports,revision=revision+1,save_id=p_save_id,updated_at=clock_timestamp()
   where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end;
$function$;


COMMIT;
