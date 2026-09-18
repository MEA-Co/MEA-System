-- Restored from the 2026-09-18 production schema export; no data included.
-- Already present in production: reconcile history before remote deployment.
begin;
CREATE OR REPLACE FUNCTION "public"."get_major_value_context"("p_major_ids" "uuid"[], "p_include_keywords" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE result jsonb;
BEGIN
 IF p_major_ids IS NULL OR cardinality(p_major_ids) NOT BETWEEN 1 AND 3
 OR EXISTS(SELECT 1 FROM unnest(p_major_ids) x WHERE x IS NULL)
 OR (SELECT count(DISTINCT x) FROM unnest(p_major_ids) x)<>cardinality(p_major_ids)
 THEN RAISE EXCEPTION '서로 다른 전공 ID 1~3개가 필요합니다'; END IF;
 IF (SELECT count(*) FROM public.majors WHERE id=ANY(p_major_ids))<>cardinality(p_major_ids)
 THEN RAISE EXCEPTION '현재 권한으로 조회할 수 없는 전공 ID가 있습니다'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_major_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.major_disciplinary_perspectives p WHERE p.major_id=x))
 THEN RAISE EXCEPTION '메타데이터가 없는 전공이 있습니다. 적용 범위를 확인하세요'; END IF;
 SELECT jsonb_agg(jsonb_build_object(
 'input_order',chosen.ord,'major',jsonb_build_object('id',m.id,'name',m.name,'description',m.description),
 'field',jsonb_build_object('id',f.id,'name',f.name,'description',f.description),
 'disciplinary_perspective',(SELECT to_jsonb(p) FROM public.major_disciplinary_perspectives p WHERE p.major_id=m.id),
 'inquiry_dimensions',coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.sort_order,d.id) FROM public.major_inquiry_dimensions d WHERE d.major_id=m.id),'[]'::jsonb),
 'thinking_modes',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.sort_order,v.id) FROM public.major_effective_thinking_modes v WHERE v.major_id=m.id),'[]'::jsonb),
 'value_lenses',coalesce((SELECT jsonb_agg(to_jsonb(v)||jsonb_build_object('core_value_references',
  coalesce((SELECT jsonb_agg(to_jsonb(cv) ORDER BY cv.sort_order) FROM public.core_values cv WHERE cv.id IN
   (SELECT r.core_value_id FROM public.field_value_lens_core_values r WHERE v.source_scope='field' AND r.lens_id=v.id
    UNION SELECT r.core_value_id FROM public.major_value_lens_core_values r WHERE v.source_scope='major' AND r.lens_id=v.id)),'[]'::jsonb))
  ORDER BY v.sort_order,v.id) FROM public.major_effective_value_lenses v WHERE v.major_id=m.id),'[]'::jsonb),
 'value_tensions',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.sort_order,v.id) FROM public.major_effective_value_tensions v WHERE v.major_id=m.id),'[]'::jsonb),
 'keywords',CASE WHEN p_include_keywords THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',k.id,'name',k.name,'description',k.description,
  'examples',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'label',e.label) ORDER BY e.sort_order,e.id) FROM public.keyword_examples e WHERE e.keyword_id=k.id),'[]'::jsonb))
  ORDER BY k.sort_order,k.id) FROM public.major_keywords k WHERE k.major_id=m.id),'[]'::jsonb) ELSE NULL END
 ) ORDER BY chosen.ord) INTO result
 FROM unnest(p_major_ids) WITH ORDINALITY chosen(id,ord) JOIN public.majors m ON m.id=chosen.id JOIN public.fields f ON f.id=m.field_id;
 RETURN jsonb_build_object('metadata_version','value-exploration-2026-09-16-v1','purpose','dialogue_material_not_student_classification','majors',result);
END $$;

CREATE OR REPLACE FUNCTION "public"."touch_value_metadata_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION "public"."validate_value_metadata_parent"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE parent_field uuid; actual_field uuid; parent_lens text;
BEGIN
 IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
 SELECT field_id INTO actual_field FROM public.majors WHERE id=NEW.major_id;
 EXECUTE format('SELECT field_id FROM public.%I WHERE id=$1',TG_ARGV[0]) INTO parent_field USING NEW.parent_id;
 IF parent_field IS DISTINCT FROM actual_field THEN RAISE EXCEPTION '다른 계열 항목을 구체화할 수 없습니다'; END IF;
 IF TG_TABLE_NAME='major_value_lenses' THEN
  SELECT lens_type INTO parent_lens FROM public.field_value_lenses WHERE id=NEW.parent_id;
  IF parent_lens IS DISTINCT FROM NEW.lens_type THEN RAISE EXCEPTION '구체화 렌즈의 관점 유형이 다릅니다'; END IF;
 END IF;
 RETURN NEW;
