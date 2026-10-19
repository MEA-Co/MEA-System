begin;
create temp table image_users as select gen_random_uuid() id, role from unnest(array['owner','other','consultant']) role;
insert into auth.users(id) select id from image_users;
insert into public.profiles(id,role,name) select id,case when role='consultant' then role else 'consultant_lead' end,'사진 검증' from image_users;
create temp table image_fixture(qid uuid, nid uuid, iid uuid, unused uuid);
insert into image_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select on image_users,image_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from image_users where role='owner'),true);
set local role authenticated;
do $$ declare f record; q jsonb; doc jsonb; notice jsonb; begin
 select * into f from image_fixture;
 q:=jsonb_build_object('id',gen_random_uuid(),'title','질문','prompt','내용','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single','sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null,'details','[]'::jsonb);
 perform public.save_question(q,0,gen_random_uuid());
 notice:=jsonb_build_object('id',f.nid,'position','end','title','사진','body','','buttonLabel','');
 doc:=jsonb_build_object('questionnaireId',f.qid,'title','사진 검증','notices',jsonb_build_array(notice),'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','내용','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 insert into storage.objects(bucket_id,name,metadata) values
 ('questionnaire-notice-images',f.qid||'/'||f.nid||'/'||f.iid||'.webp','{"mimetype":"image/webp","size":100}'),
 ('questionnaire-notice-images',f.qid||'/'||f.nid||'/'||f.unused||'.webp','{"mimetype":"image/webp","size":100}');
 doc:=jsonb_set(doc,'{notices,0,images}',jsonb_build_array(jsonb_build_object('id',f.iid,'name','사진.webp')));
 perform public.save_questionnaire_draft(doc,1,gen_random_uuid());
 begin perform public.save_questionnaire_draft(jsonb_set(doc,'{notices,0,images,0,id}',to_jsonb(gen_random_uuid())),2,gen_random_uuid()); raise exception 'Missing file accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.save_questionnaire_draft(jsonb_set(doc,'{notices,0,images}',(doc#>'{notices,0,images}')||(doc#>'{notices,0,images}')),2,gen_random_uuid()); raise exception 'Duplicate image accepted'; exception when invalid_parameter_value then null; end;
 if (select count(*) from storage.objects where bucket_id='questionnaire-notice-images' and name like f.qid||'/%')<>2 then raise exception 'Owner cannot read uploads'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from image_users where role='other'),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from image_fixture;
 if exists(select 1 from storage.objects where bucket_id='questionnaire-notice-images' and name like f.qid||'/%') then raise exception 'Private draft photos leaked'; end if;
 begin insert into storage.objects(bucket_id,name) values('questionnaire-notice-images',f.qid||'/'||f.nid||'/'||gen_random_uuid()||'.webp'); raise exception 'Other author upload accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from image_users where role='owner'),true);
set local role authenticated;
select public.change_questionnaire_status((select qid from image_fixture),2,'draft',null,'in_review',gen_random_uuid(),2);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from image_users where role='other'),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from image_fixture;
 if not private.notice_image_access(f.qid||'/'||f.nid||'/'||f.iid||'.webp',true) then raise exception 'Review collaborator denied'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from image_users where role='owner'),true);
set local role authenticated;
select public.change_questionnaire_status((select qid from image_fixture),3,'in_review',null,'published',gen_random_uuid(),2);
reset role;
select set_config('request.jwt.claim.sub',(select id::text from image_users where role='consultant'),true);
set local role authenticated;
do $$ declare f record; begin
 select * into f from image_fixture;
 if (select count(*) from storage.objects where bucket_id='questionnaire-notice-images' and name like f.qid||'/%')<>1 then raise exception 'Published referenced image visibility is incorrect'; end if;
 if private.notice_image_access(f.qid||'/'||f.nid||'/'||f.iid||'.webp',true) then raise exception 'Published image writable'; end if;
 if private.notice_image_access('invalid/path/file.webp',false) then raise exception 'Malformed path accepted'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='questionnaire-notice-images') then raise exception 'Anonymous photo read accepted'; end if;
end $$;
reset role;
rollback;
