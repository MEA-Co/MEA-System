-- Keep legacy isOther option IDs and labels, but present their answers consistently.
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
 return (select string_agg(
   case when o->'isOther'='true'::jsonb then '직접 입력: '||(a->>'text') else o->>'label' end,
   ', ' order by position)
 from jsonb_array_elements(p_options) with ordinality as options(o,position)
 join jsonb_array_elements(selection) a on o->>'id'=case when jsonb_typeof(a)='object' then a->>'id' else a#>>'{}' end);
end $$;
revoke all on function private.question_answer_text(text,jsonb,text) from public,anon,authenticated;
