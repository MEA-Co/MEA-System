begin;
create temporary table workflow_users(id uuid, role text);
insert into workflow_users select gen_random_uuid(),role from unnest(array['student','consultant','consultant_lead','admin','reviewer_lead']) role;
insert into auth.users(id) select id from workflow_users;
insert into public.profiles(id,role,name,student_period)
select id,case when role='reviewer_lead' then 'consultant_lead' else role end,'검증 '||role,case when role='student' then '1학년 1학기' end from workflow_users;
create temporary table workflow_data(doc jsonb);
insert into workflow_data values(jsonb_build_object('questionnaireId',gen_random_uuid(),'versionId',gen_random_uuid(),'title','워크플로 검증','sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'text','질문','details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','비공개 의도','text','비공개 설명','visibleToConsultants',false),jsonb_build_object('id',gen_random_uuid(),'title','공개 의도','text','공개 설명','visibleToConsultants',true))))))));
grant select on workflow_users,workflow_data to authenticated;
set local role authenticated;
do $$
declare doc jsonb; vid uuid; owner_id uuid; person uuid; qtext uuid:=gen_random_uuid(); qscale uuid:=gen_random_uuid(); qsingle uuid:=gen_random_uuid(); qmulti uuid:=gen_random_uuid(); one uuid:=gen_random_uuid(); two uuid:=gen_random_uuid(); choices jsonb; answers jsonb; original jsonb; loaded jsonb; saved_id uuid; pair_id uuid;
begin
 select d.doc into doc from workflow_data d;vid:=(doc->>'versionId')::uuid;
 select id into owner_id from workflow_users where role='consultant_lead';select id into person from workflow_users where role='consultant';
 choices:=jsonb_build_array(jsonb_build_object('id',one,'label','팀 프로젝트'),jsonb_build_object('id',two,'label','기타','isOther',true));
 doc:=jsonb_set(doc,'{sections,0,questions}',jsonb_build_array(
 jsonb_build_object('id',qtext,'logicalKey',gen_random_uuid(),'text','서술 질문','details','[]'::jsonb),
 jsonb_build_object('id',qscale,'logicalKey',gen_random_uuid(),'text','척도 질문','kind','scale','options','[]'::jsonb,'details','[]'::jsonb),
 jsonb_build_object('id',qsingle,'logicalKey',gen_random_uuid(),'text','하나 선택','kind','single','options',choices,'details','[]'::jsonb),
 jsonb_build_object('id',qmulti,'logicalKey',gen_random_uuid(),'text','여러 개 선택','kind','multiple','options',choices,'details','[]'::jsonb)));
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 original:=doc;
 doc:=jsonb_set(doc,'{sections,0,questions,2,options,0,label}','""'::jsonb);
 perform public.save_questionnaire_draft(doc,0,gen_random_uuid());
 begin perform public.publish_questionnaire(vid,1);raise exception 'Empty option published';exception when invalid_parameter_value then null;end;
 doc:=original;perform public.save_questionnaire_draft(doc,1,gen_random_uuid());
 loaded:=public.read_questionnaire_draft(vid);
 if loaded#>>'{sections,0,questions,0,kind}'<>'text' then raise exception 'Legacy text default changed';end if;
 if loaded#>>'{sections,0,questions,2,kind}'<>'single' or loaded#>'{sections,0,questions,2,options}'<>choices then raise exception 'Configuration lost';end if;
 perform public.publish_questionnaire(vid,2);perform public.distribute_questionnaire(vid,2);
 begin perform public.save_questionnaire_draft(doc,2,gen_random_uuid());raise exception 'Distributed types edited';exception when object_not_in_prerequisite_state then null;end;
 perform set_config('request.jwt.claim.sub',person::text,true);
 loaded:=public.read_published_questionnaire(vid);
 if loaded#>>'{sections,0,questions,3,kind}'<>'multiple' then raise exception 'Consultant cannot read type';end if;
 answers:=jsonb_build_object(qtext::text,'자유로운 서술 답변',qscale::text,'3',qsingle::text,jsonb_build_object('id',two,'text','직접 입력')::text,qmulti::text,jsonb_build_array(jsonb_build_object('id',two,'text','추가 경험'),one)::text);
 begin perform public.save_questionnaire_response(vid,jsonb_set(answers,array[qscale::text],'"6"'),0,gen_random_uuid(),false,'');raise exception 'Accepted invalid scale';exception when invalid_parameter_value then null;end;
 begin perform public.save_questionnaire_response(vid,jsonb_set(answers,array[qsingle::text],to_jsonb(gen_random_uuid()::text)),0,gen_random_uuid(),false,'');raise exception 'Accepted unknown option';exception when invalid_parameter_value then null;end;
 begin perform public.save_questionnaire_response(vid,jsonb_set(answers,array[qmulti::text],to_jsonb(jsonb_build_array(one,one)::text)),0,gen_random_uuid(),false,'');raise exception 'Accepted duplicate selection';exception when invalid_parameter_value then null;end;
 begin perform public.save_questionnaire_response(vid,jsonb_set(answers,array[qsingle::text],to_jsonb(jsonb_build_object('id',two,'text','')::text)),0,gen_random_uuid(),true,'');raise exception 'Accepted empty other on completion';exception when invalid_parameter_value then null;end;
 saved_id:=gen_random_uuid();perform public.save_questionnaire_response(vid,answers,0,saved_id,false,'추가 설명');perform public.save_questionnaire_response(vid,answers,0,saved_id,false,'추가 설명');
 if not exists(select 1 from public.questionnaire_answers where question_id=qscale and body='3점 · 보통이다' and selection='3'::jsonb) then raise exception 'Scale not readable';end if;
 if not exists(select 1 from public.questionnaire_answers where question_id=qsingle and body='기타: 직접 입력' and selection=to_jsonb(jsonb_build_object('id',two,'text','직접 입력')::text)) then raise exception 'Single not readable';end if;
 if not exists(select 1 from public.questionnaire_answers where question_id=qmulti and body='팀 프로젝트, 기타: 추가 경험' and selection=jsonb_build_array(jsonb_build_object('id',two,'text','추가 경험'),one)) then raise exception 'Multiple not readable';end if;
 select id into pair_id from public.questionnaire_answers where question_id=qmulti;
 answers:=jsonb_set(answers,array[qmulti::text],to_jsonb(jsonb_build_array(one)::text));
 perform public.save_questionnaire_response(vid,answers,1,gen_random_uuid(),true,'추가 설명');
 if not exists(select 1 from public.questionnaire_answers where id=pair_id and body='팀 프로젝트') then raise exception 'Pair ID changed';end if;
 begin perform public.save_questionnaire_response(vid,answers,2,gen_random_uuid(),false,'');raise exception 'Edited submitted';exception when object_not_in_prerequisite_state then null;end;
end $$;
reset role;
select 'Other answers: RPC round trip, readable text, validation and stable IDs passed' as result;
rollback;
