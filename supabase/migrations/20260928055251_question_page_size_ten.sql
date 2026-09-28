-- Reduce question list pages to ten; preserve search, ordering, and RLS.
create or replace function public.list_questions_page(p_search text default '', p_page integer default 1)
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
    select total,least(p_page,greatest(1,ceil(total/10.0)::integer)) page from totals
  ), page_rows as materialized (
    select q.* from public.questions q
    where q.archived_at is null and q.search_text ilike pattern escape E'\\'
    order by q.updated_at desc,q.id desc
    limit 10 offset (select (page-1)*10 from bounds)
  ), dependencies as (
    select source_block_id id from page_rows union select after_block_id from page_rows
    union select (clause->>'blockId')::uuid from page_rows,
      lateral jsonb_array_elements(coalesce(condition->'clauses','[]'::jsonb)) clause
  )
  select jsonb_build_object(
    'total',bounds.total,'page',bounds.page,'pageSize',10,
    'blocks',coalesce((select jsonb_agg(to_jsonb(q)-'search_text'-'last_save_id'-'last_save_hash' order by q.updated_at desc,q.id desc) from page_rows q),'[]'::jsonb),
    'references',coalesce((select jsonb_agg(to_jsonb(q)-'search_text'-'last_save_id'-'last_save_hash') from public.questions q
      where q.archived_at is null and q.id in(select id from dependencies) and q.id not in(select id from page_rows)),'[]'::jsonb)
  ) into result from bounds;
  return result;
end $$;
revoke all on function public.list_questions_page(text,integer) from public,anon;
grant execute on function public.list_questions_page(text,integer) to authenticated;

