-- Additive read models only. Existing IDs, rows, policies and write RPCs stay intact.
-- View-role narrowing is checked here as well as in the HTTP boundary.
create function private.questionnaire_read_role(p_view_role text)
returns text language plpgsql stable security invoker set search_path='' as $$
declare actual text;
begin
  select role into actual from public.profiles where id=(select auth.uid());
  if auth.uid() is null or actual is null or actual not in ('admin','consultant_lead','consultant')
    or p_view_role is null or p_view_role not in ('admin','consultant_lead','consultant')
    or (actual <> 'admin' and p_view_role <> actual) then
    raise exception 'Questionnaire access required' using errcode='42501';
  end if;
  return p_view_role;
end $$;

-- Explicit scope also protects calls made by the bounded metadata definer below.
create function private.questionnaire_read_scope(p_view_role text)
returns setof public.questionnaires language sql stable security invoker set search_path='' as $$
  select q.* from public.questionnaires q
  cross join (select private.questionnaire_read_role(p_view_role) as role) r
  where r.role='admin'
    or (r.role='consultant_lead' and (q.status<>'draft' or q.created_by=(select auth.uid())))
    or (r.role='consultant' and q.status='published' and q.archived_at is null);
$$;

-- Definer is needed only for staff submission aggregates (sessions are owner-only)
-- and shared author names. It never returns working answer data.
create function private.questionnaire_list_items(p_ids uuid[], p_view_role text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare role text:=private.questionnaire_read_role(p_view_role); staff boolean:=role<>'consultant';
begin
  if p_ids is null or cardinality(p_ids)>14 or array_position(p_ids,null) is not null then
    raise exception 'Expected up to 14 questionnaire IDs' using errcode='22023';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',q.id,'title',q.title,'status',q.status,'archivedAt',q.archived_at,
    'reviewStartedAt',q.review_started_at,'publishedAt',q.published_at,
    'updatedAt',q.updated_at,'revision',q.revision,'hasPublished',q.status='published',
    'isOwner',staff and q.created_by=auth.uid(),
    'canEditDraft',staff and q.status='draft' and (role='admin' or q.created_by=auth.uid()),
    'canDelete',staff and (role='admin' or q.created_by=auth.uid()),
    'creatorName',case when staff and q.status in ('in_review','published') and q.archived_at is null
      then (select p.name from public.profiles p where p.id=q.created_by) end,
    'submittedResponseCount',case when staff and q.status='published' and q.archived_at is null then (
      select count(*) from public.response_submissions sub join public.response_sessions s on s.id=sub.session_id
      where s.origin_questionnaire_id=q.id and s.started_stage='published') else 0 end,
    'responseStatus',(select s.status from public.response_sessions s where s.origin_questionnaire_id=q.id
      and s.respondent_id=auth.uid() and s.started_stage='published'),
    'pendingReviewCount',case when staff and q.created_by=auth.uid() then reviews.pending else 0 end,
    'unreadReviewCount',case when staff then reviews.unread else 0 end
  ) order by array_position(p_ids,q.id))
  from private.questionnaire_read_scope(role) q
  left join lateral (
    select count(distinct r.id) as pending,
      count(distinct r.id) filter(where source.created_by=auth.uid() and r.requested_by<>auth.uid()
        and not exists(select 1 from public.question_review_reads seen where seen.review_id=r.id and seen.user_id=auth.uid())) as unread
    from public.questionnaire_questions placement
    join public.questions source on source.id=placement.source_question_id
    join public.question_review_requests r on r.question_id=source.id and r.resolved_at is null
    where staff and placement.questionnaire_id=q.id and private.can_read_question_reviews(r.question_id)
      and (q.created_by=auth.uid() or role='admin' or (q.status='in_review' and q.archived_at is null))
  ) reviews on true
  where q.id=any(p_ids)), '[]'::jsonb);
