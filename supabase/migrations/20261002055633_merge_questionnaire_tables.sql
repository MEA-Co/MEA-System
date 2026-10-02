begin;
set local lock_timeout='10s';
set local check_function_bodies=off;
lock table public.questionnaires, public.questionnaire_versions in access exclusive mode;
do $$ begin
 if exists(select 1 from public.questionnaires p left join public.questionnaire_versions v on v.questionnaire_id=p.id group by p.id having count(v.id)<>1)
 or exists(select 1 from public.questionnaire_versions where version_number<>1) then
  raise exception 'Questionnaire merge requires exactly one version numbered 1 per questionnaire';
 end if;
end $$;
create temporary table merge_original_parents on commit drop as select * from public.questionnaires;
create temporary table merge_original_versions on commit drop as select * from public.questionnaire_versions;


DROP POLICY "Read visible sections" ON "public"."questionnaire_sections";

DROP POLICY "Read visible questions" ON "public"."questionnaire_questions";

DROP POLICY "Staff read questionnaires" ON "public"."questionnaires";

DROP POLICY "Receive questionnaire change notifications" ON "realtime"."messages";

DROP POLICY "Read assigned or managed versions" ON "public"."questionnaire_versions";

DROP POLICY "Record own visible publication" ON "public"."questionnaire_publication_reads";

DROP POLICY "Receive own questionnaire response changes" ON "realtime"."messages";

alter table public.questionnaire_versions drop constraint questionnaire_versions_questionnaire_id_fkey;
alter table public.questionnaires set schema private;
alter table private.questionnaires rename to questionnaire_owners_before_merge;
alter table public.questionnaire_versions rename to questionnaires;
alter table public.questionnaires disable trigger user;
alter table public.questionnaires add column created_by uuid references public.profiles(id) on delete restrict,
 add column archived_at timestamptz, add column owner_created_at timestamptz;
update public.questionnaires v set created_by=p.created_by,archived_at=p.archived_at,owner_created_at=p.created_at from private.questionnaire_owners_before_merge p where p.id=v.questionnaire_id;
alter table public.questionnaires alter column created_by set not null,
 alter column owner_created_at set not null, alter column owner_created_at set default now();
alter table public.questionnaires rename column questionnaire_id to legacy_parent_id;
alter table public.questionnaires drop column version_number;
alter table public.questionnaires add constraint questionnaires_legacy_parent_id_key unique(legacy_parent_id);
create index questionnaires_owner_idx on public.questionnaires(created_by);
alter table public.questionnaires enable trigger user;
-- Read/update adapter for the previous parent ID used by existing RPC payloads.
-- This is a view of the single table, not a second source of questionnaire data.
create view private.questionnaire_owners with(security_invoker=true) as
 select legacy_parent_id as id,created_by,owner_created_at as created_at,archived_at from public.questionnaires;
revoke all on private.questionnaire_owners from public,anon,authenticated;
grant select on private.questionnaire_owners to authenticated;
create policy "Read managed or distributed questionnaires" on public.questionnaires for select to authenticated
 using ((select private.is_admin()) or (select private.is_consultant_lead()) or
 (status='distributed' and archived_at is null and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='consultant')));


CREATE POLICY "Read visible sections" ON "public"."questionnaire_sections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM questionnaires v
  WHERE (v.id = questionnaire_sections.version_id))));

CREATE POLICY "Read visible questions" ON "public"."questionnaire_questions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM questionnaires v
  WHERE (v.id = questionnaire_questions.version_id))));

CREATE POLICY "Receive questionnaire change notifications" ON "realtime"."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((extension = 'broadcast'::text) AND private AND (topic = ( SELECT realtime.topic() AS topic)) AND (((topic = 'questionnaires:staff'::text) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_consultant_lead() AS is_consultant_lead))) OR ((topic = 'questionnaires:distributed'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['admin'::text, 'consultant_lead'::text, 'consultant'::text])))))) OR ((topic = ('questionnaires:user:'::text || (( SELECT auth.uid() AS uid))::text)) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_consultant_lead() AS is_consultant_lead))))));

CREATE POLICY "Record own visible publication" ON "public"."questionnaire_publication_reads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_consultant_lead() AS is_consultant_lead)) AND (EXISTS ( SELECT 1
   FROM (questionnaires v
     JOIN private.questionnaire_owners q ON ((q.id = v.legacy_parent_id)))
  WHERE ((v.id = questionnaire_publication_reads.version_id) AND (v.status = 'published'::text) AND (q.archived_at IS NULL))))));

