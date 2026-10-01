SET local check_function_bodies = off;

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

