begin;
create temporary table import_test_users as select gen_random_uuid() id, role from unnest(array['consultant_lead','other_lead','consultant','admin']) role;
insert into auth.users(id) select id from import_test_users;
insert into public.profiles(id,role,name) select id,case when role='other_lead' then 'consultant_lead' else role end,'이전 검증' from import_test_users;
grant select on import_test_users to authenticated;
create function pg_temp.legacy_fixture(p_id uuid default gen_random_uuid()) returns uuid language plpgsql as $$
declare pid uuid:=gen_random_uuid(); vid uuid:=p_id; sid uuid; qid uuid; owner_id uuid; i int; j int;
begin
 select id into owner_id from import_test_users where role='consultant_lead';
 insert into public.questionnaires(id,created_by) values(pid,owner_id);
 insert into public.questionnaire_versions(id,questionnaire_id,title,revision) values(vid,pid,'멘토 초기 프로필',4);
 for i in 0..2 loop
   sid:=gen_random_uuid();
   insert into public.questionnaire_sections(id,version_id,title,position) values(sid,vid,'섹션 '||i,i*2);
   if i=2 then continue; end if;
   for j in 0..7 loop
     qid:=gen_random_uuid();
     -- Duplicated text and leading/trailing whitespace must not be merged or trimmed.
     insert into public.questionnaire_questions(id,version_id,section_id,body,position)
       values(qid,vid,sid,E'  질문 원문\n줄바꿈  ',j*2);
     insert into public.questionnaire_question_details(id,question_id,title,body,position,visible_to_consultants,created_by)
       values(gen_random_uuid(),qid,'공개 설명',E'  공개 본문\n다음 줄  ',0,true,owner_id),
             (gen_random_uuid(),qid,'의도','비공개 본문',3,false,owner_id);
   end loop;
 end loop;
 update public.questionnaire_versions set status='published',published_at=now() where id=vid;
 return vid;
end $$;
create temporary table import_test_results(source_id uuid,target_id uuid);
grant select on import_test_results to authenticated;

do $$
declare vid uuid:=pg_temp.legacy_fixture(); result jsonb; again jsonb; ledger private.legacy_questionnaire_imports%rowtype; m jsonb; q public.questions%rowtype; oldq public.questionnaire_questions%rowtype; target public.questionnaire_questions%rowtype; total int;
begin
 result:=private.import_legacy_text_questionnaire(vid,16);
 if result->>'status'<>'imported' or result->>'questions'<>'16' or result->>'sections'<>'3' or result->>'details'<>'32' then raise exception 'Import summary incorrect: %',result; end if;
 select * into ledger from private.legacy_questionnaire_imports where source_version_id=vid;
 if (select status from public.questionnaire_versions where id=vid)<>'published' then raise exception 'Original status changed'; end if;
 if (select status from public.questionnaire_versions where id=ledger.target_version_id)<>'draft' then raise exception 'Target was not a draft'; end if;
 if (select title from public.questionnaire_versions where id=ledger.target_version_id)<>'멘토 초기 프로필 · 전환본' then raise exception 'Target title incorrect'; end if;
 if (select created_by from public.questionnaires where id=ledger.target_questionnaire_id)<>ledger.source_owner_id then raise exception 'Ownership lost'; end if;
 for m in select value from jsonb_array_elements(ledger.mappings->'questions') loop
   select * into oldq from public.questionnaire_questions where id=(m->>'sourceQuestionId')::uuid;
   select * into q from public.questions where id=(m->>'targetQuestionId')::uuid;
   select * into target from public.questionnaire_questions where id=(m->>'targetPlacementId')::uuid;
   if oldq.source_question_id is not null or oldq.body<>q.prompt or q.prompt<>target.body then raise exception 'Text not preserved'; end if;
   if q.row_mode<>'single' or jsonb_array_length(q.fields)<>1 or q.fields#>>'{0,kind}'<>'text' or q.fields#>>'{0,id}'<>m->>'targetFieldId' then raise exception 'Text field mapping incorrect'; end if;
   if q.condition is not null or q.source_block_id is not null or q.after_block_id is not null then raise exception 'Invented relationships'; end if;
   if q.created_by<>ledger.source_owner_id or target.source_question_id<>q.id or target.version_id<>ledger.target_version_id or target.position<>oldq.position then raise exception 'Placement or ownership mismatch'; end if;
 end loop;
 for m in select value from jsonb_array_elements(ledger.mappings->'sections') loop
   if (select jsonb_build_array(title,position) from public.questionnaire_sections where id=(m->>'sourceSectionId')::uuid)
     is distinct from (select jsonb_build_array(title,position) from public.questionnaire_sections where id=(m->>'targetSectionId')::uuid) then raise exception 'Section order changed'; end if;
 end loop;
 for m in select value from jsonb_array_elements(ledger.mappings->'details') loop
   if (select jsonb_build_array(title,body,visible_to_consultants) from public.questionnaire_question_details where id=(m->>'sourceDetailId')::uuid)
     is distinct from (select jsonb_build_array(title,body,visible_to_consultants) from public.question_details where id=(m->>'targetDetailId')::uuid) then raise exception 'Explanation content/visibility changed'; end if;
 end loop;
 select count(*) into total from public.questions;
 again:=private.import_legacy_text_questionnaire(vid,16);
 if again->>'status'<>'already_imported' or again->>'targetVersionId'<>result->>'targetVersionId' or (select count(*) from public.questions)<>total then raise exception 'Retry duplicated data'; end if;
 -- Editing the imported draft must never be overwritten by a retry.
 update public.questionnaire_versions set title='새 초안 수정',revision=revision+1 where id=ledger.target_version_id;
 perform private.import_legacy_text_questionnaire(vid,16);
 if (select title from public.questionnaire_versions where id=ledger.target_version_id)<>'새 초안 수정' then raise exception 'Retry overwrote edits'; end if;
 insert into import_test_results values(vid,ledger.target_version_id);
