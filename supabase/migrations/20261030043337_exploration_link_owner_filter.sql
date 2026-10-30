-- Keep five-argument callers compatible through the default owner argument.
drop function public.read_exploration_link_page(text,text,integer,uuid[],integer);
create function public.read_exploration_link_page(p_scope text default 'own',p_query text default '',p_page integer default 1,p_excluded uuid[] default '{}',p_local_count integer default 0,p_owner uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); total bigint; current_page integer; result jsonb; local_n integer;
begin
 if uid is null or not private.can_manage_exploration() or (p_scope='others' and not(private.is_admin() or private.is_consultant_lead())) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_scope is null or p_scope not in ('own','others') or p_query is null or length(p_query)>200 or p_page is null or p_page not between 1 and 100000 or p_local_count is null or p_local_count not between 0 and 10000 or p_excluded is null or cardinality(p_excluded)>10000 or array_position(p_excluded,null) is not null then raise exception 'Invalid list request' using errcode='22023'; end if;
 local_n:=case when p_scope='own' then p_local_count else 0 end;
 select count(*)+local_n into total from public.exploration_links l where deleted_at is null
 and case when p_scope='own' then owner_id=uid and not(id=any(p_excluded)) else owner_id<>uid and (p_owner is null or owner_id=p_owner) end
 and strpos(lower(name||' '||description),lower(p_query))>0;
 current_page:=least(p_page,greatest(1,ceil(total/10.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
 select l.id,l.owner_id,l.name,l.node_count,l.revision,l.updated_at,p.name as owner_name from public.exploration_links l left join public.profiles p on p.id=l.owner_id
 where l.deleted_at is null and case when p_scope='own' then l.owner_id=uid and not(l.id=any(p_excluded)) else l.owner_id<>uid and (p_owner is null or l.owner_id=p_owner) end
 and strpos(lower(l.name||' '||l.description),lower(p_query))>0 order by l.updated_at desc,l.id
 limit greatest(0,10-greatest(0,local_n-(current_page-1)*10)) offset greatest(0,(current_page-1)*10-local_n)
 ) x;
 return jsonb_build_object('items',result,'total',total,'page',current_page);
end $$;
revoke all on function public.read_exploration_link_page(text,text,integer,uuid[],integer,uuid) from public,anon;
grant execute on function public.read_exploration_link_page(text,text,integer,uuid[],integer,uuid) to authenticated;

create function public.read_exploration_link_people()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid := auth.uid(); result jsonb;
begin
 if uid is null or not private.can_manage_exploration() or not (private.is_admin() or private.is_consultant_lead()) then
   raise exception 'Forbidden' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.label,x.id),'[]'::jsonb) into result
 from (
   select l.owner_id as id,coalesce(p.name,'작성자') as label,count(*) as count
   from public.exploration_links l left join public.profiles p on p.id=l.owner_id
   where l.deleted_at is null and l.owner_id<>uid
   group by l.owner_id,p.name
 ) x;
 return result;
end $$;
revoke all on function public.read_exploration_link_people() from public,anon;
grant execute on function public.read_exploration_link_people() to authenticated;
