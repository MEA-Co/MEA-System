begin;
create temporary table row_user as select gen_random_uuid() id;
insert into auth.users(id) select id from row_user;
insert into public.profiles(id,role,name) select id,'consultant_lead','행 설정 테스트' from row_user;
select set_config('request.jwt.claim.sub',(select id::text from row_user),true);
set local role authenticated;
do $$
declare d jsonb; r jsonb; sid uuid := gen_random_uuid();
begin
 d := jsonb_build_object('id',gen_random_uuid(),'title','행 설정','prompt','질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','repeatable','maxRows',5,'minRows',3,'rowLabels',jsonb_build_array('첫 번째','','세 번째'),'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null);
 r := public.save_question(d,0,sid);
 if (r->>'min_rows')::int <> 3 or r->'row_labels' <> d->'rowLabels' then raise exception 'Row settings not saved'; end if;
 if public.save_question(d,0,sid) <> r then raise exception 'Retry changed result'; end if;
 d := jsonb_set(d,'{minRows}','2');
 r := public.save_question(d,1,gen_random_uuid());
 if (r->>'min_rows')::int <> 2 then raise exception 'Update failed'; end if;
 begin
  perform public.save_question(jsonb_set(d,'{minRows}','6'),2,gen_random_uuid());
  raise exception 'Invalid minimum accepted';
 exception when check_violation then null; end;
 begin
  perform public.save_question(jsonb_set(d,'{rowLabels}','[123]'),2,gen_random_uuid());
  raise exception 'Invalid label accepted';
 exception when check_violation then null; end;
 d := jsonb_set(d - 'minRows' - 'rowLabels','{id}',to_jsonb(gen_random_uuid()));
 r := public.save_question(d,0,gen_random_uuid());
 if (r->>'min_rows')::int <> 1 or r->'row_labels' <> '[]' then raise exception 'Legacy defaults failed'; end if;
end $$;
rollback;
