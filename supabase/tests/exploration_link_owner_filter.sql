-- Run inside a transaction after the owner-filter migration; caller rolls back.
create temporary table owner_filter_users(id uuid, role text);
insert into owner_filter_users select gen_random_uuid(),r from unnest(array['consultant','other','consultant_lead','admin','student']) r;
insert into auth.users(id) select id from owner_filter_users;
insert into public.profiles(id,role,name,student_period)
select id,case when role='other' then 'consultant' else role end,'동명이인',case when role='student' then '1학년 1학기' end from owner_filter_users;
insert into public.exploration_links(id,owner_id,name,description,graph,node_count,revision,save_id,request_hash,deleted_at)
select gen_random_uuid(),u.id,'owner-filter-fixture '||n,'연계','{}',0,1,gen_random_uuid(),'fixture',case when n=13 then now() end
from owner_filter_users u cross join generate_series(1,13) n where role in ('consultant','other','admin','consultant_lead');
grant select on owner_filter_users to authenticated;
set local role authenticated;
do $$
declare u record; target uuid; r jsonb; people jsonb;
begin
 select id into target from owner_filter_users where role='consultant';
 for u in select * from owner_filter_users loop
  perform set_config('request.jwt.claim.sub',u.id::text,true);
  if u.role in ('admin','consultant_lead') then
   r:=public.read_exploration_link_page('others','owner-filter-fixture',2,'{}',0,target);
   if (r->>'total')::int<>12 or jsonb_array_length(r->'items')<>2 or exists(select 1 from jsonb_array_elements(r->'items') x where x->>'owner_id'<>target::text) then raise exception 'Owner pagination failed'; end if;
   if (public.read_exploration_link_page('others','no-match',1,'{}',0,target)->>'total')::int<>0 then raise exception 'Search failed'; end if;
   if (public.read_exploration_link_page('others','',1,'{}',0,u.id)->>'total')::int<>0 then raise exception 'Own included in others'; end if;
   people:=public.read_exploration_link_people();
   if not exists(select 1 from jsonb_array_elements(people) x where x->>'id'=target::text and (x->>'count')::int=12) or exists(select 1 from jsonb_array_elements(people) x where x->>'id'=u.id::text) then raise exception 'People aggregation failed'; end if;
   if (public.read_exploration_link_page('own','owner-filter-fixture',1,'{}',0,target)->>'total')::int<>12 then raise exception 'Owner leaked into own scope'; end if;
  else
   begin perform public.read_exploration_link_people(); raise exception 'People permission bypass'; exception when insufficient_privilege then null; end;
   begin perform public.read_exploration_link_page('others','',1,'{}',0,target); raise exception 'Page permission bypass'; exception when insufficient_privilege then null; end;
  end if;
 end loop;
 perform set_config('request.jwt.claim.sub',target::text,true);
 if (public.read_exploration_link_page('own','owner-filter-fixture',2,'{}',0)->>'total')::int<>12 then raise exception 'Legacy signature failed'; end if;
 if (public.read_exploration_link_page('own','owner-filter-fixture',1,'{}',12)->>'total')::int<>24 then raise exception 'Draft merge failed'; end if;
end $$;
reset role;
