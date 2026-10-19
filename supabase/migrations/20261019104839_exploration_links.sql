-- Graphs are bounded JSON; reusable skills are independent, owner-scoped records.
create table public.exploration_links (
 id uuid primary key,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (length(name) between 1 and 200),
 description text not null default '' check (length(description)<=5000),
 graph jsonb not null,
 node_count integer not null,
 revision integer not null check (revision>0),
 save_id uuid not null,
 request_hash text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create table public.exploration_link_skills (
 id uuid primary key,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 200),
 description text not null check (length(btrim(description)) between 1 and 5000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index exploration_links_owner_updated_idx on public.exploration_links(owner_id,updated_at desc,id);
create index exploration_links_updated_idx on public.exploration_links(updated_at desc,id) where deleted_at is null;
create index exploration_link_skills_owner_updated_idx on public.exploration_link_skills(owner_id,updated_at desc,id);
alter table public.exploration_links enable row level security;
alter table public.exploration_link_skills enable row level security;
revoke all on public.exploration_links,public.exploration_link_skills from public,anon,authenticated;
grant select on public.exploration_links,public.exploration_link_skills to authenticated;
create policy exploration_links_read on public.exploration_links for select to authenticated using (
 deleted_at is null and (select private.can_manage_exploration()) and
 (owner_id=(select auth.uid()) or (select private.is_admin()) or (select private.is_consultant_lead()))
);
create policy exploration_link_skills_read on public.exploration_link_skills for select to authenticated using (
 (select private.can_manage_exploration()) and
 (owner_id=(select auth.uid()) or (select private.is_admin()) or (select private.is_consultant_lead()))
);

-- Business conflicts must NOT raise SQLSTATE 40001 (PostgREST retries it).
create function private.exploration_link_conflict() returns void language plpgsql set search_path='' as $$
begin
 raise sqlstate 'PGRST' using message='{"code":"40001","message":"Exploration link conflict","details":null,"hint":null}', detail='{"status":409,"headers":{}}';
end $$;
revoke all on function private.exploration_link_conflict() from public,anon,authenticated;

create function private.save_exploration_link(p_id uuid,p_content jsonb,p_expected_revision integer,p_save_id uuid)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='8s' as $$
declare
 uid uuid := auth.uid(); v public.exploration_links; skill_row public.exploration_link_skills;
 g jsonb; item jsonb; k text; ids uuid[]; remaining uuid[]; roots uuid[]; skill_ids uuid[];
 normalized_nodes jsonb; normalized_edges jsonb; saved_skills jsonb;
 request_hash text; sid uuid; a uuid; b uuid;
begin
 if uid is null or not private.can_manage_exploration() then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_save_id is null or p_expected_revision is null or p_expected_revision<0
 or p_content is null or jsonb_typeof(p_content)<>'object' or octet_length(p_content::text)>2500000 then
 raise exception 'Invalid request' using errcode='22023'; end if;
 if jsonb_typeof(p_content->'name') is distinct from 'string' or (p_content->>'name') !~ '[^[:space:]]'
 or length(p_content->>'name')>200 or jsonb_typeof(p_content->'description') is distinct from 'string'
 or length(p_content->>'description')>5000 then raise exception 'Invalid name or description' using errcode='22023'; end if;
 g:=p_content->'graph';
 if jsonb_typeof(g) is distinct from 'object' then raise exception 'Invalid graph' using errcode='22023'; end if;
 foreach k in array array['nodes','edges','skills'] loop
 if jsonb_typeof(g->k) is distinct from 'array' then raise exception 'Invalid graph array' using errcode='22023'; end if;
 end loop;
 if jsonb_array_length(g->'nodes') not between 2 and 300 or jsonb_array_length(g->'edges') not between 1 and 1000
 or jsonb_array_length(g->'skills')>500 then raise exception 'Invalid graph size' using errcode='22023'; end if;
 select array_agg((n->>'explorationId')::uuid) into ids from jsonb_array_elements(g->'nodes') n;
 if array_position(ids,null) is not null or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then
 raise exception 'Duplicate or missing activity' using errcode='22023'; end if;
 select coalesce(array_agg((n->>'id')::uuid),'{}'::uuid[]) into skill_ids from jsonb_array_elements(g->'skills') n;
 if array_position(skill_ids,null) is not null or cardinality(skill_ids)<>(select count(distinct x) from unnest(skill_ids) x) then
 raise exception 'Duplicate or missing skill' using errcode='22023'; end if;
 for item in select * from jsonb_array_elements(g->'edges') loop
 a:=(item->>'from')::uuid; b:=(item->>'to')::uuid; sid:=(item->>'skillId')::uuid;
 if a is null or b is null or a=b or not(a=any(ids)) or not(b=any(ids))
 or (sid is not null and not(sid=any(skill_ids))) then raise exception 'Invalid edge' using errcode='22023'; end if;
 end loop;
 if (select count(distinct ((e->>'from')::uuid,(e->>'to')::uuid)) from jsonb_array_elements(g->'edges') e)<>jsonb_array_length(g->'edges') then
 raise exception 'Duplicate edge' using errcode='22023'; end if;
 -- Kahn elimination is bounded by 300 vertices; avoids exponential path enumeration.
 remaining:=ids;
 while cardinality(remaining)>0 loop
 select array_agg(n) into roots from unnest(remaining) n where not(n=any(array(
 select distinct (e->>'to')::uuid from jsonb_array_elements(g->'edges') e where (e->>'from')::uuid=any(remaining))));
 if roots is null then raise exception 'Cyclic graph' using errcode='22023'; end if;
 select coalesce(array_agg(n),'{}'::uuid[]) into remaining from unnest(remaining) n where not(n=any(roots));
 end loop;
 request_hash:=md5(p_content::text);
 perform pg_advisory_xact_lock(hashtextextended('exploration-link:'||p_id::text,0));
 select * into v from public.exploration_links where id=p_id for update;
 if found then
 if v.owner_id<>uid then raise exception 'Forbidden' using errcode='42501'; end if;
 if v.deleted_at is not null then perform private.exploration_link_conflict(); end if;
 if v.save_id=p_save_id then
 if v.request_hash<>request_hash then perform private.exploration_link_conflict(); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'updatedAt',s.updated_at) order by s.id),'[]'::jsonb)
 into saved_skills from public.exploration_link_skills s where s.owner_id=uid and s.id in (select (e->>'skillId')::uuid from jsonb_array_elements(v.graph->'edges') e);
 return to_jsonb(v)-'request_hash'||jsonb_build_object('skills',saved_skills);
 end if;
 if v.revision<>p_expected_revision then perform private.exploration_link_conflict(); end if;
 elsif p_expected_revision<>0 then perform private.exploration_link_conflict(); end if;
 -- Only connected activities survive confirmation. Indexed ID lookups, no answers scanned.
 select array_agg(n) into ids from unnest(ids) n where exists (
 select 1 from jsonb_array_elements(g->'edges') e where n in ((e->>'from')::uuid,(e->>'to')::uuid));
 perform e.id from public.exploration e where e.id=any(ids) and e.owner_id=uid and e.deleted_at is null order by e.id for share;
 if (select count(*) from public.exploration e where e.id=any(ids) and e.owner_id=uid and e.deleted_at is null)<>cardinality(ids) then
 raise exception 'Activity missing or inaccessible' using errcode='22023'; end if;
 select jsonb_agg(jsonb_build_object('explorationId',e.id,'title',e.values->>'topic') order by n.ordinality)
 into normalized_nodes from jsonb_array_elements(g->'nodes') with ordinality n(value,ordinality)
 join public.exploration e on e.id=(n.value->>'explorationId')::uuid where e.id=any(ids);
 select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('from',(e->>'from')::uuid,'to',(e->>'to')::uuid,'skillId',(e->>'skillId')::uuid)))
 into normalized_edges from jsonb_array_elements(g->'edges') e;
 if octet_length(normalized_nodes::text)+octet_length(normalized_edges::text)>2500000 then raise exception 'Graph too large' using errcode='22023'; end if;
 -- Lock reusable skill IDs in a consistent order across different links.
 for item in select x from jsonb_array_elements(g->'skills') x order by (x->>'id')::uuid loop
 sid:=(item->>'id')::uuid;
 if not exists(select 1 from jsonb_array_elements(g->'edges') e where (e->>'skillId')::uuid=sid) then continue; end if;
 if jsonb_typeof(item->'name') is distinct from 'string' or (item->>'name') !~ '[^[:space:]]' or length(item->>'name')>200
 or jsonb_typeof(item->'description') is distinct from 'string' or (item->>'description') !~ '[^[:space:]]' or length(item->>'description')>5000 then
 raise exception 'Invalid skill' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('exploration-link-skill:'||sid::text,0));
 select * into skill_row from public.exploration_link_skills where id=sid for update;
 if found then
 if skill_row.owner_id<>uid then raise exception 'Forbidden skill' using errcode='42501'; end if;
 if skill_row.name is distinct from item->>'name' or skill_row.description is distinct from item->>'description' then
 if (item->>'updatedAt')::timestamptz is distinct from skill_row.updated_at then perform private.exploration_link_conflict(); end if;
 update public.exploration_link_skills set name=item->>'name',description=item->>'description',updated_at=clock_timestamp() where id=sid;
 end if;
 else
 if item->>'updatedAt' is not null then perform private.exploration_link_conflict(); end if;
 insert into public.exploration_link_skills(id,owner_id,name,description) values(sid,uid,item->>'name',item->>'description');
 end if;
 end loop;
 insert into public.exploration_links(id,owner_id,name,description,graph,node_count,revision,save_id,request_hash)
 values(p_id,uid,btrim(p_content->>'name'),p_content->>'description',jsonb_build_object('nodes',normalized_nodes,'edges',normalized_edges),cardinality(ids),1,p_save_id,request_hash)
 on conflict(id) do update set name=excluded.name,description=excluded.description,graph=excluded.graph,node_count=excluded.node_count,
 revision=exploration_links.revision+1,save_id=excluded.save_id,request_hash=excluded.request_hash,updated_at=clock_timestamp() returning * into v;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'updatedAt',s.updated_at) order by s.id),'[]'::jsonb)
 into saved_skills from public.exploration_link_skills s where s.owner_id=uid and s.id in (select (e->>'skillId')::uuid from jsonb_array_elements(normalized_edges) e);
 return to_jsonb(v)-'request_hash'||jsonb_build_object('skills',saved_skills);
