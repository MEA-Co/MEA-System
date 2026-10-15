-- Current workflow contract. Fixtures and notifications are rolled back.
begin;
create temp table workflow_v2_users as select gen_random_uuid() id,role from unnest(array['owner','other','consultant']) role;
insert into auth.users(id) select id from workflow_v2_users;
insert into public.profiles(id,role,name) select id,case when role='consultant' then role else 'consultant_lead' end,'상태 전환 검증' from workflow_v2_users;
create temp table workflow_v2_fixture(id uuid,source_id uuid);
insert into workflow_v2_fixture values(gen_random_uuid(),gen_random_uuid());
create temp table workflow_v2_messages as select id from realtime.messages;
grant select on workflow_v2_users,workflow_v2_fixture,workflow_v2_messages to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from workflow_v2_users where role='owner'),true);
set local role authenticated;
do $$ declare f record; d jsonb; review_time timestamptz; begin
 select * into f from workflow_v2_fixture;
 perform public.save_question(jsonb_build_object('id',f.source_id,'title','공유 원본','prompt','질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'kind','text','label','답변')),'rowMode','single'),0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',f.id,'title','검토 및 배포','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','구역','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',f.source_id,'text','','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 begin
  perform public.change_questionnaire_status(f.id,1,'draft',null,'published',gen_random_uuid(),1);
  raise exception 'Old status version accepted';
 exception when invalid_parameter_value then null; end;
 if (select status from public.questionnaires where id=f.id)<>'draft' then raise exception 'Rejected request mutated draft'; end if;
 perform public.change_questionnaire_status(f.id,1,'draft',null,'in_review',gen_random_uuid(),2);
 select review_started_at into review_time from public.questionnaires where id=f.id;
 if review_time is null or (select published_at from public.questionnaires where id=f.id) is not null then raise exception 'Review/release timestamps confused'; end if;
 if not exists(select 1 from public.questionnaires where id=f.id and status='in_review') then raise exception 'Review status missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from workflow_v2_users where role='other'),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from workflow_v2_fixture;
 if not exists(select 1 from public.questions where id=f.source_id) or public.read_questionnaire_draft(f.id) is null then raise exception 'Shared review inaccessible'; end if;
 perform public.mark_questionnaire_review_read(f.id);
 begin perform public.publish_questionnaire(f.id,2,2); raise exception 'Nonowner released document'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from workflow_v2_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.questionnaires where id=(select id from workflow_v2_fixture)) then raise exception 'Consultant sees review'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from workflow_v2_users where role='owner'),true);
set local role authenticated;
do $$ declare f record; rid uuid:=gen_random_uuid(); result jsonb; begin
 select * into f from workflow_v2_fixture;
 begin perform public.publish_questionnaire(f.id,2,null); raise exception 'Unversioned release accepted'; exception when invalid_parameter_value then null; end;
 result:=public.change_questionnaire_status(f.id,2,'in_review',null,'published',rid,2);
 if public.change_questionnaire_status(f.id,2,'in_review',null,'published',rid,2)<>result then raise exception 'Idempotent retry changed'; end if;
 if not exists(select 1 from public.questionnaires where id=f.id and status='published' and review_started_at is not null and published_at is not null) then raise exception 'Published timestamp missing'; end if;
 if not exists(select 1 from public.questions where id=f.source_id and publication_locked_at is not null) then raise exception 'Source lock missing'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from workflow_v2_users where role='consultant'),true);
set local role authenticated;
do $$ declare f record; response jsonb; begin
 select * into f from workflow_v2_fixture;
 if not exists(select 1 from public.questionnaires where id=f.id and status='published') then raise exception 'Consultant cannot see release'; end if;
 response:=public.open_published_question_response_session(f.id);
 if response->>'stage'<>'published' then raise exception 'Wrong response stage'; end if;
 perform set_config('realtime.topic','questionnaires:published',true);
 if not exists(select 1 from realtime.messages where id not in (select id from workflow_v2_messages) and topic='questionnaires:published') then raise exception 'Published realtime channel missing'; end if;
 if exists(select 1 from realtime.messages where id not in (select id from workflow_v2_messages) and topic='questionnaires:staff') then raise exception 'Staff notifications leaked'; end if;
end $$;
reset role;
do $$ begin
 if to_regprocedure('public.publish_questionnaire(uuid,integer)') is not null
 or to_regprocedure('public.change_questionnaire_status(uuid,integer,text,timestamptz,text,uuid)') is not null
 or to_regprocedure('public.distribute_questionnaire(uuid,integer)') is not null
 or to_regprocedure('public.save_question_response_session(uuid,jsonb,integer,uuid,boolean,text)') is not null then raise exception 'Ambiguous old RPC still exposed'; end if;
 if has_function_privilege('anon','public.publish_questionnaire(uuid,integer,integer)','execute')
 or has_function_privilege('anon','public.change_questionnaire_status(uuid,integer,text,timestamptz,text,uuid,integer)','execute') then raise exception 'Anonymous mutation grant'; end if;
end $$;
rollback;
