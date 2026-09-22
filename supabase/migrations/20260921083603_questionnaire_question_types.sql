-- Stable option IDs preserve selection identity; readable answer text is stored separately.
create function private.question_config_valid(p_kind text,p_options jsonb,p_ready boolean default false)
returns boolean language plpgsql immutable set search_path='' as $$
declare o jsonb; ids text[]:='{}'; labels text[]:='{}';
begin
 if p_kind is null or p_kind not in ('text','scale','single','multiple') or jsonb_typeof(p_options) is distinct from 'array' then return false;end if;
 if p_kind in ('text','scale') then return jsonb_array_length(p_options)=0;end if;
 if jsonb_array_length(p_options)>20 or (p_ready and jsonb_array_length(p_options)<2) then return false;end if;
 for o in select value from jsonb_array_elements(p_options) loop
  if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'id') is distinct from 'string'
   or (o->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(o->'label') is distinct from 'string' or length(o->>'label')>500 or (o->>'id')=any(ids)
   or (p_ready and (btrim(o->>'label')='' or btrim(o->>'label')=any(labels))) then return false;end if;
  ids:=array_append(ids,o->>'id');labels:=array_append(labels,btrim(o->>'label'));
 end loop;
 return true;
end $$;
revoke all on function private.question_config_valid(text,jsonb,boolean) from public,anon,authenticated;
alter table public.questionnaire_questions
 add column kind text not null default 'text',
 add column options jsonb not null default '[]',
 add constraint questionnaire_question_config_check check(private.question_config_valid(kind,options));
alter table public.questionnaire_answers add column selection jsonb;

create function private.guard_questionnaire_choices_ready() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status in ('published','distributed') and old.status is distinct from new.status
 and exists(select 1 from public.questionnaire_questions where version_id=new.id and not private.question_config_valid(kind,options,true)) then
  raise exception 'Choice questions need at least two distinct, named options' using errcode='22023';
 end if;
 return new;
end $$;
create trigger questionnaire_choices_ready before update of status on public.questionnaire_versions
 for each row execute function private.guard_questionnaire_choices_ready();

create function private.question_answer_valid(p_kind text,p_options jsonb,p_value text,p_complete boolean)
returns boolean language plpgsql immutable set search_path='' as $$
declare selection jsonb; item jsonb; seen text[]:='{}';
begin
 if p_value is null then return false;end if;
 if btrim(p_value)='' then return not p_complete;end if;
 if p_kind='text' then return true;end if;
 if p_kind='scale' then return p_value ~ '^[1-5]$';end if;
 if p_kind='single' then return exists(select 1 from jsonb_array_elements(p_options) o where o->>'id'=p_value);end if;
 if p_kind<>'multiple' then return false;end if;
 begin selection:=p_value::jsonb;exception when invalid_text_representation then return false;end;
 if jsonb_typeof(selection) is distinct from 'array' then return false;end if;
 if jsonb_array_length(selection)=0 then return false;end if;
 for item in select value from jsonb_array_elements(selection) loop
  if jsonb_typeof(item)<>'string' or (item#>>'{}')=any(seen) or not exists(select 1 from jsonb_array_elements(p_options) o where o->>'id'=item#>>'{}') then return false;end if;
  seen:=array_append(seen,item#>>'{}');
 end loop;
 return true;
end $$;
revoke all on function private.question_answer_valid(text,jsonb,text,boolean) from public,anon,authenticated;

create function private.question_answer_text(p_kind text,p_options jsonb,p_value text)
returns text language plpgsql immutable set search_path='' as $$
begin
 if p_value='' or p_kind='text' then return p_value;end if;
 if p_kind='scale' then return p_value||'점 · '||(array['전혀 그렇지 않다','그렇지 않다','보통이다','그렇다','매우 그렇다'])[p_value::integer];end if;
 if p_kind='single' then return (select o->>'label' from jsonb_array_elements(p_options) o where o->>'id'=p_value);end if;
 return (select string_agg(o->>'label',', ' order by position) from jsonb_array_elements(p_options) with ordinality as options(o,position) where p_value::jsonb ? (o->>'id'));
end $$;
revoke all on function private.question_answer_text(text,jsonb,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.save_questionnaire_draft(p_document jsonb, p_expected_revision integer, p_save_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not exists(select 1 from public.questionnaires where id=v.questionnaire_id and created_by=auth.uid()) then raise exception 'Only the creator can edit' using errcode='42501'; end if;
  if v.questionnaire_id <> q_id or v.status not in ('draft','published') or exists(select 1 from public.questionnaires where id=q_id and archived_at is not null) then
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
      insert into public.questionnaire_questions(id,version_id,section_id,logical_key,body,position,kind,options)
        values((q->>'id')::uuid,v_id,(s->>'id')::uuid,(q->>'logicalKey')::uuid,q->>'text',qi,coalesce(q->>'kind',(select kind from public.questionnaire_questions where id=(q->>'id')::uuid),'text'),coalesce(q->'options',(select options from public.questionnaire_questions where id=(q->>'id')::uuid),'[]'::jsonb))
        on conflict(id) do update set section_id=excluded.section_id,body=excluded.body,position=excluded.position,kind=excluded.kind,options=excluded.options;
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
end $function$;


CREATE OR REPLACE FUNCTION public.read_questionnaire_draft(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'kind',q.kind,'options',q.options,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('draft','published') and exists(select 1 from public.questionnaires p where p.id=v.questionnaire_id and p.created_by=(select auth.uid()) and p.archived_at is null)
    and ((select private.is_admin()) or (select private.is_consultant_lead()));
$function$;


CREATE OR REPLACE FUNCTION public.read_published_questionnaire(p_version_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('questionnaireId',v.questionnaire_id,'versionId',v.id,'title',v.title,'revision',v.revision,'savedAt',v.updated_at,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((
      select jsonb_agg(jsonb_build_object('id',q.id,'logicalKey',q.logical_key,'text',q.body,'kind',q.kind,'options',q.options,'details',coalesce((
        select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'text',d.body,'visibleToConsultants',d.visible_to_consultants) order by d.position)
        from public.questionnaire_question_details d where d.question_id=q.id),'[]'::jsonb)) order by q.position)
      from public.questionnaire_questions q where q.section_id=s.id),'[]'::jsonb)) order by s.position)
      from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb))
  from public.questionnaire_versions v where v.id=p_version_id and v.status in ('published','distributed') and exists(select 1 from public.questionnaires parent where parent.id=v.questionnaire_id and parent.archived_at is null)
;
$function$;


CREATE OR REPLACE FUNCTION private.save_questionnaire_response(p_version_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rid uuid; r public.questionnaire_responses%rowtype; payload jsonb; item record; question_record public.questionnaire_questions%rowtype; selected jsonb;
begin
 if p_save_id is null or p_revision is null or p_revision<0 or p_complete is null
 or length(p_free_response)>20000
 or p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>600000 then
 raise exception 'Invalid answers' using errcode='22023'; end if;
 rid:=private.open_questionnaire_response(p_version_id);
 select * into r from public.questionnaire_responses where id=rid for update;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete,'freeResponse',coalesce(p_free_response,r.free_response));
 if r.last_save_id=p_save_id and (r.last_payload || jsonb_build_object('freeResponse',r.free_response))=payload then
 return jsonb_build_object('revision',r.revision,'status',r.status,'savedAt',r.updated_at); end if;
 if r.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 if r.revision<>p_revision then raise exception 'Answer conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.questionnaire_questions where version_id=p_version_id) then
 raise exception 'Question set mismatch' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_answers) loop
 if jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>20000
 or not exists(select 1 from public.questionnaire_questions where id::text=item.key and version_id=p_version_id)
 or (p_complete and length(btrim(item.value#>>'{}'))=0) then
 raise exception 'Invalid or missing answer' using errcode='22023'; end if;
 select * into question_record from public.questionnaire_questions where id=item.key::uuid and version_id=p_version_id;
 if not private.question_answer_valid(question_record.kind,question_record.options,item.value#>>'{}',p_complete) then
 raise exception 'Invalid answer for question type' using errcode='22023';end if;
 selected:=case when question_record.kind='text' or item.value#>>'{}'='' then null
  when question_record.kind in ('scale','multiple') then (item.value#>>'{}')::jsonb else item.value end;
 insert into public.questionnaire_answers(response_id,version_id,question_id,body,selection)
 values(rid,p_version_id,item.key::uuid,private.question_answer_text(question_record.kind,question_record.options,item.value#>>'{}'),selected)
 on conflict(response_id,question_id) do update set body=excluded.body,selection=excluded.selection,updated_at=now();
 end loop;
 update public.questionnaire_responses set revision=revision+1,status=case when p_complete then 'submitted' else 'in_progress' end,
 submitted_at=case when p_complete then now() else null end,updated_at=now(),last_save_id=p_save_id,last_payload=payload,free_response=coalesce(p_free_response,r.free_response)
 where id=rid returning * into r;
 return jsonb_build_object('revision',r.revision,'status',r.status,'savedAt',r.updated_at);
end $function$;

