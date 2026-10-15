-- Additive response contracts. No session, answer, submission or role changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$ begin if (select md5(pg_get_functiondef(oid)) from pg_proc where pronamespace='private'::regnamespace and proname='save_question') is distinct from 'e7461031c1a8bfaa731fab5a1ea71860' then raise exception 'Unexpected function drift: save_question'; end if; end $$;

do $$ begin if (select md5(pg_get_functiondef(oid)) from pg_proc where pronamespace='private'::regnamespace and proname='read_shared_question_sources') is distinct from 'a0cc8b901a3f34d32ce7d9ab648ad965' then raise exception 'Unexpected function drift: read_shared_question_sources'; end if; end $$;

do $$ begin if (select md5(pg_get_functiondef(oid)) from pg_proc where pronamespace='private'::regnamespace and proname='save_review_response_session') is distinct from 'b62c955b49eb36d9a041b50db46b1813' then raise exception 'Unexpected function drift: save_review_response_session'; end if; end $$;

do $$ begin if (select md5(pg_get_functiondef(oid)) from pg_proc where pronamespace='private'::regnamespace and proname='save_published_question_response_session') is distinct from '0acf2d8e170ad868f39a4ea3d122caa0' then raise exception 'Unexpected function drift: save_published_question_response_session'; end if; end $$;

alter table public.questions add column response_requirements jsonb;
comment on column public.questions.response_requirements is 'Optional question-owned completion preset; field IDs are remapped when importing a question.';

