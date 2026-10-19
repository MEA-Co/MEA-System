begin;
set local lock_timeout='5s';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('questionnaire-notice-images','questionnaire-notice-images',false,2097152,array['image/webp']);

-- Pure metadata validation; bytes and URLs never enter the questionnaire JSON.
create function private.questionnaire_notice_images_valid(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare notice jsonb; image jsonb; ids text[];
begin
 for notice in select * from jsonb_array_elements(private.questionnaire_notices(value)) loop
  if not notice ? 'images' then continue; end if;
  if jsonb_typeof(notice->'images') is distinct from 'array' then return false; end if;
  if jsonb_array_length(notice->'images') > 10 then return false; end if;
  ids:='{}';
  for image in select * from jsonb_array_elements(notice->'images') loop
   if jsonb_typeof(image) is distinct from 'object'
    or jsonb_typeof(image->'id') is distinct from 'string'
    or (image->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (image->>'id') = any(ids)
    or jsonb_typeof(image->'name') is distinct from 'string'
    or length(image->>'name') not between 1 and 200 then return false; end if;
   ids:=array_append(ids,image->>'id');
  end loop;
 end loop;
 return true;
end $$;
revoke all on function private.questionnaire_notice_images_valid(jsonb) from public,anon;
grant execute on function private.questionnaire_notice_images_valid(jsonb) to authenticated;

do $$ declare definition text; needle text; begin
 definition:=pg_get_functiondef('private.questionnaire_notices_valid(jsonb)'::regprocedure);
 needle:='normalized := private.questionnaire_notices(value);';
 if position(needle in definition)=0 then raise exception 'Unexpected notice validator'; end if;
 execute replace(definition,needle,needle||E'\n  if not private.questionnaire_notice_images_valid(value) then return false; end if;');

 definition:=pg_get_functiondef('private.save_questionnaire_draft(jsonb,integer,uuid)'::regprocedure);
 needle:='  perform private.remove_unplaced_guide_answers(v_id);';
 if position(needle in definition)=0 then raise exception 'Unexpected questionnaire save'; end if;
 execute replace(definition,needle,$validation$
  -- Every reference must be an already uploaded object under this document/notice.
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_document->'notices','[]'::jsonb)) notice
    cross join lateral jsonb_array_elements(coalesce(notice->'images','[]'::jsonb)) image
    where not exists (select 1 from storage.objects obj
      where obj.bucket_id='questionnaire-notice-images'
        and obj.name=v_id::text||'/'||(notice->>'id')||'/'||(image->>'id')||'.webp')
  ) then raise exception 'Notice image upload is missing' using errcode='22023'; end if;
$validation$||needle);
end $$;

-- Invoker functions retain questionnaires RLS; no new definer or public RPC.
create function private.notice_image_access(object_name text, writing boolean default false) returns boolean
language plpgsql stable set search_path='' as $$
declare parts text[]; q public.questionnaires%rowtype; notice jsonb; editor boolean;
begin
 if auth.uid() is null or object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' then return false; end if;
 parts:=string_to_array(object_name,'/');
 -- Validate UUID syntax before any cast; malformed storage names return false.
 if parts[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 select * into q from public.questionnaires where id=parts[1]::uuid;
 if not found or q.archived_at is not null then return false; end if;
 editor:=(private.is_admin() or private.is_consultant_lead())
  and q.status in ('draft','in_review')
  and (q.created_by=auth.uid() or private.is_admin() or q.status='in_review');
 select item into notice from jsonb_array_elements(private.questionnaire_notices(q.start_notice)) item where item->>'id'=parts[2];
 if notice is null then return false; end if;
 if writing then return editor; end if;
 return editor or (q.status in ('in_review','published') and exists(
   select 1 from jsonb_array_elements(coalesce(notice->'images','[]'::jsonb)) image
   where image->>'id'=replace(parts[3],'.webp','')));
end $$;
revoke all on function private.notice_image_access(text,boolean) from public,anon;
grant execute on function private.notice_image_access(text,boolean) to authenticated;
create policy questionnaire_notice_image_read on storage.objects for select to authenticated
 using(bucket_id='questionnaire-notice-images' and private.notice_image_access(name,false));
create policy questionnaire_notice_image_insert on storage.objects for insert to authenticated
 with check(bucket_id='questionnaire-notice-images' and private.notice_image_access(name,true));
-- Images are immutable. Removal detaches metadata; saved or pending documents
-- must not lose their file because another editor clicked remove.
notify pgrst,'reload schema';
commit;
