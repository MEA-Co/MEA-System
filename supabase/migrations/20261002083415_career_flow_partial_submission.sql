-- Only the canonical career-flow question accepts one answered active cell.
CREATE OR REPLACE FUNCTION private.save_distributed_question_response_session(p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean DEFAULT false, p_definition_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb; current_token text; is_career_flow boolean;
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
 is_career_flow:=r.question_id='5f6064ad-1dd6-4e0d-95dd-611ccacbce92'::uuid;
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
 if p_complete and not is_career_flow and not private.question_field_response_valid(f,val,true) then raise exception 'Answer all active fields' using errcode='22023'; end if;
 source_ok:=source_ok or private.question_field_response_valid(f,val,true);
 body_text:=body_text||case when body_text='' then '' else E'\n' end|| (row_data->>'id')||' · '||(f->>'label')||': '||case when f->>'kind'='text' then private.question_search_plain(val) when f->>'kind'='scale' then private.scale_answer_text(coalesce(f->'scaleConfig',jsonb_build_object('max',f->'scaleMax')),val) when f->>'kind' in ('single','multiple') then private.choice_answer_text(f->>'kind',f->'options',coalesce((f->>'choiceAllowText')::boolean,false),val) else val end;
 end loop;
 if source_ok then matched:=matched||jsonb_build_array(row_data); end if;
 end loop;
 if p_complete and not waiting and is_career_flow and jsonb_array_length(matched)=0 then raise exception 'Answer at least one career flow cell' using errcode='22023'; end if;
 if p_complete and not waiting and not is_career_flow and jsonb_array_length(ids)<(case when ref_ids is not null then jsonb_array_length(ref_ids) when r.def->>'row_mode'='repeatable' then coalesce((r.def->>'min_rows')::int,1) else 1 end) then raise exception 'Missing rows' using errcode='22023'; end if;
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

