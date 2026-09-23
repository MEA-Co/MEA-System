begin;
create temporary table detail_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant','admin']) role;
insert into auth.users(id) select id from detail_users;
insert into public.profiles(id,role,name) select id, case when role='other_lead' then 'consultant_lead' else role end, '설명 테스트' from detail_users;
grant select on detail_users to authenticated;
create temporary table detail_docs(doc jsonb);
insert into detail_docs values(jsonb_build_object('id',gen_random_uuid(),'title','','prompt','원문 질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null,'details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','예시','text','안내 본문','visibleToConsultants',true),jsonb_build_object('id',gen_random_uuid(),'title','의도','text','비공개 설명','visibleToConsultants',false))));
grant select on detail_docs to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from detail_users where role='consultant_lead'),true);
set local role authenticated;
do $$
declare d jsonb; r jsonb; sid uuid := gen_random_uuid(); other jsonb;
begin
 select doc into d from detail_docs;
 r := public.save_question(d,0,sid);
 if r->'details' <> d->'details' or r->>'prompt' <> '원문 질문' then raise exception 'Details round trip failed'; end if;
 if (select count(*) from public.question_details where question_id=(d->>'id')::uuid)<>2 then raise exception 'Separate storage failed'; end if;
 if public.save_question(d,0,sid)<>r then raise exception 'Retry failed'; end if;
 r := public.save_question(d-'details',1,gen_random_uuid());
 if r->'details'<>d->'details' then raise exception 'Legacy omission erased details'; end if;
 begin
  perform public.save_question(jsonb_set(d,'{details}','[]'),1,gen_random_uuid());
  raise exception 'Stale revision accepted';
 exception when serialization_failure then null; end;
 other := jsonb_set(d,'{id}',to_jsonb(gen_random_uuid()));
 begin
  perform public.save_question(other,0,gen_random_uuid());
  raise exception 'Cross question detail ID accepted';
 exception when invalid_parameter_value then null; end;
 if exists(select from public.questions where id=(other->>'id')::uuid) then raise exception 'Partial parent save survived'; end if;
 begin
  perform public.save_question(jsonb_set(d,'{details}',jsonb_build_array(d->'details'->0,d->'details'->0)),2,gen_random_uuid());
  raise exception 'Duplicate detail ID accepted';
 exception when invalid_parameter_value then null; end;
 begin
  insert into public.question_details(id,question_id,position) values(gen_random_uuid(),(d->>'id')::uuid,0);
  raise exception 'Direct insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.question_details set body='overwrite';
  raise exception 'Direct update allowed';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.question_details;
  raise exception 'Direct delete allowed';
 exception when insufficient_privilege then null; end;
 d := jsonb_set(d,'{details}',jsonb_build_array(jsonb_set(d->'details'->1,'{text}','"수정한 의도"')));
 r := public.save_question(d,2,gen_random_uuid());
 if r->'details'<>d->'details' then raise exception 'Edit/delete failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from detail_users where role='other_lead'),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.question_details where question_id=(select (doc->>'id')::uuid from detail_docs))<>1 then raise exception 'Staff cannot read details'; end if;
 begin
  perform public.save_question((select doc from detail_docs),3,gen_random_uuid());
  raise exception 'Other lead wrote details';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from detail_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 if exists(select from public.question_details) then raise exception 'Consultant can read staff library'; end if;
 begin
  perform public.save_question((select doc from detail_docs),3,gen_random_uuid());
  raise exception 'Consultant wrote details';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.question_details; raise exception 'Anon read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from detail_users where role='admin'),true);
set local role authenticated;
do $$ declare r jsonb; begin
 r := public.save_question(jsonb_set((select doc from detail_docs),'{details}','[]'),3,gen_random_uuid());
 if r->'details'<>'[]'::jsonb then raise exception 'Explicit removal failed'; end if;
 r := public.save_question((select doc from detail_docs),4,gen_random_uuid());
end $$;
reset role;
delete from public.questions where id=(select (doc->>'id')::uuid from detail_docs);
do $$ begin
 if exists(select from public.question_details where question_id=(select (doc->>'id')::uuid from detail_docs)) then raise exception 'Cascade failed'; end if;
end $$;
rollback;