end $$;
create function public.save_exploration_link(p_id uuid,p_content jsonb,p_expected_revision integer,p_save_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.save_exploration_link(p_id,p_content,p_expected_revision,p_save_id)$$;
revoke all on function private.save_exploration_link(uuid,jsonb,integer,uuid),public.save_exploration_link(uuid,jsonb,integer,uuid) from public,anon;
grant execute on function private.save_exploration_link(uuid,jsonb,integer,uuid),public.save_exploration_link(uuid,jsonb,integer,uuid) to authenticated;

create function private.delete_exploration_link(p_id uuid,p_expected_revision integer) returns void language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare v public.exploration_links;
begin
 if auth.uid() is null or not private.can_manage_exploration() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('exploration-link:'||p_id::text,0));
 select * into v from public.exploration_links where id=p_id for update;
 if not found or v.owner_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501'; end if;
 if v.deleted_at is not null or v.revision is distinct from p_expected_revision then perform private.exploration_link_conflict(); end if;
 update public.exploration_links set deleted_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1,graph='{}',node_count=0 where id=p_id;
end $$;
create function public.delete_exploration_link(p_id uuid,p_expected_revision integer) returns void language sql security invoker set search_path='' as $$select private.delete_exploration_link(p_id,p_expected_revision)$$;
revoke all on function private.delete_exploration_link(uuid,integer),public.delete_exploration_link(uuid,integer) from public,anon;
grant execute on function private.delete_exploration_link(uuid,integer),public.delete_exploration_link(uuid,integer) to authenticated;

