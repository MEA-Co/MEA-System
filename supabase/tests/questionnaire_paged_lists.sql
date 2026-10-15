begin;
create temp table list_users as select gen_random_uuid() id, role from unnest(array['owner','other','admin','consultant','student']) role;
insert into auth.users(id) select id from list_users;
insert into public.profiles(id,role,name,student_period) select id,case when role in ('owner','other') then 'consultant_lead' else role end,'목록 테스트 '||role,case when role='student' then '예비고1' end from list_users;
create temp table list_fixture as
select gen_random_uuid() id,n,'draft'::text status,'owner'::text owner,false archived from generate_series(1,1007) n
union all select gen_random_uuid(),n,'draft','other',false from generate_series(1,5) n
union all select gen_random_uuid(),n,'in_review','other',false from generate_series(1,4) n
union all select gen_random_uuid(),n,'published','other',false from generate_series(1,23) n
union all select gen_random_uuid(),n,'draft',r,true from generate_series(1,2) n cross join unnest(array['owner','other']) r;
insert into public.questionnaires(id,title,status,created_by,updated_at,review_started_at,published_at,archived_at)
select f.id,'__list_test__ '||f.status||' '||f.n,f.status,u.id,'2020-01-01'::timestamptz+f.n*interval '1 second',
case when f.status<>'draft' then '2020-01-01'::timestamptz end,
case when f.status='published' then '2020-01-01'::timestamptz+(24-f.n)*interval '1 second' end,
case when f.archived then now() end from list_fixture f join list_users u on u.role=f.owner;
-- Literal wildcard characters must not act as SQL search patterns.
update public.questionnaires set title='__list_test__ 100%_literal' where id=(select id from list_fixture where status='draft' and owner='owner' and not archived and n=1007);
insert into public.response_sessions(respondent_id,origin_questionnaire_id,started_role,started_stage,status,submitted_at)
select u.id,f.id,'consultant','published',case when f.n=1 then 'submitted' else 'in_progress' end,case when f.n=1 then now() end
from list_users u cross join list_fixture f where u.role='consultant' and f.status='published' and f.n in (1,2);
insert into public.response_submissions(session_id,answers,revision)
select s.id,'{}'::jsonb,1 from public.response_sessions s join list_users u on u.id=s.respondent_id
where u.role='consultant' and s.status='submitted';
grant select on list_users,list_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from list_users where role='owner'),true);
set local role authenticated;
do $$ declare r jsonb; id uuid; begin
 r:=public.list_questionnaires(p_search=>'__list_test__',p_view_role=>'consultant_lead');
 if r->>'total'<>'1034' or r#>>'{groups,0,total}'<>'1007' or jsonb_array_length(r#>'{groups,0,items}')<>2
   or jsonb_array_length(r#>'{groups,1,items}')<>2 or jsonb_array_length(r#>'{groups,2,items}')<>10 then raise exception 'Overview counts/limits: %',r; end if;
 r:=public.list_questionnaires('draft','__list_test__','all',101,'consultant_lead');
 if r->>'total'<>'1007' or r->>'page'<>'101' or jsonb_array_length(r->'items')<>7 then raise exception 'Page past 1000: %',r; end if;
 select f.id into id from list_fixture f where f.status='draft' and f.owner='owner' and not f.archived and f.n=1;
 if public.questionnaire_list_items(array[id],'consultant_lead')#>>'{0,id}' is distinct from id::text then raise exception 'Direct ID lookup'; end if;
 r:=public.list_questionnaires('draft','__list_test__','all',100000,'consultant_lead');
 if r->>'page'<>'101' then raise exception 'Page clamping'; end if;
 r:=public.list_questionnaires('all','%_literal','all',1,'consultant_lead');
 if r->>'total'<>'1' then raise exception 'Literal search'; end if;
 r:=public.list_questionnaires('all','__LIST_TEST__','mine',1,'consultant_lead');
 if r->>'total'<>'1007' or r#>>'{groups,1,total}'<>'0' then raise exception 'Search/ownership before counts'; end if;
 r:=public.list_questionnaires('archived','__list_test__','all',1,'consultant_lead');
 if r->>'total'<>'2' then raise exception 'Own archives only'; end if;
 select f.id into id from list_fixture f where f.status='draft' and f.owner='other' and not f.archived limit 1;
 if public.questionnaire_list_items(array[id],'consultant_lead')<>'[]'::jsonb then raise exception 'Other draft exposed'; end if;
 begin perform public.list_questionnaires(p_view_role=>'admin'); raise exception 'Escalated view role'; exception when insufficient_privilege then null; end;
 begin perform public.list_questionnaires(p_page=>0,p_view_role=>'consultant_lead'); raise exception 'Invalid page allowed'; exception when invalid_parameter_value then null; end;
 r:=public.list_questionnaires('published','__list_test__','all',1,'consultant_lead');
 select f.id into id from list_fixture f where f.status='published' and f.n=1;
 if r#>>'{items,0,id}' is distinct from id::text or r#>>'{items,0,submittedResponseCount}'<>'1'
   or r#>>'{items,0,creatorName}'<>'목록 테스트 other' then raise exception 'Publication sort/count/author'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from list_users where role='admin'),true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.list_questionnaires('draft','__list_test__','all',1,'admin');
 if r->>'total'<>'1012' then raise exception 'Admin private draft scope'; end if;
 r:=public.list_questionnaires('draft','__list_test__','all',1,'consultant_lead');
 if r->>'total'<>'0' then raise exception 'Admin lead presentation leaked drafts'; end if;
 r:=public.list_questionnaires('archived','__list_test__','all',1,'admin');
 if r->>'total'<>'0' then raise exception 'Admin archive list changed scope'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from list_users where role='consultant'),true);
set local role authenticated;
do $$ declare r jsonb; id uuid; begin
 r:=public.list_questionnaires(p_view_role=>'consultant',p_response=>'complete');
 if r->>'total'<>'1' or r#>>'{items,0,responseStatus}'<>'submitted'
   or r#>>'{items,0,submittedResponseCount}'<>'0' or r#>>'{items,0,isOwner}'<>'false'
   or r#>>'{items,0,creatorName}' is not null then raise exception 'Consultant response scope'; end if;
 r:=public.list_questionnaires(p_view_role=>'consultant');
 if jsonb_array_length(r->'items')<>10 or (r#>>'{responseCounts,pending}')::integer<22 then raise exception 'Consultant paging/counts'; end if;
 select f.id into id from list_fixture f where f.status='in_review' limit 1;
 if public.questionnaire_list_items(array[id],'consultant')<>'[]'::jsonb then raise exception 'Consultant review exposure'; end if;
 begin perform public.list_questionnaires(p_view_role=>'admin'); raise exception 'Escalation'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from list_users where role='student'),true);
set local role authenticated;
do $$ begin
 begin perform public.list_questionnaires(); raise exception 'Student access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.list_questionnaires(text,text,text,integer,text,text)','execute')
   or has_function_privilege('anon','public.questionnaire_list_items(uuid[],text)','execute') then raise exception 'Anonymous ACL'; end if;
end $$;
rollback;
