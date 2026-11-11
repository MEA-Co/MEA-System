begin;
set local lock_timeout = '5s';

-- Source placement IDs are stable across environments even if a source question
-- has a local copy. Each placement gets an independent week-six check question.
do $$
declare
  target constant uuid := 'ffc36b8c-73b7-4664-975b-2263b064b066';
  sources constant uuid[] := array[
    'dbc59647-e728-4d17-b312-b12fd2c8cd82','6e67447a-1c1b-4e09-aab9-7c3dd1e702cf',
    '01832b27-3408-409d-a635-bd4a913562f2','b1720f78-4fbe-4666-be11-1a3df1662881',
    '0a85bc9a-d336-45df-99e1-1a2032a40500']::uuid[];
  owner_id uuid;
  week integer;
  section_id uuid;
  source record;
begin
  -- A fresh schema-only database has no programme or questionnaire authors.
  if not exists(select from public.questionnaires where id=any(sources)) then return; end if;
  if (select count(*) from public.questionnaires where id=any(sources) and status='published' and archived_at is null) <> 5 then
    raise exception 'Expected five published source questionnaires';
  end if;
  select created_by into strict owner_id from public.questionnaires where id=sources[5];
  insert into public.questionnaires(id,title,status,created_by,review_started_at)
    values(target,'6주차: 이전 답변 활용 점검','in_review',owner_id,now());
  for week in 1..5 loop
    insert into public.questionnaire_sections(questionnaire_id,title,position)
      select target,title,week-1 from public.questionnaires where id=sources[week]
      returning id into section_id;
    for source in
      select p.id as placement_id,q.title,q.prompt,q.fields,
        row_number() over(order by s.position,p.position)-1 as position
      from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id
      join public.questionnaire_sections s on s.id=p.section_id
      where p.questionnaire_id=sources[week] and q.purpose='response'
    loop
      insert into public.questions(id,created_by,title,prompt,fields,row_mode,revision,last_save_id,last_save_hash)
      values(source.placement_id,owner_id,source.title,source.prompt,
        (select jsonb_agg(jsonb_build_object('id',f->'id','label',f->'label','kind','text','required',false) order by ord)
         from jsonb_array_elements(source.fields) with ordinality fields(f,ord)),
        'single',1,gen_random_uuid(),md5(source.placement_id::text));
      insert into public.questionnaire_questions(questionnaire_id,section_id,position,source_question_id,body,kind,options,scale_config,choice_style,choice_allow_text)
      values(target,section_id,source.position,source.placement_id,null,null,null,null,null,null);
    end loop;
  end loop;
end $$;

create function private.week_six_answers(staff_view boolean) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare target constant uuid := 'ffc36b8c-73b7-4664-975b-2263b064b066';
begin
  if not exists (
    select from public.questionnaires v join public.profiles me on me.id=auth.uid()
    where v.id=target and v.archived_at is null and me.role in ('admin','consultant_lead','consultant')
      and (v.status='published' or (v.status='in_review' and staff_view and me.role in ('admin','consultant_lead')))
  ) then raise insufficient_privilege; end if;
  return (select coalesce(jsonb_object_agg(p.id,jsonb_build_object('fields',q.fields,'rows',(
    select coalesce(jsonb_agg(r order by ord),'[]') from jsonb_array_elements(a.answer->'rows') with ordinality rows(r,ord)
    where a.answer->'activeRowIds' @> jsonb_build_array(r->'id')
  ),'labels',q.row_labels)), '{}')
  from public.questionnaire_questions checks join public.questionnaire_questions p on p.id=checks.source_question_id
  join public.questions q on q.id=p.source_question_id
  join public.response_sessions s on s.origin_questionnaire_id=p.questionnaire_id and s.respondent_id=auth.uid() and s.started_stage='published'
  join public.response_submissions sub on sub.session_id=s.id
  cross join lateral (select sub.answers->q.id::text as answer) a
  where checks.questionnaire_id=target and p.questionnaire_id in (
    'dbc59647-e728-4d17-b312-b12fd2c8cd82','6e67447a-1c1b-4e09-aab9-7c3dd1e702cf',
    '01832b27-3408-409d-a635-bd4a913562f2','b1720f78-4fbe-4666-be11-1a3df1662881','0a85bc9a-d336-45df-99e1-1a2032a40500')
    and a.answer is not null);
end $$;
create function public.week_six_answers(staff_view boolean) returns jsonb
language sql stable security invoker set search_path='' as $$select private.week_six_answers(staff_view)$$;
revoke all on function private.week_six_answers(boolean),public.week_six_answers(boolean) from public,anon;
grant execute on function private.week_six_answers(boolean),public.week_six_answers(boolean) to authenticated;
notify pgrst,'reload schema';
commit;
