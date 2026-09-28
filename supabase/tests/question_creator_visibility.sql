begin;
create temporary table visibility_users(id uuid, role text, label text);
insert into visibility_users select gen_random_uuid(), role, label from (values
 ('consultant_lead','작성자 A'),('consultant_lead','작성자 B'),('admin','관리자'),('consultant','컨설턴트')) v(role,label);
insert into auth.users(id) select id from visibility_users;
insert into public.profiles(id,role,name) select id,role,label from visibility_users;
create temporary table visibility_docs(owner_id uuid, doc jsonb);
grant select,insert on visibility_docs to authenticated;
grant select on visibility_users to authenticated;
set local role authenticated;
do $$
declare u record; d jsonb; foreign_doc jsonb; own_doc jsonb; result jsonb; a_id uuid;
begin
 for u in select * from visibility_users where role='consultant_lead' loop
   perform set_config('request.jwt.claim.sub',u.id::text,true);
   d:=jsonb_build_object('id',gen_random_uuid(),'title','권한검증 '||u.label,'prompt','비공개 본문',
     'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),
     'rowMode','single','details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','설명','text','비공개 설명','visibleToConsultants',true)));
   perform public.save_question(d,0,gen_random_uuid());
   insert into visibility_docs values(u.id,d);
 end loop;
 select id into a_id from visibility_users where label='작성자 A';
 perform set_config('request.jwt.claim.sub',a_id::text,true);
 select doc into own_doc from visibility_docs where owner_id=a_id;
 select doc into foreign_doc from visibility_docs where owner_id<>a_id;
 if (select count(*) from public.questions where id in(select (doc->>'id')::uuid from visibility_docs))<>1 then raise exception 'Lead can read other author'; end if;
 if exists(select 1 from public.questions where id=(foreign_doc->>'id')::uuid) then raise exception 'Direct ID leaks'; end if;
 if exists(select 1 from public.question_details where question_id=(foreign_doc->>'id')::uuid) then raise exception 'Explanation leaks'; end if;
 result:=public.list_questions_page('권한검증',1);
 if (result->>'total')::int<>1 then raise exception 'Search count leaks'; end if;
 if (result#>'{blocks,0}') ? 'creator_name' then raise exception 'Lead received admin metadata'; end if;
 begin
   perform public.save_question(jsonb_set(own_doc,'{afterBlockId}',foreign_doc->'id'),1,gen_random_uuid());
   raise exception 'Foreign source accepted';
 exception when insufficient_privilege then null; end;

 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','권한검증 질문지',
   'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',
   jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',foreign_doc->'id','text','', 'details','[]'::jsonb)))));
 begin
   perform public.save_questionnaire_draft(d,0,gen_random_uuid());
   raise exception 'Private question copied through placement RPC';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',(select id::text from visibility_users where role='admin'),true);
 result:=public.list_questions_page('권한검증',1);
 if (result->>'total')::int<>2 then raise exception 'Admin missing questions'; end if;
 if exists(select 1 from jsonb_array_elements(result->'blocks') b where b->>'creator_name' not in ('작성자 A','작성자 B') or b->>'creator_name' is null) then raise exception 'Creator name missing'; end if;
 if (select count(*) from public.question_details where question_id in(select (doc->>'id')::uuid from visibility_docs))<>2 then raise exception 'Admin missing explanations'; end if;
 perform set_config('request.jwt.claim.sub',(select id::text from visibility_users where role='consultant'),true);
 if (public.list_questions_page('권한검증',1)->>'total')::int<>0 then raise exception 'Consultant sees questions'; end if;
end $$;
reset role;
rollback;
