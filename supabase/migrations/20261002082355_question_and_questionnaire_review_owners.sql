-- Both source and questionnaire owners cannot request reviews.
CREATE OR REPLACE FUNCTION private.request_question_review(p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor public.profiles%rowtype; rev integer; begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or actor.role not in ('admin','consultant_lead') then raise exception 'Staff required' using errcode='42501'; end if;
 if p_id is null or p_description is null or length(btrim(p_description)) not between 1 and 5000 then raise exception 'Invalid review' using errcode='22023'; end if;
 select revision into rev from public.questions where id=p_question_id and archived_at is null and created_by<>auth.uid() for share;
 if not found then raise exception 'Question unavailable' using errcode='42501'; end if;
 perform 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id where p.source_question_id=p_question_id and v.status='published' and d.archived_at is null and d.created_by<>auth.uid() and (p_origin_questionnaire_id is null or v.id=p_origin_questionnaire_id) for share of p,v,d;
 if not found then raise exception 'Published question required' using errcode='42501'; end if;
 insert into public.question_review_requests(id,question_id,origin_questionnaire_id,question_revision,requested_by,requester_name,description,title) values(p_id,p_question_id,p_origin_questionnaire_id,rev,actor.id,actor.name,btrim(p_description),'') on conflict(id) do nothing;
 if not exists(select 1 from public.question_review_requests where id=p_id and question_id=p_question_id and requested_by=actor.id and description=btrim(p_description) and origin_questionnaire_id is not distinct from p_origin_questionnaire_id) then raise exception 'Review conflict' using errcode='40001'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.can_request_question_review(qid uuid, origin_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists(
 select 1 from public.questions q join public.questionnaire_questions p on p.source_question_id=q.id join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id
 where q.id=qid and q.created_by<>auth.uid() and q.archived_at is null and d.archived_at is null and d.created_by<>auth.uid() and v.status='published' and (origin_id is null or v.id=origin_id));
$function$;

