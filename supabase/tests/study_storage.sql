begin;
create temporary table study_test_users(id uuid, role text);
insert into study_test_users select gen_random_uuid(), r from unnest(array['consultant','consultant_other','consultant_lead','admin','student']) r;
insert into auth.users(id) select id from study_test_users;
insert into public.profiles(id,role,name,student_period) select id,case when role='consultant_other' then 'consultant' else role end,'학습법 회귀',case when role='student' then '1학년 1학기' end from study_test_users;
grant select on study_test_users to authenticated;
create temporary table study_test_doc(id uuid, owner_id uuid, vals jsonb, save_id uuid, report jsonb);
insert into study_test_doc
select gen_random_uuid(),id,jsonb_build_object('category','내신','problemSource','self','subject','수학','customSubject','','problem','시간 부족','strategy','오답 분석','practiceGuide','매일 오답 풀이','practicePeriod','2주','checklist','오답률 확인','followup','유형별 추가 연습','resultDiagnosis','','references','[]'::jsonb),gen_random_uuid(),null
from study_test_users where role='consultant';
update study_test_doc set report=jsonb_build_array(jsonb_build_object('clientKey',gen_random_uuid(),'name','보고서.pdf','size',100,'type','application/pdf','lastModified',1,'path',owner_id||'/'||id||'/'||gen_random_uuid()||'.pdf'));
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'study-reports', report#>>'{0,path}', owner_id::text, '{"size":100}'::jsonb from study_test_doc;
update study_test_doc set report=jsonb_set(report,'{0,clientKey}',to_jsonb(split_part(split_part(report#>>'{0,path}','/',3),'.',1)));
grant select on study_test_doc to authenticated;
set local role authenticated;
do $$
declare d record; result jsonb; other_user uuid;
begin
 select * into d from study_test_doc;
 perform set_config('request.jwt.claim.sub',d.owner_id::text,true);
 -- Draft-like incomplete documents must not reach the DB.
 begin
  perform public.save_study(d.id,jsonb_set(d.vals,'{strategy}','"  "'), '[]',0,d.save_id);
  raise exception 'Blank topic accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(d.id,d.vals-'practiceGuide','[]',0,d.save_id);
  raise exception 'Missing required field accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(d.id,d.vals,jsonb_set(d.report,'{0,path}',to_jsonb(d.owner_id||'/'||d.id||'/'||gen_random_uuid()||'.pdf')),0,d.save_id);
  raise exception 'Missing upload accepted';
 exception when invalid_parameter_value then null; end;
 perform public.save_study(gen_random_uuid(), d.vals || '{"subject":"기타","customSubject":"","problemSource":"student"}'::jsonb,'[]',0,gen_random_uuid());
 perform public.save_study(gen_random_uuid(), d.vals || '{"subject":"수학","customSubject":"확률과 통계","problemSource":"self"}'::jsonb,'[]',0,gen_random_uuid());
 begin
  perform public.save_study(gen_random_uuid(),d.vals-'problemSource','[]',0,gen_random_uuid());
  raise exception 'Missing problem source accepted';
 exception when invalid_parameter_value then null; end;

 result := public.save_study(gen_random_uuid(), d.vals || '{"problemSource":"template","problem":"템플릿에서 채운 후 직접 수정한 문제 상황"}'::jsonb,'[]',0,gen_random_uuid());
 if result#>>'{values,problemSource}' <> 'template' or result#>>'{values,problem}' <> '템플릿에서 채운 후 직접 수정한 문제 상황' then raise exception 'Template source or edited text not saved'; end if;
 result := public.save_study((result->>'id')::uuid, d.vals || '{"problemSource":"template","problem":"수정 후 다시 저장한 문제 상황"}'::jsonb,'[]',1,gen_random_uuid());
 if result#>>'{values,problem}' <> '수정 후 다시 저장한 문제 상황' then raise exception 'Template update not saved'; end if;
 -- Both API and direct RPC callers must provide a supported category/subject.
 begin
  perform public.save_study(d.id,jsonb_set(d.vals,'{category}','"invalid"'),'[]',0,d.save_id);
  raise exception 'Unknown category accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(d.id,jsonb_set(d.vals,'{problemSource}','"unknown"'),'[]',0,d.save_id);
  raise exception 'Unknown problem source accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(d.id,jsonb_set(d.vals,'{resultDiagnosis}','123'),'[]',0,d.save_id);
  raise exception 'Invalid diagnosis accepted';
 exception when invalid_parameter_value then null; end;
 result:=public.save_study(d.id,d.vals,d.report,0,d.save_id);
 if result#>>'{values,problemSource}' <> 'self' then raise exception 'Problem source not saved'; end if;
 if (result->>'revision')::int<>1 then raise exception 'Invalid first revision'; end if;
 result:=public.save_study(d.id,d.vals,d.report,0,d.save_id);
 if (result->>'revision')::int<>1 then raise exception 'Retry duplicated save'; end if;
 begin
  perform public.save_study(d.id,jsonb_set(d.vals,'{strategy}','"changed"'),d.report,1,d.save_id);
  raise exception 'Reused save id accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.save_study(d.id,d.vals,d.report,0,gen_random_uuid());
  raise exception 'Stale revision accepted';
 exception when serialization_failure then null; end;
 -- Referenced files cannot be removed, even by the owner.
 if (select count(*) from storage.objects where bucket_id='study-reports' and name=d.report#>>'{0,path}')<>1 then raise exception 'Owner cannot read upload'; end if;
 -- Storage disallows SQL deletes itself; inspect the policy predicate as owner instead.
 if not exists(select 1 from public.study where id=d.id and reports @> jsonb_build_array(jsonb_build_object('path',d.report#>>'{0,path}'))) then raise exception 'Attachment is not protected'; end if;
 begin
  update public.study set revision=99 where id=d.id;
  raise exception 'Direct write allowed';
 exception when insufficient_privilege then null; end;
 for other_user in select id from study_test_users where id<>d.owner_id loop
  perform set_config('request.jwt.claim.sub',other_user::text,true);
  if exists(select 1 from public.study where id=d.id) <> (select role in ('admin','consultant_lead') from study_test_users where id=other_user) then raise exception 'Incorrect cross-owner read access'; end if;
  if exists(select 1 from storage.objects where bucket_id='study-reports' and name=d.report#>>'{0,path}') <> (select role in ('admin','consultant_lead') from study_test_users where id=other_user) then raise exception 'Incorrect cross-owner download access'; end if;
  begin
   perform public.save_study(d.id,d.vals,d.report,1,gen_random_uuid());
   raise exception 'Other account can edit';
  exception when insufficient_privilege then null; end;
  begin
   perform public.delete_study(d.id,1);
   raise exception 'Other account can delete';
  exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claim.sub',(select id::text from study_test_users where role='student'),true);
 begin
  perform public.save_study(gen_random_uuid(),d.vals,'[]',0,gen_random_uuid());
  raise exception 'Student can create';
 exception when insufficient_privilege then null; end;
 -- Both leads and administrators may create their own records.
 for other_user in select id from study_test_users where role in ('consultant_lead','admin') loop
  perform set_config('request.jwt.claim.sub',other_user::text,true);
  perform public.save_study(gen_random_uuid(),d.vals,'[]',0,gen_random_uuid());
 end loop;
 perform set_config('request.jwt.claim.sub',d.owner_id::text,true);
 result:=public.save_study(d.id,jsonb_set(d.vals,'{strategy}','"수정된 주제"'),'[]',1,gen_random_uuid());
 if (result->>'revision')::int<>2 then raise exception 'Confirmed record cannot be edited'; end if;
 begin
  perform public.delete_study(d.id,1);
  raise exception 'Stale delete accepted';
 exception when serialization_failure then null; end;
 perform public.delete_study(d.id,2);
 perform public.delete_study(d.id,2);
 if exists(select 1 from public.study where id=d.id and deleted_at is null) then raise exception 'Deletion failed'; end if;
 begin
  perform public.save_study(d.id,d.vals,d.report,0,d.save_id);
  raise exception 'Late retry resurrected deleted activity';
 exception when serialization_failure then null; end;
end $$;
reset role;
rollback;
