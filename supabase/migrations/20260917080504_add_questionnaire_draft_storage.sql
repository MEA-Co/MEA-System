create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index questionnaires_creator_idx on public.questionnaires(created_by);

create table public.questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires(id) on delete restrict,
  version_number integer not null default 1 check(version_number > 0),
  title text not null default '' check(length(title) <= 500),
  status text not null default 'draft' check(status in ('draft','published')),
  revision integer not null default 0 check(revision >= 0),
  last_save_id uuid,
  last_save_hash text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(questionnaire_id, version_number),
  check ((status = 'published') = (published_at is not null))
);
create unique index questionnaire_one_draft_idx on public.questionnaire_versions(questionnaire_id) where status = 'draft';
create index questionnaire_versions_updated_idx on public.questionnaire_versions(updated_at desc);

create table public.questionnaire_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.questionnaire_versions(id) on delete restrict,
  title text not null default '' check(length(title) <= 500),
  position integer not null check(position >= 0),
  unique(id, version_id),
  unique(version_id, position) deferrable initially deferred
);
create table public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.questionnaire_versions(id) on delete restrict,
  section_id uuid not null,
  logical_key uuid not null default gen_random_uuid(),
  body text not null default '' check(length(body) <= 20000),
  position integer not null check(position >= 0),
  foreign key(section_id, version_id) references public.questionnaire_sections(id, version_id) on delete restrict,
  unique(id, version_id),
  unique(version_id, logical_key),
  unique(section_id, position) deferrable initially deferred
);
create table public.questionnaire_question_details (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questionnaire_questions(id) on delete restrict,
  title text not null default '' check(length(title) <= 500),
  body text not null default '' check(length(body) <= 20000),
  visible_to_consultants boolean not null default false,
  position integer not null check(position >= 0),
  unique(question_id, position) deferrable initially deferred
);

-- Reserved for the response flow: no client write grants until assignment/submit RPCs exist.
create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.questionnaire_versions(id) on delete restrict,
  respondent_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'assigned' check(status in ('assigned','in_progress','submitted')),
  assigned_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique(id, version_id),
  check ((status = 'submitted') = (submitted_at is not null))
);
create index questionnaire_responses_recipient_idx on public.questionnaire_responses(respondent_id, version_id);
create index questionnaire_responses_version_idx on public.questionnaire_responses(version_id);
create index questionnaire_responses_assigner_idx on public.questionnaire_responses(assigned_by);
create table public.questionnaire_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null,
  version_id uuid not null,
  question_id uuid not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(response_id, version_id) references public.questionnaire_responses(id, version_id) on delete restrict,
  foreign key(question_id, version_id) references public.questionnaire_questions(id, version_id) on delete restrict,
  unique(response_id, question_id)
);
create index questionnaire_answers_question_idx on public.questionnaire_answers(question_id, version_id);

alter table public.questionnaires enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.questionnaire_sections enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.questionnaire_question_details enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.questionnaire_answers enable row level security;
revoke all on public.questionnaires, public.questionnaire_versions, public.questionnaire_sections, public.questionnaire_questions, public.questionnaire_question_details, public.questionnaire_responses, public.questionnaire_answers from anon, authenticated;
grant select on public.questionnaires, public.questionnaire_versions, public.questionnaire_sections, public.questionnaire_questions, public.questionnaire_question_details, public.questionnaire_responses, public.questionnaire_answers to authenticated;

create policy "Staff read questionnaires" on public.questionnaires for select to authenticated
using ((select private.is_admin()) or (select private.is_consultant_lead()));
create policy "Read assigned or managed versions" on public.questionnaire_versions for select to authenticated
using ((select private.is_admin()) or (select private.is_consultant_lead()) or (status = 'published' and exists (
  select 1 from public.questionnaire_responses r where r.version_id = questionnaire_versions.id and r.respondent_id = (select auth.uid())
)));
create policy "Read visible sections" on public.questionnaire_sections for select to authenticated
using (exists (select 1 from public.questionnaire_versions v where v.id = version_id));
create policy "Read visible questions" on public.questionnaire_questions for select to authenticated
using (exists (select 1 from public.questionnaire_versions v where v.id = version_id));
create policy "Read permitted explanation items" on public.questionnaire_question_details for select to authenticated
using (((select private.is_admin()) or (select private.is_consultant_lead()) or visible_to_consultants)
  and exists (select 1 from public.questionnaire_questions q where q.id = question_id));
