create function private.can_read_distributed_questionnaire(p_questionnaire_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from public.profiles where id=auth.uid() and role='consultant')
 and exists(select 1 from public.questionnaires q join public.questionnaire_versions v on v.questionnaire_id=q.id
   where q.id=p_questionnaire_id and q.archived_at is null and v.status='distributed');
$$;
revoke all on function private.can_read_distributed_questionnaire(uuid) from public,anon,authenticated;
grant execute on function private.can_read_distributed_questionnaire(uuid) to authenticated;
alter policy "Staff read questionnaires" on public.questionnaires using (
 (select private.is_admin()) or (select private.is_consultant_lead()) or private.can_read_distributed_questionnaire(id)
);