END $_$;

CREATE TABLE IF NOT EXISTS "public"."core_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "lens_type" "text" NOT NULL,
    "synonyms" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "distinction_notes" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "core_values_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "core_values_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "core_values_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "core_values_distinction_notes_check" CHECK (("btrim"("distinction_notes") <> ''::"text")),
    CONSTRAINT "core_values_lens_type_check" CHECK (("lens_type" = ANY (ARRAY['exploration'::"text", 'evaluation'::"text", 'problem'::"text", 'application'::"text"]))),
    CONSTRAINT "core_values_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "core_values_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."field_thinking_modes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "field_thinking_modes_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "field_thinking_modes_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "field_thinking_modes_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "field_thinking_modes_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "field_thinking_modes_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."field_value_lens_core_values" (
    "lens_id" "uuid" NOT NULL,
    "core_value_id" "uuid" NOT NULL,
    "relation_notes" "text" NOT NULL,
    CONSTRAINT "field_value_lens_core_values_relation_notes_check" CHECK (("btrim"("relation_notes") <> ''::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."field_value_lenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "lens_type" "text" NOT NULL,
    "applies_to" "text" NOT NULL,
    "question_guidance" "text" NOT NULL,
    "interpretation_caution" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "field_value_lenses_applies_to_check" CHECK (("btrim"("applies_to") <> ''::"text")),
    CONSTRAINT "field_value_lenses_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "field_value_lenses_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "field_value_lenses_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "field_value_lenses_interpretation_caution_check" CHECK (("btrim"("interpretation_caution") <> ''::"text")),
    CONSTRAINT "field_value_lenses_lens_type_check" CHECK (("lens_type" = ANY (ARRAY['exploration'::"text", 'evaluation'::"text", 'problem'::"text", 'application'::"text"]))),
    CONSTRAINT "field_value_lenses_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "field_value_lenses_question_guidance_check" CHECK (("btrim"("question_guidance") <> ''::"text")),
    CONSTRAINT "field_value_lenses_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."field_value_tensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "side_a" "text" NOT NULL,
    "side_b" "text" NOT NULL,
    "description" "text" NOT NULL,
    "context" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "field_value_tensions_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "field_value_tensions_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "field_value_tensions_context_check" CHECK (("btrim"("context") <> ''::"text")),
    CONSTRAINT "field_value_tensions_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "field_value_tensions_side_a_check" CHECK (("btrim"("side_a") <> ''::"text")),
    CONSTRAINT "field_value_tensions_side_b_check" CHECK (("btrim"("side_b") <> ''::"text")),
    CONSTRAINT "field_value_tensions_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."major_disciplinary_perspectives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "major_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_disciplinary_perspectives_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "major_disciplinary_perspectives_description_check" CHECK (("btrim"("description") <> ''::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."major_thinking_modes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "major_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "parent_id" "uuid",
    "relation" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_thinking_modes_check" CHECK (((("relation" = 'refine'::"text") AND ("parent_id" IS NOT NULL)) OR (("relation" = 'add'::"text") AND ("parent_id" IS NULL)))),
    CONSTRAINT "major_thinking_modes_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "major_thinking_modes_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "major_thinking_modes_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "major_thinking_modes_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "major_thinking_modes_relation_check" CHECK (("relation" = ANY (ARRAY['refine'::"text", 'add'::"text"]))),
    CONSTRAINT "major_thinking_modes_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE OR REPLACE VIEW "public"."major_effective_thinking_modes" WITH ("security_invoker"='true') AS
 SELECT "m"."id" AS "major_id",
    "f"."id",
    'field'::"text" AS "source_scope",
    'inherit'::"text" AS "relation",
    NULL::"uuid" AS "parent_id",
    "f"."code",
    "f"."name",
    "f"."description",
    "f"."sort_order",
    "f"."content_origin",
    "f"."content_version"
   FROM ("public"."majors" "m"
     JOIN "public"."field_thinking_modes" "f" ON (("f"."field_id" = "m"."field_id")))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."major_thinking_modes" "x"
          WHERE (("x"."major_id" = "m"."id") AND ("x"."parent_id" = "f"."id") AND ("x"."relation" = 'refine'::"text")))))
