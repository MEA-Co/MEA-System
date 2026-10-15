-- Terminology only: former published -> in_review, former distributed -> published.
-- Apply with questionnaire traffic paused and deploy the workflow-v2 app before reopening.
-- Historical migrations stay unchanged. Fail closed if the expected function contract drifted.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
set local search_path = public, private, pg_catalog;

lock table public.questionnaires, public.questions, public.question_details,
 public.questionnaire_sections, public.questionnaire_questions, public.response_sessions,
 public.question_responses, public.response_submissions, public.questionnaire_publication_reads,
 public.question_review_requests, public.question_review_reads,
 private.questionnaire_status_requests in access exclusive mode;

create temporary table workflow_tokens(old_name text, new_name text) on commit drop;
insert into workflow_tokens values
('Distributed','Published'),
('Published','Review'),
('a_distributed_question_detail_lock','a_published_question_detail_lock'),
('a_distributed_question_lock','a_published_question_lock'),
('assert_distributed_question_access','assert_published_question_access'),
('assert_distributed_response_access','assert_published_response_access'),
('assert_published_response_access','assert_review_response_access'),
('can_edit_published_question','can_edit_review_question'),
('can_read_distributed_questionnaire','can_read_published_questionnaire'),
('distribute','publish'),
('distribute_questionnaire','publish_questionnaire'),
('distributed','published'),
('distributed_at','published_at'),
('distributed_response_definition','published_response_definition'),
('distributed_response_statuses','published_response_statuses'),
('distributed_submission_counts','published_submission_counts'),
('distribution','publication'),
('distribution_locked_at','publication_locked_at'),
('guard_distributed_question','guard_published_question'),
('guard_distributed_question_detail','guard_published_question_detail'),
('guard_published_version','guard_published_questionnaire'),
('has_saved_distribution_responses','has_saved_publication_responses'),
('list_my_published_responses','list_my_review_responses'),
('mark_questionnaire_publication_read','mark_questionnaire_review_read'),
('notify_distributed','notify_published'),
('open_distributed_question_response_session','open_published_question_response_session'),
('open_distributed_response','open_published_response'),
('open_question_response_session','open_review_response_session'),
('owned_distributed_question_session','owned_published_question_session'),
('owned_published_session','owned_review_session'),
('publication','review'),
('publish','start_review'),
('publish_questionnaire','start_questionnaire_review'),
('published','in_review'),
('published_at','review_started_at'),
('published_questionnaire_authors','shared_questionnaire_authors'),
('questionnaire_publication_read_changed','questionnaire_review_read_changed'),
('questionnaire_publication_reads','questionnaire_review_reads'),
('questionnaire_publication_reads_pkey','questionnaire_review_reads_pkey'),
('questionnaire_publication_reads_questionnaire_id_fkey','questionnaire_review_reads_questionnaire_id_fkey'),
('questionnaire_publication_reads_questionnaire_idx','questionnaire_review_reads_questionnaire_idx'),
('questionnaire_publication_reads_user_id_fkey','questionnaire_review_reads_user_id_fkey'),
('questionnaires_distributed_check','questionnaires_published_check'),
('questionnaires_published_check','questionnaires_review_started_check'),
('read_distributed_question_response_session','read_published_question_response_session'),
('read_distributed_response','read_published_response'),
('read_published_question_sources','read_shared_question_sources'),
('read_published_questionnaire','read_shared_questionnaire'),
('read_question_response_session','read_review_response_session'),
('redistribution','republication'),
('remove_archived_published_answers','remove_archived_review_answers'),
('save_distributed_question_response_session','save_published_question_response_session'),
('save_distributed_response','save_published_response'),
('save_question_response_session','save_review_response_session'),
('sync_published_response_layout','sync_review_response_layout'),
('unread_distributed_questionnaires','unread_published_questionnaires'),
('unread_questionnaire_publications','unread_questionnaire_reviews');

