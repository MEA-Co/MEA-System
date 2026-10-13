SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.read_study_page (
  p_scope       text    DEFAULT 'own'::text,
  p_page        integer DEFAULT 1,
  p_query       text    DEFAULT ''::text,
  p_owner       uuid    DEFAULT NULL::uuid,
  p_excluded    uuid[]  DEFAULT '{}'::uuid[],
  p_local_count integer DEFAULT 0,
  p_own_only    boolean DEFAULT true
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_study() THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 IF p_scope IS NULL OR p_scope NOT IN ('own','others') OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000
 OR p_query IS NULL OR length(p_query)>200 OR p_excluded IS NULL OR cardinality(p_excluded)>10000
 OR array_position(p_excluded,NULL) IS NOT NULL OR p_local_count IS NULL OR p_local_count NOT BETWEEN 0 AND 10000
 OR p_own_only IS NULL THEN RAISE EXCEPTION 'Invalid query' USING ERRCODE='22023'; END IF;
 IF p_scope='others' THEN
   IF p_own_only OR NOT (private.is_admin() OR private.is_consultant_lead()) THEN
     RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
   END IF;
   p_excluded := '{}'; p_local_count := 0;
 END IF;
 WITH filtered AS MATERIALIZED (
   SELECT s.id,s.updated_at FROM public.study s
   WHERE s.deleted_at IS NULL
     AND CASE WHEN p_scope='own' THEN s.owner_id=auth.uid()
       ELSE s.owner_id<>auth.uid() AND (p_owner IS NULL OR s.owner_id=p_owner) END
     AND NOT(s.id=ANY(p_excluded))
     AND (p_query='' OR EXISTS (
       SELECT 1 FROM unnest(ARRAY['title','category','subject','customSubject','problemSource','problem',
        'problemExperience','strategy','practiceGuide','practicePeriod','checklist','followup','resultDiagnosis']) k
       WHERE strpos(lower(s.values->>k),lower(p_query))>0
     ))
 ), counts AS (
   SELECT count(*)+p_local_count AS total FROM filtered
 ), paging AS (
   SELECT total,least(p_page,greatest(1,ceil(total/10.0)::integer)) AS page FROM counts
 ), bounds AS (
   SELECT *,greatest(0,(page-1)*10-p_local_count) AS skip,
     10-least(10,greatest(0,p_local_count-(page-1)*10)) AS take FROM paging
 ), chosen AS (
   SELECT * FROM filtered ORDER BY updated_at DESC,id
   LIMIT (SELECT take FROM bounds) OFFSET (SELECT skip FROM bounds)
 ), rows AS (
   SELECT to_jsonb(s)||jsonb_build_object('owner',jsonb_build_object('name',p.name)) AS row,
     c.updated_at,c.id
   FROM chosen c JOIN public.study s ON s.id=c.id
   LEFT JOIN public.profiles p ON p.id=s.owner_id
 )
 SELECT jsonb_build_object('userId',auth.uid(),'activities',
   coalesce((SELECT jsonb_agg(row ORDER BY updated_at DESC,id) FROM rows),'[]'::jsonb),
   'total',total,'page',page,'pageSize',10) INTO result FROM bounds;
 RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_study_summary (
  p_own_only boolean DEFAULT true
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
DECLARE result jsonb; staff boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.can_manage_study() THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 IF p_own_only IS NULL THEN RAISE EXCEPTION 'Invalid query' USING ERRCODE='22023'; END IF;
 staff := NOT p_own_only AND (private.is_admin() OR private.is_consultant_lead());
 WITH grouped AS MATERIALIZED (
   SELECT s.owner_id,count(*) AS n FROM public.study s
   WHERE s.deleted_at IS NULL AND (s.owner_id=auth.uid() OR staff)
   GROUP BY s.owner_id
 ), authors AS (
   SELECT g.owner_id AS id,g.n AS count,coalesce(nullif(btrim(p.name),''),'이름 비공개') AS label
   FROM grouped g LEFT JOIN public.profiles p ON p.id=g.owner_id WHERE g.owner_id<>auth.uid()
 )
 SELECT jsonb_build_object(
   'mine',coalesce((SELECT n FROM grouped WHERE owner_id=auth.uid()),0),
   'others',coalesce((SELECT sum(n) FROM grouped WHERE owner_id<>auth.uid()),0),
   'people',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY label,id) FROM authors a),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."read_study_page"(text, integer, text, uuid, uuid[], integer, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "public"."read_study_page"(text, integer, text, uuid, uuid[], integer, boolean) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."read_study_summary"(boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "public"."read_study_summary"(boolean) TO "authenticated", "postgres", "service_role";

