begin;
create temporary table notice_test_user as select gen_random_uuid() id;
insert into auth.users(id) select id from notice_test_user;
insert into public.profiles(id,role,name) select id,'consultant','시작 안내 검증' from notice_test_user;
grant select on notice_test_user to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from notice_test_user),true);
set local role authenticated;
do $$
declare d jsonb; s jsonb; target uuid;
begin
 select id into target from public.questionnaires where start_notice is not null and status='distributed' limit 1;
 if target is null then raise exception 'Missing migrated questionnaire'; end if;
 d:=public.read_published_questionnaire(target);
 if d#>>'{startNotice,title}' is distinct from '학습법 블록 등록' then raise exception 'Notice missing in public document'; end if;
 s:=public.open_distributed_question_response_session(target);
 if s->'startNotice' is distinct from d->'startNotice' then raise exception 'Response notice differs'; end if;
 if exists(select 1 from jsonb_array_elements(s->'questions') q where q#>>'{definition,purpose}'='study_registration') then raise exception 'Notice still an answer question'; end if;
 if jsonb_array_length(s->'questions')<>15 then raise exception 'Other question count changed'; end if;
 begin
  perform public.save_question(jsonb_build_object('id',gen_random_uuid(),'title','안내','prompt','안내','purpose','study_registration','fields','[]'::jsonb,'rowMode','single'),0,gen_random_uuid());
  raise exception 'Consultant created question';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set role='consultant_lead' where id in(select id from notice_test_user);
set local role authenticated;
do $$
begin
 begin
  perform public.save_question(jsonb_build_object('id',gen_random_uuid(),'title','안내','prompt','안내','purpose','study_registration','buttonLabel','학습법 추가','fields','[]'::jsonb,'rowMode','single','minRows',1,'initialRows',1,'maxRows',null,'answerLayout','cards','rowLabels','[]'::jsonb,'details','[]'::jsonb),0,gen_random_uuid());
  raise exception 'Lead created retired registration question';
 exception when invalid_parameter_value then null; end;
end $$;
reset role;
rollback;
