begin;
-- Refuse deletion if new legacy data has appeared since the inventory.
lock table public.questionnaire_answers, public.questionnaire_responses in access exclusive mode;
do $$ begin
 if exists(select 1 from public.questionnaire_answers) or exists(select 1 from public.questionnaire_responses) then
 raise exception 'Legacy response tables must be empty before removal' using errcode='55000';
 end if;
end $$;

SET local check_function_bodies = off;

DROP POLICY "Read own answers" ON "public"."questionnaire_answers";

ALTER TABLE "public"."questionnaire_answers"
  DROP CONSTRAINT "questionnaire_answers_question_id_version_id_fkey";

ALTER TABLE "public"."questionnaire_answers"
  DROP CONSTRAINT "questionnaire_answers_response_id_version_id_fkey";

ALTER TABLE "public"."questionnaire_responses"
  DROP CONSTRAINT "questionnaire_responses_assigned_by_fkey";

ALTER TABLE "public"."questionnaire_responses"
  DROP CONSTRAINT "questionnaire_responses_respondent_id_fkey";

ALTER TABLE "public"."questionnaire_responses"
  DROP CONSTRAINT "questionnaire_responses_version_id_fkey";

DROP FUNCTION "private"."assert_legacy_response_migrated"(uuid);

DROP FUNCTION "private"."migrate_legacy_question_responses"();

DROP FUNCTION "private"."verify_legacy_question_response_migration"();

DROP TABLE "public"."questionnaire_answers";

DROP TABLE "public"."questionnaire_responses";

DROP FUNCTION "private"."guard_submitted_answers"();

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
  delete from public.questionnaire_questions where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_sections where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  delete from public.questionnaires where id=v.questionnaire_id;
  return 'deleted';
end $function$;

CREATE OR REPLACE FUNCTION private.open_distributed_response (
  p_version_id uuid
)
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
 from public.questionnaire_versions v where v.id=p_version_id returning id into sid;
 for q in select * from public.questionnaire_questions where version_id=p_version_id order by id loop
 insert into public.question_versions(legacy_question_id,source_revision,definition)
 values(q.id,0,jsonb_build_object('id',q.id,'prompt',q.body,'fields',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',q.id,'label','답변','kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text))),'row_mode','single','legacy',true))
 on conflict(legacy_question_id) where legacy_question_id is not null do nothing;
 select id into qv from public.question_versions where legacy_question_id=q.id;
 insert into public.question_responses(session_id,question_version_id,origin_placement_id) values(sid,qv,q.id);
 end loop;
 return sid;
end $function$;

CREATE OR REPLACE FUNCTION private.read_distributed_response (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.response_sessions%rowtype;
begin
 perform private.assert_distributed_response_access(p_version_id);
 select * into s from public.response_sessions where origin_version_id=p_version_id and respondent_id=auth.uid();
 return jsonb_build_object('revision',coalesce(s.revision,0),'status',coalesce(s.status,'assigned'),'savedAt',case when s.revision>0 then s.updated_at else null end,'freeResponse',coalesce(s.free_response,''),'answers',coalesce((select jsonb_object_agg(r.origin_placement_id::text,coalesce(r.rows#>>array['0','answers',r.origin_placement_id::text],'')) from public.question_responses r where r.session_id=s.id),'{}'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.distributed_response_statuses()
  RETURNS TABLE (
    version_id uuid,
    status     text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select s.origin_version_id,s.status from public.response_sessions s join public.questionnaire_versions v on v.id=s.origin_version_id where s.respondent_id=(select auth.uid()) and v.status='distributed';
$function$;

CREATE OR REPLACE FUNCTION public.unread_distributed_questionnaires()
  RETURNS TABLE (
    version_id uuid
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select v.id from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id where v.status='distributed' and q.archived_at is null
 and not exists(select 1 from public.response_sessions r where r.origin_version_id=v.id and r.respondent_id=(select auth.uid()));
$function$;


notify pgrst, 'reload schema';

commit;
