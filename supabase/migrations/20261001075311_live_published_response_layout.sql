-- Follow current published layout while preserving removed-question answers.
begin;
SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.guard_question_response_identity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$ declare published boolean; begin
 if tg_table_name='response_sessions' then
 if new.legacy_response is distinct from old.legacy_response or new.respondent_id<>old.respondent_id or (old.started_stage<>'published' and (new.layout<>old.layout or new.origin_title<>old.origin_title)) or new.started_stage<>old.started_stage then raise exception 'Session identity is immutable' using errcode='55000'; end if;
 if old.started_stage<>'published' and old.status='submitted' and (to_jsonb(new)-'origin_version_id') is distinct from (to_jsonb(old)-'origin_version_id') then raise exception 'Response locked' using errcode='55000'; end if;
 else
 select started_stage='published' into published from public.response_sessions where id=old.session_id;
 if tg_op='DELETE' then
 if published and exists(select 1 from public.question_versions v join public.questions q on q.id=v.question_id where v.id=old.question_version_id and q.archived_at is not null) then return old; end if;
 raise exception 'Response history is preserved' using errcode='55000';
 end if;
 if new.legacy_answer is distinct from old.legacy_answer or new.session_id<>old.session_id or (new.question_version_id<>old.question_version_id and (not published or (select question_id from public.question_versions where id=new.question_version_id) is distinct from (select question_id from public.question_versions where id=old.question_version_id))) or (not published and exists(select 1 from public.response_sessions where id=old.session_id and status='submitted')) then raise exception 'Response locked' using errcode='55000'; end if;
 end if; return new;
end $function$;