create function public.read_exploration_link_page(p_scope text default 'own',p_query text default '',p_page integer default 1,p_excluded uuid[] default '{}',p_local_count integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); total bigint; current_page integer; result jsonb; local_n integer;
begin
 if uid is null or not private.can_manage_exploration() or (p_scope='others' and not(private.is_admin() or private.is_consultant_lead())) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_scope is null or p_scope not in ('own','others') or p_query is null or length(p_query)>200 or p_page is null or p_page not between 1 and 100000 or p_local_count is null or p_local_count not between 0 and 10000 or p_excluded is null or cardinality(p_excluded)>10000 or array_position(p_excluded,null) is not null then raise exception 'Invalid list request' using errcode='22023'; end if;
 local_n:=case when p_scope='own' then p_local_count else 0 end;
 select count(*)+local_n into total from public.exploration_links l where deleted_at is null
 and case when p_scope='own' then owner_id=uid and not(id=any(p_excluded)) else owner_id<>uid end
 and strpos(lower(name||' '||description),lower(p_query))>0;
 current_page:=least(p_page,greatest(1,ceil(total/10.0)::integer));
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
 select l.id,l.owner_id,l.name,l.node_count,l.revision,l.updated_at,p.name as owner_name from public.exploration_links l left join public.profiles p on p.id=l.owner_id
 where l.deleted_at is null and case when p_scope='own' then l.owner_id=uid and not(l.id=any(p_excluded)) else l.owner_id<>uid end
 and strpos(lower(l.name||' '||l.description),lower(p_query))>0 order by l.updated_at desc,l.id
 limit greatest(0,10-greatest(0,local_n-(current_page-1)*10)) offset greatest(0,(current_page-1)*10-local_n)
 ) x;
 return jsonb_build_object('items',result,'total',total,'page',current_page);
end $$;
revoke all on function public.read_exploration_link_page(text,text,integer,uuid[],integer) from public,anon;
grant execute on function public.read_exploration_link_page(text,text,integer,uuid[],integer) to authenticated;