create policy "Read own response sessions" on public.questionnaire_responses for select to authenticated
using (respondent_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('consultant','consultant_lead','admin')));
create policy "Read own answers" on public.questionnaire_answers for select to authenticated
using (exists (select 1 from public.questionnaire_responses r where r.id = response_id));

-- Immutable published documents, including their question IDs and explanations.
create function private.guard_questionnaire_content() returns trigger
language plpgsql set search_path = '' as $$
declare v_id uuid; old_version uuid;
begin
  if tg_table_name = 'questionnaire_versions' then
    if old.status = 'published' then raise exception 'Published questionnaire is immutable' using errcode = '55000'; end if;
  else
    if tg_table_name = 'questionnaire_question_details' then
      if tg_op <> 'INSERT' then select version_id into old_version from public.questionnaire_questions where id = old.question_id; end if;
      if tg_op <> 'DELETE' then select version_id into v_id from public.questionnaire_questions where id = new.question_id; end if;
    else
      if tg_op <> 'INSERT' then old_version := old.version_id; end if;
      if tg_op <> 'DELETE' then v_id := new.version_id; end if;
    end if;
    if exists (select 1 from public.questionnaire_versions where id in (v_id, old_version) and status = 'published') then
      raise exception 'Published questionnaire is immutable' using errcode = '55000';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.guard_questionnaire_content() from public, anon, authenticated;
create trigger guard_published_version before update or delete on public.questionnaire_versions for each row execute function private.guard_questionnaire_content();
create trigger guard_published_section before insert or update or delete on public.questionnaire_sections for each row execute function private.guard_questionnaire_content();
create trigger guard_published_question before insert or update or delete on public.questionnaire_questions for each row execute function private.guard_questionnaire_content();
create trigger guard_published_detail before insert or update or delete on public.questionnaire_question_details for each row execute function private.guard_questionnaire_content();

