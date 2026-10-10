begin;
create temporary table study_question_user as select gen_random_uuid() id;
insert into auth.users(id) select id from study_question_user;
insert into public.profiles(id,role,name) select id,'consultant_lead','공부법 질문 테스트' from study_question_user;
select set_config('request.jwt.claim.sub',(select id::text from study_question_user),true);
set local role authenticated;
do $$
declare d jsonb; r jsonb; sid uuid := gen_random_uuid(); fid uuid := gen_random_uuid();
begin
 d := jsonb_build_object('id',gen_random_uuid(),'title','공부법 참조','prompt','활동을 첨부해 주세요','fields',jsonb_build_array(jsonb_build_object('id',fid,'label','공부법','kind','study'),jsonb_build_object('id',gen_random_uuid(),'label','설명','kind','text')),'rowMode','repeatable','maxRows',5,'minRows',2,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 r := public.save_question(d,0,sid);
 if r->'fields' <> d->'fields' then raise exception 'Study field not preserved'; end if;
 if (select fields from public.questions where id=(d->>'id')::uuid) <> d->'fields' then raise exception 'Readback failed'; end if;
 if public.save_question(d,0,sid) <> r then raise exception 'Retry changed result'; end if;
 d := jsonb_set(d,'{fields,0,label}','"관련 공부법"');
 r := public.save_question(d,1,gen_random_uuid());
 if r->'fields' <> d->'fields' then raise exception 'Update lost field'; end if;
 begin
  perform public.save_question(jsonb_set(d,'{fields,0,kind}','"invalid"'),2,gen_random_uuid());
  raise exception 'Invalid kind accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_question(jsonb_set(d,'{fields,0,label}','""'),2,gen_random_uuid());
  raise exception 'Empty field label accepted';
 exception when invalid_parameter_value then null; end;
end $$;
rollback;
