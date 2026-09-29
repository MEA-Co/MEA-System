-- Operator SQL Editor, before the three 20260929 cleanup migrations.
-- Default: dry run. Replace only the final ROLLBACK with COMMIT after review.
-- Latest source definitions are intentionally accepted; no source is overwritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- Short maintenance transaction. Prevent concurrent edits during comparison/deletion.
LOCK TABLE public.questionnaires, public.questionnaire_versions,
 public.questionnaire_sections, public.questionnaire_questions,
 public.questionnaire_question_details, public.questions, public.question_details,
 public.questionnaire_responses, public.questionnaire_answers,
 public.questionnaire_review_requests, private.legacy_questionnaire_imports
 IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE conversion_result(result jsonb) ON COMMIT DROP;
DO $$
DECLARE
 vid uuid := 'dbc59647-e728-4d17-b312-b12fd2c8cd82';
 l private.legacy_questionnaire_imports%rowtype;
 m jsonb; oldq public.questionnaire_questions%rowtype; source public.questions%rowtype;
 oldd public.questionnaire_question_details%rowtype; newd public.question_details%rowtype;
 n integer; linked integer; deleted integer;
 before_rows jsonb; after_rows jsonb; t text; before_all jsonb := '{}';
BEGIN
 SELECT * INTO STRICT l FROM private.legacy_questionnaire_imports WHERE source_version_id=vid;
 IF l.question_count<>16 OR l.detail_count<>19
 OR jsonb_array_length(l.mappings->'questions')<>16 OR jsonb_array_length(l.mappings->'details')<>19
 OR NOT EXISTS(SELECT 1 FROM public.questionnaire_versions v JOIN public.questionnaires p ON p.id=v.questionnaire_id
   WHERE v.id=vid AND v.status='published' AND p.archived_at IS NULL AND p.created_by=l.source_owner_id)
 OR NOT EXISTS(SELECT 1 FROM public.questionnaire_versions WHERE id=l.target_version_id AND status='draft')
 THEN RAISE EXCEPTION 'Unexpected import record or questionnaire state'; END IF;
 IF EXISTS(SELECT 1 FROM public.questionnaire_responses WHERE version_id IN (vid,l.target_version_id))
 OR EXISTS(SELECT 1 FROM public.questionnaire_answers WHERE version_id IN (vid,l.target_version_id))
 THEN RAISE EXCEPTION 'Response data exists; stop'; END IF;
 IF (SELECT count(*) FROM public.questionnaire_questions WHERE version_id=vid)<>16
 OR (SELECT count(DISTINCT x->>'sourceQuestionId') FROM jsonb_array_elements(l.mappings->'questions') x)<>16
 OR (SELECT count(DISTINCT x->>'targetQuestionId') FROM jsonb_array_elements(l.mappings->'questions') x)<>16
 THEN RAISE EXCEPTION 'Question mapping is incomplete or duplicated'; END IF;
 -- Preserve all rows except the explicitly permitted link/version fields and old details.
 FOREACH t IN ARRAY ARRAY['questionnaires','questionnaire_sections','questions','question_details','questionnaire_review_requests','questionnaire_responses','questionnaire_answers'] LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),''[]''::jsonb) FROM public.%I x',t) INTO before_rows;
  before_all:=before_all||jsonb_build_object(t,before_rows);
 END LOOP;
 SELECT jsonb_agg(to_jsonb(q)-'source_question_id' ORDER BY id) INTO before_rows FROM public.questionnaire_questions q;
 before_all:=before_all||jsonb_build_object('placements',before_rows);
 SELECT jsonb_agg(CASE WHEN id=vid THEN to_jsonb(v)-ARRAY['revision','updated_at','last_save_id','last_save_hash'] ELSE to_jsonb(v) END ORDER BY id) INTO before_rows FROM public.questionnaire_versions v;
 before_all:=before_all||jsonb_build_object('versions',before_rows);
 FOR m IN SELECT value FROM jsonb_array_elements(l.mappings->'questions') LOOP
  SELECT * INTO STRICT oldq FROM public.questionnaire_questions WHERE id=(m->>'sourceQuestionId')::uuid AND version_id=vid;
  SELECT * INTO STRICT source FROM public.questions WHERE id=(m->>'targetQuestionId')::uuid AND archived_at IS NULL;
  IF oldq.source_question_id IS NOT NULL OR source.created_by<>l.source_owner_id
  OR NOT EXISTS(SELECT 1 FROM public.questionnaire_questions WHERE id=(m->>'targetPlacementId')::uuid AND version_id=l.target_version_id AND source_question_id=source.id)
  THEN RAISE EXCEPTION 'Question mapping changed or already converted'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.questionnaire_question_details)<>19
 OR (SELECT count(DISTINCT x->>'sourceDetailId') FROM jsonb_array_elements(l.mappings->'details') x)<>19
 OR (SELECT count(DISTINCT x->>'targetDetailId') FROM jsonb_array_elements(l.mappings->'details') x)<>19
 THEN RAISE EXCEPTION 'Unexpected legacy explanations; stop'; END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(l.mappings->'details') LOOP
  SELECT * INTO STRICT oldd FROM public.questionnaire_question_details WHERE id=(m->>'sourceDetailId')::uuid;
  SELECT * INTO STRICT newd FROM public.question_details WHERE id=(m->>'targetDetailId')::uuid;
  IF oldd.title IS DISTINCT FROM newd.title OR oldd.body IS DISTINCT FROM newd.body
    OR oldd.visible_to_consultants IS DISTINCT FROM newd.visible_to_consultants
    OR oldd.created_by IS DISTINCT FROM (m->>'sourceAuthorId')::uuid
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(l.mappings->'questions') qm
     WHERE (qm->>'sourceQuestionId')::uuid=oldd.question_id AND (qm->>'targetQuestionId')::uuid=newd.question_id)
  THEN RAISE EXCEPTION 'Explanation content, visibility, author or question link differs'; END IF;
 END LOOP;
 UPDATE public.questionnaire_questions p SET source_question_id=(qm->>'targetQuestionId')::uuid
 FROM jsonb_array_elements(l.mappings->'questions') qm
 WHERE p.id=(qm->>'sourceQuestionId')::uuid AND p.version_id=vid;
 GET DIAGNOSTICS linked=ROW_COUNT;
 PERFORM private.validate_questionnaire_placements(vid);
 DELETE FROM public.questionnaire_question_details d USING jsonb_array_elements(l.mappings->'details') dm
 WHERE d.id=(dm->>'sourceDetailId')::uuid;
 GET DIAGNOSTICS deleted=ROW_COUNT;
 IF linked<>16 OR deleted<>19 THEN RAISE EXCEPTION 'Unexpected conversion counts'; END IF;
 UPDATE public.questionnaire_versions SET revision=revision+1,updated_at=clock_timestamp(),last_save_id=NULL,last_save_hash=NULL WHERE id=vid;
 FOREACH t IN ARRAY ARRAY['questionnaires','questionnaire_sections','questions','question_details','questionnaire_review_requests','questionnaire_responses','questionnaire_answers'] LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),''[]''::jsonb) FROM public.%I x',t) INTO after_rows;
  IF after_rows IS DISTINCT FROM before_all->t THEN RAISE EXCEPTION 'Preserved table changed: %',t; END IF;
 END LOOP;
 SELECT jsonb_agg(to_jsonb(q)-'source_question_id' ORDER BY id) INTO after_rows FROM public.questionnaire_questions q;
 IF after_rows IS DISTINCT FROM before_all->'placements' THEN RAISE EXCEPTION 'Placement metadata changed'; END IF;
 SELECT jsonb_agg(CASE WHEN id=vid THEN to_jsonb(v)-ARRAY['revision','updated_at','last_save_id','last_save_hash'] ELSE to_jsonb(v) END ORDER BY id) INTO after_rows FROM public.questionnaire_versions v;
 IF after_rows IS DISTINCT FROM before_all->'versions' THEN RAISE EXCEPTION 'Questionnaire metadata changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.questionnaire_questions WHERE version_id=vid AND source_question_id IS NULL)
 OR EXISTS(SELECT 1 FROM public.questionnaire_question_details) THEN RAISE EXCEPTION 'Conversion incomplete'; END IF;
 INSERT INTO conversion_result VALUES(jsonb_build_object('versionId',vid,'status','published','linkedQuestions',linked,'removedDuplicateDetails',deleted,'sourceQuestionsAndDetailsPreserved',true,'otherDataPreserved',true));
END $$;
SELECT result FROM conversion_result;
ROLLBACK;
