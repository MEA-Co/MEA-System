SET local check_function_bodies = off;

ALTER TABLE "public"."question_responses"
  ADD COLUMN "legacy_answer" jsonb;

ALTER TABLE "public"."response_sessions"
  ADD COLUMN "legacy_response" jsonb;

CREATE OR REPLACE FUNCTION private.migrate_legacy_question_responses()
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare old public.questionnaire_responses%rowtype; a public.questionnaire_answers%rowtype; q public.questionnaire_questions%rowtype; existing public.response_sessions%rowtype; def jsonb; qv uuid; raw text; vid uuid; migrated integer:=0; skipped integer:=0; answers_count integer:=0; layout_data jsonb;
begin
 -- Same lock ordering as interactive writes. Prevent changes while snapshotting.
 for vid in select distinct version_id from public.questionnaire_responses order by version_id loop
 perform pg_advisory_xact_lock(hashtextextended(vid::text,0));
 end loop;
 lock table public.questionnaire_responses,public.questionnaire_answers in share mode;
 for old in select * from public.questionnaire_responses order by version_id,id loop
 if exists(select 1 from public.questionnaire_questions where version_id=old.version_id and source_question_id is not null) then raise exception 'Legacy response has source placements: %',old.id using errcode='22023'; end if;
 select * into existing from public.response_sessions where id=old.id or (origin_version_id=old.version_id and respondent_id=old.respondent_id);
 if found then
 if existing.id<>old.id or existing.respondent_id<>old.respondent_id or existing.origin_version_id is distinct from old.version_id or existing.legacy_response is distinct from to_jsonb(old) then raise exception 'Legacy session conflict: %',old.id using errcode='40001'; end if;
 -- New edits after migration are legitimate. Compare provenance, not live answers.
 if exists(select 1 from public.questionnaire_answers prior where prior.response_id=old.id and not exists(select 1 from public.question_responses newer where newer.id=prior.id and newer.session_id=old.id and newer.origin_placement_id=prior.question_id and newer.legacy_answer=to_jsonb(prior))) then raise exception 'Legacy answer mapping mismatch: %',old.id using errcode='40001'; end if;
 if exists(select 1 from public.questionnaire_questions prior where prior.version_id=old.version_id and not exists(select 1 from public.question_responses newer join public.question_versions qv on qv.id=newer.question_version_id where newer.session_id=old.id and newer.origin_placement_id=prior.id and qv.legacy_question_id=prior.id)) then raise exception 'Legacy question mapping missing: %',old.id using errcode='40001'; end if;
 skipped:=skipped+1; continue;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id),'[]'::jsonb) into layout_data from public.questionnaire_sections s where s.version_id=old.version_id;
 insert into public.response_sessions(id,respondent_id,origin_version_id,origin_title,layout,started_role,started_stage,status,revision,last_save_id,last_payload,free_response,created_at,updated_at,submitted_at,legacy_response)
 select old.id,old.respondent_id,old.version_id,v.title,layout_data,'unknown','distributed',old.status,old.revision,old.last_save_id,old.last_payload,old.free_response,old.assigned_at,old.updated_at,old.submitted_at,to_jsonb(old) from public.questionnaire_versions v where v.id=old.version_id;
 for q in select * from public.questionnaire_questions where version_id=old.version_id order by id loop
 def:=jsonb_build_object('id',q.id,'prompt',q.body,'fields',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',q.id,'label','답변','kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text))),'row_mode','single','legacy',true);
 insert into public.question_versions(legacy_question_id,source_revision,definition) values(q.id,0,def) on conflict(legacy_question_id) where legacy_question_id is not null do nothing;
 select id into qv from public.question_versions where legacy_question_id=q.id and definition=def;
 if qv is null then raise exception 'Legacy question definition conflict: %',q.id using errcode='40001'; end if;
 select * into a from public.questionnaire_answers where response_id=old.id and question_id=q.id;
 if found then
 -- Match the old HTTP decoder exactly; preserve selection and all original columns separately.
 raw:=case when a.selection is null then a.body when jsonb_typeof(a.selection)='string' then a.selection#>>'{}' else a.selection::text end;
 insert into public.question_responses(id,session_id,question_version_id,origin_placement_id,rows,active_row_ids,body,created_at,updated_at,legacy_answer)
 values(a.id,old.id,qv,q.id,jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(q.id::text,raw))),'[1]',a.body,a.created_at,a.updated_at,to_jsonb(a));
 answers_count:=answers_count+1;
 else
 insert into public.question_responses(session_id,question_version_id,origin_placement_id,created_at,updated_at)
 values(old.id,qv,q.id,old.assigned_at,old.updated_at);
 end if;
 end loop;
 -- Compare all retained session/answer columns before considering this session migrated.
 if not exists(select 1 from public.response_sessions s where s.id=old.id and s.legacy_response=to_jsonb(old) and s.respondent_id=old.respondent_id and s.status=old.status and s.revision=old.revision and s.free_response=old.free_response and s.created_at=old.assigned_at and s.updated_at=old.updated_at and s.submitted_at is not distinct from old.submitted_at and s.last_save_id is not distinct from old.last_save_id and s.last_payload is not distinct from old.last_payload) then raise exception 'Legacy session verification failed: %',old.id; end if;
 if exists(select 1 from public.questionnaire_answers prior where prior.response_id=old.id and not exists(select 1 from public.question_responses newer where newer.id=prior.id and newer.session_id=prior.response_id and newer.origin_placement_id=prior.question_id and newer.body=prior.body and newer.created_at=prior.created_at and newer.updated_at=prior.updated_at and newer.legacy_answer=to_jsonb(prior))) then raise exception 'Legacy answer verification failed: %',old.id; end if;
 migrated:=migrated+1;
 end loop;
 return jsonb_build_object('migratedSessions',migrated,'migratedAnswers',answers_count,'alreadyMigratedSessions',skipped,'legacyDataPreserved',true);
