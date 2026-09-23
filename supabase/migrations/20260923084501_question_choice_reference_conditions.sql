-- Allow row references filtered by a fixed single/multiple choice.
-- Preserve question-wide answered and legacy text-field references.
CREATE OR REPLACE FUNCTION private.validate_question()
 RETURNS trigger
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
      or v_field->>'kind' is null or v_field->>'kind' not in ('text', 'scale', 'single', 'multiple') then
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
          (clause->>'op' = 'answered' and clause->>'fieldId' is null)
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


notify pgrst, 'reload schema';
