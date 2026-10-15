begin;
create temp table author_test_users as select gen_random_uuid() id, role from unnest(array['admin','consultant_lead','consultant']) role;
insert into auth.users(id) select id from author_test_users;
insert into public.profiles(id,role,name) select id,role,'작성자 조회 회귀' from author_test_users;
create temp table author_test_docs as select gen_random_uuid() id, status, archived from (values ('draft',false),('in_review',false),('published',false),('published',true)) t(status,archived);
insert into public.questionnaires(id,created_by,title,status,review_started_at,published_at,archived_at)
select id,(select id from author_test_users where role='consultant_lead'),'작성자 조회 회귀',status,
case when status<>'draft' then now() end,case when status='published' then now() end,case when archived then now() end from author_test_docs;
do $$ declare r jsonb; u record; begin
 for u in select * from author_test_users where role in ('admin','consultant_lead') loop
  perform set_config('request.jwt.claim.sub',u.id::text,true);
  r:=public.shared_questionnaire_authors();
  if (select count(*) from jsonb_array_elements(r) a join author_test_docs d on d.id::text=a->>'questionnaireId')<>2 then raise exception 'Wrong author scope'; end if;
  if exists(select 1 from jsonb_array_elements(r) a join author_test_docs d on d.id::text=a->>'questionnaireId' where a->>'name'<>'작성자 조회 회귀') then raise exception 'Wrong author name'; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',(select id::text from author_test_users where role='consultant'),true);
 begin perform public.shared_questionnaire_authors(); raise exception 'Consultant allowed'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.shared_questionnaire_authors(); raise exception 'Anonymous allowed'; exception when insufficient_privilege then null; end;
end $$;
rollback;