UNION ALL
 SELECT "x"."major_id",
    "x"."id",
    'major'::"text" AS "source_scope",
    "x"."relation",
    "x"."parent_id",
    "x"."code",
    "x"."name",
    "x"."description",
    "x"."sort_order",
    "x"."content_origin",
    "x"."content_version"
   FROM "public"."major_thinking_modes" "x";

CREATE TABLE IF NOT EXISTS "public"."major_value_lenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "major_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "parent_id" "uuid",
    "relation" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "lens_type" "text" NOT NULL,
    "applies_to" "text" NOT NULL,
    "question_guidance" "text" NOT NULL,
    "interpretation_caution" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_value_lenses_applies_to_check" CHECK (("btrim"("applies_to") <> ''::"text")),
    CONSTRAINT "major_value_lenses_check" CHECK (((("relation" = 'refine'::"text") AND ("parent_id" IS NOT NULL)) OR (("relation" = 'add'::"text") AND ("parent_id" IS NULL)))),
    CONSTRAINT "major_value_lenses_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "major_value_lenses_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "major_value_lenses_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "major_value_lenses_interpretation_caution_check" CHECK (("btrim"("interpretation_caution") <> ''::"text")),
    CONSTRAINT "major_value_lenses_lens_type_check" CHECK (("lens_type" = ANY (ARRAY['exploration'::"text", 'evaluation'::"text", 'problem'::"text", 'application'::"text"]))),
    CONSTRAINT "major_value_lenses_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "major_value_lenses_question_guidance_check" CHECK (("btrim"("question_guidance") <> ''::"text")),
    CONSTRAINT "major_value_lenses_relation_check" CHECK (("relation" = ANY (ARRAY['refine'::"text", 'add'::"text"]))),
    CONSTRAINT "major_value_lenses_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE OR REPLACE VIEW "public"."major_effective_value_lenses" WITH ("security_invoker"='true') AS
 SELECT "m"."id" AS "major_id",
    "f"."id",
    'field'::"text" AS "source_scope",
    'inherit'::"text" AS "relation",
    NULL::"uuid" AS "parent_id",
    "f"."code",
    "f"."name",
    "f"."description",
    "f"."lens_type",
    "f"."applies_to",
    "f"."question_guidance",
    "f"."interpretation_caution",
    "f"."sort_order",
    "f"."content_origin",
    "f"."content_version"
   FROM ("public"."majors" "m"
     JOIN "public"."field_value_lenses" "f" ON (("f"."field_id" = "m"."field_id")))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."major_value_lenses" "x"
          WHERE (("x"."major_id" = "m"."id") AND ("x"."parent_id" = "f"."id") AND ("x"."relation" = 'refine'::"text")))))
UNION ALL
 SELECT "x"."major_id",
    "x"."id",
    'major'::"text" AS "source_scope",
    "x"."relation",
    "x"."parent_id",
    "x"."code",
    "x"."name",
    "x"."description",
    "x"."lens_type",
    "x"."applies_to",
    "x"."question_guidance",
    "x"."interpretation_caution",
    "x"."sort_order",
    "x"."content_origin",
    "x"."content_version"
   FROM "public"."major_value_lenses" "x";

CREATE TABLE IF NOT EXISTS "public"."major_value_tensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "major_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "parent_id" "uuid",
    "relation" "text" NOT NULL,
    "side_a" "text" NOT NULL,
    "side_b" "text" NOT NULL,
    "description" "text" NOT NULL,
    "context" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_value_tensions_check" CHECK (((("relation" = 'refine'::"text") AND ("parent_id" IS NOT NULL)) OR (("relation" = 'add'::"text") AND ("parent_id" IS NULL)))),
    CONSTRAINT "major_value_tensions_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "major_value_tensions_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "major_value_tensions_context_check" CHECK (("btrim"("context") <> ''::"text")),
    CONSTRAINT "major_value_tensions_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "major_value_tensions_relation_check" CHECK (("relation" = ANY (ARRAY['refine'::"text", 'add'::"text"]))),
    CONSTRAINT "major_value_tensions_side_a_check" CHECK (("btrim"("side_a") <> ''::"text")),
    CONSTRAINT "major_value_tensions_side_b_check" CHECK (("btrim"("side_b") <> ''::"text")),
    CONSTRAINT "major_value_tensions_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE OR REPLACE VIEW "public"."major_effective_value_tensions" WITH ("security_invoker"='true') AS
 SELECT "m"."id" AS "major_id",
    "f"."id",
    'field'::"text" AS "source_scope",
    'inherit'::"text" AS "relation",
    NULL::"uuid" AS "parent_id",
    "f"."code",
    "f"."side_a",
    "f"."side_b",
    "f"."description",
    "f"."context",
    "f"."sort_order",
    "f"."content_origin",
    "f"."content_version"
   FROM ("public"."majors" "m"
     JOIN "public"."field_value_tensions" "f" ON (("f"."field_id" = "m"."field_id")))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM "public"."major_value_tensions" "x"
          WHERE (("x"."major_id" = "m"."id") AND ("x"."parent_id" = "f"."id") AND ("x"."relation" = 'refine'::"text")))))
