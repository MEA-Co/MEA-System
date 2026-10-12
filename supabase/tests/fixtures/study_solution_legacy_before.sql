begin;
create temporary table study_rehearsal_ids as select gen_random_uuid() as owner_id, gen_random_uuid() as id, gen_random_uuid() as deleted_id;
insert into auth.users(id) select owner_id from study_rehearsal_ids;
insert into public.profiles(id,role,name) select owner_id,'consultant','마이그레이션 가상 데이터' from study_rehearsal_ids;
insert into public.study(id,owner_id,values,reports,save_id)
select id,owner_id,'{"problemSource":"student","problem":"기존 경험 서술 원문","checklist":"첫 줄\n둘째 줄","practicePeriod":"2주","resultDiagnosis":"기존 진단","references":[{"title":"보존 자료"}]}', '[{"path":"legacy-file.pdf"}]',gen_random_uuid() from study_rehearsal_ids;
insert into public.study(id,owner_id,values,reports,save_id,deleted_at)
select deleted_id,owner_id,'{}','[]',gen_random_uuid(),now() from study_rehearsal_ids;
