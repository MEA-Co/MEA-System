begin;
set local lock_timeout='5s';
-- Retire the local prototype and restore the canonical question contract.
do $migration$
declare change record; def text;
begin
  for change in select * from (values
    ('private.save_question(jsonb,integer,uuid)',$old$purpose = coalesce$old$,$new$show_admission_reference = coalesce((p_document->>'showAdmissionReference')::boolean,v_existing.show_admission_reference),
      purpose = coalesce$new$),
    ('private.save_question(jsonb,integer,uuid)',$old$row_labels, purpose, button_label$old$,$new$row_labels, show_admission_reference, purpose, button_label$new$),
    ('private.save_question(jsonb,integer,uuid)',$old$coalesce(p_document->>'purpose','response'), btrim$old$,$new$coalesce((p_document->>'showAdmissionReference')::boolean,false), coalesce(p_document->>'purpose','response'), btrim$new$),
    ('private.read_shared_question_sources(uuid)',$old$'button_label',q.button_label$old$,$new$'show_admission_reference',q.show_admission_reference,'button_label',q.button_label$new$)
  ) as changes(signature,original,prototype) loop
    def:=pg_get_functiondef(change.signature::regprocedure);
    if strpos(def,change.prototype)=0 then raise exception 'Unexpected function %',change.signature; end if;
    execute replace(def,change.prototype,change.original);
  end loop;
end $migration$;
drop function public.my_admission_reference(uuid), private.my_admission_reference(uuid);
drop table private.admission_response_references;
alter table public.questions drop column show_admission_reference;

create function private.notice_reference_sources(target_id uuid, source_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if source_id is null then
    return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) order by published_at desc,id),'[]')
      from public.questionnaires where id<>target_id and status='published' and archived_at is null);
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'title',q.title,'prompt',q.prompt,
    'fields',(select jsonb_agg(jsonb_build_object('id',f->'id','label',f->'label') order by ord)
              from jsonb_array_elements(q.fields) with ordinality field(f,ord))) order by s.position,p.position),'[]')
    from public.questionnaires v join public.questionnaire_sections s on s.questionnaire_id=v.id
    join public.questionnaire_questions p on p.section_id=s.id join public.questions q on q.id=p.source_question_id
    where v.id=source_id and v.id<>target_id and v.status='published' and v.archived_at is null
      and q.archived_at is null and q.purpose='response');
end $$;
create function public.notice_reference_sources(target_id uuid, source_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$select private.notice_reference_sources(target_id,source_id)$$;

-- Validate source membership in the same transaction as the notice document.
create function private.validate_notice_submission_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare ref jsonb; field_ids jsonb;
begin
  for ref in select item->'submissionReference' from jsonb_array_elements(private.questionnaire_notices(new.start_notice)) item
    where item ? 'submissionReference' loop
    field_ids:=ref->'fieldIds';
    if jsonb_typeof(field_ids) is distinct from 'array' or (ref - array['fieldIds','questionnaireId','questionId']) <> '{}'::jsonb then raise exception 'Invalid reference fields' using errcode='22023'; end if;
    if jsonb_array_length(field_ids) not between 1 and 20
      or jsonb_array_length(field_ids)<>(select count(distinct field) from jsonb_array_elements_text(field_ids) field)
      or not exists(select 1 from public.questionnaires v join public.questionnaire_questions p on p.questionnaire_id=v.id
        join public.questions q on q.id=p.source_question_id
        where v.id=(ref->>'questionnaireId')::uuid and v.id<>new.id and v.status='published' and v.archived_at is null
          and q.id=(ref->>'questionId')::uuid and q.purpose='response' and q.archived_at is null
          and not exists(select 1 from jsonb_array_elements_text(field_ids) wanted
            where not exists(select 1 from jsonb_array_elements(q.fields) f where f->>'id'=wanted))) then
      raise exception 'Invalid submission reference' using errcode='22023';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.validate_notice_submission_reference() from public,anon,authenticated;
create trigger validate_notice_submission_reference before insert or update of start_notice on public.questionnaires
  for each row execute function private.validate_notice_submission_reference();

create table private.notice_response_references (
  session_id uuid references public.response_sessions(id) on delete cascade,
  notice_id uuid not null,
  selection jsonb not null,
  reference jsonb not null,
  primary key(session_id,notice_id,selection)
);
alter table private.notice_response_references enable row level security;
revoke all on private.notice_response_references from public,anon,authenticated;

create function private.my_notice_reference(qid uuid,notice_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; ref jsonb; result jsonb;
begin
  target:=private.owned_published_question_session(qid);
  select item->'submissionReference' into ref from public.questionnaires v
    cross join lateral jsonb_array_elements(private.questionnaire_notices(v.start_notice)) item
    where v.id=qid and item->>'id'=notice_id::text;
  if ref is null then raise exception 'Reference not enabled' using errcode='42501'; end if;
  select r.reference into result from private.notice_response_references r
    where r.session_id=target and r.notice_id=my_notice_reference.notice_id and r.selection=ref;
  if found then return result; end if;

  select jsonb_build_object('title',s.origin_title,'question',coalesce(nullif(q.title,''),q.prompt),
    'fields',(select jsonb_agg(f order by ord) from jsonb_array_elements(q.fields) with ordinality field(f,ord)
              where (ref->'fieldIds') ? (f->>'id')),
    'rows',(select jsonb_agg(jsonb_build_object('id',r->'id','label',coalesce(r->>'label',q.row_labels->>(r->>'flowIndex')::integer),
      'answers',(select jsonb_object_agg(key,value) from jsonb_each(r->'answers') where (ref->'fieldIds') ? key)) order by ord)
      from jsonb_array_elements(a->'rows') with ordinality rows(r,ord)
      where a->'activeRowIds' @> jsonb_build_array(r->'id') and exists(
        select 1 from jsonb_each_text(r->'answers') entry where (ref->'fieldIds') ? entry.key and btrim(entry.value)<>'')))
    into result from public.response_sessions s join public.response_submissions sub on sub.session_id=s.id
    join public.questions q on q.id=(ref->>'questionId')::uuid
    cross join lateral (select sub.answers->(ref->>'questionId') as a) answer
    where s.respondent_id=auth.uid() and s.started_stage='published' and s.origin_questionnaire_id=(ref->>'questionnaireId')::uuid;
  if result->>'rows' is null or result->>'fields' is null then return null; end if;
  insert into private.notice_response_references values(target,notice_id,ref,result) on conflict do nothing;
  return (select r.reference from private.notice_response_references r where r.session_id=target
    and r.notice_id=my_notice_reference.notice_id and r.selection=ref);
end $$;
create function public.my_notice_reference(qid uuid,notice_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.my_notice_reference(qid,notice_id)$$;
revoke all on function public.notice_reference_sources(uuid,uuid),private.notice_reference_sources(uuid,uuid),
  public.my_notice_reference(uuid,uuid),private.my_notice_reference(uuid,uuid) from public,anon;
grant execute on function public.notice_reference_sources(uuid,uuid),private.notice_reference_sources(uuid,uuid),
  public.my_notice_reference(uuid,uuid),private.my_notice_reference(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
