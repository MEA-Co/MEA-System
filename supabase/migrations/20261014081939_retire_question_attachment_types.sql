-- Retire standalone attachment fields without rewriting historical definitions or responses.
create or replace function private.reject_new_question_attachment_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare previous_fields jsonb := '[]'::jsonb;
begin
  if TG_OP='UPDATE' then previous_fields := OLD.fields; end if;
  if exists (
    select 1 from jsonb_array_elements(NEW.fields) field
    where field->>'kind' in ('exploration','study')
      and not exists (
        select 1 from jsonb_array_elements(previous_fields) previous
        where previous->>'id'=field->>'id' and previous->>'kind'=field->>'kind'
      )
  ) then
    raise exception 'Attachment question types are retired; use text mentions'
      using errcode='22023';
  end if;
  return NEW;
end;
$$;
revoke all on function private.reject_new_question_attachment_fields() from public,anon,authenticated;
create trigger reject_new_question_attachment_fields
before insert or update of fields on public.questions
for each row execute function private.reject_new_question_attachment_fields();
