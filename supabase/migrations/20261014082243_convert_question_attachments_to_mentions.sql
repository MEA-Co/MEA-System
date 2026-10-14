begin;
-- Convert existing attachment fields/answers to text mentions, then retire the kinds.
-- Temporary helpers live only in the migration session. No reference permissions change.
set local lock_timeout = '5s';
lock table public.questions,public.response_sessions,public.question_responses,public.response_submissions in access exclusive mode;
create temporary table attachment_fields on commit drop as
select id,fields from public.questions where exists(
  select 1 from jsonb_array_elements(fields) f where f->>'kind' in ('exploration','study'));

do $preflight$
begin
  if exists(select 1 from public.questionnaire_questions where kind in ('exploration','study'))
    or exists(select 1 from public.question_responses where
      legacy_definition @? '$.**.kind ? (@ == "exploration" || @ == "study")'
      or previous_responses @? '$.**.kind ? (@ == "exploration" || @ == "study")') then
    raise exception 'Legacy attachment definitions require explicit migration before conversion';
  end if;
  if exists(select 1 from public.questions q cross join lateral jsonb_array_elements(coalesce(q.condition->'clauses','[]')) c
    join attachment_fields source on source.id::text=c->>'blockId'
    cross join lateral jsonb_array_elements(source.fields) f
    where f->>'kind' in ('exploration','study') and f->>'id'=c->>'fieldId' and c->>'op'<>'answered') then
    raise exception 'Attachment value condition needs explicit conversion';
  end if;
  if (select count(*) from pg_trigger where tgrelid='public.questions'::regclass
    and tgname in ('validate_question','a_distributed_question_lock','reconcile_guide_question_update') and tgenabled='O')<>3 then
    raise exception 'Unexpected question trigger state';
  end if;
end
$preflight$;

create function pg_temp.attachment_rows_to_mentions(rows jsonb, fields jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]'; row_data jsonb; field jsonb; value text; mention text;
begin
  for row_data in select * from jsonb_array_elements(rows) loop
    for field in select item.value from jsonb_array_elements(fields) item where item.value->>'kind' in ('exploration','study') loop
      value:=row_data->'answers'->>(field->>'id');
      if value is null or btrim(value)='' then continue; end if;
      if value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Unexpected attachment answer; preserve original and review';
      end if;
      -- Generic labels avoid copying a potentially private referenced object's title.
      mention:='::mea-rich-text:v1::'||jsonb_build_object('type','doc','content',jsonb_build_array(
        jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object(
          'type','text','text',case when field->>'kind'='study' then '첨부한 학습법' else '첨부한 탐구활동' end,
          'marks',jsonb_build_array(jsonb_build_object('type',case when field->>'kind'='study' then 'studyReference' else 'explorationReference' end,
            'attrs',jsonb_build_object('id',value))))))))::text;
      row_data:=jsonb_set(row_data,array['answers',field->>'id'],to_jsonb(mention));
    end loop;
    result:=result||jsonb_build_array(row_data);
  end loop;
  return result;
end;
$$;

-- Transform each working/submitted copy independently: never publish private edits.
update public.question_responses r set rows=pg_temp.attachment_rows_to_mentions(r.rows,f.fields)
from attachment_fields f where r.question_id=f.id;
with patches as (
  select sub.session_id,jsonb_object_agg(f.id::text,jsonb_set(sub.answers->f.id::text,'{rows}',
    pg_temp.attachment_rows_to_mentions(sub.answers->f.id::text->'rows',f.fields))) patch
  from public.response_submissions sub join attachment_fields f on sub.answers ? f.id::text
  group by sub.session_id
)
update public.response_submissions sub set answers=sub.answers||patches.patch
from patches where patches.session_id=sub.session_id;
with patches as (
  select s.id,jsonb_object_agg(f.id::text,pg_temp.attachment_rows_to_mentions(s.last_payload->'answers'->f.id::text,f.fields)) patch
  from public.response_sessions s join attachment_fields f on s.last_payload->'answers' ? f.id::text
  group by s.id
)
update public.response_sessions s set last_payload=jsonb_set(s.last_payload,'{answers}',s.last_payload->'answers'||patches.patch)
from patches where patches.id=s.id;

-- Bypass only migration-incompatible guards while holding exclusive locks; restoring
-- them in this transaction preserves distribution locks and normal guide reconciliation.
alter table public.questions disable trigger validate_question;
alter table public.questions disable trigger a_distributed_question_lock;
alter table public.questions disable trigger reconcile_guide_question_update;
update public.questions q set fields=(
  select jsonb_agg(case when f->>'kind' in ('exploration','study') then
    (f - 'options' - 'choiceStyle' - 'choiceAllowText' - 'scaleMax' - 'scaleConfig')
      ||jsonb_build_object('kind','text',case when f->>'kind'='study' then 'studyRecommended' else 'explorationRecommended' end,true)
    else f end order by n)
  from jsonb_array_elements(q.fields) with ordinality item(f,n)
),revision=revision+1,last_save_id=gen_random_uuid(),last_save_hash=''
where q.id in (select id from attachment_fields);
alter table public.questions enable trigger validate_question;
alter table public.questions enable trigger a_distributed_question_lock;
alter table public.questions enable trigger reconcile_guide_question_update;

-- Existing validators now accept only the four supported field kinds. Preserve ACLs.
do $validators$
declare definition text; needle text;
begin
  definition:=pg_get_functiondef('private.validate_question()'::regprocedure);
  needle:='(''text'', ''scale'', ''single'', ''multiple'', ''exploration'', ''study'')';
  if position(needle in definition)=0 then raise exception 'Unexpected field validator'; end if;
  execute replace(definition,needle,'(''text'', ''scale'', ''single'', ''multiple'')');
  definition:=pg_get_functiondef('private.question_field_response_valid(jsonb,text,boolean)'::regprocedure);
  needle:=$needle$ if k in ('exploration','study') then return v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'; end if;$needle$;
  if position(needle in definition)=0 then raise exception 'Unexpected response validator'; end if;
  definition:=replace(definition,needle,'');
  execute replace(definition,' if v is null or length(v)>20000 then',
    ' if k is null or k not in (''text'',''scale'',''single'',''multiple'') then return false; end if;'||E'\n if v is null or length(v)>20000 then');
end
$validators$;
-- Remove the obsolete UUID-only guide lookup; rich-text reference ACL remains unchanged.
do $guide$
declare definition text; start_at integer; end_at integer;
begin
 definition:=pg_get_functiondef('private.guide_study_ids()'::regprocedure);
 start_at:=position('  -- The same visible guide can link a study through the dedicated reference field.' in definition);
 end_at:=position('  end loop;' in substring(definition from start_at));
 if start_at=0 or end_at=0 then raise exception 'Unexpected study guide reference function'; end if;
 definition:=substring(definition for start_at-1)||substring(definition from start_at+end_at+length('  end loop;')-1);
 execute definition;
end
$guide$;
drop trigger reject_new_question_attachment_fields on public.questions;
drop function private.reject_new_question_attachment_fields();

commit;
