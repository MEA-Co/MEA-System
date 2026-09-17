begin;
create temporary table lead_role_fixtures (id uuid, role text);
insert into lead_role_fixtures select gen_random_uuid(), role from unnest(array['student','consultant','consultant_lead','admin']) role;
insert into auth.users (id) select id from lead_role_fixtures;
insert into public.profiles (id, role, name, student_period)
select id, role, '권한 검증', case when role = 'student' then '1학년 1학기' end from lead_role_fixtures;
grant select on lead_role_fixtures to authenticated;
select set_config('request.jwt.claim.sub', (select id::text from lead_role_fixtures where role='consultant_lead'), true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.profiles where id in (select id from lead_role_fixtures)) <> 2 then
    raise exception 'Lead must see exactly consultant and lead fixtures';
  end if;
  if (select private.is_admin()) then raise exception 'Lead must not be admin'; end if;
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') then raise exception 'Self promotion allowed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from lead_role_fixtures where role='consultant'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles where id in (select id from lead_role_fixtures)) <> 1 then raise exception 'Consultant must only see self'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from lead_role_fixtures where role='student'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles where id in (select id from lead_role_fixtures)) <> 1 then raise exception 'Student must only see self'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from lead_role_fixtures where role='admin'), true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.profiles where id in (select id from lead_role_fixtures)) <> 4 then raise exception 'Admin must see all fixtures'; end if;
end $$;
reset role;
select 'All role visibility and promotion checks passed' as result;
rollback;
