begin;
set local lock_timeout = '5s';
lock table public.questionnaire_questions in access exclusive mode;
alter table public.questions add column show_admission_reference boolean not null default false;

-- Carry forward an enabled placement once for its canonical question, including
-- published questions. DDL holds the table lock until the guards are restored.
alter table public.questions disable trigger a_published_question_lock;
alter table public.questions disable trigger validate_question;
update public.questions q set show_admission_reference=true, revision=revision+1,
  last_save_id=gen_random_uuid(), last_save_hash=md5(gen_random_uuid()::text)
where exists(select 1 from public.questionnaire_questions p
  where p.source_question_id=q.id and p.show_admission_reference);
alter table public.questions enable trigger validate_question;
alter table public.questions enable trigger a_published_question_lock;

-- Patch current definitions in-place to retain ACLs and revision/ownership checks.
do $migration$
declare change record; def text;
begin
  for change in select * from (values
    ('private.save_questionnaire_draft(jsonb,integer,uuid)',$old$
      update public.questionnaire_questions
      set show_admission_reference=coalesce((q->>'showAdmissionReference')::boolean,false)
      where id=(q->>'id')::uuid and show_admission_reference is distinct from coalesce((q->>'showAdmissionReference')::boolean,false);
$old$,$new$$new$),
    ('public.read_questionnaire_draft(uuid)',$old$,'showAdmissionReference',nullif(q.show_admission_reference,false)$old$,$new$$new$),
    ('public.read_shared_questionnaire(uuid)',$old$,'showAdmissionReference',nullif(q.show_admission_reference,false)$old$,$new$$new$),
    ('private.read_published_question_response_session(uuid)',$old$jsonb_agg(p.value || case when exists (
      select 1 from public.questionnaire_questions placement where placement.id=(p.value->>'id')::uuid
      and placement.questionnaire_id=s.origin_questionnaire_id and placement.show_admission_reference
    ) then '{"showAdmissionReference":true}'::jsonb else '{}'::jsonb end order by p.ord)$old$,$new$jsonb_agg(p.value order by p.ord)$new$),
    ('private.read_review_response_session(uuid)',$old$jsonb_agg(p.value || case when exists (
      select 1 from public.questionnaire_questions placement where placement.id=(p.value->>'id')::uuid
      and placement.questionnaire_id=s.origin_questionnaire_id and placement.show_admission_reference
    ) then '{"showAdmissionReference":true}'::jsonb else '{}'::jsonb end order by p.ord)$old$,$new$jsonb_agg(p.value order by p.ord)$new$),
    ('private.save_question(jsonb,integer,uuid)',$old$purpose = coalesce$old$,$new$show_admission_reference = coalesce((p_document->>'showAdmissionReference')::boolean,v_existing.show_admission_reference),
      purpose = coalesce$new$),
    ('private.save_question(jsonb,integer,uuid)',$old$row_labels, purpose, button_label$old$,$new$row_labels, show_admission_reference, purpose, button_label$new$),
    ('private.save_question(jsonb,integer,uuid)',$old$coalesce(p_document->>'purpose','response'), btrim$old$,$new$coalesce((p_document->>'showAdmissionReference')::boolean,false), coalesce(p_document->>'purpose','response'), btrim$new$),
    ('private.read_shared_question_sources(uuid)',$old$'button_label',q.button_label$old$,$new$'show_admission_reference',q.show_admission_reference,'button_label',q.button_label$new$),
    ('private.my_admission_reference(uuid)',$old$from public.questionnaire_questions where questionnaire_id=qid and show_admission_reference$old$,$new$from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id where p.questionnaire_id=qid and q.show_admission_reference$new$)
  ) as changes(signature,needle,replacement) loop
    def:=pg_get_functiondef(change.signature::regprocedure);
    if strpos(def,change.needle)=0 then raise exception 'Unexpected function %',change.signature; end if;
    execute replace(def,change.needle,change.replacement);
  end loop;
end $migration$;
alter table public.questionnaire_questions drop column show_admission_reference;
notify pgrst,'reload schema';
commit;
