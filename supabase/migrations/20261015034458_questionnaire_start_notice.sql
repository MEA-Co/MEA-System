begin;
set local lock_timeout = '5s';
lock table public.questions, public.questionnaires, public.questionnaire_sections,
 public.questionnaire_questions, public.response_sessions, public.question_responses,
 public.response_submissions in access exclusive mode;

alter table public.questionnaires add column start_notice jsonb;
alter table public.questionnaires add constraint questionnaire_start_notice_valid check (
 start_notice is null or (
 jsonb_typeof(start_notice)='object'
 and start_notice ?& array['title','body','buttonLabel']
 and jsonb_typeof(start_notice->'title')='string'
 and jsonb_typeof(start_notice->'body')='string'
 and jsonb_typeof(start_notice->'buttonLabel')='string'
 and length(start_notice->>'title')<=200
 and length(start_notice->>'body')<=20000
 and length(start_notice->>'buttonLabel') between 1 and 100
 )
);

create temporary table notice_moves on commit drop as
 select q.id source_id, p.id placement_id, p.section_id, p.questionnaire_id,
 jsonb_build_object('title',q.title,'body',q.prompt,'buttonLabel',q.button_label) notice
 from public.questions q join public.questionnaire_questions p on p.source_question_id=q.id
 where q.purpose='study_registration' and q.archived_at is null;

-- Fail closed rather than silently altering existing saved sessions or submissions.
do $$
begin
 if exists(select 1 from notice_moves group by questionnaire_id having count(*)>1)
 or exists(select 1 from public.questions q where q.purpose='study_registration' and q.archived_at is null
   and not exists(select 1 from notice_moves m where m.source_id=q.id))
 or exists(select 1 from public.question_details d join notice_moves m on m.source_id=d.question_id)
 or exists(select 1 from public.response_sessions s join notice_moves m on m.questionnaire_id=s.origin_questionnaire_id)
 or exists(select 1 from public.question_responses r join notice_moves m on m.source_id=r.question_id)
 or exists(select 1 from public.response_submissions s join notice_moves m on s.answers::text like '%'||m.source_id::text||'%')
 then raise exception 'Start notice migration requires review of additional cards, details or response history'; end if;
end $$;

-- Exact scope, transactional locks, and restore each existing guard before commit.
alter table public.questionnaires disable trigger guard_published_version;
update public.questionnaires v set start_notice=m.notice, revision=v.revision+1,
 last_save_id=gen_random_uuid(),last_save_hash=''
 from notice_moves m where m.questionnaire_id=v.id;
alter table public.questionnaires enable trigger guard_published_version;

alter table public.questionnaire_questions disable trigger guard_published_question;
delete from public.questionnaire_questions p using notice_moves m where p.id=m.placement_id;
alter table public.questionnaire_questions enable trigger guard_published_question;
alter table public.questionnaire_sections disable trigger guard_published_section;
delete from public.questionnaire_sections s where s.id in(select section_id from notice_moves)
 and not exists(select 1 from public.questionnaire_questions p where p.section_id=s.id);
alter table public.questionnaire_sections enable trigger guard_published_section;

alter table public.questions disable trigger a_distributed_question_lock;
update public.questions set archived_at=now() where id in(select source_id from notice_moves);
alter table public.questions enable trigger a_distributed_question_lock;

-- The notice is read-only configuration, not a new public editing surface.
create function private.guard_start_notice() returns trigger language plpgsql set search_path='' as $$
begin
 if (tg_op='INSERT' and new.start_notice is not null)
 or (tg_op='UPDATE' and new.start_notice is distinct from old.start_notice) then
 raise exception 'Start notices are managed separately' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.guard_start_notice() from public,anon,authenticated;
create trigger guard_start_notice before insert or update on public.questionnaires
 for each row execute function private.guard_start_notice();

create function private.reject_new_registration_question() returns trigger language plpgsql set search_path='' as $$
begin
 if new.purpose='study_registration' then
 raise exception 'Study registration is a questionnaire start notice' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function private.reject_new_registration_question() from public,anon,authenticated;
create trigger reject_new_registration_question before insert or update on public.questions
 for each row execute function private.reject_new_registration_question();

-- Keep existing function ownership, grants, RLS and authorization checks.
do $$
declare signature text; definition text; needle text;
begin
 foreach signature in array array['public.read_questionnaire_draft(uuid)','public.read_published_questionnaire(uuid)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  needle:='''questionnaireId'',v.id,''title'',v.title,';
  if position(needle in definition)=0 then raise exception 'Unexpected document projection: %',signature; end if;
  execute replace(definition,needle,needle||'''startNotice'',v.start_notice,');
 end loop;
 foreach signature in array array['private.read_question_response_session(uuid)','private.read_distributed_question_response_session(uuid)'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  needle:='''title'',s.origin_title,';
  if position(needle in definition)=0 then raise exception 'Unexpected response projection: %',signature; end if;
  execute replace(definition,needle,needle||'''startNotice'',(select v.start_notice from public.questionnaires v where v.id=s.origin_questionnaire_id),');
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
