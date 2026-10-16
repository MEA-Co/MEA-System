begin;
create temporary table announcement_users (id uuid, role text);
insert into announcement_users select gen_random_uuid(), role from unnest(array['student','consultant','consultant_lead','admin']) role;
insert into auth.users (id) select id from announcement_users;
insert into public.profiles (id, role, name, student_period)
select id, role, '공지 테스트', case when role = 'student' then '1학년 1학기' end from announcement_users;
grant select on announcement_users to authenticated;

do $$ begin
  if has_table_privilege('anon', 'public.service_announcements', 'SELECT') then raise exception 'Anonymous read'; end if;
  if has_table_privilege('authenticated', 'public.service_announcements', 'INSERT') then raise exception 'Member insert'; end if;
  if has_table_privilege('authenticated', 'public.service_announcements', 'DELETE') then raise exception 'Member delete'; end if;
  if has_column_privilege('authenticated', 'public.service_announcements', 'revision', 'UPDATE') then raise exception 'Revision override'; end if;
  if not exists(select from pg_publication_tables where pubname='supabase_realtime' and tablename='service_announcements') then raise exception 'Missing realtime publication'; end if;
end $$;
set local role authenticated;
do $$ declare member record; affected integer; begin
  for member in select * from announcement_users where role <> 'admin' loop
    perform set_config('request.jwt.claim.sub', member.id::text, true);
    if (select count(*) from public.service_announcements) <> 1 then raise exception 'Member cannot read notice'; end if;
    update public.service_announcements set title='forbidden' where id=1;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Member changed notice'; end if;
  end loop;
end $$;
select set_config('request.jwt.claim.sub', (select id::text from announcement_users where role='admin'), true);
do $$ declare old_revision integer; affected integer; begin
  select revision into old_revision from public.service_announcements where id=1;
  update public.service_announcements set title='점검 안내',body='작성 내용을 저장해 주세요.',enabled=true,starts_at=now(),ends_at=now()+interval '1 hour' where id=1 and revision=old_revision;
  if (select revision from public.service_announcements where id=1) <> old_revision+1 then raise exception 'Revision not incremented'; end if;
  update public.service_announcements set title='stale write' where id=1 and revision=old_revision;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stale write accepted'; end if;
  begin
    update public.service_announcements set ends_at=starts_at where id=1;
    raise exception 'Invalid schedule accepted';
  exception when check_violation then null; end;
  begin
    update public.service_announcements set title='' where id=1;
    raise exception 'Empty active title accepted';
  exception when check_violation then null; end;
  update public.service_announcements set enabled=false where id=1;
  if (select enabled from public.service_announcements where id=1) then raise exception 'Stop failed'; end if;
end $$;
reset role;
select 'announcement permissions, schedule constraints, conflict and stop passed' as result;
rollback;
