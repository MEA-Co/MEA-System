SET local check_function_bodies = off;

CREATE TABLE "private"."questionnaire_status_requests" (
  "id"           uuid                     NOT NULL,
  "actor_id"     uuid                     NOT NULL,
  "payload_hash" text                     NOT NULL,
  "result"       jsonb                    NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "questionnaire_status_requests_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."questionnaire_status_requests"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.change_questionnaire_status (
  p_version_id           uuid,
  p_expected_revision    integer,
  p_expected_status      text,
  p_expected_archived_at timestamp with time zone,
  p_status               text,
  p_request_id           uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v public.questionnaire_versions%rowtype;
  parent public.questionnaires%rowtype;
  receipt private.questionnaire_status_requests%rowtype;
  fingerprint text;
  result jsonb;
  target_id uuid := p_version_id;
  parent_id uuid;
  new_section_id uuid;
  new_question_id uuid;
  s record; q record;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_request_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_status is null or p_status not in ('draft','published','distributed','archived')
    or p_expected_status is null or p_expected_status not in ('draft','published','distributed') then
    raise exception 'Invalid status request' using errcode='22023';
  end if;
  fingerprint := md5(jsonb_build_array(p_version_id,p_expected_revision,p_expected_status,p_expected_archived_at,p_status)::text);
  perform pg_advisory_xact_lock(hashtextextended('questionnaire-status:'||p_request_id::text,0));
  select * into receipt from private.questionnaire_status_requests where id=p_request_id;
  if found then
    if receipt.actor_id <> auth.uid() or receipt.payload_hash <> fingerprint then
      raise exception 'Request conflict' using errcode='40001';
    end if;
    return receipt.result;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  select * into parent from public.questionnaires where id=v.questionnaire_id for update;
  if parent.created_by <> auth.uid() and not (p_status='archived' and private.is_admin()) then
    raise exception 'Only creator can change status' using errcode='42501';
  end if;
  if v.revision <> p_expected_revision or v.status <> p_expected_status
    or parent.archived_at is distinct from p_expected_archived_at then
    raise exception 'Questionnaire conflict' using errcode='40001';
  end if;
  if p_status='archived' then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=parent.id;
  elsif v.status='distributed' and p_status='draft' then
    -- Never edit the distributed version or move its answers/reviews. A new
    -- questionnaire owns the editable copy, so archiving either is independent.
    target_id := gen_random_uuid(); parent_id := gen_random_uuid();
    insert into public.questionnaires(id,created_by) values(parent_id,auth.uid());
    insert into public.questionnaire_versions(id,questionnaire_id,title,revision)
      values(target_id,parent_id,v.title,1);
    for s in select * from public.questionnaire_sections where version_id=v.id order by position loop
      new_section_id := gen_random_uuid();
      insert into public.questionnaire_sections(id,version_id,title,position)
        values(new_section_id,target_id,s.title,s.position);
      for q in select * from public.questionnaire_questions where section_id=s.id order by position loop
        new_question_id := gen_random_uuid();
        insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position,kind,options,scale_config,choice_style,choice_allow_text,source_question_id)
          values(new_question_id,target_id,new_section_id,q.logical_key,q.body,q.position,q.kind,q.options,q.scale_config,q.choice_style,q.choice_allow_text,q.source_question_id);
        insert into public.questionnaire_question_details(id,question_id,title,body,visible_to_consultants,position,created_by)
          select gen_random_uuid(),new_question_id,d.title,d.body,d.visible_to_consultants,d.position,d.created_by
          from public.questionnaire_question_details d where d.question_id=q.id;
      end loop;
    end loop;
    perform private.validate_questionnaire_placements(target_id);
  else
    if v.status='distributed' and p_status <> 'distributed' then
      raise exception 'Distributed version is immutable' using errcode='55000';
    end if;
    if parent.archived_at is not null then
      -- A referenced source may have been archived while this document was hidden.
      perform private.validate_questionnaire_placements(v.id);
      update public.questionnaires set archived_at=null where id=parent.id;
    end if;
    if p_status='draft' and v.status='published' then
      update public.questionnaire_versions set status='draft',published_at=null,revision=revision+1,updated_at=clock_timestamp() where id=v.id;
    elsif p_status='published' and v.status='draft' then
      perform private.publish_questionnaire(v.id,v.revision);
      update public.questionnaire_versions set revision=revision+1 where id=v.id;
    elsif p_status='distributed' and v.status <> 'distributed' then
      if v.status='draft' then perform private.publish_questionnaire(v.id,v.revision); end if;
      -- Existing validation and placement response protection remain authoritative.
      -- Advance revision before distribution, since distributed rows are immutable.
      update public.questionnaire_versions set revision=revision+1 where id=v.id;
      perform private.distribute_questionnaire(v.id,v.revision+1);
    end if;
  end if;
  result := jsonb_build_object('versionId',target_id,'copied',target_id<>p_version_id);
  insert into private.questionnaire_status_requests(id,actor_id,payload_hash,result)
    values(p_request_id,auth.uid(),fingerprint,result);
  return result;
end $function$;

CREATE OR REPLACE FUNCTION public.change_questionnaire_status (
  p_version_id           uuid,
  p_expected_revision    integer,
  p_expected_status      text,
  p_expected_archived_at timestamp with time zone,
  p_status               text,
  p_request_id           uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select private.change_questionnaire_status(p_version_id,p_expected_revision,p_expected_status,p_expected_archived_at,p_status,p_request_id);
$function$;

REVOKE ALL ON FUNCTION "private"."change_questionnaire_status"(uuid, integer, text, timestamp WITH time zone, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."change_questionnaire_status"(uuid, integer, text, timestamp WITH time zone, text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."change_questionnaire_status"(uuid, integer, text, timestamp WITH time zone, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."change_questionnaire_status"(uuid, integer, text, timestamp WITH time zone, text, uuid) TO "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."questionnaire_status_requests" TO "postgres";


-- Explicit revocations also protect replay on environments with broader defaults.
revoke all on private.questionnaire_status_requests from public, anon, authenticated, service_role;
revoke all on function private.change_questionnaire_status(uuid,integer,text,timestamptz,text,uuid) from public, anon;
revoke all on function public.change_questionnaire_status(uuid,integer,text,timestamptz,text,uuid) from public, anon;
