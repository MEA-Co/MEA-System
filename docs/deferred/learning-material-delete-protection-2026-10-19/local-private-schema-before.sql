--
-- PostgreSQL database dump
--

\restrict jQREhcDGRpkNVKiMuohLcfRkfuMME3JJQR39gZQCe1IdSb5YGymgzehdSgfRznv

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA private;


ALTER SCHEMA private OWNER TO postgres;

--
-- Name: archive_question(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.archive_question(p_id uuid, p_expected_revision integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_block public.questions%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Question block author permission required' using errcode = '42501';
  end if;
  if p_id is null or p_expected_revision is null then
    raise exception 'Invalid question block request' using errcode = '22023';
  end if;
  select * into v_block from public.questions where id = p_id for update;
  if not found then raise exception 'Question block not found' using errcode = 'P0002'; end if;
  if v_block.created_by <> auth.uid() and not private.is_admin() then
    raise exception 'Only author or admin can archive' using errcode = '42501';
  end if;
  if v_block.archived_at is not null and v_block.revision = p_expected_revision + 1 then
    return pg_catalog.to_jsonb(v_block);
  end if;
  if v_block.archived_at is not null or v_block.revision <> p_expected_revision then
    raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Question block revision conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbiBibG9jayByZXZpc2lvbiBjb25mbGljdCcgdXNpbmcgZXJyY29kZSA9ICc0MDAwMSc7 */
  end if;
  update public.questions set archived_at = now(), revision = revision + 1
  where id = p_id returning * into v_block;
  return pg_catalog.to_jsonb(v_block);
end $$;


ALTER FUNCTION private.archive_question(p_id uuid, p_expected_revision integer) OWNER TO postgres;

--
-- Name: archive_questionnaire_draft(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin perform private.delete_questionnaire(p_questionnaire_id,p_expected_revision); end $$;


ALTER FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) OWNER TO postgres;

--
-- Name: assert_published_question_access(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.assert_published_question_access(qid uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin'))
 or not exists(select 1 from public.questionnaires where id=qid and status='published' and archived_at is null)
 then raise exception 'Published response access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaire_questions where questionnaire_id=qid)
 or exists(select 1 from public.questionnaire_questions where questionnaire_id=qid and source_question_id is null)
 then raise exception 'Canonical source questions required' using errcode='22023'; end if;
end $$;


ALTER FUNCTION private.assert_published_question_access(qid uuid) OWNER TO postgres;

--
-- Name: assert_published_response_access(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.assert_published_response_access(p_questionnaire_id uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) or not exists(select 1 from public.questionnaires v join public.questionnaires q on q.id=v.id where v.id=p_questionnaire_id and v.status='published' and q.archived_at is null) then raise exception 'Published response access denied' using errcode='42501'; end if;
 -- New placement publication remains intentionally disabled at this stage.
 if exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id and source_question_id is not null) then raise exception 'Placement publication is not supported' using errcode='22023'; end if;
end $$;


ALTER FUNCTION private.assert_published_response_access(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: assert_question_response_requirements(jsonb, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.assert_question_response_requirements(def jsonb, rows_data jsonb) RETURNS void
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare rule jsonb:=nullif(def->'response_requirements','null'); group_ids jsonb;
begin
 if rule is null then return; end if;
 for group_ids in select value from jsonb_array_elements(jsonb_build_array(rule->'startFieldIds',jsonb_build_array(rule->'admissionFieldId'))) loop
   if not exists (select 1 from jsonb_array_elements(rows_data) r cross join lateral jsonb_array_elements(def->'fields') f
     where group_ids @> jsonb_build_array(f->'id') and private.question_field_response_valid(f,coalesce(r->'answers'->>(f->>'id'),''),true)) then
     raise exception 'Missing career flow required periods' using errcode='22023';
   end if;
 end loop;
end $$;


ALTER FUNCTION private.assert_question_response_requirements(def jsonb, rows_data jsonb) OWNER TO postgres;

--
-- Name: assert_review_response_access(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.assert_review_response_access(p_questionnaire_id uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if not public.can_write_guide_answers() or not exists(
 select 1 from public.questionnaires v join public.questionnaires q on q.id=v.id
 where v.id=p_questionnaire_id and v.status='in_review' and q.archived_at is null
 ) then raise exception 'Review response access denied' using errcode='42501'; end if;
end $$;


ALTER FUNCTION private.assert_review_response_access(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: assert_submission_staff_access(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.assert_submission_staff_access(qid uuid) RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaires where id=qid and status='published' and archived_at is null) then raise exception 'Questionnaire not available' using errcode='42501'; end if;
end $$;


ALTER FUNCTION private.assert_submission_staff_access(qid uuid) OWNER TO postgres;

--
-- Name: can_edit_review_question(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.can_edit_review_question(qid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists (
 select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id
 where p.source_question_id=qid and v.status='in_review' and v.archived_at is null);
$$;


ALTER FUNCTION private.can_edit_review_question(qid uuid) OWNER TO postgres;

--
-- Name: can_manage_exploration(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.can_manage_exploration() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('consultant','consultant_lead','admin'));
$$;


ALTER FUNCTION private.can_manage_exploration() OWNER TO postgres;

--
-- Name: can_manage_study(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.can_manage_study() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('consultant','consultant_lead','admin'));
$$;


ALTER FUNCTION private.can_manage_study() OWNER TO postgres;

--
-- Name: can_read_published_questionnaire(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.can_read_published_questionnaire(p_questionnaire_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select auth.uid() is not null
 and exists(select 1 from public.profiles where id=auth.uid() and role='consultant')
 and exists(select 1 from public.questionnaires q join public.questionnaires v on v.id=q.id
   where q.id=p_questionnaire_id and q.archived_at is null and v.status='published');
$$;


ALTER FUNCTION private.can_read_published_questionnaire(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: can_read_question_reviews(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.can_read_question_reviews(qid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists (
 select 1 from public.questions q where q.id=qid and (q.created_by=auth.uid() or private.is_admin() or exists(
 select 1 from public.question_review_requests r where r.question_id=qid and r.requested_by=auth.uid()) or (q.archived_at is null and exists (
 select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id where p.source_question_id=qid and v.status in ('in_review','published') and d.archived_at is null))));
$$;


ALTER FUNCTION private.can_read_question_reviews(qid uuid) OWNER TO postgres;

--
-- Name: can_request_question_review(uuid, uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.can_request_question_review(qid uuid, origin_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists(
 select 1 from public.questions q join public.questionnaire_questions p on p.source_question_id=q.id join public.questionnaires v on v.id=p.questionnaire_id
 where q.id=qid and q.created_by<>auth.uid() and q.archived_at is null and v.archived_at is null and v.status='in_review');
$$;


ALTER FUNCTION private.can_request_question_review(qid uuid, origin_id uuid) OWNER TO postgres;

--
-- Name: can_write_guide_answers(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.can_write_guide_answers() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ select coalesce(auth.uid()=private.guide_consultant_id() and (private.is_admin() or private.is_consultant_lead()),false); $$;


ALTER FUNCTION private.can_write_guide_answers() OWNER TO postgres;

--
-- Name: change_questionnaire_status(uuid, integer, text, timestamp with time zone, text, uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v public.questionnaires%rowtype;
  parent public.questionnaires%rowtype;
  receipt private.questionnaire_status_requests%rowtype;
  fingerprint text;
  result jsonb;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff permission required' using errcode='42501';
  end if;
  if p_questionnaire_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_status is null or p_status not in ('draft','in_review','published','archived')
    or p_expected_status is null or p_expected_status not in ('draft','in_review','published') then
    raise exception 'Invalid status request' using errcode='22023';
  end if;
  fingerprint := md5(jsonb_build_array(p_questionnaire_id,p_expected_revision,p_expected_status,p_expected_archived_at,p_status)::text);
  perform pg_advisory_xact_lock(hashtextextended('questionnaire-status:'||p_request_id::text,0));
  select * into receipt from private.questionnaire_status_requests where id=p_request_id;
  if found then
    if receipt.actor_id <> auth.uid() or receipt.payload_hash <> fingerprint then
      raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Request conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXF1ZXN0IGNvbmZsaWN0JyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */
    end if;
    return receipt.result;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
  select * into v from public.questionnaires where id=p_questionnaire_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  select * into parent from public.questionnaires where id=v.id for update;
  if parent.created_by <> auth.uid() and not (p_status='archived' and private.is_admin()) then
    raise exception 'Only creator can change status' using errcode='42501';
  end if;
  if v.revision <> p_expected_revision or v.status <> p_expected_status
    or parent.archived_at is distinct from p_expected_archived_at then
    raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Questionnaire conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbm5haXJlIGNvbmZsaWN0JyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */
  end if;
  if p_status='archived' then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=parent.id;
  elsif v.status='published' and p_status in ('draft','in_review') then
    if parent.archived_at is not null then raise exception 'Restore archived questionnaire first' using errcode='55000'; end if;
    perform 1 from public.questions source where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=v.id and p.source_question_id=source.id) order by source.id for update;
    perform 1 from public.response_sessions where origin_questionnaire_id=v.id and started_stage='published' order by id for update;
    if private.has_saved_publication_responses(v.id) then
      raise exception 'Saved responses prevent publication withdrawal' using errcode='55000';
    end if;
    -- Preserve empty view-only records, but do not reuse their old layout on republication.
    update public.response_sessions set origin_questionnaire_id=null where origin_questionnaire_id=v.id and started_stage='published';
    update public.questionnaires set status=p_status,published_at=null,
      review_started_at=case when p_status='in_review' then coalesce(review_started_at,clock_timestamp()) else null end,
      revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    update public.questions source set publication_locked_at=null
      where source.publication_locked_at is not null
      and exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=v.id and p.source_question_id=source.id)
      and not exists(select 1 from public.questionnaire_questions p join public.questionnaires dv on dv.id=p.questionnaire_id where p.source_question_id=source.id and dv.status='published');

  else
    if v.status='published' and p_status <> 'published' then
      raise exception 'Published questionnaire is immutable' using errcode='55000';
    end if;
    if parent.archived_at is not null then
      -- A referenced source may have been archived while this document was hidden.
      perform private.validate_questionnaire_placements(v.id);
      update public.questionnaires set archived_at=null where id=parent.id;
    end if;
    if p_status='draft' and v.status='in_review' then
      update public.questionnaires set status='draft',review_started_at=null,revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    elsif p_status='in_review' and v.status='draft' then
      perform private.start_questionnaire_review(v.id,v.revision);
      update public.questionnaires set revision=revision+1 where id=v.id;
    elsif p_status='published' and v.status <> 'published' then
      if v.status='draft' then perform private.start_questionnaire_review(v.id,v.revision); end if;
      -- Existing validation and placement response protection remain authoritative.
      -- Advance revision before publication, since published rows are immutable.
      update public.questionnaires set revision=revision+1 where id=v.id;
      perform private.publish_questionnaire(v.id,v.revision+1);
    end if;
  end if;
  result := jsonb_build_object('questionnaireId',p_questionnaire_id);
  insert into private.questionnaire_status_requests(id,actor_id,payload_hash,result)
    values(p_request_id,auth.uid(),fingerprint,result);
  return result;
end $$;


ALTER FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) OWNER TO postgres;

--
-- Name: choice_answer_selection(text, boolean, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.choice_answer_selection(p_kind text, p_allow_text boolean, p_value text) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare answer jsonb;
begin
  if p_value='' then return null; end if;
  if p_kind='multiple' then return p_value::jsonb; end if;
  if p_kind='single' and p_allow_text then
    begin answer:=p_value::jsonb;
    exception when invalid_text_representation then return to_jsonb(p_value);
    end;
    if jsonb_typeof(answer)='object' and answer ? 'choices' then return answer; end if;
  end if;
  return to_jsonb(p_value);
end $$;


ALTER FUNCTION private.choice_answer_selection(p_kind text, p_allow_text boolean, p_value text) OWNER TO postgres;

--
-- Name: choice_answer_text(text, jsonb, boolean, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.choice_answer_text(p_kind text, p_options jsonb, p_allow_text boolean, p_value text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare answer jsonb; choices jsonb; legacy_value text; extra text;
begin
  if p_value='' then return ''; end if;
  if not p_allow_text or p_kind not in ('single','multiple') then
    return private.question_answer_text(p_kind,p_options,p_value);
  end if;
  begin answer:=p_value::jsonb;
  exception when invalid_text_representation then
    return private.question_answer_text(p_kind,p_options,p_value);
  end;
  if jsonb_typeof(answer) is distinct from 'object' or not (answer ? 'choices') then
    return private.question_answer_text(p_kind,p_options,p_value);
  end if;
  choices:=answer->'choices';
  extra:=answer->>'text';
  legacy_value:=case when p_kind='single' then
    case when jsonb_typeof(choices->0)='string' then choices->>0 else (choices->0)::text end
    else choices::text end;
  return private.question_answer_text(p_kind,p_options,legacy_value)
    || case when btrim(extra)<>'' then E'\n추가 답변: '||extra else '' end;
end $$;


ALTER FUNCTION private.choice_answer_text(p_kind text, p_options jsonb, p_allow_text boolean, p_value text) OWNER TO postgres;

--
-- Name: choice_answer_valid(text, jsonb, boolean, text, boolean); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.choice_answer_valid(p_kind text, p_options jsonb, p_allow_text boolean, p_value text, p_complete boolean) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare answer jsonb; choices jsonb; legacy_value text;
begin
  if p_value is null then return false; end if;
  if btrim(p_value)='' then return not p_complete; end if;
  if not p_allow_text or p_kind not in ('single','multiple') then
    return private.question_answer_valid(p_kind,p_options,p_value,p_complete);
  end if;
  begin answer:=p_value::jsonb;
  exception when invalid_text_representation then
    return private.question_answer_valid(p_kind,p_options,p_value,p_complete);
  end;
  if jsonb_typeof(answer) is distinct from 'object' or not (answer ? 'choices') then
    return private.question_answer_valid(p_kind,p_options,p_value,p_complete);
  end if;
  choices:=answer->'choices';
  if (select count(*) from jsonb_object_keys(answer))<>2
    or jsonb_typeof(choices) is distinct from 'array'
    or jsonb_typeof(answer->'text') is distinct from 'string'
    or length(answer->>'text')>5000
    or (p_kind='single' and jsonb_array_length(choices)<>1) then return false;
  end if;
  legacy_value:=case when p_kind='single' then
    case when jsonb_typeof(choices->0)='string' then choices->>0 else (choices->0)::text end
    else choices::text end;
  return private.question_answer_valid(p_kind,p_options,legacy_value,p_complete);
end $$;


ALTER FUNCTION private.choice_answer_valid(p_kind text, p_options jsonb, p_allow_text boolean, p_value text, p_complete boolean) OWNER TO postgres;

--
-- Name: delete_exploration(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.delete_exploration(p_id uuid, p_expected_revision integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v public.exploration;
begin
 if auth.uid() is null or not private.can_manage_exploration() then raise exception 'Forbidden' using errcode='42501'; end if;
 
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0)) then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end if;

 
 begin
  select * into v from public.exploration where id=p_id for update nowait;
 exception when lock_not_available then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end;

 if not found then return; end if;
 if v.owner_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
 if v.deleted_at is not null then return; end if;
 if p_expected_revision is null or v.revision<>p_expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Revision conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXZpc2lvbiBjb25mbGljdCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */ end if;
 update public.exploration set deleted_at=now(),updated_at=now(),revision=revision+1,values='{}',reports='[]' where id=p_id;
end;
$$;


ALTER FUNCTION private.delete_exploration(p_id uuid, p_expected_revision integer) OWNER TO postgres;

--
-- Name: delete_questionnaire(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v public.questionnaires%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_questionnaire_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
  select * into v from public.questionnaires where id=p_questionnaire_id for update;
  if not found then
    if exists(select 1 from private.deleted_questionnaires where questionnaire_id=p_questionnaire_id) then return 'deleted'; end if;
    raise exception 'Questionnaire not found' using errcode='P0002';
  end if;
  if not private.is_admin() and not exists(select 1 from public.questionnaires where id=v.id and created_by=auth.uid()) then raise exception 'Only creator or admin can delete' using errcode='42501'; end if;
  -- Serialize the questionnaire before inspecting its publication state.
  perform 1 from public.questionnaires where id=v.id for update;
  perform 1 from public.questionnaires where id=v.id order by id for update;
  if exists(select 1 from public.questionnaires where id=v.id and archived_at is not null)
    and exists(select 1 from public.questionnaires where id=v.id and status='published') then return 'archived'; end if;
  if v.revision <> p_expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Questionnaire changed', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbm5haXJlIGNoYW5nZWQnIHVzaW5nIGVycmNvZGU9JzQwMDAxJzs= */ end if;
  if exists(select 1 from public.questionnaires where id=v.id and status='published') then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=v.id;
    return 'archived';
  end if;
  insert into private.deleted_questionnaires(questionnaire_id)
    select id from public.questionnaires where id=v.id;
  -- Delete every dependent row for a never-published questionnaire atomically.
  
  delete from public.questionnaire_review_reads where questionnaire_id in (select id from public.questionnaires where id=v.id);
  delete from public.questionnaire_questions where questionnaire_id in (select id from public.questionnaires where id=v.id);
  delete from public.questionnaire_sections where questionnaire_id in (select id from public.questionnaires where id=v.id);
  delete from public.questionnaires where id=v.id;
  return 'deleted';
end $$;


ALTER FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) OWNER TO postgres;

--
-- Name: delete_study(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.delete_study(p_id uuid, p_expected_revision integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v public.study;
begin
 if auth.uid() is null or not private.can_manage_study() then raise exception 'Forbidden' using errcode='42501'; end if;
 
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0)) then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end if;

 
 begin
  select * into v from public.study where id=p_id for update nowait;
 exception when lock_not_available then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end;

 if not found then return; end if;
 if v.owner_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
 if v.deleted_at is not null then return; end if;
 if p_expected_revision is null or v.revision<>p_expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Revision conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXZpc2lvbiBjb25mbGljdCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */ end if;
 update public.study set deleted_at=now(),updated_at=now(),revision=revision+1,values='{}',reports='[]' where id=p_id;
end;
$$;


ALTER FUNCTION private.delete_study(p_id uuid, p_expected_revision integer) OWNER TO postgres;

--
-- Name: guard_learning_material_reference_write(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_learning_material_reference_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
 new_payload jsonb; source_id_value uuid; old_refs text[]; new_refs text[]; ref text; available boolean;
begin
 if tg_op='DELETE' then
  source_id_value:=(to_jsonb(old)->>case tg_table_name when 'response_submissions' then 'session_id' else 'id' end)::uuid;
  delete from private.learning_material_links where source_table=tg_table_name and source_id=source_id_value;
  return old;
 end if;
 new_payload:=private.learning_material_source(tg_table_name,to_jsonb(new));
 if tg_op='UPDATE' and new_payload is not distinct from private.learning_material_source(tg_table_name,to_jsonb(old)) then return new; end if;
 source_id_value:=(to_jsonb(new)->>case tg_table_name when 'response_submissions' then 'session_id' else 'id' end)::uuid;
 new_refs:=private.learning_material_references(new_payload);
 select coalesce(array_agg(material_kind||':'||material_id::text order by material_kind,material_id),'{}')
 into old_refs from private.learning_material_links where source_table=tg_table_name and source_id=source_id_value;
 if new_refs=old_refs then return new; end if;
 -- Per-target non-blocking shared locks, not a global lock. Existing refs are
 -- already protected by the ledger; only new targets need existence checks.
 for ref in select unnest(new_refs) except select unnest(old_refs) order by 1 loop
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('learning-material:'||ref,0)) then
   raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
  end if;
  if split_part(ref,':',1)='study' then
   select exists(select 1 from public.study where id=split_part(ref,':',2)::uuid and deleted_at is null) into available;
  else
   select exists(select 1 from public.exploration where id=split_part(ref,':',2)::uuid and deleted_at is null) into available;
  end if;
  if not available then
   raise sqlstate 'PGRST' using message='{"code":"MATERIAL_UNAVAILABLE","message":"Referenced material is no longer available","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
  end if;
  insert into private.learning_material_links(source_table,source_id,material_kind,material_id)
   values(tg_table_name,source_id_value,split_part(ref,':',1),split_part(ref,':',2)::uuid);
 end loop;
 delete from private.learning_material_links where source_table=tg_table_name and source_id=source_id_value
  and not (material_kind||':'||material_id::text)=any(new_refs);
 return new;
end;
$$;


ALTER FUNCTION private.guard_learning_material_reference_write() OWNER TO postgres;

--
-- Name: guard_placed_question_archive(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_placed_question_archive() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.archived_at is not null and old.archived_at is null and exists (
    select 1 from public.questionnaire_questions p
    join public.questionnaires v on v.id=p.questionnaire_id
    join public.questionnaires parent on parent.id=v.id
    where p.source_question_id=new.id and parent.archived_at is null
  ) then raise exception 'Question is used by a questionnaire' using errcode='55000'; end if;
  return new;
end $$;


ALTER FUNCTION private.guard_placed_question_archive() OWNER TO postgres;

--
-- Name: guard_published_question(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_published_question() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if old.publication_locked_at is not null then
  if tg_op='UPDATE' and new.publication_locked_at is null
   and (to_jsonb(new)-array['publication_locked_at','updated_at','search_text'])=(to_jsonb(old)-array['publication_locked_at','updated_at','search_text'])
   and not exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id where p.source_question_id=old.id and v.status='published') then
    return new;
  end if;
  raise exception 'Published question is immutable' using errcode='55000';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;


ALTER FUNCTION private.guard_published_question() OWNER TO postgres;

--
-- Name: guard_published_question_detail(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_published_question_detail() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare old_id uuid; new_id uuid; locked timestamptz; q record;
begin
 if tg_op<>'INSERT' then old_id:=old.question_id; end if;
 if tg_op<>'DELETE' then new_id:=new.question_id; end if;
 for q in select id,publication_locked_at from public.questions where id in(old_id,new_id) order by id for update loop
  if q.publication_locked_at is not null then
   raise exception 'Published question is immutable' using errcode='55000';
  end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;


ALTER FUNCTION private.guard_published_question_detail() OWNER TO postgres;

--
-- Name: guard_question_private_sources(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_question_private_sources() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare source_id uuid;
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  if tg_table_name='questionnaire_questions' then
    if new.source_question_id is null then return new; end if;
    if not exists(select 1 from public.questions q where q.id=new.source_question_id and (q.created_by=auth.uid() or private.can_edit_review_question(q.id))) then
      raise exception 'Question source is not available' using errcode='42501';
    end if;
  else
    for source_id in
      select new.source_block_id union select new.after_block_id
      union select (c->>'blockId')::uuid from jsonb_array_elements(coalesce(new.condition->'clauses','[]'::jsonb)) c
    loop
      if source_id is not null and not exists(select 1 from public.questions q where q.id=source_id and (q.created_by=auth.uid() or private.can_edit_review_question(q.id))) then
        raise exception 'Question source is not available' using errcode='42501';
      end if;
    end loop;
  end if;
  return new;
end $$;


ALTER FUNCTION private.guard_question_private_sources() OWNER TO postgres;

--
-- Name: guard_question_response_identity(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_question_response_identity() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ declare in_review boolean; begin
 if tg_table_name='response_sessions' then
 if new.legacy_response is distinct from old.legacy_response or new.respondent_id<>old.respondent_id or (old.started_stage<>'in_review' and (new.layout<>old.layout or new.origin_title<>old.origin_title)) or new.started_stage<>old.started_stage then raise exception 'Session identity is immutable' using errcode='55000'; end if;
 if old.started_stage<>'in_review' and old.status='submitted' and exists(select 1 from public.question_responses where session_id=old.id and legacy_question_id is not null) and (to_jsonb(new)-'origin_questionnaire_id') is distinct from (to_jsonb(old)-'origin_questionnaire_id') then raise exception 'Response locked' using errcode='55000'; end if;
 else
 select started_stage='in_review' into in_review from public.response_sessions where id=old.session_id;
 if tg_op='DELETE' then
 if in_review and exists(select 1 from public.response_sessions s where s.id=old.session_id and s.respondent_id=private.guide_consultant_id() and s.origin_questionnaire_id is not null and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=s.origin_questionnaire_id and p.source_question_id=old.question_id)) then return old; end if;
 if in_review and exists(select 1 from public.questions q where q.id=old.question_id and q.archived_at is not null) then return old; end if;
 raise exception 'Response history is preserved' using errcode='55000';
 end if;
 if new.legacy_answer is distinct from old.legacy_answer or new.session_id<>old.session_id or new.question_id is distinct from old.question_id or new.legacy_question_id is distinct from old.legacy_question_id or new.legacy_definition is distinct from old.legacy_definition or (not in_review and old.legacy_question_id is not null and exists(select 1 from public.response_sessions where id=old.session_id and status='submitted')) then raise exception 'Response locked' using errcode='55000'; end if;
 end if; return new;
end $$;


ALTER FUNCTION private.guard_question_response_identity() OWNER TO postgres;

--
-- Name: guard_questionnaire_choices_ready(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_questionnaire_choices_ready() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.status in ('in_review','published') and old.status is distinct from new.status
    and exists (
      select 1 from public.questionnaire_questions
      where source_question_id is null and questionnaire_id = new.id and (
        not private.question_config_valid(kind,options,true)
        or (kind = 'scale' and not private.scale_config_valid(scale_config,true))
      )
    ) then
    raise exception 'Question choices or scale labels are incomplete' using errcode='22023';
  end if;
  return new;
end $$;


ALTER FUNCTION private.guard_questionnaire_choices_ready() OWNER TO postgres;

--
-- Name: guard_questionnaire_content(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_questionnaire_content() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare v_id uuid; old_questionnaire_id uuid;
begin
 if tg_table_name='questionnaires' then
  if old.status='published' then
   if tg_op='UPDATE' and (to_jsonb(new)-'archived_at')=(to_jsonb(old)-'archived_at') then return new; end if;
   if tg_op='UPDATE' and new.status in ('draft','in_review')
    and new.published_at is null and new.revision=old.revision+1
    and (to_jsonb(new)-array['status','published_at','review_started_at','revision','updated_at']) = (to_jsonb(old)-array['status','published_at','review_started_at','revision','updated_at']) then
     perform pg_advisory_xact_lock(hashtextextended(old.id::text,0));
     if private.has_saved_publication_responses(old.id) then
      raise exception 'Saved responses prevent publication withdrawal' using errcode='55000';
     end if;
   else raise exception 'Review questionnaire is immutable' using errcode='55000'; end if;
  end if;
 else
  if tg_op<>'INSERT' then old_questionnaire_id:=old.questionnaire_id; end if;
  if tg_op<>'DELETE' then v_id:=new.questionnaire_id; end if;
  if exists(select 1 from public.questionnaires where id in(v_id,old_questionnaire_id) and status='published') then
   raise exception 'Review questionnaire is immutable' using errcode='55000';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;


ALTER FUNCTION private.guard_questionnaire_content() OWNER TO postgres;

--
-- Name: guard_questionnaire_placement_publication(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_questionnaire_placement_publication() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if new.status is distinct from old.status and new.status in ('in_review','published') then
  perform private.validate_questionnaire_placements(new.id);
  if new.status='published' then
   -- Serialize with original edits and review creation, including requests from other questionnaires.
   perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=new.id and p.source_question_id=q.id) order by q.id for update;
   perform private.validate_questionnaire_placements(new.id);
   if exists(select 1 from public.questionnaire_questions p join public.question_review_requests r on r.question_id=p.source_question_id where p.questionnaire_id=new.id and r.resolved_at is null) then
    raise exception 'Unresolved question reviews prevent publication' using errcode='55000';
   end if;
   update public.questions q set publication_locked_at=clock_timestamp()
   where publication_locked_at is null and exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=new.id and p.source_question_id=q.id);
  end if;
 end if;
 return new;
end $$;


ALTER FUNCTION private.guard_questionnaire_placement_publication() OWNER TO postgres;

--
-- Name: guard_referenced_learning_material_delete(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_referenced_learning_material_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if old.deleted_at is not null or new.deleted_at is null then return new; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('learning-material:'||tg_table_name||':'||old.id::text,0)) then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end if;
 -- One indexed existence lookup, independent of source answer sizes.
 if exists(select 1 from private.learning_material_links where material_kind=tg_table_name and material_id=old.id) then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_REFERENCED","message":"Referenced material cannot be deleted","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end if;
 return new;
end;
$$;


ALTER FUNCTION private.guard_referenced_learning_material_delete() OWNER TO postgres;

--
-- Name: guard_start_notice(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guard_start_notice() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if (tg_op='INSERT' and new.start_notice is not null)
 or (tg_op='UPDATE' and new.start_notice is distinct from old.start_notice) then
   if current_user <> 'postgres' or auth.uid() is null
     or not (private.is_admin() or private.is_consultant_lead())
     or new.status not in ('draft','in_review') or new.archived_at is not null
     or (new.created_by <> auth.uid() and new.status <> 'in_review' and not private.is_admin()) then
     raise exception 'Questionnaire notice is not editable' using errcode='42501';
   end if;
 end if;
 return new;
end $$;


ALTER FUNCTION private.guard_start_notice() OWNER TO postgres;

--
-- Name: guide_answer_field_ids(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guide_answer_field_ids(qid uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if auth.uid() is null or not exists(select 1 from public.questions where id=qid and (created_by=auth.uid() or private.is_admin() or private.can_edit_review_question(qid))) then raise exception 'Question author required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(distinct a.key) from public.question_responses r join public.response_sessions s on s.id=r.session_id cross join lateral jsonb_array_elements(r.rows) row cross join lateral jsonb_each_text(row->'answers') a where r.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='in_review' and btrim(private.question_search_plain(a.value))<>''),'[]');
end $$;


ALTER FUNCTION private.guide_answer_field_ids(qid uuid) OWNER TO postgres;

--
-- Name: guide_consultant_id(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guide_consultant_id() RETURNS uuid
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$ select 'b338f03e-9d7f-4367-be1e-96eb1d5473be'::uuid; $$;


ALTER FUNCTION private.guide_consultant_id() OWNER TO postgres;

--
-- Name: guide_exploration_ids(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guide_exploration_ids() RETURNS uuid[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare qid uuid; guide jsonb; answer text; doc jsonb; mark jsonb; result uuid[] := '{}'; ref uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) then return result; end if;
 for qid in select distinct r.question_id from public.question_responses r
 join public.response_sessions s on s.id=r.session_id
 where s.respondent_id=private.guide_consultant_id() and s.started_stage='in_review' and r.question_id is not null
 loop
  guide := private.read_guide_answers(array[qid]);
  for answer in select cell.value from jsonb_each(guide) g
    cross join lateral jsonb_array_elements(g.value->'rows') row
    cross join lateral jsonb_each_text(row->'answers') cell
  loop
   if left(answer,length('::mea-rich-text:v1::')) <> '::mea-rich-text:v1::' then continue; end if;
   begin
    doc := substring(answer from length('::mea-rich-text:v1::')+1)::jsonb;
    for mark in select jsonb_path_query(doc, '$.**.marks[*]') loop
     if mark->>'type'='explorationReference' then
      begin
       ref := (mark#>>'{attrs,id}')::uuid;
       if ref is not null and not ref=any(result) then result:=array_append(result,ref); end if;
      exception when invalid_text_representation then null; end;
     end if;
    end loop;
   exception when invalid_text_representation then null; end;
  end loop;
 end loop;
 return result;
end $_$;


ALTER FUNCTION private.guide_exploration_ids() OWNER TO postgres;

--
-- Name: guide_rows_body(jsonb, jsonb, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guide_rows_body(answer_rows jsonb, fields jsonb, active_ids jsonb) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select coalesce(string_agg((row->>'id')||' · '||(f->>'label')||': '||case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(coalesce(f->'scaleConfig',jsonb_build_object('max',f->'scaleMax')),val) when f->>'kind' in ('single','multiple') then private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) else val end,E'\n' order by ri,fi),'')
 from jsonb_array_elements(answer_rows) with ordinality t(row,ri) cross join lateral jsonb_array_elements(fields) with ordinality x(f,fi) cross join lateral (select coalesce(row->'answers'->>(f->>'id'),'') val) a
 where active_ids @> jsonb_build_array(row->'id') and val<>'';
$$;


ALTER FUNCTION private.guide_rows_body(answer_rows jsonb, fields jsonb, active_ids jsonb) OWNER TO postgres;

--
-- Name: guide_study_ids(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.guide_study_ids() RETURNS uuid[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare qid uuid; guide jsonb; answer text; doc jsonb; mark jsonb; result uuid[] := '{}'; ref uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) then return result; end if;
 for qid in select distinct r.question_id from public.question_responses r
 join public.response_sessions s on s.id=r.session_id
 where s.respondent_id=private.guide_consultant_id() and s.started_stage='in_review' and r.question_id is not null
 loop
  guide := private.read_guide_answers(array[qid]);

  for answer in select cell.value from jsonb_each(guide) g
    cross join lateral jsonb_array_elements(g.value->'rows') row
    cross join lateral jsonb_each_text(row->'answers') cell
  loop
   if left(answer,length('::mea-rich-text:v1::')) <> '::mea-rich-text:v1::' then continue; end if;
   begin
    doc := substring(answer from length('::mea-rich-text:v1::')+1)::jsonb;
    for mark in select jsonb_path_query(doc, '$.**.marks[*]') loop
     if mark->>'type'='studyReference' then
      begin
       ref := (mark#>>'{attrs,id}')::uuid;
       if ref is not null and not ref=any(result) then result:=array_append(result,ref); end if;
      exception when invalid_text_representation then null; end;
     end if;
    end loop;
   exception when invalid_text_representation then null; end;
  end loop;
 end loop;
 return result;
end $_$;


ALTER FUNCTION private.guide_study_ids() OWNER TO postgres;

--
-- Name: has_saved_publication_responses(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.has_saved_publication_responses(p_questionnaire_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select exists (
  select 1 from public.response_sessions s
  where s.origin_questionnaire_id=p_questionnaire_id and s.started_stage='published'
   and (s.revision>0 or s.last_save_id is not null or s.status='submitted'
    or s.free_response<>'' or exists (
     select 1 from public.question_responses r where r.session_id=s.id
      and (r.body<>'' or r.rows<>'[]'::jsonb or r.previous_responses<>'[]'::jsonb)
   ))
 );
$$;


ALTER FUNCTION private.has_saved_publication_responses(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: import_legacy_text_questionnaire(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.import_legacy_text_questionnaire(p_source_questionnaire_id uuid, p_expected_question_count integer) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ begin
raise exception 'Legacy import retired locally; use the retained import ledger and a reviewed conversion plan' using errcode='55000';
end $$;


ALTER FUNCTION private.import_legacy_text_questionnaire(p_source_questionnaire_id uuid, p_expected_question_count integer) OWNER TO postgres;

--
-- Name: is_admin(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;


ALTER FUNCTION private.is_admin() OWNER TO postgres;

--
-- Name: is_consultant_lead(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.is_consultant_lead() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'consultant_lead'
  );
$$;


ALTER FUNCTION private.is_consultant_lead() OWNER TO postgres;

--
-- Name: learning_material_references(jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.learning_material_references(payload jsonb) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare
  refs text[] := '{}'; item jsonb; encoded text; material_id text; kind text;
begin
  if jsonb_typeof(payload) = 'string' then
    encoded := payload #>> '{}';
    if left(encoded,20) = '::mea-rich-text:v1::' then
      begin
        return private.learning_material_references(substr(encoded,21)::jsonb);
      exception when invalid_text_representation then return '{}';
      end;
    end if;
  elsif jsonb_typeof(payload) = 'array' then
    for item in select value from jsonb_array_elements(payload) loop
      refs := refs || private.learning_material_references(item);
    end loop;
  elsif jsonb_typeof(payload) = 'object' then
    kind := case payload->>'type' when 'studyReference' then 'study'
      when 'explorationReference' then 'exploration' end;
    material_id := payload->'attrs'->>'id';
    if kind is not null and material_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      refs := array[kind || ':' || (material_id::uuid)::text];
    end if;
    for item in select value from jsonb_each(payload) loop
      refs := refs || private.learning_material_references(item);
    end loop;
  end if;
  return array(select distinct value from unnest(refs) value order by value);
end;
$_$;


ALTER FUNCTION private.learning_material_references(payload jsonb) OWNER TO postgres;

--
-- Name: learning_material_source(text, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.learning_material_source(table_name text, row_data jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case table_name
    when 'questions' then jsonb_build_array(row_data->'prompt',row_data->'fields',row_data->'condition',row_data->'response_requirements')
    when 'question_details' then row_data->'body'
    when 'questionnaires' then row_data->'start_notice'
    when 'questionnaire_questions' then jsonb_build_array(row_data->'body',row_data->'options')
    when 'question_responses' then jsonb_build_array(row_data->'rows',row_data->'legacy_answer',row_data->'previous_responses',row_data->'legacy_definition')
    when 'response_sessions' then jsonb_build_array(row_data->'layout',row_data->'free_response',row_data->'legacy_response')
    when 'response_submissions' then row_data->'answers'
    else 'null'::jsonb end;
$$;


ALTER FUNCTION private.learning_material_source(table_name text, row_data jsonb) OWNER TO postgres;

--
-- Name: list_submitted_questionnaire_responses(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.list_submitted_questionnaire_responses(qid uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaires where id=qid and status='published' and archived_at is null) then raise exception 'Questionnaire not available' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'respondentName',p.name,'submittedAt',sub.submitted_at,'title',s.origin_title,'sections',s.layout,'questions',
 (select coalesce(jsonb_agg(jsonb_build_object('questionId',a.key,'responseId',a.value->'responseId','rows',a.value->'rows','activeRowIds',a.value->'activeRowIds','definition',private.published_response_definition(a.key::uuid))),'[]') from jsonb_each(sub.answers) a)) order by sub.submitted_at desc,s.id)
 from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id join public.profiles p on p.id=s.respondent_id
 where s.origin_questionnaire_id=qid and s.started_stage='published'),'[]');
end $$;


ALTER FUNCTION private.list_submitted_questionnaire_responses(qid uuid) OWNER TO postgres;

--
-- Name: live_response_definition(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.live_response_definition(qid uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select (to_jsonb(q)-'last_save_id'-'last_save_hash'-'search_text')||jsonb_build_object('details',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants,'position',d.position) order by d.position,d.id) from public.question_details d where d.question_id=q.id),'[]')) from public.questions q where q.id=qid and q.archived_at is null;
$$;


ALTER FUNCTION private.live_response_definition(qid uuid) OWNER TO postgres;

--
-- Name: mark_question_reviews_read(uuid, uuid[]); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.mark_question_reviews_read(qid uuid, ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) or not private.can_read_question_reviews(qid) then raise exception 'Review access denied' using errcode='42501'; end if;
 if cardinality(ids)>100 then raise exception 'Too many review IDs' using errcode='22023'; end if;
 insert into public.question_review_reads(review_id,user_id)
 select r.id,auth.uid() from public.question_review_requests r where r.question_id=qid and r.id=any(ids)
 and r.id in (select value::uuid from jsonb_array_elements_text(private.unread_question_review_ids(qid)))
 on conflict do nothing;
end $$;


ALTER FUNCTION private.mark_question_reviews_read(qid uuid, ids uuid[]) OWNER TO postgres;

--
-- Name: notify_questionnaire_change(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.notify_questionnaire_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  notify_published boolean := false;
  receipt_user uuid;
begin
  if auth.uid() is null then return null; end if;

  if tg_table_name = 'questionnaire_review_reads' then
    if tg_op = 'DELETE' then receipt_user := old.user_id;
    else receipt_user := new.user_id; end if;
    perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:user:' || receipt_user::text, true);
    return null;
  elsif tg_table_name = 'questionnaires' then
    if tg_op = 'INSERT' then
      -- The save RPC finishes by incrementing revision; no notification for
      -- its initial, empty version row is necessary.
      if new.revision = 0 then return null; end if;
      notify_published := new.status = 'published';
    elsif tg_op = 'UPDATE' then
      if new.revision = old.revision and new.status = old.status and new.archived_at is not distinct from old.archived_at then return null; end if;
      notify_published := new.status = 'published' or old.status = 'published';
    else
      notify_published := old.status = 'published';
    end if;
  elsif tg_table_name <> 'question_review_requests' then
    return null;
  end if;

  perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:staff', true);
  if notify_published then
    perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:published', true);
  end if;
  return null;
end;
$$;


ALTER FUNCTION private.notify_questionnaire_change() OWNER TO postgres;

--
-- Name: notify_questionnaire_response_change(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.notify_questionnaire_response_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 perform realtime.send('{}'::jsonb,'changed','questionnaires:user:'||new.respondent_id::text,true);
 return null;
end $$;


ALTER FUNCTION private.notify_questionnaire_response_change() OWNER TO postgres;

--
-- Name: notify_response_session_change(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.notify_response_session_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 perform realtime.send('{}'::jsonb,'changed','questionnaires:user:'||new.respondent_id::text,true);
 return null;
end $$;


ALTER FUNCTION private.notify_response_session_change() OWNER TO postgres;

--
-- Name: open_published_question_response_session(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.open_published_question_response_session(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sid uuid; item jsonb; sources jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 perform private.assert_published_question_access(p_questionnaire_id);
 select id into sid from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid() and started_stage='published';
 if sid is not null then return private.read_published_question_response_session(p_questionnaire_id); end if;
 perform private.assert_published_question_access(p_questionnaire_id);
 if not exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id) or exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id and source_question_id is null) then
 raise exception 'Source questions required' using errcode='22023'; end if;
 -- Locks source rows against concurrent save_question while capturing all definitions.
 perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=q.id) order by q.id for share;
 perform private.validate_questionnaire_placements(p_questionnaire_id);
 select jsonb_agg(jsonb_build_object('id',source_question_id)) into sources from public.questionnaire_questions where questionnaire_id=p_questionnaire_id;
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'published',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for item in select value from jsonb_array_elements(sources) loop
 insert into public.question_responses(session_id,question_id,origin_placement_id)
 select sid,(item->>'id')::uuid,p.id from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=(item->>'id')::uuid;
 end loop;
 update public.question_responses r set referenced_response_id=src.id from public.questions q,public.question_responses src
 where r.session_id=sid and r.question_id=q.id and src.session_id=sid and q.source_block_id=src.question_id;
 return private.read_published_question_response_session(p_questionnaire_id);
end $$;


ALTER FUNCTION private.open_published_question_response_session(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: open_published_response(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.open_published_response(p_questionnaire_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sid uuid; q public.questionnaire_questions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 perform private.assert_published_response_access(p_questionnaire_id);
 select id into sid from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid() and started_stage='published';
 if sid is not null then return sid; end if;
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,status,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'published','assigned',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for q in select * from public.questionnaire_questions where questionnaire_id=p_questionnaire_id order by id loop
 if q.source_question_id is not null then raise exception 'Source-based questionnaire is read-only' using errcode='55000'; end if;
 insert into public.question_responses(session_id,legacy_question_id,legacy_definition,origin_placement_id)
 values(sid,q.id,jsonb_build_object('id',q.id,'prompt',q.body,'fields',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',q.id,'label','답변','kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text))),'row_mode','single','legacy',true),q.id);
 end loop;
 return sid;
end $$;


ALTER FUNCTION private.open_published_response(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: open_questionnaire_response(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid) RETURNS uuid
    LANGUAGE sql
    SET search_path TO ''
    AS $$ select private.open_published_response(p_questionnaire_id) $$;


ALTER FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: open_review_response_session(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.open_review_response_session(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sid uuid; item jsonb; sources jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 select id into sid from public.response_sessions where (id=p_questionnaire_id or origin_questionnaire_id=p_questionnaire_id) and respondent_id=auth.uid() and started_stage='in_review';
 if sid is not null then return private.read_review_response_session(p_questionnaire_id); end if;
 perform private.assert_review_response_access(p_questionnaire_id);
 if not exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id) or exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id and source_question_id is null) then
 raise exception 'Source questions required' using errcode='22023'; end if;
 -- Locks source rows against concurrent save_question while capturing all definitions.
 perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=q.id) order by q.id for share;
 perform private.validate_questionnaire_placements(p_questionnaire_id);
 sources:=private.read_shared_question_sources(p_questionnaire_id);
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'in_review',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for item in select value from jsonb_array_elements(sources) loop
 insert into public.question_responses(session_id,question_id,origin_placement_id)
 select sid,(item->>'id')::uuid,p.id from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=(item->>'id')::uuid;
 end loop;
 update public.question_responses r set referenced_response_id=src.id from public.questions q,public.question_responses src
 where r.session_id=sid and r.question_id=q.id and src.session_id=sid and q.source_block_id=src.question_id;
 return private.read_review_response_session(p_questionnaire_id);
end $$;


ALTER FUNCTION private.open_review_response_session(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: owned_published_question_session(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.owned_published_question_session(qid uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ declare sid uuid; begin
 -- Serializes opening/saving with publication withdrawal.
 perform pg_advisory_xact_lock(hashtextextended(qid::text,0));
 perform private.assert_published_question_access(qid);
 select id into sid from public.response_sessions where origin_questionnaire_id=qid and respondent_id=auth.uid() and started_stage='published';
 if sid is null then raise exception 'Start response first' using errcode='42501'; end if;
 return sid;
end $$;


ALTER FUNCTION private.owned_published_question_session(qid uuid) OWNER TO postgres;

--
-- Name: owned_review_session(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.owned_review_session(target uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ declare sid uuid; begin
 if not public.can_write_guide_answers() then raise exception 'Staff access required' using errcode='42501'; end if;
 select id into sid from public.response_sessions where respondent_id=auth.uid() and started_stage='in_review' and (id=target or origin_questionnaire_id=target) order by (id=target) desc limit 1;
 if sid is null then raise exception 'Response not found' using errcode='42501'; end if; return sid;
end $$;


ALTER FUNCTION private.owned_review_session(target uuid) OWNER TO postgres;

--
-- Name: prepare_question_flow_rows(jsonb, jsonb, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.prepare_question_flow_rows(p_definition jsonb, p_rows jsonb, p_existing_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare
  item jsonb; old_item jsonb; old_at_index jsonb; base_count integer; period_index integer;
  has_metadata boolean; had_metadata boolean; ordered_rows jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>20 then
    raise exception 'Invalid flow rows' using errcode='22023';
  end if;
  has_metadata:=exists(select 1 from jsonb_array_elements(p_rows) x where x ? 'flowIndex' or x ? 'flowAfter' or x ? 'label');
  had_metadata:=exists(select 1 from jsonb_array_elements(coalesce(p_existing_rows,'[]')) x where x ? 'flowIndex' or x ? 'flowAfter');
  if p_definition->>'answer_layout' is distinct from 'flow' then
    if has_metadata then raise exception 'Flow metadata requires a flow question' using errcode='22023'; end if;
    return p_rows;
  end if;
  base_count:=case when p_definition->>'row_mode'='repeatable' then (p_definition->>'max_rows')::integer else 1 end;
  if not has_metadata and not had_metadata then
    if jsonb_array_length(p_rows)>base_count then raise exception 'Too many rows' using errcode='22023'; end if;
    return p_rows; -- Old flow clients and existing positional rows keep their contract.
  end if;
  if not has_metadata then raise exception 'Fixed flow period metadata is required' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid flow row' using errcode='22023'; end if;
    select value into old_item from jsonb_array_elements(coalesce(p_existing_rows,'[]')) where value->'id'=item->'id';
    if item ? 'flowIndex' then
      if item ? 'flowAfter' or item ? 'label' or jsonb_typeof(item->'flowIndex') is distinct from 'number'
        or item->>'flowIndex' !~ '^[1-9][0-9]?$' then raise exception 'Invalid fixed flow period' using errcode='22023'; end if;
      period_index:=(item->>'flowIndex')::integer;
      if period_index>base_count then raise exception 'Invalid fixed flow period' using errcode='22023'; end if;
      if had_metadata then
        select value into old_at_index from jsonb_array_elements(p_existing_rows) where value->'flowIndex'=item->'flowIndex';
      else
        old_at_index:=p_existing_rows->(period_index-1);
      end if;
      if old_at_index is not null and old_at_index->'id' is distinct from item->'id'
        or old_item is not null and (old_item ? 'flowAfter'
          or had_metadata and old_item->'flowIndex' is distinct from item->'flowIndex'
          or not had_metadata and old_at_index->'id' is distinct from item->'id') then
        raise exception 'Fixed flow period identity cannot change' using errcode='22023';
      end if;
    elsif item ? 'flowAfter' then
      if jsonb_typeof(item->'flowAfter') is distinct from 'number' or item->>'flowAfter' !~ '^[1-9][0-9]?$'
        or item ? 'label' and (jsonb_typeof(item->'label') is distinct from 'string' or char_length(item->>'label')>100) then
        raise exception 'Invalid inserted flow period' using errcode='22023';
      end if;
      period_index:=(item->>'flowAfter')::integer;
      if period_index>base_count then raise exception 'Invalid inserted flow period' using errcode='22023'; end if;
      if old_item is not null then
        if not (old_item ? 'flowAfter') or old_item->'flowAfter' is distinct from item->'flowAfter' then
          raise exception 'Inserted flow period anchor cannot change' using errcode='22023';
        end if;
      elsif not coalesce(p_definition->'flow_insert_after','[]') @> jsonb_build_array(period_index) then
        raise exception 'Flow insertion is not allowed at this period' using errcode='22023';
      end if;
    else
      raise exception 'Every flow row needs a fixed period or insertion anchor' using errcode='22023';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p_rows) x where x ? 'flowIndex')<>base_count
    or (select count(distinct x->'flowIndex') from jsonb_array_elements(p_rows) x where x ? 'flowIndex')<>base_count then
    raise exception 'Preserve every fixed flow period' using errcode='22023';
  end if;
  select jsonb_agg(x order by coalesce((x->>'flowIndex')::integer,(x->>'flowAfter')::integer),
    case when x ? 'flowIndex' then 0 else 1 end,n) into ordered_rows
    from jsonb_array_elements(p_rows) with ordinality row(x,n);
  return ordered_rows;
end $_$;


ALTER FUNCTION private.prepare_question_flow_rows(p_definition jsonb, p_rows jsonb, p_existing_rows jsonb) OWNER TO postgres;

--
-- Name: prepare_question_response_rows(jsonb, jsonb, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.prepare_question_response_rows(def jsonb, rows_data jsonb, previous_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare row_data jsonb; f jsonb; val text;
begin

 if jsonb_typeof(rows_data) is distinct from 'array' then raise exception 'Invalid rows' using errcode='22023'; end if;
 if jsonb_array_length(rows_data)>20 or (select count(distinct value->>'id') from jsonb_array_elements(rows_data))<>jsonb_array_length(rows_data) then raise exception 'Invalid rows' using errcode='22023'; end if;
 rows_data:=private.prepare_question_flow_rows(def,rows_data,previous_rows);
 if coalesce(def->>'answer_layout','cards')<>'flow' and (def->>'row_mode'='single' and jsonb_array_length(rows_data)>1
   or def->>'row_mode'='repeatable' and jsonb_array_length(rows_data)>(def->>'max_rows')::int) then
   raise exception 'Too many rows' using errcode='22023';
 end if;
 for row_data in select value from jsonb_array_elements(rows_data) loop
 if jsonb_typeof(row_data->'id') is distinct from 'number' or (row_data->>'id') !~ '^-?[0-9]{1,16}$' or jsonb_typeof(row_data->'answers') is distinct from 'object' then raise exception 'Invalid row' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(row_data->'answers') k where not exists(select 1 from jsonb_array_elements(def->'fields') field_item where field_item->>'id'=k)) then raise exception 'Unknown field' using errcode='22023'; end if;
 for f in select value from jsonb_array_elements(def->'fields') loop
 val:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if (row_data->'answers' ? (f->>'id') and jsonb_typeof(row_data->'answers'->(f->>'id')) is distinct from 'string') or not private.question_field_response_valid(f,val,false) then raise exception 'Invalid answer' using errcode='22023'; end if;
 end loop; end loop;
 return rows_data;
end $_$;


ALTER FUNCTION private.prepare_question_response_rows(def jsonb, rows_data jsonb, previous_rows jsonb) OWNER TO postgres;

--
-- Name: prune_guide_fields(jsonb, jsonb, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.prune_guide_fields(answer_rows jsonb, old_fields jsonb, new_fields jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(row || jsonb_build_object('answers',coalesce((select jsonb_object_agg(a.key,a.value) from jsonb_each(row->'answers') a where exists(select 1 from jsonb_array_elements(old_fields) o join jsonb_array_elements(new_fields) n on n->>'id'=o->>'id' and n->>'kind'=o->>'kind' where o->>'id'=a.key)),'{}'::jsonb)) order by position),'[]'::jsonb) from jsonb_array_elements(answer_rows) with ordinality t(row,position);
$$;


ALTER FUNCTION private.prune_guide_fields(answer_rows jsonb, old_fields jsonb, new_fields jsonb) OWNER TO postgres;

--
-- Name: publish_questionnaire(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v public.questionnaires%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_questionnaire_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
  select * into v from public.questionnaires where id=p_questionnaire_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from public.questionnaires where id=v.id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from public.questionnaires where id=v.id and created_by=auth.uid()) then raise exception 'Only the creator can start_review or publish' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Questionnaire conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbm5haXJlIGNvbmZsaWN0JyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */ end if;
  if v.status='published' then return; end if;
  if v.status<>'in_review' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where questionnaire_id=v.id)
    or exists(select 1 from public.questionnaire_questions where questionnaire_id=v.id and source_question_id is null and btrim(body)='') then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  update public.questionnaires set status='published',published_at=now(),updated_at=now() where id=v.id;
end $$;


ALTER FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) OWNER TO postgres;

--
-- Name: published_response_definition(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.published_response_definition(qid uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select d || jsonb_build_object('details',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'details') x where (x->>'visibleToConsultants')::boolean),'[]'))
 from (select private.live_response_definition(qid) d) q;
$$;


ALTER FUNCTION private.published_response_definition(qid uuid) OWNER TO postgres;

--
-- Name: published_submission_counts(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.published_submission_counts() RETURNS TABLE(questionnaire_id uuid, count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  return query
    select s.origin_questionnaire_id, count(*)
    from public.response_submissions sub
    join public.response_sessions s on s.id=sub.session_id
    join public.questionnaires q on q.id=s.origin_questionnaire_id
    where s.started_stage='published' and q.status='published' and q.archived_at is null
    group by s.origin_questionnaire_id;
end;
$$;


ALTER FUNCTION private.published_submission_counts() OWNER TO postgres;

--
-- Name: question_answer_text(text, jsonb, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_answer_text(p_kind text, p_options jsonb, p_value text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare selection jsonb; item jsonb;
begin
 if p_value='' or p_kind='text' then return p_value;end if;
 if p_kind='scale' then return p_value||'점 · '||(array['전혀 그렇지 않다','그렇지 않다','보통이다','그렇다','매우 그렇다'])[p_value::integer];end if;
 if p_kind='single' then
  begin item:=p_value::jsonb;exception when invalid_text_representation then item:=to_jsonb(p_value);end;
  selection:=jsonb_build_array(item);
 else selection:=p_value::jsonb;end if;
 return (with options as (
   select o,position,
     sum(case when o->'isOther'='true'::jsonb then 1 else 0 end) over (order by position) as other_number,
     sum(case when o->'isOther'='true'::jsonb then 1 else 0 end) over () as other_total
   from jsonb_array_elements(p_options) with ordinality as items(o,position)
 )
 select string_agg(
   case when o->'isOther'='true'::jsonb
     then '직접 입력'||case when other_total>1 then ' '||other_number else '' end||': '||(a->>'text')
     else o->>'label' end,
   ', ' order by case when o->'isOther'='true'::jsonb then 1 else 0 end,position)
 from options
 join jsonb_array_elements(selection) a on o->>'id'=case when jsonb_typeof(a)='object' then a->>'id' else a#>>'{}' end);
end $$;


ALTER FUNCTION private.question_answer_text(p_kind text, p_options jsonb, p_value text) OWNER TO postgres;

--
-- Name: question_answer_valid(text, jsonb, text, boolean); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_answer_valid(p_kind text, p_options jsonb, p_value text, p_complete boolean) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare selection jsonb; item jsonb; option_item jsonb; selected_id text; seen text[]:='{}';
begin
 if p_value is null then return false;end if;
 if btrim(p_value)='' then return not p_complete;end if;
 if p_kind='text' then return true;end if;
 if p_kind='scale' then return p_value ~ '^[1-5]$';end if;
 if p_kind not in ('single','multiple') then return false;end if;
 if p_kind='single' then
  begin item:=p_value::jsonb;exception when invalid_text_representation then item:=to_jsonb(p_value);end;
  selection:=jsonb_build_array(item);
 else
  begin selection:=p_value::jsonb;exception when invalid_text_representation then return false;end;
 end if;
 if jsonb_typeof(selection) is distinct from 'array' then return false;end if;
 if jsonb_array_length(selection)=0 then return false;end if;
 for item in select value from jsonb_array_elements(selection) loop
  if jsonb_typeof(item)='string' then selected_id:=item#>>'{}';
  elsif jsonb_typeof(item)='object' and jsonb_typeof(item->'id')='string' then selected_id:=item->>'id';
  else return false;end if;
  if selected_id=any(seen) then return false;end if;
  select o into option_item from jsonb_array_elements(p_options) o where o->>'id'=selected_id;
  if not found then return false;end if;
  if option_item->'isOther'='true'::jsonb then
   if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'text') is distinct from 'string'
    or length(item->>'text')>5000 or (p_complete and btrim(item->>'text')='') then return false;end if;
  elsif jsonb_typeof(item) is distinct from 'string' then return false;end if;
  seen:=array_append(seen,selected_id);
 end loop;
 return true;
end $_$;


ALTER FUNCTION private.question_answer_valid(p_kind text, p_options jsonb, p_value text, p_complete boolean) OWNER TO postgres;

--
-- Name: question_config_valid(text, jsonb, boolean); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_config_valid(p_kind text, p_options jsonb, p_ready boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare o jsonb; ids text[]:='{}'; labels text[]:='{}'; other_count integer:=0;
begin
 if p_kind is null or p_kind not in ('text','scale','single','multiple') or jsonb_typeof(p_options) is distinct from 'array' then return false;end if;
 if p_kind in ('text','scale') then return jsonb_array_length(p_options)=0;end if;
 if jsonb_array_length(p_options)>20 or (p_ready and jsonb_array_length(p_options)<2) then return false;end if;
 for o in select value from jsonb_array_elements(p_options) loop
  if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'id') is distinct from 'string'
   or (o->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(o->'label') is distinct from 'string' or length(o->>'label')>500 or (o->>'id')=any(ids)
   or (p_ready and (btrim(o->>'label')='' or btrim(o->>'label')=any(labels))) then return false;end if;
  if o ? 'isOther' and jsonb_typeof(o->'isOther') is distinct from 'boolean' then return false;end if;
  if o->'isOther'='true'::jsonb then other_count:=other_count+1;end if;
  if p_kind='single' and other_count>1 then return false;end if;
  ids:=array_append(ids,o->>'id');labels:=array_append(labels,btrim(o->>'label'));
 end loop;
 return true;
end $_$;


ALTER FUNCTION private.question_config_valid(p_kind text, p_options jsonb, p_ready boolean) OWNER TO postgres;

--
-- Name: question_editor_settings_valid(jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_editor_settings_valid(p_fields jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare
  v_field jsonb;
  v_option jsonb;
  v_config jsonb;
  v_other_count integer;
begin
  if pg_catalog.jsonb_typeof(p_fields) is distinct from 'array' then return false; end if;
  for v_field in select value from pg_catalog.jsonb_array_elements(p_fields) loop
    if v_field ? 'required' and pg_catalog.jsonb_typeof(v_field->'required') is distinct from 'boolean' then
      return false;
    end if;
    if v_field ? 'explorationRecommended' and (
      v_field->>'kind' is distinct from 'text'
      or pg_catalog.jsonb_typeof(v_field->'explorationRecommended') is distinct from 'boolean'
    ) then return false; end if;
    if v_field ? 'studyRecommended' and (
      v_field->>'kind' is distinct from 'text'
      or pg_catalog.jsonb_typeof(v_field->'studyRecommended') is distinct from 'boolean'
    ) then return false; end if;
    if v_field ? 'choiceStyle' and (
      pg_catalog.jsonb_typeof(v_field->'choiceStyle') is distinct from 'string'
      or v_field->>'choiceStyle' not in ('list', 'chip')
    ) then
      return false;
    end if;
    if v_field ? 'choiceAllowText'
      and pg_catalog.jsonb_typeof(v_field->'choiceAllowText') is distinct from 'boolean' then
      return false;
    end if;
    if v_field ? 'scaleConfig' then
      if v_field->>'kind' <> 'scale' then return false; end if;
      v_config := v_field->'scaleConfig';
      if pg_catalog.jsonb_typeof(v_config) is distinct from 'object'
        or coalesce(v_config->>'max', '') !~ '^[2-9]$'
        or pg_catalog.jsonb_typeof(v_config->'allowText') is distinct from 'boolean'
        or pg_catalog.jsonb_typeof(v_config->'low') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_config->'middle') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_config->'high') is distinct from 'string'
        or pg_catalog.char_length(v_config->>'low') > 500
        or pg_catalog.char_length(v_config->>'middle') > 500
        or pg_catalog.char_length(v_config->>'high') > 500 then
        return false;
      end if;
      if (v_config->>'max')::integer <> (v_field->>'scaleMax')::integer then
        return false;
      end if;
    end if;
    v_other_count := 0;
    if pg_catalog.jsonb_typeof(v_field->'options') = 'array' then
      for v_option in select value from pg_catalog.jsonb_array_elements(v_field->'options') loop
        if v_option ? 'isOther' then
          if pg_catalog.jsonb_typeof(v_option->'isOther') is distinct from 'boolean' then
            return false;
          end if;
          if v_option->>'isOther' = 'true' then
            v_other_count := v_other_count + 1;
          end if;
        end if;
      end loop;
    end if;
    if v_field->>'kind' = 'single' and v_other_count > 1 then return false; end if;
  end loop;
  return true;
end $_$;


ALTER FUNCTION private.question_editor_settings_valid(p_fields jsonb) OWNER TO postgres;

--
-- Name: question_field_response_valid(jsonb, text, boolean); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_field_response_valid(f jsonb, v text, complete boolean) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare parsed jsonb; choices jsonb; choice jsonb; opt jsonb; k text:=f->>'kind'; seen text[]:='{}'; key text;
begin
 if k is null or k not in ('text','scale','single','multiple') then return false; end if;
 if v is null or length(v)>20000 then return false; end if;
 if btrim(v)='' then return not complete; end if;
 if k='text' then return not complete or length(btrim(private.question_search_plain(v)))>0; end if;

 if k='scale' then return private.scale_answer_valid(coalesce(f->'scaleConfig',jsonb_build_object('max',coalesce((f->>'scaleMax')::int,5),'low','','middle','','high','','allowText',false)),v,complete); end if;
 if k not in ('single','multiple') then return false; end if;
 begin parsed:=v::jsonb; exception when invalid_text_representation then parsed:=to_jsonb(v); end;
 if jsonb_typeof(parsed)='object' and parsed ? 'choices' then
 if not coalesce((f->>'choiceAllowText')::boolean,false) or jsonb_typeof(parsed->'text') is distinct from 'string' or length(parsed->>'text')>5000 or (select count(*) from jsonb_object_keys(parsed))<>2 then return false; end if;
 choices:=parsed->'choices';
 else choices:=case when k='multiple' then parsed else jsonb_build_array(parsed) end; end if;
 if jsonb_typeof(choices) is distinct from 'array' then return false; end if;
 if jsonb_array_length(choices)<1 or jsonb_array_length(choices)>100 or (k='single' and jsonb_array_length(choices)<>1) then return false; end if;
 for choice in select value from jsonb_array_elements(choices) loop
 select value into opt from jsonb_array_elements(f->'options') where value->>'id'=case when jsonb_typeof(choice)='string' then choice#>>'{}' else choice->>'id' end;
 if opt is null then return false; end if;
 if coalesce((opt->>'isOther')::boolean,false) then
 if jsonb_typeof(choice) is distinct from 'object' or jsonb_typeof(choice->'text') is distinct from 'string' or length(choice->>'text')>5000 or (complete and btrim(choice->>'text')='') or (choice ? 'entryId' and (k='single' or jsonb_typeof(choice->'entryId') is distinct from 'string' or length(choice->>'entryId') not between 1 and 100)) then return false; end if;
 key:='entry:'||coalesce(choice->>'entryId',choice->>'id');
 else
 if jsonb_typeof(choice) is distinct from 'string' then return false; end if;
 key:='option:'||(choice#>>'{}'); end if;
 if key=any(seen) then return false; end if; seen:=array_append(seen,key);
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;


ALTER FUNCTION private.question_field_response_valid(f jsonb, v text, complete boolean) OWNER TO postgres;

--
-- Name: question_flow_row_label(jsonb, jsonb, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_flow_row_label(p_definition jsonb, p_row jsonb, p_position integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
  select case
    when p_definition->>'answer_layout'='flow' and p_row ? 'flowAfter'
      then coalesce(nullif(regexp_replace(p_row->>'label','^[[:space:]]+|[[:space:]]+$','','g'),''),'추가 시기')
    when p_definition->>'answer_layout'='flow' and p_row ? 'flowIndex'
      then coalesce(nullif(btrim(p_definition->'row_labels'->>((p_row->>'flowIndex')::integer-1)),''),p_row->>'flowIndex')
    else coalesce(nullif(btrim(p_definition->'row_labels'->>(p_position-1)),''),p_position::text)
  end;
$_$;


ALTER FUNCTION private.question_flow_row_label(p_definition jsonb, p_row jsonb, p_position integer) OWNER TO postgres;

--
-- Name: question_flow_settings_valid(jsonb, text, text, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_flow_settings_valid(p_slots jsonb, p_layout text, p_mode text, p_max_rows integer) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare slot jsonb; base_count integer;
begin
  if jsonb_typeof(p_slots) is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_slots)=0 then return true; end if;
  base_count:=case when p_mode='single' then 1 when p_mode='repeatable' then p_max_rows else null end;
  if p_layout is distinct from 'flow' or base_count is null or base_count not between 1 and 19
    or jsonb_array_length(p_slots)>base_count then return false; end if;
  for slot in select value from jsonb_array_elements(p_slots) loop
    if jsonb_typeof(slot) is distinct from 'number' or slot::text !~ '^[1-9][0-9]?$' then return false; end if;
    if slot::text::integer>base_count then return false; end if;
  end loop;
  return (select count(distinct value) from jsonb_array_elements(p_slots))=jsonb_array_length(p_slots);
end $_$;


ALTER FUNCTION private.question_flow_settings_valid(p_slots jsonb, p_layout text, p_mode text, p_max_rows integer) OWNER TO postgres;

--
-- Name: question_response_requirements_valid(jsonb, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_response_requirements_valid(rule jsonb, fields jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare ids jsonb;
begin
 if rule is null then return true; end if;
 if jsonb_typeof(rule) is distinct from 'object' or rule->>'kind' is distinct from 'career_flow'
   or (rule - array['kind','startFieldIds','admissionFieldId']) <> '{}'::jsonb
   or jsonb_typeof(rule->'startFieldIds') is distinct from 'array'
   or jsonb_typeof(rule->'admissionFieldId') is distinct from 'string' then return false; end if;
 if jsonb_array_length(rule->'startFieldIds')<>2 then return false; end if;
 ids := (rule->'startFieldIds') || jsonb_build_array(rule->'admissionFieldId');
 return (select count(distinct value)=3 from jsonb_array_elements_text(ids)) and not exists (
   select 1 from jsonb_array_elements(ids) id where jsonb_typeof(id)<>'string' or not exists (
     select 1 from jsonb_array_elements(fields) f where f->'id'=id and f->>'kind'='text'));
end $$;


ALTER FUNCTION private.question_response_requirements_valid(rule jsonb, fields jsonb) OWNER TO postgres;

--
-- Name: question_review_counts(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_review_counts() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)) from (
 select p.questionnaire_id,count(distinct r.id) as count,
 count(distinct r.id) filter (where exists(select 1 from public.questions source where source.id=r.question_id and source.created_by=auth.uid()) and r.requested_by<>auth.uid() and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid())) as unread_count
 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id join public.question_review_requests r on r.question_id=p.source_question_id and r.resolved_at is null
 where private.can_read_question_reviews(r.question_id) and (d.created_by=auth.uid() or private.is_admin() or (v.status='in_review' and d.archived_at is null)) group by p.questionnaire_id
 ) c),'[]'::jsonb);
end $$;


ALTER FUNCTION private.question_review_counts() OWNER TO postgres;

--
-- Name: question_row_labels_valid(jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_row_labels_valid(labels jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case when jsonb_typeof(labels) <> 'array' then false else
    jsonb_array_length(labels) <= 20 and not exists (
      select 1 from jsonb_array_elements(labels) entry
      where jsonb_typeof(entry) <> 'string' or char_length(entry #>> '{}') > 100
    ) end;
$$;


ALTER FUNCTION private.question_row_labels_valid(labels jsonb) OWNER TO postgres;

--
-- Name: question_search_node(jsonb, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_search_node(p_node jsonb, p_depth integer DEFAULT 0) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare kind text:=p_node->>'type'; result text:=''; child jsonb; part text; first_item boolean:=true;
begin
  if p_depth>16 or jsonb_typeof(p_node) is distinct from 'object' then return null; end if;
  if kind='text' then
    if jsonb_typeof(p_node->'text') is distinct from 'string' then return null; end if;
    return p_node->>'text';
  end if;
  if kind='hardBreak' then return E'\n'; end if;
  if kind is null or kind not in ('doc','paragraph','bulletList','orderedList','listItem') then return null; end if;
  if p_node ? 'content' and jsonb_typeof(p_node->'content') is distinct from 'array' then return null; end if;
  for child in select value from jsonb_array_elements(coalesce(p_node->'content','[]'::jsonb)) loop
    part:=private.question_search_node(child,p_depth+1);
    if part is null then return null; end if;
    if not first_item and kind<>'paragraph' then result:=result||E'\n'; end if;
    result:=result||part; first_item:=false;
  end loop;
  return result;
end $$;


ALTER FUNCTION private.question_search_node(p_node jsonb, p_depth integer) OWNER TO postgres;

--
-- Name: question_search_plain(text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.question_search_plain(p_text text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare doc jsonb;
begin
  if left(p_text,length('::mea-rich-text:v1::')) <> '::mea-rich-text:v1::' then return p_text; end if;
  begin doc:=substring(p_text from length('::mea-rich-text:v1::')+1)::jsonb;
  exception when invalid_text_representation then return p_text; end;
  if doc->>'type' is distinct from 'doc' then return p_text; end if;
  return coalesce(private.question_search_node(doc),p_text);
end $$;


ALTER FUNCTION private.question_search_plain(p_text text) OWNER TO postgres;

--
-- Name: questionnaire_guide_question_ids(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.questionnaire_guide_question_ids(qid uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if auth.uid() is null or not exists(select 1 from public.questionnaires where id=qid and (created_by=auth.uid() or private.is_admin() or (status='in_review' and archived_at is null and private.is_consultant_lead()))) then raise exception 'Questionnaire author required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(distinct r.question_id) from public.question_responses r join public.response_sessions s on s.id=r.session_id where s.origin_questionnaire_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='in_review' and exists(select 1 from jsonb_array_elements(r.rows) row cross join lateral jsonb_each_text(row->'answers') a where btrim(private.question_search_plain(a.value))<>'')),'[]');
end $$;


ALTER FUNCTION private.questionnaire_guide_question_ids(qid uuid) OWNER TO postgres;

--
-- Name: questionnaire_list_items(uuid[], text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.questionnaire_list_items(p_ids uuid[], p_view_role text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare role text:=private.questionnaire_read_role(p_view_role); staff boolean:=role<>'consultant';
begin
  if p_ids is null or cardinality(p_ids)>14 or array_position(p_ids,null) is not null then
    raise exception 'Expected up to 14 questionnaire IDs' using errcode='22023';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',q.id,'title',q.title,'status',q.status,'archivedAt',q.archived_at,
    'reviewStartedAt',q.review_started_at,'publishedAt',q.published_at,
    'updatedAt',q.updated_at,'revision',q.revision,'hasPublished',q.status='published',
    'isOwner',staff and q.created_by=auth.uid(),
    'canEditDraft',staff and q.status='draft' and (role='admin' or q.created_by=auth.uid()),
    'canDelete',staff and (role='admin' or q.created_by=auth.uid()),
    'creatorName',case when staff and q.status in ('in_review','published') and q.archived_at is null
      then (select p.name from public.profiles p where p.id=q.created_by) end,
    'submittedResponseCount',case when staff and q.status='published' and q.archived_at is null then (
      select count(*) from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id
      where s.origin_questionnaire_id=q.id and s.started_stage='published') else 0 end,
    'responseStatus',(select s.status from public.response_sessions s where s.origin_questionnaire_id=q.id
      and s.respondent_id=auth.uid() and s.started_stage='published'),
    'pendingReviewCount',case when staff and q.created_by=auth.uid() then reviews.pending else 0 end,
    'unreadReviewCount',case when staff then reviews.unread else 0 end
  ) order by array_position(p_ids,q.id))
  from private.questionnaire_read_scope(role) q
  left join lateral (
    select count(distinct r.id) as pending,
      count(distinct r.id) filter(where source.created_by=auth.uid() and r.requested_by<>auth.uid()
        and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid())) as unread
    from public.questionnaire_questions placement
    join public.questions source on source.id=placement.source_question_id
    join public.question_review_requests r on r.question_id=source.id and r.resolved_at is null
    where staff and placement.questionnaire_id=q.id and private.can_read_question_reviews(r.question_id)
      and (q.created_by=auth.uid() or role='admin' or (q.status='in_review' and q.archived_at is null))
  ) reviews on true
  where q.id=any(p_ids)), '[]'::jsonb);
end $$;


ALTER FUNCTION private.questionnaire_list_items(p_ids uuid[], p_view_role text) OWNER TO postgres;

--
-- Name: questionnaire_read_role(text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.questionnaire_read_role(p_view_role text) RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare actual text;
begin
  select role into actual from public.profiles where id=(select auth.uid());
  if auth.uid() is null or actual is null or actual not in ('admin','consultant_lead','consultant')
    or p_view_role is null or p_view_role not in ('admin','consultant_lead','consultant')
    or (actual <> 'admin' and p_view_role <> actual) then
    raise exception 'Questionnaire access required' using errcode='42501';
  end if;
  return p_view_role;
end $$;


ALTER FUNCTION private.questionnaire_read_role(p_view_role text) OWNER TO postgres;

--
-- Name: questionnaire_read_scope(text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.questionnaire_read_scope(p_view_role text) RETURNS SETOF public.questionnaires
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select q.* from public.questionnaires q
  cross join (select private.questionnaire_read_role(p_view_role) as role) r
  where r.role='admin'
    or (r.role='consultant_lead' and (q.status<>'draft' or q.created_by=(select auth.uid())))
    or (r.role='consultant' and q.status='published' and q.archived_at is null);
$$;


ALTER FUNCTION private.questionnaire_read_scope(p_view_role text) OWNER TO postgres;

--
-- Name: read_guide_answers(uuid[]); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_guide_answers(p_question_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','consultant_lead','consultant')) then raise exception 'Guide answer access denied' using errcode='42501'; end if;
 if cardinality(p_question_ids)>500 then raise exception 'Too many questions' using errcode='22023'; end if;
 return coalesce((select jsonb_object_agg(q.id::text,jsonb_build_object('rows',shown.rows)) from public.questions q cross join lateral (
 select r.rows,r.active_row_ids from public.question_responses r join public.response_sessions s on s.id=r.session_id where r.question_id=q.id and s.respondent_id=private.guide_consultant_id() and s.started_stage='in_review' order by r.updated_at desc,r.id limit 1
 
 ) a cross join lateral (
 select coalesce(jsonb_agg((jsonb_build_object('id',row.value->'id','label',private.question_flow_row_label(to_jsonb(q),row.value,row.ord::integer),'answers',row.value->'answers')
   ||jsonb_strip_nulls(jsonb_build_object('flowIndex',row.value->'flowIndex','flowAfter',row.value->'flowAfter'))) order by row.ord),'[]') rows
 from jsonb_array_elements(a.rows) with ordinality row(value,ord)
 where a.active_row_ids @> jsonb_build_array(row.value->'id')
 and exists(select 1 from jsonb_array_elements(q.fields) f where private.question_field_response_valid(f,coalesce(row.value->'answers'->>(f->>'id'),''),true))
 ) shown where q.id=any(p_question_ids) and q.archived_at is null and jsonb_array_length(shown.rows)>0 and (
   ((private.is_admin() or private.is_consultant_lead()) and (
     q.created_by=auth.uid() or private.is_admin() or exists(
       select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id
       where p.source_question_id=q.id and v.status='in_review' and v.archived_at is null
     )
   ))
   or exists(
     select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id
     where p.source_question_id=q.id and v.status='published' and v.archived_at is null
   )
 )),'{}');
end $$;


ALTER FUNCTION private.read_guide_answers(p_question_ids uuid[]) OWNER TO postgres;

--
-- Name: read_published_question_response_session(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_published_question_response_session(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare s public.response_sessions%rowtype; qs jsonb; sections jsonb; sid uuid; begin
 sid:=private.owned_published_question_session(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid;
 select coalesce(jsonb_agg(jsonb_build_object('responseId',r.id,'questionId',r.question_id,'definition',d.def,'rows',r.rows,'activeRowIds',r.active_row_ids) order by r.id),'[]') into qs
 from public.question_responses r cross join lateral (select private.published_response_definition(r.question_id) def) d where r.session_id=s.id and d.def is not null and exists(select 1 from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p where p->>'sourceQuestionId'=r.question_id::text);
 select coalesce(jsonb_agg(sec.value||jsonb_build_object('questions',coalesce((select jsonb_agg(p.value order by p.ord) from jsonb_array_elements(sec.value->'questions') with ordinality p(value,ord) where exists(select 1 from jsonb_array_elements(qs) q where q#>>'{definition,id}'=p.value->>'sourceQuestionId')),'[]')) order by sec.ord),'[]') into sections from jsonb_array_elements(s.layout) with ordinality sec(value,ord);
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'startNotice',(select v.start_notice from public.questionnaires v where v.id=s.origin_questionnaire_id),'sections',sections,'questions',qs,'definitionToken',md5(s.origin_title||sections::text||(select coalesce(jsonb_agg(q->'definition' order by q#>>'{definition,id}'),'[]')::text from jsonb_array_elements(qs) q)),'sourceDeleted',false,'stage','published','submittedAt',s.submitted_at,'hasUnsubmittedChanges',exists(select 1 from public.response_submissions sub where sub.session_id=s.id and sub.revision<s.revision));
end $$;


ALTER FUNCTION private.read_published_question_response_session(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: read_published_question_response_version(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_published_question_response_version(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select private.response_poll_version(private.read_published_question_response_session(p_questionnaire_id));
$$;


ALTER FUNCTION private.read_published_question_response_version(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: read_published_response(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_published_response(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare s public.response_sessions%rowtype;
begin
 perform private.assert_published_response_access(p_questionnaire_id);
 select * into s from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid();
 return jsonb_build_object('revision',coalesce(s.revision,0),'status',coalesce(s.status,'assigned'),'savedAt',case when s.revision>0 then s.updated_at else null end,'freeResponse',coalesce(s.free_response,''),'answers',coalesce((select jsonb_object_agg(r.origin_placement_id::text,coalesce(r.rows#>>array['0','answers',r.origin_placement_id::text],'')) from public.question_responses r where r.session_id=s.id),'{}'::jsonb));
end $$;


ALTER FUNCTION private.read_published_response(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: read_question_reviews(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_question_reviews(qid uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare owner_id uuid; in_review boolean; begin
 if not private.can_read_question_reviews(qid) then raise exception 'Review access denied' using errcode='42501'; end if;
 select created_by into owner_id from public.questions where id=qid;
 select exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id join public.questions q on q.id=p.source_question_id where q.id=qid and q.archived_at is null and v.status='in_review' and d.archived_at is null) into in_review;
 return jsonb_build_object('canResolve',owner_id=auth.uid() or private.is_admin(),'canRequest',private.can_request_question_review(qid,null),'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.question_review_requests r where r.question_id=qid),'[]'::jsonb));
end $$;


ALTER FUNCTION private.read_question_reviews(qid uuid) OWNER TO postgres;

--
-- Name: read_review_response_session(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_review_response_session(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare s public.response_sessions%rowtype; qs jsonb; sections jsonb; sid uuid; begin
 sid:=private.sync_review_response_layout(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid;
 select coalesce(jsonb_agg(jsonb_build_object('responseId',r.id,'questionId',r.question_id,'definition',d.def,'rows',r.rows,'activeRowIds',r.active_row_ids) order by r.id),'[]') into qs
 from public.question_responses r cross join lateral (select private.live_response_definition(r.question_id) def) d where r.session_id=s.id and d.def is not null and exists(select 1 from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p where p->>'sourceQuestionId'=r.question_id::text);
 select coalesce(jsonb_agg(sec.value||jsonb_build_object('questions',coalesce((select jsonb_agg(p.value order by p.ord) from jsonb_array_elements(sec.value->'questions') with ordinality p(value,ord) where exists(select 1 from jsonb_array_elements(qs) q where q#>>'{definition,id}'=p.value->>'sourceQuestionId')),'[]')) order by sec.ord),'[]') into sections from jsonb_array_elements(s.layout) with ordinality sec(value,ord);
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'startNotice',(select v.start_notice from public.questionnaires v where v.id=s.origin_questionnaire_id),'sections',sections,'questions',qs,'definitionToken',md5(s.origin_title||sections::text||(select coalesce(jsonb_agg(q->'definition' order by q#>>'{definition,id}'),'[]')::text from jsonb_array_elements(qs) q)),'sourceDeleted',s.origin_questionnaire_id is null);
end $$;


ALTER FUNCTION private.read_review_response_session(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: read_review_response_version(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_review_response_version(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select private.response_poll_version(private.read_review_response_session(p_questionnaire_id));
$$;


ALTER FUNCTION private.read_review_response_version(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: read_shared_question_sources(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_shared_question_sources(p_questionnaire_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','consultant_lead','consultant')) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.questionnaires v
    join public.questionnaires parent on parent.id=v.id
    where v.id=p_questionnaire_id and (v.status='published' or (v.status='in_review' and (private.is_admin() or private.is_consultant_lead()))) and parent.archived_at is null
  ) then raise exception 'Review questionnaire not found' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',q.id,'created_by',q.created_by,'title',q.title,'prompt',q.prompt,
        'purpose',q.purpose,'button_label',q.button_label,'fields',q.fields,'response_requirements',q.response_requirements,'row_mode',q.row_mode,'max_rows',q.max_rows,
        'min_rows',q.min_rows,'row_labels',q.row_labels,
        'answer_layout',q.answer_layout,'initial_rows',q.initial_rows,'flow_insert_after',q.flow_insert_after,
        'source_block_id',q.source_block_id,'source_field_id',q.source_field_id,
        'after_block_id',q.after_block_id,'condition',q.condition,
        'revision',q.revision,'created_at',q.created_at,'updated_at',q.updated_at,'archived_at',q.archived_at,
        'details',coalesce((select jsonb_agg(jsonb_build_object(
          'id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants,'position',d.position
        ) order by d.position,d.id) from public.question_details d where d.question_id=q.id and (d.visible_to_consultants or private.is_admin() or private.is_consultant_lead())),'[]'::jsonb)
      ) order by q.id
    ) from public.questions q where exists (
      select 1 from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=q.id
    )
  ),'[]'::jsonb);
end $$;


ALTER FUNCTION private.read_shared_question_sources(p_questionnaire_id uuid) OWNER TO postgres;

--
-- Name: read_submitted_response(uuid, uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_submitted_response(qid uuid, sid uuid, expected_revision integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare result jsonb; actual_revision integer;
begin
 perform private.assert_submission_staff_access(qid);
 select sub.revision,jsonb_build_object('id',s.id,'revision',sub.revision,'respondentName',p.name,'submittedAt',sub.submitted_at,'title',s.origin_title,'sections',s.layout,'questions',
   (select coalesce(jsonb_agg(jsonb_build_object('questionId',a.key,'responseId',a.value->'responseId','rows',a.value->'rows','activeRowIds',a.value->'activeRowIds','definition',private.published_response_definition(a.key::uuid))),'[]') from jsonb_each(sub.answers) a))
 into actual_revision,result
 from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id join public.profiles p on p.id=s.respondent_id
 where s.id=sid and s.origin_questionnaire_id=qid and s.started_stage='published';
 if result is null then raise exception 'Submission not found' using errcode='P0002'; end if;
 if expected_revision is not null and actual_revision<>expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Submission changed during export', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdTdWJtaXNzaW9uIGNoYW5nZWQgZHVyaW5nIGV4cG9ydCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */ end if;
 return result;
end $$;


ALTER FUNCTION private.read_submitted_response(qid uuid, sid uuid, expected_revision integer) OWNER TO postgres;

--
-- Name: read_submitted_response_manifest(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_submitted_response_manifest(qid uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 perform private.assert_submission_staff_access(qid);
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'revision',sub.revision) order by sub.submitted_at desc,s.id)
 from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id
 where s.origin_questionnaire_id=qid and s.started_stage='published'),'[]');
end $$;


ALTER FUNCTION private.read_submitted_response_manifest(qid uuid) OWNER TO postgres;

--
-- Name: read_submitted_response_page(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.read_submitted_response_page(qid uuid, page integer DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare total integer; pages integer; actual_page integer; items jsonb;
begin
 perform private.assert_submission_staff_access(qid);
 if page is null or page not between 1 and 100000 then raise exception 'Invalid page' using errcode='22023'; end if;
 select count(*) into total from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id
 where s.origin_questionnaire_id=qid and s.started_stage='published';
 pages:=greatest(1,(total+9)/10); actual_page:=least(page,pages);
 select coalesce(jsonb_agg(item order by submitted_at desc,id),'[]') into items from (
   select s.id,sub.submitted_at,jsonb_build_object('id',s.id,'respondentName',p.name,'submittedAt',sub.submitted_at,'revision',sub.revision) item
   from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id join public.profiles p on p.id=s.respondent_id
   where s.origin_questionnaire_id=qid and s.started_stage='published'
   order by sub.submitted_at desc,s.id limit 10 offset (actual_page-1)*10
 ) page_items;
 return jsonb_build_object('items',items,'total',total,'page',actual_page,'pages',pages);
end $$;


ALTER FUNCTION private.read_submitted_response_page(qid uuid, page integer) OWNER TO postgres;

--
-- Name: reconcile_guide_fields(uuid, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.reconcile_guide_fields(qid uuid, old_fields jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare d jsonb; r record; cleaned jsonb;
begin
 d:=private.live_response_definition(qid);
 for r in select a.* from public.question_responses a join public.response_sessions s on s.id=a.session_id where a.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='in_review' order by a.id for update of a loop
 cleaned:=private.prune_guide_fields(r.rows,old_fields,d->'fields');
 update public.question_responses set rows=cleaned,body=private.guide_rows_body(cleaned,d->'fields',r.active_row_ids),
 updated_at=now() where id=r.id;
 update public.response_sessions set revision=revision+1,last_save_id=null,last_payload=null,updated_at=now() where id=r.session_id;
 end loop;
end $$;


ALTER FUNCTION private.reconcile_guide_fields(qid uuid, old_fields jsonb) OWNER TO postgres;

--
-- Name: reconcile_guide_question_update(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.reconcile_guide_question_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 perform private.reconcile_guide_fields(new.id,old.fields);
 return new;
end $$;


ALTER FUNCTION private.reconcile_guide_question_update() OWNER TO postgres;

--
-- Name: reject_deleted_questionnaire(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.reject_deleted_questionnaire() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if exists(select 1 from private.deleted_questionnaires where questionnaire_id=new.id) then
    raise exception 'Questionnaire was deleted' using errcode='55000';
  end if;
  return new;
end $$;


ALTER FUNCTION private.reject_deleted_questionnaire() OWNER TO postgres;

--
-- Name: reject_new_registration_question(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.reject_new_registration_question() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 if new.purpose='study_registration' then
 raise exception 'Study registration is a questionnaire start notice' using errcode='22023';
 end if;
 return new;
end $$;


ALTER FUNCTION private.reject_new_registration_question() OWNER TO postgres;

--
-- Name: remove_archived_review_answers(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.remove_archived_review_answers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if new.archived_at is not null and old.archived_at is null then
 -- Invalidate retry payloads so deleted answer text is not retained in session metadata.
 update public.response_sessions s set last_payload=null,last_save_id=null where s.started_stage='in_review' and exists(select 1 from public.question_responses r where r.session_id=s.id and r.question_id=new.id);
 -- Clear only in_review links; published history remains protected.
 update public.question_responses r set referenced_response_id=null from public.response_sessions s where s.id=r.session_id and s.started_stage='in_review' and r.referenced_response_id in (select a.id from public.question_responses a where a.question_id=new.id);
 delete from public.question_responses r using public.response_sessions s where r.session_id=s.id and r.question_id=new.id and s.started_stage='in_review';
 end if; return new;
end $$;


ALTER FUNCTION private.remove_archived_review_answers() OWNER TO postgres;

--
-- Name: remove_unplaced_guide_answers(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.remove_unplaced_guide_answers(qid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sid uuid; deleted_count integer;
begin
 select id into sid from public.response_sessions where origin_questionnaire_id=qid and respondent_id=private.guide_consultant_id() and started_stage='in_review' for update;
 if sid is null then return; end if;
 update public.question_responses set referenced_response_id=null where session_id=sid and referenced_response_id in (
 select r.id from public.question_responses r where r.session_id=sid and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=qid and p.source_question_id=r.question_id));
 delete from public.question_responses r where r.session_id=sid and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=qid and p.source_question_id=r.question_id);
 get diagnostics deleted_count=row_count;
 if deleted_count>0 then update public.response_sessions set revision=revision+1,last_payload=null,last_save_id=null,updated_at=now() where id=sid;end if;
end $$;


ALTER FUNCTION private.remove_unplaced_guide_answers(qid uuid) OWNER TO postgres;

--
-- Name: request_question_review(uuid, uuid, uuid, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor public.profiles%rowtype; rev integer; begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.role not in ('admin','consultant_lead') then raise exception 'Staff required' using errcode='42501'; end if;
 if p_id is null or p_description is null or length(btrim(p_description)) not between 1 and 5000 then raise exception 'Invalid review' using errcode='22023'; end if;
 select revision into rev from public.questions where id=p_question_id and archived_at is null and created_by<>auth.uid() for share;
 if not found then raise exception 'Question unavailable' using errcode='42501'; end if;
 perform 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id
 where p.source_question_id=p_question_id and v.status='in_review' and v.archived_at is null for share of p,v;
 if not found then raise exception 'Review question required' using errcode='42501'; end if;
 -- Source questionnaire is historical metadata only; new requests belong solely to the question.
 insert into public.question_review_requests(id,question_id,origin_questionnaire_id,question_revision,requested_by,requester_name,description,title)
 values(p_id,p_question_id,null,rev,actor.id,actor.name,btrim(p_description),'') on conflict(id) do nothing;
 if not exists(select 1 from public.question_review_requests where id=p_id and question_id=p_question_id and requested_by=actor.id and description=btrim(p_description)) then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Review conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXZpZXcgY29uZmxpY3QnIHVzaW5nIGVycmNvZGU9JzQwMDAxJzs= */ end if;
end $$;


ALTER FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) OWNER TO postgres;

--
-- Name: resolve_question_review(uuid, uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.resolve_question_review(p_id uuid, p_question_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) or not exists(select 1 from public.questions where id=p_question_id and (created_by=auth.uid() or private.is_admin())) then raise exception 'Question owner required' using errcode='42501'; end if;
 update public.question_review_requests set resolved_by=coalesce(resolved_by,auth.uid()),resolved_at=coalesce(resolved_at,now()) where id=p_id and question_id=p_question_id;
 if not found then raise exception 'Review not found' using errcode='22023'; end if;
end $$;


ALTER FUNCTION private.resolve_question_review(p_id uuid, p_question_id uuid) OWNER TO postgres;

--
-- Name: response_clause_matches(jsonb, jsonb, jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.response_clause_matches(def jsonb, row_data jsonb, clause jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
declare f jsonb; v text; parsed jsonb; choices jsonb; score numeric;
begin
 if clause->>'op'='answered' then
 for f in select value from jsonb_array_elements(def->'fields') where not(clause ? 'fieldId') or value->>'id'=clause->>'fieldId' loop
 if not private.question_field_response_valid(f,coalesce(row_data->'answers'->>(f->>'id'),''),true) then return false; end if;
 end loop;
 return found;
 end if;
 select value into f from jsonb_array_elements(def->'fields') where value->>'id'=clause->>'fieldId';
 v:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if f is null or not private.question_field_response_valid(f,v,true) then return false; end if;
 if f->>'kind'='text' then return clause->>'op'='equals' and btrim(private.question_search_plain(v))=clause->>'value'; end if;
 if f->>'kind'='scale' then
 parsed:=v::jsonb; score:=case when jsonb_typeof(parsed)='number' then (parsed#>>'{}')::numeric else (parsed->>'score')::numeric end;
 return case clause->>'op' when 'gte' then score>=(clause->>'value')::numeric when 'lte' then score<=(clause->>'value')::numeric when 'equals' then score=(clause->>'value')::numeric else false end;
 end if;
 begin parsed:=v::jsonb; exception when invalid_text_representation then parsed:=to_jsonb(v); end;
 choices:=case when parsed ? 'choices' then parsed->'choices' when f->>'kind'='multiple' then parsed else jsonb_build_array(parsed) end;
 return exists(select 1 from jsonb_array_elements(choices) c where case when jsonb_typeof(c)='string' then c#>>'{}' else c->>'id' end=clause->>'value');
end $$;


ALTER FUNCTION private.response_clause_matches(def jsonb, row_data jsonb, clause jsonb) OWNER TO postgres;

--
-- Name: response_poll_version(jsonb); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.response_poll_version(snapshot jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 select jsonb_build_object('id',snapshot->'id','revision',snapshot->'revision',
 'definitionToken',snapshot->'definitionToken','status',snapshot->'status',
 'savedAt',snapshot->'savedAt','submittedAt',snapshot->'submittedAt',
 'sourceDeleted',snapshot->'sourceDeleted','hasUnsubmittedChanges',coalesce(snapshot->'hasUnsubmittedChanges','false'::jsonb),
 'startNotice',snapshot->'startNotice');
$$;


ALTER FUNCTION private.response_poll_version(snapshot jsonb) OWNER TO postgres;

--
-- Name: save_exploration(uuid, jsonb, jsonb, integer, uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_exploration(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
   if v.deleted_at is not null then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Deleted', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdEZWxldGVkJyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */ end if;
   if v.save_id=p_save_id then
     if v.values=p_values and v.reports=p_reports then return to_jsonb(v); end if;
     raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Reused save id', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXVzZWQgc2F2ZSBpZCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */
   end if;
   if v.revision<>p_expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Revision conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXZpc2lvbiBjb25mbGljdCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */ end if;
 elsif p_expected_revision<>0 then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Missing activity', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdNaXNzaW5nIGFjdGl2aXR5JyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */ end if;
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
$_$;


ALTER FUNCTION private.save_exploration(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) OWNER TO postgres;

--
-- Name: save_published_question_response_session(uuid, jsonb, integer, uuid, boolean, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_published_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb; current_token text; is_career_flow boolean;
begin
 perform private.owned_published_question_session(p_questionnaire_id);
 perform 1 from public.questions q where exists(select 1 from public.question_responses a where a.session_id=private.owned_published_question_session(p_questionnaire_id) and a.question_id=q.id) order by q.id for share;
 select * into s from public.response_sessions where id=private.owned_published_question_session(p_questionnaire_id) for update;
 if not found then raise exception 'Start response first' using errcode='22023'; end if;
 if p_save_id is null or p_revision is null or p_complete is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid response' using errcode='22023'; end if;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if s.last_save_id=p_save_id and s.last_payload=payload then return private.read_published_question_response_session(p_questionnaire_id); end if;
 current_token:=private.read_published_question_response_session(p_questionnaire_id)->>'definitionToken';
 if p_definition_token is distinct from current_token then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Question definition changed', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbiBkZWZpbml0aW9uIGNoYW5nZWQnIHVzaW5nIGVycmNvZGU9JzQwMDAxJzs= */ end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Response conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXNwb25zZSBjb25mbGljdCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */ end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p->>'id')::uuid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 if p_complete and not exists (
   select 1 from jsonb_array_elements(s.layout) sec
   cross join lateral jsonb_array_elements(sec->'questions') p
   join public.question_responses answer on answer.session_id=s.id and answer.origin_placement_id=(p->>'id')::uuid
   join public.questions question on question.id=answer.question_id
   where question.purpose='response' and question.archived_at is null
 ) then raise exception 'Answer questions are required for completion' using errcode='22023'; end if;
 -- Session layout keeps only ordering/source IDs; definitions and answers belong to questions.
 for r in select a.*,private.live_response_definition(a.question_id) def from jsonb_array_elements(s.layout) with ordinality sec(section,si)
 cross join lateral jsonb_array_elements(sec.section->'questions') with ordinality p(placement,pi)
 join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p.placement->>'id')::uuid
 order by sec.si,p.pi loop
 is_career_flow:=nullif(r.def->'response_requirements','null') is not null;
 rows_data:=p_answers->r.question_id::text;
 if r.def->>'purpose'='study_registration' then
   if jsonb_typeof(rows_data) is distinct from 'array' or rows_data<>'[]'::jsonb then
     raise exception 'Study registration cards accept no answer rows' using errcode='22023';
   end if;
   active:=active||jsonb_build_object(r.question_id::text,'[]'::jsonb);
   update public.question_responses set rows='[]'::jsonb,active_row_ids='[]'::jsonb,body='',updated_at=now() where id=r.id;
   continue;
 end if;
 rows_data:=private.prepare_question_response_rows(r.def,rows_data,r.rows);
 matched:='{}'; all_mode:=coalesce(r.def#>>'{condition,mode}','all')<>'any'; waiting:=false;
 for source_id in select distinct value->>'blockId' from jsonb_array_elements(coalesce(nullif(r.def#>'{condition,clauses}','null'::jsonb),'[]')) loop
 select private.live_response_definition(a.question_id) into source_def from public.question_responses a where a.session_id=s.id and a.question_id::text=source_id;
 ids:='[]';
 for row_data in select value from jsonb_array_elements(coalesce(active->source_id,'[]')) loop
 source_ok:=all_mode;
 for clause in select value from jsonb_array_elements(r.def#>'{condition,clauses}') where value->>'blockId'=source_id loop
 if all_mode then source_ok:=source_ok and private.response_clause_matches(source_def,row_data,clause); else source_ok:=source_ok or private.response_clause_matches(source_def,row_data,clause); end if;
 end loop;
 if source_ok then ids:=ids||jsonb_build_array(row_data); end if;
 end loop;
 matched:=matched||jsonb_build_object(source_id,ids);
 end loop;
 if matched<>'{}' then
 if all_mode then waiting:=exists(select 1 from jsonb_each(matched) m where jsonb_array_length(m.value)=0);
 else waiting:=not exists(select 1 from jsonb_each(matched) m where jsonb_array_length(m.value)>0); end if;
 end if;
 if r.def->>'after_block_id' is not null then waiting:=waiting or jsonb_array_length(coalesce(active->(r.def->>'after_block_id'),'[]'))=0; end if;
 ref_ids:=null;
 if r.def->>'row_mode'='reference' then
 source_id:=r.def->>'source_block_id';
 ref_ids:=coalesce(matched->source_id,active->source_id,'[]');
 if r.def->>'source_field_id' is not null then
 select private.live_response_definition(a.question_id) into source_def from public.question_responses a where a.session_id=s.id and a.question_id::text=source_id;
 select value into f from jsonb_array_elements(source_def->'fields') where value->>'id'=r.def->>'source_field_id';
 select coalesce(jsonb_agg(value),'[]') into ref_ids from jsonb_array_elements(ref_ids) where private.question_field_response_valid(f,coalesce(value->'answers'->>(f->>'id'),''),true);
 end if;
 waiting:=waiting or jsonb_array_length(ref_ids)=0;
 end if;
 ids:='[]'; matched:='[]'; body_text:='';
 for row_data in select value from jsonb_array_elements(rows_data) loop
 if waiting or (ref_ids is not null and not exists(select 1 from jsonb_array_elements(ref_ids) x where x->'id'=row_data->'id')) then continue; end if;
 if p_complete and not is_career_flow and exists (
   select 1 from jsonb_array_elements(r.def->'fields') field_item
   where field_item->>'kind'<>'text'
     and btrim(coalesce(row_data->'answers'->>(field_item->>'id'),''))<>''
     and not private.question_field_response_valid(field_item,coalesce(row_data->'answers'->>(field_item->>'id'),''),true)
 ) then raise exception 'Complete nonempty typed answers' using errcode='22023'; end if;
 if r.def->>'answer_layout' in ('table','flow') and not exists (
   select 1 from jsonb_array_elements(r.def->'fields') field_item
   where private.question_field_response_valid(field_item,coalesce(row_data->'answers'->>(field_item->>'id'),''),true)
 ) then continue; end if;
 if p_complete and row_data ? 'flowAfter' and coalesce(row_data->>'label','') ~ '^[[:space:]]*$' then
   raise exception 'Name every answered inserted flow period' using errcode='22023';
 end if;
 ids:=ids||jsonb_build_array(row_data->'id'); source_ok:=false;
 for f in select value from jsonb_array_elements(r.def->'fields') loop
 val:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if p_complete and not is_career_flow and coalesce(r.def->>'answer_layout','cards')<>'flow' and coalesce((f->>'required')::boolean,true) and not private.question_field_response_valid(f,val,true) then raise exception 'Answer all active fields' using errcode='22023'; end if;
 source_ok:=source_ok or private.question_field_response_valid(f,val,true);
 body_text:=body_text||case when body_text='' then '' else E'\n' end|| (case when r.def->>'answer_layout'='flow' and (row_data ? 'flowIndex' or row_data ? 'flowAfter')
   then private.question_flow_row_label(r.def,row_data,1) else row_data->>'id' end)||' · '||(f->>'label')||': '||case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(coalesce(f->'scaleConfig',jsonb_build_object('max',f->'scaleMax')),val) when f->>'kind' in ('single','multiple') then private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) else val end;
 end loop;
 if source_ok then matched:=matched||jsonb_build_array(row_data); end if;
 end loop;
 if p_complete and not waiting and is_career_flow then perform private.assert_question_response_requirements(r.def,matched); end if;
 if p_complete and not waiting and not is_career_flow and jsonb_array_length(ids)<(case when ref_ids is not null then jsonb_array_length(ref_ids) when r.def->>'row_mode'='repeatable' then coalesce((r.def->>'min_rows')::int,1) else 1 end) then raise exception 'Missing rows' using errcode='22023'; end if;
 active:=active||jsonb_build_object(r.question_id::text,matched);
 update public.question_responses set rows=rows_data,active_row_ids=ids,body=body_text,updated_at=now() where id=r.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,status=case when p_complete or submitted_at is not null then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else submitted_at end,updated_at=now() where id=s.id;
 if p_complete then
 insert into public.response_submissions(session_id,answers,submitted_at,revision)
 select s.id,coalesce(jsonb_object_agg(answer.question_id::text,jsonb_build_object('responseId',answer.id,'rows',
 coalesce((select jsonb_agg(case when answer.active_row_ids @> jsonb_build_array(x->'id') then x || coalesce((
    select jsonb_build_object('label',coalesce(nullif(btrim(source.row_labels->>(n::integer-1)),''),'항목 '||n::text))
    from public.questions source
    where source.id=answer.question_id and source.answer_layout<>'flow'
      and jsonb_array_length(source.row_labels)>0
  ),'{}'::jsonb) else jsonb_build_object('id',x->'id','answers','{}'::jsonb)
   ||jsonb_strip_nulls(jsonb_build_object('flowIndex',x->'flowIndex','flowAfter',x->'flowAfter',
     'label',case when jsonb_array_length(answer.active_row_ids)>0 then x->'label'
       when x ? 'flowAfter' then '""'::jsonb else null end)) end order by n)
   from jsonb_array_elements(answer.rows) with ordinality row(x,n)
   where answer.active_row_ids @> jsonb_build_array(x->'id') or exists(select 1 from public.questions source where source.id=answer.question_id and source.answer_layout='flow')),'[]'),
 'activeRowIds',answer.active_row_ids,'body',answer.body)),'{}'),now(),s.revision+1
 from public.question_responses answer where answer.session_id=s.id
 on conflict(session_id) do update set answers=excluded.answers,submitted_at=excluded.submitted_at,revision=excluded.revision;
 end if;
 return private.read_published_question_response_session(p_questionnaire_id);
end $_$;


ALTER FUNCTION private.save_published_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) OWNER TO postgres;

--
-- Name: save_published_response(uuid, jsonb, integer, uuid, boolean, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_published_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sid uuid; s public.response_sessions%rowtype; payload jsonb; item record; q record; f jsonb; val text; readable text;
begin
 if p_save_id is null or p_revision is null or p_revision<0 or p_complete is null or length(p_free_response)>20000 or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid answers' using errcode='22023'; end if;
 sid:=private.open_published_response(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid for update;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete,'freeResponse',coalesce(p_free_response,s.free_response));
 if s.last_save_id=p_save_id and (s.last_payload||jsonb_build_object('freeResponse',s.free_response))=payload then return private.read_published_response(p_questionnaire_id); end if;
 if s.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Answer conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdBbnN3ZXIgY29uZmxpY3QnIHVzaW5nIGVycmNvZGU9JzQwMDAxJzs= */ end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.question_responses where session_id=sid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_answers) loop
 select r.id,r.origin_placement_id,r.legacy_definition definition into q from public.question_responses r where r.session_id=sid and r.origin_placement_id::text=item.key;
 if not found or jsonb_typeof(item.value) is distinct from 'string' then raise exception 'Invalid question' using errcode='22023'; end if;
 f:=q.definition#>'{fields,0}'; val:=item.value#>>'{}';
 if not private.question_field_response_valid(f,val,p_complete) then raise exception 'Invalid answer for question type' using errcode='22023'; end if;
 readable:=case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(f->'scaleConfig',val) else private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) end;
 update public.question_responses set rows=jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(item.key,val))),active_row_ids='[1]',body=readable,updated_at=now() where id=q.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,free_response=coalesce(p_free_response,s.free_response),status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=sid;
 return private.read_published_response(p_questionnaire_id);
end $$;


ALTER FUNCTION private.save_published_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) OWNER TO postgres;

--
-- Name: save_question(jsonb, integer, uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_question(p_document jsonb, p_expected_revision integer, p_save_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_id uuid;
  v_affected jsonb;
  v_detail jsonb;
  v_position bigint;
  v_existing public.questions%rowtype;
  v_saved public.questions%rowtype;
  v_hash text := md5(p_document::text);
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Question block author permission required' using errcode = '42501';
  end if;
  if p_document is null or pg_catalog.jsonb_typeof(p_document) <> 'object'
    or (p_document->>'id') is null or (p_document->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_save_id is null or p_expected_revision is null or p_expected_revision < 0
    or char_length(p_document::text) > 300000 then
    raise exception 'Invalid question block request' using errcode = '22023';
  end if;
  if p_document ? 'details' then
    if jsonb_typeof(p_document->'details') is distinct from 'array' then
      raise exception 'Invalid question details' using errcode = '22023';
    end if;
    if jsonb_array_length(p_document->'details') > 20 then
      raise exception 'Too many question details' using errcode = '22023';
    end if;
    for v_detail in select value from jsonb_array_elements(p_document->'details') loop
      if jsonb_typeof(v_detail) is distinct from 'object'
        or jsonb_typeof(v_detail->'id') is distinct from 'string'
        or (v_detail->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(v_detail->'title') is distinct from 'string'
        or char_length(v_detail->>'title') > 200
        or jsonb_typeof(v_detail->'text') is distinct from 'string'
        or char_length(v_detail->>'text') > 10000
        or jsonb_typeof(v_detail->'visibleToConsultants') is distinct from 'boolean' then
        raise exception 'Invalid question detail' using errcode = '22023';
      end if;
    end loop;
    if (select count(*) <> count(distinct (value->>'id')::uuid)
      from jsonb_array_elements(p_document->'details')) then
      raise exception 'Duplicate question detail IDs' using errcode = '22023';
    end if;
  end if;
  v_id := (p_document->>'id')::uuid;
  select * into v_existing from public.questions where id = v_id for update;
  if found then
    if v_existing.created_by <> auth.uid() and not private.is_admin() and not private.can_edit_review_question(v_id) then
      raise exception 'Only author or admin can edit' using errcode = '42501';
    end if;
    if v_existing.archived_at is not null then
      raise exception 'Question block is archived' using errcode = '55000';
    end if;
    if v_existing.purpose is distinct from coalesce(p_document->>'purpose','response') then
      raise exception 'Question purpose is immutable' using errcode='55000';
    end if;
    if v_existing.last_save_id = p_save_id and v_existing.last_save_hash = v_hash then
      return pg_catalog.to_jsonb(v_existing) || jsonb_build_object('details', (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
      'text', d.body, 'visibleToConsultants', d.visible_to_consultants) order by d.position), '[]'::jsonb)
    from public.question_details d where d.question_id = v_id));
    end if;
    if v_existing.revision <> p_expected_revision or v_existing.last_save_id = p_save_id then
      raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Question block revision conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbiBibG9jayByZXZpc2lvbiBjb25mbGljdCcgdXNpbmcgZXJyY29kZSA9ICc0MDAwMSc7 */
    end if;
    select coalesce(jsonb_agg(old_field->>'id'),'[]') into v_affected
    from jsonb_array_elements(v_existing.fields) old_field
    where private.guide_answer_field_ids(v_id) ? (old_field->>'id')
    and not exists(select 1 from jsonb_array_elements(p_document->'fields') new_field where new_field->>'id'=old_field->>'id' and new_field->>'kind'=old_field->>'kind');
    if not (coalesce(p_document->'confirmedGuideAnswerFields','[]'::jsonb) @> v_affected) then
      raise exception 'Guide answer deletion confirmation required' using errcode='PGA01',detail=v_affected::text;
    end if;
    update public.questions set
      title = pg_catalog.btrim(p_document->>'title'),
      prompt = pg_catalog.btrim(p_document->>'prompt'),
      fields = p_document->'fields',
      response_requirements = case when p_document ? 'responseRequirements' then nullif(p_document->'responseRequirements','null') else v_existing.response_requirements end,
      row_mode = p_document->>'rowMode',
      max_rows = (p_document->>'maxRows')::integer,
      min_rows = coalesce((p_document->>'minRows')::integer, 1),
      row_labels = coalesce(p_document->'rowLabels', '[]'::jsonb),
      purpose = coalesce(p_document->>'purpose','response'),
      button_label = btrim(coalesce(p_document->>'buttonLabel','학습법 추가')),
      answer_layout = coalesce(p_document->>'answerLayout', 'cards'),
      initial_rows = coalesce((p_document->>'initialRows')::integer, 1),
      flow_insert_after = case when coalesce(p_document->>'answerLayout','cards')='flow'
        then coalesce(p_document->'flowInsertAfter',v_existing.flow_insert_after)
        else '[]'::jsonb end,
      source_block_id = (p_document->>'sourceBlockId')::uuid,
      source_field_id = (p_document->>'sourceFieldId')::uuid,
      after_block_id = (p_document->>'afterBlockId')::uuid,
      condition = case when p_document->'condition' = 'null'::jsonb
        then null else p_document->'condition' end,
      revision = revision + 1,
      last_save_id = p_save_id,
      last_save_hash = v_hash
    where id = v_id returning * into v_saved;
  else
    if p_expected_revision <> 0 then
      raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Question block revision conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbiBibG9jayByZXZpc2lvbiBjb25mbGljdCcgdXNpbmcgZXJyY29kZSA9ICc0MDAwMSc7 */
    end if;
    insert into public.questions (
      id, created_by, title, prompt, fields, response_requirements, row_mode, max_rows, min_rows, row_labels, purpose, button_label, answer_layout, initial_rows, flow_insert_after,
      source_block_id, source_field_id, after_block_id, condition,
      revision, last_save_id, last_save_hash
    ) values (
      v_id, auth.uid(), pg_catalog.btrim(p_document->>'title'), pg_catalog.btrim(p_document->>'prompt'),
      p_document->'fields', nullif(p_document->'responseRequirements','null'), p_document->>'rowMode', (p_document->>'maxRows')::integer,
      coalesce((p_document->>'minRows')::integer, 1), coalesce(p_document->'rowLabels', '[]'::jsonb),
      coalesce(p_document->>'purpose','response'), btrim(coalesce(p_document->>'buttonLabel','학습법 추가')),
      coalesce(p_document->>'answerLayout', 'cards'), coalesce((p_document->>'initialRows')::integer, 1),
      coalesce(p_document->'flowInsertAfter', '[]'::jsonb),
      (p_document->>'sourceBlockId')::uuid, (p_document->>'sourceFieldId')::uuid,
      (p_document->>'afterBlockId')::uuid,
      case when p_document->'condition' = 'null'::jsonb
        then null else p_document->'condition' end, 1, p_save_id, v_hash
    ) returning * into v_saved;
  end if;
  if p_document ? 'details' then
    for v_detail, v_position in
      select value, ordinality - 1 from jsonb_array_elements(p_document->'details') with ordinality
    loop
      insert into public.question_details(id, question_id, position, title, body, visible_to_consultants)
      values ((v_detail->>'id')::uuid, v_id, v_position, v_detail->>'title', v_detail->>'text',
        (v_detail->>'visibleToConsultants')::boolean)
      on conflict (id) do update set position = excluded.position, title = excluded.title,
        body = excluded.body, visible_to_consultants = excluded.visible_to_consultants, updated_at = now()
      where public.question_details.question_id = excluded.question_id;
      if not found then
        raise exception 'Detail belongs to another question' using errcode = '22023';
      end if;
    end loop;
    delete from public.question_details where question_id = v_id
      and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_document->'details'));
  end if;
  return pg_catalog.to_jsonb(v_saved) || jsonb_build_object('details', (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
      'text', d.body, 'visibleToConsultants', d.visible_to_consultants) order by d.position), '[]'::jsonb)
    from public.question_details d where d.question_id = v_id));
end $_$;


ALTER FUNCTION private.save_question(p_document jsonb, p_expected_revision integer, p_save_id uuid) OWNER TO postgres;

--
-- Name: save_questionnaire_draft(jsonb, integer, uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  removed_guides jsonb;
  v_id uuid := (p_document->>'questionnaireId')::uuid;
  v public.questionnaires%rowtype;
  s jsonb; q jsonb; source_id uuid; source_prompt text;
  si integer := 0; qi integer;
  section_ids uuid[] := '{}'; question_ids uuid[] := '{}';
  payload_hash text := md5(p_document::text);
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode = '42501';
  end if;
  if v_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_document->'title') is distinct from 'string'
    or jsonb_typeof(p_document->'sections') is distinct from 'array'
    or length(p_document::text) > 700000 or jsonb_array_length(p_document->'sections') > 50 then
    raise exception 'Invalid questionnaire document' using errcode = '22023';
  end if;
  -- Serialize even the first save; a retry after an uncertain network result is safe.
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v from public.questionnaires where id = v_id for update;
  if not found then
    if p_expected_revision <> 0 then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Questionnaire conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbm5haXJlIGNvbmZsaWN0JyB1c2luZyBlcnJjb2RlID0gJzQwMDAxJzs= */ end if;
    insert into public.questionnaires(id, created_by) values(v_id, auth.uid()) returning * into v;
  end if;
  if not exists(select 1 from public.questionnaires where id=v.id and (created_by=auth.uid() or status='in_review' or (status='draft' and private.is_admin()))) then raise exception 'Only the creator can edit' using errcode='42501'; end if;
  if v.status not in ('draft','in_review') or exists(select 1 from public.questionnaires where id=v_id and archived_at is not null) then
    raise exception 'Questionnaire is not editable' using errcode = '55000';
  end if;
  if v.last_save_id = p_save_id and v.last_save_hash = payload_hash then
    return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
  end if;
  if v.revision <> p_expected_revision or v.last_save_id = p_save_id then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Questionnaire conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbm5haXJlIGNvbmZsaWN0JyB1c2luZyBlcnJjb2RlID0gJzQwMDAxJzs= */ end if;

  -- Lock sources before guide sessions, matching response-save lock ordering.
  perform 1 from public.questions src where src.id in (
    select p.source_question_id from public.questionnaire_questions p where p.questionnaire_id=v_id
    union select (incoming_item->>'sourceQuestionId')::uuid from jsonb_array_elements(p_document->'sections') sec cross join lateral jsonb_array_elements(sec->'questions') incoming_item
  ) order by src.id for share;
  select coalesce(jsonb_agg(id),'[]') into removed_guides from jsonb_array_elements(private.questionnaire_guide_question_ids(v_id)) id
  where not exists(select 1 from jsonb_array_elements(p_document->'sections') sec cross join lateral jsonb_array_elements(sec->'questions') incoming_item where incoming_item->'sourceQuestionId'=id);
  if not (coalesce(p_document->'confirmedRemovedGuideQuestions','[]'::jsonb) @> removed_guides) then raise exception 'Guide question removal confirmation required' using errcode='PGA02',detail=removed_guides::text; end if;

  -- A removed source may be re-added with a new placement ID before autosave.
  -- Prune those removed placements before enforcing uniqueness on new rows.
  delete from public.questionnaire_questions existing
  where existing.questionnaire_id=v_id and existing.source_question_id is not null
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
    if (s->>'id')::uuid is null or exists(select 1 from public.questionnaire_sections where id=(s->>'id')::uuid and questionnaire_id<>v_id) then raise exception 'Invalid section ID' using errcode='22023'; end if;
    insert into public.questionnaire_sections(id,questionnaire_id,title,position) values((s->>'id')::uuid,v_id,s->>'title',si)
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
      if (q->>'id')::uuid is null or (q->>'logicalKey')::uuid is null or exists(select 1 from public.questionnaire_questions where id=(q->>'id')::uuid and (questionnaire_id<>v_id or logical_key<>(q->>'logicalKey')::uuid)) then raise exception 'Invalid question ID' using errcode='22023'; end if;
      insert into public.questionnaire_questions(id,questionnaire_id,section_id,logical_key,body,position,kind,options,scale_config,choice_style,choice_allow_text,source_question_id)
        values((q->>'id')::uuid,v_id,(s->>'id')::uuid,(q->>'logicalKey')::uuid,null,qi,null,null,null,null,null,source_id)
        on conflict(id) do update set section_id=excluded.section_id,body=excluded.body,position=excluded.position,kind=excluded.kind,options=excluded.options,scale_config=excluded.scale_config,choice_style=excluded.choice_style,choice_allow_text=excluded.choice_allow_text,source_question_id=excluded.source_question_id;
      qi := qi+1;
    end loop;
    si := si+1;
  end loop;
  if cardinality(section_ids) <> (select count(distinct x) from unnest(section_ids) x)
    or cardinality(question_ids) <> (select count(distinct x) from unnest(question_ids) x) then raise exception 'Duplicate IDs' using errcode='22023'; end if;
  delete from public.questionnaire_questions where questionnaire_id=v_id and not(id=any(question_ids));
  delete from public.questionnaire_sections where questionnaire_id=v_id and not(id=any(section_ids));
  perform private.validate_questionnaire_placements(v_id);
  perform private.remove_unplaced_guide_answers(v_id);
  update public.questionnaires set title=p_document->>'title', start_notice=case when p_document ? 'startNotice' then nullif(p_document->'startNotice','null'::jsonb) else start_notice end, revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $$;


ALTER FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid) OWNER TO postgres;

--
-- Name: save_questionnaire_response(uuid, jsonb, integer, uuid, boolean); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$ select private.save_published_response(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,null) $$;


ALTER FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) OWNER TO postgres;

--
-- Name: save_questionnaire_response(uuid, jsonb, integer, uuid, boolean, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$ select private.save_published_response(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,p_free_response) $$;


ALTER FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) OWNER TO postgres;

--
-- Name: save_review_response_session(uuid, jsonb, integer, uuid, boolean, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_review_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb; current_token text;
begin
 perform private.sync_review_response_layout(p_questionnaire_id);
 perform 1 from public.questions q where exists(select 1 from public.question_responses a where a.session_id=private.owned_review_session(p_questionnaire_id) and a.question_id=q.id) order by q.id for share;
 select * into s from public.response_sessions where id=private.owned_review_session(p_questionnaire_id) for update;
 if not found then raise exception 'Start response first' using errcode='22023'; end if;
 if p_save_id is null or p_revision is null or p_complete is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid response' using errcode='22023'; end if;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if s.last_save_id=p_save_id and s.last_payload=payload then return private.read_review_response_session(p_questionnaire_id); end if;
 current_token:=private.read_review_response_session(s.id)->>'definitionToken';
 if p_definition_token is distinct from current_token then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Question definition changed', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbiBkZWZpbml0aW9uIGNoYW5nZWQnIHVzaW5nIGVycmNvZGU9JzQwMDAxJzs= */ end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Response conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXNwb25zZSBjb25mbGljdCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */ end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p->>'id')::uuid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 if p_complete and not exists (
   select 1 from jsonb_array_elements(s.layout) sec
   cross join lateral jsonb_array_elements(sec->'questions') p
   join public.question_responses answer on answer.session_id=s.id and answer.origin_placement_id=(p->>'id')::uuid
   join public.questions question on question.id=answer.question_id
   where question.purpose='response' and question.archived_at is null
 ) then raise exception 'Answer questions are required for completion' using errcode='22023'; end if;
 -- Session layout keeps only ordering/source IDs; definitions and answers belong to questions.
 for r in select a.*,private.live_response_definition(a.question_id) def from jsonb_array_elements(s.layout) with ordinality sec(section,si)
 cross join lateral jsonb_array_elements(sec.section->'questions') with ordinality p(placement,pi)
 join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p.placement->>'id')::uuid
 order by sec.si,p.pi loop
 rows_data:=p_answers->r.question_id::text;
 if r.def->>'purpose'='study_registration' then
   if jsonb_typeof(rows_data) is distinct from 'array' or rows_data<>'[]'::jsonb then
     raise exception 'Study registration cards accept no answer rows' using errcode='22023';
   end if;
   active:=active||jsonb_build_object(r.question_id::text,'[]'::jsonb);
   update public.question_responses set rows='[]'::jsonb,active_row_ids='[]'::jsonb,body='',updated_at=now() where id=r.id;
   continue;
 end if;
 rows_data:=private.prepare_question_response_rows(r.def,rows_data,r.rows);
 matched:='{}'; all_mode:=coalesce(r.def#>>'{condition,mode}','all')<>'any'; waiting:=false;
 for source_id in select distinct value->>'blockId' from jsonb_array_elements(coalesce(nullif(r.def#>'{condition,clauses}','null'::jsonb),'[]')) loop
 select private.live_response_definition(a.question_id) into source_def from public.question_responses a where a.session_id=s.id and a.question_id::text=source_id;
 ids:='[]';
 for row_data in select value from jsonb_array_elements(coalesce(active->source_id,'[]')) loop
 source_ok:=all_mode;
 for clause in select value from jsonb_array_elements(r.def#>'{condition,clauses}') where value->>'blockId'=source_id loop
 if all_mode then source_ok:=source_ok and private.response_clause_matches(source_def,row_data,clause); else source_ok:=source_ok or private.response_clause_matches(source_def,row_data,clause); end if;
 end loop;
 if source_ok then ids:=ids||jsonb_build_array(row_data); end if;
 end loop;
 matched:=matched||jsonb_build_object(source_id,ids);
 end loop;
 if matched<>'{}' then
 if all_mode then waiting:=exists(select 1 from jsonb_each(matched) m where jsonb_array_length(m.value)=0);
 else waiting:=not exists(select 1 from jsonb_each(matched) m where jsonb_array_length(m.value)>0); end if;
 end if;
 if r.def->>'after_block_id' is not null then waiting:=waiting or jsonb_array_length(coalesce(active->(r.def->>'after_block_id'),'[]'))=0; end if;
 ref_ids:=null;
 if r.def->>'row_mode'='reference' then
 source_id:=r.def->>'source_block_id';
 ref_ids:=coalesce(matched->source_id,active->source_id,'[]');
 if r.def->>'source_field_id' is not null then
 select private.live_response_definition(a.question_id) into source_def from public.question_responses a where a.session_id=s.id and a.question_id::text=source_id;
 select value into f from jsonb_array_elements(source_def->'fields') where value->>'id'=r.def->>'source_field_id';
 select coalesce(jsonb_agg(value),'[]') into ref_ids from jsonb_array_elements(ref_ids) where private.question_field_response_valid(f,coalesce(value->'answers'->>(f->>'id'),''),true);
 end if;
 waiting:=waiting or jsonb_array_length(ref_ids)=0;
 end if;
 ids:='[]'; matched:='[]'; body_text:='';
 for row_data in select value from jsonb_array_elements(rows_data) loop
 if waiting or (ref_ids is not null and not exists(select 1 from jsonb_array_elements(ref_ids) x where x->'id'=row_data->'id')) then continue; end if;
 if p_complete and exists (
   select 1 from jsonb_array_elements(r.def->'fields') field_item
   where field_item->>'kind'<>'text'
     and btrim(coalesce(row_data->'answers'->>(field_item->>'id'),''))<>''
     and not private.question_field_response_valid(field_item,coalesce(row_data->'answers'->>(field_item->>'id'),''),true)
 ) then raise exception 'Complete nonempty typed answers' using errcode='22023'; end if;
 if r.def->>'answer_layout' in ('table','flow') and not exists (
   select 1 from jsonb_array_elements(r.def->'fields') field_item
   where private.question_field_response_valid(field_item,coalesce(row_data->'answers'->>(field_item->>'id'),''),true)
 ) then continue; end if;
 if p_complete and row_data ? 'flowAfter' and coalesce(row_data->>'label','') ~ '^[[:space:]]*$' then
   raise exception 'Name every answered inserted flow period' using errcode='22023';
 end if;
 ids:=ids||jsonb_build_array(row_data->'id'); source_ok:=false;
 for f in select value from jsonb_array_elements(r.def->'fields') loop
 val:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if p_complete and coalesce(r.def->>'answer_layout','cards')<>'flow' and coalesce((f->>'required')::boolean,true) and not private.question_field_response_valid(f,val,true) then raise exception 'Answer all active fields' using errcode='22023'; end if;
 source_ok:=source_ok or private.question_field_response_valid(f,val,true);
 body_text:=body_text||case when body_text='' then '' else E'\n' end|| (case when r.def->>'answer_layout'='flow' and (row_data ? 'flowIndex' or row_data ? 'flowAfter')
   then private.question_flow_row_label(r.def,row_data,1) else row_data->>'id' end)||' · '||(f->>'label')||': '||case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(coalesce(f->'scaleConfig',jsonb_build_object('max',f->'scaleMax')),val) when f->>'kind' in ('single','multiple') then private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) else val end;
 end loop;
 if source_ok then matched:=matched||jsonb_build_array(row_data); end if;
 end loop;
 if p_complete and not waiting and jsonb_array_length(ids)<(case when ref_ids is not null then jsonb_array_length(ref_ids) when r.def->>'row_mode'='repeatable' then coalesce((r.def->>'min_rows')::int,1) else 1 end) then raise exception 'Missing rows' using errcode='22023'; end if;
 active:=active||jsonb_build_object(r.question_id::text,matched);
 update public.question_responses set rows=rows_data,active_row_ids=ids,body=body_text,updated_at=now() where id=r.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=s.id;
 return private.read_review_response_session(p_questionnaire_id);
end $_$;


ALTER FUNCTION private.save_review_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) OWNER TO postgres;

--
-- Name: save_study(uuid, jsonb, jsonb, integer, uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.save_study(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
 v public.study; k text; item jsonb; uid uuid := auth.uid(); n integer;
 required_keys text[] := array['category','subject','problemSource','problem','strategy','practiceGuide','checklist','followup'];
 text_keys text[] := array['title','category','subject','problemSource','problem','strategy','practiceGuide','practicePeriod','checklist','followup','customSubject','resultDiagnosis','problemExperience'];
begin
 if uid is null or not private.can_manage_study() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid request' using errcode='22023'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>2500000 then raise exception 'Invalid values' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
 select * into v from public.study where id=p_id for update;
 -- Old clients may omit the additive fields; retain previously saved values.
 p_values := jsonb_build_object(
   'problemExperience', coalesce(v.values->'problemExperience', '""'::jsonb),
   'periodEnabled', coalesce(v.values->'periodEnabled', 'true'::jsonb)
 ) || p_values;
 if p_values->>'problemSource'='student' then
   p_values := jsonb_set(p_values, '{problemSource}', '"self"'::jsonb);
 end if;
 if jsonb_typeof(p_values->'periodEnabled') is distinct from 'boolean' then
   raise exception 'Invalid periodEnabled' using errcode='22023';
 end if;
 if (p_values->>'periodEnabled')::boolean and (p_values->>'practicePeriod') !~ '[^[:space:]]' then
   raise exception 'Required field practicePeriod' using errcode='22023';
 end if;
 if p_values ? 'title' and (jsonb_typeof(p_values->'title') is distinct from 'string' or length(p_values->>'title')>100) then raise exception 'Invalid title' using errcode='22023'; end if;
 foreach k in array text_keys loop
   if k='title' and not (p_values ? 'title') then continue; end if;
   if jsonb_typeof(p_values->k) is distinct from 'string' or length(p_values->>k)>50000 then raise exception 'Invalid field %',k using errcode='22023'; end if;
 end loop;
 foreach k in array required_keys loop
   if (p_values->>k) !~ '[^[:space:]]' then raise exception 'Required field %',k using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_values) key where not(key=any(text_keys) or key in ('references','periodEnabled')))
   or p_values->>'category' not in ('내신','모의고사(수능)','기타')
   or p_values->>'subject' not in ('국어','영어','수학','사회','과학','기타')
   or p_values->>'problemSource' not in ('self','student','template')
 then raise exception 'Invalid study category or subject' using errcode='22023'; end if;
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
 if v.id is not null then
   if v.owner_id<>uid then raise exception 'Forbidden' using errcode='42501'; end if;
   if v.deleted_at is not null then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Deleted', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdEZWxldGVkJyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */ end if;
   if v.save_id=p_save_id then
     if v.values=p_values and v.reports=p_reports then return to_jsonb(v); end if;
     raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Reused save id', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXVzZWQgc2F2ZSBpZCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */
   end if;
   if v.revision<>p_expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Revision conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdSZXZpc2lvbiBjb25mbGljdCcgdXNpbmcgZXJyY29kZT0nNDAwMDEnOw== */ end if;
 elsif p_expected_revision<>0 then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Missing activity', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdNaXNzaW5nIGFjdGl2aXR5JyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */ end if;
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
   select count(*) into n from storage.objects where bucket_id='study-reports' and name=item->>'path'
     and (metadata->>'size')::bigint=(item->>'size')::bigint;
   if n<>1 then raise exception 'Upload not found' using errcode='22023'; end if;
 end loop;
 if v.id is null then
   insert into public.study(id,owner_id,values,reports,save_id)
   values(p_id,uid,p_values,p_reports,p_save_id) returning * into v;
 else
   update public.study set values=p_values,reports=p_reports,revision=revision+1,save_id=p_save_id,updated_at=clock_timestamp()
   where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end;
$_$;


ALTER FUNCTION private.save_study(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) OWNER TO postgres;

--
-- Name: scale_answer_text(jsonb, text); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.scale_answer_text(p_config jsonb, p_value text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare answer jsonb; score integer; label_text text; extra text := '';
begin
  if p_value = '' then return ''; end if;
  if p_value ~ '^[1-9]$' then score := p_value::integer;
  else
    answer := p_value::jsonb;
    score := (answer->>'score')::integer;
    extra := answer->>'text';
  end if;
  label_text := case
    when score = 1 then p_config->>'low'
    when score = (p_config->>'max')::integer then p_config->>'high'
    when (p_config->>'max')::integer % 2 = 1 and score = ((p_config->>'max')::integer + 1) / 2 then p_config->>'middle'
    else '' end;
  return score::text || '점'
    || case when label_text <> '' then ' · ' || label_text else '' end
    || case when btrim(extra) <> '' then E'\n추가 답변: ' || extra else '' end;
end $_$;


ALTER FUNCTION private.scale_answer_text(p_config jsonb, p_value text) OWNER TO postgres;

--
-- Name: scale_answer_valid(jsonb, text, boolean); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.scale_answer_valid(p_config jsonb, p_value text, p_complete boolean) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare answer jsonb; score integer;
begin
  if p_value is null then return false; end if;
  if btrim(p_value) = '' then return not p_complete; end if;
  if p_value ~ '^[1-9]$' then
    return p_value::integer <= (p_config->>'max')::integer;
  end if;
  if p_config->'allowText' <> 'true'::jsonb then return false; end if;
  begin answer := p_value::jsonb;
  exception when invalid_text_representation then return false;
  end;
  if jsonb_typeof(answer) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(answer)) <> 2
    or jsonb_typeof(answer->'score') is distinct from 'number'
    or (answer->>'score') !~ '^[1-9]$'
    or jsonb_typeof(answer->'text') is distinct from 'string'
    or length(answer->>'text') > 5000 then return false;
  end if;
  score := (answer->>'score')::integer;
  return score <= (p_config->>'max')::integer;
end $_$;


ALTER FUNCTION private.scale_answer_valid(p_config jsonb, p_value text, p_complete boolean) OWNER TO postgres;

--
-- Name: scale_config_valid(jsonb, boolean); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.scale_config_valid(p_config jsonb, p_ready boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
declare max_score integer;
begin
  if jsonb_typeof(p_config) is distinct from 'object'
    or jsonb_typeof(p_config->'max') is distinct from 'number'
    or (p_config->>'max') !~ '^[2-9]$'
    or jsonb_typeof(p_config->'low') is distinct from 'string'
    or jsonb_typeof(p_config->'middle') is distinct from 'string'
    or jsonb_typeof(p_config->'high') is distinct from 'string'
    or jsonb_typeof(p_config->'allowText') is distinct from 'boolean'
    or length(p_config->>'low') > 500
    or length(p_config->>'middle') > 500
    or length(p_config->>'high') > 500 then return false;
  end if;
  max_score := (p_config->>'max')::integer;
  return not p_ready or (
    btrim(p_config->>'low') <> ''
    and btrim(p_config->>'high') <> ''
    and (max_score % 2 = 0 or btrim(p_config->>'middle') <> '')
  );
end $_$;


ALTER FUNCTION private.scale_config_valid(p_config jsonb, p_ready boolean) OWNER TO postgres;

--
-- Name: shared_questionnaire_authors(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.shared_questionnaire_authors() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('questionnaireId', q.id, 'name', p.name))
    from public.questionnaires q
    join public.profiles p on p.id = q.created_by
    where q.status in ('in_review', 'published') and q.archived_at is null
  ), '[]'::jsonb);
end;
$$;


ALTER FUNCTION private.shared_questionnaire_authors() OWNER TO postgres;

--
-- Name: stamp_service_announcement(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.stamp_service_announcement() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;


ALTER FUNCTION private.stamp_service_announcement() OWNER TO postgres;

--
-- Name: start_questionnaire_review(uuid, integer); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.start_questionnaire_review(p_questionnaire_id uuid, p_expected_revision integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v public.questionnaires%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_questionnaire_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
  select * into v from public.questionnaires where id=p_questionnaire_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from public.questionnaires where id=v.id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from public.questionnaires where id=v.id and created_by=auth.uid()) then raise exception 'Only the creator can start_review or publish' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', 'Questionnaire conflict', 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}'; /* business-conflict-v1:cmFpc2UgZXhjZXB0aW9uICdRdWVzdGlvbm5haXJlIGNvbmZsaWN0JyB1c2luZyBlcnJjb2RlPSc0MDAwMSc7 */ end if;
  if v.status='in_review' then return; end if;
  if v.status<>'draft' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where questionnaire_id=v.id)
     then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  perform private.validate_questionnaire_placements(v.id);
  update public.questionnaires set status='in_review',review_started_at=now(),updated_at=now() where id=v.id;
end $$;


ALTER FUNCTION private.start_questionnaire_review(p_questionnaire_id uuid, p_expected_revision integer) OWNER TO postgres;

--
-- Name: sync_review_response_layout(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.sync_review_response_layout(target uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sid uuid; origin uuid; current_title text; current_layout jsonb;
        item record; answer_id uuid;
begin
 sid := private.owned_review_session(target);
 select origin_questionnaire_id into origin from public.response_sessions where id=sid;
 if origin is null then return sid; end if;
 perform pg_advisory_xact_lock(hashtextextended(origin::text,0));
 select v.title into current_title from public.questionnaires v
 join public.questionnaires q on q.id=v.id
 where v.id=origin and v.status='in_review' and q.archived_at is null;
 if not found then return sid; end if;
 -- Match the source-before-session lock order used by answer saving.
 perform 1 from public.questions q where
 exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=origin and p.source_question_id=q.id)
 or exists(select 1 from public.question_responses r where r.session_id=sid and r.question_id=q.id)
 order by q.id for share;
 perform 1 from public.response_sessions where id=sid for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',
   coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id)
     from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
     where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id),'[]'::jsonb)
 into current_layout from public.questionnaire_sections s where s.questionnaire_id=origin;
 for item in select p.id placement_id,q.id question_id,q.revision,private.live_response_definition(q.id) definition
 from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
 where p.questionnaire_id=origin order by p.id loop
   select r.id into answer_id from public.question_responses r
   where r.session_id=sid and r.question_id=item.question_id;
   if answer_id is null then
     insert into public.question_responses(session_id,question_id,origin_placement_id)
     values(sid,item.question_id,item.placement_id);
   else
     update public.question_responses set origin_placement_id=item.placement_id
     where id=answer_id and origin_placement_id is distinct from item.placement_id;
   end if;
 end loop;
 update public.question_responses r set referenced_response_id=src.id
 from public.questions q,public.question_responses src
 where r.session_id=sid and r.question_id=q.id
 and src.session_id=sid and q.source_block_id=src.question_id
 and r.referenced_response_id is distinct from src.id;
 update public.response_sessions set layout=current_layout,origin_title=current_title,
 last_payload=null,last_save_id=null
 where id=sid and (layout is distinct from current_layout or origin_title is distinct from current_title);
 return sid;
end $$;


ALTER FUNCTION private.sync_review_response_layout(target uuid) OWNER TO postgres;

--
-- Name: unread_question_review_ids(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.unread_question_review_ids(qid uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(r.id order by r.created_at),'[]'::jsonb) from public.question_review_requests r
 where r.question_id=qid and r.resolved_at is null and r.requested_by<>auth.uid()
 and (private.is_admin() or private.is_consultant_lead())
 and exists(select 1 from public.questions q where q.id=qid and q.created_by=auth.uid())
 and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid());
$$;


ALTER FUNCTION private.unread_question_review_ids(qid uuid) OWNER TO postgres;

--
-- Name: validate_question(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.validate_question() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  v_field jsonb;
  v_option jsonb;
  v_clause jsonb;
  v_source public.questions%rowtype;
  v_source_field jsonb;
  v_ref uuid;
  v_refs uuid[] := '{}';
  v_ids uuid[] := '{}';
  v_option_ids uuid[];
  v_option_labels text[];
  v_operator text;
begin
  -- All dependency edits serialize, so concurrent saves cannot create a cycle.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('questions_dependencies', 0));
  if tg_op = 'UPDATE' then
    if new.purpose is distinct from old.purpose then
      raise exception 'Question purpose is immutable' using errcode='55000';
    end if;
    if old.id <> new.id or old.created_by <> new.created_by or old.created_at <> new.created_at then
      raise exception 'Question block identity cannot change' using errcode = '22023';
    end if;
    if old.archived_at is not null then
      raise exception 'Archived question block cannot change' using errcode = '55000';
    end if;
  end if;
  if char_length(pg_catalog.btrim(new.prompt)) = 0
    or pg_catalog.jsonb_typeof(new.fields) is distinct from 'array'
    or (new.purpose='response' and pg_catalog.jsonb_array_length(new.fields) not between 1 and 20)
    or (new.purpose='study_registration' and pg_catalog.jsonb_array_length(new.fields)<>0) then
    raise exception 'Invalid question block content' using errcode = '22023';
  end if;
  for v_field in select value from pg_catalog.jsonb_array_elements(new.fields) loop
    if pg_catalog.jsonb_typeof(v_field) is distinct from 'object'
      or (v_field->>'id') is null or (v_field->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or char_length(pg_catalog.btrim(coalesce(v_field->>'label', ''))) not between 1 and 100
      or v_field->>'kind' is null or v_field->>'kind' not in ('text', 'scale', 'single', 'multiple') then
      raise exception 'Invalid answer field' using errcode = '22023';
    end if;
    if (v_field->>'id')::uuid = any(v_ids) then
      raise exception 'Duplicate answer field' using errcode = '22023';
    end if;
    v_ids := pg_catalog.array_append(v_ids, (v_field->>'id')::uuid);
    if v_field->>'kind' in ('single', 'multiple') then
      if pg_catalog.jsonb_typeof(v_field->'options') is distinct from 'array'
        or pg_catalog.jsonb_array_length(v_field->'options') not between 2 and 20 then
        raise exception 'Choice field needs 2 to 20 options' using errcode = '22023';
      end if;
      v_option_ids := '{}';
      v_option_labels := '{}';
      for v_option in select value from pg_catalog.jsonb_array_elements(v_field->'options') loop
        if pg_catalog.jsonb_typeof(v_option) is distinct from 'object'
          or (v_option->>'id') is null or (v_option->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or char_length(pg_catalog.btrim(coalesce(v_option->>'label', ''))) not between 1 and 500 then
          raise exception 'Invalid choice option' using errcode = '22023';
        end if;
        if (v_option->>'id')::uuid = any(v_option_ids) then
          raise exception 'Duplicate choice option' using errcode = '22023';
        end if;
        if pg_catalog.lower(pg_catalog.btrim(v_option->>'label')) = any(v_option_labels) then
          raise exception 'Duplicate choice label' using errcode = '22023';
        end if;
        v_option_ids := pg_catalog.array_append(v_option_ids, (v_option->>'id')::uuid);
        v_option_labels := pg_catalog.array_append(v_option_labels,
          pg_catalog.lower(pg_catalog.btrim(v_option->>'label')));
      end loop;
    elsif v_field->>'kind' = 'scale' and (
      (v_field->>'scaleMax') is null or (v_field->>'scaleMax') !~ '^[0-9]+$'
      or (v_field->>'scaleMax')::integer not between 2 and 9
    ) then
      raise exception 'Invalid scale range' using errcode = '22023';
    end if;
  end loop;

  if new.after_block_id is not null then v_refs := pg_catalog.array_append(v_refs, new.after_block_id); end if;
  if new.source_block_id is not null then
    v_refs := pg_catalog.array_append(v_refs, new.source_block_id);
    if new.source_field_id is null then
      if not exists (
        select 1 from jsonb_array_elements(coalesce(new.condition->'clauses', '[]'::jsonb)) clause
        where clause->>'blockId' = new.source_block_id::text and (
          (clause->>'op' = 'answered')
          or exists (
            select 1 from public.questions source
            cross join lateral jsonb_array_elements(source.fields) field
            where source.id = new.source_block_id
              and field->>'id' = clause->>'fieldId'
              and ((field->>'kind' = 'single' and clause->>'op' = 'equals')
                or (field->>'kind' = 'multiple' and clause->>'op' = 'includes'))
              and not exists (select 1 from jsonb_array_elements(field->'options') option
                where option->>'isOther' = 'true')
          )
        )
      ) then
        raise exception 'Referenced question needs an answered or fixed-choice condition' using errcode = '22023';
      end if;
    else
    select * into v_source from public.questions where id = new.source_block_id;
    select value into v_source_field from pg_catalog.jsonb_array_elements(coalesce(v_source.fields, '[]'::jsonb))
    where value->>'id' = new.source_field_id::text;
    if v_source_field is null or v_source_field->>'kind' <> 'text' then
      raise exception 'Referenced rows need a text source field' using errcode = '22023';
    end if;
    end if;
  end if;
  if new.condition is not null then
    if pg_catalog.jsonb_typeof(new.condition) is distinct from 'object'
      or new.condition->>'mode' is null or new.condition->>'mode' not in ('all', 'any')
      or pg_catalog.jsonb_typeof(new.condition->'clauses') is distinct from 'array'
      or pg_catalog.jsonb_array_length(new.condition->'clauses') not between 1 and 10 then
      raise exception 'Invalid question condition' using errcode = '22023';
    end if;
    for v_clause in select value from pg_catalog.jsonb_array_elements(new.condition->'clauses') loop
      if pg_catalog.jsonb_typeof(v_clause) is distinct from 'object'
        or (v_clause->>'blockId') is null or (v_clause->>'blockId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or ((v_clause->>'fieldId') is null and coalesce(v_clause->>'op', '') <> 'answered')
        or (v_clause->>'fieldId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid condition reference' using errcode = '22023';
      end if;
      v_ref := (v_clause->>'blockId')::uuid;
      v_refs := pg_catalog.array_append(v_refs, v_ref);
      if v_clause->>'fieldId' is null and v_clause->>'op' = 'answered' then continue; end if;
      select * into v_source from public.questions where id = v_ref;
      select value into v_source_field from pg_catalog.jsonb_array_elements(coalesce(v_source.fields, '[]'::jsonb))
      where value->>'id' = v_clause->>'fieldId';
      v_operator := v_clause->>'op';
      if v_source_field is null or v_operator is null or v_operator not in ('answered', 'equals', 'includes', 'gte', 'lte')
        or (v_operator = 'includes' and v_source_field->>'kind' <> 'multiple')
        or (v_operator in ('gte', 'lte') and v_source_field->>'kind' <> 'scale')
        or (v_operator = 'equals' and v_source_field->>'kind' = 'multiple')
        or (v_operator in ('gte', 'lte') and (pg_catalog.jsonb_typeof(v_clause->'value') <> 'number'
          or (v_clause->>'value')::numeric not between 1 and (v_source_field->>'scaleMax')::numeric))
        or (v_operator in ('equals', 'includes') and pg_catalog.jsonb_typeof(v_clause->'value') is distinct from
          case when v_source_field->>'kind' = 'scale' then 'number' else 'string' end) then
        raise exception 'Condition does not match its answer field' using errcode = '22023';
      end if;
      if v_operator in ('equals', 'includes') and v_source_field->>'kind' in ('single', 'multiple')
        and not exists (select 1 from pg_catalog.jsonb_array_elements(v_source_field->'options') o
          where o->>'id' = v_clause->>'value') then
        raise exception 'Condition choice does not exist' using errcode = '22023';
      end if;
    end loop;
  end if;

  foreach v_ref in array v_refs loop
    if v_ref = new.id or not exists (
      select 1 from public.questions where id = v_ref and archived_at is null
    ) then
      raise exception 'Question block dependency is unavailable' using errcode = '22023';
    end if;
    if exists(select 1 from public.questions where id=v_ref and purpose='study_registration') then
      raise exception 'Study registration cards cannot be answer dependencies' using errcode='22023';
    end if;
    if exists (
      with recursive walk(id, path) as (
        select v_ref, array[new.id, v_ref]::uuid[]
        union all
        select edge.id, walk.path || edge.id
        from walk
        join public.questions block on block.id = walk.id
        cross join lateral (
          select dep as id from pg_catalog.unnest(array[block.after_block_id, block.source_block_id]) dep
          union all
          select (clause->>'blockId')::uuid
          from pg_catalog.jsonb_array_elements(coalesce(block.condition->'clauses', '[]'::jsonb)) clause
        ) edge
        where walk.id <> new.id and edge.id is not null
          and (edge.id = new.id or not edge.id = any(walk.path))
      )
      select 1 from walk where id = new.id
    ) then
      raise exception 'Question block dependency cycle' using errcode = '22023';
    end if;
  end loop;

  if tg_op = 'UPDATE' and new.archived_at is not null and old.archived_at is null
    and exists (
      select 1 from public.questions block
      where block.id <> new.id and block.archived_at is null and (
        block.after_block_id = new.id or block.source_block_id = new.id
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(coalesce(block.condition->'clauses', '[]'::jsonb)) clause
          where clause->>'blockId' = new.id::text
        )
      )
    ) then
    raise exception 'Question block is used by another block' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and (new.fields is distinct from old.fields or new.row_mode is distinct from old.row_mode)
    and exists (
      select 1 from public.questions block
      where block.id <> new.id and block.archived_at is null and (
        block.source_block_id = new.id
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(coalesce(block.condition->'clauses', '[]'::jsonb)) clause
          where clause->>'blockId' = new.id::text
        )
      )
    ) then
    raise exception 'Referenced answer fields or rows cannot change' using errcode = '55000';
  end if;
  if not private.question_flow_settings_valid(new.flow_insert_after,new.answer_layout,new.row_mode,new.max_rows) then
    raise exception 'Invalid flow insertion settings' using errcode='22023';
  end if;
  if tg_op='UPDATE' and old.answer_layout='flow'
    and (new.answer_layout is distinct from old.answer_layout
      or (case when new.row_mode='repeatable' then new.max_rows else 1 end)
        is distinct from (case when old.row_mode='repeatable' then old.max_rows else 1 end))
    and exists(select 1 from public.question_responses answer
      cross join lateral jsonb_array_elements(answer.rows) row_data
      where answer.question_id=old.id and (row_data ? 'flowIndex' or row_data ? 'flowAfter')) then
    raise exception 'Saved flow periods require their original layout and fixed period count' using errcode='55000';
  end if;
  new.updated_at := now();
  return new;
end $_$;


ALTER FUNCTION private.validate_question() OWNER TO postgres;

--
-- Name: validate_questionnaire_placements(uuid); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE FUNCTION private.validate_questionnaire_placements(p_questionnaire_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if exists(select 1 from public.questionnaire_questions p left join public.questions q on q.id=p.source_question_id
    where p.questionnaire_id=p_questionnaire_id and (q.id is null or q.archived_at is not null or btrim(private.question_search_plain(q.prompt))='')) then
    raise exception 'Question placement source unavailable' using errcode='22023';
  end if;

  if exists (
    select 1 from public.questionnaire_questions p
    join public.questionnaire_sections s on s.id=p.section_id
    join public.questions q on q.id=p.source_question_id
    where p.questionnaire_id=p_questionnaire_id and (
      q.archived_at is not null or exists (
        select 1 from (
          select q.source_block_id id union select q.after_block_id
          union select (c->>'blockId')::uuid from jsonb_array_elements(coalesce(q.condition->'clauses','[]'::jsonb)) c
        ) deps
        where deps.id is not null and not exists (
          select 1 from public.questionnaire_questions preceding
          join public.questionnaire_sections ps on ps.id=preceding.section_id
          where preceding.questionnaire_id=p_questionnaire_id and preceding.source_question_id=deps.id
            and (ps.position,preceding.position)<(s.position,p.position)
        )
      )
    )
  ) then raise exception 'Question placement dependency order invalid' using errcode='22023'; end if;
end $$;


ALTER FUNCTION private.validate_questionnaire_placements(p_questionnaire_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: deleted_questionnaires; Type: TABLE; Schema: private; Owner: postgres
--

CREATE TABLE private.deleted_questionnaires (
    questionnaire_id uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE private.deleted_questionnaires OWNER TO postgres;

--
-- Name: learning_material_links; Type: TABLE; Schema: private; Owner: postgres
--

CREATE TABLE private.learning_material_links (
    source_table text NOT NULL,
    source_id uuid NOT NULL,
    material_kind text NOT NULL,
    material_id uuid NOT NULL,
    CONSTRAINT learning_material_links_material_kind_check CHECK ((material_kind = ANY (ARRAY['study'::text, 'exploration'::text]))),
    CONSTRAINT learning_material_links_source_table_check CHECK ((source_table = ANY (ARRAY['questions'::text, 'question_details'::text, 'questionnaires'::text, 'questionnaire_questions'::text, 'question_responses'::text, 'response_sessions'::text, 'response_submissions'::text])))
);


ALTER TABLE private.learning_material_links OWNER TO postgres;

--
-- Name: legacy_questionnaire_imports; Type: TABLE; Schema: private; Owner: postgres
--

CREATE TABLE private.legacy_questionnaire_imports (
    source_questionnaire_id uuid NOT NULL,
    source_revision integer NOT NULL,
    source_owner_id uuid NOT NULL,
    legacy_target_parent_id uuid NOT NULL,
    target_questionnaire_id uuid NOT NULL,
    section_count integer NOT NULL,
    question_count integer NOT NULL,
    detail_count integer NOT NULL,
    mappings jsonb NOT NULL,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legacy_questionnaire_imports_mappings_check CHECK ((jsonb_typeof(mappings) = 'object'::text))
);


ALTER TABLE private.legacy_questionnaire_imports OWNER TO postgres;

--
-- Name: TABLE legacy_questionnaire_imports; Type: COMMENT; Schema: private; Owner: postgres
--

COMMENT ON TABLE private.legacy_questionnaire_imports IS 'Operator-only append-once legacy import provenance; no content or answer bodies. Never delete to retry an import.';


--
-- Name: questionnaire_status_requests; Type: TABLE; Schema: private; Owner: postgres
--

CREATE TABLE private.questionnaire_status_requests (
    id uuid NOT NULL,
    actor_id uuid NOT NULL,
    payload_hash text NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE private.questionnaire_status_requests OWNER TO postgres;

--
-- Name: study_solution_backup_20261012; Type: TABLE; Schema: private; Owner: postgres
--

CREATE TABLE private.study_solution_backup_20261012 (
    id uuid NOT NULL,
    row_data jsonb NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE private.study_solution_backup_20261012 OWNER TO postgres;

--
-- Name: deleted_questionnaires deleted_questionnaires_pkey; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.deleted_questionnaires
    ADD CONSTRAINT deleted_questionnaires_pkey PRIMARY KEY (questionnaire_id);


--
-- Name: learning_material_links learning_material_links_pkey; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.learning_material_links
    ADD CONSTRAINT learning_material_links_pkey PRIMARY KEY (source_table, source_id, material_kind, material_id);


--
-- Name: legacy_questionnaire_imports legacy_questionnaire_imports_legacy_target_parent_id_key; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.legacy_questionnaire_imports
    ADD CONSTRAINT legacy_questionnaire_imports_legacy_target_parent_id_key UNIQUE (legacy_target_parent_id);


--
-- Name: legacy_questionnaire_imports legacy_questionnaire_imports_pkey; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.legacy_questionnaire_imports
    ADD CONSTRAINT legacy_questionnaire_imports_pkey PRIMARY KEY (source_questionnaire_id);


--
-- Name: legacy_questionnaire_imports legacy_questionnaire_imports_target_questionnaire_id_key; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.legacy_questionnaire_imports
    ADD CONSTRAINT legacy_questionnaire_imports_target_questionnaire_id_key UNIQUE (target_questionnaire_id);


--
-- Name: questionnaire_status_requests questionnaire_status_requests_pkey; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.questionnaire_status_requests
    ADD CONSTRAINT questionnaire_status_requests_pkey PRIMARY KEY (id);


--
-- Name: study_solution_backup_20261012 study_solution_backup_20261012_pkey; Type: CONSTRAINT; Schema: private; Owner: postgres
--

ALTER TABLE ONLY private.study_solution_backup_20261012
    ADD CONSTRAINT study_solution_backup_20261012_pkey PRIMARY KEY (id);


--
-- Name: learning_material_links_target_idx; Type: INDEX; Schema: private; Owner: postgres
--

CREATE INDEX learning_material_links_target_idx ON private.learning_material_links USING btree (material_kind, material_id);


--
-- Name: deleted_questionnaires; Type: ROW SECURITY; Schema: private; Owner: postgres
--

ALTER TABLE private.deleted_questionnaires ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_material_links; Type: ROW SECURITY; Schema: private; Owner: postgres
--

ALTER TABLE private.learning_material_links ENABLE ROW LEVEL SECURITY;

--
-- Name: legacy_questionnaire_imports; Type: ROW SECURITY; Schema: private; Owner: postgres
--

ALTER TABLE private.legacy_questionnaire_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: questionnaire_status_requests; Type: ROW SECURITY; Schema: private; Owner: postgres
--

ALTER TABLE private.questionnaire_status_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: study_solution_backup_20261012; Type: ROW SECURITY; Schema: private; Owner: postgres
--

ALTER TABLE private.study_solution_backup_20261012 ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA private TO authenticated;


--
-- Name: FUNCTION archive_question(p_id uuid, p_expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.archive_question(p_id uuid, p_expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.archive_question(p_id uuid, p_expected_revision integer) TO authenticated;


--
-- Name: FUNCTION archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) TO authenticated;


--
-- Name: FUNCTION assert_published_question_access(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.assert_published_question_access(qid uuid) FROM PUBLIC;


--
-- Name: FUNCTION assert_published_response_access(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.assert_published_response_access(p_questionnaire_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION assert_question_response_requirements(def jsonb, rows_data jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.assert_question_response_requirements(def jsonb, rows_data jsonb) FROM PUBLIC;


--
-- Name: FUNCTION assert_review_response_access(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.assert_review_response_access(p_questionnaire_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION assert_submission_staff_access(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.assert_submission_staff_access(qid uuid) FROM PUBLIC;


--
-- Name: FUNCTION can_edit_review_question(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.can_edit_review_question(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_edit_review_question(qid uuid) TO authenticated;


--
-- Name: FUNCTION can_manage_exploration(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.can_manage_exploration() FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_manage_exploration() TO authenticated;


--
-- Name: FUNCTION can_manage_study(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.can_manage_study() FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_manage_study() TO authenticated;


--
-- Name: FUNCTION can_read_published_questionnaire(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.can_read_published_questionnaire(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_read_published_questionnaire(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION can_read_question_reviews(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.can_read_question_reviews(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_read_question_reviews(qid uuid) TO authenticated;


--
-- Name: FUNCTION can_request_question_review(qid uuid, origin_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.can_request_question_review(qid uuid, origin_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_request_question_review(qid uuid, origin_id uuid) TO authenticated;


--
-- Name: FUNCTION can_write_guide_answers(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.can_write_guide_answers() FROM PUBLIC;
GRANT ALL ON FUNCTION private.can_write_guide_answers() TO authenticated;


--
-- Name: FUNCTION change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION choice_answer_selection(p_kind text, p_allow_text boolean, p_value text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.choice_answer_selection(p_kind text, p_allow_text boolean, p_value text) FROM PUBLIC;


--
-- Name: FUNCTION choice_answer_text(p_kind text, p_options jsonb, p_allow_text boolean, p_value text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.choice_answer_text(p_kind text, p_options jsonb, p_allow_text boolean, p_value text) FROM PUBLIC;


--
-- Name: FUNCTION choice_answer_valid(p_kind text, p_options jsonb, p_allow_text boolean, p_value text, p_complete boolean); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.choice_answer_valid(p_kind text, p_options jsonb, p_allow_text boolean, p_value text, p_complete boolean) FROM PUBLIC;


--
-- Name: FUNCTION delete_exploration(p_id uuid, p_expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.delete_exploration(p_id uuid, p_expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.delete_exploration(p_id uuid, p_expected_revision integer) TO authenticated;


--
-- Name: FUNCTION delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO authenticated;


--
-- Name: FUNCTION delete_study(p_id uuid, p_expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.delete_study(p_id uuid, p_expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.delete_study(p_id uuid, p_expected_revision integer) TO authenticated;


--
-- Name: FUNCTION guard_learning_material_reference_write(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_learning_material_reference_write() FROM PUBLIC;


--
-- Name: FUNCTION guard_placed_question_archive(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_placed_question_archive() FROM PUBLIC;


--
-- Name: FUNCTION guard_published_question(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_published_question() FROM PUBLIC;


--
-- Name: FUNCTION guard_published_question_detail(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_published_question_detail() FROM PUBLIC;


--
-- Name: FUNCTION guard_question_private_sources(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_question_private_sources() FROM PUBLIC;


--
-- Name: FUNCTION guard_question_response_identity(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_question_response_identity() FROM PUBLIC;


--
-- Name: FUNCTION guard_questionnaire_content(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_questionnaire_content() FROM PUBLIC;


--
-- Name: FUNCTION guard_questionnaire_placement_publication(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_questionnaire_placement_publication() FROM PUBLIC;


--
-- Name: FUNCTION guard_referenced_learning_material_delete(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_referenced_learning_material_delete() FROM PUBLIC;


--
-- Name: FUNCTION guard_start_notice(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guard_start_notice() FROM PUBLIC;


--
-- Name: FUNCTION guide_answer_field_ids(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guide_answer_field_ids(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.guide_answer_field_ids(qid uuid) TO authenticated;


--
-- Name: FUNCTION guide_consultant_id(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guide_consultant_id() FROM PUBLIC;


--
-- Name: FUNCTION guide_exploration_ids(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guide_exploration_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION private.guide_exploration_ids() TO authenticated;


--
-- Name: FUNCTION guide_rows_body(answer_rows jsonb, fields jsonb, active_ids jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guide_rows_body(answer_rows jsonb, fields jsonb, active_ids jsonb) FROM PUBLIC;


--
-- Name: FUNCTION guide_study_ids(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.guide_study_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION private.guide_study_ids() TO authenticated;


--
-- Name: FUNCTION has_saved_publication_responses(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.has_saved_publication_responses(p_questionnaire_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION import_legacy_text_questionnaire(p_source_questionnaire_id uuid, p_expected_question_count integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.import_legacy_text_questionnaire(p_source_questionnaire_id uuid, p_expected_question_count integer) FROM PUBLIC;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_admin() TO authenticated;


--
-- Name: FUNCTION is_consultant_lead(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.is_consultant_lead() FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_consultant_lead() TO authenticated;


--
-- Name: FUNCTION learning_material_references(payload jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.learning_material_references(payload jsonb) FROM PUBLIC;


--
-- Name: FUNCTION learning_material_source(table_name text, row_data jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.learning_material_source(table_name text, row_data jsonb) FROM PUBLIC;


--
-- Name: FUNCTION list_submitted_questionnaire_responses(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.list_submitted_questionnaire_responses(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.list_submitted_questionnaire_responses(qid uuid) TO authenticated;


--
-- Name: FUNCTION live_response_definition(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.live_response_definition(qid uuid) FROM PUBLIC;


--
-- Name: FUNCTION mark_question_reviews_read(qid uuid, ids uuid[]); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.mark_question_reviews_read(qid uuid, ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION private.mark_question_reviews_read(qid uuid, ids uuid[]) TO authenticated;


--
-- Name: FUNCTION notify_questionnaire_change(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.notify_questionnaire_change() FROM PUBLIC;


--
-- Name: FUNCTION notify_questionnaire_response_change(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.notify_questionnaire_response_change() FROM PUBLIC;


--
-- Name: FUNCTION notify_response_session_change(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.notify_response_session_change() FROM PUBLIC;


--
-- Name: FUNCTION open_published_question_response_session(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.open_published_question_response_session(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.open_published_question_response_session(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION open_published_response(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.open_published_response(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.open_published_response(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION open_questionnaire_response(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION open_review_response_session(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.open_review_response_session(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.open_review_response_session(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION owned_published_question_session(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.owned_published_question_session(qid uuid) FROM PUBLIC;


--
-- Name: FUNCTION owned_review_session(target uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.owned_review_session(target uuid) FROM PUBLIC;


--
-- Name: FUNCTION prepare_question_flow_rows(p_definition jsonb, p_rows jsonb, p_existing_rows jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.prepare_question_flow_rows(p_definition jsonb, p_rows jsonb, p_existing_rows jsonb) FROM PUBLIC;


--
-- Name: FUNCTION prepare_question_response_rows(def jsonb, rows_data jsonb, previous_rows jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.prepare_question_response_rows(def jsonb, rows_data jsonb, previous_rows jsonb) FROM PUBLIC;


--
-- Name: FUNCTION prune_guide_fields(answer_rows jsonb, old_fields jsonb, new_fields jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.prune_guide_fields(answer_rows jsonb, old_fields jsonb, new_fields jsonb) FROM PUBLIC;


--
-- Name: FUNCTION publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO authenticated;


--
-- Name: FUNCTION published_response_definition(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.published_response_definition(qid uuid) FROM PUBLIC;


--
-- Name: FUNCTION published_submission_counts(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.published_submission_counts() FROM PUBLIC;
GRANT ALL ON FUNCTION private.published_submission_counts() TO authenticated;


--
-- Name: FUNCTION question_answer_text(p_kind text, p_options jsonb, p_value text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_answer_text(p_kind text, p_options jsonb, p_value text) FROM PUBLIC;


--
-- Name: FUNCTION question_answer_valid(p_kind text, p_options jsonb, p_value text, p_complete boolean); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_answer_valid(p_kind text, p_options jsonb, p_value text, p_complete boolean) FROM PUBLIC;


--
-- Name: FUNCTION question_config_valid(p_kind text, p_options jsonb, p_ready boolean); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_config_valid(p_kind text, p_options jsonb, p_ready boolean) FROM PUBLIC;


--
-- Name: FUNCTION question_editor_settings_valid(p_fields jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_editor_settings_valid(p_fields jsonb) FROM PUBLIC;


--
-- Name: FUNCTION question_field_response_valid(f jsonb, v text, complete boolean); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_field_response_valid(f jsonb, v text, complete boolean) FROM PUBLIC;


--
-- Name: FUNCTION question_flow_row_label(p_definition jsonb, p_row jsonb, p_position integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_flow_row_label(p_definition jsonb, p_row jsonb, p_position integer) FROM PUBLIC;


--
-- Name: FUNCTION question_flow_settings_valid(p_slots jsonb, p_layout text, p_mode text, p_max_rows integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_flow_settings_valid(p_slots jsonb, p_layout text, p_mode text, p_max_rows integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.question_flow_settings_valid(p_slots jsonb, p_layout text, p_mode text, p_max_rows integer) TO authenticated;
GRANT ALL ON FUNCTION private.question_flow_settings_valid(p_slots jsonb, p_layout text, p_mode text, p_max_rows integer) TO service_role;


--
-- Name: FUNCTION question_response_requirements_valid(rule jsonb, fields jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_response_requirements_valid(rule jsonb, fields jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.question_response_requirements_valid(rule jsonb, fields jsonb) TO authenticated;
GRANT ALL ON FUNCTION private.question_response_requirements_valid(rule jsonb, fields jsonb) TO service_role;


--
-- Name: FUNCTION question_review_counts(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_review_counts() FROM PUBLIC;
GRANT ALL ON FUNCTION private.question_review_counts() TO authenticated;


--
-- Name: FUNCTION question_row_labels_valid(labels jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_row_labels_valid(labels jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.question_row_labels_valid(labels jsonb) TO authenticated;


--
-- Name: FUNCTION question_search_node(p_node jsonb, p_depth integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_search_node(p_node jsonb, p_depth integer) FROM PUBLIC;


--
-- Name: FUNCTION question_search_plain(p_text text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.question_search_plain(p_text text) FROM PUBLIC;


--
-- Name: FUNCTION questionnaire_guide_question_ids(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.questionnaire_guide_question_ids(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.questionnaire_guide_question_ids(qid uuid) TO authenticated;


--
-- Name: FUNCTION questionnaire_list_items(p_ids uuid[], p_view_role text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.questionnaire_list_items(p_ids uuid[], p_view_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.questionnaire_list_items(p_ids uuid[], p_view_role text) TO authenticated;


--
-- Name: FUNCTION questionnaire_read_role(p_view_role text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.questionnaire_read_role(p_view_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.questionnaire_read_role(p_view_role text) TO authenticated;


--
-- Name: FUNCTION questionnaire_read_scope(p_view_role text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.questionnaire_read_scope(p_view_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.questionnaire_read_scope(p_view_role text) TO authenticated;


--
-- Name: FUNCTION read_guide_answers(p_question_ids uuid[]); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_guide_answers(p_question_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_guide_answers(p_question_ids uuid[]) TO authenticated;


--
-- Name: FUNCTION read_published_question_response_session(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_published_question_response_session(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_published_question_response_session(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION read_published_question_response_version(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_published_question_response_version(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_published_question_response_version(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION read_published_response(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_published_response(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_published_response(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION read_question_reviews(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_question_reviews(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_question_reviews(qid uuid) TO authenticated;


--
-- Name: FUNCTION read_review_response_session(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_review_response_session(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_review_response_session(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION read_review_response_version(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_review_response_version(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_review_response_version(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION read_shared_question_sources(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_shared_question_sources(p_questionnaire_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_shared_question_sources(p_questionnaire_id uuid) TO authenticated;


--
-- Name: FUNCTION read_submitted_response(qid uuid, sid uuid, expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_submitted_response(qid uuid, sid uuid, expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_submitted_response(qid uuid, sid uuid, expected_revision integer) TO authenticated;
GRANT ALL ON FUNCTION private.read_submitted_response(qid uuid, sid uuid, expected_revision integer) TO service_role;


--
-- Name: FUNCTION read_submitted_response_manifest(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_submitted_response_manifest(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_submitted_response_manifest(qid uuid) TO authenticated;
GRANT ALL ON FUNCTION private.read_submitted_response_manifest(qid uuid) TO service_role;


--
-- Name: FUNCTION read_submitted_response_page(qid uuid, page integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.read_submitted_response_page(qid uuid, page integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.read_submitted_response_page(qid uuid, page integer) TO authenticated;
GRANT ALL ON FUNCTION private.read_submitted_response_page(qid uuid, page integer) TO service_role;


--
-- Name: FUNCTION reconcile_guide_fields(qid uuid, old_fields jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.reconcile_guide_fields(qid uuid, old_fields jsonb) FROM PUBLIC;


--
-- Name: FUNCTION reconcile_guide_question_update(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.reconcile_guide_question_update() FROM PUBLIC;


--
-- Name: FUNCTION reject_deleted_questionnaire(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.reject_deleted_questionnaire() FROM PUBLIC;


--
-- Name: FUNCTION reject_new_registration_question(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.reject_new_registration_question() FROM PUBLIC;


--
-- Name: FUNCTION remove_archived_review_answers(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.remove_archived_review_answers() FROM PUBLIC;


--
-- Name: FUNCTION remove_unplaced_guide_answers(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.remove_unplaced_guide_answers(qid uuid) FROM PUBLIC;


--
-- Name: FUNCTION request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) TO authenticated;


--
-- Name: FUNCTION resolve_question_review(p_id uuid, p_question_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.resolve_question_review(p_id uuid, p_question_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.resolve_question_review(p_id uuid, p_question_id uuid) TO authenticated;


--
-- Name: FUNCTION response_clause_matches(def jsonb, row_data jsonb, clause jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.response_clause_matches(def jsonb, row_data jsonb, clause jsonb) FROM PUBLIC;


--
-- Name: FUNCTION response_poll_version(snapshot jsonb); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.response_poll_version(snapshot jsonb) FROM PUBLIC;


--
-- Name: FUNCTION save_exploration(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_exploration(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_exploration(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) TO authenticated;


--
-- Name: FUNCTION save_published_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_published_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_published_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) TO authenticated;


--
-- Name: FUNCTION save_published_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_published_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_published_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO authenticated;


--
-- Name: FUNCTION save_question(p_document jsonb, p_expected_revision integer, p_save_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_question(p_document jsonb, p_expected_revision integer, p_save_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_question(p_document jsonb, p_expected_revision integer, p_save_id uuid) TO authenticated;


--
-- Name: FUNCTION save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid) TO authenticated;


--
-- Name: FUNCTION save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) TO authenticated;


--
-- Name: FUNCTION save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO authenticated;


--
-- Name: FUNCTION save_review_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_review_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_review_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) TO authenticated;


--
-- Name: FUNCTION save_study(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.save_study(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.save_study(p_id uuid, p_values jsonb, p_reports jsonb, p_expected_revision integer, p_save_id uuid) TO authenticated;


--
-- Name: FUNCTION scale_answer_text(p_config jsonb, p_value text); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.scale_answer_text(p_config jsonb, p_value text) FROM PUBLIC;


--
-- Name: FUNCTION scale_answer_valid(p_config jsonb, p_value text, p_complete boolean); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.scale_answer_valid(p_config jsonb, p_value text, p_complete boolean) FROM PUBLIC;


--
-- Name: FUNCTION scale_config_valid(p_config jsonb, p_ready boolean); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.scale_config_valid(p_config jsonb, p_ready boolean) FROM PUBLIC;


--
-- Name: FUNCTION shared_questionnaire_authors(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.shared_questionnaire_authors() FROM PUBLIC;
GRANT ALL ON FUNCTION private.shared_questionnaire_authors() TO authenticated;


--
-- Name: FUNCTION stamp_service_announcement(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.stamp_service_announcement() FROM PUBLIC;


--
-- Name: FUNCTION start_questionnaire_review(p_questionnaire_id uuid, p_expected_revision integer); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.start_questionnaire_review(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION private.start_questionnaire_review(p_questionnaire_id uuid, p_expected_revision integer) TO authenticated;


--
-- Name: FUNCTION sync_review_response_layout(target uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.sync_review_response_layout(target uuid) FROM PUBLIC;


--
-- Name: FUNCTION unread_question_review_ids(qid uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.unread_question_review_ids(qid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.unread_question_review_ids(qid uuid) TO authenticated;


--
-- Name: FUNCTION validate_question(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.validate_question() FROM PUBLIC;


--
-- Name: FUNCTION validate_questionnaire_placements(p_questionnaire_id uuid); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION private.validate_questionnaire_placements(p_questionnaire_id uuid) FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict jQREhcDGRpkNVKiMuohLcfRkfuMME3JJQR39gZQCe1IdSb5YGymgzehdSgfRznv

