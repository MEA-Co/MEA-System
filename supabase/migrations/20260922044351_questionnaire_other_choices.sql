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
  if other_count>1 then return false;end if;
  ids:=array_append(ids,o->>'id');labels:=array_append(labels,btrim(o->>'label'));
 end loop;
 return true;
end $$;
revoke all on function private.question_config_valid(text,jsonb,boolean) from public,anon,authenticated;

-- Keep the existing string wire format and stable option IDs. Other choices carry {id,text}.
create or replace function private.question_answer_valid(p_kind text,p_options jsonb,p_value text,p_complete boolean)
returns boolean language plpgsql immutable set search_path='' as $$
declare selection jsonb; item jsonb; option_item jsonb; selected_id text; seen text[]:='{}';
begin
 if p_value is null then return false;end if;
 if btrim(p_value)='' then return not p_complete;end if;
 if p_kind='text' then return true;end if;
 if p_kind='scale' then return p_value ~ '^[1-5]$';end if;
 if p_kind not in ('single','multiple') then return false;end if;
 if p_kind='single' then
  begin item:=p_value::jsonb;exception when invalid_text_representation then item:=to_jsonb(p_value);end;
  selection:=jsonb_build_array(item);
 else
  begin selection:=p_value::jsonb;exception when invalid_text_representation then return false;end;
 end if;
 if jsonb_typeof(selection) is distinct from 'array' then return false;end if;
 if jsonb_array_length(selection)=0 then return false;end if;
 for item in select value from jsonb_array_elements(selection) loop
  if jsonb_typeof(item)='string' then selected_id:=item#>>'{}';
  elsif jsonb_typeof(item)='object' and jsonb_typeof(item->'id')='string' then selected_id:=item->>'id';
  else return false;end if;
  if selected_id=any(seen) then return false;end if;
  select o into option_item from jsonb_array_elements(p_options) o where o->>'id'=selected_id;
  if not found then return false;end if;
  if option_item->'isOther'='true'::jsonb then
   if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'text') is distinct from 'string'
    or length(item->>'text')>5000 or (p_complete and btrim(item->>'text')='') then return false;end if;
  elsif jsonb_typeof(item) is distinct from 'string' then return false;end if;
  seen:=array_append(seen,selected_id);
 end loop;
 return true;
end $$;

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
 return (select string_agg(o->>'label' || case when o->'isOther'='true'::jsonb then ': '||(a->>'text') else '' end, ', ' order by position)
 from jsonb_array_elements(p_options) with ordinality as options(o,position)
 join jsonb_array_elements(selection) a on o->>'id'=case when jsonb_typeof(a)='object' then a->>'id' else a#>>'{}' end);
end $$;
revoke all on function private.question_answer_valid(text,jsonb,text,boolean) from public,anon,authenticated;
revoke all on function private.question_answer_text(text,jsonb,text) from public,anon,authenticated;
