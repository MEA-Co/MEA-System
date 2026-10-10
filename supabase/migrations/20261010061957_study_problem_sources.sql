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
 required_keys text[] := array['category','subject','problemSource','problem','strategy','practiceGuide','practicePeriod','checklist','followup'];
 text_keys text[] := array['category','subject','problemSource','problem','strategy','practiceGuide','practicePeriod','checklist','followup','customSubject','resultDiagnosis'];
begin
 if uid is null or not private.can_manage_study() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid request' using errcode='22023'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>2500000 then raise exception 'Invalid values' using errcode='22023'; end if;
 foreach k in array text_keys loop
   if jsonb_typeof(p_values->k) is distinct from 'string' or length(p_values->>k)>50000 then raise exception 'Invalid field %',k using errcode='22023'; end if;
 end loop;
 foreach k in array required_keys loop
   if (p_values->>k) !~ '[^[:space:]]' then raise exception 'Required field %',k using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_values) key where not(key=any(text_keys) or key='references'))
   or p_values->>'category' not in ('내신','모의고사(수능)','기타')
   or p_values->>'subject' not in ('국어','영어','수학','사회','과학','기타')
   or p_values->>'problemSource' not in ('self','student')
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
 perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
 select * into v from public.study where id=p_id for update;
 if found then
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

