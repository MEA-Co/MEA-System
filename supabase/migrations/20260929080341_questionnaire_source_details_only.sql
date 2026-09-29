BEGIN;
-- Local cleanup only: never discard existing legacy explanation data.
-- A database with legacy explanations needs an explicit, separately reviewed conversion.
LOCK TABLE public.questionnaire_question_details IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.questionnaire_question_details) THEN
    RAISE EXCEPTION 'Existing questionnaire explanations must be migrated before cleanup';
  END IF;
END $$;

SET local check_function_bodies = off;

ALTER TABLE "public"."questionnaire_question_details"
  DROP CONSTRAINT "questionnaire_question_details_created_by_fkey";

ALTER TABLE "public"."questionnaire_question_details"
  DROP CONSTRAINT "questionnaire_question_details_question_id_fkey";

DROP FUNCTION "private"."add_questionnaire_explanation"(uuid, uuid, uuid, text, text, boolean);

DROP FUNCTION "private"."manage_questionnaire_explanation"(uuid, uuid, integer, text, text, boolean, boolean);

DROP FUNCTION "public"."add_questionnaire_explanation"(uuid, uuid, uuid, text, text, boolean);

DROP FUNCTION "public"."delete_questionnaire_explanation"(uuid, uuid, integer);

DROP FUNCTION "public"."update_questionnaire_explanation"(uuid, uuid, integer, text, text, boolean);

DROP TABLE "public"."questionnaire_question_details";

CREATE OR REPLACE FUNCTION private.change_questionnaire_status (
  p_version_id           uuid,
  p_expected_revision    integer,
  p_expected_status      text,
  p_expected_archived_at timestamp with time zone,
  p_status               text,
  p_request_id           uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.questionnaire_versions%rowtype;
  parent public.questionnaires%rowtype;
  receipt private.questionnaire_status_requests%rowtype;
  fingerprint text;
  result jsonb;
  target_id uuid := p_version_id;
  parent_id uuid;
  new_section_id uuid;
  new_question_id uuid;
  s record; q record;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_status is null or p_status not in ('draft','published','distributed','archived')
    or p_expected_status is null or p_expected_status not in ('draft','published','distributed') then
    raise exception 'Invalid status request' using errcode='22023';
  end if;
  fingerprint := md5(jsonb_build_array(p_version_id,p_expected_revision,p_expected_status,p_expected_archived_at,p_status)::text);
  perform pg_advisory_xact_lock(hashtextextended('questionnaire-status:'||p_request_id::text,0));
  select * into receipt from private.questionnaire_status_requests where id=p_request_id;
  if found then
    if receipt.actor_id <> auth.uid() or receipt.payload_hash <> fingerprint then
      raise exception 'Request conflict' using errcode='40001';
    end if;
    return receipt.result;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  select * into parent from public.questionnaires where id=v.questionnaire_id for update;
  if parent.created_by <> auth.uid() and not (p_status='archived' and private.is_admin()) then
    raise exception 'Only creator can change status' using errcode='42501';
  end if;
  if v.revision <> p_expected_revision or v.status <> p_expected_status
    or parent.archived_at is distinct from p_expected_archived_at then
    raise exception 'Questionnaire conflict' using errcode='40001';
  end if;
  if p_status='archived' then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=parent.id;
  elsif v.status='distributed' and p_status='draft' then
    -- Never edit the distributed version or move its answers/reviews. A new
    -- questionnaire owns the editable copy, so archiving either is independent.
    target_id := gen_random_uuid(); parent_id := gen_random_uuid();
    insert into public.questionnaires(id,created_by) values(parent_id,auth.uid());
    insert into public.questionnaire_versions(id,questionnaire_id,title,revision)
      values(target_id,parent_id,v.title,1);
    for s in select * from public.questionnaire_sections where version_id=v.id order by position loop
      new_section_id := gen_random_uuid();
      insert into public.questionnaire_sections(id,version_id,title,position)
        values(new_section_id,target_id,s.title,s.position);
      for q in select * from public.questionnaire_questions where section_id=s.id order by position loop
        new_question_id := gen_random_uuid();
        insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position,kind,options,scale_config,choice_style,choice_allow_text,source_question_id)
          values(new_question_id,target_id,new_section_id,q.logical_key,q.body,q.position,q.kind,q.options,q.scale_config,q.choice_style,q.choice_allow_text,q.source_question_id);
      end loop;
    end loop;
    perform private.validate_questionnaire_placements(target_id);
  else
    if v.status='distributed' and p_status <> 'distributed' then
      raise exception 'Distributed version is immutable' using errcode='55000';
    end if;
    if parent.archived_at is not null then
      -- A referenced source may have been archived while this document was hidden.
      perform private.validate_questionnaire_placements(v.id);
      update public.questionnaires set archived_at=null where id=parent.id;
    end if;
    if p_status='draft' and v.status='published' then
      update public.questionnaire_versions set status='draft',published_at=null,revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    elsif p_status='published' and v.status='draft' then
      perform private.publish_questionnaire(v.id,v.revision);
      update public.questionnaire_versions set revision=revision+1 where id=v.id;
    elsif p_status='distributed' and v.status <> 'distributed' then
      if v.status='draft' then perform private.publish_questionnaire(v.id,v.revision); end if;
      -- Existing validation and placement response protection remain authoritative.
      -- Advance revision before distribution, since distributed rows are immutable.
      update public.questionnaire_versions set revision=revision+1 where id=v.id;
      perform private.distribute_questionnaire(v.id,v.revision+1);
    end if;
  end if;
  result := jsonb_build_object('versionId',target_id,'copied',target_id<>p_version_id);
  insert into private.questionnaire_status_requests(id,actor_id,payload_hash,result)
    values(p_request_id,auth.uid(),fingerprint,result);
  return result;
