SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.read_guide_answers (
  p_question_ids uuid[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','consultant_lead','consultant')) then raise exception 'Guide answer access denied' using errcode='42501'; end if;
 if cardinality(p_question_ids)>500 then raise exception 'Too many questions' using errcode='22023'; end if;
 return coalesce((select jsonb_object_agg(q.id::text,jsonb_build_object('rows',shown.rows)) from public.questions q cross join lateral (
 select r.rows,r.active_row_ids from public.question_responses r join public.response_sessions s on s.id=r.session_id where r.question_id=q.id and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' order by r.updated_at desc,r.id limit 1
 
 ) a cross join lateral (
 select coalesce(jsonb_agg(jsonb_build_object('id',row.value->'id','label',coalesce(nullif(btrim(q.row_labels->>(row.ord::int-1)),''),row.ord::text),'answers',row.value->'answers') order by row.ord),'[]') rows
 from jsonb_array_elements(a.rows) with ordinality row(value,ord)
 where a.active_row_ids @> jsonb_build_array(row.value->'id')
 and exists(select 1 from jsonb_array_elements(q.fields) f where private.question_field_response_valid(f,coalesce(row.value->'answers'->>(f->>'id'),''),true))
 ) shown where q.id=any(p_question_ids) and q.archived_at is null and jsonb_array_length(shown.rows)>0 and (
   ((private.is_admin() or private.is_consultant_lead()) and (
     q.created_by=auth.uid() or private.is_admin() or exists(
       select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id
       where p.source_question_id=q.id and v.status='published' and v.archived_at is null
     )
   ))
   or exists(
     select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id
     where p.source_question_id=q.id and v.status='distributed' and v.archived_at is null
   )
 )),'{}');
end $function$;

