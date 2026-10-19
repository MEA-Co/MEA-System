begin;
set local lock_timeout='5s';
lock table public.questions,public.question_details,public.questionnaires,public.questionnaire_questions,public.question_responses,public.response_sessions,public.response_submissions,public.study,public.exploration in share row exclusive mode;
create temporary table rollback_data_before(name text, digest text) on commit drop;
insert into rollback_data_before select 'questions', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.questions t) s;
insert into rollback_data_before select 'question_details', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.question_details t) s;
insert into rollback_data_before select 'questionnaires', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.questionnaires t) s;
insert into rollback_data_before select 'questionnaire_questions', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.questionnaire_questions t) s;
insert into rollback_data_before select 'question_responses', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.question_responses t) s;
insert into rollback_data_before select 'response_sessions', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.response_sessions t) s;
insert into rollback_data_before select 'response_submissions', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.response_submissions t) s;
insert into rollback_data_before select 'study', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.study t) s;
insert into rollback_data_before select 'exploration', md5(coalesce(string_agg(row_digest,'' order by row_digest),'')) from (select md5(to_jsonb(t)::text) row_digest from public.exploration t) s;
drop trigger protect_learning_material_references on public.questions;
drop trigger protect_learning_material_references on public.question_details;
drop trigger protect_learning_material_references on public.questionnaires;
drop trigger protect_learning_material_references on public.questionnaire_questions;
drop trigger protect_learning_material_references on public.question_responses;
drop trigger protect_learning_material_references on public.response_sessions;
drop trigger protect_learning_material_references on public.response_submissions;
drop trigger protect_referenced_study on public.study;
drop trigger protect_referenced_exploration on public.exploration;
do $restore$ declare kind text; definition text; needle text; begin foreach kind in array array['study','exploration'] loop definition:=pg_get_functiondef(format('private.delete_%s(uuid,integer)',kind)::regprocedure);
needle:=$needle$
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0)) then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end if;
$needle$; if strpos(definition,needle)=0 then raise exception 'Unexpected definition'; end if; definition:=replace(definition,needle,'perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));');
needle:=format($needle$
 begin
  select * into v from public.%I where id=p_id for update nowait;
 exception when lock_not_available then
  raise sqlstate 'PGRST' using message='{"code":"MATERIAL_BUSY","message":"Material is being changed; try again","details":null,"hint":null}',detail='{"status":409,"headers":{}}';
 end;
$needle$,kind); if strpos(definition,needle)=0 then raise exception 'Unexpected definition'; end if; definition:=replace(definition,needle,format('select * into v from public.%s where id=p_id for update;',kind));
if strpos(definition,'MATERIAL_BUSY')>0 or strpos(definition,'business-conflict-v1')=0 then raise exception 'Invalid restored function'; end if; execute definition; end loop; end $restore$;
drop function private.guard_learning_material_reference_write();
drop function private.guard_referenced_learning_material_delete();
drop function private.learning_material_source(text,jsonb);
drop function private.learning_material_references(jsonb);
drop table private.learning_material_links;
do $verify$ declare t text; actual text; expected text; begin foreach t in array array['questions','question_details','questionnaires','questionnaire_questions','question_responses','response_sessions','response_submissions','study','exploration'] loop execute format('select md5(coalesce(string_agg(row_digest, %L order by row_digest),%L)) from (select md5(to_jsonb(t)::text) row_digest from public.%I t) s','','',t) into actual; select digest into expected from rollback_data_before where name=t; if actual is distinct from expected then raise exception 'Data changed: %',t; end if; end loop; end $verify$;
select 'All 9 source/material tables unchanged' as verification;
commit;
