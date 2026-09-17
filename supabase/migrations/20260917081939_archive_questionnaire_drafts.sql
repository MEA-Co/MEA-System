create function private.archive_questionnaire_draft(p_version_id uuid, p_expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.questionnaire_versions%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text, 0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  if exists(select 1 from public.questionnaires where id=v.questionnaire_id and archived_at is not null) then return; end if;
  if v.status <> 'draft' or v.revision <> p_expected_revision then
    raise exception 'Questionnaire changed' using errcode='40001';
  end if;
  update public.questionnaires set archived_at=clock_timestamp() where id=v.questionnaire_id;
end $$;
revoke all on function private.archive_questionnaire_draft(uuid,integer) from public, anon, authenticated;
grant execute on function private.archive_questionnaire_draft(uuid,integer) to authenticated;
create function public.archive_questionnaire_draft(p_version_id uuid,p_expected_revision integer)
returns void language sql security invoker set search_path = '' as $$
  select private.archive_questionnaire_draft(p_version_id,p_expected_revision);
$$;
revoke all on function public.archive_questionnaire_draft(uuid,integer) from public, anon, authenticated;
grant execute on function public.archive_questionnaire_draft(uuid,integer) to authenticated;
