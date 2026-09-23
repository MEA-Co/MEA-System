SET local check_function_bodies = off;

CREATE TABLE "public"."question_details" (
  "id"                     uuid                     NOT NULL,
  "question_id"            uuid                     NOT NULL,
  "position"               integer                  NOT NULL,
  "title"                  text                     NOT NULL DEFAULT ''::text,
  "body"                   text                     NOT NULL DEFAULT ''::text,
  "visible_to_consultants" boolean                  NOT NULL DEFAULT false,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_details_body_check" CHECK ((char_length(body) <= 10000)),
  CONSTRAINT "question_details_pkey" PRIMARY KEY (id),
  CONSTRAINT "question_details_position_check" CHECK ((("position" >= 0) AND ("position" <= 19))),
  CONSTRAINT "question_details_title_check" CHECK ((char_length(title) <= 200))
);

ALTER TABLE "public"."question_details"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.save_question (
  p_document          jsonb,
  p_expected_revision integer,
  p_save_id           uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_id uuid;
  v_detail jsonb;
  v_position bigint;
  v_existing public.questions%rowtype;
  v_saved public.questions%rowtype;
  v_hash text := md5(p_document::text);
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Question block author permission required' using errcode = '42501';
  end if;
  if p_document is null or pg_catalog.jsonb_typeof(p_document) <> 'object'
    or (p_document->>'id') is null or (p_document->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_save_id is null or p_expected_revision is null or p_expected_revision < 0
    or char_length(p_document::text) > 300000 then
    raise exception 'Invalid question block request' using errcode = '22023';
  end if;
  if p_document ? 'details' then
    if jsonb_typeof(p_document->'details') is distinct from 'array' then
      raise exception 'Invalid question details' using errcode = '22023';
    end if;
    if jsonb_array_length(p_document->'details') > 20 then
      raise exception 'Too many question details' using errcode = '22023';
    end if;
    for v_detail in select value from jsonb_array_elements(p_document->'details') loop
      if jsonb_typeof(v_detail) is distinct from 'object'
        or jsonb_typeof(v_detail->'id') is distinct from 'string'
        or (v_detail->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(v_detail->'title') is distinct from 'string'
        or char_length(v_detail->>'title') > 200
        or jsonb_typeof(v_detail->'text') is distinct from 'string'
        or char_length(v_detail->>'text') > 10000
        or jsonb_typeof(v_detail->'visibleToConsultants') is distinct from 'boolean' then
        raise exception 'Invalid question detail' using errcode = '22023';
      end if;
    end loop;
    if (select count(*) <> count(distinct (value->>'id')::uuid)
      from jsonb_array_elements(p_document->'details')) then
      raise exception 'Duplicate question detail IDs' using errcode = '22023';
    end if;
  end if;
  v_id := (p_document->>'id')::uuid;
  select * into v_existing from public.questions where id = v_id for update;
  if found then
    if v_existing.created_by <> auth.uid() and not private.is_admin() then
      raise exception 'Only author or admin can edit' using errcode = '42501';
    end if;
    if v_existing.archived_at is not null then
      raise exception 'Question block is archived' using errcode = '55000';
    end if;
    if v_existing.last_save_id = p_save_id and v_existing.last_save_hash = v_hash then
      return pg_catalog.to_jsonb(v_existing) || jsonb_build_object('details', (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
      'text', d.body, 'visibleToConsultants', d.visible_to_consultants) order by d.position), '[]'::jsonb)
    from public.question_details d where d.question_id = v_id));
    end if;
    if v_existing.revision <> p_expected_revision or v_existing.last_save_id = p_save_id then
      raise exception 'Question block revision conflict' using errcode = '40001';
    end if;
    update public.questions set
      title = pg_catalog.btrim(p_document->>'title'),
      prompt = pg_catalog.btrim(p_document->>'prompt'),
      fields = p_document->'fields',
      row_mode = p_document->>'rowMode',
      max_rows = (p_document->>'maxRows')::integer,
      source_block_id = (p_document->>'sourceBlockId')::uuid,
      source_field_id = (p_document->>'sourceFieldId')::uuid,
      after_block_id = (p_document->>'afterBlockId')::uuid,
      condition = case when p_document->'condition' = 'null'::jsonb
        then null else p_document->'condition' end,
      revision = revision + 1,
      last_save_id = p_save_id,
      last_save_hash = v_hash
    where id = v_id returning * into v_saved;
  else
    if p_expected_revision <> 0 then
      raise exception 'Question block revision conflict' using errcode = '40001';
    end if;
    insert into public.questions (
      id, created_by, title, prompt, fields, row_mode, max_rows,
      source_block_id, source_field_id, after_block_id, condition,
      revision, last_save_id, last_save_hash
    ) values (
      v_id, auth.uid(), pg_catalog.btrim(p_document->>'title'), pg_catalog.btrim(p_document->>'prompt'),
      p_document->'fields', p_document->>'rowMode', (p_document->>'maxRows')::integer,
      (p_document->>'sourceBlockId')::uuid, (p_document->>'sourceFieldId')::uuid,
      (p_document->>'afterBlockId')::uuid,
      case when p_document->'condition' = 'null'::jsonb
        then null else p_document->'condition' end, 1, p_save_id, v_hash
    ) returning * into v_saved;
  end if;
  if p_document ? 'details' then
    for v_detail, v_position in
      select value, ordinality - 1 from jsonb_array_elements(p_document->'details') with ordinality
    loop
      insert into public.question_details(id, question_id, position, title, body, visible_to_consultants)
      values ((v_detail->>'id')::uuid, v_id, v_position, v_detail->>'title', v_detail->>'text',
        (v_detail->>'visibleToConsultants')::boolean)
      on conflict (id) do update set position = excluded.position, title = excluded.title,
        body = excluded.body, visible_to_consultants = excluded.visible_to_consultants, updated_at = now()
      where public.question_details.question_id = excluded.question_id;
      if not found then
        raise exception 'Detail belongs to another question' using errcode = '22023';
      end if;
    end loop;
    delete from public.question_details where question_id = v_id
      and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_document->'details'));
  end if;
  return pg_catalog.to_jsonb(v_saved) || jsonb_build_object('details', (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
      'text', d.body, 'visibleToConsultants', d.visible_to_consultants) order by d.position), '[]'::jsonb)
    from public.question_details d where d.question_id = v_id));
end $function$;

ALTER TABLE "public"."question_details"
  ADD CONSTRAINT "question_details_question_id_fkey" FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

CREATE INDEX question_details_question_position_idx ON public.question_details USING btree (question_id, "position");

CREATE POLICY "Staff read question details" ON "public"."question_details"
  FOR SELECT
  TO "authenticated"
  USING ((( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_consultant_lead() AS is_consultant_lead)));

COMMENT ON TABLE "public"."question_details" IS 'Authoring guidance and examples, separate from canonical question-answer data. Consultant visibility is presentation metadata, not a current access grant.';

-- Explicitly revoke default client grants when replayed in another environment.
REVOKE ALL ON TABLE "public"."question_details" FROM PUBLIC, "anon", "authenticated";

GRANT SELECT ON TABLE "public"."question_details" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."question_details" TO "postgres", "service_role";


NOTIFY pgrst, 'reload schema';
