-- Run against the schema immediately before the conversion migration; always rolls back.
\set ON_ERROR_STOP on
begin;
create temporary table before_questions as select * from public.questions;
create temporary table before_responses as select * from public.question_responses;
create temporary table before_submissions as select * from public.response_submissions;
create temporary table before_sessions as select * from public.response_sessions;
-- CONVERSION_MIGRATION_BODY
select count(*) as retired_fields from public.questions q cross join lateral jsonb_array_elements(q.fields) f where f->>'kind' in ('exploration','study');
do $$
begin
 if exists(select 1 from public.question_responses r join before_responses b using(id) where (to_jsonb(r)-'rows') is distinct from (to_jsonb(b)-'rows')) then raise exception 'Response metadata changed'; end if;
 if exists(select 1 from public.response_submissions r join before_submissions b using(session_id) where (to_jsonb(r)-'answers') is distinct from (to_jsonb(b)-'answers')) then raise exception 'Submission metadata changed'; end if;
 if exists(select 1 from public.response_sessions r join before_sessions b using(id) where (to_jsonb(r)-'last_payload') is distinct from (to_jsonb(b)-'last_payload')) then raise exception 'Session metadata changed'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.questions'::regclass and tgenabled<>'O') then raise exception 'Trigger not restored'; end if;
end $$;
-- The conversion helper preserves row metadata and unrelated values, for both kinds.
do $$
declare fields jsonb := '[{"id":"a","kind":"exploration"},{"id":"b","kind":"study"}]';
 original jsonb := '[{"id":7,"label":"시기","flowIndex":2,"answers":{"a":"00000000-0000-0000-0000-000000000001","b":"00000000-0000-0000-0000-000000000002","other":"다른 답변"}},{"id":8,"answers":{"a":""}}]';
 converted jsonb; row_data jsonb; field jsonb; source jsonb; value text; doc jsonb;
begin
 converted:=pg_temp.attachment_rows_to_mentions(original,fields);
 if (converted->0)-'answers' <> (original->0)-'answers' or converted#>>'{0,answers,other}'<>'다른 답변' or converted->1<>original->1 then raise exception 'Row metadata or empty answers changed'; end if;
 if substring(converted#>>'{0,answers,a}' from length('::mea-rich-text:v1::')+1)::jsonb #>> '{content,0,content,0,marks,0,attrs,id}' <> '00000000-0000-0000-0000-000000000001' then raise exception 'Exploration ID changed'; end if;
 if substring(converted#>>'{0,answers,b}' from length('::mea-rich-text:v1::')+1)::jsonb #>> '{content,0,content,0,marks,0,type}' <> 'studyReference' then raise exception 'Study reference not converted'; end if;
 -- Every actual saved/submitted nonblank attachment gets its own original ID.
 for source in
   select jsonb_build_object('old',b.rows,'new',r.rows,'fields',f.fields) from before_responses b join public.question_responses r using(id) join attachment_fields f on f.id=r.question_id
   union all
   select jsonb_build_object('old',b.answers->f.id::text->'rows','new',r.answers->f.id::text->'rows','fields',f.fields) from before_submissions b join public.response_submissions r using(session_id) join attachment_fields f on b.answers ? f.id::text
 loop
   if jsonb_array_length(source->'old') <> jsonb_array_length(source->'new') then raise exception 'Row count changed'; end if;
   for row_data in select * from jsonb_array_elements(source->'old') loop
     for field in select f from jsonb_array_elements(source->'fields') f where f->>'kind' in ('exploration','study') loop
       value:=row_data->'answers'->>(field->>'id');
       if value is null or btrim(value)='' then continue; end if;
       select substring(r->'answers'->>(field->>'id') from length('::mea-rich-text:v1::')+1)::jsonb into doc from jsonb_array_elements(source->'new') r where r->'id'=row_data->'id';
       if doc#>>'{content,0,content,0,marks,0,attrs,id}' is distinct from value then raise exception 'Saved reference lost'; end if;
     end loop;
   end loop;
 end loop;
 begin
   perform pg_temp.attachment_rows_to_mentions('[{"id":1,"answers":{"a":"invalid"}}]',fields);
   raise exception 'Invalid source silently discarded';
 exception when raise_exception then if sqlerrm <> 'Unexpected attachment answer; preserve original and review' then raise; end if; end;
end $$;
rollback;
