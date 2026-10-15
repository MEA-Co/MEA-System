-- Synthetic fixtures for the PRE-start-notice schema. Run in a rollback-only
-- transaction, never as production seed data. Uses the original public APIs.
do $$ begin
 if current_database()='postgres' or exists(select 1 from public.questions)
   or exists(select 1 from public.response_sessions) or exists(select 1 from auth.users)
 then raise exception 'Synthetic fixture requires an empty isolated verification database'; end if;
end $$;
create temporary table notice_test_users as
 select gen_random_uuid() id, name from unnest(array['owner','guide','draft','submitted','private_edit','opened']) name;
insert into auth.users(id) select id from notice_test_users;
insert into public.profiles(id,role,name) select id,
 case when name in ('owner','guide') then 'consultant_lead' else 'consultant' end,'notice-test-'||name from notice_test_users;
grant select on notice_test_users to authenticated;
create or replace function private.guide_consultant_id() returns uuid language sql stable set search_path='' as
 $$ select id from pg_temp.notice_test_users where name='guide'; $$;
create temporary table notice_test_docs(name text, id uuid, notice_id uuid, answer_id uuid, field_id uuid);
grant all on notice_test_docs to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from notice_test_users where name='owner'),true);
set local role authenticated;
do $$
declare n uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
 d jsonb; placement jsonb; notice_placement jsonb; name text;
begin
 perform public.save_question(jsonb_build_object('id',n,'title','등록 안내','prompt','원본 안내 본문',
 'purpose','study_registration','buttonLabel','학습법 추가','fields','[]'::jsonb,'rowMode','single',
 'minRows',1,'initialRows',1,'answerLayout','cards','rowLabels','[]'::jsonb),0,gen_random_uuid());
 perform public.save_question(jsonb_build_object('id',q,'title','답변 보존','prompt','내용을 작성해 주세요.',
 'fields',jsonb_build_array(jsonb_build_object('id',f,'label','내용','kind','text')),
 'rowMode','repeatable','maxRows',3,'minRows',1,'rowLabels','["첫 번째","두 번째"]'::jsonb),0,gen_random_uuid());
 foreach name in array array['notice_section','mixed_section','unrelated'] loop
   placement:=jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q,'text','','details','[]'::jsonb);
   notice_placement:=jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',n,'text','','details','[]'::jsonb);
   d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title','이전 검증 '||name,'sections',
     case when name='notice_section' then jsonb_build_array(
       jsonb_build_object('id',gen_random_uuid(),'title','안내 섹션','questions',jsonb_build_array(notice_placement)),
       jsonb_build_object('id',gen_random_uuid(),'title','답변 섹션','questions',jsonb_build_array(placement)))
     else jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','공통 섹션','questions',
       case when name='mixed_section' then jsonb_build_array(notice_placement,placement) else jsonb_build_array(placement) end)) end);
   perform public.save_questionnaire_draft(d,0,gen_random_uuid());
   perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
   insert into notice_test_docs values(name,(d->>'questionnaireId')::uuid,n,q,f);
 end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from notice_test_users where name='guide'),true);
set local role authenticated;
do $$ declare d record; x jsonb; payload jsonb; begin
 for d in select * from notice_test_docs loop
   x:=public.open_question_response_session(d.id);
   payload:=jsonb_build_object(d.answer_id::text,jsonb_build_array(jsonb_build_object('id',-1,'answers',jsonb_build_object(d.field_id::text,'가이드 원문'))));
   if d.name<>'unrelated' then payload:=payload||jsonb_build_object(d.notice_id::text,'[]'::jsonb); end if;
   perform public.save_question_response_session(d.id,payload,0,gen_random_uuid(),false,x->>'definitionToken');
 end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from notice_test_users where name='owner'),true);
set local role authenticated;
select public.change_questionnaire_status(id,2,'published',null,'distributed',gen_random_uuid()) from notice_test_docs;
reset role;
do $$
declare u record; d record; x jsonb; payload jsonb;
begin
 for u in select * from notice_test_users where name not in ('owner','guide') loop
   perform set_config('request.jwt.claim.sub',u.id::text,true);
   for d in select * from notice_test_docs loop
     x:=public.open_distributed_question_response_session(d.id);
     if u.name='opened' then continue; end if;
     payload:=jsonb_build_object(d.answer_id::text,jsonb_build_array(
       jsonb_build_object('id',-7,'answers',jsonb_build_object(d.field_id::text,E'저장된 원문\n줄바꿈 · 한글')),
       jsonb_build_object('id',12,'answers',jsonb_build_object(d.field_id::text,'두 번째 답변'))));
     if d.name<>'unrelated' then payload:=payload||jsonb_build_object(d.notice_id::text,'[]'::jsonb); end if;
     x:=public.save_distributed_question_response_session(d.id,payload,0,gen_random_uuid(),u.name in ('submitted','private_edit'),x->>'definitionToken');
     if u.name='private_edit' then
       payload:=jsonb_set(payload,array[d.answer_id::text,'0','answers',d.field_id::text],'"제출 이후 비공개 수정"'::jsonb);
       perform public.save_distributed_question_response_session(d.id,payload,1,gen_random_uuid(),false,x->>'definitionToken');
     end if;
   end loop;
 end loop;
end $$;
select set_config('request.jwt.claim.sub','',true);
-- Give historical records genuinely older timestamps: now() is constant within
-- this test transaction and would otherwise conceal accidental timestamp writes.
alter table public.response_sessions disable trigger response_session_identity;
update public.response_sessions set created_at=now()-interval '7 days',
 updated_at=now()-interval '1 hour',free_response='보존할 추가 메모',
 submitted_at=case when submitted_at is not null then now()-interval '2 hours' end;
alter table public.response_sessions enable trigger response_session_identity;
alter table public.question_responses disable trigger question_response_identity;
update public.question_responses set created_at=now()-interval '7 days',updated_at=now()-interval '1 hour';
alter table public.question_responses enable trigger question_response_identity;
update public.response_submissions set submitted_at=now()-interval '2 hours';
create temporary table notice_test_before_sessions as select * from public.response_sessions;
create temporary table notice_test_before_answers as select * from public.question_responses;
create temporary table notice_test_before_submissions as select * from public.response_submissions;
create temporary table notice_test_before_questions as select * from public.questions;
create temporary table notice_test_before_questionnaires as select * from public.questionnaires;
create temporary table notice_test_before_placements as select * from public.questionnaire_questions;
create temporary table notice_test_before_sections as select * from public.questionnaire_sections;
create temporary table notice_test_before_guards as
 select tgrelid::regclass::text relation,tgname,tgenabled from pg_trigger where not tgisinternal;
