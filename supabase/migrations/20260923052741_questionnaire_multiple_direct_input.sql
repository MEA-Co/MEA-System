-- Multiple-choice questions may have several independent direct-input options.
create or replace function private.question_config_valid(p_kind text,p_options jsonb,p_ready boolean default false)
returns boolean language plpgsql immutable set search_path='' as $$
declare o jsonb; ids text[]:='{}'; labels text[]:='{}'; other_count integer:=0;
begin
 if p_kind is null or p_kind not in ('text','scale','single','multiple') or jsonb_typeof(p_options) is distinct from 'array' then return false;end if;
 if p_kind in ('text','scale') then return jsonb_array_length(p_options)=0;end if;
 if jsonb_array_length(p_options)>20 or (p_ready and jsonb_array_length(p_options)<2) then return false;end if;
 for o in select value from jsonb_array_elements(p_options) loop
  if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'id') is distinct from 'string'
   or (o->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(o->'label') is distinct from 'string' or length(o->>'label')>500 or (o->>'id')=any(ids)
   or (p_ready and (btrim(o->>'label')='' or btrim(o->>'label')=any(labels))) then return false;end if;
  if o ? 'isOther' and jsonb_typeof(o->'isOther') is distinct from 'boolean' then return false;end if;
  if o->'isOther'='true'::jsonb then other_count:=other_count+1;end if;
  if p_kind='single' and other_count>1 then return false;end if;
  ids:=array_append(ids,o->>'id');labels:=array_append(labels,btrim(o->>'label'));
 end loop;
 return true;
end $$;
revoke all on function private.question_config_valid(text,jsonb,boolean) from public,anon,authenticated;

-- Number direct-input answers only when the question contains more than one.
-- Keep their answer text after the predefined choices, like the UI.
create or replace function private.question_answer_text(p_kind text,p_options jsonb,p_value text)
returns text language plpgsql immutable set search_path='' as $$
declare selection jsonb; item jsonb;
begin
 if p_value='' or p_kind='text' then return p_value;end if;
 if p_kind='scale' then return p_value||'점 · '||(array['전혀 그렇지 않다','그렇지 않다','보통이다','그렇다','매우 그렇다'])[p_value::integer];end if;
 if p_kind='single' then
  begin item:=p_value::jsonb;exception when invalid_text_representation then item:=to_jsonb(p_value);end;
  selection:=jsonb_build_array(item);
 else selection:=p_value::jsonb;end if;
 return (with options as (
   select o,position,
     sum(case when o->'isOther'='true'::jsonb then 1 else 0 end) over (order by position) as other_number,
     sum(case when o->'isOther'='true'::jsonb then 1 else 0 end) over () as other_total
   from jsonb_array_elements(p_options) with ordinality as items(o,position)
 )
 select string_agg(
   case when o->'isOther'='true'::jsonb
     then '직접 입력'||case when other_total>1 then ' '||other_number else '' end||': '||(a->>'text')
     else o->>'label' end,
   ', ' order by case when o->'isOther'='true'::jsonb then 1 else 0 end,position)
 from options
 join jsonb_array_elements(selection) a on o->>'id'=case when jsonb_typeof(a)='object' then a->>'id' else a#>>'{}' end);
end $$;
revoke all on function private.question_answer_text(text,jsonb,text) from public,anon,authenticated;
