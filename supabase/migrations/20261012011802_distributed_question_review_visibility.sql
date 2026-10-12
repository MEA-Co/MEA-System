-- Share review history with staff on active published and distributed questionnaires.
-- Request creation and resolution permissions remain unchanged.
CREATE OR REPLACE FUNCTION private.can_read_question_reviews(qid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists (
 select 1 from public.questions q where q.id=qid and (q.created_by=auth.uid() or private.is_admin() or exists(
 select 1 from public.question_review_requests r where r.question_id=qid and r.requested_by=auth.uid()) or (q.archived_at is null and exists (
 select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires d on d.id=v.id where p.source_question_id=qid and v.status in ('published','distributed') and d.archived_at is null))));
$function$;
