SET local check_function_bodies = off;

ALTER TABLE "public"."response_sessions"
  DROP CONSTRAINT "response_sessions_status_check";

DROP FUNCTION "private"."open_questionnaire_response"(uuid);

DROP FUNCTION "private"."save_questionnaire_response"(uuid, jsonb, integer, uuid, boolean, text);

ALTER TABLE "public"."question_versions"
  ADD COLUMN "legacy_question_id" uuid;

ALTER TABLE "public"."question_versions"
  ALTER COLUMN "question_id" DROP NOT NULL;

CREATE OR REPLACE FUNCTION private.assert_distributed_response_access (
  p_version_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) or not exists(select 1 from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id where v.id=p_version_id and v.status='distributed' and q.archived_at is null) then raise exception 'Distributed response access denied' using errcode='42501'; end if;
 -- New placement distribution remains intentionally disabled at this stage.
 if exists(select 1 from public.questionnaire_questions where version_id=p_version_id and source_question_id is not null) then raise exception 'Placement distribution is not supported' using errcode='22023'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.assert_legacy_response_migrated (
  p_version_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
 if exists(select 1 from public.questionnaire_responses old where old.version_id=p_version_id and old.respondent_id=auth.uid() and not exists(select 1 from public.response_sessions s where s.id=old.id and s.respondent_id=old.respondent_id and s.origin_version_id=old.version_id)) then
 raise exception 'Legacy response migration required' using errcode='55000'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.notify_response_session_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
 perform realtime.send('{}'::jsonb,'changed','questionnaires:user:'||new.respondent_id::text,true);
 return null;
end $function$;

CREATE OR REPLACE FUNCTION private.open_distributed_response (
  p_version_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare sid uuid; q public.questionnaire_questions%rowtype; qv uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 perform private.assert_distributed_response_access(p_version_id);
 perform private.assert_legacy_response_migrated(p_version_id);
 select id into sid from public.response_sessions where origin_version_id=p_version_id and respondent_id=auth.uid();
 if sid is not null then return sid; end if;
 insert into public.response_sessions(respondent_id,origin_version_id,origin_title,started_role,started_stage,status,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'distributed','assigned',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb)
 from public.questionnaire_versions v where v.id=p_version_id returning id into sid;
 for q in select * from public.questionnaire_questions where version_id=p_version_id order by id loop
 insert into public.question_versions(legacy_question_id,source_revision,definition)
 values(q.id,0,jsonb_build_object('id',q.id,'prompt',q.body,'fields',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',q.id,'label','답변','kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text))),'row_mode','single','legacy',true))
 on conflict(legacy_question_id) where legacy_question_id is not null do nothing;
 select id into qv from public.question_versions where legacy_question_id=q.id;
 insert into public.question_responses(session_id,question_version_id,origin_placement_id) values(sid,qv,q.id);
 end loop;
 return sid;
end $function$;

