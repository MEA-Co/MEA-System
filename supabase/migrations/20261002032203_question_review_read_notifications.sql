begin;
SET local check_function_bodies = off;

CREATE TABLE "public"."question_review_reads" (
  "review_id" uuid                     NOT NULL,
  "user_id"   uuid                     NOT NULL,
  "read_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_review_reads_pkey" PRIMARY KEY (review_id, user_id)
);

ALTER TABLE "public"."question_review_reads"
  ENABLE ROW LEVEL SECURITY;


CREATE OR REPLACE FUNCTION private.mark_question_reviews_read (
  qid uuid,
  ids uuid[]
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) or not private.can_read_question_reviews(qid) then raise exception 'Review access denied' using errcode='42501'; end if;
 if cardinality(ids)>100 then raise exception 'Too many review IDs' using errcode='22023'; end if;
 insert into public.question_review_reads(review_id,user_id)
 select r.id,auth.uid() from public.question_review_requests r where r.question_id=qid and r.id=any(ids)
 and r.id in (select value::uuid from jsonb_array_elements_text(private.unread_question_review_ids(qid)))
 on conflict do nothing;
end $function$;

CREATE OR REPLACE FUNCTION private.question_review_counts()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ begin
 if auth.uid() is null or not(private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(c)) from (
 select p.version_id,count(distinct r.id) as count,
 count(distinct r.id) filter (where d.created_by=auth.uid() and d.archived_at is null and r.requested_by<>auth.uid() and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid())) as unread_count
 from public.questionnaire_questions p join public.questionnaire_versions v on v.id=p.version_id join public.questionnaires d on d.id=v.questionnaire_id join public.question_review_requests r on r.question_id=p.source_question_id and r.resolved_at is null
 where private.can_read_question_reviews(r.question_id) and (d.created_by=auth.uid() or private.is_admin() or (v.status='published' and d.archived_at is null)) group by p.version_id
 ) c),'[]'::jsonb);
end $function$;


CREATE OR REPLACE FUNCTION private.unread_question_review_ids (
  qid uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
 select coalesce(jsonb_agg(r.id order by r.created_at),'[]'::jsonb) from public.question_review_requests r
 where r.question_id=qid and r.resolved_at is null and r.requested_by<>auth.uid()
 and (private.is_admin() or private.is_consultant_lead())
 and exists(select 1 from public.questionnaire_questions p join public.questionnaire_versions v on v.id=p.version_id join public.questionnaires d on d.id=v.questionnaire_id where p.source_question_id=qid and d.created_by=auth.uid() and d.archived_at is null)
 and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.mark_question_reviews_read (
  qid uuid,
  ids uuid[]
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.mark_question_reviews_read(qid,ids); $function$;

CREATE OR REPLACE FUNCTION public.unread_question_review_ids (
  qid uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$ select private.unread_question_review_ids(qid); $function$;

ALTER TABLE "public"."question_review_reads"
  ADD CONSTRAINT "question_review_reads_review_id_fkey" FOREIGN KEY (review_id) REFERENCES public.question_review_requests(id) ON DELETE CASCADE;

ALTER TABLE "public"."question_review_reads"
  ADD CONSTRAINT "question_review_reads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX question_review_reads_user_idx ON public.question_review_reads USING btree (user_id);

CREATE POLICY "Read own review receipts" ON "public"."question_review_reads"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

REVOKE ALL ON FUNCTION "private"."mark_question_reviews_read"(uuid, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."mark_question_reviews_read"(uuid, uuid[]) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."unread_question_review_ids"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."unread_question_review_ids"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."mark_question_reviews_read"(uuid, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."mark_question_reviews_read"(uuid, uuid[]) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."unread_question_review_ids"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."unread_question_review_ids"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."question_review_reads" FROM "authenticated";

GRANT SELECT ON TABLE "public"."question_review_reads" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."question_review_reads" TO "postgres", "service_role";


revoke all on public.question_review_reads from public,anon;
revoke all on function private.unread_question_review_ids(uuid),private.mark_question_reviews_read(uuid,uuid[]),public.unread_question_review_ids(uuid),public.mark_question_reviews_read(uuid,uuid[]) from public,anon;
notify pgrst,'reload schema';
commit;