create function pg_temp.workflow_name(source text) returns text language plpgsql as $$
declare r record; i integer := 0; result text := source;
begin
 for r in select * from workflow_tokens order by old_name loop
  i := i + 1;
  result := regexp_replace(result, '\m' || r.old_name || '\M', '__workflow_token_' || i || '__', 'g');
 end loop;
 i := 0;
 for r in select * from workflow_tokens order by old_name loop
  i := i + 1;
  result := replace(result, '__workflow_token_' || i || '__', r.new_name);
 end loop;
 return result;
end $$;

create temporary table workflow_functions(schema_name text, old_name text, args text, expected_hash text,
 function_oid oid, definition text, original_acl aclitem[]) on commit drop;
insert into workflow_functions(schema_name,old_name,args,expected_hash) values
('private','assert_distributed_question_access','qid uuid','11a879e0befeccfbf0f722df741e4d73'),
('private','assert_distributed_response_access','p_questionnaire_id uuid','d92b19df96caebc5f73905389f546d22'),
('private','assert_published_response_access','p_questionnaire_id uuid','f96d719b84b8f41f05bef349e430a66b'),
('private','can_edit_published_question','qid uuid','aa810839bf1c555d155591467ab9dc5d'),
('private','can_read_distributed_questionnaire','p_questionnaire_id uuid','b19d60562177ba5940515df05c01086a'),
('private','can_read_question_reviews','qid uuid','7790d2332fd100c53cd115bba159bea3'),
('private','can_request_question_review','qid uuid, origin_id uuid','f8d5e0a67ec2348cf099f585a9b56d31'),
('private','change_questionnaire_status','p_questionnaire_id uuid, p_expected_revision integer, p_expected_status text, p_expected_archived_at timestamp with time zone, p_status text, p_request_id uuid','4e3de316e520642cbd9684188c7c976a'),
('private','delete_questionnaire','p_questionnaire_id uuid, p_expected_revision integer','218c2f1f8a61c77fe0dcab66b015fef6'),
('private','distribute_questionnaire','p_questionnaire_id uuid, p_expected_revision integer','c962efea6c66963ffc1d1740c3b168d0'),
('private','distributed_response_definition','qid uuid','46545e7583395e3e221c672d8fe0ea74'),
('private','distributed_submission_counts','','f15ab46d37549f583c5483424a93bd9a'),
('private','guard_distributed_question','','11097954a95156425e8d097e7c5cceb4'),
('private','guard_distributed_question_detail','','0779e5f1a61470fd570ef040a2d2fbb9'),
('private','guard_question_private_sources','','b2e03d15b95e348e1d270ce70176a735'),
('private','guard_question_response_identity','','18c9cb2dedb271024fad3dce45ba45e7'),
('private','guard_questionnaire_choices_ready','','d560b263d43ad5ac788590506df12c3d'),
('private','guard_questionnaire_content','','9cfedaa9ba1912def40cb3cf060cf177'),
('private','guard_questionnaire_placement_publication','','616f23df5b934b1b0be2b71a9c392c95'),
('private','guard_start_notice','','8f95ee44816b572b4f81adb17afa300f'),
('private','guide_answer_field_ids','qid uuid','e2b18e06216e626f239f440413a5d5ea'),
('private','guide_exploration_ids','','ea8ecb5790407e9a091261470445216f'),
('private','guide_study_ids','','f4f000c7555e35e442a27e3115ebcc9e'),
('private','has_saved_distribution_responses','p_questionnaire_id uuid','041657b96faaabd211aec0be38c72e1a'),
('private','list_submitted_questionnaire_responses','qid uuid','774e3cd08f9d6297a089b5cea3291998'),
('private','notify_questionnaire_change','','98384d0c68e0a0861d87f6f187f42938'),
('private','open_distributed_question_response_session','p_questionnaire_id uuid','86b87e42924d9aa69120423125080eef'),
('private','open_distributed_response','p_questionnaire_id uuid','ce98cd938110f7d62e252c6828f30225'),
('private','open_question_response_session','p_questionnaire_id uuid','6a79bf793aa4fbb200dda88f0b300947'),
('private','open_questionnaire_response','p_questionnaire_id uuid','6bdad183b46a74f9a3f43082af6c69de'),
('private','owned_distributed_question_session','qid uuid','9b6afa838d79747c007e853e7ba4e61d'),
('private','owned_published_session','target uuid','fa9cd77cad09309ea2d9a26ccfc2b265'),
('private','publish_questionnaire','p_questionnaire_id uuid, p_expected_revision integer','78fa5aa9bcf896d1322fc35417d207a9'),
('private','published_questionnaire_authors','','ac8b3f359e7762db68fff1c21f333564'),
('private','question_review_counts','','20b5703654636b702450d6802a60ffe3'),
('private','questionnaire_guide_question_ids','qid uuid','fa7a9356416cf195b2e95d6bc7466873'),
('private','read_distributed_question_response_session','p_questionnaire_id uuid','6c73665026ef5478ab9efcfaaf8cfd6e'),
('private','read_distributed_response','p_questionnaire_id uuid','d31c619db8c63bf6eca67fe6beb8d13c'),
('private','read_guide_answers','p_question_ids uuid[]','c2c34c19909dc78262712ab2886a70c2'),
('private','read_published_question_sources','p_questionnaire_id uuid','90985b9b3073d6270a117392f2a5eed7'),
('private','read_question_response_session','p_questionnaire_id uuid','f042a0a48b559960cfe6d870c6baf878'),
('private','read_question_reviews','qid uuid','7d68815e91fea1820fd89bc5eecb4515'),
('private','reconcile_guide_fields','qid uuid, old_fields jsonb','30ec98cc2d0d10b95e890aee76b204c0'),
('private','remove_archived_published_answers','','38a693450889c35e297cf8b9ff6f1d34'),
('private','remove_unplaced_guide_answers','qid uuid','60d23482d8c6f1a8ca5f99cf27f8f2b3'),
('private','request_question_review','p_id uuid, p_question_id uuid, p_origin_questionnaire_id uuid, p_description text','7789d694344726630f20cee7d522247e'),
('private','save_distributed_question_response_session','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text','8a1c62e786b7a177d5c402c9b11e27eb'),
('private','save_distributed_response','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text','c9fe74c34386e4409cdf073ce5e627f7'),
('private','save_question','p_document jsonb, p_expected_revision integer, p_save_id uuid','dbf1e1ea0d9b3f58ede5e94d66666ab1'),
('private','save_question_response_session','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text','0a43b91b9b8f83171ed91cf15d8eecc6'),
('private','save_questionnaire_draft','p_document jsonb, p_expected_revision integer, p_save_id uuid','b83ec79332fb27aec562c5b200d43405'),
('private','save_questionnaire_response','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean','385b00f32f422b71a1fe1705db7ac626'),
('private','save_questionnaire_response','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text','9d8320ff8aed6f995594f3e6c8026077'),
('private','sync_published_response_layout','target uuid','61968e2293a4d59882c72538072c5349'),
('public','distribute_questionnaire','p_questionnaire_id uuid, p_expected_revision integer','d555b544794fc3f36bca81278c7f4b74'),
('public','distributed_response_statuses','','7f4bb1b85dc63912ec026c10a43a4edf'),
('public','distributed_submission_counts','','ecc46e1e2259e7ce330837b909ba28cc'),
('public','list_my_published_responses','','8e7e401edcd6aa705db29c595ed38899'),
('public','mark_questionnaire_publication_read','p_questionnaire_id uuid','a6f724ed68abb18251e145eb8790c817'),
('public','open_distributed_question_response_session','p_questionnaire_id uuid','261661dcdf91b3e99501a9d064a3adf5'),
('public','open_distributed_response','p_questionnaire_id uuid','250f84f6d1f1a7db8bb5e4e96fec0046'),
('public','open_question_response_session','p_questionnaire_id uuid','8e24b03b619c505e94519c6b4a32bb15'),
('public','publish_questionnaire','p_questionnaire_id uuid, p_expected_revision integer','2c5410f9570d040a673814b3df04f8ea'),
('public','published_questionnaire_authors','','1df10d45f0b775d394e01e17efc549f2'),
('public','read_distributed_question_response_session','p_questionnaire_id uuid','33c63408a9bd6acea134505065a52199'),
('public','read_distributed_response','p_questionnaire_id uuid','5c17c58a863074fa43c6e0daeaed1dac'),
('public','read_published_question_sources','p_questionnaire_id uuid','1f46acb1800a6f4976fbdf45cd9729f0'),
('public','read_published_questionnaire','p_questionnaire_id uuid','68edf08747c58589359528077c6ff4b2'),
('public','read_question_response_session','p_questionnaire_id uuid','d47fad8a8319bd9e72d93bea95a1c0bd'),
('public','read_questionnaire_draft','p_questionnaire_id uuid','14b53beb93ab415551ffb66bd7fe15d1'),
('public','save_distributed_question_response_session','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text','05b4cce0d65393213bf7a074e7559f1a'),
('public','save_distributed_response','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_free_response text','d2bf1271759bccaf768bbebf551f5361'),
('public','save_question_response_session','p_questionnaire_id uuid, p_answers jsonb, p_revision integer, p_save_id uuid, p_complete boolean, p_definition_token text','3d325252701c8ec53f61939ca83cf21b'),
('public','unread_distributed_questionnaires','','982b275b7d1c79850844b0f837734523'),
('public','unread_questionnaire_publications','','4e92f3b2154e5000bfb0c507700f05d8');

