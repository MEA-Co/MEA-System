create table public.temp_student_consulting_results (
  student_id uuid not null references public.profiles (id) on delete cascade,
  consulting_id text not null,
  consulting_title text not null,
  agent_memory jsonb not null,
  result_data jsonb not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint temp_student_consulting_results_pkey
    primary key (student_id, consulting_id),
  constraint temp_student_consulting_results_consulting_id_check
    check (
      char_length(btrim(consulting_id)) between 1 and 80
      and consulting_id in ('material-box-consulting')
    ),
  constraint temp_student_consulting_results_title_check
    check (char_length(btrim(consulting_title)) between 1 and 160),
  constraint temp_student_consulting_results_agent_memory_check
    check (jsonb_typeof(agent_memory) = 'object'),
  constraint temp_student_consulting_results_result_data_check
    check (jsonb_typeof(result_data) = 'object')
);

alter table public.temp_student_consulting_results enable row level security;

create policy "Students can read own temporary consulting results"
  on public.temp_student_consulting_results
  for select
  to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'student'
    )
  );

create policy "Students can create own temporary consulting results"
  on public.temp_student_consulting_results
  for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'student'
    )
  );

create policy "Students can update own temporary consulting results"
  on public.temp_student_consulting_results
  for update
  to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'student'
    )
  )
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'student'
    )
  );

revoke all on table public.temp_student_consulting_results
  from anon, authenticated;
grant select, insert, update
  on table public.temp_student_consulting_results
  to authenticated;
