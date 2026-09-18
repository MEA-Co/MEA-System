alter table public.questionnaire_versions
  drop constraint questionnaire_versions_status_check,
  drop constraint questionnaire_versions_check,
  add column distributed_at timestamptz,
  add constraint questionnaire_versions_status_check check(status in ('draft','published','distributed')),
  add constraint questionnaire_versions_published_check check((status in ('published','distributed')) = (published_at is not null)),
  add constraint questionnaire_versions_distributed_check check((status='distributed') = (distributed_at is not null));
create or replace function private.guard_questionnaire_content() returns trigger
language plpgsql set search_path = '' as $$
declare v_id uuid; old_version uuid;
begin
  if tg_table_name = 'questionnaire_versions' then
    if old.status = 'distributed' then raise exception 'Published questionnaire is immutable' using errcode = '55000'; end if;
  else
    if tg_table_name = 'questionnaire_question_details' then
      if tg_op <> 'INSERT' then select version_id into old_version from public.questionnaire_questions where id = old.question_id; end if;
      if tg_op <> 'DELETE' then select version_id into v_id from public.questionnaire_questions where id = new.question_id; end if;
    else
      if tg_op <> 'INSERT' then old_version := old.version_id; end if;
      if tg_op <> 'DELETE' then v_id := new.version_id; end if;
    end if;
    if exists (select 1 from public.questionnaire_versions where id in (v_id, old_version) and status = 'distributed') then
      raise exception 'Published questionnaire is immutable' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
update public.questionnaire_versions v set status='distributed', distributed_at=coalesce(published_at,now())
where status='published' and exists(select 1 from public.questionnaire_responses r where r.version_id=v.id);

