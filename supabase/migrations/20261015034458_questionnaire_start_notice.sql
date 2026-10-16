begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.questions, public.questionnaires, public.questionnaire_sections,
 public.questionnaire_questions, public.response_sessions, public.question_responses,
 public.response_submissions, public.question_details in access exclusive mode;

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

-- Unplaced legacy notice templates have no destination. Preserve their content
-- by archiving only after proving that no response/layout/dependency uses them.
create temporary table notice_orphans on commit drop as
 select q.id from public.questions q where q.purpose='study_registration'
 and q.archived_at is null and not exists(select 1 from notice_moves m where m.source_id=q.id);

-- This migration is not yet deployed to production. Existing response sessions
-- may contain the registration card as an EMPTY identity row. Remove only those
-- empty placeholders; preserve all actual answers and submission/retry metadata.
do $$
begin
 if exists(select 1 from notice_moves group by questionnaire_id having count(*)>1)
 or exists(select 1 from public.question_details d join notice_moves m on m.source_id=d.question_id)
 then raise exception 'Start notice migration requires review of additional cards or details'; end if;

 if exists(select 1 from notice_orphans o where
   exists(select 1 from public.question_responses r where r.question_id=o.id)
   or exists(select 1 from public.response_sessions r where r.layout::text like '%'||o.id::text||'%'
     or r.last_payload::text like '%'||o.id::text||'%' or r.legacy_response::text like '%'||o.id::text||'%')
   or exists(select 1 from public.response_submissions r where r.answers::text like '%'||o.id::text||'%')
   or exists(select 1 from public.questions q where q.source_block_id=o.id or q.after_block_id=o.id
     or q.condition::text like '%'||o.id::text||'%'))
 then raise exception 'Unplaced registration template has references; preserve and review manually'; end if;

 if exists(select 1 from public.question_responses r join public.response_sessions s on s.id=r.session_id
   where r.question_id in(select source_id from notice_moves) and (
     r.rows is distinct from '[]'::jsonb or r.active_row_ids is distinct from '[]'::jsonb
     or r.body is distinct from '' or r.referenced_response_id is not null
     or r.legacy_answer is not null or r.previous_responses is distinct from '[]'::jsonb
     or not exists(select 1 from notice_moves m where m.source_id=r.question_id
       and m.questionnaire_id=s.origin_questionnaire_id and m.placement_id=r.origin_placement_id)))
 or exists(select 1 from public.question_responses r join public.question_responses target on target.id=r.referenced_response_id
   where target.question_id in(select source_id from notice_moves))
 then raise exception 'Registration response is not an empty supported placeholder'; end if;

 if exists(select 1 from public.response_sessions s
   cross join lateral jsonb_array_elements(s.layout) sec
   cross join lateral jsonb_array_elements(sec->'questions') p
   where (p->>'sourceQuestionId' in(select source_id::text from notice_moves)
     or p->>'id' in(select placement_id::text from notice_moves))
   and not exists(select 1 from notice_moves m where m.source_id::text=p->>'sourceQuestionId'
     and m.placement_id::text=p->>'id' and m.questionnaire_id=s.origin_questionnaire_id))
 then raise exception 'Registration layout has an unexpected source or placement'; end if;

 if exists(select 1 from public.response_submissions sub cross join lateral jsonb_each(sub.answers) item
   where item.key in(select source_id::text from notice_moves) and (
     jsonb_typeof(item.value) is distinct from 'object'
     or item.value->'rows' is distinct from '[]'::jsonb
     or item.value->'activeRowIds' is distinct from '[]'::jsonb
     or item.value->>'body' is distinct from ''
     or item.value - array['responseId','rows','activeRowIds','body'] <> '{}'::jsonb
     or not exists(select 1 from public.question_responses r where r.session_id=sub.session_id
       and r.question_id::text=item.key and r.id::text=item.value->>'responseId')))
 then raise exception 'Registration submission is not an empty supported placeholder'; end if;

 if exists(select 1 from public.response_sessions s cross join lateral jsonb_each(s.last_payload->'answers') item
   where item.key in(select source_id::text from notice_moves) and (
     item.value is distinct from '[]'::jsonb
     or not exists(select 1 from notice_moves m where m.source_id::text=item.key and m.questionnaire_id=s.origin_questionnaire_id)))
 then raise exception 'Registration retry payload is not empty'; end if;

 if (select count(*) from pg_trigger where tgenabled='O' and (tgrelid,tgname) in (
   ('public.questionnaires'::regclass,'guard_published_version'),
   ('public.questionnaire_questions'::regclass,'guard_published_question'),
   ('public.questionnaire_sections'::regclass,'guard_published_section'),
   ('public.questions'::regclass,'a_distributed_question_lock'),
   ('public.response_sessions'::regclass,'response_session_identity'),
   ('public.question_responses'::regclass,'question_response_identity')))<>6
 then raise exception 'Unexpected notice migration guard state'; end if;
end $$;

