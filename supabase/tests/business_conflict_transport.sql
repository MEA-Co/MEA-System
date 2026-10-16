-- Run against local DB only. All fixtures are rolled back.
begin;
create temp table conflict_fixture as select gen_random_uuid() uid, gen_random_uuid() qid;
insert into auth.users(id) select uid from conflict_fixture;
insert into public.profiles(id,role,name) select uid,'consultant_lead','충돌 검증' from conflict_fixture;
grant select on conflict_fixture to authenticated;
select set_config('request.jwt.claim.sub',(select uid::text from conflict_fixture),true);
set local role authenticated;
do $$ declare doc jsonb; response jsonb; error_detail text; begin
 doc:=jsonb_build_object('id',(select qid from conflict_fixture),'title','원본','prompt','질문','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','single');
 perform public.save_question(doc,0,gen_random_uuid());
 begin
  perform public.save_question(jsonb_set(doc,'{title}','"덮어쓰기"'),0,gen_random_uuid());
  raise exception 'Stale save unexpectedly succeeded';
 exception when sqlstate 'PGRST' then
  get stacked diagnostics error_detail=PG_EXCEPTION_DETAIL;
  if SQLERRM::jsonb->>'code'<>'40001' or error_detail::jsonb->>'status'<>'409' then
   raise exception 'Legacy conflict contract changed';
  end if;
 end;
 if (select title from public.questions where id=(select qid from conflict_fixture))<>'원본' then
  raise exception 'Conflict overwrote saved content';
 end if;
 perform public.save_question(jsonb_set(doc,'{title}','"정상 수정"'),1,gen_random_uuid());
 if (select title from public.questions where id=(select qid from conflict_fixture))<>'정상 수정' then
  raise exception 'Valid revision failed';
 end if;
end $$;
reset role;
do $$ begin
 if exists(select from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private' and p.prokind='f' and p.prosrc ~ $re$errcode\s*=\s*'40001'$re$) then
  raise exception 'Business SQLSTATE 40001 remains';
 end if;
end $$;
rollback;
