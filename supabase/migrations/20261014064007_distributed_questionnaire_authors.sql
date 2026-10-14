-- Keep the existing RPC contract and staff-only access; include active distributed questionnaires.
create or replace function private.published_questionnaire_authors()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('questionnaireId', q.id, 'name', p.name))
    from public.questionnaires q
    join public.profiles p on p.id = q.created_by
    where q.status in ('published', 'distributed') and q.archived_at is null
  ), '[]'::jsonb);
end;
$$;
revoke all on function private.published_questionnaire_authors() from public, anon;
grant execute on function private.published_questionnaire_authors() to authenticated;
