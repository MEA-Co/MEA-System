-- Keep only an identifier receipt so a delayed first-save retry cannot recreate
-- a permanently deleted draft. No questionnaire content is retained here.
create table private.deleted_questionnaire_versions (
  version_id uuid primary key,
  deleted_at timestamptz not null default now()
);
alter table private.deleted_questionnaire_versions enable row level security;
revoke all on private.deleted_questionnaire_versions from public, anon, authenticated;

create function private.reject_deleted_questionnaire_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from private.deleted_questionnaire_versions where version_id=new.id) then
    raise exception 'Questionnaire was deleted' using errcode='55000';
  end if;
  return new;
end $$;
revoke all on function private.reject_deleted_questionnaire_version() from public, anon, authenticated;
create trigger reject_deleted_questionnaire_version before insert on public.questionnaire_versions
for each row execute function private.reject_deleted_questionnaire_version();

create function private.delete_questionnaire(p_version_id uuid, p_expected_revision integer)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.questionnaire_versions%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then
    if exists(select 1 from private.deleted_questionnaire_versions where version_id=p_version_id) then return 'deleted'; end if;
    raise exception 'Questionnaire not found' using errcode='P0002';
  end if;
  -- Serialize changes to the entire questionnaire, including insertion/publication
  -- of other versions, before deciding whether any published history exists.
  perform 1 from public.questionnaires where id=v.questionnaire_id for update;
  perform 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id order by id for update;
  if exists(select 1 from public.questionnaires where id=v.questionnaire_id and archived_at is not null)
    and exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status='published') then return 'archived'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire changed' using errcode='40001'; end if;
  if exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status='published') then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=v.questionnaire_id;
    return 'archived';
  end if;
  -- An unexpected response attached to an unpublished version is never destroyed.
  if exists(select 1 from public.questionnaire_responses r join public.questionnaire_versions x on x.id=r.version_id where x.questionnaire_id=v.questionnaire_id) then
    raise exception 'Unpublished questionnaire has responses' using errcode='55000';
  end if;
  insert into private.deleted_questionnaire_versions(version_id)
    select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  delete from public.questionnaire_question_details where question_id in (
    select q.id from public.questionnaire_questions q join public.questionnaire_versions x on x.id=q.version_id where x.questionnaire_id=v.questionnaire_id
  );
  delete from public.questionnaire_questions where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_sections where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  delete from public.questionnaires where id=v.questionnaire_id;
  return 'deleted';
end $$;
revoke all on function private.delete_questionnaire(uuid,integer) from public, anon, authenticated;
grant execute on function private.delete_questionnaire(uuid,integer) to authenticated;
create function public.delete_questionnaire(p_version_id uuid,p_expected_revision integer)
returns text language sql security invoker set search_path = '' as $$
  select private.delete_questionnaire(p_version_id,p_expected_revision);
$$;
revoke all on function public.delete_questionnaire(uuid,integer) from public, anon, authenticated;
grant execute on function public.delete_questionnaire(uuid,integer) to authenticated;
-- Older clients must follow the same deletion policy too.
create or replace function private.archive_questionnaire_draft(p_version_id uuid,p_expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.delete_questionnaire(p_version_id,p_expected_revision); end $$;
