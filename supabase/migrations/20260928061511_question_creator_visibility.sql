-- Independent question authoring is private to its creator; administrators can read all.
alter policy "Staff read questions" on public.questions using (
  (select private.is_admin()) or
  ((select private.is_consultant_lead()) and created_by=(select auth.uid()))
);
alter policy "Staff read question details" on public.question_details using (
  exists(select 1 from public.questions q where q.id=question_id)
);

-- Definer save RPCs must not let a caller reuse another author's private source.
create function private.guard_question_private_sources() returns trigger
language plpgsql set search_path='' as $$
declare source_id uuid;
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  if tg_table_name='questionnaire_questions' then
    if new.source_question_id is null then return new; end if;
    if not exists(select 1 from public.questions q where q.id=new.source_question_id and q.created_by=auth.uid()) then
      raise exception 'Question source is not available' using errcode='42501';
    end if;
  else
    for source_id in
      select new.source_block_id union select new.after_block_id
      union select (c->>'blockId')::uuid from jsonb_array_elements(coalesce(new.condition->'clauses','[]'::jsonb)) c
    loop
      if source_id is not null and not exists(select 1 from public.questions q where q.id=source_id and q.created_by=auth.uid()) then
        raise exception 'Question source is not available' using errcode='42501';
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function private.guard_question_private_sources() from public,anon,authenticated;
create trigger question_private_sources before insert or update of source_block_id,after_block_id,condition on public.questions
for each row execute function private.guard_question_private_sources();
create trigger placement_private_sources before insert or update of source_question_id on public.questionnaire_questions
for each row execute function private.guard_question_private_sources();

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
    'blocks',coalesce((select jsonb_agg((to_jsonb(q)-'search_text'-'last_save_id'-'last_save_hash') ||
      case when (select private.is_admin()) then jsonb_build_object('creator_name',
        (select p.name from public.profiles p where p.id=q.created_by))
      else '{}'::jsonb end order by q.updated_at desc,q.id desc) from page_rows q),'[]'::jsonb),
    'references',coalesce((select jsonb_agg(to_jsonb(q)-'search_text'-'last_save_id'-'last_save_hash') from public.questions q
      where q.archived_at is null and q.id in(select id from dependencies) and q.id not in(select id from page_rows)),'[]'::jsonb)
  ) into result from bounds;
  return result;
end $$;
revoke all on function public.list_questions_page(text,integer) from public,anon;
grant execute on function public.list_questions_page(text,integer) to authenticated;

