begin;
create temp table notice_users as select gen_random_uuid() id, role from unnest(array['owner','other','consultant']) role;
insert into auth.users(id) select id from notice_users;
insert into public.profiles(id,role,name) select id,case when role='consultant' then role else 'consultant_lead' end,'안내 테스트' from notice_users;
create temp table notice_fixture(id uuid, doc jsonb);
insert into notice_fixture(id) values(gen_random_uuid());
grant all on notice_fixture to authenticated;
grant select on notice_users to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from notice_users where role='owner'),true);
set local role authenticated;
do $$ declare doc jsonb; notices jsonb; q jsonb; placement uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); begin
 q:=jsonb_build_object('id',gen_random_uuid(),'title','질문','prompt','내용','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single','sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null,'details','[]'::jsonb);
 perform public.save_question(q,0,gen_random_uuid());
 select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'position',p,'title','안내','body','안내 본문','buttonLabel','','linkButtonLabel','탐구줄기 등록') order by ord)
 into notices from unnest(array['start',placement::text,'end']) with ordinality pos(p,ord);
 doc:=jsonb_build_object('questionnaireId',(select id from notice_fixture),'title','안내 테스트','notices',notices,'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',placement,'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','내용','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(doc,0,sid);
 perform public.save_questionnaire_draft(doc,0,sid);
 if public.read_questionnaire_draft((select id from notice_fixture))->'notices' is distinct from notices then raise exception 'Notices round trip failed'; end if;
 perform public.save_questionnaire_draft(doc-'notices',1,gen_random_uuid());
 if public.read_questionnaire_draft((select id from notice_fixture))->'notices' is distinct from notices then raise exception 'Omitted notices erased data'; end if;
 begin perform public.save_questionnaire_draft(doc,0,gen_random_uuid()); raise exception 'Stale save accepted'; exception when sqlstate 'PGRST' then null; end;
 begin perform public.save_questionnaire_draft(jsonb_set(doc,'{notices}',jsonb_build_array(notices->0,notices->0)),2,gen_random_uuid()); raise exception 'Duplicate IDs accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_questionnaire_draft(jsonb_set(doc,'{notices,0,linkButtonLabel}','123'),2,gen_random_uuid()); raise exception 'Invalid label accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_questionnaire_draft(jsonb_set(doc,'{notices,0,body}',to_jsonb(repeat('x',20001))),2,gen_random_uuid()); raise exception 'Oversized notice accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_questionnaire_draft(doc||jsonb_build_object('startNotice',null),2,gen_random_uuid()); raise exception 'Legacy writer accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
-- The live document is the fixture; all changes roll back.
update notice_fixture f set doc=public.read_questionnaire_draft(f.id)-'revision'-'savedAt';
select set_config('request.jwt.claim.sub',(select id::text from notice_users where role='other'),true);
set local role authenticated;
do $$ begin
 begin perform public.save_questionnaire_draft((select doc from notice_fixture),2,gen_random_uuid()); raise exception 'Other owner write accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from notice_users where role='owner'),true);
set local role authenticated;
do $$ declare id uuid:=(select f.id from notice_fixture f); begin
 perform public.change_questionnaire_status(id,2,'draft',null,'in_review',gen_random_uuid(),2);
 if jsonb_array_length(public.read_shared_questionnaire(id)->'notices')<>3 then raise exception 'Shared notices missing'; end if;
 perform public.change_questionnaire_status(id,3,'in_review',null,'published',gen_random_uuid(),2);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from notice_users where role='consultant'),true);
set local role authenticated;
do $$ declare snapshot jsonb; version jsonb; begin
 snapshot:=public.open_published_question_response_session((select id from notice_fixture));
 if jsonb_array_length(snapshot->'notices')<>3 then raise exception 'Response notices missing'; end if;
 version:=public.read_published_question_response_version((select id from notice_fixture));
 if version ? 'notices' or version->>'noticesToken' is distinct from snapshot->>'noticesToken' then raise exception 'Polling notice mismatch'; end if;
 begin perform public.save_questionnaire_draft((select doc from notice_fixture),4,gen_random_uuid()); raise exception 'Consultant write accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare legacy jsonb; begin
 legacy:=private.questionnaire_notices('{"title":"기존 안내","body":"보존","buttonLabel":"학습법 추가"}'::jsonb);
 if legacy#>>'{0,position}'<>'start' or legacy#>>'{0,body}'<>'보존' then raise exception 'Legacy notice changed'; end if;
 if private.questionnaire_notices_valid('null') or private.questionnaire_notices_valid('[{}]') then raise exception 'Malformed notice accepted'; end if;
end $$;
rollback;
