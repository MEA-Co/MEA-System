begin;
-- Historical distributed rows cannot be created through today's source-only API.
-- Seed only this fixture as owner, then restore every trigger before exercising RPCs.
create temp table legacy_fixture(owner_id uuid, respondent_id uuid, parent_id uuid, version_id uuid, section_id uuid, question_id uuid);
insert into legacy_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
insert into auth.users(id) select owner_id from legacy_fixture union all select respondent_id from legacy_fixture;
insert into public.profiles(id,role,name) select owner_id,'consultant_lead','legacy owner' from legacy_fixture union all select respondent_id,'consultant','legacy respondent' from legacy_fixture;
set local session_replication_role=replica;
insert into public.questionnaires(id,created_by) select parent_id,owner_id from legacy_fixture;
insert into public.questionnaire_versions(id,questionnaire_id,title,status,revision,published_at,distributed_at) select version_id,parent_id,'Legacy response compatibility','distributed',1,now(),now() from legacy_fixture;
insert into public.questionnaire_sections(id,version_id,title,position) select section_id,version_id,'Section',0 from legacy_fixture;
insert into public.questionnaire_questions(id,version_id,section_id,body,position,kind,options)
select question_id,version_id,section_id,'Original choice',0,'single','[{"id":"11111111-1111-4111-8111-111111111111","label":"First"},{"id":"22222222-2222-4222-8222-222222222222","label":"Second"}]' from legacy_fixture;
set local session_replication_role=origin;
grant select on legacy_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select respondent_id::text from legacy_fixture),true);
set local role authenticated;
do $$ declare f record; r jsonb; aid uuid; begin
 select * into f from legacy_fixture;
 r:=public.read_published_questionnaire(f.version_id);
 if r#>>'{sections,0,questions,0,text}' <> 'Original choice' or r#>>'{sections,0,questions,0,kind}' <> 'single' then raise exception 'Legacy definition changed'; end if;
 perform public.open_questionnaire_response(f.version_id);
 begin
  perform public.save_questionnaire_response(f.version_id,jsonb_build_object(f.question_id::text,'"invalid"'),0,gen_random_uuid(),false);
  raise exception 'Invalid selection accepted';
 exception when invalid_parameter_value then null; end;
 perform public.save_questionnaire_response(f.version_id,jsonb_build_object(f.question_id::text,'11111111-1111-4111-8111-111111111111'),0,gen_random_uuid(),false);
 select id into aid from public.questionnaire_answers where question_id=f.question_id;
 perform public.save_questionnaire_response(f.version_id,jsonb_build_object(f.question_id::text,'22222222-2222-4222-8222-222222222222'),1,gen_random_uuid(),true);
 if not exists(select 1 from public.questionnaire_answers where id=aid and selection='"22222222-2222-4222-8222-222222222222"' and body='Second') then raise exception 'Answer ID or definition lost'; end if;
 begin
  perform public.save_questionnaire_response(f.version_id,jsonb_build_object(f.question_id::text,'11111111-1111-4111-8111-111111111111'),2,gen_random_uuid(),false);
  raise exception 'Submitted answer edited';
 exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
rollback;
