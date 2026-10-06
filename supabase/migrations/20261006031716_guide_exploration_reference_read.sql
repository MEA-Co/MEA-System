SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.guide_exploration_ids()
  RETURNS uuid[]
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare qid uuid; guide jsonb; answer text; doc jsonb; mark jsonb; result uuid[] := '{}'; ref uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin')) then return result; end if;
 for qid in select distinct r.question_id from public.question_responses r
 join public.response_sessions s on s.id=r.session_id
 where s.respondent_id=private.guide_consultant_id() and s.started_stage='published' and r.question_id is not null
 loop
  guide := private.read_guide_answers(array[qid]);
  for answer in select cell.value from jsonb_each(guide) g
    cross join lateral jsonb_array_elements(g.value->'rows') row
    cross join lateral jsonb_each_text(row->'answers') cell
  loop
   if left(answer,length('::mea-rich-text:v1::')) <> '::mea-rich-text:v1::' then continue; end if;
   begin
    doc := substring(answer from length('::mea-rich-text:v1::')+1)::jsonb;
    for mark in select jsonb_path_query(doc, '$.**.marks[*]') loop
     if mark->>'type'='explorationReference' then
      begin
       ref := (mark#>>'{attrs,id}')::uuid;
       if ref is not null and not ref=any(result) then result:=array_append(result,ref); end if;
      exception when invalid_text_representation then null; end;
     end if;
    end loop;
   exception when invalid_text_representation then null; end;
  end loop;
 end loop;
 return result;
end $function$;

CREATE POLICY "exploration_guide_reference_read" ON "public"."exploration"
  FOR SELECT
  TO "authenticated"
  USING (((deleted_at IS NULL) AND (id = ANY (( SELECT private.guide_exploration_ids() AS guide_exploration_ids)::uuid[]))));

CREATE POLICY "exploration_report_guide_reference_read" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'exploration-reports'::text) AND (EXISTS ( SELECT 1
   FROM public.exploration e
  WHERE
    ((e.id = ANY (( SELECT private.guide_exploration_ids() AS guide_exploration_ids)::uuid[])) AND (e.deleted_at IS NULL) AND ((e.id)::text = (storage.foldername(objects.name))[2])
    AND ((e.owner_id)::text = (storage.foldername(objects.name))[1]) AND (e.reports @> jsonb_build_array(jsonb_build_object('path', objects.name))))))));

REVOKE ALL ON FUNCTION "private"."guide_exploration_ids"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guide_exploration_ids"() TO "authenticated", "postgres";

