-- Do not invent authors for explanations created before authorship was recorded.
alter table public.questionnaire_question_details
  add column created_by uuid references public.profiles(id) on delete set null;
alter table public.questionnaire_question_details alter column created_by set default auth.uid();
create index questionnaire_details_creator_idx on public.questionnaire_question_details(created_by);

create function private.manage_questionnaire_explanation(
 p_version_id uuid,p_id uuid,p_revision integer,p_title text,p_description text,p_visible boolean,p_delete boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v public.questionnaire_versions%rowtype; d public.questionnaire_question_details%rowtype; owner_id uuid;
begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
   raise exception 'Forbidden' using errcode='42501'; end if;
 if p_version_id is null or p_id is null or p_revision is null or p_revision < 1 or p_delete is null then
   raise exception 'Invalid explanation request' using errcode='22023'; end if;
 if not p_delete and (p_title is null or length(btrim(p_title)) not between 1 and 500
   or p_description is null or length(btrim(p_description)) not between 1 and 20000 or p_visible is null) then
   raise exception 'Title and description required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 select * into v from public.questionnaire_versions where id=p_version_id for update;
 if not found or v.status <> 'published' then raise exception 'Only published explanations are editable' using errcode='42501'; end if;
 select created_by into owner_id from public.questionnaires where id=v.questionnaire_id and archived_at is null for update;
 if owner_id is null then raise exception 'Questionnaire unavailable' using errcode='42501'; end if;
 select detail.* into d from public.questionnaire_question_details detail
 join public.questionnaire_questions q on q.id=detail.question_id
 where detail.id=p_id and q.version_id=p_version_id for update of detail;
 if not found then raise exception 'Explanation not found' using errcode='P0002'; end if;
 if owner_id <> auth.uid() and d.created_by is distinct from auth.uid() then
   raise exception 'Only questionnaire creator or explanation author may edit' using errcode='42501'; end if;
 if not p_delete and d.title=btrim(p_title) and d.body=btrim(p_description) and d.visible_to_consultants=p_visible then return; end if;
 if v.revision <> p_revision then raise exception 'Questionnaire changed' using errcode='40001'; end if;
 if p_delete then
   delete from public.questionnaire_question_details where id=p_id;
 else
   update public.questionnaire_question_details set title=btrim(p_title),body=btrim(p_description),visible_to_consultants=p_visible where id=p_id;
 end if;
 update public.questionnaire_versions set revision=revision+1,updated_at=clock_timestamp(),last_save_id=null,last_save_hash=null where id=p_version_id;
end $$;
revoke all on function private.manage_questionnaire_explanation(uuid,uuid,integer,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function private.manage_questionnaire_explanation(uuid,uuid,integer,text,text,boolean,boolean) to authenticated;
create function public.update_questionnaire_explanation(p_version_id uuid,p_id uuid,p_revision integer,p_title text,p_description text,p_visible boolean)
returns void language sql security invoker set search_path='' as $$
 select private.manage_questionnaire_explanation(p_version_id,p_id,p_revision,p_title,p_description,p_visible,false);
$$;
create function public.delete_questionnaire_explanation(p_version_id uuid,p_id uuid,p_revision integer)
returns void language sql security invoker set search_path='' as $$
 select private.manage_questionnaire_explanation(p_version_id,p_id,p_revision,null,null,null,true);
$$;
revoke all on function public.update_questionnaire_explanation(uuid,uuid,integer,text,text,boolean) from public,anon,authenticated;
revoke all on function public.delete_questionnaire_explanation(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.update_questionnaire_explanation(uuid,uuid,integer,text,text,boolean) to authenticated;
grant execute on function public.delete_questionnaire_explanation(uuid,uuid,integer) to authenticated;
