-- Generated with db pull, reordered for stored-column dependencies and explicit grants.
create extension if not exists pg_trgm with schema extensions;

-- Plain-text extraction mirrors richTextPlainText's paragraph/list separators.
create function private.question_search_node(p_node jsonb, p_depth integer default 0)
returns text language plpgsql immutable set search_path='' as $$
declare kind text:=p_node->>'type'; result text:=''; child jsonb; part text; first_item boolean:=true;
begin
  if p_depth>16 or jsonb_typeof(p_node) is distinct from 'object' then return null; end if;
  if kind='text' then
    if jsonb_typeof(p_node->'text') is distinct from 'string' then return null; end if;
    return p_node->>'text';
  end if;
  if kind='hardBreak' then return E'\n'; end if;
  if kind is null or kind not in ('doc','paragraph','bulletList','orderedList','listItem') then return null; end if;
  if p_node ? 'content' and jsonb_typeof(p_node->'content') is distinct from 'array' then return null; end if;
  for child in select value from jsonb_array_elements(coalesce(p_node->'content','[]'::jsonb)) loop
    part:=private.question_search_node(child,p_depth+1);
    if part is null then return null; end if;
    if not first_item and kind<>'paragraph' then result:=result||E'\n'; end if;
    result:=result||part; first_item:=false;
  end loop;
  return result;
end $$;
create function private.question_search_plain(p_text text)
returns text language plpgsql immutable set search_path='' as $$
declare doc jsonb;
begin
  if left(p_text,length('::mea-rich-text:v1::')) <> '::mea-rich-text:v1::' then return p_text; end if;
  begin doc:=substring(p_text from length('::mea-rich-text:v1::')+1)::jsonb;
  exception when invalid_text_representation then return p_text; end;
  if doc->>'type' is distinct from 'doc' then return p_text; end if;
  return coalesce(private.question_search_node(doc),p_text);
end $$;
revoke all on function private.question_search_node(jsonb,integer), private.question_search_plain(text) from public,anon,authenticated;
alter table public.questions add column search_text text generated always as (title||E'\n'||private.question_search_plain(prompt)) stored;
create index questions_active_page_idx on public.questions(updated_at desc,id desc) where archived_at is null;

create function public.list_questions_page(p_search text default '', p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare pattern text; result jsonb;
begin
  if p_page is null or p_page<1 or p_page>100000 or p_search is null or length(p_search)>200 then
    raise exception 'Invalid question page' using errcode='22023';
  end if;
  -- Treat %, _ and backslash as literal user input, never pattern syntax.
  pattern:='%'||replace(replace(replace(btrim(p_search),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
  with totals as (
    select count(*) total from public.questions where archived_at is null and search_text ilike pattern escape E'\\'
  ), bounds as (
    select total,least(p_page,greatest(1,ceil(total/20.0)::integer)) page from totals
  ), page_rows as materialized (
    select q.* from public.questions q
    where q.archived_at is null and q.search_text ilike pattern escape E'\\'
    order by q.updated_at desc,q.id desc
    limit 20 offset (select (page-1)*20 from bounds)
  ), dependencies as (
    select source_block_id id from page_rows union select after_block_id from page_rows
    union select (clause->>'blockId')::uuid from page_rows,
      lateral jsonb_array_elements(coalesce(condition->'clauses','[]'::jsonb)) clause
  )
  select jsonb_build_object(
    'total',bounds.total,'page',bounds.page,'pageSize',20,
    'blocks',coalesce((select jsonb_agg(to_jsonb(q)-'search_text'-'last_save_id'-'last_save_hash' order by q.updated_at desc,q.id desc) from page_rows q),'[]'::jsonb),
    'references',coalesce((select jsonb_agg(to_jsonb(q)-'search_text'-'last_save_id'-'last_save_hash') from public.questions q
      where q.archived_at is null and q.id in(select id from dependencies) and q.id not in(select id from page_rows)),'[]'::jsonb)
  ) into result from bounds;
  return result;
end $$;
revoke all on function public.list_questions_page(text,integer) from public,anon;
grant execute on function public.list_questions_page(text,integer) to authenticated;

create index questions_active_search_idx on public.questions using gin(search_text extensions.gin_trgm_ops) where archived_at is null;
