begin;
set local lock_timeout='10s';
-- Published guide work and distributed personal work are distinct sessions.
alter table public.response_sessions drop constraint response_sessions_respondent_id_origin_questionnaire_id_key;
alter table public.response_sessions add constraint response_sessions_respondent_origin_stage_key unique(respondent_id,origin_questionnaire_id,started_stage);

create table public.response_submissions (
 session_id uuid primary key references public.response_sessions(id) on delete restrict,
 answers jsonb not null check(jsonb_typeof(answers)='object'),
 submitted_at timestamptz not null default now(),
 revision integer not null check(revision>0)
);
alter table public.response_submissions enable row level security;
revoke all on public.response_submissions from public,anon,authenticated;
grant select on public.response_submissions to authenticated;
-- Draft sessions/responses retain their owner-only RLS. Only this published copy is shared.
create policy "Read own or staff submissions" on public.response_submissions for select to authenticated
using ((select private.is_admin()) or (select private.is_consultant_lead()) or exists(
 select 1 from public.response_sessions s where s.id=session_id and s.respondent_id=(select auth.uid())));

create function private.assert_distributed_question_access(qid uuid) returns void
language plpgsql stable security definer set search_path='' as $$ begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('consultant','consultant_lead','admin'))
 or not exists(select 1 from public.questionnaires where id=qid and status='distributed' and archived_at is null)
 then raise exception 'Distributed response access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaire_questions where questionnaire_id=qid)
 or exists(select 1 from public.questionnaire_questions where questionnaire_id=qid and source_question_id is null)
 then raise exception 'Canonical source questions required' using errcode='22023'; end if;
end $$;

create function private.owned_distributed_question_session(qid uuid) returns uuid
language plpgsql security definer set search_path='' as $$ declare sid uuid; begin
 -- Serializes opening/saving with distribution withdrawal.
 perform pg_advisory_xact_lock(hashtextextended(qid::text,0));
 perform private.assert_distributed_question_access(qid);
 select id into sid from public.response_sessions where origin_questionnaire_id=qid and respondent_id=auth.uid() and started_stage='distributed';
 if sid is null then raise exception 'Start response first' using errcode='42501'; end if;
 return sid;
end $$;

create function private.distributed_response_definition(qid uuid) returns jsonb
language sql stable set search_path='' as $$
 select d || jsonb_build_object('details',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'details') x where (x->>'visibleToConsultants')::boolean),'[]'))
 from (select private.live_response_definition(qid) d) q;
$$;


