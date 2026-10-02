-- Responses reference canonical questions directly. Legacy response definitions are
-- retained inline only for old source-less distributed questionnaires.
begin;
set local lock_timeout='10s';
lock table public.questions, public.questionnaires, public.questionnaire_questions,
 public.response_sessions, public.question_responses, public.question_versions in access exclusive mode;

alter table public.question_responses add column question_id uuid,
 add column legacy_question_id uuid, add column legacy_definition jsonb;
-- Backfill under the table lock; restore identity protection before normal writes.
alter table public.question_responses disable trigger question_response_identity;
update public.question_responses r set question_id=v.question_id,
 legacy_question_id=v.legacy_question_id,
 legacy_definition=case when v.legacy_question_id is not null then v.definition end
from public.question_versions v where v.id=r.question_version_id;
alter table public.question_responses enable trigger question_response_identity;
-- Validate before dropping the old link; duplicates or missing sources abort atomically.
alter table public.question_responses add constraint question_responses_question_id_fkey
 foreign key(question_id) references public.questions(id) on delete restrict,
 add constraint question_responses_source_check check (
 (question_id is not null and legacy_question_id is null and legacy_definition is null) or
 (question_id is null and legacy_question_id is not null and legacy_definition is not null and jsonb_typeof(legacy_definition)='object')),
 add constraint question_responses_session_question_key unique(session_id,question_id),
 add constraint question_responses_session_legacy_question_key unique(session_id,legacy_question_id);
create index question_responses_question_idx on public.question_responses(question_id);

CREATE OR REPLACE FUNCTION private.guide_answer_field_ids(qid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(select 1 from public.questions where id=qid and (created_by=auth.uid() or private.is_admin())) then raise exception 'Question author required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(distinct a.key) from public.question_responses r join public.response_sessions s on s.id=r.session_id cross join lateral jsonb_array_elements(r.rows) row cross join lateral jsonb_each_text(row->'answers') a where r.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' and btrim(private.question_search_plain(a.value))<>''),'[]');
end $function$
;

CREATE OR REPLACE FUNCTION private.questionnaire_guide_question_ids(qid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(select 1 from public.questionnaires where id=qid and (created_by=auth.uid() or private.is_admin())) then raise exception 'Questionnaire author required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(distinct r.question_id) from public.question_responses r join public.response_sessions s on s.id=r.session_id where s.origin_questionnaire_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' and exists(select 1 from jsonb_array_elements(r.rows) row cross join lateral jsonb_each_text(row->'answers') a where btrim(private.question_search_plain(a.value))<>'')),'[]');
end $function$
;

CREATE OR REPLACE FUNCTION private.remove_unplaced_guide_answers(qid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; deleted_count integer;
begin
 select id into sid from public.response_sessions where origin_questionnaire_id=qid and respondent_id=private.guide_consultant_id() and started_stage='published' for update;
 if sid is null then return; end if;
 update public.question_responses set referenced_response_id=null where session_id=sid and referenced_response_id in (
 select r.id from public.question_responses r where r.session_id=sid and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=qid and p.source_question_id=r.question_id));
 delete from public.question_responses r where r.session_id=sid and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=qid and p.source_question_id=r.question_id);
 get diagnostics deleted_count=row_count;
 if deleted_count>0 then update public.response_sessions set revision=revision+1,last_payload=null,last_save_id=null,updated_at=now() where id=sid;end if;
end $function$
;

