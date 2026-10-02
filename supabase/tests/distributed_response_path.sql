begin;
-- Historical distributed rows cannot be created through today's source-only API.
-- Seed only this fixture as owner, then restore every trigger before exercising RPCs.
create temp table legacy_fixture(owner_id uuid, respondent_id uuid, parent_id uuid, questionnaire_id uuid, section_id uuid, question_id uuid);
insert into legacy_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
insert into auth.users(id) select owner_id from legacy_fixture union all select respondent_id from legacy_fixture;
insert into public.profiles(id,role,name) select owner_id,'consultant_lead','legacy owner' from legacy_fixture union all select respondent_id,'consultant','legacy respondent' from legacy_fixture;
set local session_replication_role=replica;
insert into public.questionnaires(id,legacy_parent_id,created_by,title,status,revision,published_at,distributed_at) select questionnaire_id,parent_id,owner_id,'Legacy response compatibility','distributed',1,now(),now() from legacy_fixture;
insert into public.questionnaire_sections(id,questionnaire_id,title,position) select section_id,questionnaire_id,'Section',0 from legacy_fixture;
insert into public.questionnaire_questions(id,questionnaire_id,section_id,body,position,kind,options)
select question_id,questionnaire_id,section_id,'Original choice',0,'single','[{"id":"11111111-1111-4111-8111-111111111111","label":"First"},{"id":"22222222-2222-4222-8222-222222222222","label":"Second"}]' from legacy_fixture;
set local session_replication_role=origin;
grant select on legacy_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select respondent_id::text from legacy_fixture),true);

set local role authenticated;
do $$ declare f record; r jsonb; a jsonb; saveid uuid:=gen_random_uuid(); aid uuid; sid uuid; begin
 select * into f from legacy_fixture;
 if not exists(select 1 from public.unread_distributed_questionnaires() where questionnaire_id=f.questionnaire_id) then raise exception 'Missing unread'; end if;
 r:=public.read_distributed_response(f.questionnaire_id);
 if r->>'status'<>'assigned' then raise exception 'Initial status'; end if;
 sid:=public.open_distributed_response(f.questionnaire_id);
 if sid<>public.open_questionnaire_response(f.questionnaire_id) then raise exception 'Duplicate session from compatibility RPC'; end if;
 if exists(select 1 from public.unread_distributed_questionnaires() where questionnaire_id=f.questionnaire_id) then raise exception 'Unread not cleared'; end if;
 a:=jsonb_build_object(f.question_id::text,'11111111-1111-4111-8111-111111111111');
 r:=public.save_distributed_response(f.questionnaire_id,a,0,saveid,false,'자유 응답');
 if r->>'revision'<>'1' or r->>'freeResponse'<>'자유 응답' or r->'answers'<>a then raise exception 'Save/read mismatch'; end if;
 if not exists(select 1 from public.distributed_response_statuses() where questionnaire_id=f.questionnaire_id and status='in_progress') then raise exception 'Status missing'; end if;
 r:=public.save_questionnaire_response(f.questionnaire_id,a,0,saveid,false);
 if r->>'revision'<>'1' then raise exception 'Retry duplicated'; end if;
 select id into aid from public.question_responses where session_id=sid;
 begin perform public.save_distributed_response(f.questionnaire_id,a,0,gen_random_uuid(),false); raise exception 'Stale accepted'; exception when serialization_failure then null; end;
 begin perform public.save_distributed_response(f.questionnaire_id,jsonb_build_object(gen_random_uuid()::text,'foreign'),1,gen_random_uuid(),false); raise exception 'Foreign question accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_distributed_response(f.questionnaire_id,jsonb_build_object(f.question_id::text,''),1,gen_random_uuid(),true); raise exception 'Incomplete accepted'; exception when invalid_parameter_value then null; end;
 saveid:=gen_random_uuid();
 r:=public.save_distributed_response(f.questionnaire_id,a,1,saveid,true);
 if r->>'status'<>'submitted' or r->>'freeResponse'<>'자유 응답' then raise exception 'Completion lost free response'; end if;
 perform public.save_questionnaire_response(f.questionnaire_id,a,1,saveid,true);
 if not exists(select 1 from public.question_responses where id=aid and body='First') then raise exception 'ID changed'; end if;
 if to_regclass('public.questionnaire_answers') is not null or to_regclass('public.questionnaire_responses') is not null then raise exception 'Old storage still exists'; end if;
 begin perform public.save_distributed_response(f.questionnaire_id,a,2,gen_random_uuid(),false); raise exception 'Completed modified'; exception when object_not_in_prerequisite_state then null; end;
 begin update public.question_responses set body='bypass'; raise exception 'Direct write'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select owner_id::text from legacy_fixture),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from legacy_fixture;
 if exists(select 1 from public.question_responses) or exists(select 1 from public.question_versions) then raise exception 'Other user leaked'; end if;
 if not exists(select 1 from public.unread_distributed_questionnaires() where questionnaire_id=f.questionnaire_id) then raise exception 'Other users unread changed'; end if;
 perform public.open_distributed_response(f.questionnaire_id);
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
 begin perform public.open_distributed_response((select questionnaire_id from legacy_fixture)); raise exception 'Anon opened response'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