-- Parent metadata does not expose content; version RLS gates the documents.
alter policy "Staff read questionnaires" on public.questionnaires using (
 (select private.is_admin()) or (select private.is_consultant_lead()) or
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='consultant')
);
alter policy "Read assigned or managed versions" on public.questionnaire_versions using (
 (select private.is_admin()) or (select private.is_consultant_lead()) or
 (status='distributed' and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='consultant')
 and exists(select 1 from public.questionnaires parent where parent.id=questionnaire_id and parent.archived_at is null))
);
create or replace function private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p_document->>'versionId')::uuid;
  q_id uuid := (p_document->>'questionnaireId')::uuid;
  v public.questionnaire_versions%rowtype;
  s jsonb; q jsonb; d jsonb;
  si integer := 0; qi integer; di integer;
  section_ids uuid[] := '{}'; question_ids uuid[] := '{}'; detail_ids uuid[] := '{}';
  payload_hash text := md5(p_document::text);
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode = '42501';
  end if;
  if v_id is null or q_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_document->'title') is distinct from 'string'
    or jsonb_typeof(p_document->'sections') is distinct from 'array'
    or length(p_document::text) > 700000 or jsonb_array_length(p_document->'sections') > 50 then
    raise exception 'Invalid questionnaire document' using errcode = '22023';
  end if;
  -- Serialize even the first save; a retry after an uncertain network result is safe.
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v from public.questionnaire_versions where id = v_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'Questionnaire conflict' using errcode = '40001'; end if;
    insert into public.questionnaires(id, created_by) values (q_id, auth.uid());
    insert into public.questionnaire_versions(id, questionnaire_id) values(v_id, q_id) returning * into v;
  end if;
  if not exists(select 1 from public.questionnaires where id=v.questionnaire_id and created_by=auth.uid()) then raise exception 'Only the creator can edit' using errcode='42501'; end if;
  if v.questionnaire_id <> q_id or v.status not in ('draft','published') or exists(select 1 from public.questionnaires where id=q_id and archived_at is not null) then
    raise exception 'Questionnaire is not editable' using errcode = '55000';
  end if;
  if v.last_save_id = p_save_id and v.last_save_hash = payload_hash then
    return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
  end if;
  if v.revision <> p_expected_revision or v.last_save_id = p_save_id then raise exception 'Questionnaire conflict' using errcode = '40001'; end if;

  for s in select value from jsonb_array_elements(p_document->'sections') loop
    if jsonb_typeof(s->'title') is distinct from 'string' or jsonb_typeof(s->'questions') is distinct from 'array' or jsonb_array_length(s->'questions') > 100 then
      raise exception 'Invalid section' using errcode = '22023';
    end if;
    section_ids := array_append(section_ids, (s->>'id')::uuid);
    if (s->>'id')::uuid is null or exists(select 1 from public.questionnaire_sections where id=(s->>'id')::uuid and version_id<>v_id) then raise exception 'Invalid section ID' using errcode='22023'; end if;
    insert into public.questionnaire_sections(id,version_id,title,position) values((s->>'id')::uuid,v_id,s->>'title',si)
      on conflict(id) do update set title=excluded.title,position=excluded.position;
    qi := 0;
    for q in select value from jsonb_array_elements(s->'questions') loop
      if jsonb_typeof(q->'text') is distinct from 'string' or jsonb_typeof(q->'details') is distinct from 'array' or jsonb_array_length(q->'details') > 30 then raise exception 'Invalid question' using errcode='22023'; end if;
      question_ids := array_append(question_ids,(q->>'id')::uuid);
      if (q->>'id')::uuid is null or (q->>'logicalKey')::uuid is null or exists(select 1 from public.questionnaire_questions where id=(q->>'id')::uuid and (version_id<>v_id or logical_key<>(q->>'logicalKey')::uuid)) then raise exception 'Invalid question ID' using errcode='22023'; end if;
      insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position)
        values((q->>'id')::uuid,v_id,(s->>'id')::uuid,(q->>'logicalKey')::uuid,q->>'text',qi)
        on conflict(id) do update set section_id=excluded.section_id,body=excluded.body,position=excluded.position;
      di := 0;
      for d in select value from jsonb_array_elements(q->'details') loop
        if jsonb_typeof(d->'title') is distinct from 'string' or jsonb_typeof(d->'text') is distinct from 'string' or jsonb_typeof(d->'visibleToConsultants') is distinct from 'boolean' then raise exception 'Invalid explanation' using errcode='22023'; end if;
        detail_ids := array_append(detail_ids,(d->>'id')::uuid);
        if (d->>'id')::uuid is null or exists(select 1 from public.questionnaire_question_details where id=(d->>'id')::uuid and question_id<>(q->>'id')::uuid) then raise exception 'Invalid explanation ID' using errcode='22023'; end if;
        insert into public.questionnaire_question_details(id,question_id,title,body,visible_to_consultants,position)
          values((d->>'id')::uuid,(q->>'id')::uuid,d->>'title',d->>'text',(d->>'visibleToConsultants')::boolean,di)
          on conflict(id) do update set title=excluded.title,body=excluded.body,visible_to_consultants=excluded.visible_to_consultants,position=excluded.position;
        di := di+1;
      end loop;
      qi := qi+1;
    end loop;
    si := si+1;
  end loop;
  if cardinality(section_ids) <> (select count(distinct x) from unnest(section_ids) x)
    or cardinality(question_ids) <> (select count(distinct x) from unnest(question_ids) x)
    or cardinality(detail_ids) <> (select count(distinct x) from unnest(detail_ids) x) then raise exception 'Duplicate IDs' using errcode='22023'; end if;
  delete from public.questionnaire_question_details where question_id in (select id from public.questionnaire_questions where version_id=v_id) and not(id=any(detail_ids));
  delete from public.questionnaire_questions where version_id=v_id and not(id=any(question_ids));
  delete from public.questionnaire_sections where version_id=v_id and not(id=any(section_ids));
  update public.questionnaire_versions set title=p_document->>'title', revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $$;
