-- STAGING ONLY. Apply explicitly after review; never runs from app startup/build.
-- Separate from the legacy web snapshot table. No service-role credentials in clients.
begin;
create table public.mobile_capture_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null check (request_id ~ '^[a-zA-Z0-9_-]{16,100}$'),
  source text not null check (source in ('shortcut', 'assistant')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 8000),
  status text not null default 'needs_review' check (status = 'needs_review'),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
alter table public.mobile_capture_inbox enable row level security;
revoke all on public.mobile_capture_inbox from public, anon, authenticated;
grant select on public.mobile_capture_inbox to authenticated;
create policy own_captures on public.mobile_capture_inbox for select to authenticated using ((select auth.uid()) = user_id);

create table public.mobile_api_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null, kind text not null, used integer not null check (used > 0),
  primary key (user_id, usage_day, kind)
);
alter table public.mobile_api_usage enable row level security;
revoke all on public.mobile_api_usage from public, anon, authenticated;

-- Serialized, durable daily reservation. Errors/timeouts also consume quota:
-- never retry a charged request automatically or refund into an abuse loophole.
create function public.mobile_reserve_usage(p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); day_key date := (now() at time zone 'UTC')::date;
  per_user integer; per_app integer; personal integer; global_used integer;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Authentication required'; end if;
  if p_kind = 'assistant' then per_user := 30; per_app := 300;
  elsif p_kind = 'capture' then per_user := 120; per_app := 2000;
  else raise exception 'Invalid operation'; end if;
  perform pg_advisory_xact_lock(91720601, 1);
  select coalesce(sum(used),0), coalesce(sum(used) filter(where user_id = uid),0)
    into global_used, personal from public.mobile_api_usage where usage_day = day_key and kind = p_kind;
  if personal >= per_user or global_used >= per_app then return false; end if;
  insert into public.mobile_api_usage values (uid, day_key, p_kind, 1)
    on conflict (user_id, usage_day, kind) do update set used = mobile_api_usage.used + 1;
  return true;
end $$;
revoke all on function public.mobile_reserve_usage(text) from public, anon;
grant execute on function public.mobile_reserve_usage(text) to authenticated;

create function public.mobile_receive_capture(p_request_id text, p_source text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.mobile_capture_inbox; new_id uuid;
begin
  if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[a-zA-Z0-9_-]{16,100}$'
    or p_source is null or p_source not in ('shortcut','assistant')
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8000
    then raise exception 'Invalid capture'; end if;
  -- Same lock order as quota reservations; serializes the duplicate check+insert.
  perform pg_advisory_xact_lock(91720601, 1);
  select * into existing from public.mobile_capture_inbox where user_id = uid and request_id = p_request_id;
  if found then
    if existing.source <> p_source or existing.payload <> p_payload then return jsonb_build_object('error','conflict'); end if;
    return jsonb_build_object('id', existing.id, 'duplicate', true);
  end if;
  if not public.mobile_reserve_usage('capture') then return jsonb_build_object('error','limit'); end if;
  insert into public.mobile_capture_inbox (user_id, request_id, source, payload) values (uid, p_request_id, p_source, p_payload)
    returning id into new_id;
  return jsonb_build_object('id', new_id, 'duplicate', false);
end $$;
revoke all on function public.mobile_receive_capture(text,text,jsonb) from public, anon;
grant execute on function public.mobile_receive_capture(text,text,jsonb) to authenticated;
commit;
