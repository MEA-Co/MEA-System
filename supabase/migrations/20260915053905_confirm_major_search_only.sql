-- Adds an atomic confirmation operation. Existing records are not modified.
begin;
create function public.confirm_major_search(
  p_request_id uuid, p_user_id uuid, p_session_id uuid,
  p_input_text text, p_normalized_input text, p_candidates jsonb,
  p_catalog_version text, p_major_id uuid, p_model_name text,
  p_model_version text, p_prompt_version text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.major_search_requests%rowtype;
  final_major uuid;
  major_name text;
begin
  if p_user_id is null or p_major_id is null or p_candidates is null
     or jsonb_typeof(p_candidates) <> 'array' then raise exception 'Invalid confirmation'; end if;
  if not exists(select 1 from jsonb_array_elements(p_candidates) c where c->>'id'=p_major_id::text)
    then raise exception 'Major was not offered'; end if;
  select name into major_name from public.majors where id=p_major_id;
  if not found then raise exception 'Major no longer exists'; end if;
  insert into public.major_search_requests(id,session_id,user_id,input_text,normalized_input,status,
    result_source,candidates,model_name,model_version,prompt_version,catalog_version,completed_at)
  values(p_request_id,p_session_id,p_user_id,p_input_text,p_normalized_input,'completed',
    case when p_model_name is null then 'db' else 'model' end,p_candidates,p_model_name,p_model_version,p_prompt_version,p_catalog_version,now())
  on conflict(id) do nothing;
  select * into r from public.major_search_requests where id=p_request_id for update;
  if r.user_id is distinct from p_user_id or r.session_id is distinct from p_session_id
    or r.input_text is distinct from p_input_text or r.normalized_input is distinct from p_normalized_input
    or r.status <> 'completed' then raise exception 'Confirmation conflict'; end if;
  select major_id into final_major from public.major_search_feedback where request_id=p_request_id and action='confirmed';
  if found then
    if final_major is distinct from p_major_id then raise exception 'Already confirmed'; end if;
  else
    if r.candidates is distinct from p_candidates or r.catalog_version is distinct from p_catalog_version
      or r.model_name is distinct from p_model_name then raise exception 'Confirmation conflict'; end if;
    insert into public.major_search_feedback(request_id,action,major_id) values(p_request_id,'confirmed',p_major_id);
  end if;
  return jsonb_build_object('id',p_major_id,'name',major_name,'requestId',p_request_id);
end;
$$;
revoke all on function public.confirm_major_search(uuid,uuid,uuid,text,text,jsonb,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.confirm_major_search(uuid,uuid,uuid,text,text,jsonb,text,uuid,text,text,text) to service_role;
-- The app no longer calls the earlier selected/rejected/no_match recording function.
commit;
