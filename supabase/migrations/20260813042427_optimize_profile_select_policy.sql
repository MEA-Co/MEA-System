drop policy "Admins can read managed profiles" on public.profiles;
drop policy "Users can read their own profile" on public.profiles;

create policy "Users can read permitted profiles"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or (
    role in ('student', 'consultant')
    and (select private.is_admin())
  )
);
