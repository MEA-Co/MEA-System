begin;
set local lock_timeout = '5s';

alter table public.questionnaire_questions add column show_admission_reference boolean not null default false;

-- Extend the existing revision-checked placement save and read contracts.
do $$
declare def text; sig text; needle text;
begin
  def := pg_get_functiondef('private.save_questionnaire_draft(jsonb,integer,uuid)'::regprocedure);
  needle := '      qi := qi+1;';
  if strpos(def,needle)=0 then raise exception 'Unexpected placement save'; end if;
  execute replace(def,needle,$patch$
      update public.questionnaire_questions
      set show_admission_reference=coalesce((q->>'showAdmissionReference')::boolean,false)
      where id=(q->>'id')::uuid and show_admission_reference is distinct from coalesce((q->>'showAdmissionReference')::boolean,false);
$patch$ || needle);
  foreach sig in array array['public.read_questionnaire_draft(uuid)','public.read_shared_questionnaire(uuid)'] loop
    def := pg_get_functiondef(sig::regprocedure);
    needle := '''sourceQuestionId'',q.source_question_id';
    if strpos(def,needle)=0 then raise exception 'Unexpected draft projection %',sig; end if;
    execute replace(def,needle,needle || ',''showAdmissionReference'',nullif(q.show_admission_reference,false)');
  end loop;
  foreach sig in array array['private.read_published_question_response_session(uuid)','private.read_review_response_session(uuid)'] loop
    def := pg_get_functiondef(sig::regprocedure);
    needle := 'jsonb_agg(p.value order by p.ord)';
    if strpos(def,needle)=0 then raise exception 'Unexpected layout projection %',sig; end if;
    execute replace(def,needle,$patch$jsonb_agg(p.value || case when exists (
      select 1 from public.questionnaire_questions placement where placement.id=(p.value->>'id')::uuid
      and placement.questionnaire_id=s.origin_questionnaire_id and placement.show_admission_reference
    ) then '{"showAdmissionReference":true}'::jsonb else '{}'::jsonb end order by p.ord)$patch$);
  end loop;
end $$;

-- Freeze the first nonempty reference shown in a respondent's new session.
create table private.admission_response_references (
  session_id uuid primary key references public.response_sessions(id) on delete cascade,
  reference jsonb not null
);
revoke all on private.admission_response_references from public, anon, authenticated;
alter table private.admission_response_references enable row level security;

create function private.my_admission_reference(qid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  target uuid;
  result jsonb;
  source_question constant uuid := '3a3cd262-3a54-4368-a673-86ee98dc76c5';
  field_ids constant text[] := array[
    'd7c984ab-a43d-451c-87ba-d9c639ae20b5','36efb8c2-8514-4b07-a9f1-14792dcafb35',
    'a8a385da-5515-47b0-be83-154a0aa251a7','784a6d78-43fd-4f3f-8065-ee3059c076a2',
    '792e0865-12ec-4637-a31b-76f268e1cf37','8487da4e-00eb-4faa-837f-bed192b78469'];
begin
  target := private.owned_published_question_session(qid);
  if not exists(select 1 from public.questionnaire_questions where questionnaire_id=qid and show_admission_reference) then
    raise exception 'Reference not enabled' using errcode='42501';
  end if;
  select reference into result from private.admission_response_references where session_id=target;
  if found then return result; end if;
  select jsonb_build_object('fields',(select jsonb_agg(f order by ord) from jsonb_array_elements(q.fields) with ordinality fields(f,ord) where f->>'id'=any(field_ids)),
    'rows',(select jsonb_agg(jsonb_build_object('id',r->'id','answers',(select jsonb_object_agg(key,value)
      from jsonb_each(r->'answers') where key=any(field_ids))) order by ord)
      from jsonb_array_elements(a->'rows') with ordinality rows(r,ord)
      where a->'activeRowIds' @> jsonb_build_array(r->'id') and (r->'answers') ?| field_ids))
  into result from public.response_sessions s join public.response_submissions sub on sub.session_id=s.id
  join public.questions q on q.id=source_question
  cross join lateral (select sub.answers->source_question::text as a) answer
  where s.respondent_id=auth.uid() and s.started_stage='published'
    and s.origin_questionnaire_id='dbc59647-e728-4d17-b312-b12fd2c8cd82';
  if result->>'rows' is null then return null; end if;
  insert into private.admission_response_references values(target,result) on conflict do nothing;
  return (select reference from private.admission_response_references where session_id=target);
end $$;
create function public.my_admission_reference(qid uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.my_admission_reference(qid) $$;
revoke all on function private.my_admission_reference(uuid), public.my_admission_reference(uuid) from public,anon;
grant execute on function private.my_admission_reference(uuid), public.my_admission_reference(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
