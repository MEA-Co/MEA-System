begin;
set local lock_timeout='5s';
-- Retain every non-draft visibility rule; restrict only private drafts.
alter policy "Read managed or distributed questionnaires" on public.questionnaires
using (
 (select private.is_admin())
 or ((select private.is_consultant_lead()) and (status <> 'draft' or created_by=(select auth.uid())))
 or (status='distributed' and archived_at is null and exists(
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='consultant'))
);
-- Existing child SELECT policies reference questionnaires and inherit its RLS.
do $migration$
declare definition text; signature text; old_clause text; new_clause text;
begin
 for signature,old_clause,new_clause in select * from (values
 ('public.read_questionnaire_draft(uuid)',
  'p.created_by=(select auth.uid()) or p.status=''published''',
  'p.created_by=(select auth.uid()) or p.status=''published'' or (p.status=''draft'' and (select private.is_admin()))'),
 ('private.save_questionnaire_draft(jsonb,integer,uuid)',
  'created_by=auth.uid() or status=''published''',
  'created_by=auth.uid() or status=''published'' or (status=''draft'' and private.is_admin())'),
 ('private.guard_start_notice()',
  '(new.created_by <> auth.uid() and new.status <> ''published'')',
  '(new.created_by <> auth.uid() and new.status <> ''published'' and not private.is_admin())')
 ) changes(signature,old_clause,new_clause) loop
   select pg_get_functiondef(signature::regprocedure) into definition;
   if position(old_clause in definition)=0 then raise exception 'Unexpected permission definition: %',signature; end if;
   execute replace(definition,old_clause,new_clause);
 end loop;
end $migration$;
commit;
