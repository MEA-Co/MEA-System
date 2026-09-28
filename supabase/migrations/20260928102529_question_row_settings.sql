alter table public.questions
  add column min_rows integer not null default 1,
  add column row_labels jsonb not null default '[]'::jsonb;

create function private.question_row_labels_valid(labels jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(labels) <> 'array' then false else
    jsonb_array_length(labels) <= 20 and not exists (
      select 1 from jsonb_array_elements(labels) entry
      where jsonb_typeof(entry) <> 'string' or char_length(entry #>> '{}') > 100
    ) end;
$$;
revoke all on function private.question_row_labels_valid(jsonb) from public, anon;
grant execute on function private.question_row_labels_valid(jsonb) to authenticated;
alter table public.questions add constraint questions_min_rows_valid
  check (min_rows between 1 and 20 and (row_mode <> 'repeatable' or min_rows <= max_rows)),
  add constraint questions_row_labels_valid check (private.question_row_labels_valid(row_labels));

-- Preserve the current save function's authorization, revision and retry behavior.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('private.save_question(jsonb,integer,uuid)'::regprocedure);
  if position('max_rows = (p_document->>''maxRows'')::integer,' in definition) = 0
    or position('row_mode, max_rows,' in definition) = 0 then
    raise exception 'Unexpected save_question definition';
  end if;
  definition := replace(definition,
    'max_rows = (p_document->>''maxRows'')::integer,',
    'max_rows = (p_document->>''maxRows'')::integer,
      min_rows = coalesce((p_document->>''minRows'')::integer, 1),
      row_labels = coalesce(p_document->''rowLabels'', ''[]''::jsonb),');
  definition := replace(definition, 'row_mode, max_rows,', 'row_mode, max_rows, min_rows, row_labels,');
  definition := replace(definition,
    'p_document->''fields'', p_document->>''rowMode'', (p_document->>''maxRows'')::integer,',
    'p_document->''fields'', p_document->>''rowMode'', (p_document->>''maxRows'')::integer,
      coalesce((p_document->>''minRows'')::integer, 1), coalesce(p_document->''rowLabels'', ''[]''::jsonb),');
  execute definition;
end $$;
notify pgrst, 'reload schema';