CREATE OR REPLACE FUNCTION private.read_question_response_session (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.response_sessions%rowtype; qs jsonb; sections jsonb; sid uuid; begin
 sid:=private.sync_published_response_layout(p_version_id);
 select * into s from public.response_sessions where id=sid;
 select coalesce(jsonb_agg(jsonb_build_object('responseId',r.id,'versionId',v.id,'definition',d.def,'rows',r.rows,'activeRowIds',r.active_row_ids,'needsReview',private.response_structure(v.definition) is distinct from private.response_structure(d.def),'previousBody',r.body,'previousDefinition',v.definition,'previousResponses',r.previous_responses) order by r.id),'[]') into qs
 from public.question_responses r join public.question_versions v on v.id=r.question_version_id cross join lateral (select private.live_response_definition(v.question_id) def) d where r.session_id=s.id and d.def is not null and exists(select 1 from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p where p->>'sourceQuestionId'=v.question_id::text);
 select coalesce(jsonb_agg(sec.value||jsonb_build_object('questions',coalesce((select jsonb_agg(p.value order by p.ord) from jsonb_array_elements(sec.value->'questions') with ordinality p(value,ord) where exists(select 1 from jsonb_array_elements(qs) q where q#>>'{definition,id}'=p.value->>'sourceQuestionId')),'[]')) order by sec.ord),'[]') into sections from jsonb_array_elements(s.layout) with ordinality sec(value,ord);
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'sections',sections,'questions',qs,'definitionToken',md5(s.origin_title||sections::text||(select coalesce(jsonb_agg(q->'definition' order by q#>>'{definition,id}'),'[]')::text from jsonb_array_elements(qs) q)),'sourceDeleted',s.origin_version_id is null);
end $function$;

CREATE OR REPLACE FUNCTION private.save_question_response_session (
  p_version_id       uuid,
  p_answers          jsonb,
  p_revision         integer,
  p_save_id          uuid,
  p_complete         boolean DEFAULT false,
  p_definition_token text    DEFAULT NULL::text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb; current_token text; saved_version uuid;
begin
 perform private.sync_published_response_layout(p_version_id);
 perform 1 from public.questions q where exists(select 1 from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=private.owned_published_session(p_version_id) and v.question_id=q.id) order by q.id for share;
 select * into s from public.response_sessions where id=private.owned_published_session(p_version_id) for update;
 if not found then raise exception 'Start response first' using errcode='22023'; end if;
 if p_save_id is null or p_revision is null or p_complete is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid response' using errcode='22023'; end if;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if s.last_save_id=p_save_id and s.last_payload=payload then return private.read_question_response_session(p_version_id); end if;
 current_token:=private.read_question_response_session(s.id)->>'definitionToken';
 if p_definition_token is distinct from current_token then raise exception 'Question definition changed' using errcode='40001'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Response conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from jsonb_array_elements(s.layout) sec cross join lateral jsonb_array_elements(sec->'questions') p join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p->>'id')::uuid) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 -- Session layout keeps only ordering/source IDs; definitions and answers belong to questions.
 for r in select a.*,private.live_response_definition(v.question_id) def,v.definition saved_def,v.question_id from jsonb_array_elements(s.layout) with ordinality sec(section,si)
 cross join lateral jsonb_array_elements(sec.section->'questions') with ordinality p(placement,pi)
 join public.question_responses a on a.session_id=s.id and a.origin_placement_id=(p.placement->>'id')::uuid
 join public.question_versions v on v.id=a.question_version_id order by sec.si,p.pi loop
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
 select private.live_response_definition(v.question_id) into source_def from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=s.id and v.question_id::text=source_id;
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
 select private.live_response_definition(v.question_id) into source_def from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=s.id and v.question_id::text=source_id;
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
 insert into public.question_versions(question_id,source_revision,definition) values(r.question_id,(r.def->>'revision')::int,r.def) on conflict(question_id,source_revision) do nothing;
 select id into saved_version from public.question_versions where question_id=r.question_id and source_revision=(r.def->>'revision')::int;
 update public.question_responses set previous_responses=case when private.response_structure(r.saved_def) is distinct from private.response_structure(r.def) and jsonb_array_length(r.rows)>0 then previous_responses||jsonb_build_array(jsonb_build_object('definition',r.saved_def,'rows',r.rows,'body',r.body,'savedAt',r.updated_at)) else previous_responses end,question_version_id=saved_version,rows=rows_data,active_row_ids=ids,body=body_text,updated_at=now() where id=r.id;
 end loop;
 update public.response_sessions set revision=revision+1,last_save_id=p_save_id,last_payload=payload,status=case when p_complete then 'submitted' else 'in_progress' end,submitted_at=case when p_complete then now() else null end,updated_at=now() where id=s.id;
 return private.read_question_response_session(p_version_id);
end $function$;

CREATE OR REPLACE FUNCTION private.sync_published_response_layout (
  target uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare sid uuid; origin uuid; current_title text; current_layout jsonb;
        item record; ver uuid; answer_id uuid;
begin
 sid := private.owned_published_session(target);
 select origin_version_id into origin from public.response_sessions where id=sid;
 if origin is null then return sid; end if;
 perform pg_advisory_xact_lock(hashtextextended(origin::text,0));
 select v.title into current_title from public.questionnaire_versions v
 join public.questionnaires q on q.id=v.questionnaire_id
 where v.id=origin and v.status='published' and q.archived_at is null;
 if not found then return sid; end if;
 -- Match the source-before-session lock order used by answer saving.
 perform 1 from public.questions q where
 exists(select 1 from public.questionnaire_questions p where p.version_id=origin and p.source_question_id=q.id)
 or exists(select 1 from public.question_responses r join public.question_versions v on v.id=r.question_version_id where r.session_id=sid and v.question_id=q.id)
 order by q.id for share;
 perform 1 from public.response_sessions where id=sid for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',
   coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id)
     from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
     where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id),'[]'::jsonb)
 into current_layout from public.questionnaire_sections s where s.version_id=origin;
 for item in select p.id placement_id,q.id question_id,q.revision,private.live_response_definition(q.id) definition
 from public.questionnaire_questions p join public.questions q on q.id=p.source_question_id and q.archived_at is null
 where p.version_id=origin order by p.id loop
   select r.id into answer_id from public.question_responses r join public.question_versions v on v.id=r.question_version_id
   where r.session_id=sid and v.question_id=item.question_id;
   if answer_id is null then
     insert into public.question_versions(question_id,source_revision,definition)
     values(item.question_id,item.revision,item.definition) on conflict(question_id,source_revision) do nothing;
     select id into ver from public.question_versions where question_id=item.question_id and source_revision=item.revision;
     insert into public.question_responses(session_id,question_version_id,origin_placement_id)
     values(sid,ver,item.placement_id);
   else
     update public.question_responses set origin_placement_id=item.placement_id
     where id=answer_id and origin_placement_id is distinct from item.placement_id;
   end if;
 end loop;
 update public.question_responses r set referenced_response_id=src.id
 from public.question_versions v,public.questions q,public.question_responses src,public.question_versions sv
 where r.session_id=sid and r.question_version_id=v.id and v.question_id=q.id
 and src.session_id=sid and src.question_version_id=sv.id and q.source_block_id=sv.question_id
 and r.referenced_response_id is distinct from src.id;
 update public.response_sessions set layout=current_layout,origin_title=current_title,
 last_payload=null,last_save_id=null
 where id=sid and (layout is distinct from current_layout or origin_title is distinct from current_title);
 return sid;
end $function$;

CREATE OR REPLACE FUNCTION public.read_question_response_session (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
select private.read_question_response_session(p_version_id); $function$;

REVOKE ALL ON FUNCTION "private"."sync_published_response_layout"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."sync_published_response_layout"(uuid) TO "postgres";


notify pgrst,'reload schema';
commit;