end $$;
create function public.questionnaire_list_items(p_ids uuid[],p_view_role text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.questionnaire_list_items(p_ids,p_view_role);
$$;

-- RLS remains active for the page/count query. Aggregates are calculated before
-- LIMIT and returned as one JSON object, independent of PostgREST's row ceiling.
create function public.list_questionnaires(
  p_status text default 'all', p_search text default '', p_owner text default 'all',
  p_page integer default 1, p_view_role text default 'consultant', p_response text default 'pending'
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
  role text:=private.questionnaire_read_role(p_view_role);
  total bigint; pages integer; page integer; ids uuid[]; result jsonb; groups jsonb:='[]';
  stage text; stage_limit integer; pending bigint; complete bigint;
begin
  if p_status is null or p_status not in ('all','draft','in_review','published','archived')
    or p_owner is null or p_owner not in ('all','mine')
    or p_page is null or p_page not between 1 and 100000
    or p_search is null or char_length(p_search)>200
    or p_response is null or p_response not in ('pending','complete') then
    raise exception 'Invalid list options' using errcode='22023';
  end if;
  if role='consultant' then
    -- Preserve the existing submission-status tabs, now with server counts/pages.
    select count(*) filter(where coalesce(s.status,'')<>'submitted'),count(*) filter(where s.status='submitted')
    into pending,complete from private.questionnaire_read_scope(role) q
    left join public.response_sessions s on s.origin_questionnaire_id=q.id
      and s.respondent_id=auth.uid() and s.started_stage='published';
    total:=case when p_response='complete' then complete else pending end;
    pages:=greatest(1,ceil(total/10.0)::integer); page:=least(p_page,pages);
    select coalesce(array_agg(id order by updated_at desc,id),'{}') into ids from (
      select q.id,q.updated_at from private.questionnaire_read_scope(role) q
      left join public.response_sessions s on s.origin_questionnaire_id=q.id
        and s.respondent_id=auth.uid() and s.started_stage='published'
      where (coalesce(s.status,'')='submitted')=(p_response='complete')
      order by q.updated_at desc,q.id limit 10 offset (page-1)*10
    ) page_rows;
    return jsonb_build_object('groups','[]'::jsonb,'total',total,'page',page,'pages',pages,
      'items',private.questionnaire_list_items(ids,role),
      'responseCounts',jsonb_build_object('pending',pending,'complete',complete));
  end if;
  foreach stage in array case when p_status='all' then array['draft','in_review','published'] else array[p_status] end loop
    select count(*) into total from private.questionnaire_read_scope(role) q
    where (case when stage='archived' then q.archived_at is not null and q.created_by=auth.uid()
      else q.archived_at is null and q.status=stage end)
      and (p_owner='all' or q.created_by=auth.uid())
      and strpos(lower(coalesce(nullif(q.title,''),'제목 없는 질문지')),lower(btrim(p_search)))>0;
    pages:=greatest(1,ceil(total/10.0)::integer); page:=least(p_page,pages);
    stage_limit:=case when p_status='all' and stage in ('draft','in_review') then 2 else 10 end;
    select coalesce(array_agg(id order by sort_date desc,id),'{}') into ids from (
      select q.id,case when stage='published' then coalesce(q.published_at,q.updated_at) else q.updated_at end sort_date
      from private.questionnaire_read_scope(role) q
      where (case when stage='archived' then q.archived_at is not null and q.created_by=auth.uid()
        else q.archived_at is null and q.status=stage end)
        and (p_owner='all' or q.created_by=auth.uid())
        and strpos(lower(coalesce(nullif(q.title,''),'제목 없는 질문지')),lower(btrim(p_search)))>0
      order by sort_date desc,q.id limit stage_limit offset case when p_status='all' then 0 else (page-1)*10 end
    ) page_rows;
    result:=jsonb_build_object('status',stage,'total',total,'items',private.questionnaire_list_items(ids,role));
    groups:=groups||jsonb_build_array(result);
  end loop;
  return jsonb_build_object('groups',case when p_status='all' then groups else '[]'::jsonb end,
    'total',case when p_status='all' then (select sum((g->>'total')::bigint) from jsonb_array_elements(groups) g) else total end,
    'page',case when p_status='all' then 1 else page end,'pages',case when p_status='all' then 1 else pages end,
    'items',case when p_status='all' then '[]'::jsonb else result->'items' end);
end $$;

revoke all on function private.questionnaire_read_role(text),private.questionnaire_read_scope(text),
  private.questionnaire_list_items(uuid[],text),public.questionnaire_list_items(uuid[],text),
  public.list_questionnaires(text,text,text,integer,text,text) from public,anon;
grant execute on function private.questionnaire_read_role(text),private.questionnaire_read_scope(text),
  private.questionnaire_list_items(uuid[],text),public.questionnaire_list_items(uuid[],text),
  public.list_questionnaires(text,text,text,integer,text,text) to authenticated;
