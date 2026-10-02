begin;
set local lock_timeout='10s';
set local check_function_bodies=off;
lock table public.questionnaires, public.questionnaire_sections, public.questionnaire_questions,
 public.response_sessions, public.question_review_requests, public.questionnaire_publication_reads in access exclusive mode;
-- Historical parent IDs remain as provenance only; no runtime code uses them.
alter table public.questionnaires alter column legacy_parent_id set default gen_random_uuid();


DROP POLICY "Read visible sections" ON "public"."questionnaire_sections";

DROP POLICY "Record own visible publication" ON "public"."questionnaire_publication_reads";

DROP POLICY "Read visible questions" ON "public"."questionnaire_questions";

DROP POLICY "Own response question versions" ON "public"."question_versions";

DROP TRIGGER "reject_deleted_questionnaire_version" ON "public"."questionnaires";

DROP FUNCTION public.save_question_response_session(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text);

DROP FUNCTION public.distribute_questionnaire(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION public.delete_questionnaire(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION public.archive_questionnaire_draft(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION public.publish_questionnaire(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION public.open_questionnaire_response(p_version_id uuid);

DROP FUNCTION public.read_question_response_session(p_version_id uuid);

DROP FUNCTION public.save_questionnaire_response(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean);

DROP FUNCTION public.save_questionnaire_response(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text);

DROP FUNCTION public.read_published_questionnaire(p_version_id uuid);

DROP FUNCTION public.read_questionnaire_draft(p_version_id uuid);

DROP FUNCTION public.change_questionnaire_status(p_version_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid);

DROP FUNCTION public.mark_questionnaire_publication_read(p_version_id uuid);

DROP FUNCTION public.unread_distributed_questionnaires();

DROP FUNCTION public.unread_questionnaire_publications();

DROP FUNCTION public.distributed_response_statuses();

DROP FUNCTION public.open_question_response_session(p_version_id uuid);

DROP FUNCTION public.request_question_review(p_id uuid, p_question_id uuid, p_origin_version_id uuid, p_description text);

DROP FUNCTION public.read_published_question_sources(p_version_id uuid);

DROP FUNCTION public.open_distributed_response(p_version_id uuid);

DROP FUNCTION public.read_distributed_response(p_version_id uuid);

DROP FUNCTION public.save_distributed_response(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text);

DROP FUNCTION private.save_question_response_session(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text);

DROP FUNCTION private.has_saved_distribution_responses(p_version_id uuid);

DROP FUNCTION private.archive_questionnaire_draft(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION private.reject_deleted_questionnaire_version();

DROP FUNCTION private.import_legacy_text_questionnaire(p_source_version_id uuid, p_expected_question_count integer);

DROP FUNCTION private.open_questionnaire_response(p_version_id uuid);

DROP FUNCTION private.save_questionnaire_response(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean);

DROP FUNCTION private.read_question_response_session(p_version_id uuid);

DROP FUNCTION private.read_published_question_sources(p_version_id uuid);

DROP FUNCTION private.distribute_questionnaire(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION private.delete_questionnaire(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION private.publish_questionnaire(p_version_id uuid, p_expected_revision integer);

DROP FUNCTION private.change_questionnaire_status(p_version_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid);

DROP FUNCTION private.open_question_response_session(p_version_id uuid);

DROP FUNCTION private.open_distributed_response(p_version_id uuid);

DROP FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_version_id uuid, p_description text);

DROP FUNCTION private.save_questionnaire_response(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text);

DROP FUNCTION private.assert_published_response_access(p_version_id uuid);

DROP FUNCTION private.assert_distributed_response_access(p_version_id uuid);

DROP FUNCTION private.save_distributed_response(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text);

DROP FUNCTION private.read_distributed_response(p_version_id uuid);

DROP FUNCTION private.validate_questionnaire_placements(p_version_id uuid);

ALTER TABLE public.questionnaire_sections RENAME COLUMN version_id TO questionnaire_id;

ALTER TABLE public.questionnaire_questions RENAME COLUMN version_id TO questionnaire_id;

ALTER TABLE public.questionnaire_publication_reads RENAME COLUMN version_id TO questionnaire_id;

ALTER TABLE public.response_sessions RENAME COLUMN origin_version_id TO origin_questionnaire_id;

ALTER TABLE public.question_review_requests RENAME COLUMN origin_version_id TO origin_questionnaire_id;

ALTER TABLE private.deleted_questionnaire_versions RENAME COLUMN version_id TO questionnaire_id;

ALTER TABLE private.legacy_questionnaire_imports RENAME COLUMN target_questionnaire_id TO legacy_target_parent_id;

ALTER TABLE private.legacy_questionnaire_imports RENAME COLUMN source_version_id TO source_questionnaire_id;

ALTER TABLE private.legacy_questionnaire_imports RENAME COLUMN target_version_id TO target_questionnaire_id;

ALTER TABLE private.deleted_questionnaire_versions RENAME TO deleted_questionnaires;

ALTER TABLE private.legacy_questionnaire_imports RENAME CONSTRAINT legacy_questionnaire_imports_target_questionnaire_id_key TO legacy_questionnaire_imports_legacy_target_parent_id_key;

ALTER TABLE private.legacy_questionnaire_imports RENAME CONSTRAINT "legacy_questionnaire_imports_target_version_id_key" TO "legacy_questionnaire_imports_target_questionnaire_id_key";

ALTER TABLE public.questionnaires RENAME CONSTRAINT "questionnaire_versions_distributed_check" TO "questionnaires_distributed_check";

ALTER TABLE public.questionnaires RENAME CONSTRAINT "questionnaire_versions_pkey" TO "questionnaires_pkey";

ALTER TABLE public.questionnaires RENAME CONSTRAINT "questionnaire_versions_published_check" TO "questionnaires_published_check";

ALTER TABLE public.questionnaires RENAME CONSTRAINT "questionnaire_versions_revision_check" TO "questionnaires_revision_check";

ALTER TABLE public.questionnaires RENAME CONSTRAINT "questionnaire_versions_status_check" TO "questionnaires_status_check";

ALTER TABLE public.questionnaires RENAME CONSTRAINT "questionnaire_versions_title_check" TO "questionnaires_title_check";

ALTER TABLE public.questionnaire_sections RENAME CONSTRAINT "questionnaire_sections_id_version_id_key" TO "questionnaire_sections_id_questionnaire_id_key";

ALTER TABLE public.questionnaire_sections RENAME CONSTRAINT "questionnaire_sections_version_id_fkey" TO "questionnaire_sections_questionnaire_id_fkey";

ALTER TABLE public.questionnaire_sections RENAME CONSTRAINT "questionnaire_sections_version_id_position_key" TO "questionnaire_sections_questionnaire_id_position_key";

ALTER TABLE private.deleted_questionnaires RENAME CONSTRAINT "deleted_questionnaire_versions_pkey" TO "deleted_questionnaires_pkey";

ALTER TABLE public.questionnaire_publication_reads RENAME CONSTRAINT "questionnaire_publication_reads_version_id_fkey" TO "questionnaire_publication_reads_questionnaire_id_fkey";

ALTER TABLE public.questionnaire_questions RENAME CONSTRAINT "questionnaire_questions_id_version_id_key" TO "questionnaire_questions_id_questionnaire_id_key";

ALTER TABLE public.questionnaire_questions RENAME CONSTRAINT "questionnaire_questions_section_id_version_id_fkey" TO "questionnaire_questions_section_id_questionnaire_id_fkey";

ALTER TABLE public.questionnaire_questions RENAME CONSTRAINT "questionnaire_questions_version_id_fkey" TO "questionnaire_questions_questionnaire_id_fkey";

ALTER TABLE public.questionnaire_questions RENAME CONSTRAINT "questionnaire_questions_version_id_logical_key_key" TO "questionnaire_questions_questionnaire_id_logical_key_key";

ALTER TABLE public.response_sessions RENAME CONSTRAINT "response_sessions_origin_version_id_fkey" TO "response_sessions_origin_questionnaire_id_fkey";

ALTER TABLE public.response_sessions RENAME CONSTRAINT "response_sessions_respondent_id_origin_version_id_key" TO "response_sessions_respondent_id_origin_questionnaire_id_key";

ALTER INDEX public.questionnaire_versions_updated_idx RENAME TO questionnaires_updated_idx;

ALTER INDEX public.questionnaire_publication_reads_version_idx RENAME TO questionnaire_publication_reads_questionnaire_idx;

ALTER INDEX public.questionnaire_questions_section_version_idx RENAME TO questionnaire_questions_section_questionnaire_idx;

ALTER INDEX public.questionnaire_questions_source_version_idx RENAME TO questionnaire_questions_source_questionnaire_idx;

CREATE OR REPLACE FUNCTION public.list_my_published_responses()
 RETURNS TABLE(id uuid, title text, updated_at timestamp with time zone, source_deleted boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select s.id,s.origin_title,s.updated_at,s.origin_questionnaire_id is null from public.response_sessions s where s.respondent_id=(select auth.uid()) and s.started_stage='published' and (private.is_admin() or private.is_consultant_lead()) order by s.updated_at desc,s.id;
$function$;

CREATE OR REPLACE FUNCTION public.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.save_question_response_session(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,p_definition_token); $function$;

REVOKE ALL ON FUNCTION public.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) TO "postgres";

GRANT EXECUTE ON FUNCTION public.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) TO "service_role";

CREATE OR REPLACE FUNCTION private.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb; current_token text; saved_version uuid;
begin
 perform private.sync_published_response_layout(p_questionnaire_id);
 perform 1 from public.questions q where exists(select 1 from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=private.owned_published_session(p_questionnaire_id) and v.question_id=q.id) order by q.id for share;
 select * into s from public.response_sessions where id=private.owned_published_session(p_questionnaire_id) for update;
 if not found then raise exception 'Start response first' using errcode='22023'; end if;
 if p_save_id is null or p_revision is null or p_complete is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid response' using errcode='22023'; end if;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if s.last_save_id=p_save_id and s.last_payload=payload then return private.read_question_response_session(p_questionnaire_id); end if;
 current_token:=private.read_question_response_session(s.id)->>'definitionToken';
 if p_definition_token is distinct from current_token then raise exception 'Question definition changed' using errcode='40001'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Response conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p->>'id')::uuid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 -- Session layout keeps only ordering/source IDs; definitions and answers belong to questions.
 for r in select a.*,private.live_response_definition(v.question_id) def,v.definition saved_def,v.question_id from jsonb_array_elements(s.layout) with ordinality sec(section,si)
 cross join lateral jsonb_array_elements(sec.section->'questions') with ordinality p(placement,pi)
 join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p.placement->>'id')::uuid
 join public.question_versions v on v.id=a.question_version_id order by sec.si,p.pi loop
 rows_data:=p_answers->r.question_id::text;
 if jsonb_typeof(rows_data) is distinct from 'array' then raise exception 'Invalid rows' using errcode='22023'; end if;
 if jsonb_array_length(rows_data)>20 or (select count(distinct value->>'id') from jsonb_array_elements(rows_data))<>jsonb_array_length(rows_data) then raise exception 'Invalid rows' using errcode='22023'; end if;
 if r.def->>'row_mode'='single' and jsonb_array_length(rows_data)>1 or r.def->>'row_mode'='repeatable' and jsonb_array_length(rows_data)>(r.def->>'max_rows')::int then raise exception 'Too many rows' using errcode='22023'; end if;
 for row_data in select value from jsonb_array_elements(rows_data) loop
 if jsonb_typeof(row_data->'id') is distinct from 'number' or (row_data->>'id') !~ '^-?[0-9]{1,16}$' or jsonb_typeof(row_data->'answers') is distinct from 'object' then raise exception 'Invalid row' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(row_data->'answers') k where not exists(select 1 from jsonb_array_elements(r.def->'fields') field_item where field_item->>'id'=k)) then raise exception 'Unknown field' using errcode='22023'; end if;
 for f in select value from jsonb_array_elements(r.def->'fields') loop
 val:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if (row_data->'answers' ? (f->>'id') and jsonb_typeof(row_data->'answers'->(f->>'id')) is distinct from 'string') or not private.question_field_response_valid(f,val,false) then raise exception 'Invalid answer' using errcode='22023'; end if;
 end loop; end loop;
 matched:='{}'; all_mode:=coalesce(r.def#>>'{condition,mode}','all')<>'any'; waiting:=false;
 for source_id in select distinct value->>'blockId' from jsonb_array_elements(coalesce(nullif(r.def#>'{condition,clauses}','null'::jsonb),'[]')) loop
 select private.live_response_definition(v.question_id) into source_def from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=s.id and v.question_id::text=source_id;
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
 select private.live_response_definition(v.question_id) into source_def from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=s.id and v.question_id::text=source_id;
 select value into f from jsonb_array_elements(source_def->'fields') where value->>'id'=r.def->>'source_field_id';
 select coalesce(jsonb_agg(value),'[]') into ref_ids from jsonb_array_elements(ref_ids) where private.question_field_response_valid(f,coalesce(value->'answers'->>(f->>'id'),''),true);
 end if;
 waiting:=waiting or jsonb_array_length(ref_ids)=0;
 end if;
 ids:='[]'; matched:='[]'; body_text:='';
 for row_data in select value from jsonb_array_elements(rows_data) loop
 if waiting or (ref_ids is not null and not exists(select 1 from jsonb_array_elements(ref_ids) x where x->'id'=row_data->'id')) then continue; end if;
 ids:=ids||jsonb_build_array(row_data->'id'); source_ok:=false;
 for f in select value from jsonb_array_elements(r.def->'fields') loop
 val:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if p_complete and not private.question_field_response_valid(f,val,true) then raise exception 'Answer all active fields' using errcode='22023'; end if;
 source_ok:=source_ok or private.question_field_response_valid(f,val,true);
 body_text:=body_text||case when body_text='' then '' else E'\n' end|| (row_data->>'id')||' · '||(f->>'label')||': '||case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(coalesce(f->'scaleConfig',jsonb_build_object('max',f->'scaleMax')),val) when f->>'kind' in ('single','multiple') then private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) else val end;
 end loop;
 if source_ok then matched:=matched||jsonb_build_array(row_data); end if;
 end loop;
 if p_complete and not waiting and jsonb_array_length(ids)<(case when ref_ids is not null then jsonb_array_length(ref_ids) when r.def->>'row_mode'='repeatable' then coalesce((r.def->>'min_rows')::int,1) else 1 end) then raise exception 'Missing rows' using errcode='22023'; end if;
 active:=active||jsonb_build_object(r.question_id::text,matched);
 insert into public.question_versions(question_id,source_revision,definition) values(r.question_id,(r.def->>'revision')::int,r.def) on conflict(question_id,source_revision) do nothing;
 select id into saved_version from public.question_versions where question_id=r.question_id and source_revision=(r.def->>'revision')::int;
 update public.question_responses set previous_responses=case when private.response_structure(r.saved_def) is distinct from private.response_structure(r.def) and jsonb_array_length(r.rows)>0 then previous_responses||jsonb_build_array(jsonb_build_object('definition',r.saved_def,'rows',r.rows,'body',r.body,'savedAt',r.updated_at)) else previous_responses end,question_version_id=saved_version,rows=rows_data,active_row_ids=ids,body=body_text,updated_at=now() where id=r.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=s.id;
 return private.read_question_response_session(p_questionnaire_id);
end $function$;

REVOKE ALL ON FUNCTION private.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) TO "postgres";

GRANT EXECUTE ON FUNCTION private.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text) TO "authenticated";

CREATE OR REPLACE FUNCTION private.has_saved_distribution_responses(p_questionnaire_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists (
  select 1 from public.response_sessions s
  where s.origin_questionnaire_id=p_questionnaire_id and s.started_stage='distributed'
   and (s.revision>0 or s.last_save_id is not null or s.status='submitted'
    or s.free_response<>'' or exists (
     select 1 from public.question_responses r where r.session_id=s.id
      and (r.body<>'' or r.rows<>'[]'::jsonb or r.previous_responses<>'[]'::jsonb)
   ))
 );
$function$;

REVOKE ALL ON FUNCTION private.has_saved_distribution_responses(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.has_saved_distribution_responses(p_questionnaire_id uuid) TO "postgres";

CREATE OR REPLACE FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
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
    if p_expected_revision <> 0 then raise exception 'Questionnaire conflict' using errcode = '40001'; end if;
    insert into public.questionnaires(id, created_by) values(v_id, auth.uid()) returning * into v;
  end if;
  if not exists(select 1 from public.questionnaires where id=v.id and created_by=auth.uid()) then raise exception 'Only the creator can edit' using errcode='42501'; end if;
  if v.status not in ('draft','published') or exists(select 1 from public.questionnaires where id=v_id and archived_at is not null) then
    raise exception 'Questionnaire is not editable' using errcode = '55000';
  end if;
  if v.last_save_id = p_save_id and v.last_save_hash = payload_hash then
    return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
  end if;
  if v.revision <> p_expected_revision or v.last_save_id = p_save_id then raise exception 'Questionnaire conflict' using errcode = '40001'; end if;

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
  update public.questionnaires set title=p_document->>'title', revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $function$;

CREATE OR REPLACE FUNCTION private.owned_published_session(target uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare sid uuid; begin
 if not public.can_write_guide_answers() then raise exception 'Staff access required' using errcode='42501'; end if;
 select id into sid from public.response_sessions where respondent_id=auth.uid() and started_stage='published' and (id=target or origin_questionnaire_id=target) order by (id=target) desc limit 1;
 if sid is null then raise exception 'Response not found' using errcode='42501'; end if; return sid;
end $function$;

CREATE OR REPLACE FUNCTION public.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.distribute_questionnaire(p_questionnaire_id,p_expected_revision); $function$;

REVOKE ALL ON FUNCTION public.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION public.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "service_role";

GRANT EXECUTE ON FUNCTION public.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION private.guard_questionnaire_placement_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.status is distinct from old.status and new.status in ('published','distributed') then
  perform private.validate_questionnaire_placements(new.id);
  if new.status='distributed' then
   -- Serialize with original edits and review creation, including requests from other questionnaires.
   perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=new.id and p.source_question_id=q.id) order by q.id for update;
   perform private.validate_questionnaire_placements(new.id);
   if exists(select 1 from public.questionnaire_questions p join public.question_review_requests r on r.question_id=p.source_question_id where p.questionnaire_id=new.id and r.resolved_at is null) then
    raise exception 'Unresolved question reviews prevent distribution' using errcode='55000';
   end if;
   update public.questions q set distribution_locked_at=clock_timestamp()
   where distribution_locked_at is null and exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=new.id and p.source_question_id=q.id);
  end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform private.delete_questionnaire(p_questionnaire_id,p_expected_revision); end $function$;

REVOKE ALL ON FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION private.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION public.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer)
 RETURNS text
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.delete_questionnaire(p_questionnaire_id,p_expected_revision);
$function$;

REVOKE ALL ON FUNCTION public.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION public.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "service_role";

GRANT EXECUTE ON FUNCTION public.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION public.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.archive_questionnaire_draft(p_questionnaire_id,p_expected_revision);
$function$;

REVOKE ALL ON FUNCTION public.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION public.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) TO "service_role";

GRANT EXECUTE ON FUNCTION public.archive_questionnaire_draft(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION private.reject_deleted_questionnaire()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists(select 1 from private.deleted_questionnaires where questionnaire_id=new.id) then
    raise exception 'Questionnaire was deleted' using errcode='55000';
  end if;
  return new;
end $function$;

REVOKE ALL ON FUNCTION private.reject_deleted_questionnaire() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.reject_deleted_questionnaire() TO "postgres";

CREATE OR REPLACE FUNCTION public.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select private.publish_questionnaire(p_questionnaire_id,p_expected_revision);
$function$;

REVOKE ALL ON FUNCTION public.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION public.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "service_role";

GRANT EXECUTE ON FUNCTION public.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION public.open_questionnaire_response(p_questionnaire_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.open_questionnaire_response(p_questionnaire_id); $function$;

REVOKE ALL ON FUNCTION public.open_questionnaire_response(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.open_questionnaire_response(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.open_questionnaire_response(p_questionnaire_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.open_questionnaire_response(p_questionnaire_id uuid) TO "service_role";

CREATE OR REPLACE FUNCTION private.guard_question_response_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ declare published boolean; begin
 if tg_table_name='response_sessions' then
 if new.legacy_response is distinct from old.legacy_response or new.respondent_id<>old.respondent_id or (old.started_stage<>'published' and (new.layout<>old.layout or new.origin_title<>old.origin_title)) or new.started_stage<>old.started_stage then raise exception 'Session identity is immutable' using errcode='55000'; end if;
 if old.started_stage<>'published' and old.status='submitted' and (to_jsonb(new)-'origin_questionnaire_id') is distinct from (to_jsonb(old)-'origin_questionnaire_id') then raise exception 'Response locked' using errcode='55000'; end if;
 else
 select started_stage='published' into published from public.response_sessions where id=old.session_id;
 if tg_op='DELETE' then
 if published and exists(select 1 from public.question_versions v join public.questions q on q.id=v.question_id where v.id=old.question_version_id and q.archived_at is not null) then return old; end if;
 raise exception 'Response history is preserved' using errcode='55000';
 end if;
 if new.legacy_answer is distinct from old.legacy_answer or new.session_id<>old.session_id or (new.question_version_id<>old.question_version_id and (not published or (select question_id from public.question_versions where id=new.question_version_id) is distinct from (select question_id from public.question_versions where id=old.question_version_id))) or (not published and exists(select 1 from public.response_sessions where id=old.session_id and status='submitted')) then raise exception 'Response locked' using errcode='55000'; end if;
 end if; return new;
end $function$;

CREATE OR REPLACE FUNCTION public.read_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
select private.read_question_response_session(p_questionnaire_id); $function$;

REVOKE ALL ON FUNCTION public.read_question_response_session(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.read_question_response_session(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.read_question_response_session(p_questionnaire_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.read_question_response_session(p_questionnaire_id uuid) TO "service_role";

CREATE OR REPLACE FUNCTION private.import_legacy_text_questionnaire(p_source_questionnaire_id uuid, p_expected_question_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin
raise exception 'Legacy import retired locally; use the retained import ledger and a reviewed conversion plan' using errcode='55000';
end $function$;

REVOKE ALL ON FUNCTION private.import_legacy_text_questionnaire(p_source_questionnaire_id uuid, p_expected_question_count integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.import_legacy_text_questionnaire(p_source_questionnaire_id uuid, p_expected_question_count integer) TO "postgres";

CREATE OR REPLACE FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.open_distributed_response(p_questionnaire_id) $function$;

REVOKE ALL ON FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION private.open_questionnaire_response(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.save_questionnaire_response(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete); $function$;

REVOKE ALL ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) TO "service_role";

CREATE OR REPLACE FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.save_distributed_response(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,null) $function$;

REVOKE ALL ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean) TO "authenticated";

CREATE OR REPLACE FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.save_questionnaire_response(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,p_free_response); $function$;

REVOKE ALL ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "postgres";

GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "service_role";

CREATE OR REPLACE FUNCTION private.read_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; qs jsonb; sections jsonb; sid uuid; begin
 sid:=private.sync_published_response_layout(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid;
 select coalesce(jsonb_agg(jsonb_build_object('responseId',r.id,'questionVersionId',v.id,'definition',d.def,'rows',r.rows,'activeRowIds',r.active_row_ids,'needsReview',private.response_structure(v.definition) is distinct from private.response_structure(d.def),'previousBody',r.body,'previousDefinition',v.definition,'previousResponses',r.previous_responses) order by r.id),'[]') into qs
 from public.question_responses r join public.question_versions v on v.id=r.question_version_id cross join lateral (select private.live_response_definition(v.question_id) def) d where r.session_id=s.id and d.def is not null and exists(select 1 from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p where p->>'sourceQuestionId'=v.question_id::text);
 select coalesce(jsonb_agg(sec.value||jsonb_build_object('questions',coalesce((select jsonb_agg(p.value order by p.ord) from jsonb_array_elements(sec.value->'questions') with ordinality p(value,ord) where exists(select 1 from jsonb_array_elements(qs) q where q#>>'{definition,id}'=p.value->>'sourceQuestionId')),'[]')) order by sec.ord),'[]') into sections from jsonb_array_elements(s.layout) with ordinality sec(value,ord);
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'sections',sections,'questions',qs,'definitionToken',md5(s.origin_title||sections::text||(select coalesce(jsonb_agg(q->'definition' order by q#>>'{definition,id}'),'[]')::text from jsonb_array_elements(qs) q)),'sourceDeleted',s.origin_questionnaire_id is null);
end $function$;

REVOKE ALL ON FUNCTION private.read_question_response_session(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.read_question_response_session(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION private.read_question_response_session(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION public.read_published_questionnaire(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',case when q.source_question_id is null then q.body else (select source->>'prompt' from jsonb_array_elements(private.read_published_question_sources(v.id)) source where source->>'id'=q.source_question_id::text) end,'kind',coalesce(q.kind,'text'),'options',coalesce(q.options,'[]'::jsonb),'scaleConfig',coalesce(q.scale_config,'{"max":5,"low":"전혀 그렇지 않다","middle":"보통이다","high":"매우 그렇다","allowText":false}'::jsonb),'choiceStyle',coalesce(q.choice_style,'list'),'choiceAllowText',coalesce(q.choice_allow_text,false),'details','[]'::jsonb) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb))
  from public.questionnaires v where v.id=p_questionnaire_id and v.status in ('published','distributed') and exists(select 1 from public.questionnaires parent where parent.id=v.id and parent.archived_at is null)
;
$function$;

REVOKE ALL ON FUNCTION public.read_published_questionnaire(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.read_published_questionnaire(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.read_published_questionnaire(p_questionnaire_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public.read_published_questionnaire(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION private.read_published_question_sources(p_questionnaire_id uuid)
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
    join public.questionnaires parent on parent.id=v.id
    where v.id=p_questionnaire_id and (v.status='distributed' or (v.status='published' and (private.is_admin() or private.is_consultant_lead()))) and parent.archived_at is null
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
      select 1 from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=q.id
    )
  ),'[]'::jsonb);
end $function$;

REVOKE ALL ON FUNCTION private.read_published_question_sources(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.read_published_question_sources(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION private.read_published_question_sources(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION private.guard_distributed_question()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.distribution_locked_at is not null then
  if tg_op='UPDATE' and new.distribution_locked_at is null
   and (to_jsonb(new)-array['distribution_locked_at','updated_at','search_text'])=(to_jsonb(old)-array['distribution_locked_at','updated_at','search_text'])
   and not exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id where p.source_question_id=old.id and v.status='distributed') then
    return new;
  end if;
  raise exception 'Distributed question is immutable' using errcode='55000';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.read_questionnaire_draft(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('sourceQuestionId',q.source_question_id)) || jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',(select source.prompt from public.questions source where source.id=q.source_question_id and source.archived_at is null),'kind',coalesce(q.kind,'text'),'options',coalesce(q.options,'[]'::jsonb),'scaleConfig',coalesce(q.scale_config,'{"max":5,"low":"전혀 그렇지 않다","middle":"보통이다","high":"매우 그렇다","allowText":false}'::jsonb),'choiceStyle',coalesce(q.choice_style,'list'),'choiceAllowText',coalesce(q.choice_allow_text,false),'details','[]'::jsonb) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb))
  from public.questionnaires v where v.id=p_questionnaire_id and v.status in ('draft','published') and exists(select 1 from public.questionnaires p where p.id=v.id and p.created_by=(select auth.uid()) and p.archived_at is null)
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$function$;

REVOKE ALL ON FUNCTION public.read_questionnaire_draft(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.read_questionnaire_draft(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.read_questionnaire_draft(p_questionnaire_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public.read_questionnaire_draft(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION private.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer)
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
  if p_questionnaire_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
  select * into v from public.questionnaires where id=p_questionnaire_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from public.questionnaires where id=v.id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from public.questionnaires where id=v.id and created_by=auth.uid()) then raise exception 'Only the creator can publish or distribute' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire conflict' using errcode='40001'; end if;
  if v.status='distributed' then return; end if;
  if v.status<>'published' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where questionnaire_id=v.id)
    or exists(select 1 from public.questionnaire_questions where questionnaire_id=v.id and source_question_id is null and btrim(body)='') then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  update public.questionnaires set status='distributed',distributed_at=now(),updated_at=now() where id=v.id;
end $function$;

REVOKE ALL ON FUNCTION private.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION private.distribute_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION private.guard_placed_question_archive()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.archived_at is not null and old.archived_at is null and exists (
    select 1 from public.questionnaire_questions p
    join public.questionnaires v on v.id=p.questionnaire_id
    join public.questionnaires parent on parent.id=v.id
    where p.source_question_id=new.id and parent.archived_at is null
  ) then raise exception 'Question is used by a questionnaire' using errcode='55000'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer)
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
  -- Serialize the questionnaire before inspecting its distribution state.
  perform 1 from public.questionnaires where id=v.id for update;
  perform 1 from public.questionnaires where id=v.id order by id for update;
  if exists(select 1 from public.questionnaires where id=v.id and archived_at is not null)
    and exists(select 1 from public.questionnaires where id=v.id and status='distributed') then return 'archived'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire changed' using errcode='40001'; end if;
  if exists(select 1 from public.questionnaires where id=v.id and status='distributed') then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=v.id;
    return 'archived';
  end if;
  insert into private.deleted_questionnaires(questionnaire_id)
    select id from public.questionnaires where id=v.id;
  -- Delete every dependent row for a never-distributed questionnaire atomically.
  
  delete from public.questionnaire_publication_reads where questionnaire_id in (select id from public.questionnaires where id=v.id);
  delete from public.questionnaire_questions where questionnaire_id in (select id from public.questionnaires where id=v.id);
  delete from public.questionnaire_sections where questionnaire_id in (select id from public.questionnaires where id=v.id);
  delete from public.questionnaires where id=v.id;
  return 'deleted';
end $function$;

REVOKE ALL ON FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION private.delete_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION private.can_read_distributed_questionnaire(p_questionnaire_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null
 and exists(select 1 from public.profiles where id=auth.uid() and role='consultant')
 and exists(select 1 from public.questionnaires q join public.questionnaires v on v.id=q.id
   where q.id=p_questionnaire_id and q.archived_at is null and v.status='distributed');
$function$;

CREATE OR REPLACE FUNCTION public.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.change_questionnaire_status(p_questionnaire_id,p_expected_revision,p_expected_status,p_expected_archived_at,p_status,p_request_id);
$function$;

REVOKE ALL ON FUNCTION public.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) TO "authenticated";

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
 ) shown where q.id=any(p_question_ids) and q.archived_at is null and jsonb_array_length(shown.rows)>0 and private.response_structure(a.definition)=private.response_structure(private.live_response_definition(q.id)) and (q.created_by=auth.uid() or private.is_admin() or exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires parent on parent.id=v.id where p.source_question_id=q.id and v.status='published' and parent.archived_at is null))),'{}');
end $function$;

CREATE OR REPLACE FUNCTION private.guard_questionnaire_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_id uuid; old_questionnaire_id uuid;
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
  if tg_op<>'INSERT' then old_questionnaire_id:=old.questionnaire_id; end if;
  if tg_op<>'DELETE' then v_id:=new.questionnaire_id; end if;
  if exists(select 1 from public.questionnaires where id in(v_id,old_questionnaire_id) and status='distributed') then
   raise exception 'Published questionnaire is immutable' using errcode='55000';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer)
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
  if p_questionnaire_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
  select * into v from public.questionnaires where id=p_questionnaire_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from public.questionnaires where id=v.id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if not exists(select 1 from public.questionnaires where id=v.id and created_by=auth.uid()) then raise exception 'Only the creator can publish or distribute' using errcode='42501'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire conflict' using errcode='40001'; end if;
  if v.status='published' then return; end if;
  if v.status<>'draft' then raise exception 'Invalid transition' using errcode='55000'; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where questionnaire_id=v.id)
     then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  perform private.validate_questionnaire_placements(v.id);
  update public.questionnaires set status='published',published_at=now(),updated_at=now() where id=v.id;
end $function$;

REVOKE ALL ON FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "postgres";

GRANT EXECUTE ON FUNCTION private.publish_questionnaire(p_questionnaire_id uuid, p_expected_revision integer) TO "authenticated";

CREATE OR REPLACE FUNCTION public.mark_questionnaire_publication_read(p_questionnaire_id uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 insert into public.questionnaire_publication_reads(user_id,questionnaire_id)
 select (select auth.uid()),v.id from public.questionnaires v join public.questionnaires q on q.id=v.id
 where v.id=p_questionnaire_id and v.status='published' and q.archived_at is null
 and ((select private.is_admin()) or (select private.is_consultant_lead()))
 on conflict(user_id,questionnaire_id) do nothing;
$function$;

REVOKE ALL ON FUNCTION public.mark_questionnaire_publication_read(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mark_questionnaire_publication_read(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.mark_questionnaire_publication_read(p_questionnaire_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION public.mark_questionnaire_publication_read(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION public.unread_distributed_questionnaires()
 RETURNS TABLE(questionnaire_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select v.id from public.questionnaires v join public.questionnaires q on q.id=v.id where v.status='distributed' and q.archived_at is null
 and not exists(select 1 from public.response_sessions r where r.origin_questionnaire_id=v.id and r.respondent_id=(select auth.uid()));
$function$;

REVOKE ALL ON FUNCTION public.unread_distributed_questionnaires() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.unread_distributed_questionnaires() TO "postgres";

GRANT EXECUTE ON FUNCTION public.unread_distributed_questionnaires() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.unread_distributed_questionnaires() TO "service_role";

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
 select origin_questionnaire_id into origin from public.response_sessions where id=sid;
 if origin is null then return sid; end if;
 perform pg_advisory_xact_lock(hashtextextended(origin::text,0));
 select v.title into current_title from public.questionnaires v
 join public.questionnaires q on q.id=v.id
 where v.id=origin and v.status='published' and q.archived_at is null;
 if not found then return sid; end if;
 -- Match the source-before-session lock order used by answer saving.
 perform 1 from public.questions q where
 exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=origin and p.source_question_id=q.id)
 or exists(select 1 from public.question_responses r join public.question_versions v on v.id=r.question_version_id where r.session_id=sid and v.question_id=q.id)
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
      where source_question_id is null and questionnaire_id = new.id and (
        not private.question_config_valid(kind,options,true)
        or (kind = 'scale' and not private.scale_config_valid(scale_config,true))
      )
    ) then
    raise exception 'Question choices or scale labels are incomplete' using errcode='22023';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    or p_status is null or p_status not in ('draft','published','distributed','archived')
    or p_expected_status is null or p_expected_status not in ('draft','published','distributed') then
    raise exception 'Invalid status request' using errcode='22023';
  end if;
  fingerprint := md5(jsonb_build_array(p_questionnaire_id,p_expected_revision,p_expected_status,p_expected_archived_at,p_status)::text);
  perform pg_advisory_xact_lock(hashtextextended('questionnaire-status:'||p_request_id::text,0));
  select * into receipt from private.questionnaire_status_requests where id=p_request_id;
  if found then
    if receipt.actor_id <> auth.uid() or receipt.payload_hash <> fingerprint then
      raise exception 'Request conflict' using errcode='40001';
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
    raise exception 'Questionnaire conflict' using errcode='40001';
  end if;
  if p_status='archived' then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=parent.id;
  elsif v.status='distributed' and p_status in ('draft','published') then
    if parent.archived_at is not null then raise exception 'Restore archived questionnaire first' using errcode='55000'; end if;
    perform 1 from public.questions source where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=v.id and p.source_question_id=source.id) order by source.id for update;
    perform 1 from public.response_sessions where origin_questionnaire_id=v.id and started_stage='distributed' order by id for update;
    if private.has_saved_distribution_responses(v.id) then
      raise exception 'Saved responses prevent distribution withdrawal' using errcode='55000';
    end if;
    -- Preserve empty view-only records, but do not reuse their old layout on redistribution.
    update public.response_sessions set origin_questionnaire_id=null where origin_questionnaire_id=v.id and started_stage='distributed';
    update public.questionnaires set status=p_status,distributed_at=null,
      published_at=case when p_status='published' then coalesce(published_at,clock_timestamp()) else null end,
      revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    update public.questions source set distribution_locked_at=null
      where source.distribution_locked_at is not null
      and exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=v.id and p.source_question_id=source.id)
      and not exists(select 1 from public.questionnaire_questions p join public.questionnaires dv on dv.id=p.questionnaire_id where p.source_question_id=source.id and dv.status='distributed');

  else
    if v.status='distributed' and p_status <> 'distributed' then
      raise exception 'Distributed questionnaire is immutable' using errcode='55000';
    end if;
    if parent.archived_at is not null then
      -- A referenced source may have been archived while this document was hidden.
      perform private.validate_questionnaire_placements(v.id);
      update public.questionnaires set archived_at=null where id=parent.id;
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
  result := jsonb_build_object('questionnaireId',p_questionnaire_id);
  insert into private.questionnaire_status_requests(id,actor_id,payload_hash,result)
    values(p_request_id,auth.uid(),fingerprint,result);
  return result;
end $function$;

REVOKE ALL ON FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION private.change_questionnaire_status(p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION private.can_read_question_reviews(qid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists (
 select 1 from public.questions q where q.id=qid and (q.created_by=auth.uid() or private.is_admin() or exists(
 select 1 from public.question_review_requests r where r.question_id=qid and r.requested_by=auth.uid()) or (q.archived_at is null and exists (
 select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id where p.source_question_id=qid and v.status='published' and d.archived_at is null))));
$function$;

CREATE OR REPLACE FUNCTION public.unread_questionnaire_publications()
 RETURNS TABLE(questionnaire_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select v.id from public.questionnaires v join public.questionnaires q on q.id=v.id
 where ((select private.is_admin()) or (select private.is_consultant_lead()))
 and v.status='published' and q.archived_at is null and q.created_by<>(select auth.uid())
 and not exists(select 1 from public.questionnaire_publication_reads r where r.user_id=(select auth.uid()) and r.questionnaire_id=v.id);
$function$;

REVOKE ALL ON FUNCTION public.unread_questionnaire_publications() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.unread_questionnaire_publications() TO "postgres";

GRANT EXECUTE ON FUNCTION public.unread_questionnaire_publications() TO "service_role";

GRANT EXECUTE ON FUNCTION public.unread_questionnaire_publications() TO "authenticated";

CREATE OR REPLACE FUNCTION private.read_question_reviews(qid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare owner_id uuid; published boolean; begin
 if not private.can_read_question_reviews(qid) then raise exception 'Review access denied' using errcode='42501'; end if;
 select created_by into owner_id from public.questions where id=qid;
 select exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id join public.questions q on q.id=p.source_question_id where q.id=qid and q.archived_at is null and v.status='published' and d.archived_at is null) into published;
 return jsonb_build_object('canResolve',owner_id=auth.uid() or private.is_admin(),'canRequest',private.can_request_question_review(qid,null),'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.question_review_requests r where r.question_id=qid),'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION private.open_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; item jsonb; ver uuid; sources jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 select id into sid from public.response_sessions where (id=p_questionnaire_id or origin_questionnaire_id=p_questionnaire_id) and respondent_id=auth.uid() and started_stage='published';
 if sid is not null then return private.read_question_response_session(p_questionnaire_id); end if;
 perform private.assert_published_response_access(p_questionnaire_id);
 if not exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id) or exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id and source_question_id is null) then
 raise exception 'Source questions required' using errcode='22023'; end if;
 -- Locks source rows against concurrent save_question while capturing all definitions.
 perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=q.id) order by q.id for share;
 perform private.validate_questionnaire_placements(p_questionnaire_id);
 sources:=private.read_published_question_sources(p_questionnaire_id);
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'published',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for item in select value from jsonb_array_elements(sources) loop
 insert into public.question_versions(question_id,source_revision,definition) values((item->>'id')::uuid,(item->>'revision')::integer,item)
 on conflict(question_id,source_revision) do nothing;
 select id into ver from public.question_versions where question_id=(item->>'id')::uuid and source_revision=(item->>'revision')::integer;
 insert into public.question_responses(session_id,question_version_id,origin_placement_id)
 select sid,ver,p.id from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=(item->>'id')::uuid;
 end loop;
 update public.question_responses r set referenced_response_id=src.id from public.question_versions q,public.question_responses src,public.question_versions sq
 where r.session_id=sid and r.question_version_id=q.id and src.session_id=sid and src.question_version_id=sq.id and q.definition->>'source_block_id'=sq.question_id::text;
 return private.read_question_response_session(p_questionnaire_id);
end $function$;

REVOKE ALL ON FUNCTION private.open_question_response_session(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.open_question_response_session(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION private.open_question_response_session(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION private.published_questionnaire_authors()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('questionnaireId',v.id,'name',p.name))
 from public.questionnaires v
 join public.questionnaires q on q.id=v.id
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
 select p.questionnaire_id,count(distinct r.id) as count,
 count(distinct r.id) filter (where exists(select 1 from public.questions source where source.id=r.question_id and source.created_by=auth.uid()) and r.requested_by<>auth.uid() and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid())) as unread_count
 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id join public.question_review_requests r on r.question_id=p.source_question_id and r.resolved_at is null
 where private.can_read_question_reviews(r.question_id) and (d.created_by=auth.uid() or private.is_admin() or (v.status='published' and d.archived_at is null)) group by p.questionnaire_id
 ) c),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION private.open_distributed_response(p_questionnaire_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; q public.questionnaire_questions%rowtype; qv uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 perform private.assert_distributed_response_access(p_questionnaire_id);
 select id into sid from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid();
 if sid is not null then return sid; end if;
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,status,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'distributed','assigned',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for q in select * from public.questionnaire_questions where questionnaire_id=p_questionnaire_id order by id loop
 insert into public.question_versions(legacy_question_id,source_revision,definition)
 values(q.id,0,jsonb_build_object('id',q.id,'prompt',q.body,'fields',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',q.id,'label','답변','kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text))),'row_mode','single','legacy',true))
 on conflict(legacy_question_id) where legacy_question_id is not null do nothing;
 select id into qv from public.question_versions where legacy_question_id=q.id;
 insert into public.question_responses(session_id,question_version_id,origin_placement_id) values(sid,qv,q.id);
 end loop;
 return sid;
end $function$;

REVOKE ALL ON FUNCTION private.open_distributed_response(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.open_distributed_response(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION private.open_distributed_response(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text)
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
 perform 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id where p.source_question_id=p_question_id and v.status='published' and d.archived_at is null and (p_origin_questionnaire_id is null or v.id=p_origin_questionnaire_id) for share of p,v,d;
 if not found then raise exception 'Published question required' using errcode='42501'; end if;
 insert into public.question_review_requests(id,question_id,origin_questionnaire_id,question_revision,requested_by,requester_name,description,title) values(p_id,p_question_id,p_origin_questionnaire_id,rev,actor.id,actor.name,btrim(p_description),'') on conflict(id) do nothing;
 if not exists(select 1 from public.question_review_requests where id=p_id and question_id=p_question_id and requested_by=actor.id and description=btrim(p_description) and origin_questionnaire_id is not distinct from p_origin_questionnaire_id) then raise exception 'Review conflict' using errcode='40001'; end if;
end $function$;

REVOKE ALL ON FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) TO "postgres";

GRANT EXECUTE ON FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) TO "authenticated";

CREATE OR REPLACE FUNCTION public.distributed_response_statuses()
 RETURNS TABLE(questionnaire_id uuid, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select s.origin_questionnaire_id,s.status from public.response_sessions s join public.questionnaires v on v.id=s.origin_questionnaire_id where s.respondent_id=(select auth.uid()) and v.status='distributed';
$function$;

REVOKE ALL ON FUNCTION public.distributed_response_statuses() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.distributed_response_statuses() TO "postgres";

GRANT EXECUTE ON FUNCTION public.distributed_response_statuses() TO "authenticated";

GRANT EXECUTE ON FUNCTION public.distributed_response_statuses() TO "service_role";

CREATE OR REPLACE FUNCTION private.can_request_question_review(qid uuid, origin_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists(
 select 1 from public.questions q join public.questionnaire_questions p on p.source_question_id=q.id join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id
 where q.id=qid and q.created_by<>auth.uid() and q.archived_at is null and d.archived_at is null and v.status='published' and (origin_id is null or v.id=origin_id));
$function$;

CREATE OR REPLACE FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.save_distributed_response(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,p_free_response) $function$;

REVOKE ALL ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "postgres";

GRANT EXECUTE ON FUNCTION private.save_questionnaire_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "authenticated";

CREATE OR REPLACE FUNCTION private.assert_published_response_access(p_questionnaire_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.can_write_guide_answers() or not exists(
 select 1 from public.questionnaires v join public.questionnaires q on q.id=v.id
 where v.id=p_questionnaire_id and v.status='published' and q.archived_at is null
 ) then raise exception 'Published response access denied' using errcode='42501'; end if;
end $function$;

REVOKE ALL ON FUNCTION private.assert_published_response_access(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.assert_published_response_access(p_questionnaire_id uuid) TO "postgres";

CREATE OR REPLACE FUNCTION public.open_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select private.open_question_response_session(p_questionnaire_id)$function$;

REVOKE ALL ON FUNCTION public.open_question_response_session(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.open_question_response_session(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.open_question_response_session(p_questionnaire_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.open_question_response_session(p_questionnaire_id uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.request_question_review(p_id,p_question_id,p_origin_questionnaire_id,p_description); $function$;

REVOKE ALL ON FUNCTION public.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) TO "postgres";

GRANT EXECUTE ON FUNCTION public.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text) TO "service_role";

CREATE OR REPLACE FUNCTION public.read_published_question_sources(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.read_published_question_sources(p_questionnaire_id);
$function$;

REVOKE ALL ON FUNCTION public.read_published_question_sources(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.read_published_question_sources(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.read_published_question_sources(p_questionnaire_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.read_published_question_sources(p_questionnaire_id uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.open_distributed_response(p_questionnaire_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.open_distributed_response(p_questionnaire_id) $function$;

REVOKE ALL ON FUNCTION public.open_distributed_response(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.open_distributed_response(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.open_distributed_response(p_questionnaire_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.open_distributed_response(p_questionnaire_id uuid) TO "service_role";

CREATE OR REPLACE FUNCTION public.read_distributed_response(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.read_distributed_response(p_questionnaire_id) $function$;

REVOKE ALL ON FUNCTION public.read_distributed_response(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.read_distributed_response(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION public.read_distributed_response(p_questionnaire_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.read_distributed_response(p_questionnaire_id uuid) TO "service_role";

CREATE OR REPLACE FUNCTION private.assert_distributed_response_access(p_questionnaire_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) or not exists(select 1 from public.questionnaires v join public.questionnaires q on q.id=v.id where v.id=p_questionnaire_id and v.status='distributed' and q.archived_at is null) then raise exception 'Distributed response access denied' using errcode='42501'; end if;
 -- New placement distribution remains intentionally disabled at this stage.
 if exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id and source_question_id is not null) then raise exception 'Placement distribution is not supported' using errcode='22023'; end if;
end $function$;

REVOKE ALL ON FUNCTION private.assert_distributed_response_access(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.assert_distributed_response_access(p_questionnaire_id uuid) TO "postgres";

CREATE OR REPLACE FUNCTION private.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; s public.response_sessions%rowtype; payload jsonb; item record; q record; f jsonb; val text; readable text;
begin
 if p_save_id is null or p_revision is null or p_revision<0 or p_complete is null or length(p_free_response)>20000 or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid answers' using errcode='22023'; end if;
 sid:=private.open_distributed_response(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid for update;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete,'freeResponse',coalesce(p_free_response,s.free_response));
 if s.last_save_id=p_save_id and (s.last_payload||jsonb_build_object('freeResponse',s.free_response))=payload then return private.read_distributed_response(p_questionnaire_id); end if;
 if s.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Answer conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.question_responses where session_id=sid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_answers) loop
 select r.id,r.origin_placement_id,v.definition into q from public.question_responses r join public.question_versions v on v.id=r.question_version_id where r.session_id=sid and r.origin_placement_id::text=item.key;
 if not found or jsonb_typeof(item.value) is distinct from 'string' then raise exception 'Invalid question' using errcode='22023'; end if;
 f:=q.definition#>'{fields,0}'; val:=item.value#>>'{}';
 if not private.question_field_response_valid(f,val,p_complete) then raise exception 'Invalid answer for question type' using errcode='22023'; end if;
 readable:=case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(f->'scaleConfig',val) else private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) end;
 update public.question_responses set rows=jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(item.key,val))),active_row_ids='[1]',body=readable,updated_at=now() where id=q.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,free_response=coalesce(p_free_response,s.free_response),status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=sid;
 return private.read_distributed_response(p_questionnaire_id);
end $function$;

REVOKE ALL ON FUNCTION private.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "postgres";

GRANT EXECUTE ON FUNCTION private.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "authenticated";

CREATE OR REPLACE FUNCTION public.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.save_distributed_response(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,p_free_response) $function$;

REVOKE ALL ON FUNCTION public.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "postgres";

GRANT EXECUTE ON FUNCTION public.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "authenticated";

GRANT EXECUTE ON FUNCTION public.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text) TO "service_role";

CREATE OR REPLACE FUNCTION private.read_distributed_response(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype;
begin
 perform private.assert_distributed_response_access(p_questionnaire_id);
 select * into s from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid();
 return jsonb_build_object('revision',coalesce(s.revision,0),'status',coalesce(s.status,'assigned'),'savedAt',case when s.revision>0 then s.updated_at else null end,'freeResponse',coalesce(s.free_response,''),'answers',coalesce((select jsonb_object_agg(r.origin_placement_id::text,coalesce(r.rows#>>array['0','answers',r.origin_placement_id::text],'')) from public.question_responses r where r.session_id=s.id),'{}'::jsonb));
end $function$;

REVOKE ALL ON FUNCTION private.read_distributed_response(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.read_distributed_response(p_questionnaire_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION private.read_distributed_response(p_questionnaire_id uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION private.validate_questionnaire_placements(p_questionnaire_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

REVOKE ALL ON FUNCTION private.validate_questionnaire_placements(p_questionnaire_id uuid) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION private.validate_questionnaire_placements(p_questionnaire_id uuid) TO "postgres";

CREATE POLICY "Read visible sections" ON "public"."questionnaire_sections" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM questionnaires v
  WHERE (v.id = questionnaire_sections.questionnaire_id))));

CREATE POLICY "Record own visible publication" ON "public"."questionnaire_publication_reads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_consultant_lead() AS is_consultant_lead)) AND (EXISTS ( SELECT 1
   FROM (questionnaires v
     JOIN public.questionnaires q ON ((q.id = v.id)))
  WHERE ((v.id = questionnaire_publication_reads.questionnaire_id) AND (v.status = 'published'::text) AND (q.archived_at IS NULL))))));

CREATE POLICY "Read visible questions" ON "public"."questionnaire_questions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM questionnaires v
  WHERE (v.id = questionnaire_questions.questionnaire_id))));

CREATE POLICY "Own response question versions" ON "public"."question_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (question_responses r
     JOIN response_sessions s ON ((s.id = r.session_id)))
  WHERE ((r.question_version_id = question_versions.id) AND (s.respondent_id = ( SELECT auth.uid() AS uid))))));

CREATE TRIGGER reject_deleted_questionnaire BEFORE INSERT ON public.questionnaires FOR EACH ROW EXECUTE FUNCTION private.reject_deleted_questionnaire();

update private.questionnaire_status_requests set result=(result-'versionId'-'copied') || jsonb_build_object('questionnaireId',result->'versionId') where result ? 'versionId';

drop view private.questionnaire_owners;
ALTER TRIGGER questionnaire_version_changed ON public.questionnaires RENAME TO questionnaire_changed;
notify pgrst,'reload schema';
commit;