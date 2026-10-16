begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- A single service-wide notice. No private drafts: scheduled/ended text is
-- readable by signed-in members so disabling also emits a readable UPDATE.
create table public.service_announcements (
  id integer primary key default 1 check (id = 1),
  title text not null default '' check (char_length(title) <= 100),
  body text not null default '' check (char_length(body) <= 1000),
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  check (not enabled or (length(btrim(title)) > 0 and length(btrim(body)) > 0)),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
alter table public.service_announcements enable row level security;
revoke all on public.service_announcements from anon, authenticated;
grant select on public.service_announcements to authenticated;
grant update (title, body, enabled, starts_at, ends_at) on public.service_announcements to authenticated;
create policy announcement_read on public.service_announcements for select to authenticated using (true);
create policy announcement_admin_update on public.service_announcements for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create function private.stamp_service_announcement() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.stamp_service_announcement() from public, anon, authenticated;
create trigger stamp_service_announcement before update on public.service_announcements
for each row execute function private.stamp_service_announcement();
insert into public.service_announcements (id) values (1);
alter publication supabase_realtime add table public.service_announcements;
commit;
