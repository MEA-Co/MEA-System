-- Restored catalog prerequisite from the 2026-09-18 production schema export.
-- This migration was absent from remote history despite its search objects existing.
-- See docs/local-supabase.md before any remote deployment.
begin;
CREATE OR REPLACE FUNCTION "public"."fields_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS "public"."fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fields_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."keyword_examples" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "keyword_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_example'::"text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "keyword_examples_content_origin_check" CHECK (("content_origin" = ANY (ARRAY['editorial_example'::"text", 'source_example'::"text"]))),
    CONSTRAINT "keyword_examples_label_check" CHECK (("btrim"("label") <> ''::"text")),
    CONSTRAINT "keyword_examples_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."major_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "major_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "alias_type" "text" DEFAULT 'alternative_name'::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_aliases_alias_type_check" CHECK (("alias_type" = ANY (ARRAY['alternative_name'::"text", 'abbreviation'::"text", 'group_member'::"text"]))),
    CONSTRAINT "major_aliases_name_check" CHECK (("btrim"("name") <> ''::"text"))
);

CREATE TABLE IF NOT EXISTS "public"."majors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "field_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "group_name" "text" NOT NULL,
    "item_type" "text" DEFAULT 'major'::"text" NOT NULL,
    "original_names_notes" "text" DEFAULT ''::"text" NOT NULL,
    "reference_universities" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "majors_item_type_check" CHECK (("item_type" = ANY (ARRAY['major'::"text", 'major_group'::"text"]))),
    CONSTRAINT "majors_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."major_keywords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "major_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "content_origin" "text" DEFAULT 'editorial_summary'::"text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_keywords_content_origin_check" CHECK (("content_origin" = ANY (ARRAY['editorial_summary'::"text", 'source_summary'::"text"]))),
    CONSTRAINT "major_keywords_description_check" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "major_keywords_name_check" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "major_keywords_sort_order_check" CHECK (("sort_order" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."major_university_sources" (
    "major_id" "uuid" NOT NULL,
    "university_source_id" "uuid" NOT NULL,
    "purpose" "text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "major_sources_purpose_check" CHECK (("purpose" = ANY (ARRAY['major_info'::"text", 'curriculum'::"text", 'field_overview'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."university_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "institution" "text" NOT NULL,
    "campus" "text",
    "checked_at" "date" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sources_institution_check" CHECK (("btrim"("institution") <> ''::"text")),
    CONSTRAINT "sources_title_check" CHECK (("btrim"("title") <> ''::"text")),
    CONSTRAINT "sources_url_check" CHECK (("url" ~ '^https?://'::"text"))
);

ALTER TABLE ONLY "public"."fields"
    ADD CONSTRAINT "fields_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."fields"
    ADD CONSTRAINT "fields_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."keyword_examples"
    ADD CONSTRAINT "keyword_examples_keyword_id_label_key" UNIQUE ("keyword_id", "label");

ALTER TABLE ONLY "public"."keyword_examples"
    ADD CONSTRAINT "keyword_examples_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_aliases"
    ADD CONSTRAINT "major_aliases_major_id_name_key" UNIQUE ("major_id", "name");

ALTER TABLE ONLY "public"."major_aliases"
    ADD CONSTRAINT "major_aliases_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_keywords"
    ADD CONSTRAINT "major_keywords_major_id_name_key" UNIQUE ("major_id", "name");

ALTER TABLE ONLY "public"."major_keywords"
    ADD CONSTRAINT "major_keywords_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."major_university_sources"
    ADD CONSTRAINT "major_sources_pkey" PRIMARY KEY ("major_id", "university_source_id");

ALTER TABLE ONLY "public"."majors"
    ADD CONSTRAINT "majors_field_id_sort_order_key" UNIQUE ("field_id", "sort_order");

ALTER TABLE ONLY "public"."majors"
    ADD CONSTRAINT "majors_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."majors"
    ADD CONSTRAINT "majors_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."university_sources"
    ADD CONSTRAINT "sources_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."university_sources"
    ADD CONSTRAINT "sources_url_key" UNIQUE ("url");

CREATE INDEX "keyword_examples_keyword_sort_order_idx" ON "public"."keyword_examples" USING "btree" ("keyword_id", "sort_order");

CREATE INDEX "keyword_examples_label_idx" ON "public"."keyword_examples" USING "btree" ("label");

CREATE INDEX "major_aliases_name_idx" ON "public"."major_aliases" USING "btree" ("name");

CREATE INDEX "major_keywords_major_sort_order_idx" ON "public"."major_keywords" USING "btree" ("major_id", "sort_order");

CREATE INDEX "major_university_sources_university_source_id_idx" ON "public"."major_university_sources" USING "btree" ("university_source_id");

CREATE INDEX "majors_field_sort_order_idx" ON "public"."majors" USING "btree" ("field_id", "sort_order");

CREATE OR REPLACE TRIGGER "fields_updated_at" BEFORE UPDATE ON "public"."fields" FOR EACH ROW EXECUTE FUNCTION "public"."fields_set_updated_at"();

CREATE OR REPLACE TRIGGER "keyword_examples_updated_at" BEFORE UPDATE ON "public"."keyword_examples" FOR EACH ROW EXECUTE FUNCTION "public"."fields_set_updated_at"();

CREATE OR REPLACE TRIGGER "major_aliases_updated_at" BEFORE UPDATE ON "public"."major_aliases" FOR EACH ROW EXECUTE FUNCTION "public"."fields_set_updated_at"();

CREATE OR REPLACE TRIGGER "major_keywords_updated_at" BEFORE UPDATE ON "public"."major_keywords" FOR EACH ROW EXECUTE FUNCTION "public"."fields_set_updated_at"();

CREATE OR REPLACE TRIGGER "major_university_sources_updated_at" BEFORE UPDATE ON "public"."major_university_sources" FOR EACH ROW EXECUTE FUNCTION "public"."fields_set_updated_at"();

CREATE OR REPLACE TRIGGER "majors_updated_at" BEFORE UPDATE ON "public"."majors" FOR EACH ROW EXECUTE FUNCTION "public"."fields_set_updated_at"();

CREATE OR REPLACE TRIGGER "university_sources_updated_at" BEFORE UPDATE ON "public"."university_sources" FOR EACH ROW EXECUTE FUNCTION "public"."fields_set_updated_at"();

ALTER TABLE ONLY "public"."keyword_examples"
    ADD CONSTRAINT "keyword_examples_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "public"."major_keywords"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_aliases"
    ADD CONSTRAINT "major_aliases_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_keywords"
    ADD CONSTRAINT "major_keywords_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_university_sources"
    ADD CONSTRAINT "major_sources_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."major_university_sources"
    ADD CONSTRAINT "major_sources_source_id_fkey" FOREIGN KEY ("university_source_id") REFERENCES "public"."university_sources"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."majors"
    ADD CONSTRAINT "majors_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE RESTRICT;

ALTER TABLE "public"."fields" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fields_read" ON "public"."fields" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."keyword_examples" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "keyword_examples_read" ON "public"."keyword_examples" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."major_aliases" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "major_aliases_read" ON "public"."major_aliases" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."major_keywords" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "major_keywords_read" ON "public"."major_keywords" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."major_university_sources" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "major_university_sources_read" ON "public"."major_university_sources" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."majors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "majors_read" ON "public"."majors" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."university_sources" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_sources_read" ON "public"."university_sources" FOR SELECT TO "authenticated", "anon" USING (true);

GRANT ALL ON FUNCTION "public"."fields_set_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."fields_set_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."fields_set_updated_at"() TO "service_role";

REVOKE ALL ON TABLE "public"."fields", "public"."keyword_examples", "public"."major_aliases", "public"."major_keywords", "public"."major_university_sources", "public"."majors", "public"."university_sources" FROM anon, authenticated;

GRANT ALL ON TABLE "public"."fields" TO "service_role";

GRANT SELECT ON TABLE "public"."fields" TO "anon";

GRANT SELECT ON TABLE "public"."fields" TO "authenticated";

GRANT ALL ON TABLE "public"."keyword_examples" TO "service_role";

GRANT SELECT ON TABLE "public"."keyword_examples" TO "anon";

GRANT SELECT ON TABLE "public"."keyword_examples" TO "authenticated";

GRANT ALL ON TABLE "public"."major_aliases" TO "service_role";

GRANT SELECT ON TABLE "public"."major_aliases" TO "anon";

GRANT SELECT ON TABLE "public"."major_aliases" TO "authenticated";

GRANT ALL ON TABLE "public"."majors" TO "service_role";

GRANT SELECT ON TABLE "public"."majors" TO "anon";

GRANT SELECT ON TABLE "public"."majors" TO "authenticated";

GRANT ALL ON TABLE "public"."major_keywords" TO "service_role";

GRANT SELECT ON TABLE "public"."major_keywords" TO "anon";

GRANT SELECT ON TABLE "public"."major_keywords" TO "authenticated";

GRANT ALL ON TABLE "public"."major_university_sources" TO "service_role";

GRANT SELECT ON TABLE "public"."major_university_sources" TO "anon";

GRANT SELECT ON TABLE "public"."major_university_sources" TO "authenticated";

GRANT ALL ON TABLE "public"."university_sources" TO "service_role";

GRANT SELECT ON TABLE "public"."university_sources" TO "anon";

GRANT SELECT ON TABLE "public"."university_sources" TO "authenticated";

-- Search workflow (original implementation). Review docs/major-search-preflight.sql
-- before remote rollout; catalog prerequisite above supports fresh local databases.
-- All search writes are made by the authenticated server.
create table public.major_search_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  input_text text not null check (char_length(input_text) between 1 and 120),
  normalized_input text not null check (char_length(normalized_input) between 1 and 120),
  status text not null default 'pending' check (status in ('pending','completed','failed','superseded')),
  result_source text check (result_source in ('db','model')),
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates) = 'array' and jsonb_array_length(candidates) <= 5),
  model_name text,
  model_version text,
  prompt_version text,
  catalog_version text,
  model_attempt boolean not null default false,
  reused_request_id uuid references public.major_search_requests(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index major_search_requests_user_created_idx on public.major_search_requests(user_id,created_at desc);
create index major_search_requests_session_idx on public.major_search_requests(user_id,session_id,normalized_input);
create index major_search_requests_reused_idx on public.major_search_requests(reused_request_id);
create unique index major_search_model_once_idx on public.major_search_requests(user_id,session_id,normalized_input) where model_attempt;
create table public.major_search_feedback (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.major_search_requests(id) on delete cascade,
  action text not null check (action in ('selected','confirmed','rejected','no_match')),
  major_id uuid references public.majors(id),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','verified','corrected','excluded')),
  verified_major_id uuid references public.majors(id),
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((action = 'no_match') = (major_id is null)),
  unique nulls not distinct (request_id,action,major_id)
);
create index major_search_feedback_major_idx on public.major_search_feedback(major_id);
create index major_search_feedback_verified_idx on public.major_search_feedback(verified_major_id);
create unique index major_search_one_confirmation_idx on public.major_search_feedback(request_id) where action = 'confirmed';
alter table public.major_search_requests enable row level security;
alter table public.major_search_feedback enable row level security;
revoke all on public.major_search_requests, public.major_search_feedback from anon, authenticated;
grant select, insert, update, delete on public.major_search_requests, public.major_search_feedback to service_role;

-- Invoker rights, service_role only. Lock serializes feedback against input supersession.
create function public.record_major_search_feedback(p_request_id uuid, p_user_id uuid, p_action text, p_major_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  request_row public.major_search_requests%rowtype;
  major_name text;
begin
  select * into request_row from public.major_search_requests
    where id = p_request_id and user_id = p_user_id for update;
  if not found or request_row.status <> 'completed' then
    raise exception 'Request unavailable';
  end if;
  if p_action not in ('selected','confirmed','rejected','no_match') or p_action is null then
    raise exception 'Invalid feedback';
  end if;
  if p_action = 'no_match' then
    if p_major_id is not null then raise exception 'Invalid no_match'; end if;
  else
    if p_major_id is null or not exists (
      select 1 from jsonb_array_elements(request_row.candidates) c where c->>'id' = p_major_id::text
    ) then raise exception 'Major was not offered'; end if;
    select name into major_name from public.majors where id = p_major_id;
    if not found then raise exception 'Major no longer exists'; end if;
  end if;
  if exists (select 1 from public.major_search_feedback where request_id = p_request_id and action = 'confirmed'
    and (p_action <> 'confirmed' or major_id is distinct from p_major_id)) then
    raise exception 'Already confirmed';
  end if;
  if p_action in ('confirmed','rejected') and not exists (
    select 1 from public.major_search_feedback where request_id = p_request_id and action = 'selected' and major_id = p_major_id
  ) then raise exception 'Select the candidate first'; end if;
  insert into public.major_search_feedback(request_id,action,major_id)
    values(p_request_id,p_action,p_major_id) on conflict do nothing;
  if p_action = 'confirmed' then
    return jsonb_build_object('id',p_major_id,'name',major_name,'requestId',p_request_id);
  end if;
  return null;
end;
$$;
revoke all on function public.record_major_search_feedback(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.record_major_search_feedback(uuid,uuid,text,uuid) to service_role;
commit;
