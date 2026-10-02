begin;
SET local check_function_bodies = off;

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
  elsif v.status='distributed' and p_status in ('draft','published') then
    if parent.archived_at is not null then raise exception 'Restore archived questionnaire first' using errcode='55000'; end if;
    perform 1 from public.questions source where exists(select 1 from public.questionnaire_questions p where p.version_id=v.id and p.source_question_id=source.id) order by source.id for update;
    perform 1 from public.response_sessions where origin_version_id=v.id and started_stage='distributed' order by id for update;
    if private.has_saved_distribution_responses(v.id) then
      raise exception 'Saved responses prevent distribution withdrawal' using errcode='55000';
    end if;
    -- Preserve empty view-only records, but do not reuse their old layout on redistribution.
    update public.response_sessions set origin_version_id=null where origin_version_id=v.id and started_stage='distributed';
    update public.questionnaire_versions set status=p_status,distributed_at=null,
      published_at=case when p_status='published' then coalesce(published_at,clock_timestamp()) else null end,
      revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    update public.questions source set distribution_locked_at=null
      where source.distribution_locked_at is not null
      and exists(select 1 from public.questionnaire_questions p where p.version_id=v.id and p.source_question_id=source.id)
      and not exists(select 1 from public.questionnaire_questions p join public.questionnaire_versions dv on dv.id=p.version_id where p.source_question_id=source.id and dv.status='distributed');

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

CREATE OR REPLACE FUNCTION private.guard_distributed_question()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 if old.distribution_locked_at is not null then
  if tg_op='UPDATE' and new.distribution_locked_at is null
   and (to_jsonb(new)-array['distribution_locked_at','updated_at','search_text'])=(to_jsonb(old)-array['distribution_locked_at','updated_at','search_text'])
   and not exists(select 1 from public.questionnaire_questions p join public.questionnaire_versions v on v.id=p.version_id where p.source_question_id=old.id and v.status='distributed') then
    return new;
  end if;
  raise exception 'Distributed question is immutable' using errcode='55000';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_questionnaire_content()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare v_id uuid; old_version uuid;
begin
 if tg_table_name='questionnaire_versions' then
  if old.status='distributed' then
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
  if exists(select 1 from public.questionnaire_versions where id in(v_id,old_version) and status='distributed') then
   raise exception 'Published questionnaire is immutable' using errcode='55000';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.has_saved_distribution_responses (
  p_version_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 select exists (
  select 1 from public.response_sessions s
  where s.origin_version_id=p_version_id and s.started_stage='distributed'
   and (s.revision>0 or s.last_save_id is not null or s.status='submitted'
    or s.free_response<>'' or exists (
     select 1 from public.question_responses r where r.session_id=s.id
      and (r.body<>'' or r.rows<>'[]'::jsonb or r.previous_responses<>'[]'::jsonb)
   ))
 );
$function$;

REVOKE ALL ON FUNCTION "private"."has_saved_distribution_responses"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."has_saved_distribution_responses"(uuid) TO "postgres";


notify pgrst, 'reload schema';
commit;
