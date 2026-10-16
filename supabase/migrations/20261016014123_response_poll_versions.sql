begin;
set local lock_timeout='5s';
-- Reuse the authoritative read path, including ownership, current definitions,
-- deleted-source handling and review layout. Only transfer metadata to the app.
create function private.response_poll_version(snapshot jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',snapshot->'id','revision',snapshot->'revision',
 'definitionToken',snapshot->'definitionToken','status',snapshot->'status',
 'savedAt',snapshot->'savedAt','submittedAt',snapshot->'submittedAt',
 'sourceDeleted',snapshot->'sourceDeleted','hasUnsubmittedChanges',coalesce(snapshot->'hasUnsubmittedChanges','false'::jsonb),
 'startNotice',snapshot->'startNotice');
$$;
revoke all on function private.response_poll_version(jsonb) from public,anon,authenticated;
create function private.read_review_response_version(p_questionnaire_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select private.response_poll_version(private.read_review_response_session(p_questionnaire_id));
$$;
revoke all on function private.read_review_response_version(uuid) from public,anon;
grant execute on function private.read_review_response_version(uuid) to authenticated;
create function public.read_review_response_version(p_questionnaire_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select private.read_review_response_version(p_questionnaire_id);
$$;
revoke all on function public.read_review_response_version(uuid) from public,anon;
grant execute on function public.read_review_response_version(uuid) to authenticated;
create function private.read_published_question_response_version(p_questionnaire_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select private.response_poll_version(private.read_published_question_response_session(p_questionnaire_id));
$$;
revoke all on function private.read_published_question_response_version(uuid) from public,anon;
grant execute on function private.read_published_question_response_version(uuid) to authenticated;
create function public.read_published_question_response_version(p_questionnaire_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select private.read_published_question_response_version(p_questionnaire_id);
$$;
revoke all on function public.read_published_question_response_version(uuid) from public,anon;
grant execute on function public.read_published_question_response_version(uuid) to authenticated;
commit;