-- Preserve section attributes/order, including previously empty sections. Remove
-- a section only when its last question was one of the migrated notices.
create function pg_temp.notice_layout(value jsonb) returns jsonb language sql as $$
 select coalesce(jsonb_agg(sec || jsonb_build_object('questions',remaining) order by n),'[]'::jsonb)
 from jsonb_array_elements(value) with ordinality sections(sec,n)
 cross join lateral (select coalesce(jsonb_agg(p order by i),'[]'::jsonb) remaining
   from jsonb_array_elements(sec->'questions') with ordinality questions(p,i)
   where not exists(select 1 from notice_moves m where m.source_id::text=p->>'sourceQuestionId')) filtered
 where remaining<>'[]'::jsonb or not exists(select 1 from jsonb_array_elements(sec->'questions') p
   join notice_moves m on m.source_id::text=p->>'sourceQuestionId');
$$;
create function pg_temp.notice_payload(value jsonb) returns jsonb language sql as $$
 select case when jsonb_typeof(value->'answers')='object' then jsonb_set(value,'{answers}',
   (value->'answers') - array(select source_id::text from notice_moves)) else value end;
$$;
create function pg_temp.notice_fingerprint(target regclass, expression text, predicate text default 'true')
returns jsonb language plpgsql as $$
declare result jsonb; begin
 execute format('select jsonb_build_array(count(*),md5(coalesce(string_agg(h, %L order by h), %L))) from (select md5((%s)::text) h from %s t where %s) rows',
   '', '', expression, target, predicate) into result;
 return result;
end $$;
create temporary table notice_preserved(target regclass, expression text, predicate text, fingerprint jsonb) on commit drop;
insert into notice_preserved(target,expression,predicate) values
 ('public.question_responses','to_jsonb(t)','question_id is null or question_id not in(select source_id from notice_moves)'),
 ('public.response_sessions',$expr$to_jsonb(t)||jsonb_build_object('layout',pg_temp.notice_layout(t.layout),'last_payload',pg_temp.notice_payload(t.last_payload))$expr$,'true'),
 ('public.response_submissions',$expr$to_jsonb(t)||jsonb_build_object('answers',t.answers-array(select source_id::text from notice_moves))$expr$,'true'),
 ('public.questions',$expr$case when id in(select source_id from notice_moves union select id from notice_orphans) then to_jsonb(t)-'archived_at' else to_jsonb(t) end$expr$,'true'),
 ('public.question_details','to_jsonb(t)','true');
update notice_preserved set fingerprint=pg_temp.notice_fingerprint(target,expression,predicate);

-- Frozen publication layouts need a narrowly scoped migration exception. Do not
-- advance session revisions/timestamps or copy working answers into submissions.
alter table public.response_sessions disable trigger response_session_identity;
update public.response_sessions set layout=pg_temp.notice_layout(layout),last_payload=pg_temp.notice_payload(last_payload)
where origin_questionnaire_id in(select questionnaire_id from notice_moves)
 and (layout is distinct from pg_temp.notice_layout(layout) or last_payload is distinct from pg_temp.notice_payload(last_payload));
alter table public.response_sessions enable trigger response_session_identity;
update public.response_submissions set answers=answers-array(select source_id::text from notice_moves)
where answers ?| array(select source_id::text from notice_moves);
alter table public.question_responses disable trigger question_response_identity;
delete from public.question_responses where question_id in(select source_id from notice_moves);
alter table public.question_responses enable trigger question_response_identity;

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

-- Keep validate_question and its dependency checks active. It touches updated_at,
-- so restore that one value after validation for this archive-only operation.
-- The table is exclusively locked and the helper is removed before commit.
create function pg_temp.notice_preserve_question_timestamp() returns trigger language plpgsql as $$
begin
 if old.archived_at is not null or new.archived_at is null
   or not exists(select 1 from notice_moves where source_id=old.id
     union all select 1 from notice_orphans where id=old.id)
   or (to_jsonb(new)-array['archived_at','updated_at','search_text'])
     is distinct from (to_jsonb(old)-array['archived_at','updated_at','search_text'])
 then raise exception 'Unexpected notice archive mutation'; end if;
 -- Generated search_text is computed after BEFORE triggers; the final fingerprint checks it.
 new.updated_at:=old.updated_at;
 return new;
end $$;
create trigger zz_notice_preserve_question_timestamp before update on public.questions
 for each row execute function pg_temp.notice_preserve_question_timestamp();
alter table public.questions disable trigger a_distributed_question_lock;
update public.questions set archived_at=now() where id in(select source_id from notice_moves union select id from notice_orphans);
alter table public.questions enable trigger a_distributed_question_lock;
drop trigger zz_notice_preserve_question_timestamp on public.questions;
drop function pg_temp.notice_preserve_question_timestamp();

do $$
declare item record; begin
 for item in select * from notice_preserved loop
   if pg_temp.notice_fingerprint(item.target,item.expression,item.predicate) is distinct from item.fingerprint then
     raise exception 'Start notice migration changed preserved data in %',item.target;
   end if;
 end loop;
 if exists(select 1 from public.question_responses where question_id in(select source_id from notice_moves))
   or exists(select 1 from public.response_submissions where answers ?| array(select source_id::text from notice_moves))
   or exists(select 1 from public.response_sessions where layout is distinct from pg_temp.notice_layout(layout)
     or last_payload is distinct from pg_temp.notice_payload(last_payload))
 then raise exception 'Registration placeholders remain'; end if;
end $$;

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
