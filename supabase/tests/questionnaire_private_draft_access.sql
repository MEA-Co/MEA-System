begin;
create temp table access_users as select gen_random_uuid() id, role from unnest(array['owner','other','admin','consultant']) role;
insert into auth.users(id) select id from access_users;
insert into public.profiles(id,role,name) select id,case when role in ('owner','other') then 'consultant_lead' else role end,'초안 권한 테스트' from access_users;
create temp table access_fixture(qid uuid,vid uuid);
insert into access_fixture values(gen_random_uuid(),gen_random_uuid());
grant select on access_users,access_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from access_users where role='owner'),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from access_fixture;
 perform public.save_question(jsonb_build_object('id',f.qid,'title','비공개 질문','prompt','질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null),0,gen_random_uuid());
 perform public.save_questionnaire_draft(jsonb_build_object('questionnaireId',f.vid,'title','비공개 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',f.qid,'text','','details','[]'::jsonb))))),0,gen_random_uuid());
 if public.read_questionnaire_draft(f.vid) is null then raise exception 'Owner cannot read'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from access_users where role='other'),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from access_fixture;
 if exists(select 1 from public.questions where id=f.qid)
 or exists(select 1 from public.questionnaires where id=f.vid)
 or exists(select 1 from public.questionnaire_sections where questionnaire_id=f.vid)
 or exists(select 1 from public.questionnaire_questions where questionnaire_id=f.vid)
 or public.read_questionnaire_draft(f.vid) is not null then raise exception 'Other lead can read private content'; end if;
 begin perform public.save_questionnaire_draft(jsonb_build_object('questionnaireId',f.vid,'title','침범','sections','[]'::jsonb),1,gen_random_uuid()); raise exception 'Other lead can save'; exception when insufficient_privilege then null; end;
 begin perform public.save_question(jsonb_build_object('id',f.qid,'title','침범','prompt','질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single'),1,gen_random_uuid()); raise exception 'Other lead can save question'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from access_users where role='admin'),true);
set local role authenticated;
do $$ declare f record; doc jsonb; begin
 select * into f from access_fixture;
 if not exists(select 1 from public.questions where id=f.qid) then raise exception 'Admin cannot read question'; end if;
 doc:=public.read_questionnaire_draft(f.vid);
 if doc is null then raise exception 'Admin cannot read draft'; end if;
 doc:=jsonb_set(doc,'{title}','"관리자 수정"');
 doc:=jsonb_set(doc,'{startNotice}','{"title":"안내","body":"내용","buttonLabel":""}');
 perform public.save_questionnaire_draft(doc,1,gen_random_uuid());
 if public.read_questionnaire_draft(f.vid)->>'title'<>'관리자 수정' then raise exception 'Admin save failed'; end if;
end $$;
reset role;
rollback;