CREATE OR REPLACE FUNCTION private.open_questionnaire_response (
  p_version_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.open_distributed_response(p_version_id) $function$;

CREATE OR REPLACE FUNCTION private.read_distributed_response (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.response_sessions%rowtype;
begin
 perform private.assert_distributed_response_access(p_version_id);
 perform private.assert_legacy_response_migrated(p_version_id);
 select * into s from public.response_sessions where origin_version_id=p_version_id and respondent_id=auth.uid();
 return jsonb_build_object('revision',coalesce(s.revision,0),'status',coalesce(s.status,'assigned'),'savedAt',case when s.revision>0 then s.updated_at else null end,'freeResponse',coalesce(s.free_response,''),'answers',coalesce((select jsonb_object_agg(r.origin_placement_id::text,coalesce(r.rows#>>array['0','answers',r.origin_placement_id::text],'')) from public.question_responses r where r.session_id=s.id),'{}'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION private.save_distributed_response (
  p_version_id    uuid,
  p_answers       jsonb,
  p_revision      integer,
  p_save_id       uuid,
  p_complete      boolean,
  p_free_response text    DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare sid uuid; s public.response_sessions%rowtype; payload jsonb; item record; q record; f jsonb; val text; readable text;
begin
 if p_save_id is null or p_revision is null or p_revision<0 or p_complete is null or length(p_free_response)>20000 or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid answers' using errcode='22023'; end if;
 sid:=private.open_distributed_response(p_version_id);
 select * into s from public.response_sessions where id=sid for update;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete,'freeResponse',coalesce(p_free_response,s.free_response));
 if s.last_save_id=p_save_id and (s.last_payload||jsonb_build_object('freeResponse',s.free_response))=payload then return private.read_distributed_response(p_version_id); end if;
 if s.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Answer conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.question_responses where session_id=sid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_answers) loop
 select r.id,r.origin_placement_id,v.definition into q from public.question_responses r join public.question_versions v on v.id=r.question_version_id where r.session_id=sid and r.origin_placement_id::text=item.key;
 if not found or jsonb_typeof(item.value) is distinct from 'string' then raise exception 'Invalid question' using errcode='22023'; end if;
 f:=q.definition#>'{fields,0}'; val:=item.value#>>'{}';
 if not private.question_field_response_valid(f,val,p_complete) then raise exception 'Invalid answer for question type' using errcode='22023'; end if;
 readable:=case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(f->'scaleConfig',val) else private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) end;
 update public.question_responses set rows=jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(item.key,val))),active_row_ids='[1]',body=readable,updated_at=now() where id=q.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,free_response=coalesce(p_free_response,s.free_response),status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=sid;
 return private.read_distributed_response(p_version_id);
end $function$;

CREATE OR REPLACE FUNCTION private.save_questionnaire_response (
  p_version_id uuid,
  p_answers    jsonb,
  p_revision   integer,
  p_save_id    uuid,
  p_complete   boolean
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.save_distributed_response(p_version_id,p_answers,p_revision,p_save_id,p_complete,null) $function$;

CREATE OR REPLACE FUNCTION private.save_questionnaire_response (
  p_version_id    uuid,
  p_answers       jsonb,
  p_revision      integer,
  p_save_id       uuid,
  p_complete      boolean,
  p_free_response text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.save_distributed_response(p_version_id,p_answers,p_revision,p_save_id,p_complete,p_free_response) $function$;

CREATE OR REPLACE FUNCTION public.distributed_response_statuses()
  RETURNS TABLE (
    version_id uuid,
    status     text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select s.origin_version_id,s.status from public.response_sessions s join public.questionnaire_versions v on v.id=s.origin_version_id where s.respondent_id=(select auth.uid()) and v.status='distributed'
 union all
 select r.version_id,r.status from public.questionnaire_responses r join public.questionnaire_versions v on v.id=r.version_id where r.respondent_id=(select auth.uid()) and v.status='distributed' and not exists(select 1 from public.response_sessions s where s.origin_version_id=r.version_id and s.respondent_id=r.respondent_id);
$function$;

CREATE OR REPLACE FUNCTION public.open_distributed_response (
  p_version_id uuid
)
  RETURNS uuid
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.open_distributed_response(p_version_id) $function$;

CREATE OR REPLACE FUNCTION public.read_distributed_response (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$ select private.read_distributed_response(p_version_id) $function$;

CREATE OR REPLACE FUNCTION public.save_distributed_response (
  p_version_id    uuid,
  p_answers       jsonb,
  p_revision      integer,
  p_save_id       uuid,
  p_complete      boolean,
  p_free_response text    DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.save_distributed_response(p_version_id,p_answers,p_revision,p_save_id,p_complete,p_free_response) $function$;

CREATE OR REPLACE FUNCTION public.unread_distributed_questionnaires()
  RETURNS TABLE (
    version_id uuid
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select v.id from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id where v.status='distributed' and q.archived_at is null
 and not exists(select 1 from public.response_sessions r where r.origin_version_id=v.id and r.respondent_id=(select auth.uid()))
 -- Retained only until the explicit legacy-data migration is complete.
 and not exists(select 1 from public.questionnaire_responses r where r.version_id=v.id and r.respondent_id=(select auth.uid()));
$function$;

ALTER TABLE "public"."question_versions"
  ADD CONSTRAINT "question_version_source_check" CHECK (((question_id IS NOT NULL) <> (legacy_question_id IS NOT NULL)));

ALTER TABLE "public"."response_sessions"
  ADD CONSTRAINT "response_session_free_response_length" CHECK ((length(free_response) <= 20000));

ALTER TABLE "public"."response_sessions"
  ADD CONSTRAINT "response_sessions_status_check" CHECK ((status = ANY (ARRAY['assigned'::text, 'in_progress'::text, 'submitted'::text])));

CREATE UNIQUE INDEX question_versions_legacy_question_idx ON public.question_versions USING btree (legacy_question_id)
  WHERE (legacy_question_id IS NOT NULL);

CREATE TRIGGER response_session_changed
  AFTER INSERT OR UPDATE ON public.response_sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_response_session_change();

REVOKE ALL ON FUNCTION "private"."assert_distributed_response_access"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."assert_distributed_response_access"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."assert_legacy_response_migrated"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."assert_legacy_response_migrated"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."notify_response_session_change"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."notify_response_session_change"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."open_distributed_response"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."open_distributed_response"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."open_questionnaire_response"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."open_questionnaire_response"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."read_distributed_response"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_distributed_response"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."save_distributed_response"(uuid, jsonb, integer, uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."save_distributed_response"(uuid, jsonb, integer, uuid, boolean, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."save_questionnaire_response"(uuid, jsonb, integer, uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."save_questionnaire_response"(uuid, jsonb, integer, uuid, boolean, text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."distributed_response_statuses"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."distributed_response_statuses"() TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."open_distributed_response"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."open_distributed_response"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."read_distributed_response"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."read_distributed_response"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_distributed_response"(uuid, jsonb, integer, uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."save_distributed_response"(uuid, jsonb, integer, uuid, boolean, text) TO "authenticated", "postgres", "service_role";

-- Preserve intended privileges on projects with different default ACLs.
REVOKE ALL ON FUNCTION private.assert_distributed_response_access(uuid),private.assert_legacy_response_migrated(uuid),private.notify_response_session_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.open_distributed_response(uuid),private.read_distributed_response(uuid),private.save_distributed_response(uuid,jsonb,integer,uuid,boolean,text),public.open_distributed_response(uuid),public.read_distributed_response(uuid),public.save_distributed_response(uuid,jsonb,integer,uuid,boolean,text),public.distributed_response_statuses() FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';
