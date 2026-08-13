create table public.quests (
  id uuid primary key default gen_random_uuid(),
  student_period text not null,
  question text not null,
  answer_type text not null,
  table_columns text[] not null default '{}'::text[],
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quests_student_period_check
    check (
      student_period in (
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
  constraint quests_question_check
    check (char_length(btrim(question)) between 1 and 500),
  constraint quests_answer_type_check
    check (answer_type in ('text', 'table')),
  constraint quests_table_columns_check
    check (
      (
        answer_type = 'text'
        and cardinality(table_columns) = 0
      )
      or (
        answer_type = 'table'
        and cardinality(table_columns) between 1 and 8
        and array_position(table_columns, null) is null
        and array_position(table_columns, '') is null
      )
    )
);

create index quests_student_period_created_at_idx
  on public.quests (student_period, created_at desc);

create index quests_created_by_idx
  on public.quests (created_by);

alter table public.quests enable row level security;

create policy "Admins can read quests"
  on public.quests
  for select
  to authenticated
  using ((select private.is_admin()));

create policy "Admins can create quests"
  on public.quests
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_admin())
  );

revoke all on table public.quests from anon, authenticated;
grant select, insert on table public.quests to authenticated;
