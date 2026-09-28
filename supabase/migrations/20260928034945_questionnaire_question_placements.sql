-- Question definitions remain in public.questions. A placement has its own stable ID.
alter table public.questionnaire_questions
  add column source_question_id uuid references public.questions(id) on delete restrict;
create index questionnaire_questions_source_idx on public.questionnaire_questions(source_question_id)
  where source_question_id is not null;
create unique index questionnaire_questions_source_version_idx
  on public.questionnaire_questions(version_id, source_question_id) where source_question_id is not null;

create function private.validate_questionnaire_placements(p_version_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if exists (
    select 1 from public.questionnaire_questions p
    join public.questionnaire_sections s on s.id=p.section_id
    join public.questions q on q.id=p.source_question_id
    where p.version_id=p_version_id and (
      q.archived_at is not null or exists (
        select 1 from (
          select q.source_block_id id union select q.after_block_id
          union select (c->>'blockId')::uuid from jsonb_array_elements(coalesce(q.condition->'clauses','[]'::jsonb)) c
        ) deps
        where deps.id is not null and not exists (
          select 1 from public.questionnaire_questions preceding
          join public.questionnaire_sections ps on ps.id=preceding.section_id
          where preceding.version_id=p_version_id and preceding.source_question_id=deps.id
            and (ps.position,preceding.position)<(s.position,p.position)
        )
      )
    )
  ) then raise exception 'Question placement dependency order invalid' using errcode='22023'; end if;
end $$;
revoke all on function private.validate_questionnaire_placements(uuid) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid := (p_document->>'versionId')::uuid;
  q_id uuid := (p_document->>'questionnaireId')::uuid;
  v public.questionnaire_versions%rowtype;
  s jsonb; q jsonb; d jsonb; source_id uuid; source_prompt text;
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

  -- A removed source may be re-added with a new placement ID before autosave.
  -- Prune those removed placements before enforcing uniqueness on new rows.
  delete from public.questionnaire_questions existing
  where existing.version_id=v_id and existing.source_question_id is not null
    and not exists (
      select 1 from jsonb_array_elements(p_document->'sections') incoming_section,
        jsonb_array_elements(incoming_section->'questions') incoming_question
      where (incoming_question->>'id')::uuid=existing.id
    );

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
      source_id := (q->>'sourceQuestionId')::uuid;
      if source_id is null and exists(select 1 from public.questionnaire_questions where id=(q->>'id')::uuid and source_question_id is not null) then
        raise exception 'Question placement requires its source' using errcode='22023';
      end if;
      if source_id is not null then
        select prompt into source_prompt from public.questions where id=source_id and archived_at is null for share;
        if not found then raise exception 'Question placement source unavailable' using errcode='22023'; end if;
        -- The source owns the question definition; callers cannot substitute its text/type.
        q := q || jsonb_build_object('text',source_prompt,'kind','text','options','[]'::jsonb,'choiceAllowText',false);
      end if;
      question_ids := array_append(question_ids,(q->>'id')::uuid);
      if (q->>'id')::uuid is null or (q->>'logicalKey')::uuid is null or exists(select 1 from public.questionnaire_questions where id=(q->>'id')::uuid and (version_id<>v_id or logical_key<>(q->>'logicalKey')::uuid)) then raise exception 'Invalid question ID' using errcode='22023'; end if;
      insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position,kind,options,scale_config,choice_style,choice_allow_text,source_question_id)
        values((q->>'id')::uuid,v_id,(s->>'id')::uuid,(q->>'logicalKey')::uuid,q->>'text',qi,coalesce(q->>'kind',(select kind from public.questionnaire_questions where id=(q->>'id')::uuid),'text'),coalesce(q->'options',(select options from public.questionnaire_questions where id=(q->>'id')::uuid),'[]'::jsonb),coalesce(q->'scaleConfig',(select scale_config from public.questionnaire_questions where id=(q->>'id')::uuid),'{"max":5,"low":"전혀 그렇지 않다","middle":"보통이다","high":"매우 그렇다","allowText":false}'::jsonb),coalesce(q->>'choiceStyle',(select choice_style from public.questionnaire_questions where id=(q->>'id')::uuid),'list'),coalesce((q->>'choiceAllowText')::boolean,(select choice_allow_text from public.questionnaire_questions where id=(q->>'id')::uuid),false),source_id)
        on conflict(id) do update set section_id=excluded.section_id,body=excluded.body,position=excluded.position,kind=excluded.kind,options=excluded.options,scale_config=excluded.scale_config,choice_style=excluded.choice_style,choice_allow_text=excluded.choice_allow_text,source_question_id=excluded.source_question_id;
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
  perform private.validate_questionnaire_placements(v_id);
  update public.questionnaire_versions set title=p_document->>'title', revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $function$;






CREATE OR REPLACE FUNCTION public.read_questionnaire_draft(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('draft','published') and exists(select 1 from public.questionnaires p where p.id=v.questionnaire_id and p.created_by=(select auth.uid()) and p.archived_at is null)
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$function$;






CREATE OR REPLACE FUNCTION public.read_published_questionnaire(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('published','distributed') and exists(select 1 from public.questionnaires parent where parent.id=v.questionnaire_id and parent.archived_at is null)
;
$function$;





-- Until versioned block responses are implemented, never send block placements to
-- the legacy one-answer-per-question response writer.
create function private.guard_questionnaire_placement_publication()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status is distinct from old.status and new.status in ('published','distributed') then
    perform private.validate_questionnaire_placements(new.id);
    if new.status='distributed' and exists(select 1 from public.questionnaire_questions where version_id=new.id and source_question_id is not null) then
      raise exception 'Question placement responses are not available yet' using errcode='55000';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_questionnaire_placement_publication() from public,anon,authenticated;
create trigger questionnaire_placement_publication before update of status on public.questionnaire_versions
  for each row execute function private.guard_questionnaire_placement_publication();

create function private.guard_placed_question_archive()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.archived_at is not null and old.archived_at is null and exists (
    select 1 from public.questionnaire_questions p
    join public.questionnaire_versions v on v.id=p.version_id
    join public.questionnaires parent on parent.id=v.questionnaire_id
    where p.source_question_id=new.id and parent.archived_at is null
  ) then raise exception 'Question is used by a questionnaire' using errcode='55000'; end if;
  return new;
end $$;
revoke all on function private.guard_placed_question_archive() from public,anon,authenticated;
create trigger placed_question_archive before update of archived_at on public.questions
  for each row execute function private.guard_placed_question_archive();
