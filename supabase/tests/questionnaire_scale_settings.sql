begin;
create temporary table scale_test_users(id uuid, role text);
insert into scale_test_users values (gen_random_uuid(),'consultant_lead'),(gen_random_uuid(),'consultant');
insert into auth.users(id) select id from scale_test_users;
insert into public.profiles(id,role,name) select id,role,'척도 검증' from scale_test_users;
grant select on scale_test_users to authenticated;
set local role authenticated;
do $$
declare
  owner_id uuid; respondent_id uuid; version_id uuid := gen_random_uuid(); questionnaire_id uuid := gen_random_uuid();
  two_id uuid := gen_random_uuid(); nine_id uuid := gen_random_uuid(); doc jsonb; answers jsonb; loaded jsonb;
begin
  select id into owner_id from scale_test_users where role='consultant_lead';
  select id into respondent_id from scale_test_users where role='consultant';
  doc := jsonb_build_object(
    'questionnaireId',questionnaire_id,'versionId',version_id,'title','척도 검증',
    'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(
      jsonb_build_object('id',two_id,'logicalKey',gen_random_uuid(),'text','2점 질문','kind','scale','options','[]'::jsonb,
        'scaleConfig',jsonb_build_object('max',2,'low','','middle','보통이다','high','높음','allowText',false),'details','[]'::jsonb),
      jsonb_build_object('id',nine_id,'logicalKey',gen_random_uuid(),'text','9점 질문','kind','scale','options','[]'::jsonb,
        'scaleConfig',jsonb_build_object('max',9,'low','아주 낮음','middle','보통이다','high','아주 높음','allowText',true),'details','[]'::jsonb)
    ))));
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
  begin
    perform public.publish_questionnaire(version_id,1);
    raise exception 'Published an empty endpoint label';
  exception when invalid_parameter_value then null;
  end;
  doc := jsonb_set(doc,'{sections,0,questions,0,scaleConfig,low}','"낮음"'::jsonb);
  perform public.save_questionnaire_draft(doc,1,gen_random_uuid());
  loaded := public.read_questionnaire_draft(version_id);
  if loaded#>>'{sections,0,questions,0,scaleConfig,max}' <> '2'
    or loaded#>>'{sections,0,questions,1,scaleConfig,max}' <> '9' then
    raise exception 'Scale configuration was not restored';
  end if;
  perform public.publish_questionnaire(version_id,2);
  perform public.distribute_questionnaire(version_id,2);
  perform set_config('request.jwt.claim.sub',respondent_id::text,true);
  loaded := public.read_published_questionnaire(version_id);
  if loaded#>>'{sections,0,questions,1,scaleConfig,high}' <> '아주 높음' then
    raise exception 'Published scale configuration is missing';
  end if;
  answers := jsonb_build_object(two_id::text,'2',nine_id::text,'{"score":9,"text":"직접 쓴 이유"}');
  begin
    perform public.save_questionnaire_response(version_id,jsonb_set(answers,array[two_id::text],'"3"'),0,gen_random_uuid(),false,'');
    raise exception 'Accepted an out-of-range score';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_questionnaire_response(version_id,jsonb_set(answers,array[nine_id::text],'"{\"score\":10,\"text\":\"\"}"'),0,gen_random_uuid(),false,'');
    raise exception 'Accepted a score above nine';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_questionnaire_response(version_id,jsonb_set(answers,array[two_id::text],'"{\"score\":2,\"text\":\"불가\"}"'),0,gen_random_uuid(),false,'');
    raise exception 'Accepted text on a scale without optional text';
  exception when invalid_parameter_value then null;
  end;
  perform public.save_questionnaire_response(version_id,answers,0,gen_random_uuid(),true,'');
  if not exists(select 1 from public.questionnaire_answers where question_id=two_id and selection='2'::jsonb and body='2점 · 높음') then
    raise exception 'Even scale answer was not saved correctly';
  end if;
  if not exists(select 1 from public.questionnaire_answers where question_id=nine_id
    and selection='{"score":9,"text":"직접 쓴 이유"}'::jsonb and body=E'9점 · 아주 높음\n추가 답변: 직접 쓴 이유') then
    raise exception 'Optional written answer was not saved correctly';
  end if;
end $$;
reset role;
do $$
begin
  if private.scale_answer_text('{"max":9,"low":"낮음","middle":"보통이다","high":"높음","allowText":true}'::jsonb,'5') <> '5점 · 보통이다' then
    raise exception 'Odd midpoint label was not applied';
  end if;
end $$;
select 'Configurable scale and optional written answer passed' as result;
rollback;
