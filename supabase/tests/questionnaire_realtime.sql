begin isolation level repeatable read;
create temporary table realtime_baseline as select id from realtime.messages;
grant select on realtime_baseline to authenticated, anon;
create temporary table workflow_users(id uuid, role text);
insert into workflow_users select gen_random_uuid(),role from unnest(array['student','consultant','consultant_lead','admin','reviewer_lead']) role;
insert into auth.users(id) select id from workflow_users;
insert into public.profiles(id,role,name,student_period)
select id,case when role='reviewer_lead' then 'consultant_lead' else role end,'검증 '||role,case when role='student' then '1학년 1학기' end from workflow_users;
create temporary table workflow_data(doc jsonb);
insert into workflow_data values(jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','워크플로 검증','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','질문','details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','비공개 의도','text','비공개 설명','visibleToConsultants',false),jsonb_build_object('id',gen_random_uuid(),'title','공개 의도','text','공개 설명','visibleToConsultants',true))))))));
grant select on workflow_users,workflow_data to authenticated;
set local role authenticated;
do $$
declare doc jsonb; vid uuid; owner_id uuid; admin_id uuid; review_id uuid := gen_random_uuid();
begin
 select d.doc into doc from workflow_data d; vid := (doc->>'versionId')::uuid;
 select id into owner_id from workflow_users where role='consultant_lead';
 select id into admin_id from workflow_users where role='admin';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 perform public.publish_questionnaire(vid,1);
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform public.request_questionnaire_review(review_id,vid,(doc#>>'{sections,0,questions,0,id}')::uuid,'검토 내용');
 perform public.mark_questionnaire_publication_read(vid);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.resolve_questionnaire_review(review_id);
 perform public.save_questionnaire_draft(jsonb_set(doc,'{title}','"수정"'),1,gen_random_uuid());
 perform public.distribute_questionnaire(vid,2);
 perform public.delete_questionnaire(vid,2);
 -- A hard delete must also notify subscribers, without broadcasting deleted content.
 doc := jsonb_set(jsonb_set(jsonb_set(doc,'{questionnaireId}',to_jsonb(gen_random_uuid())),
   '{versionId}',to_jsonb(gen_random_uuid())), '{sections}', '[]'::jsonb);
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 perform public.delete_questionnaire((doc->>'versionId')::uuid,1);
end $$;
reset role;

do $$
begin
 if (select count(*) from realtime.messages where id not in (select id from realtime_baseline) and topic='questionnaires:staff') <> 9 then
   raise exception 'Missing or excess staff notifications'; end if;
 if (select count(*) from realtime.messages where id not in (select id from realtime_baseline) and topic='questionnaires:distributed') <> 2 then
   raise exception 'Only distribution and archive should notify consultants'; end if;
 if (select count(*) from realtime.messages where id not in (select id from realtime_baseline) and topic like 'questionnaires:user:%') <> 1 then
   raise exception 'Read receipt must notify only its user'; end if;
 if exists(select 1 from realtime.messages where id not in (select id from realtime_baseline)
   and (not private or event <> 'changed' or payload - 'id' <> '{}'::jsonb)) then
   raise exception 'Questionnaire content leaked in notification'; end if;
 if has_function_privilege('authenticated','private.notify_questionnaire_change()','EXECUTE') then
   raise exception 'Clients can invoke privileged trigger'; end if;
end $$;

set local role authenticated;
do $$
declare member record; staff_count integer; distributed_count integer; receipt_count integer;
begin
 for member in select * from workflow_users loop
   perform set_config('request.jwt.claim.sub',member.id::text,true);
   perform set_config('realtime.topic','questionnaires:staff',true);
   select count(*) into staff_count from realtime.messages where id not in (select id from realtime_baseline);
   if staff_count <> (case when member.role in ('admin','consultant_lead','reviewer_lead') then 9 else 0 end) then
     raise exception 'Staff topic authorization incorrect for %',member.role; end if;
   perform set_config('realtime.topic','questionnaires:distributed',true);
   select count(*) into distributed_count from realtime.messages where id not in (select id from realtime_baseline);
   if distributed_count <> (case when member.role='student' then 0 else 2 end) then
     raise exception 'Distributed topic authorization incorrect for %',member.role; end if;
   perform set_config('realtime.topic','questionnaires:user:'||(select id::text from workflow_users where role='admin'),true);
   select count(*) into receipt_count from realtime.messages where id not in (select id from realtime_baseline);
   if receipt_count <> (case when member.role='admin' then 1 else 0 end) then
     raise exception 'Read receipts leaked to %',member.role; end if;
 end loop;
 perform set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='admin'),true);
 perform set_config('realtime.topic','questionnaires:staff',true);
 begin
   insert into realtime.messages(topic,extension,event,private,payload)
     values('questionnaires:staff','broadcast','changed',true,'{}');
   raise exception 'Client forged change notification';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
set local role anon;
do $$
begin
 if exists(select 1 from realtime.messages where id not in (select id from realtime_baseline)) then
   raise exception 'Anonymous user received notification'; end if;
end $$;
reset role;
select 'Questionnaire Realtime notifications and authorization passed' as result;
rollback;
