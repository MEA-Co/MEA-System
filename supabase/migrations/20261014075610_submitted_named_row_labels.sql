-- Preserve named non-flow row identity before submission drops inactive rows.
-- Editable rows still reject label/flow metadata; only the submitted projection changes.
do $migration$
declare
  definition text;
  needle constant text := 'then x else jsonb_build_object(''id'',x->''id'',''answers'',''{}''::jsonb)';
  replacement constant text := $replacement$then x || coalesce((
    select jsonb_build_object('label',coalesce(nullif(btrim(source.row_labels->>(n::integer-1)),''),'항목 '||n::text))
    from public.questions source
    where source.id=answer.question_id and source.answer_layout<>'flow'
      and jsonb_array_length(source.row_labels)>0
  ),'{}'::jsonb) else jsonb_build_object('id',x->'id','answers','{}'::jsonb)$replacement$;
begin
  definition := pg_get_functiondef('private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text)'::regprocedure);
  if position(replacement in definition)>0 then
    return;
  end if;
  if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then
    raise exception 'Unexpected submission function definition; review before applying';
  end if;
  execute replace(definition,needle,replacement);
end
$migration$;

-- Recover historical names only when the work session is exactly the submitted
-- revision and its complete active-row projection matches the snapshot. Never use
-- later private edits to reconstruct a historical answer or change submission time.
do $lock_sessions$
begin
  -- The save RPC takes the same session row lock. Re-read snapshots in the next
  -- statement after acquiring locks so a concurrent resubmission cannot be overwritten.
  perform 1 from public.response_sessions session
  where exists(select 1 from public.response_submissions sub
    where sub.session_id=session.id and sub.revision=session.revision)
  order by session.id for update;
end
$lock_sessions$;

with recoverable as (
  select sub.session_id, entry.key, entry.value,
    (select jsonb_agg(row.value || jsonb_build_object('label',
      coalesce(nullif(btrim(q.row_labels->>(row.ordinality::integer-1)),''),'항목 '||row.ordinality::text))
      order by row.ordinality)
     from jsonb_array_elements(r.rows) with ordinality row(value,ordinality)
     where r.active_row_ids @> jsonb_build_array(row.value->'id')) as labeled_rows
  from public.response_submissions sub
  join public.response_sessions session on session.id=sub.session_id and session.revision=sub.revision
  cross join lateral jsonb_each(sub.answers) entry
  join public.question_responses r on r.session_id=sub.session_id and r.id::text=entry.value->>'responseId'
  join public.questions q on q.id=r.question_id and q.id::text=entry.key
  where q.answer_layout<>'flow' and jsonb_array_length(q.row_labels)>0
    and entry.value->'activeRowIds'=r.active_row_ids
    and entry.value->'rows'=(
      select jsonb_agg(row.value order by row.ordinality)
      from jsonb_array_elements(r.rows) with ordinality row(value,ordinality)
      where r.active_row_ids @> jsonb_build_array(row.value->'id'))
), patches as (
  select session_id,jsonb_object_agg(key,jsonb_set(value,'{rows}',labeled_rows)) as answers
  from recoverable where labeled_rows is not null group by session_id
)
update public.response_submissions sub set answers=sub.answers || patches.answers
from patches where patches.session_id=sub.session_id;
