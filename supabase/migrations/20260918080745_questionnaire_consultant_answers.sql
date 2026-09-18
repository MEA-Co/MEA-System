-- One stable response and one stable question-answer pair per consultant/version.
alter table public.questionnaire_responses
  add constraint questionnaire_response_person_version_key unique(respondent_id,version_id),
  add column revision integer not null default 0 check(revision >= 0),
  add column updated_at timestamptz not null default now(),
  add column last_save_id uuid,
  add column last_payload jsonb;

create function private.open_questionnaire_response(p_version_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid; rid uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) then
   raise exception 'Forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 select q.created_by into owner_id from public.questionnaire_versions v
 join public.questionnaires q on q.id=v.questionnaire_id
 where v.id=p_version_id and v.status='distributed' and q.archived_at is null;
 if not found then raise exception 'Unavailable questionnaire' using errcode='42501'; end if;
 insert into public.questionnaire_responses(version_id,respondent_id,assigned_by)
 values(p_version_id,auth.uid(),owner_id) on conflict(respondent_id,version_id) do nothing;
 select id into rid from public.questionnaire_responses where version_id=p_version_id and respondent_id=auth.uid();
 return rid;
end $$;
revoke all on function private.open_questionnaire_response(uuid) from public,anon,authenticated;
grant execute on function private.open_questionnaire_response(uuid) to authenticated;
create function public.open_questionnaire_response(p_version_id uuid)
returns uuid language sql security invoker set search_path='' as $$ select private.open_questionnaire_response(p_version_id); $$;
revoke all on function public.open_questionnaire_response(uuid) from public,anon;
grant execute on function public.open_questionnaire_response(uuid) to authenticated;

create function private.save_questionnaire_response(p_version_id uuid,p_answers jsonb,p_revision integer,p_save_id uuid,p_complete boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; r public.questionnaire_responses%rowtype; payload jsonb; item record;
begin
 if p_save_id is null or p_revision is null or p_revision<0 or p_complete is null
 or p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>600000 then
 raise exception 'Invalid answers' using errcode='22023'; end if;
 rid:=private.open_questionnaire_response(p_version_id);
 select * into r from public.questionnaire_responses where id=rid for update;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if r.last_save_id=p_save_id and r.last_payload=payload then
 return jsonb_build_object('revision',r.revision,'status',r.status,'savedAt',r.updated_at); end if;
 if r.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 if r.revision<>p_revision then raise exception 'Answer conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.questionnaire_questions where version_id=p_version_id) then
 raise exception 'Question set mismatch' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_answers) loop
 if jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>20000
 or not exists(select 1 from public.questionnaire_questions where id::text=item.key and version_id=p_version_id)
 or (p_complete and length(btrim(item.value#>>'{}'))=0) then
 raise exception 'Invalid or missing answer' using errcode='22023'; end if;
 insert into public.questionnaire_answers(response_id,version_id,question_id,body)
 values(rid,p_version_id,item.key::uuid,item.value#>>'{}')
 on conflict(response_id,question_id) do update set body=excluded.body,updated_at=now();
 end loop;
 update public.questionnaire_responses set revision=revision+1,status=case when p_complete then 'submitted' else 'in_progress' end,
 submitted_at=case when p_complete then now() else null end,updated_at=now(),last_save_id=p_save_id,last_payload=payload
 where id=rid returning * into r;
 return jsonb_build_object('revision',r.revision,'status',r.status,'savedAt',r.updated_at);
end $$;
revoke all on function private.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean) from public,anon,authenticated;
grant execute on function private.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean) to authenticated;
create function public.save_questionnaire_response(p_version_id uuid,p_answers jsonb,p_revision integer,p_save_id uuid,p_complete boolean)
returns jsonb language sql security invoker set search_path='' as $$ select private.save_questionnaire_response(p_version_id,p_answers,p_revision,p_save_id,p_complete); $$;
revoke all on function public.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean) from public,anon;
grant execute on function public.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean) to authenticated;

-- Responses serve as distributed-questionnaire read receipts, independent of publication receipts.
create function public.unread_distributed_questionnaires()
returns table(version_id uuid) language sql stable security invoker set search_path='' as $$
 select v.id from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id
 where v.status='distributed' and q.archived_at is null
 and not exists(select 1 from public.questionnaire_responses r where r.version_id=v.id and r.respondent_id=(select auth.uid()));
$$;
revoke all on function public.unread_distributed_questionnaires() from public,anon;
grant execute on function public.unread_distributed_questionnaires() to authenticated;
create policy "Receive own questionnaire response changes" on realtime.messages for select to authenticated
using(extension='broadcast' and private and topic=(select realtime.topic())
 and topic='questionnaires:user:'||(select auth.uid())::text
 and exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('consultant','consultant_lead','admin')));
create function private.notify_questionnaire_response_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform realtime.send('{}'::jsonb,'changed','questionnaires:user:'||new.respondent_id::text,true);
 return null;
end $$;
revoke all on function private.notify_questionnaire_response_change() from public,anon,authenticated;
create trigger questionnaire_response_changed after insert or update on public.questionnaire_responses
 for each row execute function private.notify_questionnaire_response_change();

-- Freeze submitted answers even for accidental future SQL write paths.
create function private.guard_submitted_answers() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='questionnaire_responses' then
 if old.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 else
 if exists(select 1 from public.questionnaire_responses where id=old.response_id and status='submitted') then
 raise exception 'Answers are locked' using errcode='55000'; end if;
 end if;
 return new;
end $$;
create trigger submitted_response_immutable before update on public.questionnaire_responses for each row execute function private.guard_submitted_answers();
create trigger submitted_answer_immutable before update or delete on public.questionnaire_answers for each row execute function private.guard_submitted_answers();

create or replace function private.request_questionnaire_review(
  p_id uuid, p_version_id uuid, p_question_id uuid, p_description text
) returns void language plpgsql security definer set search_path='' as $$
declare
  v public.questionnaire_versions%rowtype;
  actor public.profiles%rowtype;
  owner_id uuid;
begin
  select * into actor from public.profiles where id=auth.uid();
  if actor.id is null or actor.role not in ('admin','consultant_lead') then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_id is null or p_version_id is null or p_question_id is null
    or p_description is null or length(btrim(p_description)) not between 1 and 5000 then
    raise exception 'Question and description required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found or v.status <> 'published' then
    raise exception 'Review not allowed' using errcode='42501';
  end if;
  select created_by into owner_id from public.questionnaires
    where id=v.questionnaire_id and archived_at is null for update;
  if owner_id is null or owner_id=actor.id then
    raise exception 'Review not allowed' using errcode='42501';
  end if;
  if not exists(select 1 from public.questionnaire_questions
    where id=p_question_id and version_id=p_version_id) then raise exception 'Question not found in this version' using errcode='22023'; end if;
  insert into public.questionnaire_review_requests(
    id,version_id,question_id,title,requested_by,requester_name,description
  ) values(p_id,v.id,p_question_id,'',actor.id,actor.name,btrim(p_description))
  on conflict(id) do nothing;
  if not exists(select 1 from public.questionnaire_review_requests
    where id=p_id and version_id=v.id and question_id=p_question_id and title=''
      and requested_by=actor.id and description=btrim(p_description)) then
    raise exception 'Review conflict' using errcode='40001';
  end if;
end $$;