create or replace function private.publish_questionnaire(p_version_id uuid, p_expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.questionnaire_versions%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from public.questionnaires where id=v.questionnaire_id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from public.questionnaires where id=v.questionnaire_id and created_by=auth.uid()) then raise exception 'Only the creator can publish or distribute' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire conflict' using errcode='40001'; end if;
  if v.status='published' then return; end if;
  if v.status<>'draft' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where version_id=v.id)
    or exists(select 1 from public.questionnaire_questions where version_id=v.id and btrim(body)='') then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  update public.questionnaire_versions set status='published',published_at=now(),updated_at=now() where id=v.id;
end $$;
create or replace function private.distribute_questionnaire(p_version_id uuid, p_expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.questionnaire_versions%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from public.questionnaires where id=v.questionnaire_id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from public.questionnaires where id=v.questionnaire_id and created_by=auth.uid()) then raise exception 'Only the creator can publish or distribute' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire conflict' using errcode='40001'; end if;
  if v.status='distributed' then return; end if;
  if v.status<>'published' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where version_id=v.id)
    or exists(select 1 from public.questionnaire_questions where version_id=v.id and btrim(body)='') then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  update public.questionnaire_versions set status='distributed',distributed_at=now(),updated_at=now() where id=v.id;
end $$;
revoke all on function private.distribute_questionnaire(uuid,integer) from public,anon,authenticated;
grant execute on function private.distribute_questionnaire(uuid,integer) to authenticated;
create function public.distribute_questionnaire(p_version_id uuid,p_expected_revision integer)
returns void language sql security invoker set search_path='' as $$ select private.distribute_questionnaire(p_version_id,p_expected_revision); $$;
revoke all on function public.distribute_questionnaire(uuid,integer) from public,anon,authenticated;
grant execute on function public.distribute_questionnaire(uuid,integer) to authenticated;
create or replace function public.read_questionnaire_draft(p_version_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('draft','published') and exists(select 1 from public.questionnaires p where p.id=v.questionnaire_id and p.created_by=(select auth.uid()) and p.archived_at is null)
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$$;
revoke all on function public.read_questionnaire_draft(uuid) from public, anon, authenticated;
grant execute on function public.read_questionnaire_draft(uuid) to authenticated;
create or replace function public.read_published_questionnaire(p_version_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('published','distributed') and exists(select 1 from public.questionnaires parent where parent.id=v.questionnaire_id and parent.archived_at is null)
;
$$;
revoke all on function public.read_published_questionnaire(uuid) from public, anon, authenticated;
grant execute on function public.read_published_questionnaire(uuid) to authenticated;
create or replace function private.delete_questionnaire(p_version_id uuid, p_expected_revision integer)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.questionnaire_versions%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then
    if exists(select 1 from private.deleted_questionnaire_versions where version_id=p_version_id) then return 'deleted'; end if;
    raise exception 'Questionnaire not found' using errcode='P0002';
  end if;
  if not exists(select 1 from public.questionnaires where id=v.questionnaire_id and created_by=auth.uid()) then raise exception 'Only creator can delete' using errcode='42501'; end if;
  -- Serialize changes to the entire questionnaire, including insertion/publication
  -- of other versions, before deciding whether any published history exists.
  perform 1 from public.questionnaires where id=v.questionnaire_id for update;
  perform 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id order by id for update;
  if exists(select 1 from public.questionnaires where id=v.questionnaire_id and archived_at is not null)
    and exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status in ('published','distributed')) then return 'archived'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire changed' using errcode='40001'; end if;
  if exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status in ('published','distributed')) then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=v.questionnaire_id;
    return 'archived';
  end if;
  -- An unexpected response attached to an unpublished version is never destroyed.
  if exists(select 1 from public.questionnaire_responses r join public.questionnaire_versions x on x.id=r.version_id where x.questionnaire_id=v.questionnaire_id) then
    raise exception 'Unpublished questionnaire has responses' using errcode='55000';
  end if;
  insert into private.deleted_questionnaire_versions(version_id)
    select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  delete from public.questionnaire_question_details where question_id in (
    select q.id from public.questionnaire_questions q join public.questionnaire_versions x on x.id=q.version_id where x.questionnaire_id=v.questionnaire_id
  );
  delete from public.questionnaire_questions where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_sections where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  delete from public.questionnaires where id=v.questionnaire_id;
  return 'deleted';
