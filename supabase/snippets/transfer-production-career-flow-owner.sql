-- Production epwlcallocdjkmgdmtlv only; explicit one-question owner transfer.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.questions in access exclusive mode;
do $transfer$
declare before_row public.questions%rowtype; after_row public.questions%rowtype;
begin
 perform 1 from public.profiles where id='b72dcd2d-e3b4-408a-aa09-87c1063731f8' and role in ('admin','consultant_lead') for share;
 if not found then raise exception 'New creator unavailable'; end if;
 select * into before_row from public.questions where id='5f6064ad-1dd6-4e0d-95dd-611ccacbce92' for update;
 if not found or before_row.archived_at is not null then raise exception 'Active question not found'; end if;
 if before_row.created_by='b72dcd2d-e3b4-408a-aa09-87c1063731f8' then return; end if;
 if before_row.created_by<>'38b5ef9f-cf72-4263-9465-126c20ad0260' then raise exception 'Unexpected current creator'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.questions'::regclass and tgname='validate_question' and tgenabled='O') then raise exception 'Unexpected trigger state'; end if;
 alter table public.questions disable trigger validate_question;
 update public.questions set created_by='b72dcd2d-e3b4-408a-aa09-87c1063731f8',revision=revision+1,updated_at=now()
 where id=before_row.id returning * into after_row;
 alter table public.questions enable trigger validate_question;
 if (to_jsonb(before_row)-array['created_by','revision','updated_at']) is distinct from (to_jsonb(after_row)-array['created_by','revision','updated_at']) then raise exception 'Question content changed'; end if;
 if after_row.created_by<>'b72dcd2d-e3b4-408a-aa09-87c1063731f8' or after_row.revision<>before_row.revision+1 then raise exception 'Transfer failed'; end if;
end $transfer$;
commit;
