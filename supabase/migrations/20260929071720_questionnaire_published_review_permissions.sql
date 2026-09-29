-- Only the questionnaire owner may add or manage explanations, including administrators.
do $$
declare definition text;
begin
 definition := pg_get_functiondef('private.add_questionnaire_explanation(uuid,uuid,uuid,text,text,boolean)'::regprocedure);
 if position('where id=v.questionnaire_id and archived_at is null for update;' in definition)=0 then raise exception 'Unexpected explanation function'; end if;
 definition := replace(definition,'where id=v.questionnaire_id and archived_at is null for update;', 'where id=v.questionnaire_id and archived_at is null and created_by=auth.uid() for update;');
 execute definition;
 definition := pg_get_functiondef('private.manage_questionnaire_explanation(uuid,uuid,integer,text,text,boolean,boolean)'::regprocedure);
 if position('owner_id <> auth.uid() and d.created_by is distinct from auth.uid()' in definition)=0 then raise exception 'Unexpected explanation management function'; end if;
 definition := replace(definition,'owner_id <> auth.uid() and d.created_by is distinct from auth.uid()', 'owner_id <> auth.uid()');
 execute definition;
end $$;

-- Expose names of published authors only; do not broaden access to profiles.
create function private.published_questionnaire_authors()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('versionId',v.id,'name',p.name))
 from public.questionnaire_versions v
 join public.questionnaires q on q.id=v.questionnaire_id
 join public.profiles p on p.id=q.created_by
 where v.status='published' and q.archived_at is null),'[]'::jsonb);
end $$;
revoke all on function private.published_questionnaire_authors() from public,anon;
grant execute on function private.published_questionnaire_authors() to authenticated;
create function public.published_questionnaire_authors()
returns jsonb language sql stable security invoker set search_path='' as $$ select private.published_questionnaire_authors(); $$;
revoke all on function public.published_questionnaire_authors() from public,anon;
grant execute on function public.published_questionnaire_authors() to authenticated;
notify pgrst,'reload schema';
