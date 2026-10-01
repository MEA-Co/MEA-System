SET local check_function_bodies = off;

CREATE TABLE "public"."question_responses" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "session_id"             uuid                     NOT NULL,
  "question_version_id"    uuid                     NOT NULL,
  "origin_placement_id"    uuid,
  "rows"                   jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "active_row_ids"         jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "referenced_response_id" uuid,
  "body"                   text                     NOT NULL DEFAULT ''::text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_responses_pkey" PRIMARY KEY (id),
  CONSTRAINT "question_responses_rows_check" CHECK ((jsonb_typeof(rows) = 'array'::text)),
  CONSTRAINT "question_responses_session_id_question_version_id_key" UNIQUE (session_id, question_version_id)
);

ALTER TABLE "public"."question_responses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."question_versions" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "question_id"     uuid                     NOT NULL,
  "source_revision" integer                  NOT NULL,
  "definition"      jsonb                    NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_versions_definition_check" CHECK ((jsonb_typeof(definition) = 'object'::text)),
  CONSTRAINT "question_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "question_versions_question_id_source_revision_key" UNIQUE (question_id, source_revision)
);

ALTER TABLE "public"."question_versions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."response_sessions" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "respondent_id"     uuid                     NOT NULL,
  "origin_version_id" uuid,
  "origin_title"      text                     NOT NULL DEFAULT ''::text,
  "layout"            jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "started_role"      text                     NOT NULL,
  "started_stage"     text                     NOT NULL,
  "status"            text                     NOT NULL DEFAULT 'in_progress'::text,
  "revision"          integer                  NOT NULL DEFAULT 0,
  "last_save_id"      uuid,
  "last_payload"      jsonb,
  "free_response"     text                     NOT NULL DEFAULT ''::text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "submitted_at"      timestamp with time zone,
  CONSTRAINT "response_sessions_check" CHECK (((status = 'submitted'::text) = (submitted_at IS NOT NULL))),
  CONSTRAINT "response_sessions_layout_check" CHECK ((jsonb_typeof(layout) = 'array'::text)),
  CONSTRAINT "response_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "response_sessions_respondent_id_origin_version_id_key" UNIQUE (respondent_id, origin_version_id),
  CONSTRAINT "response_sessions_revision_check" CHECK ((revision >= 0)),
  CONSTRAINT "response_sessions_status_check" CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text])))
);

ALTER TABLE "public"."response_sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.assert_published_response_access (
  p_version_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
 if auth.uid() is null or not (private.is_admin() or private.is_consultant_lead()) or not exists(
 select 1 from public.questionnaire_versions v join public.questionnaires q on q.id=v.questionnaire_id
 where v.id=p_version_id and v.status='published' and q.archived_at is null
 ) then raise exception 'Published response access denied' using errcode='42501'; end if;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_question_response_identity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
 if tg_table_name='response_sessions' then
 if new.respondent_id<>old.respondent_id or new.layout<>old.layout or new.origin_title<>old.origin_title then raise exception 'Session identity is immutable' using errcode='55000'; end if;
 -- FK source removal is permitted even after submission; answer content is not.
 if old.status='submitted' and (to_jsonb(new)-'origin_version_id') is distinct from (to_jsonb(old)-'origin_version_id') then raise exception 'Response locked' using errcode='55000'; end if;
 elsif tg_op='DELETE' then raise exception 'Response history is preserved' using errcode='55000';
 else
 if new.session_id<>old.session_id or new.question_version_id<>old.question_version_id or exists(select 1 from public.response_sessions where id=old.session_id and status='submitted') then raise exception 'Response locked' using errcode='55000'; end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_question_version_immutable()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin raise exception 'Question versions are immutable' using errcode='55000'; end $function$;

