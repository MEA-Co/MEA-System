begin;
create temporary table reference_user as select gen_random_uuid() id;
insert into auth.users(id) select id from reference_user;
insert into public.profiles(id,role,name) select id,'consultant_lead','응답 참조 검증' from reference_user;
select set_config('request.jwt.claim.sub',(select id::text from reference_user),true);
set local role authenticated;
do $$
declare src jsonb; dest jsonb; saved jsonb; save_id uuid := gen_random_uuid();
begin
 src := jsonb_build_object('id',gen_random_uuid(),'title','척도 항목','prompt','평가해 주세요',
   'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','점수','kind','scale','scaleMax',5)),
   'rowMode','repeatable','maxRows',5,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 perform public.save_question(src,0,gen_random_uuid());
 dest := jsonb_build_object('id',gen_random_uuid(),'title','','prompt','각 평가의 이유',
   'fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','이유','kind','text')),
   'rowMode','reference','maxRows',null,'sourceBlockId',src->'id','sourceFieldId',null,'afterBlockId',null,
   'condition',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',src->'id','op','answered'))));
 saved := public.save_question(dest,0,save_id);
 if saved->>'row_mode'<>'reference' or saved->>'source_field_id' is not null then raise exception 'Question reference failed'; end if;
 if public.save_question(dest,0,save_id)<>saved then raise exception 'Reference retry failed'; end if;
 begin
   perform public.save_question(jsonb_set(dest,'{condition}','null'),1,gen_random_uuid());
   raise exception 'Reference without condition accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.save_question(jsonb_set(dest,'{condition,clauses,0,op}','"equals"'),1,gen_random_uuid());
   raise exception 'Fieldless comparison accepted';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.save_question(jsonb_set(src,'{condition}',jsonb_build_object('mode','all','clauses',jsonb_build_array(jsonb_build_object('blockId',dest->'id','op','answered')))),1,gen_random_uuid());
   raise exception 'Dependency cycle accepted';
 exception when invalid_parameter_value then null; end;
 dest := dest || jsonb_build_object('rowMode','single','sourceBlockId',null);
 saved := public.save_question(dest,1,gen_random_uuid());
 if saved->>'row_mode'<>'single' or saved->>'source_block_id' is not null then raise exception 'Reference disable failed'; end if;
 if saved->'condition'<>dest->'condition' then raise exception 'Condition disappeared'; end if;
 dest := jsonb_set(dest || jsonb_build_object('rowMode','reference','sourceBlockId',src->'id'),'{condition,clauses,0,fieldId}',src->'fields'->0->'id');
 saved := public.save_question(dest,2,gen_random_uuid());
 if saved->'condition'<>dest->'condition' or saved->>'row_mode'<>'reference' then raise exception 'Answered column reference failed'; end if;
 begin
   perform public.save_question(jsonb_set(dest,'{condition,clauses,0,fieldId}',to_jsonb(gen_random_uuid())),3,gen_random_uuid());
   raise exception 'Missing answered column accepted';
 exception when invalid_parameter_value then null; end;

end $$;
reset role;
rollback;
