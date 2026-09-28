-- Rename existing objects in place; confirmed records, RLS and attachment paths are preserved.
alter table public.exploration_activities rename to exploration;
alter table public.exploration rename constraint exploration_activities_pkey to exploration_pkey;
alter table public.exploration rename constraint exploration_activities_owner_id_fkey to exploration_owner_id_fkey;
alter table public.exploration rename constraint exploration_activities_revision_check to exploration_revision_check;
alter index public.exploration_activities_owner_updated_idx rename to exploration_owner_updated_idx;
alter function private.save_exploration_activity(uuid,jsonb,jsonb,integer,uuid) rename to save_exploration;
alter function public.save_exploration_activity(uuid,jsonb,jsonb,integer,uuid) rename to save_exploration;
alter function private.delete_exploration_activity(uuid,integer) rename to delete_exploration;
alter function public.delete_exploration_activity(uuid,integer) rename to delete_exploration;

-- SQL/PLpgSQL string bodies must be updated after object renames.
create or replace function private.save_exploration(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v public.exploration; k text; item jsonb; uid uuid := auth.uid(); n integer;
 required_keys text[] := array['grade','semester','recordType','recordArea','schoolContext','topic','record','competencies','motivation','story','result'];
 text_keys text[] := array['grade','semester','recordType','recordArea','schoolContext','topic','record','competencies','motivation','story','result','followup'];
begin
 if uid is null or not private.can_manage_exploration() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid request' using errcode='22023'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>2500000 then raise exception 'Invalid values' using errcode='22023'; end if;
 foreach k in array text_keys loop
   if jsonb_typeof(p_values->k) is distinct from 'string' or length(p_values->>k)>50000 then raise exception 'Invalid field %',k using errcode='22023'; end if;
 end loop;
 foreach k in array required_keys loop
   if (p_values->>k) !~ '[^[:space:]]' then raise exception 'Required field %',k using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_values) key where not(key=any(text_keys) or key='references'))
   or p_values->>'grade' not in ('1','2','3') or p_values->>'semester' not in ('1','2')
   or p_values->>'recordType' not in ('창체','세특')
   or (p_values->>'recordType'='창체' and p_values->>'recordArea' not in ('자율·자치활동','동아리활동','진로활동'))
 then raise exception 'Invalid school fields' using errcode='22023'; end if;
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
 select * into v from public.exploration where id=p_id for update;
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
   select count(*) into n from storage.objects where bucket_id='exploration-reports' and name=item->>'path'
     and (metadata->>'size')::bigint=(item->>'size')::bigint;
   if n<>1 then raise exception 'Upload not found' using errcode='22023'; end if;
 end loop;
 if v.id is null then
   insert into public.exploration(id,owner_id,values,reports,save_id)
   values(p_id,uid,p_values,p_reports,p_save_id) returning * into v;
 else
   update public.exploration set values=p_values,reports=p_reports,revision=revision+1,save_id=p_save_id,updated_at=clock_timestamp()
   where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end;
$$;
revoke all on function private.save_exploration(uuid,jsonb,jsonb,integer,uuid) from public, anon;
grant execute on function private.save_exploration(uuid,jsonb,jsonb,integer,uuid) to authenticated;
create or replace function public.save_exploration(p_id uuid,p_values jsonb,p_reports jsonb,p_expected_revision integer,p_save_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.save_exploration(p_id,p_values,p_reports,p_expected_revision,p_save_id);
$$;
revoke all on function public.save_exploration(uuid,jsonb,jsonb,integer,uuid) from public, anon;
grant execute on function public.save_exploration(uuid,jsonb,jsonb,integer,uuid) to authenticated;

create or replace function private.delete_exploration(p_id uuid,p_expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare v public.exploration;
begin
 if auth.uid() is null or not private.can_manage_exploration() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into v from public.exploration where id=p_id for update;
 if not found then return; end if;
 if v.owner_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
 if v.deleted_at is not null then return; end if;
 if p_expected_revision is null or v.revision<>p_expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 update public.exploration set deleted_at=now(),updated_at=now(),revision=revision+1,values='{}',reports='[]' where id=p_id;
end;
$$;
revoke all on function private.delete_exploration(uuid,integer) from public, anon;
grant execute on function private.delete_exploration(uuid,integer) to authenticated;
create or replace function public.delete_exploration(p_id uuid,p_expected_revision integer)
returns void language sql security invoker set search_path='' as $$ select private.delete_exploration(p_id,p_expected_revision); $$;
revoke all on function public.delete_exploration(uuid,integer) from public, anon;
grant execute on function public.delete_exploration(uuid,integer) to authenticated;

