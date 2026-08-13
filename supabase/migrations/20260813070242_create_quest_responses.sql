drop policy if exists "Admins can read quests" on public.quests;

create policy "Authorized users can read quests"
  on public.quests
  for select
  to authenticated
  using (
    (select private.is_admin())
    or student_period = (
      select profile.student_period
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'student'
    )
  );

create table public.quest_responses (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quest_responses_quest_student_key unique (quest_id, student_id),
  constraint quest_responses_answer_check
    check (
      (
        answer ->> 'type' = 'text'
        and jsonb_typeof(answer -> 'value') = 'string'
        and char_length(answer ->> 'value') <= 10000
      )
      or (
        answer ->> 'type' = 'table'
        and jsonb_typeof(answer -> 'rows') = 'array'
        and jsonb_array_length(answer -> 'rows') between 1 and 50
      )
    )
);

create index quest_responses_student_updated_at_idx
  on public.quest_responses (student_id, updated_at desc);

create or replace function private.can_answer_quest(
  target_quest_id uuid,
  target_answer_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quests as quest
    inner join public.profiles as profile
      on profile.id = (select auth.uid())
    where quest.id = target_quest_id
      and profile.role = 'student'
      and profile.student_period = quest.student_period
      and quest.answer_type = target_answer_type
  );
$$;

revoke all on function private.can_answer_quest(uuid, text)
  from public, anon;
grant execute on function private.can_answer_quest(uuid, text)
  to authenticated;

alter table public.quest_responses enable row level security;

create policy "Students can read own quest responses"
  on public.quest_responses
  for select
  to authenticated
  using (student_id = (select auth.uid()));

create policy "Students can create own quest responses"
  on public.quest_responses
  for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and (select private.can_answer_quest(quest_id, answer ->> 'type'))
  );

create policy "Students can update own quest responses"
  on public.quest_responses
  for update
  to authenticated
  using (student_id = (select auth.uid()))
  with check (
    student_id = (select auth.uid())
    and (select private.can_answer_quest(quest_id, answer ->> 'type'))
  );

revoke all on table public.quest_responses from anon, authenticated;
grant select, insert, update on table public.quest_responses to authenticated;
