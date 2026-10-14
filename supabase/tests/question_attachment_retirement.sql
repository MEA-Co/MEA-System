\set ON_ERROR_STOP on
begin;
create temp table retirement_user as select gen_random_uuid() id;
insert into auth.users(id) select id from retirement_user;
insert into public.profiles(id,role,name) select id,'consultant_lead','첨부형 폐기 회귀' from retirement_user;
select set_config('request.jwt.claim.sub',(select id::text from retirement_user),true);
set local role authenticated;
do $$ declare doc jsonb; kind text; begin
 doc:=jsonb_build_object('id',gen_random_uuid(),'title','본문 참조','prompt','답변','fields',jsonb_build_array(
 jsonb_build_object('id',gen_random_uuid(),'kind','text','label','답변','studyRecommended',true,'explorationRecommended',true)),
 'rowMode','single','minRows',1,'rowLabels','[]'::jsonb,'details','[]'::jsonb);
 perform public.save_question(doc,0,gen_random_uuid());
 foreach kind in array array['exploration','study'] loop
   begin
     perform public.save_question(jsonb_set(doc,'{fields,0,kind}',to_jsonb(kind)),1,gen_random_uuid());
     raise exception 'Retired attachment kind accepted';
   exception when invalid_parameter_value then null; end;
 end loop;
end $$;
reset role;
do $$ declare kind text; begin
 foreach kind in array array['exploration','study'] loop
   if private.question_field_response_valid(jsonb_build_object('kind',kind),'',false)
     or private.question_field_response_valid(jsonb_build_object('kind',kind),gen_random_uuid()::text,true) then
     raise exception 'Retired answer kind accepted';
   end if;
 end loop;
 if exists(select 1 from public.questions q cross join lateral jsonb_array_elements(q.fields) f where f->>'kind' in ('exploration','study')) then raise exception 'Retired fields remain'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.questions'::regclass and tgenabled<>'O') then raise exception 'Question trigger disabled'; end if;
end $$;
rollback;