create function private.question_response_requirements_valid(rule jsonb, fields jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
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
revoke all on function private.question_response_requirements_valid(jsonb,jsonb) from public,anon;
grant execute on function private.question_response_requirements_valid(jsonb,jsonb) to authenticated,service_role;
alter table public.questions add constraint questions_response_requirements_check
 check (private.question_response_requirements_valid(response_requirements,fields));

-- Backfill the existing preset only. Lock and restore every affected trigger;
-- no timestamps, revisions, IDs, definitions or answers are rewritten.
lock table public.questions in access exclusive mode;
do $$
declare q public.questions%rowtype; rule jsonb := '{"kind":"career_flow","startFieldIds":["f4689fea-ba91-400f-82be-f0b1dbf185db","720f88bd-1ace-4b86-828f-5df7abbe0a10"],"admissionFieldId":"e75649e4-82f5-4175-8c14-2298c522a45d"}'; before_row jsonb;
begin
 select * into q from public.questions where id='5f6064ad-1dd6-4e0d-95dd-611ccacbce92';
 if not found then return; end if;
 if not private.question_response_requirements_valid(rule,q.fields) then raise exception 'Career flow fields differ; review before applying'; end if;
 if (select count(*) from pg_trigger where tgrelid='public.questions'::regclass and tgname in ('a_published_question_lock','validate_question','reconcile_guide_question_update') and tgenabled='O')<>3 then raise exception 'Unexpected question trigger state'; end if;
 before_row:=to_jsonb(q)-'response_requirements';
 alter table public.questions disable trigger a_published_question_lock;
 alter table public.questions disable trigger validate_question;
 alter table public.questions disable trigger reconcile_guide_question_update;
 update public.questions set response_requirements=rule where id=q.id;
 alter table public.questions enable trigger a_published_question_lock;
 alter table public.questions enable trigger validate_question;
 alter table public.questions enable trigger reconcile_guide_question_update;
 if (select to_jsonb(changed)-'response_requirements' from public.questions changed where id=q.id) is distinct from before_row then raise exception 'Unexpected career flow data change'; end if;
end $$;

create function private.assert_question_response_requirements(def jsonb, rows_data jsonb)
returns void language plpgsql immutable set search_path='' as $$
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
revoke all on function private.assert_question_response_requirements(jsonb,jsonb) from public,anon,authenticated;

-- Shared shape/type validation. Completion, conditions and permissions stay in
-- their existing save workflows. This helper reads no privileged data.
create function private.prepare_question_response_rows(def jsonb, rows_data jsonb, previous_rows jsonb)
returns jsonb language plpgsql set search_path='' as $$
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
end $$;
revoke all on function private.prepare_question_response_rows(jsonb,jsonb,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.save_question(p_document jsonb, p_expected_revision integer, p_save_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      raise exception 'Question block revision conflict' using errcode = '40001';
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
      raise exception 'Question block revision conflict' using errcode = '40001';
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
end $function$
;

CREATE OR REPLACE FUNCTION private.read_shared_question_sources(p_questionnaire_id uuid)
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
end $function$
;

CREATE OR REPLACE FUNCTION private.save_review_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if p_definition_token is distinct from current_token then raise exception 'Question definition changed' using errcode='40001'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Response conflict' using errcode='40001'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION private.save_published_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if p_definition_token is distinct from current_token then raise exception 'Question definition changed' using errcode='40001'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Response conflict' using errcode='40001'; end if;
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
end $function$
;
create function private.assert_submission_staff_access(qid uuid)
returns void language plpgsql stable security definer set search_path='' as $$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaires where id=qid and status='published' and archived_at is null) then raise exception 'Questionnaire not available' using errcode='42501'; end if;
end $$;
revoke all on function private.assert_submission_staff_access(uuid) from public,anon,authenticated;

create function private.read_submitted_response(qid uuid, sid uuid, expected_revision integer default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; actual_revision integer;
begin
 perform private.assert_submission_staff_access(qid);
 select sub.revision,jsonb_build_object('id',s.id,'revision',sub.revision,'respondentName',p.name,'submittedAt',sub.submitted_at,'title',s.origin_title,'sections',s.layout,'questions',
   (select coalesce(jsonb_agg(jsonb_build_object('questionId',a.key,'responseId',a.value->'responseId','rows',a.value->'rows','activeRowIds',a.value->'activeRowIds','definition',private.published_response_definition(a.key::uuid))),'[]') from jsonb_each(sub.answers) a))
 into actual_revision,result
 from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id join public.profiles p on p.id=s.respondent_id
 where s.id=sid and s.origin_questionnaire_id=qid and s.started_stage='published';
 if result is null then raise exception 'Submission not found' using errcode='P0002'; end if;
 if expected_revision is not null and actual_revision<>expected_revision then raise exception 'Submission changed during export' using errcode='40001'; end if;
 return result;
end $$;

create function private.read_submitted_response_page(qid uuid, page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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

-- One lightweight export manifest avoids duplicates/skips if a respondent
-- re-submits while the client would otherwise be paging through the list.
create function private.read_submitted_response_manifest(qid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin
 perform private.assert_submission_staff_access(qid);
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'revision',sub.revision) order by sub.submitted_at desc,s.id)
 from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id
 where s.origin_questionnaire_id=qid and s.started_stage='published'),'[]');
end $$;

create function public.read_submitted_response(qid uuid,sid uuid,expected_revision integer default null)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_submitted_response(qid,sid,expected_revision); $$;
create function public.read_submitted_response_page(qid uuid,page integer default 1)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_submitted_response_page(qid,page); $$;
create function public.read_submitted_response_manifest(qid uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_submitted_response_manifest(qid); $$;
revoke all on function private.read_submitted_response(uuid,uuid,integer),public.read_submitted_response(uuid,uuid,integer),
 private.read_submitted_response_page(uuid,integer),public.read_submitted_response_page(uuid,integer),
 private.read_submitted_response_manifest(uuid),public.read_submitted_response_manifest(uuid) from public,anon;
grant execute on function private.read_submitted_response(uuid,uuid,integer),public.read_submitted_response(uuid,uuid,integer),
 private.read_submitted_response_page(uuid,integer),public.read_submitted_response_page(uuid,integer),
 private.read_submitted_response_manifest(uuid),public.read_submitted_response_manifest(uuid) to authenticated,service_role;

-- The old whole-list RPC stays callable for rolling deployments. New clients
-- use summary/detail reads; neither path exposes unsubmitted working answers.
commit;
