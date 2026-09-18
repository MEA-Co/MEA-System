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
declare doc jsonb; vid uuid; qid uuid; note_id uuid:=gen_random_uuid(); owner_id uuid; reviewer_id uuid; snapshot jsonb;
begin
 select d.doc into doc from workflow_data d;
 vid:=(doc->>'versionId')::uuid; qid:=(doc#>>'{sections,0,questions,0,id}')::uuid;
 select id into owner_id from workflow_users where role='consultant_lead';
 select id into reviewer_id from workflow_users where role='admin';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 begin
   perform public.add_questionnaire_explanation(note_id,vid,qid,'제목','본문',false);
   raise exception 'Draft accepted external explanation'; exception when insufficient_privilege then null;
 end;
 perform public.publish_questionnaire(vid,1);
 perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
 perform public.add_questionnaire_explanation(note_id,vid,qid,'제목','본문',false);
 perform public.add_questionnaire_explanation(note_id,vid,qid,'제목','본문',false);
 if (select revision from public.questionnaire_versions where id=vid) <> 2 then raise exception 'Retry bumped revision'; end if;
 if exists(select 1 from public.questionnaire_review_requests where version_id=vid) then raise exception 'Explanation became review'; end if;
 if not exists(select 1 from public.questionnaire_question_details where id=note_id and title='제목' and body='본문' and not visible_to_consultants) then raise exception 'Explanation not stored'; end if;
 begin
   perform public.add_questionnaire_explanation(note_id,vid,qid,'다른 제목','본문',false);
   raise exception 'Changed retry accepted'; exception when serialization_failure then null;
 end;
 begin
   perform public.add_questionnaire_explanation(gen_random_uuid(),vid,gen_random_uuid(),'제목','본문',false);
   raise exception 'Invalid question accepted'; exception when invalid_parameter_value then null;
 end;
 perform public.add_questionnaire_explanation(gen_random_uuid(),vid,qid,'공개 추가','공개 본문',true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin
   perform public.save_questionnaire_draft(doc,1,gen_random_uuid());
   raise exception 'Stale editor erased explanation'; exception when serialization_failure then null;
 end;
 perform set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='consultant'),true);
 begin
   perform public.add_questionnaire_explanation(gen_random_uuid(),vid,qid,'제목','본문',false);
   raise exception 'Consultant added explanation'; exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.distribute_questionnaire(vid,3);
 begin
   perform public.add_questionnaire_explanation(gen_random_uuid(),vid,qid,'제목','본문',false);
   raise exception 'Distributed questionnaire was changed'; exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',(select id::text from workflow_users where role='consultant'),true);
 snapshot:=public.read_published_questionnaire(vid);
 if jsonb_array_length(snapshot#>'{sections,0,questions,0,details}') <> 2 then raise exception 'Public explanation visibility incorrect'; end if;
 if exists(select 1 from jsonb_array_elements(snapshot#>'{sections,0,questions,0,details}') item where item->>'id'=note_id::text) then raise exception 'Private explanation leaked'; end if;
end $$;
reset role;
select 'Published explanations: permission, retry, conflict, visibility and review separation passed' as result;
rollback;