CREATE POLICY "Receive own questionnaire response changes" ON "realtime"."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((extension = 'broadcast'::text) AND private AND (topic = ( SELECT realtime.topic() AS topic)) AND (topic = ('questionnaires:user:'::text || (( SELECT auth.uid() AS uid))::text)) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = ANY (ARRAY['consultant'::text, 'consultant_lead'::text, 'admin'::text])))))));

CREATE OR REPLACE FUNCTION public.read_published_questionnaire(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.legacy_parent_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',case when q.source_question_id is null then q.body else (select source->>'prompt' from jsonb_array_elements(private.read_published_question_sources(v.id)) source where source->>'id'=q.source_question_id::text) end,'kind',coalesce(q.kind,'text'),'options',coalesce(q.options,'[]'::jsonb),'scaleConfig',coalesce(q.scale_config,'{"max":5,"low":"전혀 그렇지 않다","middle":"보통이다","high":"매우 그렇다","allowText":false}'::jsonb),'choiceStyle',coalesce(q.choice_style,'list'),'choiceAllowText',coalesce(q.choice_allow_text,false),'details','[]'::jsonb) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaires v where v.id=p_version_id and v.status in ('published','distributed') and exists(select 1 from private.questionnaire_owners parent where parent.id=v.legacy_parent_id and parent.archived_at is null)
;
$function$;

CREATE OR REPLACE FUNCTION private.read_published_question_sources(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','consultant_lead','consultant')) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.questionnaires v
    join private.questionnaire_owners parent on parent.id=v.legacy_parent_id
    where v.id=p_version_id and (v.status='distributed' or (v.status='published' and (private.is_admin() or private.is_consultant_lead()))) and parent.archived_at is null
  ) then raise exception 'Published questionnaire not found' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',q.id,'created_by',q.created_by,'title',q.title,'prompt',q.prompt,
        'fields',q.fields,'row_mode',q.row_mode,'max_rows',q.max_rows,
        'min_rows',q.min_rows,'row_labels',q.row_labels,
        'source_block_id',q.source_block_id,'source_field_id',q.source_field_id,
        'after_block_id',q.after_block_id,'condition',q.condition,
        'revision',q.revision,'created_at',q.created_at,'updated_at',q.updated_at,'archived_at',q.archived_at,
        'details',coalesce((select jsonb_agg(jsonb_build_object(
          'id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants,'position',d.position
        ) order by d.position,d.id) from public.question_details d where d.question_id=q.id and (d.visible_to_consultants or private.is_admin() or private.is_consultant_lead())),'[]'::jsonb)
      ) order by q.id
    ) from public.questions q where exists (
      select 1 from public.questionnaire_questions p where p.version_id=p_version_id and p.source_question_id=q.id
    )
  ),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION private.guard_distributed_question()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.distribution_locked_at is not null then
  if tg_op='UPDATE' and new.distribution_locked_at is null
   and (to_jsonb(new)-array['distribution_locked_at','updated_at','search_text'])=(to_jsonb(old)-array['distribution_locked_at','updated_at','search_text'])
   and not exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.version_id where p.source_question_id=old.id and v.status='distributed') then
    return new;
  end if;
  raise exception 'Distributed question is immutable' using errcode='55000';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid := (p_document->>'versionId')::uuid;
  q_id uuid := (p_document->>'questionnaireId')::uuid;
  v public.questionnaires%rowtype;
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
  select * into v from public.questionnaires where id = v_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'Questionnaire conflict' using errcode = '40001'; end if;
    insert into public.questionnaires(id, legacy_parent_id, created_by) values(v_id, q_id, auth.uid()) returning * into v;
  end if;
  if not exists(select 1 from private.questionnaire_owners where id=v.legacy_parent_id and created_by=auth.uid()) then raise exception 'Only the creator can edit' using errcode='42501'; end if;
  if v.legacy_parent_id <> q_id or v.status not in ('draft','published') or exists(select 1 from private.questionnaire_owners where id=q_id and archived_at is not null) then
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
        -- No source definition is copied into placement storage.
      end if;
      question_ids := array_append(question_ids,(q->>'id')::uuid);
      if (q->>'id')::uuid is null or (q->>'logicalKey')::uuid is null or exists(select 1 from public.questionnaire_questions where id=(q->>'id')::uuid and (version_id<>v_id or logical_key<>(q->>'logicalKey')::uuid)) then raise exception 'Invalid question ID' using errcode='22023'; end if;
      insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position,kind,options,scale_config,choice_style,choice_allow_text,source_question_id)
        values((q->>'id')::uuid,v_id,(s->>'id')::uuid,(q->>'logicalKey')::uuid,null,qi,null,null,null,null,null,source_id)
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
  update public.questionnaires set title=p_document->>'title', revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $function$;

