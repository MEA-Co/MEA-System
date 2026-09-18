alter table public.questionnaire_responses add column free_response text not null default '' check(length(free_response)<=20000);

create function private.save_questionnaire_response(p_version_id uuid,p_answers jsonb,p_revision integer,p_save_id uuid,p_complete boolean,p_free_response text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; r public.questionnaire_responses%rowtype; payload jsonb; item record;
begin
 if p_save_id is null or p_revision is null or p_revision<0 or p_complete is null
 or length(p_free_response)>20000
 or p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>600000 then
 raise exception 'Invalid answers' using errcode='22023'; end if;
 rid:=private.open_questionnaire_response(p_version_id);
 select * into r from public.questionnaire_responses where id=rid for update;
 payload:=jsonb_build_object('answers',p_answers,'complete',p_complete,'freeResponse',coalesce(p_free_response,r.free_response));
 if r.last_save_id=p_save_id and (r.last_payload || jsonb_build_object('freeResponse',r.free_response))=payload then
 return jsonb_build_object('revision',r.revision,'status',r.status,'savedAt',r.updated_at); end if;
 if r.status='submitted' then raise exception 'Answers are locked' using errcode='55000'; end if;
 if r.revision<>p_revision then raise exception 'Answer conflict' using errcode='40001'; end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>(select count(*) from public.questionnaire_questions where version_id=p_version_id) then
 raise exception 'Question set mismatch' using errcode='22023'; end if;
 for item in select key,value from jsonb_each(p_answers) loop
 if jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>20000
 or not exists(select 1 from public.questionnaire_questions where id::text=item.key and version_id=p_version_id)
 or (p_complete and length(btrim(item.value#>>'{}'))=0) then
 raise exception 'Invalid or missing answer' using errcode='22023'; end if;
 insert into public.questionnaire_answers(response_id,version_id,question_id,body)
 values(rid,p_version_id,item.key::uuid,item.value#>>'{}')
 on conflict(response_id,question_id) do update set body=excluded.body,updated_at=now();
 end loop;
 update public.questionnaire_responses set revision=revision+1,status=case when p_complete then 'submitted' else 'in_progress' end,
 submitted_at=case when p_complete then now() else null end,updated_at=now(),last_save_id=p_save_id,last_payload=payload,free_response=coalesce(p_free_response,r.free_response)
 where id=rid returning * into r;
 return jsonb_build_object('revision',r.revision,'status',r.status,'savedAt',r.updated_at);
end $$;
revoke all on function private.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean,text) to authenticated;
create function public.save_questionnaire_response(p_version_id uuid,p_answers jsonb,p_revision integer,p_save_id uuid,p_complete boolean,p_free_response text)
returns jsonb language sql security invoker set search_path='' as $$ select private.save_questionnaire_response(p_version_id,p_answers,p_revision,p_save_id,p_complete,p_free_response); $$;
revoke all on function public.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean,text) from public,anon;
grant execute on function public.save_questionnaire_response(uuid,jsonb,integer,uuid,boolean,text) to authenticated;


-- Older clients omit the optional field; preserve its existing value.
create or replace function private.save_questionnaire_response(p_version_id uuid,p_answers jsonb,p_revision integer,p_save_id uuid,p_complete boolean)
returns jsonb language sql security definer set search_path='' as $$
 select private.save_questionnaire_response(p_version_id,p_answers,p_revision,p_save_id,p_complete,null);
$$;