end $$;

create table public.questionnaire_review_requests (
 id uuid primary key,
 version_id uuid not null references public.questionnaire_versions(id) on delete restrict,
 requested_by uuid not null references public.profiles(id) on delete restrict,
 requester_name text not null,
 description text not null check(length(btrim(description)) between 1 and 5000),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index questionnaire_reviews_version_idx on public.questionnaire_review_requests(version_id,created_at);
create index questionnaire_reviews_requester_idx on public.questionnaire_review_requests(requested_by);
alter table public.questionnaire_review_requests enable row level security;
revoke all on public.questionnaire_review_requests from public,anon,authenticated;
grant select on public.questionnaire_review_requests to authenticated;
create policy "Read own or received reviews" on public.questionnaire_review_requests for select to authenticated using (
 exists(select 1 from public.questionnaire_versions v join public.questionnaires p on p.id=v.questionnaire_id
 where v.id=version_id and p.archived_at is null and (p.created_by=(select auth.uid()) or requested_by=(select auth.uid())))
);
create function private.request_questionnaire_review(p_id uuid,p_version_id uuid,p_description text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.questionnaire_versions%rowtype; actor public.profiles%rowtype; owner_id uuid;
begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.role not in ('admin','consultant_lead') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_description is null or length(btrim(p_description)) not between 1 and 5000 then raise exception 'Invalid review' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 select * into v from public.questionnaire_versions where id=p_version_id for update;
 if not found or v.status not in ('published','distributed') or (actor.role='consultant' and v.status<>'distributed') then raise exception 'Review not allowed' using errcode='42501'; end if;
 select created_by into owner_id from public.questionnaires where id=v.questionnaire_id and archived_at is null for update;
 if owner_id is null or owner_id=actor.id then raise exception 'Review not allowed' using errcode='42501'; end if;
 insert into public.questionnaire_review_requests(id,version_id,requested_by,requester_name,description)
 values(p_id,v.id,actor.id,actor.name,btrim(p_description)) on conflict(id) do nothing;
 if not exists(select 1 from public.questionnaire_review_requests where id=p_id and version_id=v.id and requested_by=actor.id and description=btrim(p_description)) then raise exception 'Review conflict' using errcode='40001'; end if;
end $$;
create function private.resolve_questionnaire_review(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaire_review_requests r join public.questionnaire_versions v on v.id=r.version_id join public.questionnaires p on p.id=v.questionnaire_id where r.id=p_id and p.created_by=auth.uid()) then raise exception 'Only creator can resolve' using errcode='42501'; end if;
 update public.questionnaire_review_requests set resolved_at=coalesce(resolved_at,now()) where id=p_id;
end $$;
revoke all on function private.request_questionnaire_review(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.request_questionnaire_review(uuid,uuid,text) to authenticated;
create function public.request_questionnaire_review(p_id uuid,p_version_id uuid,p_description text) returns void language sql security invoker set search_path='' as $$ select private.request_questionnaire_review(p_id,p_version_id,p_description); $$;
revoke all on function public.request_questionnaire_review(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.request_questionnaire_review(uuid,uuid,text) to authenticated;
revoke all on function private.resolve_questionnaire_review(uuid) from public,anon,authenticated;
grant execute on function private.resolve_questionnaire_review(uuid) to authenticated;
create function public.resolve_questionnaire_review(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.resolve_questionnaire_review(p_id); $$;
revoke all on function public.resolve_questionnaire_review(uuid) from public,anon,authenticated;
grant execute on function public.resolve_questionnaire_review(uuid) to authenticated;