CREATE OR REPLACE FUNCTION public.read_questionnaire_draft(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.legacy_parent_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',(select source.prompt from public.questions source where source.id=q.source_question_id and source.archived_at is null),'kind',coalesce(q.kind,'text'),'options',coalesce(q.options,'[]'::jsonb),'scaleConfig',coalesce(q.scale_config,'{"max":5,"low":"전혀 그렇지 않다","middle":"보통이다","high":"매우 그렇다","allowText":false}'::jsonb),'choiceStyle',coalesce(q.choice_style,'list'),'choiceAllowText',coalesce(q.choice_allow_text,false),'details','[]'::jsonb) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaires v where v.id=p_version_id and v.status in ('draft','published') and exists(select 1 from private.questionnaire_owners p where p.id=v.legacy_parent_id and p.created_by=(select auth.uid()) and p.archived_at is null)
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$function$;

CREATE OR REPLACE FUNCTION private.distribute_questionnaire(p_version_id uuid, p_expected_revision integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.questionnaires%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaires where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from private.questionnaire_owners where id=v.legacy_parent_id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from private.questionnaire_owners where id=v.legacy_parent_id and created_by=auth.uid()) then raise exception 'Only the creator can publish or distribute' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire conflict' using errcode='40001'; end if;
  if v.status='distributed' then return; end if;
  if v.status<>'published' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where version_id=v.id)
    or exists(select 1 from public.questionnaire_questions where version_id=v.id and source_question_id is null and btrim(body)='') then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  update public.questionnaires set status='distributed',distributed_at=now(),updated_at=now() where id=v.id;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_placed_question_archive()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.archived_at is not null and old.archived_at is null and exists (
    select 1 from public.questionnaire_questions p
    join public.questionnaires v on v.id=p.version_id
    join private.questionnaire_owners parent on parent.id=v.legacy_parent_id
    where p.source_question_id=new.id and parent.archived_at is null
  ) then raise exception 'Question is used by a questionnaire' using errcode='55000'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.read_guide_answers(p_question_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if cardinality(p_question_ids)>500 then raise exception 'Too many questions' using errcode='22023'; end if;
 return coalesce((select jsonb_object_agg(q.id::text,jsonb_build_object('rows',shown.rows)) from public.questions q cross join lateral (
 select r.rows,r.active_row_ids,v.definition from public.question_responses r join public.response_sessions s on s.id=r.session_id join public.question_versions v on v.id=r.question_version_id where v.question_id=q.id and s.respondent_id=private.guide_consultant_id() order by r.updated_at desc,r.id limit 1
 
 ) a cross join lateral (
 select coalesce(jsonb_agg(jsonb_build_object('id',row.value->'id','label',coalesce(nullif(btrim(q.row_labels->>(row.ord::int-1)),''),row.ord::text),'answers',row.value->'answers') order by row.ord),'[]') rows
 from jsonb_array_elements(a.rows) with ordinality row(value,ord)
 where a.active_row_ids @> jsonb_build_array(row.value->'id')
 and exists(select 1 from jsonb_array_elements(q.fields) f where private.question_field_response_valid(f,coalesce(row.value->'answers'->>(f->>'id'),''),true))
 ) shown where q.id=any(p_question_ids) and q.archived_at is null and jsonb_array_length(shown.rows)>0 and private.response_structure(a.definition)=private.response_structure(private.live_response_definition(q.id)) and (q.created_by=auth.uid() or private.is_admin() or exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.version_id join private.questionnaire_owners parent on parent.id=v.legacy_parent_id where p.source_question_id=q.id and v.status='published' and parent.archived_at is null))),'{}');
end $function$;

