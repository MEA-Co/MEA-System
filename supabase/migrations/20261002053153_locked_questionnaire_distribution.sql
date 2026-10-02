begin;
SET local check_function_bodies = off;

ALTER TABLE "public"."questions"
  ADD COLUMN "distribution_locked_at" timestamp WITH time zone;

CREATE OR REPLACE FUNCTION private.distribute_questionnaire (
  p_version_id        uuid,
  p_expected_revision integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    or exists(select 1 from public.questionnaire_questions where version_id=v.id and source_question_id is null and btrim(body)='') then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  update public.questionnaire_versions set status='distributed',distributed_at=now(),updated_at=now() where id=v.id;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_distributed_question()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 if old.distribution_locked_at is not null then
  raise exception 'Distributed question is immutable' using errcode='55000';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_distributed_question_detail()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare old_id uuid; new_id uuid; locked timestamptz; q record;
begin
 if tg_op<>'INSERT' then old_id:=old.question_id; end if;
 if tg_op<>'DELETE' then new_id:=new.question_id; end if;
 for q in select id,distribution_locked_at from public.questions where id in(old_id,new_id) order by id for update loop
  if q.distribution_locked_at is not null then
   raise exception 'Distributed question is immutable' using errcode='55000';
  end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_questionnaire_placement_publication()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 if new.status is distinct from old.status and new.status in ('published','distributed') then
  perform private.validate_questionnaire_placements(new.id);
  if new.status='distributed' then
   -- Serialize with original edits and review creation, including requests from other questionnaires.
   perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.version_id=new.id and p.source_question_id=q.id) order by q.id for update;
   perform private.validate_questionnaire_placements(new.id);
   if exists(select 1 from public.questionnaire_questions p join public.question_review_requests r on r.question_id=p.source_question_id where p.version_id=new.id and r.resolved_at is null) then
    raise exception 'Unresolved question reviews prevent distribution' using errcode='55000';
   end if;
   update public.questions q set distribution_locked_at=clock_timestamp()
   where distribution_locked_at is null and exists(select 1 from public.questionnaire_questions p where p.version_id=new.id and p.source_question_id=q.id);
  end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.read_published_question_sources (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','consultant_lead','consultant')) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.questionnaire_versions v
    join public.questionnaires parent on parent.id=v.questionnaire_id
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

CREATE TRIGGER a_distributed_question_detail_lock
  BEFORE INSERT OR DELETE OR UPDATE ON public.question_details
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_distributed_question_detail();

CREATE TRIGGER a_distributed_question_lock
  BEFORE DELETE OR UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_distributed_question();

REVOKE ALL ON FUNCTION "private"."guard_distributed_question"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_distributed_question"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_distributed_question_detail"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_distributed_question_detail"() TO "postgres";


notify pgrst, 'reload schema';
commit;