do $$ declare r record; target oid; definition text; begin
 for r in select * from workflow_functions loop
  select p.oid into target from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname=r.schema_name and p.proname=r.old_name and pg_get_function_identity_arguments(p.oid)=r.args;
  if target is null then raise exception 'Missing workflow function %.%',r.schema_name,r.old_name; end if;
  definition := pg_get_functiondef(target);
  if md5(definition) <> r.expected_hash then
   raise exception 'Workflow function drift: %.%. Compare prerequisite migrations before applying.',r.schema_name,r.old_name;
  end if;
  update workflow_functions set function_oid=target,definition=pg_get_functiondef(target),
   original_acl=(select proacl from pg_proc where oid=target)
   where schema_name=r.schema_name and old_name=r.old_name and args=r.args;
 end loop;
 if exists(select 1 from public.response_sessions where started_stage not in ('published','distributed')) then
  raise exception 'Unexpected response stage: manual preservation migration required';
 end if;
end $$;

-- Compare sorted row checksums, including row counts, without copying answer bodies.
create temporary table workflow_v2_data(table_name text primary key, expected jsonb) on commit drop;
create function pg_temp.workflow_checksum(target regclass, expression text default 'to_jsonb(t)') returns jsonb
 language plpgsql as $$ declare result jsonb; begin
 execute format($query$select jsonb_build_array(count(*),md5(coalesce(string_agg(h,'' order by h),''))) from (select md5((%s)::text) h from %s t) rows$query$,expression,target) into result;
 return result;
