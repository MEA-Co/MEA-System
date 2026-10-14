BEGIN;
CREATE TEMP TABLE exploration_query_users AS
 SELECT gen_random_uuid() AS id,role FROM unnest(ARRAY['consultant','consultant_lead','admin','student','other']) role;
INSERT INTO auth.users(id) SELECT id FROM exploration_query_users;
INSERT INTO public.profiles(id,role,name,student_period)
 SELECT id,CASE WHEN role='other' THEN 'consultant' ELSE role END,'조회 회귀',
 CASE WHEN role='student' THEN '1학년 1학기' END FROM exploration_query_users;
CREATE TEMP TABLE exploration_query_ids AS
 SELECT gen_random_uuid() AS id,n FROM generate_series(1,25) n;
INSERT INTO public.exploration(id,owner_id,values,save_id,updated_at)
 SELECT i.id,u.id,jsonb_build_object('topic',CASE WHEN n=1 THEN '국어 %_* [문제]' ELSE '수학 '||n END),gen_random_uuid(),
 '2026-01-01'::timestamptz + n*interval '1 second'
 FROM exploration_query_ids i CROSS JOIN exploration_query_users u WHERE u.role='consultant';
INSERT INTO public.exploration(id,owner_id,values,save_id)
 SELECT gen_random_uuid(),id,'{"topic":"타인"}',gen_random_uuid() FROM exploration_query_users WHERE role='other';
INSERT INTO public.exploration(id,owner_id,values,save_id,deleted_at)
 SELECT gen_random_uuid(),id,'{}',gen_random_uuid(),now() FROM exploration_query_users WHERE role='consultant';
UPDATE public.exploration SET values=values||'{"references":[{"clientKey":"internal-id","title":"참고 도서 DNA","selection":"염기 서열","usage":"문헌 검토"}]}'::jsonb
WHERE id=(SELECT id FROM exploration_query_ids WHERE n=2);
GRANT SELECT ON exploration_query_users,exploration_query_ids TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE u uuid; other_id uuid; r jsonb; x uuid;
BEGIN
 SELECT id INTO u FROM exploration_query_users WHERE role='consultant';
 SELECT id INTO other_id FROM exploration_query_users WHERE role='other';
 SELECT id INTO x FROM exploration_query_ids WHERE n=25;
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 r:=public.read_exploration_page();
 IF (r->>'total')::int<>25 OR jsonb_array_length(r->'activities')<>10
 OR r#>>'{activities,0,id}'<>x::text THEN RAISE EXCEPTION 'own page/order/deleted filter'; END IF;
 r:=public.read_exploration_page(p_page=>999);
 IF r->>'page'<>'3' OR jsonb_array_length(r->'activities')<>5 THEN RAISE EXCEPTION 'page clamp'; END IF;
 r:=public.read_exploration_page(p_excluded=>ARRAY[x],p_local_count=>5);
 IF r->>'total'<>'29' OR jsonb_array_length(r->'activities')<>5
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(r->'activities') a WHERE a->>'id'=x::text)
 THEN RAISE EXCEPTION 'local replacement'; END IF;
 r:=public.read_exploration_page(p_local_count=>12,p_page=>2);
 IF jsonb_array_length(r->'activities')<>8 OR r#>>'{activities,0,id}'<>x::text THEN RAISE EXCEPTION 'mixed boundary'; END IF;
 r:=public.read_exploration_page(p_local_count=>12);
 IF jsonb_array_length(r->'activities')<>0 THEN RAISE EXCEPTION 'draft only page'; END IF;
 r:=public.read_exploration_page(p_query=>'%_* [문제]');
 IF r->>'total'<>'1' THEN RAISE EXCEPTION 'literal search'; END IF;
 r:=public.read_exploration_page(p_query=>'topic');
 IF r->>'total'<>'0' THEN RAISE EXCEPTION 'JSON key leaked into search'; END IF;
 r:=public.read_exploration_page(p_query=>'dna');
 IF r->>'total'<>'1' THEN RAISE EXCEPTION 'case insensitive reference title'; END IF;
 r:=public.read_exploration_page(p_query=>'염기 서열');
 IF r->>'total'<>'1' THEN RAISE EXCEPTION 'reference selection'; END IF;
 r:=public.read_exploration_page(p_query=>'문헌 검토');
 IF r->>'total'<>'1' THEN RAISE EXCEPTION 'reference usage'; END IF;
 r:=public.read_exploration_page(p_query=>'internal-id');
 IF r->>'total'<>'0' THEN RAISE EXCEPTION 'internal reference ID searched'; END IF;
 r:=public.read_exploration_page(p_owner=>other_id);
 IF r->>'total'<>'25' THEN RAISE EXCEPTION 'own author override'; END IF;
 BEGIN PERFORM public.read_exploration_page(p_scope=>'others',p_own_only=>false);
 RAISE EXCEPTION 'consultant escalation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 r:=public.read_exploration_summary(false);
 IF r->>'mine'<>'25' OR r->>'others'<>'0' THEN RAISE EXCEPTION 'summary leakage'; END IF;
 BEGIN PERFORM public.read_exploration_page(p_local_count=>-1);
 RAISE EXCEPTION 'negative accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.read_exploration_page(p_excluded=>ARRAY[NULL::uuid]);
 RAISE EXCEPTION 'null exclusion accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 FOR u IN SELECT id FROM exploration_query_users WHERE role IN ('consultant_lead','admin') LOOP
   PERFORM set_config('request.jwt.claim.sub',u::text,true);
   r:=public.read_exploration_page(p_scope=>'others',p_owner=>other_id,p_own_only=>false,p_local_count=>100,p_excluded=>ARRAY[x]);
   IF r->>'total'<>'1' THEN RAISE EXCEPTION 'staff author filter'; END IF;
   r:=public.read_exploration_summary(false);
   IF (r->>'others')::int<26 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'people') a WHERE a->>'id'=other_id::text AND a->>'count'='1') THEN RAISE EXCEPTION 'grouped summary'; END IF;
   BEGIN PERFORM public.read_exploration_page(p_scope=>'others',p_own_only=>true);
   RAISE EXCEPTION 'preview escape'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 END LOOP;
 SELECT id INTO u FROM exploration_query_users WHERE role='student';
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 BEGIN PERFORM public.read_exploration_page();
 RAISE EXCEPTION 'student read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.read_exploration_summary();
 RAISE EXCEPTION 'student summary'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$
BEGIN
 IF has_function_privilege('anon','public.read_exploration_page(text,integer,text,uuid,uuid[],integer,boolean)','execute')
 OR has_function_privilege('anon','public.read_exploration_summary(boolean)','execute')
 OR EXISTS(SELECT 1 FROM pg_proc WHERE oid IN ('public.read_exploration_page(text,integer,text,uuid,uuid[],integer,boolean)'::regprocedure,'public.read_exploration_summary(boolean)'::regprocedure) AND prosecdef)
 THEN RAISE EXCEPTION 'function privilege regression'; END IF;
END $$;
ROLLBACK;
