begin;
create temporary table study_solution_user as select gen_random_uuid() as id;
insert into auth.users(id) select id from study_solution_user;
insert into public.profiles(id,role,name) select id,'consultant','학습법 저장 회귀' from study_solution_user;
grant select on study_solution_user to authenticated;
set local role authenticated;
do $$
declare
 uid uuid; id uuid := gen_random_uuid(); sid uuid := gen_random_uuid(); r jsonb; vals jsonb;
begin
 select u.id into uid from study_solution_user u;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 vals := '{"title":"","category":"내신","subject":"수학","customSubject":"확률과 통계","problemSource":"student","problem":"기존 문제 원문","strategy":"오답 분석","practiceGuide":"순서대로 실천","practicePeriod":"","periodEnabled":false,"problemExperience":"학생 지도 경험\n둘째 줄","checklist":"첫 번째 기준\n두 번째 기준","followup":"다시 점검","resultDiagnosis":"보존할 진단","references":[]}'::jsonb;
 r := public.save_study(id,vals,'[]',0,sid);
 if r#>>'{values,problemSource}' <> 'self' or r#>>'{values,periodEnabled}' <> 'false'
    or r#>>'{values,problemExperience}' <> E'학생 지도 경험\n둘째 줄'
    or r#>>'{values,checklist}' <> E'첫 번째 기준\n두 번째 기준'
    or r#>>'{values,resultDiagnosis}' <> '보존할 진단'
 then raise exception 'New fields or legacy data lost'; end if;
 r := public.save_study(id,vals,'[]',0,sid);
 if (r->>'revision')::int <> 1 then raise exception 'Retry not idempotent'; end if;
 -- Old clients cannot clear new values by omitting the fields.
 r := public.save_study(id, vals - array['periodEnabled','problemExperience'], '[]',1,gen_random_uuid());
 if r#>>'{values,periodEnabled}' <> 'false' or r#>>'{values,problemExperience}' <> E'학생 지도 경험\n둘째 줄' then raise exception 'Legacy client erased fields'; end if;
 -- An unchecked period retains its text for re-enabling.
 r := public.save_study(id, vals || '{"practicePeriod":"2주"}', '[]',2,gen_random_uuid());
 if r#>>'{values,practicePeriod}' <> '2주' or r#>>'{values,periodEnabled}' <> 'false' then raise exception 'Disabled period text lost'; end if;
 begin
  perform public.save_study(gen_random_uuid(), vals || '{"periodEnabled":true}', '[]',0,gen_random_uuid());
  raise exception 'Enabled empty period accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(gen_random_uuid(), vals || '{"periodEnabled":"false"}', '[]',0,gen_random_uuid());
  raise exception 'String flag accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(gen_random_uuid(), vals || '{"problemExperience":null}', '[]',0,gen_random_uuid());
  raise exception 'Null experience accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(gen_random_uuid(), vals || '{"checklist":" \n "}', '[]',0,gen_random_uuid());
  raise exception 'Empty checklist accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(gen_random_uuid(), vals || '{"checklist":[]}', '[]',0,gen_random_uuid());
  raise exception 'Unexpected checklist array accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_study(id,vals,'[]',1,gen_random_uuid());
  raise exception 'Stale revision accepted';
 exception when serialization_failure then null; end;
 if has_table_privilege('authenticated','private.study_solution_backup_20261012','SELECT')
   or has_table_privilege('anon','private.study_solution_backup_20261012','SELECT') then
   raise exception 'Backup is exposed';
 end if;
end $$;
reset role;
rollback;
