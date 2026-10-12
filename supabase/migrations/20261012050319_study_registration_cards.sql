-- Reusable study registration cards share question identities and distribution
-- locks, while contributing no answer fields, rows or completion requirements.
begin;
set local lock_timeout = '10s';

alter table public.questions
  add column purpose text not null default 'response',
  add column button_label text not null default '학습법 추가',
  add constraint questions_purpose_valid check (purpose in ('response','study_registration')),
  add constraint questions_button_label_valid check (
    button_label=btrim(button_label) and char_length(button_label) between 1 and 100
  ),
  add constraint questions_study_registration_settings_valid check (
    purpose<>'study_registration' or (
      fields='[]'::jsonb and row_mode='single' and answer_layout='cards'
      and max_rows is null and min_rows=1 and initial_rows=1 and row_labels='[]'::jsonb
      and source_block_id is null and source_field_id is null
      and after_block_id is null and condition is null
    )
  );

-- Preserve identity, creator checks, dependency serialization and cycle checks.
do $$
declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.validate_question()'::regprocedure);
  needle:='if tg_op = ''UPDATE'' then';
  if position(needle in definition)=0 then raise exception 'Unexpected validate_question update guard'; end if;
  definition:=replace(definition,needle,needle||E'\n    if new.purpose is distinct from old.purpose then\n      raise exception ''Question purpose is immutable'' using errcode=''55000'';\n    end if;');
  needle:='or pg_catalog.jsonb_array_length(new.fields) not between 1 and 20 then';
  if position(needle in definition)=0 then raise exception 'Unexpected validate_question field count'; end if;
  definition:=replace(definition,needle,
    'or (new.purpose=''response'' and pg_catalog.jsonb_array_length(new.fields) not between 1 and 20)
    or (new.purpose=''study_registration'' and pg_catalog.jsonb_array_length(new.fields)<>0) then');
  needle:='raise exception ''Question block dependency is unavailable'' using errcode = ''22023'';
    end if;';
  if position(needle in definition)=0 then raise exception 'Unexpected validate_question dependency guard'; end if;
  definition:=replace(definition,needle,needle||E'\n    if exists(select 1 from public.questions where id=v_ref and purpose=''study_registration'') then\n      raise exception ''Study registration cards cannot be answer dependencies'' using errcode=''22023'';\n    end if;');
  execute definition;
end $$;

-- Reject purpose conversion before the existing guide-answer deletion prompt.
-- CREATE OR REPLACE from the live definition retains ACLs, owner and role checks.
do $$
declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.save_question(jsonb,integer,uuid)'::regprocedure);
  needle:='if v_existing.archived_at is not null then
      raise exception ''Question block is archived'' using errcode = ''55000'';
    end if;';
  if position(needle in definition)=0 then raise exception 'Unexpected save_question archived guard'; end if;
  definition:=replace(definition,needle,needle||E'\n    if v_existing.purpose is distinct from coalesce(p_document->>''purpose'',''response'') then\n      raise exception ''Question purpose is immutable'' using errcode=''55000'';\n    end if;');
  needle:='answer_layout = coalesce(p_document->>''answerLayout'', ''cards''),';
  if position(needle in definition)=0 then raise exception 'Unexpected save_question layout update'; end if;
  definition:=replace(definition,needle,
    'purpose = coalesce(p_document->>''purpose'',''response''),
      button_label = btrim(coalesce(p_document->>''buttonLabel'',''학습법 추가'')),
      '||needle);
  needle:='row_labels, answer_layout, initial_rows,';
  if position(needle in definition)=0 then raise exception 'Unexpected save_question insert columns'; end if;
  definition:=replace(definition,needle,'row_labels, purpose, button_label, answer_layout, initial_rows,');
  needle:='coalesce(p_document->>''answerLayout'', ''cards''), coalesce((p_document->>''initialRows'')::integer, 1),';
  if position(needle in definition)=0 then raise exception 'Unexpected save_question insert values'; end if;
  definition:=replace(definition,needle,
    'coalesce(p_document->>''purpose'',''response''), btrim(coalesce(p_document->>''buttonLabel'',''학습법 추가'')),
      '||needle);
  execute definition;
end $$;

-- Other source definitions already serialize the complete questions row.
do $$
declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.read_published_question_sources(uuid)'::regprocedure);
  needle:='''fields'',q.fields,''row_mode'',q.row_mode,''max_rows'',q.max_rows,';
  if position(needle in definition)=0 then raise exception 'Unexpected published source projection'; end if;
  definition:=replace(definition,needle,
    '''purpose'',q.purpose,''button_label'',q.button_label,'||needle);
  execute definition;
end $$;

-- Response identity rows keep cards visible in snapshots and submitted views.
-- Card payloads must be exactly []; they never produce active answers or examples.
do $$
declare signature text; definition text; needle text;
begin
  foreach signature in array array[
    'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)'
  ] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    needle:='-- Session layout keeps only ordering/source IDs; definitions and answers belong to questions.';
    if position(needle in definition)=0 then raise exception 'Unexpected response layout in %',signature; end if;
    definition:=replace(definition,needle,
      'if p_complete and not exists (
   select 1 from jsonb_array_elements(s.layout) sec
   cross join lateral jsonb_array_elements(sec->''questions'') p
   join public.question_responses answer on answer.session_id=s.id and answer.origin_placement_id=(p->>''id'')::uuid
   join public.questions question on question.id=answer.question_id
   where question.purpose=''response'' and question.archived_at is null
 ) then raise exception ''Answer questions are required for completion'' using errcode=''22023''; end if;
 '||needle);
    needle:='rows_data:=p_answers->r.question_id::text;';
    if position(needle in definition)=0 then raise exception 'Unexpected response row payload in %',signature; end if;
    definition:=replace(definition,needle,needle||'
 if r.def->>''purpose''=''study_registration'' then
   if jsonb_typeof(rows_data) is distinct from ''array'' or rows_data<>''[]''::jsonb then
     raise exception ''Study registration cards accept no answer rows'' using errcode=''22023'';
   end if;
   active:=active||jsonb_build_object(r.question_id::text,''[]''::jsonb);
   update public.question_responses set rows=''[]''::jsonb,active_row_ids=''[]''::jsonb,body='''',updated_at=now() where id=r.id;
   continue;
 end if;');
    execute definition;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
