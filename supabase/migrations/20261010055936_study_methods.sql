SET local check_function_bodies = off;

CREATE TABLE "public"."study" (
  "id"         uuid                     NOT NULL,
  "owner_id"   uuid                     NOT NULL,
  "values"     jsonb                    NOT NULL,
  "reports"    jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "revision"   integer                  NOT NULL DEFAULT 1,
  "save_id"    uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone,
  CONSTRAINT "study_pkey" PRIMARY KEY (id),
  CONSTRAINT "study_revision_check" CHECK ((revision > 0))
);

ALTER TABLE "public"."study"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.can_manage_study()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('consultant','consultant_lead','admin'));
$function$;

CREATE OR REPLACE FUNCTION private.delete_study (
  p_id                uuid,
  p_expected_revision integer
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v public.study;
begin
 if auth.uid() is null or not private.can_manage_study() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into v from public.study where id=p_id for update;
 if not found then return; end if;
 if v.owner_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
 if v.deleted_at is not null then return; end if;
 if p_expected_revision is null or v.revision<>p_expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 update public.study set deleted_at=now(),updated_at=now(),revision=revision+1,values='{}',reports='[]' where id=p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guide_study_ids()
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
  -- The same visible guide can link a study through the dedicated reference field.
  for answer in select cell.value from jsonb_each(guide) g
    cross join lateral jsonb_array_elements(g.value->'rows') row
    cross join lateral jsonb_each_text(row->'answers') cell
    where exists (select 1 from public.questions q cross join lateral jsonb_array_elements(q.fields) f
      where q.id=qid and f->>'id'=cell.key and f->>'kind'='study')
  loop
    begin
      ref := answer::uuid;
      if ref is not null and not ref=any(result) then result:=array_append(result,ref); end if;
    exception when invalid_text_representation then null; end;
  end loop;
  for answer in select cell.value from jsonb_each(guide) g
    cross join lateral jsonb_array_elements(g.value->'rows') row
    cross join lateral jsonb_each_text(row->'answers') cell
  loop
   if left(answer,length('::mea-rich-text:v1::')) <> '::mea-rich-text:v1::' then continue; end if;
   begin
    doc := substring(answer from length('::mea-rich-text:v1::')+1)::jsonb;
    for mark in select jsonb_path_query(doc, '$.**.marks[*]') loop
     if mark->>'type'='studyReference' then
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

CREATE OR REPLACE FUNCTION private.question_editor_settings_valid (
  p_fields jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  v_field jsonb;
  v_option jsonb;
  v_config jsonb;
  v_other_count integer;
begin
  if pg_catalog.jsonb_typeof(p_fields) is distinct from 'array' then return false; end if;
  for v_field in select value from pg_catalog.jsonb_array_elements(p_fields) loop
    if v_field ? 'explorationRecommended' and (
      v_field->>'kind' is distinct from 'text'
      or pg_catalog.jsonb_typeof(v_field->'explorationRecommended') is distinct from 'boolean'
    ) then return false; end if;
    if v_field ? 'studyRecommended' and (
      v_field->>'kind' is distinct from 'text'
      or pg_catalog.jsonb_typeof(v_field->'studyRecommended') is distinct from 'boolean'
    ) then return false; end if;
    if v_field ? 'choiceStyle' and (
      pg_catalog.jsonb_typeof(v_field->'choiceStyle') is distinct from 'string'
      or v_field->>'choiceStyle' not in ('list', 'chip')
    ) then
      return false;
    end if;
    if v_field ? 'choiceAllowText'
      and pg_catalog.jsonb_typeof(v_field->'choiceAllowText') is distinct from 'boolean' then
      return false;
    end if;
    if v_field ? 'scaleConfig' then
      if v_field->>'kind' <> 'scale' then return false; end if;
      v_config := v_field->'scaleConfig';
      if pg_catalog.jsonb_typeof(v_config) is distinct from 'object'
        or coalesce(v_config->>'max', '') !~ '^[2-9]$'
        or pg_catalog.jsonb_typeof(v_config->'allowText') is distinct from 'boolean'
        or pg_catalog.jsonb_typeof(v_config->'low') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_config->'middle') is distinct from 'string'
        or pg_catalog.jsonb_typeof(v_config->'high') is distinct from 'string'
        or pg_catalog.char_length(v_config->>'low') > 500
        or pg_catalog.char_length(v_config->>'middle') > 500
        or pg_catalog.char_length(v_config->>'high') > 500 then
        return false;
      end if;
      if (v_config->>'max')::integer <> (v_field->>'scaleMax')::integer then
        return false;
      end if;
    end if;
    v_other_count := 0;
    if pg_catalog.jsonb_typeof(v_field->'options') = 'array' then
      for v_option in select value from pg_catalog.jsonb_array_elements(v_field->'options') loop
        if v_option ? 'isOther' then
          if pg_catalog.jsonb_typeof(v_option->'isOther') is distinct from 'boolean' then
            return false;
          end if;
          if v_option->>'isOther' = 'true' then
            v_other_count := v_other_count + 1;
          end if;
        end if;
      end loop;
    end if;
    if v_field->>'kind' = 'single' and v_other_count > 1 then return false; end if;
  end loop;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION private.question_field_response_valid (
  f        jsonb,
  v        text,
  complete boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare parsed jsonb; choices jsonb; choice jsonb; opt jsonb; k text:=f->>'kind'; seen text[]:='{}'; key text;
begin
 if v is null or length(v)>20000 then return false; end if;
 if btrim(v)='' then return not complete; end if;
 if k='text' then return not complete or length(btrim(private.question_search_plain(v)))>0; end if;
 if k in ('exploration','study') then return v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; end if;
 if k='scale' then return private.scale_answer_valid(coalesce(f->'scaleConfig',jsonb_build_object('max',coalesce((f->>'scaleMax')::int,5),'low','','middle','','high','','allowText',false)),v,complete); end if;
 if k not in ('single','multiple') then return false; end if;
 begin parsed:=v::jsonb; exception when invalid_text_representation then parsed:=to_jsonb(v); end;
 if jsonb_typeof(parsed)='object' and parsed ? 'choices' then
 if not coalesce((f->>'choiceAllowText')::boolean,false) or jsonb_typeof(parsed->'text') is distinct from 'string' or length(parsed->>'text')>5000 or (select count(*) from jsonb_object_keys(parsed))<>2 then return false; end if;
 choices:=parsed->'choices';
 else choices:=case when k='multiple' then parsed else jsonb_build_array(parsed) end; end if;
 if jsonb_typeof(choices) is distinct from 'array' then return false; end if;
 if jsonb_array_length(choices)<1 or jsonb_array_length(choices)>100 or (k='single' and jsonb_array_length(choices)<>1) then return false; end if;
 for choice in select value from jsonb_array_elements(choices) loop
 select value into opt from jsonb_array_elements(f->'options') where value->>'id'=case when jsonb_typeof(choice)='string' then choice#>>'{}' else choice->>'id' end;
 if opt is null then return false; end if;
 if coalesce((opt->>'isOther')::boolean,false) then
 if jsonb_typeof(choice) is distinct from 'object' or jsonb_typeof(choice->'text') is distinct from 'string' or length(choice->>'text')>5000 or (complete and btrim(choice->>'text')='') or (choice ? 'entryId' and (k='single' or jsonb_typeof(choice->'entryId') is distinct from 'string' or length(choice->>'entryId') not between 1 and 100)) then return false; end if;
 key:='entry:'||coalesce(choice->>'entryId',choice->>'id');
 else
 if jsonb_typeof(choice) is distinct from 'string' then return false; end if;
 key:='option:'||(choice#>>'{}'); end if;
 if key=any(seen) then return false; end if; seen:=array_append(seen,key);
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $function$;

CREATE OR REPLACE FUNCTION private.save_study (
  p_id                uuid,
  p_values            jsonb,
  p_reports           jsonb,
  p_expected_revision integer,
  p_save_id           uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
 v public.study; k text; item jsonb; uid uuid := auth.uid(); n integer;
 required_keys text[] := array['category','subject','problem','strategy','practiceGuide','practicePeriod','checklist','followup'];
 text_keys text[] := array['category','subject','problem','strategy','practiceGuide','practicePeriod','checklist','followup','customSubject','resultDiagnosis'];
begin
 if uid is null or not private.can_manage_study() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid request' using errcode='22023'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>2500000 then raise exception 'Invalid values' using errcode='22023'; end if;
 foreach k in array text_keys loop
   if jsonb_typeof(p_values->k) is distinct from 'string' or length(p_values->>k)>50000 then raise exception 'Invalid field %',k using errcode='22023'; end if;
 end loop;
 foreach k in array required_keys loop
   if (p_values->>k) !~ '[^[:space:]]' then raise exception 'Required field %',k using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_values) key where not(key=any(text_keys) or key='references'))
   or p_values->>'category' not in ('내신','모의고사(수능)','기타')
   or p_values->>'subject' not in ('국어','영어','수학','사회','과학','직접 입력')
   or (p_values->>'subject'='직접 입력' and (p_values->>'customSubject') !~ '[^[:space:]]')
 then raise exception 'Invalid study category or subject' using errcode='22023'; end if;
 if jsonb_typeof(p_values->'references') is distinct from 'array' then raise exception 'Invalid references' using errcode='22023'; end if;
 if jsonb_array_length(p_values->'references')>100 then raise exception 'Too many references' using errcode='22023'; end if;
 for item in select * from jsonb_array_elements(p_values->'references') loop
   if jsonb_typeof(item)<>'object' or item->>'clientKey' is null then raise exception 'Invalid reference' using errcode='22023'; end if;
   perform (item->>'clientKey')::uuid;
   foreach k in array array['title','selection','usage'] loop
     if jsonb_typeof(item->k) is distinct from 'string' or length(item->>k)>50000 then raise exception 'Invalid reference text' using errcode='22023'; end if;
   end loop;
 end loop;
 if p_reports is null or jsonb_typeof(p_reports)<>'array' then raise exception 'Invalid reports' using errcode='22023'; end if;
 if jsonb_array_length(p_reports)>10 then raise exception 'Too many files' using errcode='22023'; end if;
 if (select count(distinct r->>'path') from jsonb_array_elements(p_reports) r)<>jsonb_array_length(p_reports) then raise exception 'Duplicate files' using errcode='22023'; end if;
 -- Serialize inserts, updates and retries for the same id, including first saves.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
 select * into v from public.study where id=p_id for update;
 if found then
   if v.owner_id<>uid then raise exception 'Forbidden' using errcode='42501'; end if;
   if v.deleted_at is not null then raise exception 'Deleted' using errcode='40001'; end if;
   if v.save_id=p_save_id then
     if v.values=p_values and v.reports=p_reports then return to_jsonb(v); end if;
     raise exception 'Reused save id' using errcode='40001';
   end if;
   if v.revision<>p_expected_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 elsif p_expected_revision<>0 then raise exception 'Missing activity' using errcode='40001'; end if;
 for item in select * from jsonb_array_elements(p_reports) loop
   if jsonb_typeof(item)<>'object' or item->>'path' is null or item->>'name' is null
     or length(item->>'name')>255 or item->>'name' !~* '\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$'
     or item->>'path' !~ ('^'||uid::text||'/'||p_id::text||'/[0-9a-f-]{36}\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$')
     or jsonb_typeof(item->'size') is distinct from 'number'
     or (item->>'size')::bigint not between 1 and 20971520
   then raise exception 'Invalid report' using errcode='22023'; end if;
   if jsonb_typeof(item->'clientKey') is distinct from 'string'
     or (item->>'clientKey') !~ '^[0-9a-f-]{36}$'
     or jsonb_typeof(item->'type') is distinct from 'string' or length(item->>'type')>200
     or jsonb_typeof(item->'lastModified') is distinct from 'number' or (item->>'lastModified') !~ '^[0-9]+$'
     or (item->>'size') !~ '^[0-9]+$'
     or (item->>'path') not like (uid::text||'/'||p_id::text||'/'||(item->>'clientKey')||'.%')
   then raise exception 'Invalid file metadata' using errcode='22023'; end if;
   perform (item->>'clientKey')::uuid;
   -- The object must already exist. Never accept a manifest that refers to another account or activity.
   select count(*) into n from storage.objects where bucket_id='study-reports' and name=item->>'path'
     and (metadata->>'size')::bigint=(item->>'size')::bigint;
   if n<>1 then raise exception 'Upload not found' using errcode='22023'; end if;
 end loop;
 if v.id is null then
   insert into public.study(id,owner_id,values,reports,save_id)
   values(p_id,uid,p_values,p_reports,p_save_id) returning * into v;
 else
   update public.study set values=p_values,reports=p_reports,revision=revision+1,save_id=p_save_id,updated_at=clock_timestamp()
   where id=p_id returning * into v;
 end if;
 return to_jsonb(v);
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_question()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_field jsonb;
  v_option jsonb;
  v_clause jsonb;
  v_source public.questions%rowtype;
  v_source_field jsonb;
  v_ref uuid;
  v_refs uuid[] := '{}';
  v_ids uuid[] := '{}';
  v_option_ids uuid[];
  v_option_labels text[];
  v_operator text;
begin
  -- All dependency edits serialize, so concurrent saves cannot create a cycle.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('questions_dependencies', 0));
  if tg_op = 'UPDATE' then
    if old.id <> new.id or old.created_by <> new.created_by or old.created_at <> new.created_at then
      raise exception 'Question block identity cannot change' using errcode = '22023';
    end if;
    if old.archived_at is not null then
      raise exception 'Archived question block cannot change' using errcode = '55000';
    end if;
  end if;
  if char_length(pg_catalog.btrim(new.prompt)) = 0
    or pg_catalog.jsonb_typeof(new.fields) is distinct from 'array'
    or pg_catalog.jsonb_array_length(new.fields) not between 1 and 20 then
    raise exception 'Invalid question block content' using errcode = '22023';
  end if;
  for v_field in select value from pg_catalog.jsonb_array_elements(new.fields) loop
    if pg_catalog.jsonb_typeof(v_field) is distinct from 'object'
      or (v_field->>'id') is null or (v_field->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or char_length(pg_catalog.btrim(coalesce(v_field->>'label', ''))) not between 1 and 100
      or v_field->>'kind' is null or v_field->>'kind' not in ('text', 'scale', 'single', 'multiple', 'exploration', 'study') then
      raise exception 'Invalid answer field' using errcode = '22023';
    end if;
    if (v_field->>'id')::uuid = any(v_ids) then
      raise exception 'Duplicate answer field' using errcode = '22023';
    end if;
    v_ids := pg_catalog.array_append(v_ids, (v_field->>'id')::uuid);
    if v_field->>'kind' in ('single', 'multiple') then
      if pg_catalog.jsonb_typeof(v_field->'options') is distinct from 'array'
        or pg_catalog.jsonb_array_length(v_field->'options') not between 2 and 20 then
        raise exception 'Choice field needs 2 to 20 options' using errcode = '22023';
      end if;
      v_option_ids := '{}';
      v_option_labels := '{}';
      for v_option in select value from pg_catalog.jsonb_array_elements(v_field->'options') loop
        if pg_catalog.jsonb_typeof(v_option) is distinct from 'object'
          or (v_option->>'id') is null or (v_option->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          or char_length(pg_catalog.btrim(coalesce(v_option->>'label', ''))) not between 1 and 500 then
          raise exception 'Invalid choice option' using errcode = '22023';
        end if;
        if (v_option->>'id')::uuid = any(v_option_ids) then
          raise exception 'Duplicate choice option' using errcode = '22023';
        end if;
        if pg_catalog.lower(pg_catalog.btrim(v_option->>'label')) = any(v_option_labels) then
          raise exception 'Duplicate choice label' using errcode = '22023';
        end if;
        v_option_ids := pg_catalog.array_append(v_option_ids, (v_option->>'id')::uuid);
        v_option_labels := pg_catalog.array_append(v_option_labels,
          pg_catalog.lower(pg_catalog.btrim(v_option->>'label')));
      end loop;
    elsif v_field->>'kind' = 'scale' and (
      (v_field->>'scaleMax') is null or (v_field->>'scaleMax') !~ '^[0-9]+$'
      or (v_field->>'scaleMax')::integer not between 2 and 9
    ) then
      raise exception 'Invalid scale range' using errcode = '22023';
    end if;
  end loop;

  if new.after_block_id is not null then v_refs := pg_catalog.array_append(v_refs, new.after_block_id); end if;
  if new.source_block_id is not null then
    v_refs := pg_catalog.array_append(v_refs, new.source_block_id);
    if new.source_field_id is null then
      if not exists (
        select 1 from jsonb_array_elements(coalesce(new.condition->'clauses', '[]'::jsonb)) clause
        where clause->>'blockId' = new.source_block_id::text and (
          (clause->>'op' = 'answered')
          or exists (
            select 1 from public.questions source
            cross join lateral jsonb_array_elements(source.fields) field
            where source.id = new.source_block_id
              and field->>'id' = clause->>'fieldId'
              and ((field->>'kind' = 'single' and clause->>'op' = 'equals')
                or (field->>'kind' = 'multiple' and clause->>'op' = 'includes'))
              and not exists (select 1 from jsonb_array_elements(field->'options') option
                where option->>'isOther' = 'true')
          )
        )
      ) then
        raise exception 'Referenced question needs an answered or fixed-choice condition' using errcode = '22023';
      end if;
    else
    select * into v_source from public.questions where id = new.source_block_id;
    select value into v_source_field from pg_catalog.jsonb_array_elements(coalesce(v_source.fields, '[]'::jsonb))
    where value->>'id' = new.source_field_id::text;
    if v_source_field is null or v_source_field->>'kind' <> 'text' then
      raise exception 'Referenced rows need a text source field' using errcode = '22023';
    end if;
    end if;
  end if;
  if new.condition is not null then
    if pg_catalog.jsonb_typeof(new.condition) is distinct from 'object'
      or new.condition->>'mode' is null or new.condition->>'mode' not in ('all', 'any')
      or pg_catalog.jsonb_typeof(new.condition->'clauses') is distinct from 'array'
      or pg_catalog.jsonb_array_length(new.condition->'clauses') not between 1 and 10 then
      raise exception 'Invalid question condition' using errcode = '22023';
    end if;
    for v_clause in select value from pg_catalog.jsonb_array_elements(new.condition->'clauses') loop
      if pg_catalog.jsonb_typeof(v_clause) is distinct from 'object'
        or (v_clause->>'blockId') is null or (v_clause->>'blockId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or ((v_clause->>'fieldId') is null and coalesce(v_clause->>'op', '') <> 'answered')
        or (v_clause->>'fieldId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid condition reference' using errcode = '22023';
      end if;
      v_ref := (v_clause->>'blockId')::uuid;
      v_refs := pg_catalog.array_append(v_refs, v_ref);
      if v_clause->>'fieldId' is null and v_clause->>'op' = 'answered' then continue; end if;
      select * into v_source from public.questions where id = v_ref;
      select value into v_source_field from pg_catalog.jsonb_array_elements(coalesce(v_source.fields, '[]'::jsonb))
      where value->>'id' = v_clause->>'fieldId';
      v_operator := v_clause->>'op';
      if v_source_field is null or v_operator is null or v_operator not in ('answered', 'equals', 'includes', 'gte', 'lte')
        or (v_operator = 'includes' and v_source_field->>'kind' <> 'multiple')
        or (v_operator in ('gte', 'lte') and v_source_field->>'kind' <> 'scale')
        or (v_operator = 'equals' and v_source_field->>'kind' = 'multiple')
        or (v_operator in ('gte', 'lte') and (pg_catalog.jsonb_typeof(v_clause->'value') <> 'number'
          or (v_clause->>'value')::numeric not between 1 and (v_source_field->>'scaleMax')::numeric))
        or (v_operator in ('equals', 'includes') and pg_catalog.jsonb_typeof(v_clause->'value') is distinct from
          case when v_source_field->>'kind' = 'scale' then 'number' else 'string' end) then
        raise exception 'Condition does not match its answer field' using errcode = '22023';
      end if;
      if v_operator in ('equals', 'includes') and v_source_field->>'kind' in ('single', 'multiple')
        and not exists (select 1 from pg_catalog.jsonb_array_elements(v_source_field->'options') o
          where o->>'id' = v_clause->>'value') then
        raise exception 'Condition choice does not exist' using errcode = '22023';
      end if;
    end loop;
  end if;

  foreach v_ref in array v_refs loop
    if v_ref = new.id or not exists (
      select 1 from public.questions where id = v_ref and archived_at is null
    ) then
      raise exception 'Question block dependency is unavailable' using errcode = '22023';
    end if;
    if exists (
      with recursive walk(id, path) as (
        select v_ref, array[new.id, v_ref]::uuid[]
        union all
        select edge.id, walk.path || edge.id
        from walk
        join public.questions block on block.id = walk.id
        cross join lateral (
          select dep as id from pg_catalog.unnest(array[block.after_block_id, block.source_block_id]) dep
          union all
          select (clause->>'blockId')::uuid
          from pg_catalog.jsonb_array_elements(coalesce(block.condition->'clauses', '[]'::jsonb)) clause
        ) edge
        where walk.id <> new.id and edge.id is not null
          and (edge.id = new.id or not edge.id = any(walk.path))
      )
      select 1 from walk where id = new.id
    ) then
      raise exception 'Question block dependency cycle' using errcode = '22023';
    end if;
  end loop;

  if tg_op = 'UPDATE' and new.archived_at is not null and old.archived_at is null
    and exists (
      select 1 from public.questions block
      where block.id <> new.id and block.archived_at is null and (
        block.after_block_id = new.id or block.source_block_id = new.id
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(coalesce(block.condition->'clauses', '[]'::jsonb)) clause
          where clause->>'blockId' = new.id::text
        )
      )
    ) then
    raise exception 'Question block is used by another block' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and (new.fields is distinct from old.fields or new.row_mode is distinct from old.row_mode)
    and exists (
      select 1 from public.questions block
      where block.id <> new.id and block.archived_at is null and (
        block.source_block_id = new.id
        or exists (
          select 1 from pg_catalog.jsonb_array_elements(coalesce(block.condition->'clauses', '[]'::jsonb)) clause
          where clause->>'blockId' = new.id::text
        )
      )
    ) then
    raise exception 'Referenced answer fields or rows cannot change' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.delete_study (
  p_id                uuid,
  p_expected_revision integer
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.delete_study(p_id,p_expected_revision); $function$;

CREATE OR REPLACE FUNCTION public.save_study (
  p_id                uuid,
  p_values            jsonb,
  p_reports           jsonb,
  p_expected_revision integer,
  p_save_id           uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
 select private.save_study(p_id,p_values,p_reports,p_expected_revision,p_save_id);
$function$;

ALTER TABLE "public"."study"
  ADD CONSTRAINT "study_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX study_owner_updated_idx ON public.study USING btree (owner_id, updated_at DESC, id);

CREATE INDEX study_updated_idx ON public.study USING btree (updated_at DESC, id)
  WHERE (deleted_at IS NULL);

CREATE POLICY "study_guide_reference_read" ON "public"."study"
  FOR SELECT
  TO "authenticated"
  USING (((deleted_at IS NULL) AND (id = ANY (( SELECT private.guide_study_ids() AS guide_study_ids)::uuid[]))));

CREATE POLICY "study_owner_read" ON "public"."study"
  FOR SELECT
  TO "authenticated"
  USING (((owner_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.can_manage_study() AS can_manage_study)));

CREATE POLICY "study_staff_read" ON "public"."study"
  FOR SELECT
  TO "authenticated"
  USING (((deleted_at IS NULL) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_consultant_lead() AS is_consultant_lead))));

CREATE POLICY "study_report_delete" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING
    (((bucket_id = 'study-reports'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND ( SELECT private.can_manage_study() AS can_manage_study) AND
    (NOT (EXISTS ( SELECT 1
   FROM public.study a
  WHERE ((a.owner_id = ( SELECT auth.uid() AS uid)) AND (a.deleted_at IS NULL) AND (a.reports @> jsonb_build_array(jsonb_build_object('path', objects.name)))))))));

CREATE POLICY "study_report_guide_reference_read" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'study-reports'::text) AND (EXISTS ( SELECT 1
   FROM public.study e
  WHERE
    ((e.id = ANY (( SELECT private.guide_study_ids() AS guide_study_ids)::uuid[])) AND (e.deleted_at IS NULL) AND ((e.id)::text = (storage.foldername(objects.name))[2]) AND
    ((e.owner_id)::text = (storage.foldername(objects.name))[1]) AND (e.reports @> jsonb_build_array(jsonb_build_object('path', objects.name))))))));

CREATE POLICY "study_report_insert" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((bucket_id = 'study-reports'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (name ~ (('^'::text || (( SELECT auth.uid() AS uid))::text)
    || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|hwp|hwpx|doc|docx|ppt|pptx)$'::text)) AND ( SELECT private.can_manage_study() AS can_manage_study)));

CREATE POLICY "study_report_read" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING
    (((bucket_id = 'study-reports'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND ( SELECT private.can_manage_study() AS can_manage_study)));

CREATE POLICY "study_report_staff_read" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'study-reports'::text) AND (( SELECT private.is_admin() AS is_admin) OR ( SELECT private.is_consultant_lead() AS is_consultant_lead)) AND (EXISTS ( SELECT 1
   FROM public.study e
  WHERE
    (((e.id)::text = (storage.foldername(objects.name))[2]) AND ((e.owner_id)::text = (storage.foldername(objects.name))[1]) AND (e.deleted_at IS NULL) AND (e.reports @>
    jsonb_build_array(jsonb_build_object('path', objects.name))))))));

REVOKE ALL ON FUNCTION "private"."can_manage_study"() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "private"."can_manage_study"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."delete_study"(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "private"."delete_study"(uuid, integer) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."guide_study_ids"() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "private"."guide_study_ids"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."save_study"(uuid, jsonb, jsonb, integer, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "private"."save_study"(uuid, jsonb, jsonb, integer, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."delete_study"(uuid, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "public"."delete_study"(uuid, integer) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_study"(uuid, jsonb, jsonb, integer, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION "public"."save_study"(uuid, jsonb, jsonb, integer, uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."study" FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE "public"."study" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."study" TO "postgres", "service_role";


-- Storage buckets are data and must accompany the generated schema migration.
insert into storage.buckets(id,name,public,file_size_limit)
values('study-reports','study-reports',false,20971520)
on conflict(id) do update set public=false,file_size_limit=20971520;