CREATE OR REPLACE FUNCTION private.read_distributed_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; qs jsonb; sections jsonb; sid uuid; begin
 sid:=private.owned_distributed_question_session(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid;
 select coalesce(jsonb_agg(jsonb_build_object('responseId',r.id,'questionId',r.question_id,'definition',d.def,'rows',r.rows,'activeRowIds',r.active_row_ids) order by r.id),'[]') into qs
 from public.question_responses r cross join lateral (select private.distributed_response_definition(r.question_id) def) d where r.session_id=s.id and d.def is not null and exists(select 1 from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p where p->>'sourceQuestionId'=r.question_id::text);
 select coalesce(jsonb_agg(sec.value||jsonb_build_object('questions',coalesce((select jsonb_agg(p.value order by p.ord) from jsonb_array_elements(sec.value->'questions') with ordinality p(value,ord) where exists(select 1 from jsonb_array_elements(qs) q where q#>>'{definition,id}'=p.value->>'sourceQuestionId')),'[]')) order by sec.ord),'[]') into sections from jsonb_array_elements(s.layout) with ordinality sec(value,ord);
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'sections',sections,'questions',qs,'definitionToken',md5(s.origin_title||sections::text||(select coalesce(jsonb_agg(q->'definition' order by q#>>'{definition,id}'),'[]')::text from jsonb_array_elements(qs) q)),'sourceDeleted',false,'stage','distributed','submittedAt',s.submitted_at,'hasUnsubmittedChanges',exists(select 1 from public.response_submissions sub where sub.session_id=s.id and sub.revision<s.revision));
end $function$
;

CREATE OR REPLACE FUNCTION private.open_distributed_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; item jsonb; sources jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 perform private.assert_distributed_question_access(p_questionnaire_id);
 select id into sid from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid() and started_stage='distributed';
 if sid is not null then return private.read_distributed_question_response_session(p_questionnaire_id); end if;
 perform private.assert_distributed_question_access(p_questionnaire_id);
 if not exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id) or exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id and source_question_id is null) then
 raise exception 'Source questions required' using errcode='22023'; end if;
 -- Locks source rows against concurrent save_question while capturing all definitions.
 perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=q.id) order by q.id for share;
 perform private.validate_questionnaire_placements(p_questionnaire_id);
 select jsonb_agg(jsonb_build_object('id',source_question_id)) into sources from public.questionnaire_questions where questionnaire_id=p_questionnaire_id;
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'distributed',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for item in select value from jsonb_array_elements(sources) loop
 insert into public.question_responses(session_id,question_id,origin_placement_id)
 select sid,(item->>'id')::uuid,p.id from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=(item->>'id')::uuid;
 end loop;
 update public.question_responses r set referenced_response_id=src.id from public.questions q,public.question_responses src
 where r.session_id=sid and r.question_id=q.id and src.session_id=sid and q.source_block_id=src.question_id;
 return private.read_distributed_question_response_session(p_questionnaire_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.save_distributed_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb; current_token text;
begin
 perform private.owned_distributed_question_session(p_questionnaire_id);
 perform 1 from public.questions q where exists(select 1 from public.question_responses a where a.session_id=private.owned_distributed_question_session(p_questionnaire_id) and a.question_id=q.id) order by q.id for share;
 select * into s from public.response_sessions where id=private.owned_distributed_question_session(p_questionnaire_id) for update;
 if not found then raise exception 'Start response first' using errcode='22023'; end if;
 if p_save_id is null or p_revision is null or p_complete is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid response' using errcode='22023'; end if;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if s.last_save_id=p_save_id and s.last_payload=payload then return private.read_distributed_question_response_session(p_questionnaire_id); end if;
 current_token:=private.read_distributed_question_response_session(p_questionnaire_id)->>'definitionToken';
 if p_definition_token is distinct from current_token then raise exception 'Question definition changed' using errcode='40001'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Response conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p->>'id')::uuid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 -- Session layout keeps only ordering/source IDs; definitions and answers belong to questions.
 for r in select a.*,private.live_response_definition(a.question_id) def from jsonb_array_elements(s.layout) with ordinality sec(section,si)
 cross join lateral jsonb_array_elements(sec.section->'questions') with ordinality p(placement,pi)
 join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p.placement->>'id')::uuid
 order by sec.si,p.pi loop
 rows_data:=p_answers->r.question_id::text;
 if jsonb_typeof(rows_data) is distinct from 'array' then raise exception 'Invalid rows' using errcode='22023'; end if;
 if jsonb_array_length(rows_data)>20 or (select count(distinct value->>'id') from jsonb_array_elements(rows_data))<>jsonb_array_length(rows_data) then raise exception 'Invalid rows' using errcode='22023'; end if;
 if r.def->>'row_mode'='single' and jsonb_array_length(rows_data)>1 or r.def->>'row_mode'='repeatable' and jsonb_array_length(rows_data)>(r.def->>'max_rows')::int then raise exception 'Too many rows' using errcode='22023'; end if;
 for row_data in select value from jsonb_array_elements(rows_data) loop
 if jsonb_typeof(row_data->'id') is distinct from 'number' or (row_data->>'id') !~ '^-?[0-9]{1,16}$' or jsonb_typeof(row_data->'answers') is distinct from 'object' then raise exception 'Invalid row' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(row_data->'answers') k where not exists(select 1 from jsonb_array_elements(r.def->'fields') field_item where field_item->>'id'=k)) then raise exception 'Unknown field' using errcode='22023'; end if;
 for f in select value from jsonb_array_elements(r.def->'fields') loop
 val:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if (row_data->'answers' ? (f->>'id') and jsonb_typeof(row_data->'answers'->(f->>'id')) is distinct from 'string') or not private.question_field_response_valid(f,val,false) then raise exception 'Invalid answer' using errcode='22023'; end if;
 end loop; end loop;
 matched:='{}'; all_mode:=coalesce(r.def#>>'{condition,mode}','all')<>'any'; waiting:=false;
 for source_id in select distinct value->>'blockId' from jsonb_array_elements(coalesce(nullif(r.def#>'{condition,clauses}','null'::jsonb),'[]')) loop
 select private.live_response_definition(a.question_id) into source_def from public.question_responses a where a.session_id=s.id and a.question_id::text=source_id;
 ids:='[]';
 for row_data in select value from jsonb_array_elements(coalesce(active->source_id,'[]')) loop
 source_ok:=all_mode;
 for clause in select value from jsonb_array_elements(r.def#>'{condition,clauses}') where value->>'blockId'=source_id loop
 if all_mode then source_ok:=source_ok and private.response_clause_matches(source_def,row_data,clause); else source_ok:=source_ok or private.response_clause_matches(source_def,row_data,clause); end if;
 end loop;
 if source_ok then ids:=ids||jsonb_build_array(row_data); end if;
 end loop;
 matched:=matched||jsonb_build_object(source_id,ids);
 end loop;
 if matched<>'{}' then
 if all_mode then waiting:=exists(select 1 from jsonb_each(matched) m where jsonb_array_length(m.value)=0);
 else waiting:=not exists(select 1 from jsonb_each(matched) m where jsonb_array_length(m.value)>0); end if;
 end if;
 if r.def->>'after_block_id' is not null then waiting:=waiting or jsonb_array_length(coalesce(active->(r.def->>'after_block_id'),'[]'))=0; end if;
 ref_ids:=null;
 if r.def->>'row_mode'='reference' then
 source_id:=r.def->>'source_block_id';
 ref_ids:=coalesce(matched->source_id,active->source_id,'[]');
 if r.def->>'source_field_id' is not null then
 select private.live_response_definition(a.question_id) into source_def from public.question_responses a where a.session_id=s.id and a.question_id::text=source_id;
 select value into f from jsonb_array_elements(source_def->'fields') where value->>'id'=r.def->>'source_field_id';
 select coalesce(jsonb_agg(value),'[]') into ref_ids from jsonb_array_elements(ref_ids) where private.question_field_response_valid(f,coalesce(value->'answers'->>(f->>'id'),''),true);
 end if;
 waiting:=waiting or jsonb_array_length(ref_ids)=0;
 end if;
 ids:='[]'; matched:='[]'; body_text:='';
 for row_data in select value from jsonb_array_elements(rows_data) loop
 if waiting or (ref_ids is not null and not exists(select 1 from jsonb_array_elements(ref_ids) x where x->'id'=row_data->'id')) then continue; end if;
 ids:=ids||jsonb_build_array(row_data->'id'); source_ok:=false;
 for f in select value from jsonb_array_elements(r.def->'fields') loop
 val:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if p_complete and not private.question_field_response_valid(f,val,true) then raise exception 'Answer all active fields' using errcode='22023'; end if;
 source_ok:=source_ok or private.question_field_response_valid(f,val,true);
 body_text:=body_text||case when body_text='' then '' else E'\n' end|| (row_data->>'id')||' · '||(f->>'label')||': '||case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(coalesce(f->'scaleConfig',jsonb_build_object('max',f->'scaleMax')),val) when f->>'kind' in ('single','multiple') then private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) else val end;
 end loop;
 if source_ok then matched:=matched||jsonb_build_array(row_data); end if;
 end loop;
 if p_complete and not waiting and jsonb_array_length(ids)<(case when ref_ids is not null then jsonb_array_length(ref_ids) when r.def->>'row_mode'='repeatable' then coalesce((r.def->>'min_rows')::int,1) else 1 end) then raise exception 'Missing rows' using errcode='22023'; end if;
 active:=active||jsonb_build_object(r.question_id::text,matched);
 update public.question_responses set rows=rows_data,active_row_ids=ids,body=body_text,updated_at=now() where id=r.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,status=case when p_complete or submitted_at is not null then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else submitted_at end,updated_at=now() where id=s.id;
 if p_complete then
 insert into public.response_submissions(session_id,answers,submitted_at,revision)
 select s.id,coalesce(jsonb_object_agg(answer.question_id::text,jsonb_build_object('responseId',answer.id,'rows',
 coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(answer.rows) with ordinality row(x,n) where answer.active_row_ids @> jsonb_build_array(x->'id')),'[]'),
 'activeRowIds',answer.active_row_ids,'body',answer.body)),'{}'),now(),s.revision+1
 from public.question_responses answer where answer.session_id=s.id
 on conflict(session_id) do update set answers=excluded.answers,submitted_at=excluded.submitted_at,revision=excluded.revision;
 end if;
 return private.read_distributed_question_response_session(p_questionnaire_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.guard_question_response_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ declare published boolean; begin
 if tg_table_name='response_sessions' then
 if new.legacy_response is distinct from old.legacy_response or new.respondent_id<>old.respondent_id or (old.started_stage<>'published' and (new.layout<>old.layout or new.origin_title<>old.origin_title)) or new.started_stage<>old.started_stage then raise exception 'Session identity is immutable' using errcode='55000'; end if;
 if old.started_stage<>'published' and old.status='submitted' and exists(select 1 from public.question_responses where session_id=old.id and legacy_question_id is not null) and (to_jsonb(new)-'origin_questionnaire_id') is distinct from (to_jsonb(old)-'origin_questionnaire_id') then raise exception 'Response locked' using errcode='55000'; end if;
 else
 select started_stage='published' into published from public.response_sessions where id=old.session_id;
 if tg_op='DELETE' then
 if published and exists(select 1 from public.response_sessions s where s.id=old.session_id and s.respondent_id=private.guide_consultant_id() and s.origin_questionnaire_id is not null and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=s.origin_questionnaire_id and p.source_question_id=old.question_id)) then return old; end if;
 if published and exists(select 1 from public.questions q where q.id=old.question_id and q.archived_at is not null) then return old; end if;
 raise exception 'Response history is preserved' using errcode='55000';
 end if;
 if new.legacy_answer is distinct from old.legacy_answer or new.session_id<>old.session_id or new.question_id is distinct from old.question_id or new.legacy_question_id is distinct from old.legacy_question_id or new.legacy_definition is distinct from old.legacy_definition or (not published and old.legacy_question_id is not null and exists(select 1 from public.response_sessions where id=old.session_id and status='submitted')) then raise exception 'Response locked' using errcode='55000'; end if;
 end if; return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.open_distributed_response(p_questionnaire_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; q public.questionnaire_questions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 perform private.assert_distributed_response_access(p_questionnaire_id);
 select id into sid from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid() and started_stage='distributed';
 if sid is not null then return sid; end if;
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,status,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'distributed','assigned',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for q in select * from public.questionnaire_questions where questionnaire_id=p_questionnaire_id order by id loop
 if q.source_question_id is not null then raise exception 'Source-based questionnaire is read-only' using errcode='55000'; end if;
 insert into public.question_responses(session_id,legacy_question_id,legacy_definition,origin_placement_id)
 values(sid,q.id,jsonb_build_object('id',q.id,'prompt',q.body,'fields',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',q.id,'label','답변','kind',q.kind,'options',q.options,'scaleConfig',q.scale_config,'choiceStyle',q.choice_style,'choiceAllowText',q.choice_allow_text))),'row_mode','single','legacy',true),q.id);
 end loop;
 return sid;
end $function$
;

create function private.list_submitted_questionnaire_responses(qid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if not exists(select 1 from public.questionnaires where id=qid and status='distributed' and archived_at is null) then raise exception 'Questionnaire not available' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'respondentName',p.name,'submittedAt',sub.submitted_at,'title',s.origin_title,'sections',s.layout,'questions',
 (select coalesce(jsonb_agg(jsonb_build_object('questionId',a.key,'responseId',a.value->'responseId','rows',a.value->'rows','activeRowIds',a.value->'activeRowIds','definition',private.distributed_response_definition(a.key::uuid))),'[]') from jsonb_each(sub.answers) a)) order by sub.submitted_at desc,s.id)
 from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id join public.profiles p on p.id=s.respondent_id
 where s.origin_questionnaire_id=qid and s.started_stage='distributed'),'[]');
end $$;

create or replace function public.distributed_response_statuses() returns table(questionnaire_id uuid,status text)
language sql stable set search_path='' as $$
 select s.origin_questionnaire_id,s.status from public.response_sessions s join public.questionnaires q on q.id=s.origin_questionnaire_id
 where s.respondent_id=(select auth.uid()) and s.started_stage='distributed' and q.status='distributed';
$$;
create or replace function public.unread_distributed_questionnaires() returns table(questionnaire_id uuid)
language sql stable set search_path='' as $$
 select q.id from public.questionnaires q where q.status='distributed' and q.archived_at is null
 and not exists(select 1 from public.response_sessions s where s.origin_questionnaire_id=q.id and s.started_stage='distributed' and s.respondent_id=(select auth.uid()));
$$;


revoke all on function private.assert_distributed_question_access(uuid) from public,anon,authenticated;

revoke all on function private.owned_distributed_question_session(uuid) from public,anon,authenticated;

revoke all on function private.distributed_response_definition(uuid) from public,anon,authenticated;

revoke all on function private.read_distributed_question_response_session(uuid) from public,anon,authenticated;

create function public.read_distributed_question_response_session(p_questionnaire_id uuid) returns jsonb language sql set search_path='' as $$ select private.read_distributed_question_response_session(p_questionnaire_id); $$;
revoke all on function public.read_distributed_question_response_session(uuid) from public,anon,authenticated;
grant execute on function public.read_distributed_question_response_session(uuid) to authenticated;
grant execute on function private.read_distributed_question_response_session(uuid) to authenticated;

revoke all on function private.open_distributed_question_response_session(uuid) from public,anon,authenticated;

create function public.open_distributed_question_response_session(p_questionnaire_id uuid) returns jsonb language sql set search_path='' as $$ select private.open_distributed_question_response_session(p_questionnaire_id); $$;
revoke all on function public.open_distributed_question_response_session(uuid) from public,anon,authenticated;
grant execute on function public.open_distributed_question_response_session(uuid) to authenticated;
grant execute on function private.open_distributed_question_response_session(uuid) to authenticated;

revoke all on function private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text) from public,anon,authenticated;

create function public.save_distributed_question_response_session(p_questionnaire_id uuid,p_answers jsonb,p_revision integer,p_save_id uuid,p_complete boolean default false,p_definition_token text default null) returns jsonb language sql set search_path='' as $$ select private.save_distributed_question_response_session(p_questionnaire_id,p_answers,p_revision,p_save_id,p_complete,p_definition_token); $$;
revoke all on function public.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text) to authenticated;
grant execute on function private.save_distributed_question_response_session(uuid,jsonb,integer,uuid,boolean,text) to authenticated;

revoke all on function private.list_submitted_questionnaire_responses(uuid) from public,anon,authenticated;

create function public.list_submitted_questionnaire_responses(qid uuid) returns jsonb language sql set search_path='' as $$ select private.list_submitted_questionnaire_responses(qid); $$;
revoke all on function public.list_submitted_questionnaire_responses(uuid) from public,anon,authenticated;
grant execute on function public.list_submitted_questionnaire_responses(uuid) to authenticated;
grant execute on function private.list_submitted_questionnaire_responses(uuid) to authenticated;

-- Never expose a guide account's private distributed draft as a published guide example.
CREATE OR REPLACE FUNCTION private.read_guide_answers(p_question_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if cardinality(p_question_ids)>500 then raise exception 'Too many questions' using errcode='22023'; end if;
 return coalesce((select jsonb_object_agg(q.id::text,jsonb_build_object('rows',shown.rows)) from public.questions q cross join lateral (
 select r.rows,r.active_row_ids from public.question_responses r join public.response_sessions s on s.id=r.session_id where r.question_id=q.id and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' order by r.updated_at desc,r.id limit 1
 
 ) a cross join lateral (
 select coalesce(jsonb_agg(jsonb_build_object('id',row.value->'id','label',coalesce(nullif(btrim(q.row_labels->>(row.ord::int-1)),''),row.ord::text),'answers',row.value->'answers') order by row.ord),'[]') rows
 from jsonb_array_elements(a.rows) with ordinality row(value,ord)
 where a.active_row_ids @> jsonb_build_array(row.value->'id')
 and exists(select 1 from jsonb_array_elements(q.fields) f where private.question_field_response_valid(f,coalesce(row.value->'answers'->>(f->>'id'),''),true))
 ) shown where q.id=any(p_question_ids) and q.archived_at is null and jsonb_array_length(shown.rows)>0 and (q.created_by=auth.uid() or private.is_admin() or exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires parent on parent.id=v.id where p.source_question_id=q.id and v.status='published' and parent.archived_at is null))),'{}');
end $function$
;


commit;