end $$;
do $$ declare t text; expression text; begin
 foreach t in array array['public.questionnaires','public.questions','public.response_sessions','public.questionnaire_sections',
  'public.questionnaire_questions','public.question_details','public.question_responses','public.response_submissions',
  'public.questionnaire_publication_reads','public.question_review_requests','public.question_review_reads',
  'private.questionnaire_status_requests'] loop
  expression := case t
   when 'public.questionnaires' then $expr$(to_jsonb(t)-'published_at'-'distributed_at')||jsonb_build_object(
    'review_started_at',t.published_at,'published_at',t.distributed_at,
    'status',case t.status when 'published' then 'in_review' when 'distributed' then 'published' else t.status end)$expr$
   when 'public.questions' then $expr$(to_jsonb(t)-'distribution_locked_at')||jsonb_build_object('publication_locked_at',t.distribution_locked_at)$expr$
   when 'public.response_sessions' then $expr$to_jsonb(t)||jsonb_build_object('started_stage',case t.started_stage when 'published' then 'in_review' when 'distributed' then 'published' else t.started_stage end)$expr$
   else 'to_jsonb(t)' end;
  insert into workflow_v2_data values(t,pg_temp.workflow_checksum(t::regclass,expression));
 end loop;
end $$;

create temporary table workflow_triggers on commit drop as
 select tgrelid, tgname, tgenabled from pg_trigger
 where tgrelid in ('public.questionnaires'::regclass,'public.response_sessions'::regclass) and not tgisinternal;
