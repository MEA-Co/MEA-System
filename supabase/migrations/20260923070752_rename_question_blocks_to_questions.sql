-- Rename in place: preserve rows, foreign keys, RLS, grants and object identity.
alter table public.question_blocks rename to questions;

alter function private.validate_question_block() rename to validate_question;
alter function private.question_block_editor_settings_valid(jsonb) rename to question_editor_settings_valid;
alter function private.save_question_block(jsonb, integer, uuid) rename to save_question;
alter function public.save_question_block(jsonb, integer, uuid) rename to save_question;
alter function private.archive_question_block(uuid, integer) rename to archive_question;
alter function public.archive_question_block(uuid, integer) rename to archive_question;

-- PostgreSQL tracks table/trigger dependencies, but SQL strings and PL/pgSQL
-- bodies still contain the old identifiers. Refresh only these six functions.
do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'private' and p.proname in (
      'validate_question', 'question_editor_settings_valid', 'save_question', 'archive_question'
    )) or (n.nspname = 'public' and p.proname in ('save_question', 'archive_question'))
  loop
    execute pg_catalog.replace(
      pg_catalog.replace(pg_catalog.pg_get_functiondef(v_function.oid),
        'question_blocks', 'questions'),
      'question_block', 'question'
    );
  end loop;
end $$;

alter trigger validate_question_block on public.questions rename to validate_question;
alter policy "Staff read question blocks" on public.questions rename to "Staff read questions";

-- Constraint renames also rename their backing indexes (including the PK).
do $$
declare
  v_object record;
begin
  for v_object in
    select conname from pg_catalog.pg_constraint
    where conrelid = 'public.questions'::regclass
      and conname like 'question_block%'
  loop
    execute pg_catalog.format('alter table public.questions rename constraint %I to %I',
      v_object.conname,
      pg_catalog.replace(pg_catalog.replace(v_object.conname, 'question_blocks', 'questions'),
        'question_block', 'question'));
  end loop;
  for v_object in
    select c.relname from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indexrelid
    where i.indrelid = 'public.questions'::regclass
      and c.relname like 'question_blocks%'
  loop
    execute pg_catalog.format('alter index public.%I rename to %I', v_object.relname,
      pg_catalog.replace(v_object.relname, 'question_blocks', 'questions'));
  end loop;
end $$;

notify pgrst, 'reload schema';
