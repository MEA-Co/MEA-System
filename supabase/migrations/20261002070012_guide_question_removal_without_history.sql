begin;
set local lock_timeout='10s';
create or replace function private.questionnaire_guide_question_ids(qid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.questionnaires where id=qid and (created_by=auth.uid() or private.is_admin())) then raise exception 'Questionnaire author required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(distinct v.question_id) from public.question_responses r join public.question_versions v on v.id=r.question_version_id join public.response_sessions s on s.id=r.session_id where s.origin_questionnaire_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' and exists(select 1 from jsonb_array_elements(r.rows) row cross join lateral jsonb_each_text(row->'answers') a where btrim(private.question_search_plain(a.value))<>'')),'[]');
end $$;
revoke all on function private.questionnaire_guide_question_ids(uuid) from public,anon;
grant execute on function private.questionnaire_guide_question_ids(uuid) to authenticated;
create or replace function public.questionnaire_guide_question_ids(qid uuid) returns jsonb language sql stable set search_path='' as $$ select private.questionnaire_guide_question_ids(qid); $$;
revoke all on function public.questionnaire_guide_question_ids(uuid) from public,anon;
grant execute on function public.questionnaire_guide_question_ids(uuid) to authenticated;

create or replace function private.remove_unplaced_guide_answers(qid uuid) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid; deleted_count integer;
begin
 select id into sid from public.response_sessions where origin_questionnaire_id=qid and respondent_id=private.guide_consultant_id() and started_stage='published' for update;
 if sid is null then return; end if;
 update public.question_responses set referenced_response_id=null where session_id=sid and referenced_response_id in (
 select r.id from public.question_responses r join public.question_versions v on v.id=r.question_version_id where r.session_id=sid and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=qid and p.source_question_id=v.question_id));
 delete from public.question_responses r using public.question_versions v where r.question_version_id=v.id and r.session_id=sid and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=qid and p.source_question_id=v.question_id);
 get diagnostics deleted_count=row_count;
 if deleted_count>0 then update public.response_sessions set revision=revision+1,last_payload=null,last_save_id=null,updated_at=now() where id=sid;end if;
end $$;
revoke all on function private.remove_unplaced_guide_answers(uuid) from public,anon,authenticated;

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
 if published and exists(select 1 from public.response_sessions s join public.question_versions v on v.id=old.question_version_id where s.id=old.session_id and s.respondent_id=private.guide_consultant_id() and s.origin_questionnaire_id is not null and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=s.origin_questionnaire_id and p.source_question_id=v.question_id)) then return old; end if;
 if published and exists(select 1 from public.question_versions v join public.questions q on q.id=v.question_id where v.id=old.question_version_id and q.archived_at is not null) then return old; end if;
 raise exception 'Response history is preserved' using errcode='55000';
 end if;
 if new.legacy_answer is distinct from old.legacy_answer or new.session_id<>old.session_id or (new.question_version_id<>old.question_version_id and (not published or (select question_id from public.question_versions where id=new.question_version_id) is distinct from (select question_id from public.question_versions where id=old.question_version_id))) or (not published and exists(select 1 from public.response_sessions where id=old.session_id and status='submitted')) then raise exception 'Response locked' using errcode='55000'; end if;
 end if; return new;
end $function$;

CREATE OR REPLACE FUNCTION private.read_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; qs jsonb; sections jsonb; sid uuid; begin
 sid:=private.sync_published_response_layout(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid;
 select coalesce(jsonb_agg(jsonb_build_object('responseId',r.id,'questionVersionId',v.id,'definition',d.def,'rows',private.prune_guide_fields(r.rows,v.definition->'fields',d.def->'fields'),'activeRowIds',r.active_row_ids) order by r.id),'[]') into qs
 from public.question_responses r join public.question_versions v on v.id=r.question_version_id cross join lateral (select private.live_response_definition(v.question_id) def) d where r.session_id=s.id and d.def is not null and exists(select 1 from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p where p->>'sourceQuestionId'=v.question_id::text);
 select coalesce(jsonb_agg(sec.value||jsonb_build_object('questions',coalesce((select jsonb_agg(p.value order by p.ord) from jsonb_array_elements(sec.value->'questions') with ordinality p(value,ord) where exists(select 1 from jsonb_array_elements(qs) q where q#>>'{definition,id}'=p.value->>'sourceQuestionId')),'[]')) order by sec.ord),'[]') into sections from jsonb_array_elements(s.layout) with ordinality sec(value,ord);
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'sections',sections,'questions',qs,'definitionToken',md5(s.origin_title||sections::text||(select coalesce(jsonb_agg(q->'definition' order by q#>>'{definition,id}'),'[]')::text from jsonb_array_elements(qs) q)),'sourceDeleted',s.origin_questionnaire_id is null);
end $function$
;

CREATE OR REPLACE FUNCTION private.reconcile_guide_fields(qid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb; r record; cleaned jsonb; snapshot uuid;
begin
 d:=private.live_response_definition(qid);
 for r in select a.*,v.definition from public.question_responses a join public.question_versions v on v.id=a.question_version_id join public.response_sessions s on s.id=a.session_id where v.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' order by a.id for update of a loop
 cleaned:=private.prune_guide_fields(r.rows,r.definition->'fields',d->'fields');
 -- Row/condition changes retain their existing review policy; field edits do not reset other answers.
 snapshot:=r.question_version_id;
 insert into public.question_versions(question_id,source_revision,definition) values(qid,(d->>'revision')::int,d) on conflict(question_id,source_revision) do nothing;
 select id into snapshot from public.question_versions where question_id=qid and source_revision=(d->>'revision')::int;
 update public.question_responses set rows=cleaned,body=private.guide_rows_body(cleaned,d->'fields',r.active_row_ids),question_version_id=snapshot,
 previous_responses='[]'::jsonb,updated_at=now() where id=r.id;
 update public.response_sessions set revision=revision+1,last_save_id=null,last_payload=null,updated_at=now() where id=r.session_id;
 end loop;
end $function$
;

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
 update public.question_responses set previous_responses='[]'::jsonb,question_version_id=saved_version,rows=rows_data,active_row_ids=ids,body=body_text,updated_at=now() where id=r.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=s.id;
 return private.read_question_response_session(p_questionnaire_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  update public.questionnaires set title=p_document->>'title', revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $function$
;

-- Remove obsolete guide answer history, without touching distributed consultant responses.
update public.question_responses r set previous_responses='[]'::jsonb from public.response_sessions s where s.id=r.session_id and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' and r.previous_responses<>'[]'::jsonb;
do $$ declare target uuid; begin
 for target in select distinct s.origin_questionnaire_id from public.response_sessions s join public.questionnaires q on q.id=s.origin_questionnaire_id where s.respondent_id=private.guide_consultant_id() and s.started_stage='published' loop
 perform private.remove_unplaced_guide_answers(target);
 end loop;
end $$;
do $$ declare qid uuid; begin
 for qid in select distinct v.question_id from public.question_versions v join public.question_responses r on r.question_version_id=v.id join public.response_sessions s on s.id=r.session_id join public.questions q on q.id=v.question_id where s.respondent_id=private.guide_consultant_id() and s.started_stage='published' and q.archived_at is null loop
 perform private.reconcile_guide_fields(qid);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
