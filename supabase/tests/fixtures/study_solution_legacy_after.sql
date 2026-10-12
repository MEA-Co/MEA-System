do $$ begin
 if not exists(select 1 from public.study s join study_rehearsal_ids i on i.id=s.id
 where s.values->>'problemSource'='self' and s.values->>'periodEnabled'='true' and s.values->>'problemExperience'=''
 and s.values->>'problem'='기존 경험 서술 원문' and s.values->>'checklist'=E'첫 줄\n둘째 줄'
 and s.values->>'resultDiagnosis'='기존 진단' and s.reports='[{"path":"legacy-file.pdf"}]'::jsonb and s.revision=2)
 then raise exception 'Migration preservation failed'; end if;
 if not exists(select 1 from public.study s join study_rehearsal_ids i on i.deleted_id=s.id where s.values='{}' and s.revision=1 and s.deleted_at is not null)
 then raise exception 'Deleted row changed'; end if;
end $$;
rollback;
