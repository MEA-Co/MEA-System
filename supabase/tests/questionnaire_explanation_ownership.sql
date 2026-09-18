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
declare doc jsonb; vid uuid; qid uuid; note_id uuid:=gen_random_uuid(); owner_id uuid; author_id uuid; outsider_id uuid;
begin
 select d.doc into doc from workflow_data d;
 vid:=(doc->>'versionId')::uuid; qid:=(doc#>>'{sections,0,questions,0,id}')::uuid;
 select id into owner_id from workflow_users where role='consultant_lead';
 select id into author_id from workflow_users where role='reviewer_lead';
 select id into outsider_id from workflow_users where role='admin';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 if exists(select 1 from public.questionnaire_question_details where question_id=qid and created_by is distinct from owner_id) then raise exception 'Draft explanation author missing'; end if;
 perform public.publish_questionnaire(vid,1);
 perform set_config('request.jwt.claim.sub',author_id::text,true);
 perform public.add_questionnaire_explanation(note_id,vid,qid,'다른 리드 설명','본문',false);
 if not exists(select 1 from public.questionnaire_question_details where id=note_id and created_by=author_id) then raise exception 'External explanation author missing'; end if;
 perform set_config('request.jwt.claim.sub',outsider_id::text,true);
 begin
  perform public.update_questionnaire_explanation(vid,note_id,2,'수정','본문',false);
  raise exception 'Unrelated admin edited explanation'; exception when insufficient_privilege then null;
 end;
 begin
  perform public.delete_questionnaire_explanation(vid,note_id,2);
  raise exception 'Unrelated admin deleted explanation'; exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',author_id::text,true);
 perform public.update_questionnaire_explanation(vid,note_id,2,'작성자 수정','새 본문',true);
 perform public.update_questionnaire_explanation(vid,note_id,2,'작성자 수정','새 본문',true);
 if (select revision from public.questionnaire_versions where id=vid) <> 3 then raise exception 'Update retry bumped revision'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.update_questionnaire_explanation(vid,note_id,3,'제작자 수정','수정 본문',false);
 doc:=public.read_questionnaire_draft(vid);
 perform public.save_questionnaire_draft(doc,4,gen_random_uuid());
 if not exists(select 1 from public.questionnaire_question_details where id=note_id and created_by=author_id) then raise exception 'Owner save reassigned authorship'; end if;
 perform set_config('request.jwt.claim.sub',author_id::text,true);
 begin
  perform public.delete_questionnaire_explanation(vid,note_id,4);
  raise exception 'Stale deletion accepted'; exception when serialization_failure then null;
 end;
 perform public.delete_questionnaire_explanation(vid,note_id,5);
 if exists(select 1 from public.questionnaire_question_details where id=note_id) then raise exception 'Author delete failed'; end if;
 note_id:=gen_random_uuid();
 perform public.add_questionnaire_explanation(note_id,vid,qid,'새 설명','본문',false);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.delete_questionnaire_explanation(vid,note_id,7);
 if exists(select 1 from public.questionnaire_question_details where id=note_id) then raise exception 'Owner delete failed'; end if;
 perform set_config('request.jwt.claim.sub',author_id::text,true);
 note_id:=gen_random_uuid();
 perform public.add_questionnaire_explanation(note_id,vid,qid,'배포 설명','본문',false);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.distribute_questionnaire(vid,9);
 perform set_config('request.jwt.claim.sub',author_id::text,true);
 begin
  perform public.update_questionnaire_explanation(vid,note_id,9,'변경','본문',false);
  raise exception 'Distributed explanation edited'; exception when insufficient_privilege then null;
 end;
 begin
  perform public.delete_questionnaire_explanation(vid,note_id,9);
  raise exception 'Distributed explanation deleted'; exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select 'Explanation authorship, dual permissions, retries, conflicts and distribution lock passed' as result;
rollback;
