SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."question_incoming_references"(uuid[]) FROM "anon";

REVOKE ALL ON FUNCTION "public"."question_review_counts"(uuid[]) FROM "anon";

CREATE OR REPLACE FUNCTION public.read_question_review_page (
  qid       uuid,
  origin_id uuid    DEFAULT NULL::uuid,
  completed boolean DEFAULT false,
  page      integer DEFAULT 1
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare result jsonb; pending_count bigint; completed_count bigint;
begin
 if not private.can_read_question_reviews(qid) then raise exception 'Review access denied' using errcode='42501'; end if;
 if completed is null or page is null or page < 1 or page > 100000 then raise exception 'Invalid review page' using errcode='22023'; end if;
 select count(*) filter(where resolved_at is null), count(*) filter(where resolved_at is not null)
 into pending_count,completed_count from public.question_review_requests where question_id=qid;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) into result
 from (select id,question_id,origin_questionnaire_id,question_revision,requested_by,requester_name,title,description,created_at,resolved_by,resolved_at
 from public.question_review_requests where question_id=qid and (resolved_at is not null)=completed
 order by created_at desc,id desc limit case when completed then 10 else null end
 offset case when completed then (page-1)*10 else 0 end) r;
 return jsonb_build_object('reviews',result,'pendingCount',pending_count,'completedCount',completed_count,
 'page',page,'hasMore',completed and page::bigint*10<completed_count,
 'canResolve',private.is_admin() or exists(select 1 from public.questions where id=qid and created_by=auth.uid()),
 'canRequest',private.can_request_question_review(qid,origin_id),
 'unreadIds',case when completed then '[]'::jsonb else private.unread_question_review_ids(qid) end);
end $function$;

CREATE INDEX question_reviews_completed_page_idx ON public.question_review_requests USING btree (question_id, created_at DESC, id DESC)
  WHERE (resolved_at IS NOT NULL);

REVOKE ALL ON FUNCTION "public"."read_question_review_page"(uuid, uuid, boolean, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."read_question_review_page"(uuid, uuid, boolean, integer) TO "authenticated", "postgres", "service_role";