CREATE OR REPLACE FUNCTION private.remove_archived_published_answers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if new.archived_at is not null and old.archived_at is null then
 -- Invalidate retry payloads so deleted answer text is not retained in session metadata.
 update public.response_sessions s set last_payload=null,last_save_id=null where s.started_stage='published' and exists(select 1 from public.question_responses r where r.session_id=s.id and r.question_id=new.id);
 -- Clear only published links; distributed history remains protected.
 update public.question_responses r set referenced_response_id=null from public.response_sessions s where s.id=r.session_id and s.started_stage='published' and r.referenced_response_id in (select a.id from public.question_responses a where a.question_id=new.id);
 delete from public.question_responses r using public.response_sessions s where r.session_id=s.id and r.question_id=new.id and s.started_stage='published';
 end if; return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.read_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; qs jsonb; sections jsonb; sid uuid; begin
 sid:=private.sync_published_response_layout(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid;
 select coalesce(jsonb_agg(jsonb_build_object('responseId',r.id,'questionId',r.question_id,'definition',d.def,'rows',r.rows,'activeRowIds',r.active_row_ids) order by r.id),'[]') into qs
 from public.question_responses r cross join lateral (select private.live_response_definition(r.question_id) def) d where r.session_id=s.id and d.def is not null and exists(select 1 from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p where p->>'sourceQuestionId'=r.question_id::text);
 select coalesce(jsonb_agg(sec.value||jsonb_build_object('questions',coalesce((select jsonb_agg(p.value order by p.ord) from jsonb_array_elements(sec.value->'questions') with ordinality p(value,ord) where exists(select 1 from jsonb_array_elements(qs) q where q#>>'{definition,id}'=p.value->>'sourceQuestionId')),'[]')) order by sec.ord),'[]') into sections from jsonb_array_elements(s.layout) with ordinality sec(value,ord);
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'sections',sections,'questions',qs,'definitionToken',md5(s.origin_title||sections::text||(select coalesce(jsonb_agg(q->'definition' order by q#>>'{definition,id}'),'[]')::text from jsonb_array_elements(qs) q)),'sourceDeleted',s.origin_questionnaire_id is null);
end $function$
;

CREATE OR REPLACE FUNCTION private.read_guide_answers(p_question_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then raise exception 'Staff access required' using errcode='42501'; end if;
 if cardinality(p_question_ids)>500 then raise exception 'Too many questions' using errcode='22023'; end if;
 return coalesce((select jsonb_object_agg(q.id::text,jsonb_build_object('rows',shown.rows)) from public.questions q cross join lateral (
 select r.rows,r.active_row_ids from public.question_responses r join public.response_sessions s on s.id=r.session_id where r.question_id=q.id and s.respondent_id=private.guide_consultant_id() order by r.updated_at desc,r.id limit 1
 
 ) a cross join lateral (
 select coalesce(jsonb_agg(jsonb_build_object('id',row.value->'id','label',coalesce(nullif(btrim(q.row_labels->>(row.ord::int-1)),''),row.ord::text),'answers',row.value->'answers') order by row.ord),'[]') rows
 from jsonb_array_elements(a.rows) with ordinality row(value,ord)
 where a.active_row_ids @> jsonb_build_array(row.value->'id')
 and exists(select 1 from jsonb_array_elements(q.fields) f where private.question_field_response_valid(f,coalesce(row.value->'answers'->>(f->>'id'),''),true))
 ) shown where q.id=any(p_question_ids) and q.archived_at is null and jsonb_array_length(shown.rows)>0 and (q.created_by=auth.uid() or private.is_admin() or exists(select 1 from public.questionnaire_questions p join public.questionnaires v on v.id=p.questionnaire_id join public.questionnaires parent on parent.id=v.id where p.source_question_id=q.id and v.status='published' and parent.archived_at is null))),'{}');
end $function$
;

CREATE OR REPLACE FUNCTION private.save_distributed_response(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; s public.response_sessions%rowtype; payload jsonb; item record; q record; f jsonb; val text; readable text;
begin
 if p_save_id is null or p_revision is null or p_revision<0 or p_complete is null or length(p_free_response)>20000 or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid answers' using errcode='22023'; end if;
 sid:=private.open_distributed_response(p_questionnaire_id);
 select * into s from public.response_sessions where id=sid for update;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete,'freeResponse',coalesce(p_free_response,s.free_response));
 if s.last_save_id=p_save_id and (s.last_payload||jsonb_build_object('freeResponse',s.free_response))=payload then return private.read_distributed_response(p_questionnaire_id); end if;
 if s.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Answer conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.question_responses where session_id=sid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_answers) loop
 select r.id,r.origin_placement_id,r.legacy_definition definition into q from public.question_responses r where r.session_id=sid and r.origin_placement_id::text=item.key;
 if not found or jsonb_typeof(item.value) is distinct from 'string' then raise exception 'Invalid question' using errcode='22023'; end if;
 f:=q.definition#>'{fields,0}'; val:=item.value#>>'{}';
 if not private.question_field_response_valid(f,val,p_complete) then raise exception 'Invalid answer for question type' using errcode='22023'; end if;
 readable:=case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(f->'scaleConfig',val) else private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) end;
 update public.question_responses set rows=jsonb_build_array(jsonb_build_object('id',1,'answers',jsonb_build_object(item.key,val))),active_row_ids='[1]',body=readable,updated_at=now() where id=q.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,free_response=coalesce(p_free_response,s.free_response),status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=sid;
 return private.read_distributed_response(p_questionnaire_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.save_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb; current_token text;
begin
 perform private.sync_published_response_layout(p_questionnaire_id);
 perform 1 from public.questions q where exists(select 1 from public.question_responses a where a.session_id=private.owned_published_session(p_questionnaire_id) and a.question_id=q.id) order by q.id for share;
 select * into s from public.response_sessions where id=private.owned_published_session(p_questionnaire_id) for update;
 if not found then raise exception 'Start response first' using errcode='22023'; end if;
 if p_save_id is null or p_revision is null or p_complete is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid response' using errcode='22023'; end if;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if s.last_save_id=p_save_id and s.last_payload=payload then return private.read_question_response_session(p_questionnaire_id); end if;
 current_token:=private.read_question_response_session(s.id)->>'definitionToken';
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
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=s.id;
 return private.read_question_response_session(p_questionnaire_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.open_question_response_session(p_questionnaire_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; item jsonb; sources jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_questionnaire_id::text,0));
 select id into sid from public.response_sessions where (id=p_questionnaire_id or origin_questionnaire_id=p_questionnaire_id) and respondent_id=auth.uid() and started_stage='published';
 if sid is not null then return private.read_question_response_session(p_questionnaire_id); end if;
 perform private.assert_published_response_access(p_questionnaire_id);
 if not exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id) or exists(select 1 from public.questionnaire_questions where questionnaire_id=p_questionnaire_id and source_question_id is null) then
 raise exception 'Source questions required' using errcode='22023'; end if;
 -- Locks source rows against concurrent save_question while capturing all definitions.
 perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=q.id) order by q.id for share;
 perform private.validate_questionnaire_placements(p_questionnaire_id);
 sources:=private.read_published_question_sources(p_questionnaire_id);
 insert into public.response_sessions(respondent_id,origin_questionnaire_id,origin_title,started_role,started_stage,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'published',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.questionnaire_id=v.id),'[]'::jsonb)
 from public.questionnaires v where v.id=p_questionnaire_id returning id into sid;
 for item in select value from jsonb_array_elements(sources) loop
 insert into public.question_responses(session_id,question_id,origin_placement_id)
 select sid,(item->>'id')::uuid,p.id from public.questionnaire_questions p where p.questionnaire_id=p_questionnaire_id and p.source_question_id=(item->>'id')::uuid;
 end loop;
 update public.question_responses r set referenced_response_id=src.id from public.questions q,public.question_responses src
 where r.session_id=sid and r.question_id=q.id and src.session_id=sid and q.source_block_id=src.question_id;
 return private.read_question_response_session(p_questionnaire_id);
end $function$
;

CREATE OR REPLACE FUNCTION private.sync_published_response_layout(target uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; origin uuid; current_title text; current_layout jsonb;
        item record; answer_id uuid;
begin
 sid := private.owned_published_session(target);
 select origin_questionnaire_id into origin from public.response_sessions where id=sid;
 if origin is null then return sid; end if;
 perform pg_advisory_xact_lock(hashtextextended(origin::text,0));
 select v.title into current_title from public.questionnaires v
 join public.questionnaires q on q.id=v.id
 where v.id=origin and v.status='published' and q.archived_at is null;
 if not found then return sid; end if;
 -- Match the source-before-session lock order used by answer saving.
 perform 1 from public.questions q where
 exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=origin and p.source_question_id=q.id)
 or exists(select 1 from public.question_responses r where r.session_id=sid and r.question_id=q.id)
 order by q.id for share;
 perform 1 from public.response_sessions where id=sid for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',
   coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id)
     from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
     where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id),'[]'::jsonb)
 into current_layout from public.questionnaire_sections s where s.questionnaire_id=origin;
 for item in select p.id placement_id,q.id question_id,q.revision,private.live_response_definition(q.id) definition
 from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
 where p.questionnaire_id=origin order by p.id loop
   select r.id into answer_id from public.question_responses r
   where r.session_id=sid and r.question_id=item.question_id;
   if answer_id is null then
     insert into public.question_responses(session_id,question_id,origin_placement_id)
     values(sid,item.question_id,item.placement_id);
   else
     update public.question_responses set origin_placement_id=item.placement_id
     where id=answer_id and origin_placement_id is distinct from item.placement_id;
   end if;
 end loop;
 update public.question_responses r set referenced_response_id=src.id
 from public.questions q,public.question_responses src
 where r.session_id=sid and r.question_id=q.id
 and src.session_id=sid and q.source_block_id=src.question_id
 and r.referenced_response_id is distinct from src.id;
 update public.response_sessions set layout=current_layout,origin_title=current_title,
 last_payload=null,last_save_id=null
 where id=sid and (layout is distinct from current_layout or origin_title is distinct from current_title);
 return sid;
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
 select id into sid from public.response_sessions where origin_questionnaire_id=p_questionnaire_id and respondent_id=auth.uid();
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

CREATE OR REPLACE FUNCTION private.guard_question_response_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ declare published boolean; begin
 if tg_table_name='response_sessions' then
 if new.legacy_response is distinct from old.legacy_response or new.respondent_id<>old.respondent_id or (old.started_stage<>'published' and (new.layout<>old.layout or new.origin_title<>old.origin_title)) or new.started_stage<>old.started_stage then raise exception 'Session identity is immutable' using errcode='55000'; end if;
 if old.started_stage<>'published' and old.status='submitted' and (to_jsonb(new)-'origin_questionnaire_id') is distinct from (to_jsonb(old)-'origin_questionnaire_id') then raise exception 'Response locked' using errcode='55000'; end if;
 else
 select started_stage='published' into published from public.response_sessions where id=old.session_id;
 if tg_op='DELETE' then
 if published and exists(select 1 from public.response_sessions s where s.id=old.session_id and s.respondent_id=private.guide_consultant_id() and s.origin_questionnaire_id is not null and not exists(select 1 from public.questionnaire_questions p where p.questionnaire_id=s.origin_questionnaire_id and p.source_question_id=old.question_id)) then return old; end if;
 if published and exists(select 1 from public.questions q where q.id=old.question_id and q.archived_at is not null) then return old; end if;
 raise exception 'Response history is preserved' using errcode='55000';
 end if;
 if new.legacy_answer is distinct from old.legacy_answer or new.session_id<>old.session_id or new.question_id is distinct from old.question_id or new.legacy_question_id is distinct from old.legacy_question_id or new.legacy_definition is distinct from old.legacy_definition or (not published and exists(select 1 from public.response_sessions where id=old.session_id and status='submitted')) then raise exception 'Response locked' using errcode='55000'; end if;
 end if; return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.reconcile_guide_fields(qid uuid, old_fields jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb; r record; cleaned jsonb;
begin
 d:=private.live_response_definition(qid);
 for r in select a.* from public.question_responses a join public.response_sessions s on s.id=a.session_id where a.question_id=qid and s.respondent_id=private.guide_consultant_id() and s.started_stage='published' order by a.id for update of a loop
 cleaned:=private.prune_guide_fields(r.rows,old_fields,d->'fields');
 update public.question_responses set rows=cleaned,body=private.guide_rows_body(cleaned,d->'fields',r.active_row_ids),
 updated_at=now() where id=r.id;
 update public.response_sessions set revision=revision+1,last_save_id=null,last_payload=null,updated_at=now() where id=r.session_id;
 end loop;
end $function$
;
revoke all on function private.reconcile_guide_fields(uuid,jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.save_question(p_document jsonb, p_expected_revision integer, p_save_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_affected jsonb;
  v_detail jsonb;
  v_position bigint;
  v_existing public.questions%rowtype;
  v_saved public.questions%rowtype;
  v_hash text := md5(p_document::text);
begin
  if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) then
    raise exception 'Question block author permission required' using errcode = '42501';
  end if;
  if p_document is null or pg_catalog.jsonb_typeof(p_document) <> 'object'
    or (p_document->>'id') is null or (p_document->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_save_id is null or p_expected_revision is null or p_expected_revision < 0
    or char_length(p_document::text) > 300000 then
    raise exception 'Invalid question block request' using errcode = '22023';
  end if;
  if p_document ? 'details' then
    if jsonb_typeof(p_document->'details') is distinct from 'array' then
      raise exception 'Invalid question details' using errcode = '22023';
    end if;
    if jsonb_array_length(p_document->'details') > 20 then
      raise exception 'Too many question details' using errcode = '22023';
    end if;
    for v_detail in select value from jsonb_array_elements(p_document->'details') loop
      if jsonb_typeof(v_detail) is distinct from 'object'
        or jsonb_typeof(v_detail->'id') is distinct from 'string'
        or (v_detail->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(v_detail->'title') is distinct from 'string'
        or char_length(v_detail->>'title') > 200
        or jsonb_typeof(v_detail->'text') is distinct from 'string'
        or char_length(v_detail->>'text') > 10000
        or jsonb_typeof(v_detail->'visibleToConsultants') is distinct from 'boolean' then
        raise exception 'Invalid question detail' using errcode = '22023';
      end if;
    end loop;
    if (select count(*) <> count(distinct (value->>'id')::uuid)
      from jsonb_array_elements(p_document->'details')) then
      raise exception 'Duplicate question detail IDs' using errcode = '22023';
    end if;
  end if;
  v_id := (p_document->>'id')::uuid;
  select * into v_existing from public.questions where id = v_id for update;
  if found then
    if v_existing.created_by <> auth.uid() and not private.is_admin() then
      raise exception 'Only author or admin can edit' using errcode = '42501';
    end if;
    if v_existing.archived_at is not null then
      raise exception 'Question block is archived' using errcode = '55000';
    end if;
    if v_existing.last_save_id = p_save_id and v_existing.last_save_hash = v_hash then
      return pg_catalog.to_jsonb(v_existing) || jsonb_build_object('details', (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
      'text', d.body, 'visibleToConsultants', d.visible_to_consultants) order by d.position), '[]'::jsonb)
    from public.question_details d where d.question_id = v_id));
    end if;
    if v_existing.revision <> p_expected_revision or v_existing.last_save_id = p_save_id then
      raise exception 'Question block revision conflict' using errcode = '40001';
    end if;
    select coalesce(jsonb_agg(old_field->>'id'),'[]') into v_affected
    from jsonb_array_elements(v_existing.fields) old_field
    where private.guide_answer_field_ids(v_id) ? (old_field->>'id')
    and not exists(select 1 from jsonb_array_elements(p_document->'fields') new_field where new_field->>'id'=old_field->>'id' and new_field->>'kind'=old_field->>'kind');
    if not (coalesce(p_document->'confirmedGuideAnswerFields','[]'::jsonb) @> v_affected) then
      raise exception 'Guide answer deletion confirmation required' using errcode='PGA01',detail=v_affected::text;
    end if;
    update public.questions set
      title = pg_catalog.btrim(p_document->>'title'),
      prompt = pg_catalog.btrim(p_document->>'prompt'),
      fields = p_document->'fields',
      row_mode = p_document->>'rowMode',
      max_rows = (p_document->>'maxRows')::integer,
      min_rows = coalesce((p_document->>'minRows')::integer, 1),
      row_labels = coalesce(p_document->'rowLabels', '[]'::jsonb),
      source_block_id = (p_document->>'sourceBlockId')::uuid,
      source_field_id = (p_document->>'sourceFieldId')::uuid,
      after_block_id = (p_document->>'afterBlockId')::uuid,
      condition = case when p_document->'condition' = 'null'::jsonb
        then null else p_document->'condition' end,
      revision = revision + 1,
      last_save_id = p_save_id,
      last_save_hash = v_hash
    where id = v_id returning * into v_saved;
  else
    if p_expected_revision <> 0 then
      raise exception 'Question block revision conflict' using errcode = '40001';
    end if;
    insert into public.questions (
      id, created_by, title, prompt, fields, row_mode, max_rows, min_rows, row_labels,
      source_block_id, source_field_id, after_block_id, condition,
      revision, last_save_id, last_save_hash
    ) values (
      v_id, auth.uid(), pg_catalog.btrim(p_document->>'title'), pg_catalog.btrim(p_document->>'prompt'),
      p_document->'fields', p_document->>'rowMode', (p_document->>'maxRows')::integer,
      coalesce((p_document->>'minRows')::integer, 1), coalesce(p_document->'rowLabels', '[]'::jsonb),
      (p_document->>'sourceBlockId')::uuid, (p_document->>'sourceFieldId')::uuid,
      (p_document->>'afterBlockId')::uuid,
      case when p_document->'condition' = 'null'::jsonb
        then null else p_document->'condition' end, 1, p_save_id, v_hash
    ) returning * into v_saved;
  end if;
  if p_document ? 'details' then
    for v_detail, v_position in
      select value, ordinality - 1 from jsonb_array_elements(p_document->'details') with ordinality
    loop
      insert into public.question_details(id, question_id, position, title, body, visible_to_consultants)
      values ((v_detail->>'id')::uuid, v_id, v_position, v_detail->>'title', v_detail->>'text',
        (v_detail->>'visibleToConsultants')::boolean)
      on conflict (id) do update set position = excluded.position, title = excluded.title,
        body = excluded.body, visible_to_consultants = excluded.visible_to_consultants, updated_at = now()
      where public.question_details.question_id = excluded.question_id;
      if not found then
        raise exception 'Detail belongs to another question' using errcode = '22023';
      end if;
    end loop;
    delete from public.question_details where question_id = v_id
      and id not in (select (value->>'id')::uuid from jsonb_array_elements(p_document->'details'));
  end if;
  return pg_catalog.to_jsonb(v_saved) || jsonb_build_object('details', (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
      'text', d.body, 'visibleToConsultants', d.visible_to_consultants) order by d.position), '[]'::jsonb)
    from public.question_details d where d.question_id = v_id));
end $function$

;

-- OLD.fields is the previous definition; no snapshot table is required.
create function private.reconcile_guide_question_update() returns trigger
language plpgsql security definer set search_path='' as $$ begin
 perform private.reconcile_guide_fields(new.id,old.fields);
 return new;
end $$;
revoke all on function private.reconcile_guide_question_update() from public,anon,authenticated;
create trigger reconcile_guide_question_update after update on public.questions
for each row when (new.archived_at is null) execute function private.reconcile_guide_question_update();

drop function private.reconcile_guide_fields(uuid);
drop policy "Own response question versions" on public.question_versions;
alter table public.question_responses drop column question_version_id;
drop table public.question_versions;
drop function private.guard_question_version_immutable();
drop function private.response_structure(jsonb);
-- Ensure no runtime SQL function retains a dropped-table reference.
do $$ begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prokind='f'
 and (p.prosrc like '%question_versions%' or p.prosrc like '%question_version_id%'))
 then raise exception 'Question version runtime dependencies remain'; end if;
end $$;
commit;
