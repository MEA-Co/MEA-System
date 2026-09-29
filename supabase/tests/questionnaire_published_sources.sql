begin;
create temporary table publish_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant']) role;
insert into auth.users(id) select id from publish_users;
insert into public.profiles(id,role,name) select id,case when role='other_lead' then 'consultant_lead' else role end,'게시 테스트' from publish_users;
create temporary table publish_docs(doc jsonb, source_id uuid);
grant all on publish_docs to authenticated;
grant select on publish_users to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare q jsonb; d jsonb; r jsonb;
begin
 q:=jsonb_build_object('id',gen_random_uuid(),'title','공유 질문','prompt','내용','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','repeatable','maxRows',3,'minRows',2,'rowLabels',jsonb_build_array('첫째','둘째'),'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 perform public.save_question(q,0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','공유 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','내용','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 insert into publish_docs values(d,(q->>'id')::uuid);
 begin
  perform public.read_published_question_sources((d->>'versionId')::uuid);
  raise exception 'Draft source leaked';
 exception when insufficient_privilege then null; end;
 perform public.change_questionnaire_status((d->>'versionId')::uuid,1,'draft',null,'published',gen_random_uuid());
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$
declare d jsonb; r jsonb;
begin
 select doc into d from publish_docs;
 if exists(select 1 from public.questions where id=(select source_id from publish_docs)) then raise exception 'Independent question privacy lost'; end if;
 if not exists(select 1 from public.questionnaire_versions where id=(d->>'versionId')::uuid and status='published') then raise exception 'Published list invisible'; end if;
 perform public.read_published_questionnaire((d->>'versionId')::uuid);
 r:=public.read_published_question_sources((d->>'versionId')::uuid);
 if jsonb_array_length(r)<>1 or r#>>'{0,title}'<>'공유 질문' or r#>>'{0,min_rows}'<>'2' or r#>>'{0,row_labels,0}'<>'첫째' then raise exception 'Source contents missing'; end if;
 begin
  perform public.change_questionnaire_status((d->>'versionId')::uuid,2,'published',null,'draft',gen_random_uuid());
  raise exception 'Other lead changed status';
 exception when insufficient_privilege then null; end;
end $$;
do $$
declare d jsonb; vid uuid; qid uuid;
begin
 select doc into d from publish_docs;
 vid := (d->>'versionId')::uuid;
 qid := (d#>>'{sections,0,questions,0,id}')::uuid;
 if not exists(select 1 from jsonb_array_elements(public.published_questionnaire_authors()) a where a->>'versionId'=vid::text and a->>'name'='게시 테스트') then raise exception 'Author name missing'; end if;
 begin
  perform public.add_questionnaire_explanation(gen_random_uuid(),vid,qid,'설명','내용',true);
  raise exception 'Nonowner added explanation';
 exception when insufficient_privilege then null; end;
 perform public.request_questionnaire_review(gen_random_uuid(),vid,qid,'검토 부탁드립니다');
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 begin
  perform public.read_published_question_sources((select (doc->>'versionId')::uuid from publish_docs));
  raise exception 'Consultant read staff sources';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='consultant_lead'),true);
set local role authenticated;
select public.change_questionnaire_status((doc->>'versionId')::uuid,2,'published',null,'draft',gen_random_uuid()) from publish_docs;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from publish_users where role='other_lead'),true);
set local role authenticated;
do $$ begin
 begin
  perform public.read_published_question_sources((select (doc->>'versionId')::uuid from publish_docs));
  raise exception 'Unpublished source leaked';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
