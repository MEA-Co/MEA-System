-- Run only in the production project epwlcallocdjkmgdmtlv SQL Editor,
-- after migration 20261001060231 has been applied.
-- Environment-specific configuration: do not run in local DB or migration replay.
begin;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '4e4c12e7-6357-4803-95de-e2d603bbda3e'::uuid
      and role in ('consultant_lead', 'admin')
  ) then
    raise exception 'Production guide account is missing or is not a lead/admin';
  end if;
end;
$$;

create or replace function private.guide_consultant_id()
returns uuid
language sql
immutable
set search_path to ''
as $$ select '4e4c12e7-6357-4803-95de-e2d603bbda3e'::uuid; $$;

revoke all on function private.guide_consultant_id() from public, anon, authenticated;
grant execute on function private.guide_consultant_id() to postgres;

select private.guide_consultant_id() as guide_consultant_id;

commit;
