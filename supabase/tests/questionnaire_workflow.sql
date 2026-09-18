begin;
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
declare doc jsonb; vid uuid; owner_id uuid; reviewer_id uuid; review_id uuid:=gen_random_uuid(); role_name text; actor_id uuid; received jsonb;
begin
 select d.doc into doc from workflow_data d;
 vid:=(doc->>'versionId')::uuid;
 select id into owner_id from workflow_users where role='consultant_lead';
 select id into reviewer_id from workflow_users where role='admin';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 begin
   perform public.distribute_questionnaire(vid,1); raise exception 'Distributed draft';
 exception when sqlstate '55000' then null; end;
 begin
   perform public.publish_questionnaire(vid,2); raise exception 'Stale publication';
 exception when serialization_failure then null; end;
 perform public.publish_questionnaire(vid,1);
 perform public.publish_questionnaire(vid,1);
 doc:=jsonb_set(doc,'{title}','"게시 후 수정"');
 perform public.save_questionnaire_draft(doc,1,gen_random_uuid());
 if (public.read_questionnaire_draft(vid)->>'title') is distinct from '게시 후 수정' then raise exception 'Creator could not edit published document'; end if;
 for role_name,actor_id in select role,id from workflow_users where role in ('admin','reviewer_lead') loop
   perform set_config('request.jwt.claim.sub',actor_id::text,true);
   received:=public.read_published_questionnaire(vid);
   if jsonb_array_length(received#>'{sections,0,questions,0,details}') is distinct from 2 then raise exception 'Reviewer cannot see all explanations'; end if;
   begin perform public.save_questionnaire_draft(doc,2,gen_random_uuid()); raise exception 'Non-owner edited'; exception when insufficient_privilege then null; end;
   begin perform public.distribute_questionnaire(vid,2); raise exception 'Non-owner distributed'; exception when insufficient_privilege then null; end;
   begin perform public.publish_questionnaire(vid,2); raise exception 'Non-owner published'; exception when insufficient_privilege then null; end;
   perform public.request_questionnaire_review(case when role_name='admin' then review_id else gen_random_uuid() end,vid,'설명을 검토해 주세요.');
 end loop;
 perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
 perform public.request_questionnaire_review(review_id,vid,'설명을 검토해 주세요.');
 if (select count(*) from public.questionnaire_review_requests where version_id=vid)<>1 then raise exception 'Review idempotency/privacy failed'; end if;
 begin perform public.resolve_questionnaire_review(review_id); raise exception 'Non-owner resolved'; exception when insufficient_privilege then null; end;
 for role_name,actor_id in select role,id from workflow_users where role in ('student','consultant') loop
   perform set_config('request.jwt.claim.sub',actor_id::text,true);
   if public.read_published_questionnaire(vid) is not null then raise exception 'Published document leaked'; end if;
   if exists(select 1 from public.questionnaires where id=(doc->>'questionnaireId')::uuid) then raise exception 'Published metadata leaked'; end if;
   if exists(select 1 from public.questionnaire_questions where version_id=vid) then raise exception 'Published question leaked'; end if;
   begin perform public.request_questionnaire_review(gen_random_uuid(),vid,'요청'); raise exception 'Unauthorized review'; exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if (select count(*) from public.questionnaire_review_requests where version_id=vid and resolved_at is null)<>2 then raise exception 'Owner missing reviews'; end if;
 perform public.resolve_questionnaire_review(review_id);
 perform public.resolve_questionnaire_review(review_id);
 if (select count(*) from public.questionnaire_review_requests where version_id=vid and resolved_at is null)<>1 then raise exception 'Review not resolved'; end if;
 -- An uncertain request retry after resolution must not recreate an open request.
 perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
 perform public.request_questionnaire_review(review_id,vid,'설명을 검토해 주세요.');
 if exists(select 1 from public.questionnaire_review_requests where id=review_id and resolved_at is null) then raise exception 'Resolved review resurrected'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin perform public.distribute_questionnaire(vid,1); raise exception 'Stale distribution'; exception when serialization_failure then null; end;
 perform public.distribute_questionnaire(vid,2);
 perform public.distribute_questionnaire(vid,2);
 begin perform public.save_questionnaire_draft(doc,2,gen_random_uuid()); raise exception 'Distributed content edited'; exception when sqlstate '55000' then null; end;
 perform set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='consultant'),true);
 received:=public.read_published_questionnaire(vid);
 if received is null or jsonb_array_length(received#>'{sections,0,questions,0,details}') is distinct from 1 then raise exception 'Consultant visibility failed'; end if;
 if received#>>'{sections,0,questions,0,details,0,text}' is distinct from '공개 설명' then raise exception 'Private detail leaked'; end if;
 if exists(select 1 from public.questionnaire_question_details where question_id=(doc#>>'{sections,0,questions,0,id}')::uuid and not visible_to_consultants) then raise exception 'Direct private detail leaked'; end if;
 begin perform public.request_questionnaire_review(gen_random_uuid(),vid,'요청'); raise exception 'Consultant requested review after distribution'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.questionnaire_review_requests where version_id=vid) then raise exception 'Reviews leaked to consultant'; end if;
 perform set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='student'),true);
 if public.read_published_questionnaire(vid) is not null then raise exception 'Student read distributed'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if public.delete_questionnaire(vid,2)<>'archived' then raise exception 'Distributed version destroyed'; end if;
 perform set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='consultant'),true);
 if public.read_published_questionnaire(vid) is not null then raise exception 'Archived document leaked'; end if;
end $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.distribute_questionnaire(uuid,integer)','execute') or has_function_privilege('anon','public.request_questionnaire_review(uuid,uuid,text)','execute') then raise exception 'Anonymous mutation access'; end if;
 if has_table_privilege('authenticated','public.questionnaire_review_requests','insert') then raise exception 'Direct review writes allowed'; end if;
end $$;
select 'Questionnaire workflow checks passed' as result;
rollback;