-- Definer is deliberately private. Direct table writes are revoked so callers cannot
-- bypass atomic saves, expected_revision checks, or published-document protection.
create function private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := (p_document->>'versionId')::uuid;
  q_id uuid := (p_document->>'questionnaireId')::uuid;
  v public.questionnaire_versions%rowtype;
  s jsonb; q jsonb; d jsonb;
  si integer := 0; qi integer; di integer;
  section_ids uuid[] := '{}'; question_ids uuid[] := '{}'; detail_ids uuid[] := '{}';
  payload_hash text := md5(p_document::text);
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Questionnaire author permission required' using errcode = '42501';
  end if;
  if v_id is null or q_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision < 0
    or jsonb_typeof(p_document->'title') is distinct from 'string'
    or jsonb_typeof(p_document->'sections') is distinct from 'array'
    or length(p_document::text) > 700000 or jsonb_array_length(p_document->'sections') > 50 then
    raise exception 'Invalid questionnaire document' using errcode = '22023';
  end if;
  -- Serialize even the first save; a retry after an uncertain network result is safe.
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v from public.questionnaire_versions where id = v_id for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'Questionnaire conflict' using errcode = '40001'; end if;
    insert into public.questionnaires(id, created_by) values (q_id, auth.uid());
    insert into public.questionnaire_versions(id, questionnaire_id) values(v_id, q_id) returning * into v;
  end if;
  if v.questionnaire_id <> q_id or v.status <> 'draft' or exists(select 1 from public.questionnaires where id=q_id and archived_at is not null) then
    raise exception 'Questionnaire is not editable' using errcode = '55000';
  end if;
  if v.last_save_id = p_save_id and v.last_save_hash = payload_hash then
    return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
  end if;
  if v.revision <> p_expected_revision or v.last_save_id = p_save_id then raise exception 'Questionnaire conflict' using errcode = '40001'; end if;

  for s in select value from jsonb_array_elements(p_document->'sections') loop
    if jsonb_typeof(s->'title') is distinct from 'string' or jsonb_typeof(s->'questions') is distinct from 'array' or jsonb_array_length(s->'questions') > 100 then
      raise exception 'Invalid section' using errcode = '22023';
    end if;
    section_ids := array_append(section_ids, (s->>'id')::uuid);
    if (s->>'id')::uuid is null or exists(select 1 from public.questionnaire_sections where id=(s->>'id')::uuid and version_id<>v_id) then raise exception 'Invalid section ID' using errcode='22023'; end if;
    insert into public.questionnaire_sections(id,version_id,title,position) values((s->>'id')::uuid,v_id,s->>'title',si)
      on conflict(id) do update set title=excluded.title,position=excluded.position;
    qi := 0;
    for q in select value from jsonb_array_elements(s->'questions') loop
      if jsonb_typeof(q->'text') is distinct from 'string' or jsonb_typeof(q->'details') is distinct from 'array' or jsonb_array_length(q->'details') > 30 then raise exception 'Invalid question' using errcode='22023'; end if;
      question_ids := array_append(question_ids,(q->>'id')::uuid);
      if (q->>'id')::uuid is null or (q->>'logicalKey')::uuid is null or exists(select 1 from public.questionnaire_questions where id=(q->>'id')::uuid and (version_id<>v_id or logical_key<>(q->>'logicalKey')::uuid)) then raise exception 'Invalid question ID' using errcode='22023'; end if;
      insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position)
        values((q->>'id')::uuid,v_id,(s->>'id')::uuid,(q->>'logicalKey')::uuid,q->>'text',qi)
        on conflict(id) do update set section_id=excluded.section_id,body=excluded.body,position=excluded.position;
      di := 0;
      for d in select value from jsonb_array_elements(q->'details') loop
        if jsonb_typeof(d->'title') is distinct from 'string' or jsonb_typeof(d->'text') is distinct from 'string' or jsonb_typeof(d->'visibleToConsultants') is distinct from 'boolean' then raise exception 'Invalid explanation' using errcode='22023'; end if;
        detail_ids := array_append(detail_ids,(d->>'id')::uuid);
        if (d->>'id')::uuid is null or exists(select 1 from public.questionnaire_question_details where id=(d->>'id')::uuid and question_id<>(q->>'id')::uuid) then raise exception 'Invalid explanation ID' using errcode='22023'; end if;
        insert into public.questionnaire_question_details(id,question_id,title,body,visible_to_consultants,position)
          values((d->>'id')::uuid,(q->>'id')::uuid,d->>'title',d->>'text',(d->>'visibleToConsultants')::boolean,di)
          on conflict(id) do update set title=excluded.title,body=excluded.body,visible_to_consultants=excluded.visible_to_consultants,position=excluded.position;
        di := di+1;
      end loop;
      qi := qi+1;
    end loop;
    si := si+1;
  end loop;
  if cardinality(section_ids) <> (select count(distinct x) from unnest(section_ids) x)
    or cardinality(question_ids) <> (select count(distinct x) from unnest(question_ids) x)
    or cardinality(detail_ids) <> (select count(distinct x) from unnest(detail_ids) x) then raise exception 'Duplicate IDs' using errcode='22023'; end if;
  delete from public.questionnaire_question_details where question_id in (select id from public.questionnaire_questions where version_id=v_id) and not(id=any(detail_ids));
  delete from public.questionnaire_questions where version_id=v_id and not(id=any(question_ids));
  delete from public.questionnaire_sections where version_id=v_id and not(id=any(section_ids));
  update public.questionnaire_versions set title=p_document->>'title', revision=revision+1, updated_at=clock_timestamp(),last_save_id=p_save_id,last_save_hash=payload_hash where id=v_id returning * into v;
  return jsonb_build_object('revision',v.revision,'savedAt',v.updated_at);
end $$;
revoke all on function private.save_questionnaire_draft(jsonb,integer,uuid) from public, anon, authenticated;
grant execute on function private.save_questionnaire_draft(jsonb,integer,uuid) to authenticated;
create function public.save_questionnaire_draft(p_document jsonb,p_expected_revision integer,p_save_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_questionnaire_draft(p_document,p_expected_revision,p_save_id);
$$;
revoke all on function public.save_questionnaire_draft(jsonb,integer,uuid) from public, anon, authenticated;
grant execute on function public.save_questionnaire_draft(jsonb,integer,uuid) to authenticated;

-- One SELECT snapshot avoids mixing two concurrent saves during loading.
create function public.read_questionnaire_draft(p_version_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status='draft'
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$$;
revoke all on function public.read_questionnaire_draft(uuid) from public, anon, authenticated;
grant execute on function public.read_questionnaire_draft(uuid) to authenticated;