alter table public.questionnaires disable trigger user;
alter table public.response_sessions disable trigger user;
alter table public.questionnaires drop constraint questionnaires_status_check,
 drop constraint questionnaires_published_check, drop constraint questionnaires_distributed_check;

-- CASE evaluates the old value once; there is no intermediate published value collision.
update public.questionnaires set status=case status when 'published' then 'in_review' when 'distributed' then 'published' else status end;
update public.response_sessions set started_stage=case started_stage when 'published' then 'in_review' when 'distributed' then 'published' else started_stage end;
alter table public.questionnaires rename column published_at to review_started_at;
alter table public.questionnaires rename column distributed_at to published_at;
alter table public.questions rename column distribution_locked_at to publication_locked_at;
alter table public.questionnaire_publication_reads rename to questionnaire_review_reads;
alter table public.questionnaire_review_reads rename constraint questionnaire_publication_reads_pkey to questionnaire_review_reads_pkey;
alter table public.questionnaire_review_reads rename constraint questionnaire_publication_reads_questionnaire_id_fkey to questionnaire_review_reads_questionnaire_id_fkey;
alter table public.questionnaire_review_reads rename constraint questionnaire_publication_reads_user_id_fkey to questionnaire_review_reads_user_id_fkey;
alter index public.questionnaire_publication_reads_questionnaire_idx rename to questionnaire_review_reads_questionnaire_idx;
alter table public.questionnaires add constraint questionnaires_status_check check(status in ('draft','in_review','published')),
 add constraint questionnaires_review_started_check check((status in ('in_review','published'))=(review_started_at is not null)),
 add constraint questionnaires_published_check check((status='published')=(published_at is not null));
alter table public.response_sessions add constraint response_sessions_started_stage_check check(started_stage in ('in_review','published'));

-- Preserve function OIDs, ownership, security modes, search_path, and EXECUTE grants.
-- Temporary names avoid collisions (old publish_questionnaire versus former distribute_questionnaire).
do $$ declare r record; begin
 for r in select * from workflow_functions where pg_temp.workflow_name(old_name)<>old_name loop
  execute format('alter function %I.%I(%s) rename to %I',r.schema_name,r.old_name,r.args,'workflow_v2_'||r.function_oid);
 end loop;
 for r in select * from workflow_functions where pg_temp.workflow_name(old_name)<>old_name loop
  execute format('alter function %I.%I(%s) rename to %I',r.schema_name,'workflow_v2_'||r.function_oid,r.args,pg_temp.workflow_name(r.old_name));
 end loop;
 -- SQL wrappers may refer to functions defined later in this loop.
 perform set_config('check_function_bodies','off',true);
 for r in select * from workflow_functions loop execute pg_temp.workflow_name(r.definition); end loop;
 perform set_config('check_function_bodies','on',true);
 if exists(select 1 from workflow_functions f join pg_proc p on p.oid=f.function_oid where p.proacl is distinct from f.original_acl) then
  raise exception 'Function ACL changed';
 end if;
end $$;

