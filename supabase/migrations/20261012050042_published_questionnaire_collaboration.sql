-- Published questionnaire collaborators may edit shared originals; distribution locks still apply.
create function private.can_edit_published_question(qid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.is_admin() or private.is_consultant_lead()) and exists (
 select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id
 where p.source_question_id=qid and v.status='published' and v.archived_at is null);
$$;
revoke all on function private.can_edit_published_question(uuid) from public, anon;
grant execute on function private.can_edit_published_question(uuid) to authenticated;

alter policy "Staff read questions" on public.questions using (
 (select private.is_admin()) or ((select private.is_consultant_lead()) and
 (created_by=(select auth.uid()) or private.can_edit_published_question(id))));

do $patch$
declare definition text := pg_get_functiondef('public.read_questionnaire_draft(uuid)'::regprocedure);
begin
 if (length(definition)-length(replace(definition,$old$p.created_by=(select auth.uid()) and p.archived_at is null$old$,'')))/length($old$p.created_by=(select auth.uid()) and p.archived_at is null$old$) <> 1 then
 raise exception 'Unexpected function definition: public.read_questionnaire_draft(uuid)'; end if;
 execute replace(definition,$old$p.created_by=(select auth.uid()) and p.archived_at is null$old$,$new$(p.created_by=(select auth.uid()) or p.status='published') and p.archived_at is null$new$);
end $patch$;

do $patch$
declare definition text := pg_get_functiondef('private.save_questionnaire_draft(jsonb,integer,uuid)'::regprocedure);
begin
 if (length(definition)-length(replace(definition,$old$where id=v.id and created_by=auth.uid()$old$,'')))/length($old$where id=v.id and created_by=auth.uid()$old$) <> 1 then
 raise exception 'Unexpected function definition: private.save_questionnaire_draft(jsonb,integer,uuid)'; end if;
 execute replace(definition,$old$where id=v.id and created_by=auth.uid()$old$,$new$where id=v.id and (created_by=auth.uid() or status='published')$new$);
end $patch$;

do $patch$
declare definition text := pg_get_functiondef('private.guide_answer_field_ids(uuid)'::regprocedure);
begin
 if (length(definition)-length(replace(definition,$old$(created_by=auth.uid() or private.is_admin())$old$,'')))/length($old$(created_by=auth.uid() or private.is_admin())$old$) <> 1 then
 raise exception 'Unexpected function definition: private.guide_answer_field_ids(uuid)'; end if;
 execute replace(definition,$old$(created_by=auth.uid() or private.is_admin())$old$,$new$(created_by=auth.uid() or private.is_admin() or private.can_edit_published_question(qid))$new$);
end $patch$;

do $patch$
declare definition text := pg_get_functiondef('private.questionnaire_guide_question_ids(uuid)'::regprocedure);
begin
 if (length(definition)-length(replace(definition,$old$(created_by=auth.uid() or private.is_admin())$old$,'')))/length($old$(created_by=auth.uid() or private.is_admin())$old$) <> 1 then
 raise exception 'Unexpected function definition: private.questionnaire_guide_question_ids(uuid)'; end if;
 execute replace(definition,$old$(created_by=auth.uid() or private.is_admin())$old$,$new$(created_by=auth.uid() or private.is_admin() or (status='published' and archived_at is null and private.is_consultant_lead()))$new$);
end $patch$;

do $patch$
declare definition text := pg_get_functiondef('private.save_question(jsonb,integer,uuid)'::regprocedure);
begin
 if (length(definition)-length(replace(definition,$old$v_existing.created_by <> auth.uid() and not private.is_admin()$old$,'')))/length($old$v_existing.created_by <> auth.uid() and not private.is_admin()$old$) <> 1 then
 raise exception 'Unexpected function definition: private.save_question(jsonb,integer,uuid)'; end if;
 execute replace(definition,$old$v_existing.created_by <> auth.uid() and not private.is_admin()$old$,$new$v_existing.created_by <> auth.uid() and not private.is_admin() and not private.can_edit_published_question(v_id)$new$);
end $patch$;

do $patch$
declare definition text := pg_get_functiondef('private.guard_question_private_sources()'::regprocedure);
begin
 if (length(definition)-length(replace(definition,$old$q.id=new.source_question_id and q.created_by=auth.uid()$old$,'')))/length($old$q.id=new.source_question_id and q.created_by=auth.uid()$old$) <> 1 then
 raise exception 'Unexpected function definition: private.guard_question_private_sources()'; end if;
 execute replace(definition,$old$q.id=new.source_question_id and q.created_by=auth.uid()$old$,$new$q.id=new.source_question_id and (q.created_by=auth.uid() or private.can_edit_published_question(q.id))$new$);
end $patch$;

do $patch$
declare definition text := pg_get_functiondef('private.guard_question_private_sources()'::regprocedure);
begin
 if (length(definition)-length(replace(definition,$old$q.id=source_id and q.created_by=auth.uid()$old$,'')))/length($old$q.id=source_id and q.created_by=auth.uid()$old$) <> 1 then
 raise exception 'Unexpected function definition: private.guard_question_private_sources()'; end if;
 execute replace(definition,$old$q.id=source_id and q.created_by=auth.uid()$old$,$new$q.id=source_id and (q.created_by=auth.uid() or private.can_edit_published_question(q.id))$new$);
end $patch$;