CREATE OR REPLACE FUNCTION private.open_question_response_session (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare sid uuid; item jsonb; ver uuid; sources jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 perform private.assert_published_response_access(p_version_id);
 select id into sid from public.response_sessions where origin_version_id=p_version_id and respondent_id=auth.uid();
 if sid is not null then return private.read_question_response_session(p_version_id); end if;
 if not exists(select 1 from public.questionnaire_questions where version_id=p_version_id) or exists(select 1 from public.questionnaire_questions where version_id=p_version_id and source_question_id is null) then
 raise exception 'Source questions required' using errcode='22023'; end if;
 -- Locks source rows against concurrent save_question while capturing all definitions.
 perform 1 from public.questions q where exists(select 1 from public.questionnaire_questions p where p.version_id=p_version_id and p.source_question_id=q.id) order by q.id for share;
 perform private.validate_questionnaire_placements(p_version_id);
 sources:=private.read_published_question_sources(p_version_id);
 insert into public.response_sessions(respondent_id,origin_version_id,origin_title,started_role,started_stage,layout)
 select auth.uid(),v.id,v.title,(select role from public.profiles where id=auth.uid()),'published',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'sourceQuestionId',p.source_question_id) order by p.position,p.id) from public.questionnaire_questions p where p.section_id=s.id),'[]'::jsonb)) order by s.position,s.id) from public.questionnaire_sections s where s.version_id=v.id),'[]'::jsonb)
 from public.questionnaire_versions v where v.id=p_version_id returning id into sid;
 for item in select value from jsonb_array_elements(sources) loop
 insert into public.question_versions(question_id,source_revision,definition) values((item->>'id')::uuid,(item->>'revision')::integer,item)
 on conflict(question_id,source_revision) do nothing;
 select id into ver from public.question_versions where question_id=(item->>'id')::uuid and source_revision=(item->>'revision')::integer;
 insert into public.question_responses(session_id,question_version_id,origin_placement_id)
 select sid,ver,p.id from public.questionnaire_questions p where p.version_id=p_version_id and p.source_question_id=(item->>'id')::uuid;
 end loop;
 update public.question_responses r set referenced_response_id=src.id from public.question_versions q,public.question_responses src,public.question_versions sq
 where r.session_id=sid and r.question_version_id=q.id and src.session_id=sid and src.question_version_id=sq.id and q.definition->>'source_block_id'=sq.question_id::text;
 return private.read_question_response_session(p_version_id);
end $function$;

