-- Historical stage-3 test: run only at migration 20261001045140, before table removal.
begin;
-- Historical distributed rows cannot be created through today's source-only API.
-- Seed only this fixture as owner, then restore every trigger before exercising RPCs.
create temp table legacy_fixture(owner_id uuid, respondent_id uuid, parent_id uuid, version_id uuid, section_id uuid, question_id uuid);
insert into legacy_fixture values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
insert into auth.users(id) select owner_id from legacy_fixture union all select respondent_id from legacy_fixture;
insert into public.profiles(id,role,name) select owner_id,'consultant_lead','legacy owner' from legacy_fixture union all select respondent_id,'consultant','legacy respondent' from legacy_fixture;
set local session_replication_role=replica;
insert into public.questionnaires(id,created_by) select parent_id,owner_id from legacy_fixture;
insert into public.questionnaire_versions(id,questionnaire_id,title,status,revision,published_at,distributed_at) select version_id,parent_id,'Legacy response compatibility','distributed',1,now(),now() from legacy_fixture;
insert into public.questionnaire_sections(id,version_id,title,position) select section_id,version_id,'Section',0 from legacy_fixture;
insert into public.questionnaire_questions(id,version_id,section_id,body,position,kind,options)
select question_id,version_id,section_id,'Original choice',0,'single','[{"id":"11111111-1111-4111-8111-111111111111","label":"First"},{"id":"22222222-2222-4222-8222-222222222222","label":"Second"}]' from legacy_fixture;
set local session_replication_role=origin;
grant select on legacy_fixture to authenticated;

create temp table migrating_people(id uuid,status text,sid uuid);
insert into migrating_people select gen_random_uuid(),status,gen_random_uuid() from unnest(array['assigned','in_progress','submitted']) status;
insert into auth.users(id) select id from migrating_people;
insert into public.profiles(id,role,name) select id,'consultant','이전 검증' from migrating_people;
create temp table extra_questions(id uuid,kind text,body text,selection jsonb);
insert into extra_questions values
 (gen_random_uuid(),'text','::mea-rich-text:v1::{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"서술 원문"}]}]}',null),
 (gen_random_uuid(),'scale','5점','5'),
 (gen_random_uuid(),'multiple','First, Second','["11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222"]');
set local session_replication_role=replica;
insert into public.questionnaire_questions(id,version_id,section_id,body,position,kind,options,scale_config)
 select e.id,f.version_id,f.section_id,e.kind||' 질문',row_number() over()::int,e.kind,
 case when e.kind='multiple' then '[{"id":"11111111-1111-4111-8111-111111111111","label":"First"},{"id":"22222222-2222-4222-8222-222222222222","label":"Second"}]'::jsonb else '[]'::jsonb end,
 '{"max":5,"low":"","middle":"","high":"","allowText":false}'::jsonb
 from extra_questions e cross join legacy_fixture f;
insert into public.questionnaire_responses(id,version_id,respondent_id,assigned_by,status,assigned_at,submitted_at,revision,updated_at,last_save_id,last_payload,free_response)
 select p.sid,f.version_id,p.id,f.owner_id,p.status,'2026-09-01 00:00:00+00',case when p.status='submitted' then '2026-09-02 00:00:00+00'::timestamptz else null end,case when p.status='assigned' then 0 else 2 end,'2026-09-02 00:00:00+00',case when p.status='assigned' then null else gen_random_uuid() end,null,case when p.status='assigned' then '' else '보존할 자유 응답' end
 from migrating_people p cross join legacy_fixture f;
insert into public.questionnaire_answers(response_id,version_id,question_id,body,selection,created_at,updated_at)
 select p.sid,f.version_id,f.question_id,'First','"11111111-1111-4111-8111-111111111111"','2026-09-01 01:00:00+00','2026-09-02 00:00:00+00' from migrating_people p cross join legacy_fixture f where p.status<>'assigned';
insert into public.questionnaire_answers(response_id,version_id,question_id,body,selection,created_at,updated_at)
 select p.sid,f.version_id,e.id,e.body,e.selection,'2026-09-01 01:00:00+00','2026-09-02 00:00:00+00' from migrating_people p cross join legacy_fixture f cross join extra_questions e where p.status<>'assigned';
