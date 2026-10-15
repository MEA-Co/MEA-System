begin;
alter table public.questionnaires drop constraint questionnaire_start_notice_valid;
alter table public.questionnaires add constraint questionnaire_start_notice_valid check (
 start_notice is null or (
 jsonb_typeof(start_notice)='object'
 and start_notice ?& array['title','body','buttonLabel']
 and jsonb_typeof(start_notice->'title')='string'
 and jsonb_typeof(start_notice->'body')='string'
 and jsonb_typeof(start_notice->'buttonLabel')='string'
 and length(start_notice->>'title')<=200
 and length(start_notice->>'body')<=20000
 and length(start_notice->>'buttonLabel') between 0 and 100
 )
);
create or replace function private.guard_start_notice() returns trigger language plpgsql set search_path='' as $$
begin
 if (tg_op='INSERT' and new.start_notice is not null)
 or (tg_op='UPDATE' and new.start_notice is distinct from old.start_notice) then
   if current_user <> 'postgres' or auth.uid() is null
     or not (private.is_admin() or private.is_consultant_lead())
     or new.status not in ('draft','published') or new.archived_at is not null
     or (new.created_by <> auth.uid() and new.status <> 'published') then
     raise exception 'Questionnaire notice is not editable' using errcode='42501';
   end if;
 end if;
 return new;
end $$;
-- Extend the existing atomic save; preserve revision checks, retries and source locks.
do $migration$
declare definition text; needle text := 'set title=p_document->>''title'', revision=revision+1';
begin
 select pg_get_functiondef('private.save_questionnaire_draft(jsonb,integer,uuid)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected questionnaire save definition'; end if;
 execute replace(definition,needle,
   'set title=p_document->>''title'', start_notice=case when p_document ? ''startNotice'' then nullif(p_document->''startNotice'',''null''::jsonb) else start_notice end, revision=revision+1');
end $migration$;
commit;
