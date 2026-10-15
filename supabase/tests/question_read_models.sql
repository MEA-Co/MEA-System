begin;
create temporary table read_model_users as
select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','admin','consultant']) role;
insert into auth.users(id) select id from read_model_users;
insert into public.profiles(id,role,name)
select id, case when role='other_lead' then 'consultant_lead' else role end, 'read model regression' from read_model_users;
create temporary table read_model_questions (name text, id uuid);
grant select on read_model_users,read_model_questions to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from read_model_users where role='consultant_lead'),true);
do $$ declare id uuid; source uuid; doc jsonb; begin
 for i in 1..3 loop
   id:=gen_random_uuid();
   doc:=jsonb_build_object('id',id,'title','read-model-'||i,'prompt','테스트','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),
     'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',case when i>1 then source else null end,
     'condition',case when i=3 then jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',source,'op','answered'))) else null end);
   perform public.save_question(doc,0,gen_random_uuid());
   insert into read_model_questions values('q'||i,id);
   if i=1 then source:=id; end if;
 end loop;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from read_model_users where role='other_lead'),true);
do $$ declare id uuid:=gen_random_uuid(); begin
 perform public.save_question(jsonb_build_object('id',id,'title','private','prompt','private','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),
   'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null),0,gen_random_uuid());
 insert into read_model_questions values('private',id);
end $$;
insert into public.question_review_requests(id,question_id,requested_by,requester_name,description,question_revision)
select gen_random_uuid(), (select id from read_model_questions where name='q1'),
 (select id from read_model_users where role='other_lead'), 'reviewer', 'test '||n,1 from generate_series(1,1005) n;
insert into public.question_review_reads(review_id,user_id)
select r.id,u.id from public.question_review_requests r cross join read_model_users u
where r.question_id=(select id from read_model_questions where name='q1') and u.role='consultant_lead' limit 1;
insert into public.question_review_requests(id,question_id,requested_by,requester_name,description,question_revision,resolved_at)
values(gen_random_uuid(),(select id from read_model_questions where name='q1'),(select id from read_model_users where role='other_lead'),'reviewer','resolved',1,now()),
(gen_random_uuid(),(select id from read_model_questions where name='private'),(select id from read_model_users where role='admin'),'reviewer','private',1,null);
select set_config('request.jwt.claim.sub',(select id::text from read_model_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare ids uuid[]; q uuid; hidden uuid; result jsonb; begin
 select array_agg(id) into ids from read_model_questions;
 select id into q from read_model_questions where name='q1';
 select id into hidden from read_model_questions where name='private';
 result:=public.question_review_counts(ids);
 if (result->'counts'->>q::text)::integer <> 1005 then raise exception 'Count truncated: %',result; end if;
 if (result->'unreadCounts'->>q::text)::integer <> 1004 then raise exception 'Unread mismatch: %',result; end if;
 if result->'counts' ? hidden::text then raise exception 'Private review leak'; end if;
 result:=public.question_incoming_references(array[q,q]);
 if jsonb_array_length(result)<>2 then raise exception 'Missing or duplicate dependencies: %',result; end if;
 if jsonb_array_length(public.question_incoming_references(array[hidden]))<>0 then raise exception 'Private references leak'; end if;
 begin perform public.question_review_counts(array[]::uuid[]); raise exception 'Empty IDs accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.question_incoming_references(array_fill(q,array[11])); raise exception 'Excess IDs accepted'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from read_model_users where role='admin'),true);
set local role authenticated;
do $$ declare q uuid; r jsonb; begin
 select id into q from read_model_questions where name='private';
 r:=public.question_review_counts(array[q]);
 if (r->'counts'->>q::text)::integer<>1 or (r->'unreadCounts'->>q::text)::integer<>0 then raise exception 'Admin visibility/unread incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from read_model_users where role='consultant'),true);
set local role authenticated;
do $$ declare q uuid; begin
 select id into q from read_model_questions limit 1;
 begin perform public.question_review_counts(array[q]); raise exception 'Consultant count access'; exception when insufficient_privilege then null; end;
 begin perform public.question_incoming_references(array[q]); raise exception 'Consultant reference access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.question_review_counts(array[gen_random_uuid()]); raise exception 'Anonymous count access'; exception when insufficient_privilege then null; end;
 begin perform public.question_incoming_references(array[gen_random_uuid()]); raise exception 'Anonymous reference access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
