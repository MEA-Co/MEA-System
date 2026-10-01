begin;
create temporary table recommendation_user as select gen_random_uuid() id;
insert into auth.users(id) select id from recommendation_user;
insert into public.profiles(id,role,name) select id,'consultant_lead','서술형 권장 옵션 테스트' from recommendation_user;
select set_config('request.jwt.claim.sub',(select id::text from recommendation_user),true);
set local role authenticated;
do $$
declare d jsonb; r jsonb; save_id uuid:=gen_random_uuid(); revision integer;
begin
 d:=jsonb_build_object('id',gen_random_uuid(),'title','','prompt','탐구활동을 참고해 작성해 주세요',
   'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text','explorationRecommended',true)),
   'rowMode','single','maxRows',null,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 r:=public.save_question(d,0,save_id);
 if r#>>'{fields,0,explorationRecommended}' is distinct from 'true' then raise exception 'Enabled setting lost'; end if;
 if (select fields from public.questions where id=(d->>'id')::uuid) is distinct from d->'fields' then raise exception 'Readback changed'; end if;
 if public.save_question(d,0,save_id) is distinct from r then raise exception 'Retry changed setting'; end if;
 revision:=(r->>'revision')::integer;
 d:=jsonb_set(d,'{fields,0,explorationRecommended}','false');
 r:=public.save_question(d,revision,gen_random_uuid());
 if r#>>'{fields,0,explorationRecommended}' is distinct from 'false' then raise exception 'Disabled setting lost'; end if;
 revision:=(r->>'revision')::integer;
 begin
  perform public.save_question(jsonb_set(d,'{fields,0,explorationRecommended}','"true"'),revision,gen_random_uuid());
  raise exception 'String recommendation accepted';
 exception when check_violation or invalid_parameter_value then null; end;
 begin
  perform public.save_question(jsonb_set(d,'{fields,0,kind}','"exploration"'),revision,gen_random_uuid());
  raise exception 'Recommendation accepted on non-text';
 exception when check_violation or invalid_parameter_value then null; end;
 d:=d#-'{fields,0,explorationRecommended}';
 r:=public.save_question(d,revision,gen_random_uuid());
 if r->'fields' is distinct from d->'fields' then raise exception 'Legacy field without setting changed'; end if;
end $$;
rollback;