end $$;

-- Preconditions fail before copying any data. Each failure is fully atomic.
do $$
declare vid uuid; result jsonb; before_count int; uid uuid; qid uuid;
begin
 vid:=pg_temp.legacy_fixture();
 select count(*) into before_count from public.questions;
 begin perform private.import_legacy_text_questionnaire(vid,15); raise exception 'Wrong source count accepted'; exception when invalid_parameter_value then null; end;
 select id into qid from public.questionnaire_questions where version_id=vid limit 1;
 update public.questionnaire_questions set body=repeat('가',10001) where id=qid;
 begin perform private.import_legacy_text_questionnaire(vid,16); raise exception 'Oversized text accepted'; exception when invalid_parameter_value then null; end;
 update public.questionnaire_questions set body='본문',kind='scale' where id=qid;
 begin perform private.import_legacy_text_questionnaire(vid,16); raise exception 'Typed question accepted'; exception when invalid_parameter_value then null; end;
 update public.questionnaire_questions set kind='text' where id=qid;
 update public.questionnaire_question_details set title=repeat('가',201) where question_id=qid;
 begin perform private.import_legacy_text_questionnaire(vid,16); raise exception 'Oversized explanation title accepted'; exception when invalid_parameter_value then null; end;
 update public.questionnaire_question_details set title='설명' where question_id=qid;
 select id into uid from import_test_users where role='consultant';
 insert into public.questionnaire_responses(id,version_id,respondent_id,assigned_by) values(gen_random_uuid(),vid,uid,uid);
 begin perform private.import_legacy_text_questionnaire(vid,16); raise exception 'Source responses accepted'; exception when object_not_in_prerequisite_state then null; end;
 if (select count(*) from public.questions)<>before_count or exists(select 1 from private.legacy_questionnaire_imports where source_version_id=vid) then raise exception 'Failed import left partial data'; end if;
end $$;

-- Late failures after inserts roll back questions, placements, explanations and ledger.
create function pg_temp.reject_import_ledger() returns trigger language plpgsql as $$ begin raise exception 'Simulated import failure' using errcode='P0001'; end $$;
create trigger test_reject_import before insert on private.legacy_questionnaire_imports for each row execute function pg_temp.reject_import_ledger();
do $$ declare vid uuid:=pg_temp.legacy_fixture(); count_before bigint; parents_before bigint; begin
 select count(*) into count_before from public.questions;
 select count(*) into parents_before from public.questionnaires;
 begin perform private.import_legacy_text_questionnaire(vid,16); raise exception 'Test trigger did not run' using errcode='XX000'; exception when raise_exception then null; end;
 if (select count(*) from public.questions)<>count_before or (select count(*) from public.questionnaires)<>parents_before then raise exception 'Late failure was not atomic'; end if;
end $$;
drop trigger test_reject_import on private.legacy_questionnaire_imports;

-- Normal app users (including actual admins) cannot invoke the operator importer/ledger.
select set_config('request.jwt.claim.sub',(select id::text from import_test_users where role='admin'),true);
set local role authenticated;
do $$ begin
 begin perform private.import_legacy_text_questionnaire((select source_id from import_test_results),16); raise exception 'Authenticated import allowed'; exception when insufficient_privilege then null; end;
 begin perform 1 from private.legacy_questionnaire_imports; raise exception 'Authenticated ledger read allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform private.import_legacy_text_questionnaire(gen_random_uuid(),16); raise exception 'Anonymous import allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Only original owner can open/edit the new draft; regular published read is not used.
select set_config('request.jwt.claim.sub',(select id::text from import_test_users where role='consultant_lead'),true);
set local role authenticated;
do $$ declare doc jsonb; begin
 doc:=public.read_questionnaire_draft((select target_id from import_test_results));
 if doc is null or jsonb_array_length(doc->'sections')<>3 then raise exception 'Owner cannot open imported draft'; end if;
 perform public.save_questionnaire_draft(doc-'revision'-'savedAt',(doc->>'revision')::int,gen_random_uuid());
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from import_test_users where role='other_lead'),true);
set local role authenticated;
do $$ begin
 if public.read_questionnaire_draft((select target_id from import_test_results)) is not null then raise exception 'Another lead could open owner draft'; end if;
end $$;
reset role;
rollback;
