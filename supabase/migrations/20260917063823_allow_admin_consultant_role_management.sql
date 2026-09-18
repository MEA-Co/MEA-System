create or replace function public.update_consultant_role(
  target_id uuid,
  next_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only administrators can change consultant roles'
      using errcode = '42501';
  end if;

  if next_role not in ('consultant', 'consultant_lead') then
    raise exception 'Unsupported consultant role'
      using errcode = '22023';
  end if;

  update public.profiles
  set role = next_role, updated_at = now()
  where id = target_id
    and role in ('consultant', 'consultant_lead');

  if not found then
    raise exception 'Consultant profile not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.update_consultant_role(uuid, text)
  from public, anon, service_role;
grant execute on function public.update_consultant_role(uuid, text)
  to authenticated;
