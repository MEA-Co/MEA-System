-- Apply only after docs/major-search-preflight.sql has been reviewed on the target DB.
-- Catalog tables are reused unchanged. All writes are made by the authenticated server.
begin;
create table public.major_search_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  input_text text not null check (char_length(input_text) between 1 and 120),
  normalized_input text not null check (char_length(normalized_input) between 1 and 120),
  status text not null default 'pending' check (status in ('pending','completed','failed','superseded')),
  result_source text check (result_source in ('db','model')),
  candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(candidates) = 'array' and jsonb_array_length(candidates) <= 5),
  model_name text,
  model_version text,
  prompt_version text,
  catalog_version text,
  model_attempt boolean not null default false,
  reused_request_id uuid references public.major_search_requests(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index major_search_requests_user_created_idx on public.major_search_requests(user_id,created_at desc);
create index major_search_requests_session_idx on public.major_search_requests(user_id,session_id,normalized_input);
create index major_search_requests_reused_idx on public.major_search_requests(reused_request_id);
create unique index major_search_model_once_idx on public.major_search_requests(user_id,session_id,normalized_input) where model_attempt;
create table public.major_search_feedback (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.major_search_requests(id) on delete cascade,
  action text not null check (action in ('selected','confirmed','rejected','no_match')),
  major_id uuid references public.majors(id),
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','verified','corrected','excluded')),
  verified_major_id uuid references public.majors(id),
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((action = 'no_match') = (major_id is null)),
  unique nulls not distinct (request_id,action,major_id)
);
create index major_search_feedback_major_idx on public.major_search_feedback(major_id);
create index major_search_feedback_verified_idx on public.major_search_feedback(verified_major_id);
create unique index major_search_one_confirmation_idx on public.major_search_feedback(request_id) where action = 'confirmed';
alter table public.major_search_requests enable row level security;
alter table public.major_search_feedback enable row level security;
revoke all on public.major_search_requests, public.major_search_feedback from anon, authenticated;
grant select, insert, update, delete on public.major_search_requests, public.major_search_feedback to service_role;

-- Invoker rights, service_role only. Lock serializes feedback against input supersession.
create function public.record_major_search_feedback(p_request_id uuid, p_user_id uuid, p_action text, p_major_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  request_row public.major_search_requests%rowtype;
  major_name text;
begin
  select * into request_row from public.major_search_requests
    where id = p_request_id and user_id = p_user_id for update;
  if not found or request_row.status <> 'completed' then
    raise exception 'Request unavailable';
  end if;
  if p_action not in ('selected','confirmed','rejected','no_match') or p_action is null then
    raise exception 'Invalid feedback';
  end if;
  if p_action = 'no_match' then
    if p_major_id is not null then raise exception 'Invalid no_match'; end if;
  else
    if p_major_id is null or not exists (
      select 1 from jsonb_array_elements(request_row.candidates) c where c->>'id' = p_major_id::text
    ) then raise exception 'Major was not offered'; end if;
    select name into major_name from public.majors where id = p_major_id;
    if not found then raise exception 'Major no longer exists'; end if;
  end if;
  if exists (select 1 from public.major_search_feedback where request_id = p_request_id and action = 'confirmed'
    and (p_action <> 'confirmed' or major_id is distinct from p_major_id)) then
    raise exception 'Already confirmed';
  end if;
  if p_action in ('confirmed','rejected') and not exists (
    select 1 from public.major_search_feedback where request_id = p_request_id and action = 'selected' and major_id = p_major_id
  ) then raise exception 'Select the candidate first'; end if;
  insert into public.major_search_feedback(request_id,action,major_id)
    values(p_request_id,p_action,p_major_id) on conflict do nothing;
  if p_action = 'confirmed' then
    return jsonb_build_object('id',p_major_id,'name',major_name,'requestId',p_request_id);
  end if;
  return null;
end;
$$;
revoke all on function public.record_major_search_feedback(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.record_major_search_feedback(uuid,uuid,text,uuid) to service_role;
commit;
