begin;
set local lock_timeout = '5s';

-- Keep the existing column and legacy objects intact; normalize on read.
-- This is pure JSON transformation, with no table access or elevated privileges.
create function private.questionnaire_notices(value jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when value is null or value = 'null'::jsonb then '[]'::jsonb
    when jsonb_typeof(value) = 'array' then value
    else jsonb_build_array(value || jsonb_build_object(
      'id', '00000000-0000-4000-8000-000000000001', 'position', 'start'))
  end;
$$;
revoke all on function private.questionnaire_notices(jsonb) from public, anon;
grant execute on function private.questionnaire_notices(jsonb) to authenticated;

create function private.questionnaire_notices_valid(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare item jsonb; normalized jsonb; ids text[] := '{}'; field text;
begin
  if value is null then return true; end if;
  if jsonb_typeof(value) not in ('object', 'array') then return false; end if;
  normalized := private.questionnaire_notices(value);
  if jsonb_array_length(normalized) > 50 then return false; end if;
  for item in select * from jsonb_array_elements(normalized) loop
    if jsonb_typeof(item) is distinct from 'object'
      or not item ?& array['id','position','title','body','buttonLabel'] then return false; end if;
    foreach field in array array['id','position','title','body','buttonLabel'] loop
      if jsonb_typeof(item->field) is distinct from 'string' then return false; end if;
    end loop;
    if (item->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or item->>'id' = any(ids)
      or (item->>'position' not in ('start','end') and (item->>'position') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      or length(item->>'title') > 200 or length(item->>'body') > 20000
      or length(item->>'buttonLabel') > 100 then return false; end if;
    foreach field in array array['explorationButtonLabel','linkButtonLabel'] loop
      if item ? field and (jsonb_typeof(item->field) is distinct from 'string' or length(item->>field) > 100) then return false; end if;
    end loop;
    ids := array_append(ids,item->>'id');
  end loop;
  return true;
end;
$$;
revoke all on function private.questionnaire_notices_valid(jsonb) from public, anon;
grant execute on function private.questionnaire_notices_valid(jsonb) to authenticated;
alter table public.questionnaires drop constraint questionnaire_start_notice_valid;
alter table public.questionnaires add constraint questionnaire_start_notice_valid
  check (private.questionnaire_notices_valid(start_notice));

-- Extend only projections and the existing atomic write. Permissions, locks,
-- save IDs, revision conflicts and response ownership checks remain unchanged.
do $migration$
declare signature text; definition text; needle text;
begin
  foreach signature in array array['public.read_questionnaire_draft(uuid)', 'public.read_shared_questionnaire(uuid)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    needle := '''startNotice'',v.start_notice';
    if position(needle in definition)=0 then raise exception 'Unexpected notice projection: %',signature; end if;
    execute replace(definition,needle,'''notices'',private.questionnaire_notices(v.start_notice)');
  end loop;
  foreach signature in array array['private.read_review_response_session(uuid)', 'private.read_published_question_response_session(uuid)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    needle := '''startNotice'',(select v.start_notice from public.questionnaires v where v.id=s.origin_questionnaire_id)';
    if position(needle in definition)=0 then raise exception 'Unexpected response notice projection: %',signature; end if;
    execute replace(definition,needle,'''notices'',private.questionnaire_notices((select v.start_notice from public.questionnaires v where v.id=s.origin_questionnaire_id))');
  end loop;
  definition := pg_get_functiondef('private.response_poll_version(jsonb)'::regprocedure);
  needle := '''startNotice'',snapshot->''startNotice''';
  if position(needle in definition)=0 then raise exception 'Unexpected response version projection'; end if;
  execute replace(definition,needle,'''notices'',snapshot->''notices''');

  definition := pg_get_functiondef('private.save_questionnaire_draft(jsonb,integer,uuid)'::regprocedure);
  needle := 'start_notice=case when p_document ? ''startNotice'' then nullif(p_document->''startNotice'',''null''::jsonb) else start_notice end';
  if position(needle in definition)=0 then raise exception 'Unexpected questionnaire save definition'; end if;
  definition := replace(definition,needle,'start_notice=case when p_document ? ''notices'' then p_document->''notices'' else start_notice end');
  needle := '  -- Serialize even the first save;';
  if position(needle in definition)=0 then raise exception 'Unexpected questionnaire validation definition'; end if;
  definition := replace(definition,needle,$validation$
  if p_document ? 'startNotice' or (p_document ? 'notices' and (
    jsonb_typeof(p_document->'notices') is distinct from 'array'
    or not private.questionnaire_notices_valid(p_document->'notices'))) then
    raise exception 'Invalid questionnaire notices; refresh the editor' using errcode='22023';
  end if;
  -- Serialize even the first save;$validation$);
  execute definition;
end $migration$;
-- Poll only the notice fingerprint, rather than retransmitting all notice bodies.
do $migration$
declare signature text; definition text; needle text;
begin
  foreach signature in array array['private.read_review_response_session(uuid)', 'private.read_published_question_response_session(uuid)'] loop
    definition := pg_get_functiondef(signature::regprocedure);
    needle := '''notices'',private.questionnaire_notices((select v.start_notice from public.questionnaires v where v.id=s.origin_questionnaire_id))';
    if position(needle in definition)=0 then raise exception 'Unexpected notice fingerprint projection: %',signature; end if;
    execute replace(definition,needle,needle||',''noticesToken'',(select md5(coalesce(v.start_notice,''[]''::jsonb)::text) from public.questionnaires v where v.id=s.origin_questionnaire_id)');
  end loop;
  definition := pg_get_functiondef('private.response_poll_version(jsonb)'::regprocedure);
  needle := '''notices'',snapshot->''notices''';
  if position(needle in definition)=0 then raise exception 'Unexpected notice version fingerprint projection'; end if;
  execute replace(definition,needle,'''noticesToken'',snapshot->''noticesToken''');
end $migration$;

notify pgrst, 'reload schema';
commit;