UNION ALL
 SELECT "x"."major_id",
    "x"."id",
    'major'::"text" AS "source_scope",
    "x"."relation",
    "x"."parent_id",
    "x"."code",
    "x"."side_a",
    "x"."side_b",
    "x"."description",
    "x"."context",
    "x"."sort_order",
    "x"."content_origin",
    "x"."content_version"
   FROM "public"."major_value_tensions" "x";

CREATE TABLE IF NOT EXISTS "public"."major_inquiry_dimensions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "major_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "usage_guidance" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "content_version" "text" DEFAULT 'value-exploration-2026-09-16-v1'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_inquiry_dimensions_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "major_inquiry_dimensions_content_origin_check" CHECK (("content_origin" = 'editorial_summary'::"text")),
    CONSTRAINT "major_inquiry_dimensions_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "major_inquiry_dimensions_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "major_inquiry_dimensions_sort_order_check" CHECK (("sort_order" > 0)),
    CONSTRAINT "major_inquiry_dimensions_usage_guidance_check" CHECK (("btrim"("usage_guidance") <> ''::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."major_value_lens_core_values" (
    "lens_id" "uuid" NOT NULL,
    "core_value_id" "uuid" NOT NULL,
    "relation_notes" "text" NOT NULL,
    CONSTRAINT "major_value_lens_core_values_relation_notes_check" CHECK (("btrim"("relation_notes") <> ''::"text"))
);

ALTER TABLE ONLY "public"."core_values"
    ADD CONSTRAINT "core_values_code_key" UNIQUE ("code");

ALTER TABLE ONLY "public"."core_values"
    ADD CONSTRAINT "core_values_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."core_values"
    ADD CONSTRAINT "core_values_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."field_thinking_modes"
    ADD CONSTRAINT "field_thinking_modes_field_id_code_key" UNIQUE ("field_id", "code");

ALTER TABLE ONLY "public"."field_thinking_modes"
    ADD CONSTRAINT "field_thinking_modes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."field_value_lens_core_values"
    ADD CONSTRAINT "field_value_lens_core_values_pkey" PRIMARY KEY ("lens_id", "core_value_id");

ALTER TABLE ONLY "public"."field_value_lenses"
    ADD CONSTRAINT "field_value_lenses_field_id_code_key" UNIQUE ("field_id", "code");

ALTER TABLE ONLY "public"."field_value_lenses"
    ADD CONSTRAINT "field_value_lenses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."field_value_tensions"
    ADD CONSTRAINT "field_value_tensions_field_id_code_key" UNIQUE ("field_id", "code");

ALTER TABLE ONLY "public"."field_value_tensions"
    ADD CONSTRAINT "field_value_tensions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_disciplinary_perspectives"
    ADD CONSTRAINT "major_disciplinary_perspectives_major_id_key" UNIQUE ("major_id");

ALTER TABLE ONLY "public"."major_disciplinary_perspectives"
    ADD CONSTRAINT "major_disciplinary_perspectives_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_inquiry_dimensions"
    ADD CONSTRAINT "major_inquiry_dimensions_major_id_code_key" UNIQUE ("major_id", "code");

ALTER TABLE ONLY "public"."major_inquiry_dimensions"
    ADD CONSTRAINT "major_inquiry_dimensions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_thinking_modes"
    ADD CONSTRAINT "major_thinking_modes_major_id_code_key" UNIQUE ("major_id", "code");

ALTER TABLE ONLY "public"."major_thinking_modes"
    ADD CONSTRAINT "major_thinking_modes_major_id_parent_id_key" UNIQUE ("major_id", "parent_id");

ALTER TABLE ONLY "public"."major_thinking_modes"
    ADD CONSTRAINT "major_thinking_modes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_value_lens_core_values"
    ADD CONSTRAINT "major_value_lens_core_values_pkey" PRIMARY KEY ("lens_id", "core_value_id");

ALTER TABLE ONLY "public"."major_value_lenses"
    ADD CONSTRAINT "major_value_lenses_major_id_code_key" UNIQUE ("major_id", "code");

ALTER TABLE ONLY "public"."major_value_lenses"
    ADD CONSTRAINT "major_value_lenses_major_id_parent_id_key" UNIQUE ("major_id", "parent_id");

ALTER TABLE ONLY "public"."major_value_lenses"
    ADD CONSTRAINT "major_value_lenses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_value_tensions"
    ADD CONSTRAINT "major_value_tensions_major_id_code_key" UNIQUE ("major_id", "code");

ALTER TABLE ONLY "public"."major_value_tensions"
    ADD CONSTRAINT "major_value_tensions_major_id_parent_id_key" UNIQUE ("major_id", "parent_id");

ALTER TABLE ONLY "public"."major_value_tensions"
    ADD CONSTRAINT "major_value_tensions_pkey" PRIMARY KEY ("id");

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."core_values" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."field_thinking_modes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."field_value_lenses" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."field_value_tensions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."major_disciplinary_perspectives" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."major_inquiry_dimensions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."major_thinking_modes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."major_value_lenses" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "metadata_touch" BEFORE UPDATE ON "public"."major_value_tensions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_metadata_updated_at"();

CREATE OR REPLACE TRIGGER "validate_parent" BEFORE INSERT OR UPDATE ON "public"."major_thinking_modes" FOR EACH ROW EXECUTE FUNCTION "public"."validate_value_metadata_parent"('field_thinking_modes');

CREATE OR REPLACE TRIGGER "validate_parent" BEFORE INSERT OR UPDATE ON "public"."major_value_lenses" FOR EACH ROW EXECUTE FUNCTION "public"."validate_value_metadata_parent"('field_value_lenses');

CREATE OR REPLACE TRIGGER "validate_parent" BEFORE INSERT OR UPDATE ON "public"."major_value_tensions" FOR EACH ROW EXECUTE FUNCTION "public"."validate_value_metadata_parent"('field_value_tensions');

ALTER TABLE ONLY "public"."field_thinking_modes"
    ADD CONSTRAINT "field_thinking_modes_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."field_value_lens_core_values"
    ADD CONSTRAINT "field_value_lens_core_values_core_value_id_fkey" FOREIGN KEY ("core_value_id") REFERENCES "public"."core_values"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."field_value_lens_core_values"
    ADD CONSTRAINT "field_value_lens_core_values_lens_id_fkey" FOREIGN KEY ("lens_id") REFERENCES "public"."field_value_lenses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."field_value_lenses"
    ADD CONSTRAINT "field_value_lenses_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."field_value_tensions"
    ADD CONSTRAINT "field_value_tensions_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_disciplinary_perspectives"
    ADD CONSTRAINT "major_disciplinary_perspectives_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_inquiry_dimensions"
    ADD CONSTRAINT "major_inquiry_dimensions_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_thinking_modes"
    ADD CONSTRAINT "major_thinking_modes_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_thinking_modes"
    ADD CONSTRAINT "major_thinking_modes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."field_thinking_modes"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_value_lens_core_values"
    ADD CONSTRAINT "major_value_lens_core_values_core_value_id_fkey" FOREIGN KEY ("core_value_id") REFERENCES "public"."core_values"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_value_lens_core_values"
    ADD CONSTRAINT "major_value_lens_core_values_lens_id_fkey" FOREIGN KEY ("lens_id") REFERENCES "public"."major_value_lenses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."major_value_lenses"
    ADD CONSTRAINT "major_value_lenses_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_value_lenses"
    ADD CONSTRAINT "major_value_lenses_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."field_value_lenses"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_value_tensions"
    ADD CONSTRAINT "major_value_tensions_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_value_tensions"
    ADD CONSTRAINT "major_value_tensions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."field_value_tensions"("id") ON DELETE RESTRICT;

ALTER TABLE "public"."core_values" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."field_thinking_modes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."field_value_lens_core_values" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."field_value_lenses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."field_value_tensions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."major_disciplinary_perspectives" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."major_inquiry_dimensions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."major_thinking_modes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."major_value_lens_core_values" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."major_value_lenses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."major_value_tensions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metadata_read" ON "public"."core_values" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."field_thinking_modes" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."field_value_lens_core_values" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."field_value_lenses" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."field_value_tensions" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."major_disciplinary_perspectives" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."major_inquiry_dimensions" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."major_thinking_modes" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."major_value_lens_core_values" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."major_value_lenses" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "metadata_read" ON "public"."major_value_tensions" FOR SELECT TO "authenticated" USING (true);

-- Fresh Supabase databases may grant function execution to anon by default.
-- Recreate the exported ACL rather than inheriting those default grants.
REVOKE ALL ON FUNCTION "public"."get_major_value_context"("p_major_ids" "uuid"[], "p_include_keywords" boolean) FROM PUBLIC, anon, authenticated, service_role;

GRANT ALL ON FUNCTION "public"."get_major_value_context"("p_major_ids" "uuid"[], "p_include_keywords" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."get_major_value_context"("p_major_ids" "uuid"[], "p_include_keywords" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."touch_value_metadata_updated_at"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."touch_value_metadata_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."touch_value_metadata_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."touch_value_metadata_updated_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."validate_value_metadata_parent"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."validate_value_metadata_parent"() TO "anon";

GRANT ALL ON FUNCTION "public"."validate_value_metadata_parent"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."validate_value_metadata_parent"() TO "service_role";

REVOKE ALL ON TABLE "public"."core_values", "public"."field_thinking_modes", "public"."field_value_lens_core_values", "public"."field_value_lenses", "public"."field_value_tensions", "public"."major_disciplinary_perspectives", "public"."major_effective_thinking_modes", "public"."major_effective_value_lenses", "public"."major_effective_value_tensions", "public"."major_inquiry_dimensions", "public"."major_thinking_modes", "public"."major_value_lens_core_values", "public"."major_value_lenses", "public"."major_value_tensions" FROM anon, authenticated;

GRANT ALL ON TABLE "public"."core_values" TO "service_role";

GRANT SELECT ON TABLE "public"."core_values" TO "authenticated";

GRANT ALL ON TABLE "public"."field_thinking_modes" TO "service_role";

GRANT SELECT ON TABLE "public"."field_thinking_modes" TO "authenticated";

GRANT ALL ON TABLE "public"."field_value_lens_core_values" TO "service_role";

GRANT SELECT ON TABLE "public"."field_value_lens_core_values" TO "authenticated";

GRANT ALL ON TABLE "public"."field_value_lenses" TO "service_role";

GRANT SELECT ON TABLE "public"."field_value_lenses" TO "authenticated";

GRANT ALL ON TABLE "public"."field_value_tensions" TO "service_role";

GRANT SELECT ON TABLE "public"."field_value_tensions" TO "authenticated";

GRANT ALL ON TABLE "public"."major_disciplinary_perspectives" TO "service_role";

GRANT SELECT ON TABLE "public"."major_disciplinary_perspectives" TO "authenticated";

GRANT ALL ON TABLE "public"."major_thinking_modes" TO "service_role";

GRANT SELECT ON TABLE "public"."major_thinking_modes" TO "authenticated";

GRANT ALL ON TABLE "public"."major_effective_thinking_modes" TO "service_role";

GRANT SELECT ON TABLE "public"."major_effective_thinking_modes" TO "authenticated";

GRANT ALL ON TABLE "public"."major_value_lenses" TO "service_role";

GRANT SELECT ON TABLE "public"."major_value_lenses" TO "authenticated";

GRANT ALL ON TABLE "public"."major_effective_value_lenses" TO "service_role";

GRANT SELECT ON TABLE "public"."major_effective_value_lenses" TO "authenticated";

GRANT ALL ON TABLE "public"."major_value_tensions" TO "service_role";

GRANT SELECT ON TABLE "public"."major_value_tensions" TO "authenticated";

GRANT ALL ON TABLE "public"."major_effective_value_tensions" TO "service_role";

GRANT SELECT ON TABLE "public"."major_effective_value_tensions" TO "authenticated";

GRANT ALL ON TABLE "public"."major_inquiry_dimensions" TO "service_role";

GRANT SELECT ON TABLE "public"."major_inquiry_dimensions" TO "authenticated";

GRANT ALL ON TABLE "public"."major_value_lens_core_values" TO "service_role";

GRANT SELECT ON TABLE "public"."major_value_lens_core_values" TO "authenticated";
commit;
