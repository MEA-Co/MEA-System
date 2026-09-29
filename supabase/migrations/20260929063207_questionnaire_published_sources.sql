-- Read only sources actually placed in an active published questionnaire.
-- Independent question lists and mutation privileges remain creator-only.
create function private.read_published_question_sources(p_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.questionnaire_versions v
    join public.questionnaires parent on parent.id=v.questionnaire_id
    where v.id=p_version_id and v.status='published' and parent.archived_at is null
  ) then raise exception 'Published questionnaire not found' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',q.id,'created_by',q.created_by,'title',q.title,'prompt',q.prompt,
        'fields',q.fields,'row_mode',q.row_mode,'max_rows',q.max_rows,
        'min_rows',q.min_rows,'row_labels',q.row_labels,
        'source_block_id',q.source_block_id,'source_field_id',q.source_field_id,
        'after_block_id',q.after_block_id,'condition',q.condition,
        'revision',q.revision,'created_at',q.created_at,'updated_at',q.updated_at,'archived_at',q.archived_at,
        'details',coalesce((select jsonb_agg(jsonb_build_object(
          'id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants,'position',d.position
        ) order by d.position,d.id) from public.question_details d where d.question_id=q.id),'[]'::jsonb)
      ) order by q.id
    ) from public.questions q where exists (
      select 1 from public.questionnaire_questions p where p.version_id=p_version_id and p.source_question_id=q.id
    )
  ),'[]'::jsonb);
end $$;
revoke all on function private.read_published_question_sources(uuid) from public,anon;
grant execute on function private.read_published_question_sources(uuid) to authenticated;
create function public.read_published_question_sources(p_version_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.read_published_question_sources(p_version_id);
$$;
revoke all on function public.read_published_question_sources(uuid) from public,anon;
grant execute on function public.read_published_question_sources(uuid) to authenticated;
notify pgrst, 'reload schema';
