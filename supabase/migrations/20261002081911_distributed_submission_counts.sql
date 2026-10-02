-- Staff-only counts; working answers remain private.
create function private.distributed_submission_counts()
returns table(questionnaire_id uuid, count bigint)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  return query
    select s.origin_questionnaire_id, count(*)
    from public.response_submissions sub
    join public.response_sessions s on s.id=sub.session_id
    join public.questionnaires q on q.id=s.origin_questionnaire_id
    where s.started_stage='distributed' and q.status='distributed' and q.archived_at is null
    group by s.origin_questionnaire_id;
end;
$$;
create function public.distributed_submission_counts()
returns table(questionnaire_id uuid, count bigint)
language sql security invoker set search_path='' as $$
  select * from private.distributed_submission_counts();
$$;
revoke all on function private.distributed_submission_counts() from public, anon, authenticated;
revoke all on function public.distributed_submission_counts() from public, anon, authenticated;
grant execute on function private.distributed_submission_counts() to authenticated;
grant execute on function public.distributed_submission_counts() to authenticated;
