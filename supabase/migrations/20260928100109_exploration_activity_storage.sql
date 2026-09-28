-- Confirmed activities only. Draft text and attachments remain in the user's browser.
create table public.exploration_activities (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  values jsonb not null,
  reports jsonb not null default '[]',
  revision integer not null default 1 check (revision > 0),
  save_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index exploration_activities_owner_updated_idx on public.exploration_activities(owner_id, updated_at desc, id);
alter table public.exploration_activities enable row level security;
revoke all on public.exploration_activities from public, anon, authenticated;
grant select on public.exploration_activities to authenticated;

create function private.can_manage_exploration() returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('consultant','consultant_lead','admin'));
$$;
revoke all on function private.can_manage_exploration() from public, anon;
grant execute on function private.can_manage_exploration() to authenticated;
create policy exploration_owner_read on public.exploration_activities for select to authenticated
using (owner_id=(select auth.uid()) and (select private.can_manage_exploration()));

-- Private privileged implementation allows atomic RPC writes without granting direct table writes.
create function private.save_exploration_activity(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v public.exploration_activities; k text; item jsonb; uid uuid := auth.uid(); n integer;
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
 select * into v from public.exploration_activities where id=p_id for update;
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
   insert into public.exploration_activities(id,owner_id,values,reports,save_id)
   values(p_id,uid,p_values,p_reports,p_save_id) returning * into v;
 else
   update public.exploration_activities set values=p_values,reports=p_reports,revision=revision+1,save_id=p_save_id,updated_at=clock_timestamp()
   where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end;
$$;
revoke all on function private.save_exploration_activity(uuid,jsonb,jsonb,integer,uuid) from public, anon;
grant execute on function private.save_exploration_activity(uuid,jsonb,jsonb,integer,uuid) to authenticated;
create function public.save_exploration_activity(p_id uuid,p_values jsonb,p_reports jsonb,p_expected_revision integer,p_save_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.save_exploration_activity(p_id,p_values,p_reports,p_expected_revision,p_save_id);
$$;
revoke all on function public.save_exploration_activity(uuid,jsonb,jsonb,integer,uuid) from public, anon;
grant execute on function public.save_exploration_activity(uuid,jsonb,jsonb,integer,uuid) to authenticated;

create function private.delete_exploration_activity(p_id uuid,p_expected_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare v public.exploration_activities;
begin
 if auth.uid() is null or not private.can_manage_exploration() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into v from public.exploration_activities where id=p_id for update;
 if not found then return; end if;
 if v.owner_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
 if v.deleted_at is not null then return; end if;
 if p_expected_revision is null or v.revision<>p_expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 update public.exploration_activities set deleted_at=now(),updated_at=now(),revision=revision+1,values='{}',reports='[]' where id=p_id;
end;
$$;
revoke all on function private.delete_exploration_activity(uuid,integer) from public, anon;
grant execute on function private.delete_exploration_activity(uuid,integer) to authenticated;
create function public.delete_exploration_activity(p_id uuid,p_expected_revision integer)
returns void language sql security invoker set search_path='' as $$ select private.delete_exploration_activity(p_id,p_expected_revision); $$;
revoke all on function public.delete_exploration_activity(uuid,integer) from public, anon;
grant execute on function public.delete_exploration_activity(uuid,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit)
values('exploration-reports','exploration-reports',false,20971520)
on conflict(id) do update set public=false,file_size_limit=20971520;
create policy exploration_report_read on storage.objects for select to authenticated
using (bucket_id='exploration-reports' and (storage.foldername(name))[1]=(select auth.uid())::text and (select private.can_manage_exploration()));
create policy exploration_report_insert on storage.objects for insert to authenticated
with check (bucket_id='exploration-reports' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$')
 and (select private.can_manage_exploration()));
create policy exploration_report_delete on storage.objects for delete to authenticated
using (bucket_id='exploration-reports' and (storage.foldername(name))[1]=(select auth.uid())::text
 and (select private.can_manage_exploration())
 and not exists(select 1 from public.exploration_activities a where a.owner_id=(select auth.uid()) and a.deleted_at is null and a.reports @> jsonb_build_array(jsonb_build_object('path',name))));
