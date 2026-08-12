create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null,
  name text not null,
  student_period text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check
    check (role in ('student', 'consultant')),
  constraint profiles_name_check
    check (char_length(btrim(name)) between 1 and 50),
  constraint profiles_student_period_check
    check (
      student_period is null
      or student_period in (
        '예비고1',
        '1학년 1학기',
        '1학년 여름방학',
        '1학년 2학기',
        '1학년 겨울방학',
        '2학년 1학기',
        '2학년 여름방학',
        '2학년 2학기',
        '2학년 겨울방학',
        '3학년 1학기',
        '3학년 여름방학',
        '3학년 2학기',
        '3학년 겨울방학'
      )
    ),
  constraint profiles_role_period_check
    check (
      (role = 'student' and student_period is not null)
      or (role = 'consultant' and student_period is null)
    )
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on table public.profiles from anon;
grant select, insert, update on table public.profiles to authenticated;
