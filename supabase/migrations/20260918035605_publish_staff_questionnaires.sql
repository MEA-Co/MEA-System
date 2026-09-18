-- Publishing is staff-only; assigning a response must not expose the document to consultants.
alter policy "Read assigned or managed versions" on public.questionnaire_versions
using ((select private.is_admin()) or (select private.is_consultant_lead()));

create function private.publish_questionnaire(p_version_id uuid, p_expected_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.questionnaire_versions%rowtype;
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode='42501';
  end if;
  if p_version_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid questionnaire' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
  select * into v from public.questionnaire_versions where id=p_version_id for update;
  if not found then raise exception 'Questionnaire not found' using errcode='P0002'; end if;
  perform 1 from public.questionnaires where id=v.questionnaire_id and archived_at is null for update;
  if not found then raise exception 'Questionnaire is archived' using errcode='55000'; end if;
  if v.revision <> p_expected_revision then raise exception 'Questionnaire conflict' using errcode='40001'; end if;
  if v.status='published' then return; end if;
  if btrim(v.title)='' or not exists(select 1 from public.questionnaire_questions where version_id=v.id)
    or exists(select 1 from public.questionnaire_questions where version_id=v.id and btrim(body)='') then
    raise exception 'Title and questions are required' using errcode='22023';
  end if;
  update public.questionnaire_versions set status='published',published_at=now(),updated_at=now() where id=v.id;
end $$;
revoke all on function private.publish_questionnaire(uuid,integer) from public,anon,authenticated;
grant execute on function private.publish_questionnaire(uuid,integer) to authenticated;
create function public.publish_questionnaire(p_version_id uuid,p_expected_revision integer)
returns void language sql security invoker set search_path='' as $$
 select private.publish_questionnaire(p_version_id,p_expected_revision);
$$;
revoke all on function public.publish_questionnaire(uuid,integer) from public,anon,authenticated;
grant execute on function public.publish_questionnaire(uuid,integer) to authenticated;

create function public.read_published_questionnaire(p_version_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status='published' and exists(select 1 from public.questionnaires parent where parent.id=v.questionnaire_id and parent.archived_at is null)
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$$;
revoke all on function public.read_published_questionnaire(uuid) from public, anon, authenticated;
grant execute on function public.read_published_questionnaire(uuid) to authenticated;