end $function$;

REVOKE ALL ON FUNCTION "private"."migrate_legacy_question_responses"() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "private"."migrate_legacy_question_responses"() TO "postgres";


-- Preserve provenance during future answer edits.
CREATE OR REPLACE FUNCTION private.guard_question_response_identity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 if tg_table_name='response_sessions' then
 if new.legacy_response is distinct from old.legacy_response or new.respondent_id<>old.respondent_id or new.layout<>old.layout or new.origin_title<>old.origin_title then raise exception 'Session identity is immutable' using errcode='55000'; end if;
 -- FK source removal is permitted even after submission; answer content is not.
 if old.status='submitted' and (to_jsonb(new)-'origin_version_id') is distinct from (to_jsonb(old)-'origin_version_id') then raise exception 'Response locked' using errcode='55000'; end if;
 elsif tg_op='DELETE' then raise exception 'Response history is preserved' using errcode='55000';
 else
 if new.legacy_answer is distinct from old.legacy_answer or new.session_id<>old.session_id or new.question_version_id<>old.question_version_id or exists(select 1 from public.response_sessions where id=old.session_id and status='submitted') then raise exception 'Response locked' using errcode='55000'; end if;
 end if;
 return new;
end $function$;


create function private.verify_legacy_question_response_migration() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'legacySessions',(select count(*) from public.questionnaire_responses),
 'legacyAnswers',(select count(*) from public.questionnaire_answers),
 'unmatchedSessions',(select count(*) from public.questionnaire_responses old where not exists(select 1 from public.response_sessions s where s.id=old.id and s.respondent_id=old.respondent_id and s.origin_version_id=old.version_id and s.legacy_response=to_jsonb(old))),
 'unmatchedAnswers',(select count(*) from public.questionnaire_answers old where not exists(select 1 from public.question_responses r join public.question_versions q on q.id=r.question_version_id where r.id=old.id and r.session_id=old.response_id and r.origin_placement_id=old.question_id and q.legacy_question_id=old.question_id and r.legacy_answer=to_jsonb(old))),
 'missingQuestionMappings',(select count(*) from public.questionnaire_responses s join public.questionnaire_questions q on q.version_id=s.version_id where not exists(select 1 from public.question_responses r join public.question_versions v on v.id=r.question_version_id where r.session_id=s.id and r.origin_placement_id=q.id and v.legacy_question_id=q.id))
 );
$$;
revoke all on function private.verify_legacy_question_response_migration() from public,anon,authenticated,service_role;

-- Data migration is intentional: db pull generates schema changes only.
-- Source rows remain intact. Any mismatch aborts the migration transaction.
select private.migrate_legacy_question_responses();
do $$ declare audit jsonb; begin
 audit:=private.verify_legacy_question_response_migration();
 if (audit->>'unmatchedSessions')::bigint<>0 or (audit->>'unmatchedAnswers')::bigint<>0 or (audit->>'missingQuestionMappings')::bigint<>0 then
 raise exception 'Legacy response verification failed: %',audit;
 end if;
end $$;
notify pgrst,'reload schema';
