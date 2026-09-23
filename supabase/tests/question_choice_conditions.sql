begin;
create temporary table choice_condition_user as select gen_random_uuid() id;
insert into auth.users(id) select id from choice_condition_user;
insert into public.profiles(id,role,name) select id,'consultant_lead','선택지 조건 검증' from choice_condition_user;
select set_config('request.jwt.claim.sub',(select id::text from choice_condition_user),true);
set local role authenticated;
do $$
declare src jsonb; dest jsonb; result jsonb; single_id uuid := gen_random_uuid(); multi_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid(); a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); opts jsonb;
begin
 opts := jsonb_build_array(jsonb_build_object('id',a,'label','수시'),jsonb_build_object('id',b,'label','정시'));
 src := jsonb_build_object('id',gen_random_uuid(),'title','담당 전형','prompt','전형을 골라 주세요',
 'fields',jsonb_build_array(jsonb_build_object('id',single_id,'label','단일','kind','single','options',opts),
 jsonb_build_object('id',multi_id,'label','다수','kind','multiple','options',opts),
 jsonb_build_object('id',other_id,'label','직접입력포함','kind','multiple','options',opts || jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','직접 입력','isOther',true)))),
 'rowMode','repeatable','maxRows',5,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 perform public.save_question(src,0,gen_random_uuid());
 dest := jsonb_build_object('id',gen_random_uuid(),'title','','prompt','후속 질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),
 'rowMode','reference','maxRows',null,'sourceBlockId',src->'id','sourceFieldId',null,'afterBlockId',null,
 'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',src->'id','fieldId',single_id,'op','equals','value',a))));
 result := public.save_question(dest,0,gen_random_uuid());
 if result->'condition'<>dest->'condition' then raise exception 'Single choice condition was not saved'; end if;
 dest := jsonb_set(jsonb_set(dest,'{condition,clauses,0,fieldId}',to_jsonb(multi_id)),'{condition,clauses,0,op}','"includes"');
 result := public.save_question(dest,1,gen_random_uuid());
 if result->'condition'<>dest->'condition' then raise exception 'Multiple choice condition was not saved'; end if;
 begin
  perform public.save_question(jsonb_set(dest,'{condition,clauses,0,value}',to_jsonb(gen_random_uuid())),2,gen_random_uuid());
  raise exception 'Unknown choice accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_question(jsonb_set(dest,'{condition,clauses,0,fieldId}',to_jsonb(other_id)),2,gen_random_uuid());
  raise exception 'Direct input reference accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.save_question(jsonb_set(dest,'{condition,clauses,0,op}','"equals"'),2,gen_random_uuid());
  raise exception 'Wrong operator accepted';
 exception when invalid_parameter_value then null; end;
 result := public.save_question(dest || jsonb_build_object('rowMode','single','sourceBlockId',null),2,gen_random_uuid());
 if result->>'row_mode'<>'single' or result->'condition'<>dest->'condition' then raise exception 'Condition without reference failed'; end if;
end $$;
reset role;
rollback;
