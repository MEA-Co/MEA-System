-- Operator-only import ledger. IDs intentionally have no foreign keys: this is
-- permanent provenance, not ownership; deleting a document must not erase it or
-- allow a retry to silently recreate previously imported data.
create table private.legacy_questionnaire_imports (
  source_version_id uuid primary key,
  source_revision integer not null,
  source_owner_id uuid not null,
  target_questionnaire_id uuid not null unique,
  target_version_id uuid not null unique,
  section_count integer not null,
  question_count integer not null,
  detail_count integer not null,
  mappings jsonb not null check (jsonb_typeof(mappings) = 'object'),
  imported_at timestamptz not null default now()
);
alter table private.legacy_questionnaire_imports enable row level security;
revoke all on private.legacy_questionnaire_imports from public, anon, authenticated, service_role;
comment on table private.legacy_questionnaire_imports is
  'Operator-only append-once legacy import provenance; no content or answer bodies. Never delete to retry an import.';

-- This is deliberately SECURITY INVOKER with no application-role grant.
-- Install this migration normally, then call from the operator SQL session.
-- Installing it alone never copies environment-specific production data.
create function private.import_legacy_text_questionnaire(
  p_source_version_id uuid,
  p_expected_question_count integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  source_version public.questionnaire_versions%rowtype;
  source_parent public.questionnaires%rowtype;
  previous private.legacy_questionnaire_imports%rowtype;
  s record; q record; d record;
  target_parent_id uuid := gen_random_uuid();
  target_version_id uuid := gen_random_uuid();
  target_section_id uuid; target_question_id uuid; target_field_id uuid;
  target_placement_id uuid; target_detail_id uuid;
  target_title text;
  section_map jsonb := '[]'; question_map jsonb := '[]'; detail_map jsonb := '[]';
  section_total integer := 0; question_total integer := 0; detail_total integer := 0;
  detail_position integer;
  question_document jsonb;
  original_snapshot jsonb;
  final_snapshot jsonb;
begin
  if p_source_version_id is null or p_expected_question_count is null
    or p_expected_question_count not between 1 and 5000 then
    raise exception 'Invalid import arguments' using errcode='22023';
  end if;
  -- Serialize retries and coordinate with source questionnaire save/publish/delete RPCs.
  perform pg_advisory_xact_lock(hashtextextended('legacy-questionnaire-import:' || p_source_version_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended(p_source_version_id::text,0));
  select * into previous from private.legacy_questionnaire_imports where source_version_id=p_source_version_id;
  if found then
    if previous.question_count <> p_expected_question_count then
      raise exception 'Import count differs from previous import' using errcode='22023';
    end if;
    if not exists(select 1 from public.questionnaire_versions where id=previous.target_version_id) then
      raise exception 'Imported draft was deleted; inspect import ledger instead of recreating it' using errcode='55000';
    end if;
    return jsonb_build_object('status','already_imported','sourceVersionId',p_source_version_id,
      'targetQuestionnaireId',previous.target_questionnaire_id,'targetVersionId',previous.target_version_id,
      'sections',previous.section_count,'questions',previous.question_count,'details',previous.detail_count);
  end if;
  select * into source_version from public.questionnaire_versions where id=p_source_version_id for update;
  if not found then raise exception 'Source questionnaire not found' using errcode='P0002'; end if;
  select * into source_parent from public.questionnaires where id=source_version.questionnaire_id for update;
  if source_version.status <> 'published' or source_parent.archived_at is not null then
    raise exception 'Expected an active published source questionnaire' using errcode='55000';
  end if;
  if not exists(select 1 from public.profiles where id=source_parent.created_by and role in ('admin','consultant_lead')) then
    raise exception 'Source creator cannot manage the new draft; choose ownership before importing' using errcode='22023';
  end if;
  if exists(select 1 from public.questionnaire_responses where version_id=p_source_version_id)
    or exists(select 1 from public.questionnaire_answers where version_id=p_source_version_id) then
    raise exception 'Source has response data; a separate response migration plan is required' using errcode='55000';
  end if;
  if (select count(*) from public.questionnaire_questions where version_id=p_source_version_id) <> p_expected_question_count then
    raise exception 'Source question count changed; inspect before importing' using errcode='22023';
  end if;
  if exists(select 1 from public.questionnaire_questions where version_id=p_source_version_id
    and (source_question_id is not null or kind <> 'text' or options <> '[]'::jsonb or choice_allow_text)) then
    raise exception 'Import supports only unplaced legacy text questions' using errcode='22023';
  end if;
  if exists(select 1 from public.questionnaire_questions where version_id=p_source_version_id
    and (btrim(body)='' or char_length(body)>10000)) then
    raise exception 'Question is blank or exceeds the new 10000-character limit; no content was truncated' using errcode='22023';
  end if;
  if exists(select 1 from public.questionnaire_questions q0 where q0.version_id=p_source_version_id
      and (select count(*) from public.questionnaire_question_details d0 where d0.question_id=q0.id)>20)
    or exists(select 1 from public.questionnaire_question_details d0
      join public.questionnaire_questions q0 on q0.id=d0.question_id where q0.version_id=p_source_version_id
      and (char_length(d0.title)>200 or char_length(d0.body)>10000)) then
    raise exception 'Explanation exceeds new limits (20 items, title 200, body 10000); no content was truncated' using errcode='22023';
  end if;
  if (select count(*) from public.questionnaire_sections where version_id=p_source_version_id) not between 1 and 50
    or exists(select 1 from public.questionnaire_sections s0 where s0.version_id=p_source_version_id
      and (select count(*) from public.questionnaire_questions q0 where q0.section_id=s0.id)>100) then
    raise exception 'Source exceeds editor section/question limits' using errcode='22023';
  end if;
  target_title := source_version.title || ' · 전환본';
  if char_length(target_title)>500 then
    raise exception 'Converted questionnaire title exceeds 500 characters' using errcode='22023';
  end if;

  -- Source version lock blocks all supported content mutation RPCs. Hold child
  -- row locks too, and compare source rows byte-for-byte before returning.
  perform 1 from public.questionnaire_sections where version_id=p_source_version_id for share;
  perform 1 from public.questionnaire_questions where version_id=p_source_version_id for share;
  perform 1 from public.questionnaire_question_details where question_id in
    (select id from public.questionnaire_questions where version_id=p_source_version_id) for share;
  select jsonb_build_object('version',to_jsonb(source_version),'parent',to_jsonb(source_parent),
    'sections',(select jsonb_agg(to_jsonb(x) order by x.id) from public.questionnaire_sections x where version_id=p_source_version_id),
    'questions',(select jsonb_agg(to_jsonb(x) order by x.id) from public.questionnaire_questions x where version_id=p_source_version_id),
    'details',(select jsonb_agg(to_jsonb(x) order by x.id) from public.questionnaire_question_details x where question_id in
      (select id from public.questionnaire_questions where version_id=p_source_version_id))) into original_snapshot;

  insert into public.questionnaires(id,created_by) values(target_parent_id,source_parent.created_by);
  insert into public.questionnaire_versions(id,questionnaire_id,title,status,revision)
    values(target_version_id,target_parent_id,target_title,'draft',1);
  for s in select * from public.questionnaire_sections where version_id=p_source_version_id order by position loop
    target_section_id:=gen_random_uuid();
    insert into public.questionnaire_sections(id,version_id,title,position)
      values(target_section_id,target_version_id,s.title,s.position);
    section_map:=section_map || jsonb_build_array(jsonb_build_object('sourceSectionId',s.id,'targetSectionId',target_section_id));
    section_total:=section_total+1;
    for q in select * from public.questionnaire_questions where section_id=s.id order by position loop
      target_question_id:=gen_random_uuid(); target_field_id:=gen_random_uuid(); target_placement_id:=gen_random_uuid();
      question_document:=jsonb_build_object('id',target_question_id,'title','','prompt',q.body,
        'fields',jsonb_build_array(jsonb_build_object('id',target_field_id,'label','답변','kind','text')),
        'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
      -- Direct operator inserts preserve the exact stored rich-text/whitespace;
      -- ordinary save_question trims prompt text. All normal validation triggers run.
      insert into public.questions(id,created_by,title,prompt,fields,row_mode,max_rows,
        source_block_id,source_field_id,after_block_id,condition,revision,last_save_id,last_save_hash)
      values(target_question_id,source_parent.created_by,'',q.body,question_document->'fields','single',null,
        null,null,null,null,1,gen_random_uuid(),md5(question_document::text));
      insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position,source_question_id)
        values(target_placement_id,target_version_id,target_section_id,gen_random_uuid(),q.body,q.position,target_question_id);
      question_map:=question_map || jsonb_build_array(jsonb_build_object('sourceQuestionId',q.id,
        'sourceLogicalKey',q.logical_key,'targetQuestionId',target_question_id,'targetFieldId',target_field_id,'targetPlacementId',target_placement_id));
      question_total:=question_total+1;
      detail_position:=0;
      for d in select * from public.questionnaire_question_details where question_id=q.id order by position loop
        target_detail_id:=gen_random_uuid();
        insert into public.question_details(id,question_id,position,title,body,visible_to_consultants)
          values(target_detail_id,target_question_id,detail_position,d.title,d.body,d.visible_to_consultants);
        detail_map:=detail_map || jsonb_build_array(jsonb_build_object('sourceDetailId',d.id,'targetDetailId',target_detail_id,'sourceAuthorId',d.created_by));
        detail_position:=detail_position+1; detail_total:=detail_total+1;
      end loop;
    end loop;
  end loop;
  if question_total <> p_expected_question_count or section_total=0 then
    raise exception 'Imported counts did not match' using errcode='22023';
  end if;
  perform private.validate_questionnaire_placements(target_version_id);
  select jsonb_build_object('version',(select to_jsonb(x) from public.questionnaire_versions x where id=p_source_version_id),
    'parent',(select to_jsonb(x) from public.questionnaires x where id=source_version.questionnaire_id),
    'sections',(select jsonb_agg(to_jsonb(x) order by x.id) from public.questionnaire_sections x where version_id=p_source_version_id),
    'questions',(select jsonb_agg(to_jsonb(x) order by x.id) from public.questionnaire_questions x where version_id=p_source_version_id),
    'details',(select jsonb_agg(to_jsonb(x) order by x.id) from public.questionnaire_question_details x where question_id in
      (select id from public.questionnaire_questions where version_id=p_source_version_id))) into final_snapshot;
  if final_snapshot is distinct from original_snapshot then
    raise exception 'Source changed during import' using errcode='40001';
  end if;
  insert into private.legacy_questionnaire_imports(source_version_id,source_revision,source_owner_id,
    target_questionnaire_id,target_version_id,section_count,question_count,detail_count,mappings)
  values(p_source_version_id,source_version.revision,source_parent.created_by,target_parent_id,target_version_id,
    section_total,question_total,detail_total,jsonb_build_object('sections',section_map,'questions',question_map,'details',detail_map));
  return jsonb_build_object('status','imported','sourceVersionId',p_source_version_id,
    'targetQuestionnaireId',target_parent_id,'targetVersionId',target_version_id,
    'sections',section_total,'questions',question_total,'details',detail_total);
end $$;
revoke all on function private.import_legacy_text_questionnaire(uuid,integer) from public, anon, authenticated, service_role;