CREATE OR REPLACE FUNCTION private.guard_questionnaire_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid; old_version uuid;
begin
 if tg_table_name='questionnaires' then
  if old.status='distributed' then
   if tg_op='UPDATE' and (to_jsonb(new)-'archived_at')=(to_jsonb(old)-'archived_at') then return new; end if;
   if tg_op='UPDATE' and new.status in ('draft','published')
    and new.distributed_at is null and new.revision=old.revision+1
    and (to_jsonb(new)-array['status','distributed_at','published_at','revision','updated_at']) = (to_jsonb(old)-array['status','distributed_at','published_at','revision','updated_at']) then
     perform pg_advisory_xact_lock(hashtextextended(old.id::text,0));
     if private.has_saved_distribution_responses(old.id) then
      raise exception 'Saved responses prevent distribution withdrawal' using errcode='55000';
     end if;
   else raise exception 'Published questionnaire is immutable' using errcode='55000'; end if;
  end if;
 else
  if tg_op<>'INSERT' then old_version:=old.version_id; end if;
  if tg_op<>'DELETE' then v_id:=new.version_id; end if;
  if exists(select 1 from public.questionnaires where id in(v_id,old_version) and status='distributed') then
   raise exception 'Published questionnaire is immutable' using errcode='55000';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.reject_deleted_questionnaire_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists(select 1 from private.deleted_questionnaire_versions where version_id=new.id) then
    raise exception 'Questionnaire was deleted' using errcode='55000';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.publish_questionnaire(p_version_id uuid, p_expected_revision integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.questionnaires%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaires where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from private.questionnaire_owners where id=v.legacy_parent_id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from private.questionnaire_owners where id=v.legacy_parent_id and created_by=auth.uid()) then raise exception 'Only the creator can publish or distribute' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire conflict' using errcode='40001'; end if;
  if v.status='published' then return; end if;
  if v.status<>'draft' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where version_id=v.id)
     then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  perform private.validate_questionnaire_placements(v.id);
  update public.questionnaires set status='published',published_at=now(),updated_at=now() where id=v.id;
end $function$;