end $function$;

CREATE OR REPLACE FUNCTION private.delete_questionnaire (
  p_version_id        uuid,
  p_expected_revision integer
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
  if not private.is_admin() and not exists(select 1 from public.questionnaires where id=v.questionnaire_id and created_by=auth.uid()) then raise exception 'Only creator or admin can delete' using errcode='42501'; end if;
  -- Serialize changes to the entire questionnaire, including insertion/publication
  -- of other versions, before deciding whether any distributed history exists.
  perform 1 from public.questionnaires where id=v.questionnaire_id for update;
  perform 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id order by id for update;
  if exists(select 1 from public.questionnaires where id=v.questionnaire_id and archived_at is not null)
    and exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status='distributed') then return 'archived'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire changed' using errcode='40001'; end if;
  if exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status='distributed') then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=v.questionnaire_id;
    return 'archived';
  end if;
  insert into private.deleted_questionnaire_versions(version_id)
    select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  -- Delete every dependent row for a never-distributed questionnaire atomically.
  delete from public.questionnaire_review_requests where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_publication_reads where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_answers where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_responses where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_questions where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_sections where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  delete from public.questionnaires where id=v.questionnaire_id;
  return 'deleted';
end $function$;

CREATE OR REPLACE FUNCTION private.guard_questionnaire_content()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare v_id uuid; old_version uuid;
begin
  if tg_table_name = 'questionnaire_versions' then
    if old.status = 'distributed' then raise exception 'Published questionnaire is immutable' using errcode = '55000'; end if;
  else
    if tg_op <> 'INSERT' then old_version := old.version_id; end if;
    if tg_op <> 'DELETE' then v_id := new.version_id; end if;
    if exists (select 1 from public.questionnaire_versions where id in (v_id, old_version) and status = 'distributed') then
      raise exception 'Published questionnaire is immutable' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.import_legacy_text_questionnaire (
  p_source_version_id       uuid,
  p_expected_question_count integer
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$ begin
raise exception 'Legacy import retired locally; use the retained import ledger and a reviewed conversion plan' using errcode='55000';
end $function$;

CREATE OR REPLACE FUNCTION private.save_questionnaire_draft (
  p_document          jsonb,
  p_expected_revision integer,
  p_save_id           uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid := (p_document->>'versionId')::uuid;
  q_id uuid := (p_document->>'questionnaireId')::uuid;
  v public.questionnaire_versions%rowtype;
  s jsonb; q jsonb; source_id uuid; source_prompt text;
  si integer := 0; qi integer;
  section_ids uuid[] := '{}'; question_ids uuid[] := '{}';
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
      if jsonb_typeof(q->'text') is distinct from 'string' or jsonb_typeof(q->'details') is distinct from 'array' or jsonb_array_length(q->'details') <> 0 then raise exception 'Invalid question' using errcode='22023'; end if;
      source_id := (q->>'sourceQuestionId')::uuid;
      if source_id is null then
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
      qi := qi+1;
    end loop;
    si := si+1;
  end loop;
  if cardinality(section_ids) <> (select count(distinct x) from unnest(section_ids) x)
    or cardinality(question_ids) <> (select count(distinct x) from unnest(question_ids) x) then raise exception 'Duplicate IDs' using errcode='22023'; end if;
  delete from public.questionnaire_questions where version_id=v_id and not(id=any(question_ids));
  delete from public.questionnaire_sections where version_id=v_id and not(id=any(section_ids));
  perform private.validate_questionnaire_placements(v_id);
  update public.questionnaire_versions set title=p_document->>'title', revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $function$;

CREATE OR REPLACE FUNCTION public.read_published_questionnaire (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',case when q.source_question_id is null then q.body else (select source->>'prompt' from jsonb_array_elements(private.read_published_question_sources(v.id)) source where source->>'id'=q.source_question_id::text) end,'kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text,'details','[]'::jsonb) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('published','distributed') and exists(select 1 from public.questionnaires parent where parent.id=v.questionnaire_id and parent.archived_at is null)
;
$function$;

CREATE OR REPLACE FUNCTION public.read_questionnaire_draft (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',(select source.prompt from public.questions source where source.id=q.source_question_id and source.archived_at is null),'kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text,'details','[]'::jsonb) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('draft','published') and exists(select 1 from public.questionnaires p where p.id=v.questionnaire_id and p.created_by=(select auth.uid()) and p.archived_at is null)
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$function$;


COMMIT;
