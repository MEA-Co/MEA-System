begin;
create temporary table questionnaire_publish_users(id uuid, role text);
insert into questionnaire_publish_users select gen_random_uuid(), role from unnest(array['student','consultant','consultant_lead','admin']) role;
insert into auth.users(id) select id from questionnaire_publish_users;
insert into public.profiles(id,role,name,student_period)
select id,role,'질문지 게시 검증',case when role='student' then '1학년 1학기' end from questionnaire_publish_users;
create temporary table questionnaire_publish_data(doc jsonb);
insert into questionnaire_publish_data values(jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','삭제 검증','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','질문','details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','의도','text','설명','visibleToConsultants',false))))))));
grant select on questionnaire_publish_users, questionnaire_publish_data to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_publish_users where role='consultant_lead'),true);
set local role authenticated;
select public.save_questionnaire_draft(doc,0,gen_random_uuid()) from questionnaire_publish_data;

do $$ begin
  begin
    perform public.publish_questionnaire((select (doc->>'versionId')::uuid from questionnaire_publish_data),2);
    raise exception 'Stale revision published';
  exception when serialization_failure then null; end;
end $$;
select public.publish_questionnaire((doc->>'versionId')::uuid,1) from questionnaire_publish_data;
-- Retrying the same publication is safe.
select public.publish_questionnaire((doc->>'versionId')::uuid,1) from questionnaire_publish_data;
do $$ begin
  if (select public.read_published_questionnaire((doc->>'versionId')::uuid) #>> '{sections,0,questions,0,details,0,text}' from questionnaire_publish_data) <> '설명' then
    raise exception 'Lead cannot read private explanation';
  end if;
  perform public.save_questionnaire_draft(doc,1,gen_random_uuid()) from questionnaire_publish_data;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_publish_users where role='consultant'),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.questionnaire_versions where id=(select (doc->>'versionId')::uuid from questionnaire_publish_data)) then raise exception 'consultant read published version'; end if;
  if exists(select 1 from public.questionnaire_questions where version_id=(select (doc->>'versionId')::uuid from questionnaire_publish_data)) then raise exception 'consultant read questions'; end if;
  if (select public.read_published_questionnaire((doc->>'versionId')::uuid) from questionnaire_publish_data) is not null then raise exception 'consultant read published RPC'; end if;
  begin
    perform public.publish_questionnaire((select (doc->>'versionId')::uuid from questionnaire_publish_data),1);
    raise exception 'consultant published';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_publish_users where role='student'),true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.questionnaire_versions where id=(select (doc->>'versionId')::uuid from questionnaire_publish_data)) then raise exception 'student read published version'; end if;
  if exists(select 1 from public.questionnaire_questions where version_id=(select (doc->>'versionId')::uuid from questionnaire_publish_data)) then raise exception 'student read questions'; end if;
  if (select public.read_published_questionnaire((doc->>'versionId')::uuid) from questionnaire_publish_data) is not null then raise exception 'student read published RPC'; end if;
  begin
    perform public.publish_questionnaire((select (doc->>'versionId')::uuid from questionnaire_publish_data),1);
    raise exception 'student published';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from questionnaire_publish_users where role='admin'),true);
set local role authenticated;
do $$ begin
  if (select public.read_published_questionnaire((doc->>'versionId')::uuid) from questionnaire_publish_data) is null then raise exception 'Admin cannot read published'; end if;
  perform set_config('request.jwt.claim.sub',(select id::text from questionnaire_publish_users where role='consultant_lead'),true);
  if (select public.delete_questionnaire((doc->>'versionId')::uuid,2) from questionnaire_publish_data) <> 'deleted' then raise exception 'Published version retained'; end if;
  if (select public.read_published_questionnaire((doc->>'versionId')::uuid) from questionnaire_publish_data) is not null then raise exception 'Archived version still listed'; end if;
end $$;
reset role;
rollback;
