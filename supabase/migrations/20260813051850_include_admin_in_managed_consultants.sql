drop policy "Users can read permitted profiles" on public.profiles;

create policy "Users can read permitted profiles"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or (
    role in ('student', 'consultant', 'admin')
    and (select private.is_admin())
  )
);
