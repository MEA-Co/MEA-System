begin;
create temp table review_page_users as select gen_random_uuid() id, role from unnest(array['owner','reviewer','consultant']) role;
insert into auth.users(id) select id from review_page_users;
insert into public.profiles(id,role,name) select id,case when role='consultant' then role else 'consultant_lead' end,'검토 페이지 테스트' from review_page_users;
create temp table review_page_fixture(qid uuid, vid uuid);
insert into review_page_fixture values(gen_random_uuid(),gen_random_uuid());
grant select on review_page_users,review_page_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from review_page_users where role='owner'),true);
set local role authenticated;
do $$ declare q uuid; v uuid; begin
 select qid,vid into q,v from review_page_fixture;
 perform public.save_question(jsonb_build_object('id',q,'title','','prompt','검토 대상','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null),0,gen_random_uuid());
 perform public.save_questionnaire_draft(jsonb_build_object('questionnaireId',v,'title','검토 질문지','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q,'text','','details','[]'::jsonb))))),0,gen_random_uuid());
 perform public.change_questionnaire_status(v,1,'draft',null,'in_review',gen_random_uuid(),2);
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from review_page_users where role='reviewer'),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from review_page_fixture;
 for i in 1..25 loop perform public.request_question_review(gen_random_uuid(),f.qid,f.vid,'요청 '||i); end loop;
 if not (public.read_question_review_page(f.qid,f.vid)->>'canRequest')::boolean then raise exception 'Reviewer cannot request'; end if;
 if not (public.read_question_review_page(f.qid,gen_random_uuid())->>'canRequest')::boolean then raise exception 'Legacy context changed permissions'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from review_page_users where role='owner'),true);
set local role authenticated;
do $$ declare f record; r record; first_page jsonb; second_page jsonb; last_page jsonb; pending jsonb; begin
 select * into f from review_page_fixture;
 for r in select id from public.question_review_requests where question_id=f.qid order by id limit 23 loop perform public.resolve_question_review(r.id,f.qid); end loop;
 pending:=public.read_question_review_page(f.qid,f.vid);
 if jsonb_array_length(pending->'reviews')<>2 or (pending->>'pendingCount')::int<>2 or (pending->>'completedCount')::int<>23 then raise exception 'Pending/count separation failed'; end if;
 if (pending->>'canRequest')::boolean or not (pending->>'canResolve')::boolean then raise exception 'Owner permission changed'; end if;
 first_page:=public.read_question_review_page(f.qid,f.vid,true,1);
 second_page:=public.read_question_review_page(f.qid,f.vid,true,2);
 last_page:=public.read_question_review_page(f.qid,f.vid,true,3);
 if jsonb_array_length(first_page->'reviews')<>10 or jsonb_array_length(second_page->'reviews')<>10 or jsonb_array_length(last_page->'reviews')<>3 or (last_page->>'hasMore')::boolean then raise exception 'History pagination failed'; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'reviews') a join jsonb_array_elements(second_page->'reviews') b on a->>'id'=b->>'id') then raise exception 'Unstable page order'; end if;
 if jsonb_array_length(first_page->'unreadIds')<>0 then raise exception 'History carries unread IDs'; end if;
 perform public.mark_question_reviews_read(f.qid,array(select value::uuid from jsonb_array_elements_text(pending->'unreadIds')));
 if jsonb_array_length(public.read_question_review_page(f.qid)->'unreadIds')<>0 then raise exception 'Batch read failed'; end if;
 begin perform public.read_question_review_page(f.qid,null,true,0); raise exception 'Invalid page accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from review_page_users where role='consultant'),true);
set local role authenticated;
do $$ begin
 begin perform public.read_question_review_page((select qid from review_page_fixture)); raise exception 'Consultant read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.read_question_review_page(gen_random_uuid()); raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
