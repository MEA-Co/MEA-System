begin;
create temporary table question_page_users(id uuid, role text);
insert into question_page_users select gen_random_uuid(),role from unnest(array['consultant_lead','consultant','admin']) role;
insert into auth.users(id) select id from question_page_users;
insert into public.profiles(id,role,name) select id,role,'페이지 검증' from question_page_users;
grant select on question_page_users to authenticated;
set local role authenticated;
do $$
declare owner_id uuid; docs jsonb[]:='{}'; d jsonb; first_page jsonb; second_page jsonb; last_page jsonb; all_pages jsonb:='[]'::jsonb; result jsonb; i integer;
begin
 select id into owner_id from question_page_users where role='consultant_lead';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 for i in 1..45 loop
   d:=jsonb_build_object('id',gen_random_uuid(),'title','페이지검증 질문 '||lpad(i::text,2,'0'),'prompt',case when i=45 then '::mea-rich-text:v1::{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"진","marks":[{"type":"highlight"}]},{"type":"text","text":"로 Alpha"}]}]}' when i=44 then E'100%_정확한\\검색' else '일반 본문' end,'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single');
   perform public.save_question(d,0,gen_random_uuid()); docs:=array_append(docs,d);
 end loop;
 first_page:=public.list_questions_page('페이지검증',1);
 second_page:=public.list_questions_page('페이지검증',2);
 last_page:=public.list_questions_page('페이지검증',5);
 if (first_page->>'total')::int<>45 or jsonb_array_length(first_page->'blocks')<>10 or jsonb_array_length(second_page->'blocks')<>10 or jsonb_array_length(last_page->'blocks')<>5 then raise exception 'Wrong page size/count'; end if;
 for i in 1..5 loop
   result:=public.list_questions_page('페이지검증',i);
   if (result->>'pageSize')::int<>10 or jsonb_array_length(result->'blocks')>10 then raise exception 'Page exceeds ten'; end if;
   all_pages:=all_pages||(result->'blocks');
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(all_pages))<>45 then raise exception 'Pages overlap'; end if;
 if first_page<>public.list_questions_page('페이지검증',1) then raise exception 'Unstable tie sorting'; end if;
 if (public.list_questions_page('페이지검증',99)->>'page')::int<>5 then raise exception 'Invalid page not clamped'; end if;
 if (public.list_questions_page('  진로  ',1)->>'total')::int<>1 then raise exception 'Formatting split text not searched'; end if;
 if (public.list_questions_page('alpha',1)->>'total')::int<>1 then raise exception 'Case insensitive search failed'; end if;
 if (public.list_questions_page('%_',1)->>'total')::int<>1 then raise exception 'Wildcard was not literal'; end if;
 if (public.list_questions_page(E'\\검색',1)->>'total')::int<>1 then raise exception 'Backslash not literal'; end if;
 if (public.list_questions_page('highlight',1)->>'total')::int<>0 then raise exception 'Formatting metadata searched'; end if;
 if (public.list_questions_page('존재하지않는검색결과',1)->>'page')::int<>1 then raise exception 'Empty page invalid'; end if;
 d:=jsonb_set(docs[1],'{condition}',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',docs[2]->'id','op','answered'))));
 perform public.save_question(d,1,gen_random_uuid());
 result:=public.list_questions_page('페이지검증 질문 01',1);
 if jsonb_array_length(result->'references')<>1 or result#>>'{references,0,id}'<>docs[2]->>'id' then raise exception 'Off-page reference missing'; end if;
 if (result#>'{blocks,0}') ? 'details' or (result#>'{blocks,0}') ? 'search_text' then raise exception 'List leaked unnecessary detail payload'; end if;
 perform public.archive_question((docs[43]->>'id')::uuid,1);
 if (public.list_questions_page('페이지검증',1)->>'total')::int<>44 then raise exception 'Archived question included'; end if;
 d:=jsonb_set(docs[45],'{prompt}','"바뀐 본문"');
 perform public.save_question(d,1,gen_random_uuid());
 if (public.list_questions_page('진로',1)->>'total')::int<>0 or (public.list_questions_page('바뀐 본문',1)->>'total')::int<>1 then raise exception 'Search not updated after save'; end if;
 begin perform public.list_questions_page('',0); raise exception 'Invalid page accepted'; exception when invalid_parameter_value then null; end;
 perform set_config('request.jwt.claim.sub',(select id::text from question_page_users where role='consultant'),true);
 if (public.list_questions_page('페이지검증',1)->>'total')::int<>0 then raise exception 'RLS bypass'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.list_questions_page('',1); raise exception 'Anonymous access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
