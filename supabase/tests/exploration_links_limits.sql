-- Bounded worst-depth DAG regression; fixture data is rolled back. Timing is local only.
begin;
create temporary table fixture_owner as select gen_random_uuid() id;
insert into auth.users(id) select id from fixture_owner;
insert into public.profiles(id,role,name) select id,'consultant','Load test' from fixture_owner;
create temporary table fixture_nodes as select gen_random_uuid() id,n from generate_series(1,300) n;
insert into public.exploration(id,owner_id,values,reports,revision,save_id) select n.id,o.id,jsonb_build_object('topic','node '||n.n),'[]',1,gen_random_uuid() from fixture_nodes n cross join fixture_owner o;
grant select on fixture_nodes,fixture_owner to authenticated;
set local role authenticated;
do $$declare c jsonb; started timestamptz; result jsonb; skill_id uuid:=gen_random_uuid(); begin
 perform set_config('request.jwt.claim.sub',(select id::text from fixture_owner),true);
 select jsonb_build_object('name','maximum graph','description','','graph',jsonb_build_object('nodes',(select jsonb_agg(jsonb_build_object('explorationId',id,'title','node')) from fixture_nodes),'edges',(select jsonb_agg(jsonb_build_object('from',e.source,'to',e.target,'skillId',skill_id)) from (select a.id source,b.id target from fixture_nodes a join fixture_nodes b on b.n>a.n order by b.n-a.n,a.n limit 1000) e),'skills',jsonb_build_array(jsonb_build_object('id',skill_id,'name','공유 스킬','description','연계 설명')))) into c;
 started:=clock_timestamp();result:=public.save_exploration_link(gen_random_uuid(),c,0,gen_random_uuid());
 if jsonb_array_length(result#>'{graph,nodes}')<>300 then raise exception 'Maximum graph lost nodes'; end if;
 raise notice '300-node / 1000-edge save duration: %',clock_timestamp()-started;
end $$;
rollback;
