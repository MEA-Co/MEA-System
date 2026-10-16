begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Business revision conflicts are not PostgreSQL serialization failures.
-- Keep the legacy HTTP JSON code so deployed clients need no reload/update.
-- Only literal RAISE statements of the reviewed shape are rewritten.
do $migration$
declare
  f record;
  original text;
  patched text;
  hit text[];
  rendered text;
  pattern constant text := $pattern$raise exception ('(?:[^']|'')*') using errcode\s*=\s*'40001'\s*;$pattern$;
  replacement constant text := $replacement$raise sqlstate 'PGRST' using message = pg_catalog.json_build_object('code', '40001', 'message', \1, 'details', null, 'hint', null)::text, detail = '{"status":409,"headers":{}}';$replacement$;
begin
  for f in
    select p.oid, p.proname, p.proacl, p.proowner, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.prokind='f' and p.prosrc ~ $check$errcode\s*=\s*'40001'$check$
  loop
    if f.proname <> all(array[
      'save_question','archive_question','save_question_response_session',
      'save_questionnaire_draft','delete_study','save_study',
      'save_exploration','delete_exploration','distribute_questionnaire',
      'delete_questionnaire','publish_questionnaire','change_questionnaire_status',
      'request_question_review','save_distributed_response',
      'save_distributed_question_response_session','read_submitted_response',
      'start_questionnaire_review','save_published_response','save_review_response_session',
      'save_published_question_response_session'
    ]) then raise exception 'Unreviewed conflict function: %',f.proname; end if;
    original := pg_get_functiondef(f.oid);
    patched := original;
    for hit in select regexp_matches(original,'(' || pattern || ')','gi') loop
      rendered := regexp_replace(hit[1],pattern,replacement,'i');
      -- Exact original text is encoded for pending migration fingerprint checks.
      rendered := rendered || ' /* business-conflict-v1:' ||
        replace(encode(convert_to(hit[1],'UTF8'),'base64'), E'\n','') || ' */';
      patched := replace(patched,hit[1],rendered);
    end loop;
    if patched=original or patched ~ $check$errcode\s*=\s*'40001'$check$ then
      raise exception 'Unreviewed conflict statement: %',f.proname;
    end if;
    execute patched;
    if exists(select from pg_proc p where p.oid=f.oid and
      (p.proacl is distinct from f.proacl or p.proowner<>f.proowner or
       p.prosecdef<>f.prosecdef or p.proconfig is distinct from f.proconfig)) then
      raise exception 'Function permissions changed: %',f.proname;
    end if;
  end loop;
end;
$migration$;
commit;
