-- Resolve the author separately in each environment. Local and production
-- profiles have different IDs. A schema-only installation has no week six.
do $$
declare
  target constant uuid := 'ffc36b8c-73b7-4664-975b-2263b064b066';
  owner_id uuid;
begin
  if not exists (select from public.questionnaires where id = target) then return; end if;
  select id into strict owner_id from public.profiles where role = 'admin' and name = '이동민';
  update public.questionnaires set created_by = owner_id
    where id = target and created_by <> owner_id;
  -- Individual questions retain their immutable creation identity.
end $$;
