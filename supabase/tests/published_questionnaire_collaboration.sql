begin;
create temporary table collaboration_users as select gen_random_uuid() id, role from unnest(array['owner','lead','consultant']) role;
insert into auth.users(id) select id from collaboration_users;
insert into public.profiles(id,role,name) select id,case when role='consultant' then role else 'consultant_lead' end,'공동 편집 검증' from collaboration_users;
create temporary table collaboration_docs(name text, q jsonb, d jsonb);
grant select on collaboration_users to authenticated;
grant all on collaboration_docs to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from collaboration_users where role='owner'),true);
set local role authenticated;
do $$ declare q jsonb; d jsonb; n text; begin
 foreach n in array array['published','draft','distributed'] loop
 q:=jsonb_build_object('id',gen_random_uuid(),'title',n,'prompt','원본','fields',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'label','답변','kind','text')),'rowMode','repeatable','maxRows',1,'minRows',1,'rowLabels','[]'::jsonb,'sourceBlockId',null,'sourceFieldId',null,'afterBlockId',null,'condition',null,'details',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','설명','text','설명','visibleToConsultants',true)));
 perform public.save_question(q,0,gen_random_uuid());
 d:=jsonb_build_object('questionnaireId',gen_random_uuid(),'title',n,'sections',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'title','섹션','questions',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'logicalKey',gen_random_uuid(),'sourceQuestionId',q->'id','text','원본','details','[]'::jsonb)))));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 if n<>'draft' then perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid()); end if;
 if n='distributed' then perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,2,'published',null,'distributed',gen_random_uuid()); end if;
 insert into collaboration_docs values(n,q,d);
 end loop;
 -- The locked source is also present in a published questionnaire.
 d:=jsonb_set(jsonb_set(d,'{questionnaireId}',to_jsonb(gen_random_uuid())),'{sections,0,id}',to_jsonb(gen_random_uuid()));
 d:=jsonb_set(d,'{sections,0,questions,0,id}',to_jsonb(gen_random_uuid()));
 perform public.save_questionnaire_draft(d,0,gen_random_uuid());
 perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,1,'draft',null,'published',gen_random_uuid());
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from collaboration_users where role='lead'),true);
set local role authenticated;
do $$ declare q jsonb; d jsonb; saved jsonb; n text; begin
 select c.q,c.d into q,d from collaboration_docs c where name='published';
 if public.read_questionnaire_draft((d->>'questionnaireId')::uuid) is null then raise exception 'Shared editor unreadable'; end if;
 if not exists(select 1 from public.questions where id=(q->>'id')::uuid) then raise exception 'Shared source unreadable'; end if;
 saved:=public.save_questionnaire_draft(d||'{"title":"리드 수정"}',2,gen_random_uuid());
 if (saved->>'revision')::int<>3 then raise exception 'Shared save failed'; end if;
 q:=jsonb_set(q,'{details,0,text}','"리드 설명 수정"');
 perform public.save_question(q||'{"prompt":"리드 원본 수정"}',1,gen_random_uuid());
 if (select created_by from public.questions where id=(q->>'id')::uuid)<>(select id from collaboration_users where role='owner') then raise exception 'Owner changed'; end if;
 begin perform public.save_question(q,1,gen_random_uuid()); raise exception 'Stale save accepted'; exception when serialization_failure then null; end;
 begin perform public.change_questionnaire_status((d->>'questionnaireId')::uuid,3,'published',null,'draft',gen_random_uuid()); raise exception 'Other lead changed status'; exception when insufficient_privilege then null; end;
 foreach n in array array['draft','distributed'] loop
 select c.q,c.d into q,d from collaboration_docs c where name=n;
 begin perform public.save_questionnaire_draft(d,1,gen_random_uuid()); raise exception 'Protected questionnaire edited'; exception when insufficient_privilege or object_not_in_prerequisite_state then null; end;
 begin perform public.save_question(q,1,gen_random_uuid()); raise exception 'Protected source edited'; exception when insufficient_privilege or object_not_in_prerequisite_state then null; end;
 end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from collaboration_users where role='consultant'),true);
set local role authenticated;
do $$ declare q jsonb; d jsonb; begin
 select c.q,c.d into q,d from collaboration_docs c where name='published';
 begin perform public.save_questionnaire_draft(d,3,gen_random_uuid()); raise exception 'Consultant edited'; exception when insufficient_privilege then null; end;
 begin perform public.save_question(q,2,gen_random_uuid()); raise exception 'Consultant edited source'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.questions where id=(q->>'id')::uuid) then raise exception 'Consultant source leak'; end if;
end $$;
rollback;