-- Stored RLS expressions use function OIDs but string literals need explicit conversion.
-- Include Realtime: the consultant channel becomes questionnaires:published.
do $$ declare r record; expression text; begin
 for r in select p.oid,p.polname,p.polrelid,pg_get_expr(p.polqual,p.polrelid) q,pg_get_expr(p.polwithcheck,p.polrelid) c
  from pg_policy p join pg_class t on t.oid=p.polrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname in ('public','realtime') loop
  -- Function and table identifiers have already been renamed by OID. Transform only old state/channel literals here.
  if coalesce(r.q,'')||coalesce(r.c,'') ~ '''published''|''distributed''|questionnaires:distributed' then
   expression := format('alter policy %I on %s',r.polname,r.polrelid::regclass);
   if r.q is not null then expression := expression||' using ('||replace(replace(replace(r.q,'''published''','''in_review'''),'''distributed''','''published'''),'questionnaires:distributed','questionnaires:published')||')'; end if;
   if r.c is not null then expression := expression||' with check ('||replace(replace(replace(r.c,'''published''','''in_review'''),'''distributed''','''published'''),'questionnaires:distributed','questionnaires:published')||')'; end if;
   execute expression;
  end if;
 end loop;
end $$;
alter policy "Read managed or distributed questionnaires" on public.questionnaires rename to "Read managed or published questionnaires";
alter policy "Read own publication receipts" on public.questionnaire_review_reads rename to "Read own review receipts";
alter policy "Record own visible publication" on public.questionnaire_review_reads rename to "Record own visible review";

-- Restore the exact trigger enabled modes before renaming their labels.
do $$ declare r record; action text; begin
 for r in select * from workflow_triggers loop
  action := case r.tgenabled when 'D' then 'disable' when 'R' then 'enable replica' when 'A' then 'enable always' else 'enable' end;
  execute format('alter table %s %s trigger %I',r.tgrelid::regclass,action,r.tgname);
 end loop;
end $$;
alter trigger a_distributed_question_lock on public.questions rename to a_published_question_lock;
alter trigger a_distributed_question_detail_lock on public.question_details rename to a_published_question_detail_lock;
alter trigger guard_published_version on public.questionnaires rename to guard_published_questionnaire;
alter trigger remove_archived_published_answers on public.questions rename to remove_archived_review_answers;
alter trigger questionnaire_publication_read_changed on public.questionnaire_review_reads rename to questionnaire_review_read_changed;

-- Old status payloads cannot be interpreted using the new meaning of published.
-- Old two/six-argument RPC signatures intentionally disappear; no ambiguous aliases.
drop function public.publish_questionnaire(uuid,integer);
create function public.publish_questionnaire(p_questionnaire_id uuid,p_expected_revision integer,p_workflow_version integer)
 returns void language plpgsql set search_path='' as $$ begin
 if p_workflow_version is distinct from 2 then raise exception 'Questionnaire workflow update required' using errcode='22023'; end if;
 perform private.publish_questionnaire(p_questionnaire_id,p_expected_revision);
end $$;
revoke all on function public.publish_questionnaire(uuid,integer,integer) from public,anon;
grant execute on function public.publish_questionnaire(uuid,integer,integer) to authenticated,service_role;

drop function public.change_questionnaire_status(uuid,integer,text,timestamptz,text,uuid);
create function public.change_questionnaire_status(p_questionnaire_id uuid,p_expected_revision integer,p_expected_status text,
 p_expected_archived_at timestamptz,p_status text,p_request_id uuid,p_workflow_version integer)
 returns jsonb language plpgsql set search_path='' as $$ begin
 if p_workflow_version is distinct from 2 then raise exception 'Questionnaire workflow update required' using errcode='22023'; end if;
 return private.change_questionnaire_status(p_questionnaire_id,p_expected_revision,p_expected_status,p_expected_archived_at,p_status,p_request_id);
end $$;
revoke all on function public.change_questionnaire_status(uuid,integer,text,timestamptz,text,uuid,integer) from public,anon;
grant execute on function public.change_questionnaire_status(uuid,integer,text,timestamptz,text,uuid,integer) to authenticated,service_role;

-- Existing command receipts are retained unchanged; pre-upgrade retries conflict safely
-- when their old state fingerprint differs. No answers or user-written JSON is rewritten.
do $$ declare r record; actual jsonb; target regclass; begin
 for r in select * from workflow_v2_data loop
  target := (case r.table_name when 'public.questionnaire_publication_reads' then 'public.questionnaire_review_reads' else r.table_name end)::regclass;
  actual := pg_temp.workflow_checksum(target);
  if actual is distinct from r.expected then raise exception 'Workflow data preservation failed for %',r.table_name; end if;
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
