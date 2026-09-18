create or replace function private.delete_questionnaire(p_version_id uuid, p_expected_revision integer)
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
  if not private.is_admin() and not exists(select 1 from public.questionnaires where id=v.questionnaire_id and created_by=auth.uid()) then raise exception 'Only creator or admin can delete' using errcode='42501'; end if;
  -- Serialize changes to the entire questionnaire, including insertion/publication
  -- of other versions, before deciding whether any distributed history exists.
  perform 1 from public.questionnaires where id=v.questionnaire_id for update;
  perform 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id order by id for update;
  if exists(select 1 from public.questionnaires where id=v.questionnaire_id and archived_at is not null)
    and exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status='distributed') then return 'archived'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire changed' using errcode='40001'; end if;
  if exists(select 1 from public.questionnaire_versions where questionnaire_id=v.questionnaire_id and status='distributed') then
    update public.questionnaires set archived_at=coalesce(archived_at,clock_timestamp()) where id=v.questionnaire_id;
    return 'archived';
  end if;
  insert into private.deleted_questionnaire_versions(version_id)
    select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  -- Delete every dependent row for a never-distributed questionnaire atomically.
  delete from public.questionnaire_review_requests where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_publication_reads where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_answers where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_responses where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_question_details where question_id in (
    select q.id from public.questionnaire_questions q join public.questionnaire_versions x on x.id=q.version_id where x.questionnaire_id=v.questionnaire_id
  );
  delete from public.questionnaire_questions where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_sections where version_id in (select id from public.questionnaire_versions where questionnaire_id=v.questionnaire_id);
  delete from public.questionnaire_versions where questionnaire_id=v.questionnaire_id;
  delete from public.questionnaires where id=v.questionnaire_id;
  return 'deleted';
end $$;