CREATE OR REPLACE FUNCTION private.delete_questionnaire(p_version_id uuid, p_expected_revision integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.questionnaires%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaires where id=p_version_id for update;
  if not found then
    if exists(select 1 from private.deleted_questionnaire_versions where version_id=p_version_id) then return 'deleted'; end if;
    raise exception 'Questionnaire not found' using errcode='P0002';
  end if;
  if not private.is_admin() and not exists(select 1 from private.questionnaire_owners where id=v.legacy_parent_id and created_by=auth.uid()) then raise exception 'Only creator or admin can delete' using errcode='42501'; end if;
  -- Serialize changes to the entire questionnaire, including insertion/publication
  -- of other versions, before deciding whether any distributed history exists.
  perform 1 from private.questionnaire_owners where id=v.legacy_parent_id for update;
  perform 1 from public.questionnaires where legacy_parent_id=v.legacy_parent_id order by id for update;
  if exists(select 1 from private.questionnaire_owners where id=v.legacy_parent_id and archived_at is not null)
    and exists(select 1 from public.questionnaires where legacy_parent_id=v.legacy_parent_id and status='distributed') then return 'archived'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire changed' using errcode='40001'; end if;
  if exists(select 1 from public.questionnaires where legacy_parent_id=v.legacy_parent_id and status='distributed') then
    update private.questionnaire_owners set archived_at=coalesce(archived_at,clock_timestamp()) where id=v.legacy_parent_id;
    return 'archived';
  end if;
  insert into private.deleted_questionnaire_versions(version_id)
    select id from public.questionnaires where legacy_parent_id=v.legacy_parent_id;
  -- Delete every dependent row for a never-distributed questionnaire atomically.
  
  delete from public.questionnaire_publication_reads where version_id in (select id from public.questionnaires where legacy_parent_id=v.legacy_parent_id);
  delete from public.questionnaire_questions where version_id in (select id from public.questionnaires where legacy_parent_id=v.legacy_parent_id);
  delete from public.questionnaire_sections where version_id in (select id from public.questionnaires where legacy_parent_id=v.legacy_parent_id);
  delete from public.questionnaires where legacy_parent_id=v.legacy_parent_id;
  delete from private.questionnaire_owners where id=v.legacy_parent_id;
  return 'deleted';
end $function$;

CREATE OR REPLACE FUNCTION private.can_read_distributed_questionnaire(p_questionnaire_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null
 and exists(select 1 from public.profiles where id=auth.uid() and role='consultant')
 and exists(select 1 from private.questionnaire_owners q join public.questionnaires v on v.legacy_parent_id=q.id
   where q.id=p_questionnaire_id and q.archived_at is null and v.status='distributed');
$function$;

CREATE OR REPLACE FUNCTION public.unread_questionnaire_publications()
 RETURNS TABLE(version_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select v.id from public.questionnaires v join private.questionnaire_owners q on q.id=v.legacy_parent_id
 where ((select private.is_admin()) or (select private.is_consultant_lead()))
 and v.status='published' and q.archived_at is null and q.created_by<>(select auth.uid())
 and not exists(select 1 from public.questionnaire_publication_reads r where r.user_id=(select auth.uid()) and r.version_id=v.id);
$function$;

CREATE OR REPLACE FUNCTION public.mark_questionnaire_publication_read(p_version_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 insert into public.questionnaire_publication_reads(user_id,version_id)
 select (select auth.uid()),v.id from public.questionnaires v join private.questionnaire_owners q on q.id=v.legacy_parent_id
 where v.id=p_version_id and v.status='published' and q.archived_at is null
 and ((select private.is_admin()) or (select private.is_consultant_lead()))
 on conflict(user_id,version_id) do nothing;
$function$;

CREATE OR REPLACE FUNCTION public.unread_distributed_questionnaires()
 RETURNS TABLE(version_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select v.id from public.questionnaires v join private.questionnaire_owners q on q.id=v.legacy_parent_id where v.status='distributed' and q.archived_at is null
 and not exists(select 1 from public.response_sessions r where r.origin_version_id=v.id and r.respondent_id=(select auth.uid()));
$function$;

CREATE OR REPLACE FUNCTION private.sync_published_response_layout(target uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; origin uuid; current_title text; current_layout jsonb;
        item record; ver uuid; answer_id uuid;
begin
 sid := private.owned_published_session(target);
 select origin_version_id into origin from public.response_sessions where id=sid;
 if origin is null then return sid; end if;
 perform pg_advisory_xact_lock(hashtextextended(origin::text,0));
 select v.title into current_title from public.questionnaires v
 join private.questionnaire_owners q on q.id=v.legacy_parent_id
 where v.id=origin and v.status='published' and q.archived_at is null;
 if not found then return sid; end if;
 -- Match the source-before-session lock order used by answer saving.
 perform 1 from public.questions q where
 exists(select 1 from public.questionnaire_questions p where p.version_id=origin and p.source_question_id=q.id)
 or exists(select 1 from public.question_responses r join public.question_versions v on v.id=r.question_version_id where r.session_id=sid and v.question_id=q.id)
 order by q.id for share;
 perform 1 from public.response_sessions where id=sid for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',
   coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id)
     from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
     where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id),'[]'::jsonb)
 into current_layout from public.questionnaire_sections s where s.version_id=origin;
 for item in select p.id placement_id,q.id question_id,q.revision,private.live_response_definition(q.id) definition
 from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
 where p.version_id=origin order by p.id loop
   select r.id into answer_id from public.question_responses r join public.question_versions v on v.id=r.question_version_id
   where r.session_id=sid and v.question_id=item.question_id;
   if answer_id is null then
     insert into public.question_versions(question_id,source_revision,definition)
     values(item.question_id,item.revision,item.definition) on conflict(question_id,source_revision) do nothing;
     select id into ver from public.question_versions where question_id=item.question_id and source_revision=item.revision;
     insert into public.question_responses(session_id,question_version_id,origin_placement_id)
     values(sid,ver,item.placement_id);
   else
     update public.question_responses set origin_placement_id=item.placement_id
     where id=answer_id and origin_placement_id is distinct from item.placement_id;
   end if;
 end loop;
 update public.question_responses r set referenced_response_id=src.id
 from public.question_versions v,public.questions q,public.question_responses src,public.question_versions sv
 where r.session_id=sid and r.question_version_id=v.id and v.question_id=q.id
 and src.session_id=sid and src.question_version_id=sv.id and q.source_block_id=sv.question_id
 and r.referenced_response_id is distinct from src.id;
 update public.response_sessions set layout=current_layout,origin_title=current_title,
 last_payload=null,last_save_id=null
 where id=sid and (layout is distinct from current_layout or origin_title is distinct from current_title);
 return sid;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_questionnaire_choices_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.status in ('published','distributed') and old.status is distinct from new.status
    and exists (
      select 1 from public.questionnaire_questions
      where source_question_id is null and version_id = new.id and (
        not private.question_config_valid(kind,options,true)
        or (kind = 'scale' and not private.scale_config_valid(scale_config,true))
      )
    ) then
    raise exception 'Question choices or scale labels are incomplete' using errcode='22023';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.change_questionnaire_status(p_version_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.questionnaires%rowtype;
  parent private.questionnaire_owners%rowtype;
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
  select * into v from public.questionnaires where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  select * into parent from private.questionnaire_owners where id=v.legacy_parent_id for update;
  if parent.created_by <> auth.uid() and not (p_status='archived' and private.is_admin()) then
    raise exception 'Only creator can change status' using errcode='42501';
  end if;
  if v.revision <> p_expected_revision or v.status <> p_expected_status
    or parent.archived_at is distinct from p_expected_archived_at then
    raise exception 'Questionnaire conflict' using errcode='40001';
  end if;
  if p_status='archived' then
    update private.questionnaire_owners set archived_at=coalesce(archived_at,clock_timestamp()) where id=parent.id;
  elsif v.status='distributed' and p_status in ('draft','published') then
    if parent.archived_at is not null then raise exception 'Restore archived questionnaire first' using errcode='55000'; end if;
    perform 1 from public.questions source where exists(select 1 from public.questionnaire_questions p where p.version_id=v.id and p.source_question_id=source.id) order by source.id for update;
    perform 1 from public.response_sessions where origin_version_id=v.id and started_stage='distributed' order by id for update;
    if private.has_saved_distribution_responses(v.id) then
      raise exception 'Saved responses prevent distribution withdrawal' using errcode='55000';
    end if;
    -- Preserve empty view-only records, but do not reuse their old layout on redistribution.
    update public.response_sessions set origin_version_id=null where origin_version_id=v.id and started_stage='distributed';
    update public.questionnaires set status=p_status,distributed_at=null,
      published_at=case when p_status='published' then coalesce(published_at,clock_timestamp()) else null end,
      revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    update public.questions source set distribution_locked_at=null
      where source.distribution_locked_at is not null
      and exists(select 1 from public.questionnaire_questions p where p.version_id=v.id and p.source_question_id=source.id)
      and not exists(select 1 from public.questionnaire_questions p join public.questionnaires dv on dv.id=p.version_id where p.source_question_id=source.id and dv.status='distributed');

  else
    if v.status='distributed' and p_status <> 'distributed' then
      raise exception 'Distributed version is immutable' using errcode='55000';
    end if;
    if parent.archived_at is not null then
      -- A referenced source may have been archived while this document was hidden.
      perform private.validate_questionnaire_placements(v.id);
      update private.questionnaire_owners set archived_at=null where id=parent.id;
    end if;
    if p_status='draft' and v.status='published' then
      update public.questionnaires set status='draft',published_at=null,revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    elsif p_status='published' and v.status='draft' then
      perform private.publish_questionnaire(v.id,v.revision);
      update public.questionnaires set revision=revision+1 where id=v.id;
    elsif p_status='distributed' and v.status <> 'distributed' then
      if v.status='draft' then perform private.publish_questionnaire(v.id,v.revision); end if;
      -- Existing validation and placement response protection remain authoritative.
      -- Advance revision before distribution, since distributed rows are immutable.
      update public.questionnaires set revision=revision+1 where id=v.id;
      perform private.distribute_questionnaire(v.id,v.revision+1);
    end if;
  end if;
  result := jsonb_build_object('versionId',target_id,'copied',target_id<>p_version_id);
  insert into private.questionnaire_status_requests(id,actor_id,payload_hash,result)
    values(p_request_id,auth.uid(),fingerprint,result);
  return result;
end $function$;

CREATE OR REPLACE FUNCTION private.can_read_question_reviews(qid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists (
 select 1 from public.questions q where q.id=qid and (q.created_by=auth.uid() or private.is_admin() or exists(
 select 1 from public.question_review_requests r where r.question_id=qid and r.requested_by=auth.uid()) or (q.archived_at is null and exists (
 select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.version_id join private.questionnaire_owners d on d.id=v.legacy_parent_id where p.source_question_id=qid and v.status='published' and d.archived_at is null))));
$function$;

CREATE OR REPLACE FUNCTION private.read_question_reviews(qid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare owner_id uuid; published boolean; begin
 if not private.can_read_question_reviews(qid) then raise exception 'Review access denied' using errcode='42501'; end if;
 select created_by into owner_id from public.questions where id=qid;
 select exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.version_id join private.questionnaire_owners d on d.id=v.legacy_parent_id join public.questions q on q.id=p.source_question_id where q.id=qid and q.archived_at is null and v.status='published' and d.archived_at is null) into published;
 return jsonb_build_object('canResolve',owner_id=auth.uid() or private.is_admin(),'canRequest',private.can_request_question_review(qid,null),'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.question_review_requests r where r.question_id=qid),'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION private.assert_published_response_access(p_version_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.can_write_guide_answers() or not exists(
 select 1 from public.questionnaires v join private.questionnaire_owners q on q.id=v.legacy_parent_id
 where v.id=p_version_id and v.status='published' and q.archived_at is null
 ) then raise exception 'Published response access denied' using errcode='42501'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.open_question_response_session(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; item jsonb; ver uuid; sources jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 select id into sid from public.response_sessions where (id=p_version_id or origin_version_id=p_version_id) and respondent_id=auth.uid() and started_stage='published';
 if sid is not null then return private.read_question_response_session(p_version_id); end if;
 perform private.assert_published_response_access(p_version_id);
 if not exists(select 1 from public.questionnaire_questions where version_id=p_version_id) or exists(select 1 from public.questionnaire_questions where version_id=p_version_id and source_question_id is null) then
 raise exception 'Source questions required' using errcode='22023'; end if;
 -- Locks source rows against concurrent save_question while capturing all definitions.
 perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.version_id=p_version_id and p.source_question_id=q.id) order by q.id for share;
 perform private.validate_questionnaire_placements(p_version_id);
 sources:=private.read_published_question_sources(p_version_id);
 insert into public.response_sessions(respondent_id,origin_version_id,origin_title,started_role,started_stage,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'published',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_version_id returning id into sid;
 for item in select value from jsonb_array_elements(sources) loop
 insert into public.question_versions(question_id,source_revision,definition) values((item->>'id')::uuid,(item->>'revision')::integer,item)
 on conflict(question_id,source_revision) do nothing;
 select id into ver from public.question_versions where question_id=(item->>'id')::uuid and source_revision=(item->>'revision')::integer;
 insert into public.question_responses(session_id,question_version_id,origin_placement_id)
 select sid,ver,p.id from public.questionnaire_questions p where p.version_id=p_version_id and p.source_question_id=(item->>'id')::uuid;
 end loop;
 update public.question_responses r set referenced_response_id=src.id from public.question_versions q,public.question_responses src,public.question_versions sq
 where r.session_id=sid and r.question_version_id=q.id and src.session_id=sid and src.question_version_id=sq.id and q.definition->>'source_block_id'=sq.question_id::text;
 return private.read_question_response_session(p_version_id);
end $function$;

CREATE OR REPLACE FUNCTION private.notify_questionnaire_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  notify_distributed boolean := false;
  receipt_user uuid;
begin
  if auth.uid() is null then return null; end if;

  if tg_table_name = 'questionnaire_publication_reads' then
    if tg_op = 'DELETE' then receipt_user := old.user_id;
    else receipt_user := new.user_id; end if;
    perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:user:' || receipt_user::text, true);
    return null;
  elsif tg_table_name = 'questionnaires' then
    if tg_op = 'INSERT' then
      -- The save RPC finishes by incrementing revision; no notification for
      -- its initial, empty version row is necessary.
      if new.revision = 0 then return null; end if;
      notify_distributed := new.status = 'distributed';
    elsif tg_op = 'UPDATE' then
      if new.revision = old.revision and new.status = old.status and new.archived_at is not distinct from old.archived_at then return null; end if;
      notify_distributed := new.status = 'distributed' or old.status = 'distributed';
    else
      notify_distributed := old.status = 'distributed';
    end if;
  elsif tg_table_name <> 'question_review_requests' then
    return null;
  end if;

  perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:staff', true);
  if notify_distributed then
    perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:distributed', true);
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.published_questionnaire_authors()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('versionId',v.id,'name',p.name))
 from public.questionnaires v
 join private.questionnaire_owners q on q.id=v.legacy_parent_id
 join public.profiles p on p.id=q.created_by
 where v.status='published' and q.archived_at is null),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION private.question_review_counts()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)) from (
 select p.version_id,count(distinct r.id) as count,
 count(distinct r.id) filter (where exists(select 1 from public.questions source where source.id=r.question_id and source.created_by=auth.uid()) and r.requested_by<>auth.uid() and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid())) as unread_count
 from public.questionnaire_questions p join public.questionnaires v on v.id=p.version_id join private.questionnaire_owners d on d.id=v.legacy_parent_id join public.question_review_requests r on r.question_id=p.source_question_id and r.resolved_at is null
 where private.can_read_question_reviews(r.question_id) and (d.created_by=auth.uid() or private.is_admin() or (v.status='published' and d.archived_at is null)) group by p.version_id
 ) c),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION private.assert_distributed_response_access(p_version_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) or not exists(select 1 from public.questionnaires v join private.questionnaire_owners q on q.id=v.legacy_parent_id where v.id=p_version_id and v.status='distributed' and q.archived_at is null) then raise exception 'Distributed response access denied' using errcode='42501'; end if;
 -- New placement distribution remains intentionally disabled at this stage.
 if exists(select 1 from public.questionnaire_questions where version_id=p_version_id and source_question_id is not null) then raise exception 'Placement distribution is not supported' using errcode='22023'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.open_distributed_response(p_version_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; q public.questionnaire_questions%rowtype; qv uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 perform private.assert_distributed_response_access(p_version_id);
 select id into sid from public.response_sessions where origin_version_id=p_version_id and respondent_id=auth.uid();
 if sid is not null then return sid; end if;
 insert into public.response_sessions(respondent_id,origin_version_id,origin_title,started_role,started_stage,status,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'distributed','assigned',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_version_id returning id into sid;
 for q in select * from public.questionnaire_questions where version_id=p_version_id order by id loop
 insert into public.question_versions(legacy_question_id,source_revision,definition)
 values(q.id,0,jsonb_build_object('id',q.id,'prompt',q.body,'fields',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',q.id,'label','답변','kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text))),'row_mode','single','legacy',true))
 on conflict(legacy_question_id) where legacy_question_id is not null do nothing;
 select id into qv from public.question_versions where legacy_question_id=q.id;
 insert into public.question_responses(session_id,question_version_id,origin_placement_id) values(sid,qv,q.id);
 end loop;
 return sid;
end $function$;

CREATE OR REPLACE FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_version_id uuid, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.profiles%rowtype; rev integer; begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.role not in ('admin','consultant_lead') then raise exception 'Staff required' using errcode='42501'; end if;
 if p_id is null or p_description is null or length(btrim(p_description)) not between 1 and 5000 then raise exception 'Invalid review' using errcode='22023'; end if;
 select revision into rev from public.questions where id=p_question_id and archived_at is null and created_by<>auth.uid() for share;
 if not found then raise exception 'Question unavailable' using errcode='42501'; end if;
 perform 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.version_id join private.questionnaire_owners d on d.id=v.legacy_parent_id where p.source_question_id=p_question_id and v.status='published' and d.archived_at is null and (p_origin_version_id is null or v.id=p_origin_version_id) for share of p,v,d;
 if not found then raise exception 'Published question required' using errcode='42501'; end if;
 insert into public.question_review_requests(id,question_id,origin_version_id,question_revision,requested_by,requester_name,description,title) values(p_id,p_question_id,p_origin_version_id,rev,actor.id,actor.name,btrim(p_description),'') on conflict(id) do nothing;
 if not exists(select 1 from public.question_review_requests where id=p_id and question_id=p_question_id and requested_by=actor.id and description=btrim(p_description) and origin_version_id is not distinct from p_origin_version_id) then raise exception 'Review conflict' using errcode='40001'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.distributed_response_statuses()
 RETURNS TABLE(version_id uuid, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select s.origin_version_id,s.status from public.response_sessions s join public.questionnaires v on v.id=s.origin_version_id where s.respondent_id=(select auth.uid()) and v.status='distributed';
$function$;

CREATE OR REPLACE FUNCTION private.can_request_question_review(qid uuid, origin_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists(
 select 1 from public.questions q join public.questionnaire_questions p on p.source_question_id=q.id join public.questionnaires v on v.id=p.version_id join private.questionnaire_owners d on d.id=v.legacy_parent_id
 where q.id=qid and q.created_by<>auth.uid() and q.archived_at is null and d.archived_at is null and v.status='published' and (origin_id is null or v.id=origin_id));
$function$;

-- Verify every original version field and parent field before removing the redundant table.
do $$ begin
 if exists(select 1 from merge_original_versions o full join public.questionnaires n on n.id=o.id where o.id is null or n.id is null or
 (to_jsonb(o)-array['questionnaire_id','version_number']) is distinct from
 (to_jsonb(n)-array['legacy_parent_id','created_by','archived_at','owner_created_at']) or o.questionnaire_id is distinct from n.legacy_parent_id)
 or exists(select 1 from merge_original_parents o full join private.questionnaire_owners n on n.id=o.id where to_jsonb(o) is distinct from to_jsonb(n)) then
 raise exception 'Questionnaire merge data preservation check failed'; end if;
end $$;
drop table private.questionnaire_owners_before_merge;
notify pgrst,'reload schema';
commit;
