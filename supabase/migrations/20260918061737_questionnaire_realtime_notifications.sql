-- Notifications contain no questionnaire text, IDs, private explanations or reviews.
-- Clients can receive only; writes remain in the authorized REST/RPC workflow.
create policy "Receive questionnaire change notifications"
on realtime.messages for select to authenticated
using (
  extension = 'broadcast' and private
  and topic = (select realtime.topic())
  and (
    (topic = 'questionnaires:staff'
      and ((select private.is_admin()) or (select private.is_consultant_lead())))
    or (topic = 'questionnaires:distributed' and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('admin', 'consultant_lead', 'consultant')
    ))
    or (topic = 'questionnaires:user:' || (select auth.uid())::text
      and ((select private.is_admin()) or (select private.is_consultant_lead())))
  )
);

-- Only triggers may call this definer: a receipt insert is an invoker RPC and
-- clients must not gain permission to send arbitrary Realtime messages.
create function private.notify_questionnaire_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  notify_distributed boolean := false;
  receipt_user uuid;
begin
  if auth.uid() is null then return null; end if;

  if tg_table_name = 'questionnaire_publication_reads' then
    if tg_op = 'DELETE' then receipt_user := old.user_id;
    else receipt_user := new.user_id; end if;
    perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:user:' || receipt_user::text, true);
    return null;
  elsif tg_table_name = 'questionnaire_versions' then
    if tg_op = 'INSERT' then
      -- The save RPC finishes by incrementing revision; no notification for
      -- its initial, empty version row is necessary.
      if new.revision = 0 then return null; end if;
      notify_distributed := new.status = 'distributed';
    elsif tg_op = 'UPDATE' then
      if new.revision = old.revision and new.status = old.status then return null; end if;
      notify_distributed := new.status = 'distributed' or old.status = 'distributed';
    else
      notify_distributed := old.status = 'distributed';
    end if;
  elsif tg_table_name = 'questionnaires' then
    if new.archived_at is not distinct from old.archived_at then return null; end if;
    select exists(select 1 from public.questionnaire_versions
      where questionnaire_id = new.id and status = 'distributed') into notify_distributed;
  elsif tg_table_name <> 'questionnaire_review_requests' then
    return null;
  end if;

  perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:staff', true);
  if notify_distributed then
    perform realtime.send('{}'::jsonb, 'changed', 'questionnaires:distributed', true);
  end if;
  return null;
end;
$$;
revoke all on function private.notify_questionnaire_change() from public, anon, authenticated, service_role;

create trigger questionnaire_version_changed
  after insert or update or delete on public.questionnaire_versions
  for each row execute function private.notify_questionnaire_change();
create trigger questionnaire_archived
  after update of archived_at on public.questionnaires
  for each row execute function private.notify_questionnaire_change();
create trigger questionnaire_review_changed
  after insert or update or delete on public.questionnaire_review_requests
  for each row execute function private.notify_questionnaire_change();
create trigger questionnaire_publication_read_changed
  after insert or delete on public.questionnaire_publication_reads
  for each row execute function private.notify_questionnaire_change();
