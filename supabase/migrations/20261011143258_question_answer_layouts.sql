-- Table and flow are presentations of the existing question fields and rows.
-- Spare blank rows never increase the number of required answers.
begin;
set local lock_timeout = '10s';

alter table public.questions
  add column answer_layout text not null default 'cards',
  add column initial_rows integer not null default 1,
  add constraint questions_answer_layout_valid check (
    answer_layout in ('cards', 'table', 'flow')
    and not (answer_layout = 'flow' and row_mode = 'reference')
  ),
  add constraint questions_initial_rows_valid check (
    initial_rows between 1 and 20
    and (case when row_mode = 'repeatable' then initial_rows <= max_rows
      else initial_rows = 1 end)
  );

-- Extend the existing field-settings check; its privileges remain unchanged.
do $$
declare definition text; needle text;
begin
  definition := pg_get_functiondef('private.question_editor_settings_valid(jsonb)'::regprocedure);
  needle := 'for v_field in select value from pg_catalog.jsonb_array_elements(p_fields) loop';
  if position(needle in definition) = 0 then
    raise exception 'Unexpected question_editor_settings_valid definition';
  end if;
  definition := replace(definition, needle, needle || E'\n    if v_field ? ''required'' and pg_catalog.jsonb_typeof(v_field->''required'') is distinct from ''boolean'' then\n      return false;\n    end if;');
  execute definition;
end $$;

-- Keep save_question authorization, distribution guards, revision and retry checks.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('private.save_question(jsonb,integer,uuid)'::regprocedure);
  if position('row_labels = coalesce(p_document->''rowLabels'', ''[]''::jsonb),' in definition) = 0
    or position('max_rows, min_rows, row_labels,' in definition) = 0
    or position('coalesce((p_document->>''minRows'')::integer, 1), coalesce(p_document->''rowLabels'', ''[]''::jsonb),' in definition) = 0 then
    raise exception 'Unexpected save_question definition';
  end if;
  definition := replace(definition,
    'row_labels = coalesce(p_document->''rowLabels'', ''[]''::jsonb),',
    'row_labels = coalesce(p_document->''rowLabels'', ''[]''::jsonb),
      answer_layout = coalesce(p_document->>''answerLayout'', ''cards''),
      initial_rows = coalesce((p_document->>''initialRows'')::integer, 1),');
  definition := replace(definition, 'max_rows, min_rows, row_labels,',
    'max_rows, min_rows, row_labels, answer_layout, initial_rows,');
  definition := replace(definition,
    'coalesce((p_document->>''minRows'')::integer, 1), coalesce(p_document->''rowLabels'', ''[]''::jsonb),',
    'coalesce((p_document->>''minRows'')::integer, 1), coalesce(p_document->''rowLabels'', ''[]''::jsonb),
      coalesce(p_document->>''answerLayout'', ''cards''), coalesce((p_document->>''initialRows'')::integer, 1),');
  execute definition;
end $$;

-- Published previews use an explicit source projection. Live/distributed response
-- definitions and list_questions_page already serialize the full question row.
do $$
declare definition text; needle text;
begin
  definition := pg_get_functiondef('private.read_published_question_sources(uuid)'::regprocedure);
  needle := '''min_rows'',q.min_rows,''row_labels'',q.row_labels,';
  if position(needle in definition) = 0 then
    raise exception 'Unexpected read_published_question_sources definition';
  end if;
  definition := replace(definition, needle,
    needle || E'\n        ''answer_layout'',q.answer_layout,''initial_rows'',q.initial_rows,');
  execute definition;
end $$;

-- Both response paths validate every submitted value before resolving conditions.
-- Preserve that validation and only adjust completion and active row selection.
do $$
declare
  signature text;
  definition text;
  needle text;
  required_check text;
begin
  foreach signature in array array[
    'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);

    needle := 'ids:=ids||jsonb_build_array(row_data->''id''); source_ok:=false;';
    if position(needle in definition) = 0 then
      raise exception 'Unexpected active row selection in %', signature;
    end if;
    definition := replace(definition, needle,
      case when signature like '%save_distributed_%' then 'if p_complete and not is_career_flow'
        else 'if p_complete' end || ' and exists (
   select 1 from jsonb_array_elements(r.def->''fields'') field_item
   where field_item->>''kind''<>''text''
     and btrim(coalesce(row_data->''answers''->>(field_item->>''id''),''''))<>''''
     and not private.question_field_response_valid(field_item,coalesce(row_data->''answers''->>(field_item->>''id''),''''),true)
 ) then raise exception ''Complete nonempty typed answers'' using errcode=''22023''; end if;
 if r.def->>''answer_layout'' in (''table'',''flow'') and not exists (
   select 1 from jsonb_array_elements(r.def->''fields'') field_item
   where private.question_field_response_valid(field_item,coalesce(row_data->''answers''->>(field_item->>''id''),''''),true)
 ) then continue; end if;' || E'\n ' || needle);

    required_check := case when signature like '%save_distributed_%' then
      'if p_complete and not is_career_flow and not private.question_field_response_valid(f,val,true) then'
    else
      'if p_complete and not private.question_field_response_valid(f,val,true) then'
    end;
    if position(required_check in definition) = 0 then
      raise exception 'Unexpected completion check in %', signature;
    end if;
    definition := replace(definition, required_check,
      case when signature like '%save_distributed_%' then 'if p_complete and not is_career_flow'
        else 'if p_complete' end ||
      ' and coalesce(r.def->>''answer_layout'',''cards'')<>''flow'' and coalesce((f->>''required'')::boolean,true) and not private.question_field_response_valid(f,val,true) then');

    if signature like '%save_distributed_%' then
      -- Keep blank period slots in the public submission so positional row labels
      -- retain their meaning. Inactive answers become empty placeholders; private
      -- input hidden by a condition must never be copied into the submission.
      needle := '(select jsonb_agg(x order by n) from jsonb_array_elements(answer.rows) with ordinality row(x,n) where answer.active_row_ids @> jsonb_build_array(x->''id''))';
      if position(needle in definition) = 0 then
        raise exception 'Unexpected submission row selection in %', signature;
      end if;
      definition := replace(definition, needle,
        '(select jsonb_agg(case when answer.active_row_ids @> jsonb_build_array(x->''id'') then x else jsonb_build_object(''id'',x->''id'',''answers'',''{}''::jsonb) end order by n)
   from jsonb_array_elements(answer.rows) with ordinality row(x,n)
   where answer.active_row_ids @> jsonb_build_array(x->''id'') or exists(select 1 from public.questions source where source.id=answer.question_id and source.answer_layout=''flow''))');
    end if;
    execute definition;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
