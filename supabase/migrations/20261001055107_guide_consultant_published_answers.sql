begin;
SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.assert_published_response_access (
  p_version_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
 if not public.can_write_guide_answers() or not exists(
 select 1 from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id
 where v.id=p_version_id and v.status='published' and q.archived_at is null
 ) then raise exception 'Published response access denied' using errcode='42501'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.guide_consultant_id()
  RETURNS uuid
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$ select 'b338f03e-9d7f-4367-be1e-96eb1d5473be'::uuid; $function$;

CREATE OR REPLACE FUNCTION private.owned_published_session (
  target uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ declare sid uuid; begin
 if not public.can_write_guide_answers() then raise exception 'Staff access required' using errcode='42501'; end if;
 select id into sid from public.response_sessions where respondent_id=auth.uid() and started_stage='published' and (id=target or origin_version_id=target) order by (id=target) desc limit 1;
 if sid is null then raise exception 'Response not found' using errcode='42501'; end if; return sid;
end $function$;

CREATE OR REPLACE FUNCTION private.read_guide_answers (
  p_question_ids uuid[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if cardinality(p_question_ids)>500 then raise exception 'Too many questions' using errcode='22023'; end if;
 return coalesce((select jsonb_object_agg(q.id::text,a.body) from public.questions q cross join lateral (
 select r.body,v.definition from public.question_responses r join public.response_sessions s on s.id=r.session_id join public.question_versions v on v.id=r.question_version_id where v.question_id=q.id and s.respondent_id=private.guide_consultant_id() order by r.updated_at desc,r.id limit 1
 ) a where q.id=any(p_question_ids) and q.archived_at is null and btrim(a.body)<>'' and private.response_structure(a.definition)=private.response_structure(private.live_response_definition(q.id)) and (q.created_by=auth.uid() or private.is_admin() or exists(select 1 from public.questionnaire_questions p join public.questionnaire_versions v on v.id=p.version_id join public.questionnaires parent on parent.id=v.questionnaire_id where p.source_question_id=q.id and v.status='published' and parent.archived_at is null))),'{}');
end $function$;

create function private.can_write_guide_answers() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(auth.uid()=private.guide_consultant_id() and (private.is_admin() or private.is_consultant_lead()),false); $$;
create or replace function public.can_write_guide_answers() returns boolean language sql stable security invoker set search_path='' as $$ select private.can_write_guide_answers(); $$;
revoke all on function private.can_write_guide_answers() from public,anon;
grant execute on function private.can_write_guide_answers() to authenticated;


CREATE OR REPLACE FUNCTION public.read_guide_answers (
  p_question_ids uuid[]
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$ select private.read_guide_answers(p_question_ids); $function$;

REVOKE ALL ON FUNCTION "private"."guide_consultant_id"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guide_consultant_id"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."read_guide_answers"(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_guide_answers"(uuid[]) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."can_write_guide_answers"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."can_write_guide_answers"() TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."read_guide_answers"(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."read_guide_answers"(uuid[]) TO "authenticated", "postgres", "service_role";


revoke all on function public.can_write_guide_answers(),public.read_guide_answers(uuid[]) from anon;
notify pgrst,'reload schema';
commit;
