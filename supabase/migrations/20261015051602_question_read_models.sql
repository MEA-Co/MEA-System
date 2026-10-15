SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.question_incoming_references (
  p_question_ids uuid[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare result jsonb;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Question access required' using errcode = '42501';
  end if;
  if p_question_ids is null or cardinality(p_question_ids) not between 1 and 10
    or array_position(p_question_ids, null) is not null then
    raise exception 'Expected 1 to 10 question IDs' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'target_id', target.id, 'id', q.id, 'title', q.title, 'created_by', q.created_by
  ) order by target.id, q.id), '[]'::jsonb) into result
  from (select distinct unnest(p_question_ids) as id) target
  join public.questions q on q.archived_at is null and (
    q.source_block_id = target.id or q.after_block_id = target.id
    or (q.condition is not null and q.condition @> jsonb_build_object(
      'clauses', jsonb_build_array(jsonb_build_object('blockId', target.id::text)))))
  where exists (select 1 from public.questions visible where visible.id=target.id);
  return result;
end $function$;

CREATE OR REPLACE FUNCTION public.question_review_counts (
  p_question_ids uuid[]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare result jsonb;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Question review access required' using errcode = '42501';
  end if;
  if p_question_ids is null or cardinality(p_question_ids) not between 1 and 10
    or array_position(p_question_ids, null) is not null then
    raise exception 'Expected 1 to 10 question IDs' using errcode = '22023';
  end if;
  with counts as (
    select r.question_id, count(*) as total,
      count(*) filter (where r.requested_by <> auth.uid()
        and exists (select 1 from public.questions q where q.id=r.question_id and q.created_by=auth.uid())
        and not exists (select 1 from public.question_review_reads seen
          where seen.review_id=r.id and seen.user_id=auth.uid())) as unread
    from public.question_review_requests r
    where r.question_id = any(p_question_ids) and r.resolved_at is null
    group by r.question_id
  )
  select jsonb_build_object(
    'counts', coalesce(jsonb_object_agg(question_id,total),'{}'::jsonb),
    'unreadCounts', coalesce(jsonb_object_agg(question_id,unread),'{}'::jsonb)
  ) into result from counts;
  return result;
end $function$;

CREATE INDEX questions_active_condition_idx ON public.questions USING gin (condition jsonb_path_ops)
  WHERE ((archived_at IS NULL) AND (condition IS NOT NULL));

REVOKE ALL ON FUNCTION "public"."question_incoming_references"(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."question_incoming_references"(uuid[]) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."question_review_counts"(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."question_review_counts"(uuid[]) TO "authenticated", "postgres", "service_role";