CREATE OR REPLACE FUNCTION private.question_field_response_valid (
  f        jsonb,
  v        text,
  complete boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare parsed jsonb; choices jsonb; choice jsonb; opt jsonb; k text:=f->>'kind'; seen text[]:='{}'; key text;
begin
 if v is null or length(v)>20000 then return false; end if;
 if btrim(v)='' then return not complete; end if;
 if k='text' then return not complete or length(btrim(private.question_search_plain(v)))>0; end if;
 if k='exploration' then return v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; end if;
 if k='scale' then return private.scale_answer_valid(coalesce(f->'scaleConfig',jsonb_build_object('max',coalesce((f->>'scaleMax')::int,5),'low','','middle','','high','','allowText',false)),v,complete); end if;
 if k not in ('single','multiple') then return false; end if;
 begin parsed:=v::jsonb; exception when invalid_text_representation then parsed:=to_jsonb(v); end;
 if jsonb_typeof(parsed)='object' and parsed ? 'choices' then
 if not coalesce((f->>'choiceAllowText')::boolean,false) or jsonb_typeof(parsed->'text') is distinct from 'string' or length(parsed->>'text')>5000 or (select count(*) from jsonb_object_keys(parsed))<>2 then return false; end if;
 choices:=parsed->'choices';
 else choices:=case when k='multiple' then parsed else jsonb_build_array(parsed) end; end if;
 if jsonb_typeof(choices) is distinct from 'array' then return false; end if;
 if jsonb_array_length(choices)<1 or jsonb_array_length(choices)>100 or (k='single' and jsonb_array_length(choices)<>1) then return false; end if;
 for choice in select value from jsonb_array_elements(choices) loop
 select value into opt from jsonb_array_elements(f->'options') where value->>'id'=case when jsonb_typeof(choice)='string' then choice#>>'{}' else choice->>'id' end;
 if opt is null then return false; end if;
 if coalesce((opt->>'isOther')::boolean,false) then
 if jsonb_typeof(choice) is distinct from 'object' or jsonb_typeof(choice->'text') is distinct from 'string' or length(choice->>'text')>5000 or (complete and btrim(choice->>'text')='') or (choice ? 'entryId' and (k='single' or jsonb_typeof(choice->'entryId') is distinct from 'string' or length(choice->>'entryId') not between 1 and 100)) then return false; end if;
 key:='entry:'||coalesce(choice->>'entryId',choice->>'id');
 else
 if jsonb_typeof(choice) is distinct from 'string' then return false; end if;
 key:='option:'||(choice#>>'{}'); end if;
 if key=any(seen) then return false; end if; seen:=array_append(seen,key);
 end loop;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $function$;

CREATE OR REPLACE FUNCTION private.read_question_response_session (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.response_sessions%rowtype;
begin
 perform private.assert_published_response_access(p_version_id);
 select * into s from public.response_sessions where origin_version_id=p_version_id and respondent_id=auth.uid();
 if not found then return null; end if;
 return jsonb_build_object('id',s.id,'revision',s.revision,'status',s.status,'savedAt',case when s.revision>0 then s.updated_at else null end,'title',s.origin_title,'sections',s.layout,
 'questions',coalesce((select jsonb_agg(jsonb_build_object('responseId',r.id,'versionId',q.id,'definition',q.definition,'rows',r.rows,'activeRowIds',r.active_row_ids) order by r.id) from public.question_responses r join public.question_versions q on q.id=r.question_version_id where r.session_id=s.id),'[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION private.response_clause_matches (
  def      jsonb,
  row_data jsonb,
  clause   jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare f jsonb; v text; parsed jsonb; choices jsonb; score numeric;
begin
 if clause->>'op'='answered' then
 for f in select value from jsonb_array_elements(def->'fields') where not(clause ? 'fieldId') or value->>'id'=clause->>'fieldId' loop
 if not private.question_field_response_valid(f,coalesce(row_data->'answers'->>(f->>'id'),''),true) then return false; end if;
 end loop;
 return found;
 end if;
 select value into f from jsonb_array_elements(def->'fields') where value->>'id'=clause->>'fieldId';
 v:=coalesce(row_data->'answers'->>(f->>'id'),'');
 if f is null or not private.question_field_response_valid(f,v,true) then return false; end if;
 if f->>'kind'='text' then return clause->>'op'='equals' and btrim(private.question_search_plain(v))=clause->>'value'; end if;
 if f->>'kind'='scale' then
 parsed:=v::jsonb; score:=case when jsonb_typeof(parsed)='number' then (parsed#>>'{}')::numeric else (parsed->>'score')::numeric end;
 return case clause->>'op' when 'gte' then score>=(clause->>'value')::numeric when 'lte' then score<=(clause->>'value')::numeric when 'equals' then score=(clause->>'value')::numeric else false end;
 end if;
 begin parsed:=v::jsonb; exception when invalid_text_representation then parsed:=to_jsonb(v); end;
 choices:=case when parsed ? 'choices' then parsed->'choices' when f->>'kind'='multiple' then parsed else jsonb_build_array(parsed) end;
 return exists(select 1 from jsonb_array_elements(choices) c where case when jsonb_typeof(c)='string' then c#>>'{}' else c->>'id' end=clause->>'value');
end $function$;

CREATE OR REPLACE FUNCTION private.save_question_response_session (
  p_version_id uuid,
  p_answers    jsonb,
  p_revision   integer,
  p_save_id    uuid,
  p_complete   boolean DEFAULT false
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare s public.response_sessions%rowtype; r record; f jsonb; row_data jsonb; rows_data jsonb; payload jsonb; active jsonb:='{}'; matched jsonb; source_def jsonb; clause jsonb; source_id text; waiting boolean; source_ok boolean; all_mode boolean; ids jsonb; val text; body_text text; rid text; ref_ids jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_version_id::text,0));
 perform private.assert_published_response_access(p_version_id);
 select * into s from public.response_sessions where origin_version_id=p_version_id and respondent_id=auth.uid() for update;
 if not found then raise exception 'Start response first' using errcode='22023'; end if;
 if p_save_id is null or p_revision is null or p_complete is null or jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text)>600000 then raise exception 'Invalid response' using errcode='22023'; end if;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete);
 if s.last_save_id=p_save_id and s.last_payload=payload then return private.read_question_response_session(p_version_id); end if;
 if s.status='submitted' then raise exception 'Response locked' using errcode='55000'; end if;
 if s.revision<>p_revision or s.last_save_id=p_save_id then raise exception 'Response conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.question_responses where session_id=s.id) then raise exception 'Question set mismatch' using errcode='22023'; end if;
 -- Session layout keeps only ordering/source IDs; definitions and answers belong to questions.
 for r in select a.*,v.definition def,v.question_id from jsonb_array_elements(s.layout) with ordinality sec(section,si)
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
 select v.definition into source_def from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=s.id and v.question_id::text=source_id;
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
 select v.definition into source_def from public.question_responses a join public.question_versions v on v.id=a.question_version_id where a.session_id=s.id and v.question_id::text=source_id;
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
 return private.read_question_response_session(p_version_id);
end $function$;

CREATE OR REPLACE FUNCTION public.open_question_response_session (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select private.open_question_response_session(p_version_id)$function$;

CREATE OR REPLACE FUNCTION public.read_question_response_session (
  p_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$select private.read_question_response_session(p_version_id)$function$;

CREATE OR REPLACE FUNCTION public.save_question_response_session (
  p_version_id uuid,
  p_answers    jsonb,
  p_revision   integer,
  p_save_id    uuid,
  p_complete   boolean DEFAULT false
)
  RETURNS jsonb
  LANGUAGE sql
  SET search_path TO ''
  AS $function$select private.save_question_response_session(p_version_id,p_answers,p_revision,p_save_id,p_complete)$function$;

ALTER TABLE "public"."question_responses"
  ADD CONSTRAINT "question_responses_referenced_response_id_fkey" FOREIGN KEY (referenced_response_id) REFERENCES public.question_responses(id) ON DELETE RESTRICT;

ALTER TABLE "public"."question_responses"
  ADD CONSTRAINT "question_responses_question_version_id_fkey" FOREIGN KEY (question_version_id) REFERENCES public.question_versions(id) ON DELETE RESTRICT;

ALTER TABLE "public"."question_versions"
  ADD CONSTRAINT "question_versions_question_id_fkey" FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE RESTRICT;

ALTER TABLE "public"."response_sessions"
  ADD CONSTRAINT "response_sessions_origin_version_id_fkey" FOREIGN KEY (origin_version_id) REFERENCES public.questionnaire_versions(id) ON DELETE SET NULL;

ALTER TABLE "public"."question_responses"
  ADD CONSTRAINT "question_responses_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.response_sessions(id) ON DELETE RESTRICT;

ALTER TABLE "public"."response_sessions"
  ADD CONSTRAINT "response_sessions_respondent_id_fkey" FOREIGN KEY (respondent_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

CREATE INDEX question_responses_reference_idx ON public.question_responses USING btree (referenced_response_id);

CREATE INDEX question_responses_version_idx ON public.question_responses USING btree (question_version_id);

CREATE INDEX response_sessions_origin_idx ON public.response_sessions USING btree (origin_version_id);

CREATE TRIGGER question_response_identity
  BEFORE DELETE OR UPDATE ON public.question_responses
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_question_response_identity();

CREATE TRIGGER question_version_immutable
  BEFORE DELETE OR UPDATE ON public.question_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_question_version_immutable();

CREATE TRIGGER response_session_identity
  BEFORE UPDATE ON public.response_sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_question_response_identity();

CREATE POLICY "Own question responses" ON "public"."question_responses"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.response_sessions s
  WHERE ((s.id = question_responses.session_id) AND (s.respondent_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Own response question versions" ON "public"."question_versions"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.question_responses r
     JOIN public.response_sessions s ON ((s.id = r.session_id)))
  WHERE ((r.question_version_id = question_versions.id) AND (s.respondent_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Own response sessions" ON "public"."response_sessions"
  FOR SELECT
  TO "authenticated"
  USING ((respondent_id = ( SELECT auth.uid() AS uid)));

REVOKE ALL ON FUNCTION "private"."assert_published_response_access"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."assert_published_response_access"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_question_response_identity"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_question_response_identity"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_question_version_immutable"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_question_version_immutable"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."open_question_response_session"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."open_question_response_session"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."question_field_response_valid"(jsonb, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."question_field_response_valid"(jsonb, text, boolean) TO "postgres";

REVOKE ALL ON FUNCTION "private"."read_question_response_session"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_question_response_session"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."response_clause_matches"(jsonb, jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."response_clause_matches"(jsonb, jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."save_question_response_session"(uuid, jsonb, integer, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."save_question_response_session"(uuid, jsonb, integer, uuid, boolean) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."open_question_response_session"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."open_question_response_session"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."read_question_response_session"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."read_question_response_session"(uuid) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."save_question_response_session"(uuid, jsonb, integer, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."save_question_response_session"(uuid, jsonb, integer, uuid, boolean) TO "authenticated", "postgres", "service_role";

REVOKE ALL ON TABLE "public"."question_responses" FROM "authenticated";

GRANT SELECT ON TABLE "public"."question_responses" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."question_responses" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."question_versions" FROM "authenticated";

GRANT SELECT ON TABLE "public"."question_versions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."question_versions" TO "postgres", "service_role";

REVOKE ALL ON TABLE "public"."response_sessions" FROM "authenticated";

GRANT SELECT ON TABLE "public"."response_sessions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."response_sessions" TO "postgres", "service_role";

-- Explicit privileges also protect projects with broader default grants.
REVOKE ALL ON public.question_versions, public.response_sessions, public.question_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.question_versions, public.response_sessions, public.question_responses TO authenticated;
REVOKE ALL ON FUNCTION private.assert_published_response_access(uuid), private.guard_question_response_identity(), private.guard_question_version_immutable(), private.question_field_response_valid(jsonb,text,boolean), private.response_clause_matches(jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.open_question_response_session(uuid),private.read_question_response_session(uuid),private.save_question_response_session(uuid,jsonb,integer,uuid,boolean),public.open_question_response_session(uuid),public.read_question_response_session(uuid),public.save_question_response_session(uuid,jsonb,integer,uuid,boolean) FROM PUBLIC,anon;
NOTIFY pgrst, 'reload schema';
