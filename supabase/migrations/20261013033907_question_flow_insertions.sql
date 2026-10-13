-- Keep fixed flow periods stable while allowing named periods between them.
-- max_rows remains the fixed-period count; every response still has at most 20 rows.
begin;
set local lock_timeout = '10s';

create function private.question_flow_settings_valid(
  p_slots jsonb, p_layout text, p_mode text, p_max_rows integer
) returns boolean language plpgsql immutable set search_path = '' as $function$
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
end $function$;
revoke all on function private.question_flow_settings_valid(jsonb,text,text,integer) from public,anon;
grant execute on function private.question_flow_settings_valid(jsonb,text,text,integer) to authenticated,service_role,postgres;

alter table public.questions
  add column flow_insert_after jsonb not null default '[]'::jsonb,
  add constraint questions_flow_insert_after_valid check (
    private.question_flow_settings_valid(flow_insert_after,answer_layout,row_mode,max_rows)
  );

-- Pure validation/ordering helper. Existing response permissions remain in the
-- two save RPCs; this function neither reads tables nor creates response IDs.
create function private.prepare_question_flow_rows(
  p_definition jsonb, p_rows jsonb, p_existing_rows jsonb
) returns jsonb language plpgsql immutable set search_path = '' as $function$
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
end $function$;
revoke all on function private.prepare_question_flow_rows(jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.prepare_question_flow_rows(jsonb,jsonb,jsonb) to postgres;

create function private.question_flow_row_label(p_definition jsonb,p_row jsonb,p_position integer)
returns text language sql immutable set search_path = '' as $function$
  select case
    when p_definition->>'answer_layout'='flow' and p_row ? 'flowAfter'
      then coalesce(nullif(regexp_replace(p_row->>'label','^[[:space:]]+|[[:space:]]+$','','g'),''),'추가 시기')
    when p_definition->>'answer_layout'='flow' and p_row ? 'flowIndex'
      then coalesce(nullif(btrim(p_definition->'row_labels'->>((p_row->>'flowIndex')::integer-1)),''),p_row->>'flowIndex')
    else coalesce(nullif(btrim(p_definition->'row_labels'->>(p_position-1)),''),p_position::text)
  end;
$function$;
revoke all on function private.question_flow_row_label(jsonb,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function private.question_flow_row_label(jsonb,jsonb,integer) to postgres;

-- Preserve current collaboration/dependency/distribution guards and protect
-- stored period identities from a later change of the fixed-period count.
do $$
declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.validate_question()'::regprocedure);
  needle:='new.updated_at := now();';
  if position(needle in definition)=0 then raise exception 'Unexpected validate_question update anchor'; end if;
  definition:=replace(definition,needle,
    'if not private.question_flow_settings_valid(new.flow_insert_after,new.answer_layout,new.row_mode,new.max_rows) then
    raise exception ''Invalid flow insertion settings'' using errcode=''22023'';
  end if;
  if tg_op=''UPDATE'' and old.answer_layout=''flow''
    and (new.answer_layout is distinct from old.answer_layout
      or (case when new.row_mode=''repeatable'' then new.max_rows else 1 end)
        is distinct from (case when old.row_mode=''repeatable'' then old.max_rows else 1 end))
    and exists(select 1 from public.question_responses answer
      cross join lateral jsonb_array_elements(answer.rows) row_data
      where answer.question_id=old.id and (row_data ? ''flowIndex'' or row_data ? ''flowAfter'')) then
    raise exception ''Saved flow periods require their original layout and fixed period count'' using errcode=''55000'';
  end if;
  '||needle);
  execute definition;
end $$;

do $$
declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.save_question(jsonb,integer,uuid)'::regprocedure);
  needle:='initial_rows = coalesce((p_document->>''initialRows'')::integer, 1),';
  if position(needle in definition)=0 then raise exception 'Unexpected save_question initial_rows update'; end if;
  definition:=replace(definition,needle,needle||'
      flow_insert_after = case when coalesce(p_document->>''answerLayout'',''cards'')=''flow''
        then coalesce(p_document->''flowInsertAfter'',v_existing.flow_insert_after)
        else ''[]''::jsonb end,');
  needle:='row_labels, purpose, button_label, answer_layout, initial_rows,';
  if position(needle in definition)=0 then raise exception 'Unexpected save_question flow insert columns'; end if;
  definition:=replace(definition,needle,'row_labels, purpose, button_label, answer_layout, initial_rows, flow_insert_after,');
  needle:='coalesce(p_document->>''answerLayout'', ''cards''), coalesce((p_document->>''initialRows'')::integer, 1),';
  if position(needle in definition)=0 then raise exception 'Unexpected save_question flow insert values'; end if;
  definition:=replace(definition,needle,needle||E'\n      coalesce(p_document->''flowInsertAfter'', ''[]''::jsonb),');
  execute definition;

  definition:=pg_get_functiondef('private.read_published_question_sources(uuid)'::regprocedure);
  needle:='''answer_layout'',q.answer_layout,''initial_rows'',q.initial_rows,';
  if position(needle in definition)=0 then raise exception 'Unexpected published source flow projection'; end if;
  definition:=replace(definition,needle,needle||'''flow_insert_after'',q.flow_insert_after,');
  execute definition;
end $$;

do $$
declare signature text; definition text; needle text;
begin
  foreach signature in array array[
    'private.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)',
    'private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)'
  ] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    needle:='if r.def->>''row_mode''=''single'' and jsonb_array_length(rows_data)>1 or r.def->>''row_mode''=''repeatable'' and jsonb_array_length(rows_data)>(r.def->>''max_rows'')::int then raise exception ''Too many rows'' using errcode=''22023''; end if;';
    if position(needle in definition)=0 then raise exception 'Unexpected response row limit in %',signature; end if;
    definition:=replace(definition,needle,
      'rows_data:=private.prepare_question_flow_rows(r.def,rows_data,r.rows);
 if coalesce(r.def->>''answer_layout'',''cards'')<>''flow'' and (r.def->>''row_mode''=''single'' and jsonb_array_length(rows_data)>1
   or r.def->>''row_mode''=''repeatable'' and jsonb_array_length(rows_data)>(r.def->>''max_rows'')::int) then
   raise exception ''Too many rows'' using errcode=''22023'';
 end if;');
    needle:='ids:=ids||jsonb_build_array(row_data->''id''); source_ok:=false;';
    if position(needle in definition)=0 then raise exception 'Unexpected response active row anchor in %',signature; end if;
    definition:=replace(definition,needle,
      'if p_complete and row_data ? ''flowAfter'' and coalesce(row_data->>''label'','''') ~ ''^[[:space:]]*$'' then
   raise exception ''Name every answered inserted flow period'' using errcode=''22023'';
 end if;
 '||needle);
    needle:='(row_data->>''id'')||'' · ''||(f->>''label'')';
    if position(needle in definition)=0 then raise exception 'Unexpected response body label in %',signature; end if;
    definition:=replace(definition,needle,
      '(case when r.def->>''answer_layout''=''flow'' and (row_data ? ''flowIndex'' or row_data ? ''flowAfter'')
   then private.question_flow_row_label(r.def,row_data,1) else row_data->>''id'' end)||'' · ''||(f->>''label'')');
    if signature like '%save_distributed_%' then
      needle:='else jsonb_build_object(''id'',x->''id'',''answers'',''{}''::jsonb) end order by n)';
      if position(needle in definition)=0 then raise exception 'Unexpected inactive flow submission rows in %',signature; end if;
      definition:=replace(definition,needle,
        'else jsonb_build_object(''id'',x->''id'',''answers'',''{}''::jsonb)
   ||jsonb_strip_nulls(jsonb_build_object(''flowIndex'',x->''flowIndex'',''flowAfter'',x->''flowAfter'',
     ''label'',case when jsonb_array_length(answer.active_row_ids)>0 then x->''label''
       when x ? ''flowAfter'' then ''""''::jsonb else null end)) end order by n)');
    end if;
    execute definition;
  end loop;
end $$;

-- Return explicit period metadata for guide rendering and calculate names from
-- fixed indexes rather than the shifted ordinal positions after an insertion.
do $$
declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.read_guide_answers(uuid[])'::regprocedure);
  needle:='jsonb_build_object(''id'',row.value->''id'',''label'',coalesce(nullif(btrim(q.row_labels->>(row.ord::int-1)),''''),row.ord::text),''answers'',row.value->''answers'')';
  if position(needle in definition)=0 then raise exception 'Unexpected guide row label projection'; end if;
  definition:=replace(definition,needle,
    '(jsonb_build_object(''id'',row.value->''id'',''label'',private.question_flow_row_label(to_jsonb(q),row.value,row.ord::integer),''answers'',row.value->''answers'')
   ||jsonb_strip_nulls(jsonb_build_object(''flowIndex'',row.value->''flowIndex'',''flowAfter'',row.value->''flowAfter'')))');
  execute definition;
end $$;

notify pgrst, 'reload schema';
commit;
