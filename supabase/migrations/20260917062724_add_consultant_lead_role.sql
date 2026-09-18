alter table public.profiles
  drop constraint profiles_role_check,
  drop constraint profiles_role_period_check,
  add constraint profiles_role_check
    check (role in ('student', 'consultant', 'consultant_lead', 'admin')),
  add constraint profiles_role_period_check check (
    (role = 'student' and student_period is not null)
    or (role in ('consultant', 'consultant_lead', 'admin') and student_period is null)
  );

-- Private lookup avoids recursion through the profiles SELECT policy.
create or replace function private.is_consultant_lead()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'consultant_lead'
  );
$$;

revoke all on function private.is_consultant_lead() from public, anon;
grant execute on function private.is_consultant_lead() to authenticated;

drop policy "Users can read permitted profiles" on public.profiles;
create policy "Users can read permitted profiles"
on public.profiles for select to authenticated
using (
  (select auth.uid()) = id
  or (select private.is_admin())
  or (
    role in ('consultant', 'consultant_lead')
    and (select private.is_consultant_lead())
  )
);

-- Keep self-registration and role-update grants unchanged:
-- only student/consultant can self-register; elevated roles require trusted assignment.
