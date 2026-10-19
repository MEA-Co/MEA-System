begin;
create temporary table link_users(id uuid,role text);
insert into link_users select gen_random_uuid(),r from unnest(array['consultant','other','consultant_lead','admin','student']) r;
insert into auth.users(id) select id from link_users;
insert into public.profiles(id,role,name,student_period) select id,case when role='other' then 'consultant' else role end,'Link test',case when role='student' then '1학년 1학기' end from link_users;
create temporary table link_fixture as select gen_random_uuid() id,gen_random_uuid() skill_id,gen_random_uuid() save_id,(select id from link_users where role='consultant') owner_id;
create temporary table link_activities as select gen_random_uuid() id,n from generate_series(1,3) n;
insert into public.exploration(id,owner_id,values,reports,revision,save_id)
select a.id,f.owner_id,jsonb_build_object('topic','활동 '||a.n),'[]',1,gen_random_uuid() from link_activities a cross join link_fixture f;
grant select on link_users,link_fixture,link_activities to authenticated;
set local role authenticated;
do $$
declare f record; content jsonb; result jsonb; retried jsonb; a uuid; b uuid; c uuid; other_id uuid; role_name text; changed jsonb; detail text;
begin
 select * into f from link_fixture;
 select id into a from link_activities where n=1; select id into b from link_activities where n=2; select id into c from link_activities where n=3;
 content:=jsonb_build_object('name','줄기','description','','graph',jsonb_build_object('nodes',jsonb_build_array(jsonb_build_object('explorationId',a,'title','spoofed','position','{}'::jsonb),jsonb_build_object('explorationId',b,'title','b'),jsonb_build_object('explorationId',c,'title','isolated')),'edges',jsonb_build_array(jsonb_build_object('from',a,'to',b,'skillId',f.skill_id)),'skills',jsonb_build_array(jsonb_build_object('id',f.skill_id,'name','분석','description','근거 비교'))));
 perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
 begin perform public.save_exploration_link(f.id,content #- '{graph,edges,0,skillId}',0,f.save_id); raise exception 'Unassigned skill accepted'; exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.exploration_links where id=f.id) then raise exception 'Missing skill partially saved'; end if;
 result:=public.save_exploration_link(f.id,content,0,f.save_id);
 if result->>'revision'<>'1' or jsonb_array_length(result#>'{graph,nodes}')<>2 or result#>>'{graph,nodes,0,title}'<>'활동 1' or result#>'{graph,nodes,0,position}' is not null then raise exception 'Normalization failed'; end if;
 retried:=public.save_exploration_link(f.id,content,0,f.save_id);
 if retried<>result then raise exception 'Idempotency failed'; end if;
 if (public.read_exploration_link_page()->>'total')::int<>1 then raise exception 'List missing'; end if;
 if public.read_exploration_link_page()#>'{items,0,graph}' is not null then raise exception 'List exposes graph'; end if;
 begin perform public.save_exploration_link(f.id,content,0,gen_random_uuid()); raise exception 'Stale accepted'; exception when sqlstate 'PGRST' then get stacked diagnostics detail=pg_exception_detail; if detail::jsonb->>'status'<>'409' then raise exception 'Wrong transport'; end if; end;
 begin perform public.save_exploration_link(f.id,jsonb_set(content,'{name}','"changed"'),1,f.save_id); raise exception 'Reused save ID accepted'; exception when sqlstate 'PGRST' then null; end;
 changed:=jsonb_set(content,'{graph,edges}',(content#>'{graph,edges}')||jsonb_build_array(jsonb_build_object('from',b,'to',a,'skillId',f.skill_id)));
 begin perform public.save_exploration_link(f.id,changed,1,gen_random_uuid()); raise exception 'Cycle accepted'; exception when invalid_parameter_value then null; end;
 changed:=jsonb_set(content,'{graph,skills,0,description}','""');
 begin perform public.save_exploration_link(f.id,changed,1,gen_random_uuid()); raise exception 'Blank skill accepted'; exception when invalid_parameter_value then null; end;
 begin update public.exploration_links set name='direct' where id=f.id; raise exception 'Direct write accepted'; exception when insufficient_privilege then null; end;
 for other_id,role_name in select id,role from link_users where id<>f.owner_id loop
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 if exists(select 1 from public.exploration_links where id=f.id)<>(role_name in ('admin','consultant_lead')) then raise exception 'Bad link RLS for %',role_name; end if;
 if exists(select 1 from public.exploration_link_skills where id=f.skill_id)<>(role_name in ('admin','consultant_lead')) then raise exception 'Bad skill RLS'; end if;
 begin perform public.save_exploration_link(f.id,content,1,gen_random_uuid()); raise exception 'Cross-owner write'; exception when insufficient_privilege then null; end;
 begin perform public.delete_exploration_link(f.id,1); raise exception 'Cross-owner delete'; exception when insufficient_privilege then null; end;
 end loop;
 perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
 -- Pagination merges draft metadata without returning whole graphs.
 if (public.read_exploration_link_page('own','',1,array[f.id],12)->>'total')::int<>12
 or jsonb_array_length(public.read_exploration_link_page('own','',1,array[f.id],12)->'items')<>0
 then raise exception 'Local merge failed'; end if;
 begin perform public.save_exploration_link(gen_random_uuid(),jsonb_set(content,'{graph,nodes,0,explorationId}',to_jsonb(gen_random_uuid())),0,gen_random_uuid()); raise exception 'Dangling edge accepted'; exception when invalid_parameter_value then null; end;
 -- Reuse an existing skill in a different link, no duplicate skill rows.
 content:=jsonb_set(content,'{graph,skills}',result->'skills');
 retried:=public.save_exploration_link(gen_random_uuid(),content,0,gen_random_uuid());
 if (select count(*) from public.exploration_link_skills where owner_id=f.owner_id)<>1 then raise exception 'Reuse duplicated skill'; end if;
 changed:=jsonb_set(content,'{graph,skills,0,name}','"수정된 스킬"');
 result:=public.save_exploration_link(f.id,changed,1,gen_random_uuid());
 if result->>'revision'<>'2' then raise exception 'Update failed'; end if;
 begin perform public.save_exploration_link((retried->>'id')::uuid,content,1,gen_random_uuid()); raise exception 'Stale skill overwrite'; exception when sqlstate 'PGRST' then null; end;
 if (select revision from public.exploration_links where id=(retried->>'id')::uuid)<>1 then raise exception 'Conflict partially committed'; end if;
 perform public.delete_exploration_link(f.id,2);
 if exists(select 1 from public.exploration_links where id=f.id) then raise exception 'Deleted visible'; end if;
 begin perform public.save_exploration_link(f.id,changed,2,gen_random_uuid()); raise exception 'Resurrection'; exception when sqlstate 'PGRST' then null; end;
 if not exists(select 1 from public.exploration_link_skills where id=f.skill_id) then raise exception 'Shared skill deleted'; end if;
end $$;
reset role;
-- No business serialization_failure in the new functions.
do $$begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('save_exploration_link','delete_exploration_link') and pg_get_functiondef(p.oid) ~* 'errcode\s*=\s*''40001''') then raise exception 'Retry SQLSTATE regression'; end if;
 if has_table_privilege('anon','public.exploration_links','SELECT') or has_function_privilege('anon','public.save_exploration_link(uuid,jsonb,integer,uuid)','EXECUTE') then raise exception 'Anonymous access'; end if;
end $$;
rollback;