update public.questionnaire_responses r set last_payload=jsonb_build_object('answers',(select jsonb_object_agg(a.question_id::text,case when a.selection is null then a.body when jsonb_typeof(a.selection)='string' then a.selection#>>'{}' else a.selection::text end) from public.questionnaire_answers a where a.response_id=r.id),'complete',r.status='submitted','freeResponse',r.free_response) where r.id in(select sid from migrating_people where status<>'assigned');
set local session_replication_role=origin;
update public.questionnaires set archived_at='2026-09-03 00:00:00+00' where id=(select parent_id from legacy_fixture);
create temp table original_responses as select * from public.questionnaire_responses;
create temp table original_answers as select * from public.questionnaire_answers;
-- A conflicting destination aborts the entire operation, never merging different histories.
do $$ declare conflict_sid uuid; begin
 begin
 select p.sid into conflict_sid from migrating_people p limit 1;
 insert into public.response_sessions(id,respondent_id,origin_version_id,started_role,started_stage) select p.sid,p.id,f.version_id,'consultant','distributed' from migrating_people p cross join legacy_fixture f where p.sid=conflict_sid;
 perform private.migrate_legacy_question_responses();
 raise exception 'Conflict accepted';
 exception when serialization_failure then null;
 end;
 if exists(select 1 from public.response_sessions where id in(select p.sid from migrating_people p)) then raise exception 'Partial write after conflict'; end if;
end $$;
do $$ declare result jsonb; begin
 result:=private.migrate_legacy_question_responses();
 if result->>'migratedSessions'<>'3' or result->>'migratedAnswers'<>'8' then raise exception 'Migration counts: %',result; end if;
 result:=private.migrate_legacy_question_responses();
 if result->>'migratedSessions'<>'0' or result->>'alreadyMigratedSessions'<>'3' then raise exception 'Not idempotent'; end if;
 if exists((select * from original_responses except select * from public.questionnaire_responses) union all (select * from public.questionnaire_responses except select * from original_responses)) then raise exception 'Source responses changed'; end if;
 if exists((select * from original_answers except select * from public.questionnaire_answers) union all (select * from public.questionnaire_answers except select * from original_answers)) then raise exception 'Source answers changed'; end if;
 if exists(select 1 from original_answers a left join public.question_responses r on r.id=a.id where r.id is null or r.legacy_answer is distinct from to_jsonb(a) or r.body<>a.body or r.created_at<>a.created_at or r.updated_at<>a.updated_at) then raise exception 'Answer provenance mismatch'; end if;
 if exists(select 1 from original_responses a left join public.response_sessions r on r.id=a.id where r.id is null or r.legacy_response is distinct from to_jsonb(a) or r.status<>a.status or r.free_response<>a.free_response or r.revision<>a.revision or r.created_at<>a.assigned_at or r.submitted_at is distinct from a.submitted_at) then raise exception 'Session provenance mismatch'; end if;
end $$;
do $$ declare audit jsonb; begin
 audit:=private.verify_legacy_question_response_migration();
 if audit->>'unmatchedSessions'<>'0' or audit->>'unmatchedAnswers'<>'0' or audit->>'missingQuestionMappings'<>'0' then raise exception 'Audit failed: %',audit; end if;
 begin update public.response_sessions set legacy_response='{}' where id=(select sid from migrating_people where status='in_progress'); raise exception 'Provenance changed'; exception when object_not_in_prerequisite_state then null; end;
 begin update public.question_responses set legacy_answer='{}' where session_id=(select sid from migrating_people where status='in_progress'); raise exception 'Answer provenance changed'; exception when object_not_in_prerequisite_state then null; end;
end $$;
update public.questionnaires set archived_at=null where id=(select parent_id from legacy_fixture);
grant select on migrating_people,extra_questions to authenticated;
select set_config('request.jwt.claim.sub',(select id::text from migrating_people where status='submitted'),true);
set local role authenticated;
do $$ declare f record; r jsonb; old record; begin
 select * into f from legacy_fixture;
 r:=public.read_distributed_response(f.version_id);
 if r->>'status'<>'submitted' or r->>'freeResponse'<>'보존할 자유 응답' then raise exception 'Restoration failed'; end if;
 select * into old from public.questionnaire_responses where respondent_id=auth.uid();
 perform public.save_distributed_response(f.version_id,old.last_payload->'answers',1,old.last_save_id,true);
 begin perform public.save_distributed_response(f.version_id,r->'answers',2,gen_random_uuid(),false); raise exception 'Completed unlocked'; exception when object_not_in_prerequisite_state then null; end;
 begin perform private.migrate_legacy_question_responses(); raise exception 'App role can migrate'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from migrating_people where status='in_progress'),true);
set local role authenticated;
do $$ declare f record; r jsonb; answers jsonb; begin
 select * into f from legacy_fixture;
 r:=public.read_distributed_response(f.version_id);
 answers:=jsonb_set(r->'answers',array[(select id::text from extra_questions where kind='text')],'"이전 후 수정"');
 r:=public.save_distributed_response(f.version_id,answers,2,gen_random_uuid(),false);
 if r->>'revision'<>'3' then raise exception 'Cannot continue migrated response'; end if;
end $$;
reset role;
do $$ declare r jsonb; begin
 r:=private.migrate_legacy_question_responses();
 if r->>'alreadyMigratedSessions'<>'3' then raise exception 'Retry after edits failed'; end if;
 if not exists(select 1 from public.question_responses r join public.response_sessions s on s.id=r.session_id where s.respondent_id=(select id from migrating_people where status='in_progress') and r.body='이전 후 수정') then raise exception 'Retry overwrote newer answer'; end if;
end $$;
rollback;
