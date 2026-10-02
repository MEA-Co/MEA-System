begin;
set local lock_timeout='10s';
create or replace function private.guide_answer_field_ids(qid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.questions where id=qid and (created_by=auth.uid() or private.is_admin())) then raise exception 'Question author required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(distinct a.key) from public.question_responses r join public.question_versions v on v.id=r.question_version_id join public.response_sessions s on s.id=r.session_id cross join lateral jsonb_array_elements(r.rows) row cross join lateral jsonb_each_text(row->'answers') a where v.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' and btrim(private.question_search_plain(a.value))<>''),'[]');
end $$;
revoke all on function private.guide_answer_field_ids(uuid) from public,anon,authenticated;
grant execute on function private.guide_answer_field_ids(uuid) to authenticated;
create or replace function public.guide_answer_field_ids(qid uuid) returns jsonb language sql stable set search_path='' as $$ select private.guide_answer_field_ids(qid); $$;
revoke all on function public.guide_answer_field_ids(uuid) from public,anon;
grant execute on function public.guide_answer_field_ids(uuid) to authenticated;

create or replace function private.prune_guide_fields(answer_rows jsonb, old_fields jsonb, new_fields jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(row || jsonb_build_object('answers',coalesce((select jsonb_object_agg(a.key,a.value) from jsonb_each(row->'answers') a where exists(select 1 from jsonb_array_elements(old_fields) o join jsonb_array_elements(new_fields) n on n->>'id'=o->>'id' and n->>'kind'=o->>'kind' where o->>'id'=a.key)),'{}'::jsonb)) order by position),'[]'::jsonb) from jsonb_array_elements(answer_rows) with ordinality t(row,position);
$$;
revoke all on function private.prune_guide_fields(jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.guide_rows_body(answer_rows jsonb, fields jsonb, active_ids jsonb) returns text language sql stable set search_path='' as $$
 select coalesce(string_agg((row->>'id')||' · '||(f->>'label')||': '||case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(coalesce(f->'scaleConfig',jsonb_build_object('max',f->'scaleMax')),val) when f->>'kind' in ('single','multiple') then private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) else val end,E'\n' order by ri,fi),'')
 from jsonb_array_elements(answer_rows) with ordinality t(row,ri) cross join lateral jsonb_array_elements(fields) with ordinality x(f,fi) cross join lateral (select coalesce(row->'answers'->>(f->>'id'),'') val) a
 where active_ids @> jsonb_build_array(row->'id') and val<>'';
$$;
revoke all on function private.guide_rows_body(jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.reconcile_guide_fields(qid uuid) returns void language plpgsql security definer set search_path='' as $$
declare d jsonb; r record; cleaned jsonb; snapshot uuid;
begin
 d:=private.live_response_definition(qid);
 for r in select a.*,v.definition from public.question_responses a join public.question_versions v on v.id=a.question_version_id join public.response_sessions s on s.id=a.session_id where v.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' order by a.id for update of a loop
 cleaned:=private.prune_guide_fields(r.rows,r.definition->'fields',d->'fields');
 -- Row/condition changes retain their existing review policy; field edits do not reset other answers.
 snapshot:=r.question_version_id;
 if (private.response_structure(r.definition)-'fields')=(private.response_structure(d)-'fields')
 and not exists(select 1 from jsonb_array_elements(r.definition->'fields') old_field join jsonb_array_elements(d->'fields') new_field on old_field->>'id'=new_field->>'id' and old_field->>'kind'=new_field->>'kind'
 where (old_field-array['label','choiceStyle','explorationRecommended']) is distinct from (new_field-array['label','choiceStyle','explorationRecommended'])) then
 insert into public.question_versions(question_id,source_revision,definition) values(qid,(d->>'revision')::int,d) on conflict(question_id,source_revision) do nothing;
 select id into snapshot from public.question_versions where question_id=qid and source_revision=(d->>'revision')::int;
 end if;
 update public.question_responses set rows=cleaned,body=private.guide_rows_body(cleaned,d->'fields',r.active_row_ids),question_version_id=snapshot,
 previous_responses=coalesce((select jsonb_agg(h || jsonb_build_object('rows',private.prune_guide_fields(h->'rows',h#>'{definition,fields}',d->'fields'),'body',private.guide_rows_body(private.prune_guide_fields(h->'rows',h#>'{definition,fields}',d->'fields'),d->'fields',r.active_row_ids))) from jsonb_array_elements(r.previous_responses) h),'[]'),updated_at=now() where id=r.id;
 update public.response_sessions set revision=revision+1,last_save_id=null,last_payload=null,updated_at=now() where id=r.session_id;
 end loop;
end $$;
revoke all on function private.reconcile_guide_fields(uuid) from public,anon,authenticated;

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
    if v_existing.created_by <> auth.uid() and not private.is_admin() then
      raise exception 'Only author or admin can edit' using errcode = '42501';
    end if;
    if v_existing.archived_at is not null then
      raise exception 'Question block is archived' using errcode = '55000';
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
      row_mode = p_document->>'rowMode',
      max_rows = (p_document->>'maxRows')::integer,
      min_rows = coalesce((p_document->>'minRows')::integer, 1),
      row_labels = coalesce(p_document->'rowLabels', '[]'::jsonb),
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
      id, created_by, title, prompt, fields, row_mode, max_rows, min_rows, row_labels,
      source_block_id, source_field_id, after_block_id, condition,
      revision, last_save_id, last_save_hash
    ) values (
      v_id, auth.uid(), pg_catalog.btrim(p_document->>'title'), pg_catalog.btrim(p_document->>'prompt'),
      p_document->'fields', p_document->>'rowMode', (p_document->>'maxRows')::integer,
      coalesce((p_document->>'minRows')::integer, 1), coalesce(p_document->'rowLabels', '[]'::jsonb),
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
  perform private.reconcile_guide_fields(v_id);
  return pg_catalog.to_jsonb(v_saved) || jsonb_build_object('details', (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
      'text', d.body, 'visibleToConsultants', d.visible_to_consultants) order by d.position), '[]'::jsonb)
    from public.question_details d where d.question_id = v_id));
end $function$
;
notify pgrst,'reload schema';
commit;
