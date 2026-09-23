-- Empty title means the displayed name follows the question's plain text.
-- Preserve that choice across later edits instead of storing a generated name.
alter table public.questions drop constraint questions_title_check;
alter table public.questions add constraint questions_title_check
  check (char_length(title) between 0 and 200);

do $$
declare
  v_definition text := pg_catalog.pg_get_functiondef('private.validate_question()'::regprocedure);
  v_old text := 'char_length(pg_catalog.btrim(new.title)) = 0 or ';
begin
  if pg_catalog.strpos(v_definition, v_old) = 0 then
    raise exception 'Expected question title validation was not found';
  end if;
  execute pg_catalog.replace(v_definition, v_old, '');
end $$;
