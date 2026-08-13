alter table public.profiles
  drop constraint profiles_role_check,
  drop constraint profiles_role_period_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('student', 'consultant', 'admin')),
  add constraint profiles_role_period_check
    check (
      (role = 'student' and student_period is not null)
      or (role in ('consultant', 'admin') and student_period is null)
    );

drop policy "Users can create their own profile" on public.profiles;

create policy "Users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (
    (select auth.uid()) = id
    and role in ('student', 'consultant')
  );

revoke update on table public.profiles from authenticated;
grant update (name, student_period, updated_at)
  on table public.profiles
  to authenticated;
