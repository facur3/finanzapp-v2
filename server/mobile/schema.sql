-- STAGING ONLY. The single initial staging script: never applied to any project yet. Its first remote application is
-- 25A-06, by the owner, after review; it never runs from app startup/build. Every later change is an ordered migration,
-- never an edit of this file. Separate from the legacy web snapshot table. No secret key in clients.
-- Privileged functions are executable only by service_role (the server, after it verified the session itself, passes
-- the verified owner id); no client role (anon, authenticated) may execute any function or write any table here.
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
revoke all on public.mobile_capture_inbox from public, anon, authenticated, service_role;
grant select on public.mobile_capture_inbox to authenticated;
create policy own_captures on public.mobile_capture_inbox for select to authenticated using ((select auth.uid()) = user_id);

create table public.mobile_api_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null, kind text not null check (kind = 'capture'), used integer not null check (used > 0),
  primary key (user_id, usage_day, kind)
);
alter table public.mobile_api_usage enable row level security;
revoke all on public.mobile_api_usage from public, anon, authenticated, service_role;

-- Serialized, durable daily capture counter, called only inside mobile_receive_capture. Errors/timeouts also consume
-- quota: never retry a charged request automatically or refund into an abuse loophole.
create function public.mobile_reserve_usage(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  day_key date := (now() at time zone 'UTC')::date; per_user constant integer := 120; per_app constant integer := 2000;
  personal integer; global_used integer;
begin
  if p_user_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(91720601, 1);
  select coalesce(sum(used),0), coalesce(sum(used) filter(where user_id = p_user_id),0)
    into global_used, personal from public.mobile_api_usage where usage_day = day_key and kind = 'capture';
  if personal >= per_user or global_used >= per_app then return false; end if;
  insert into public.mobile_api_usage values (p_user_id, day_key, 'capture', 1)
    on conflict (user_id, usage_day, kind) do update set used = mobile_api_usage.used + 1;
  return true;
end $$;

create function public.mobile_receive_capture(p_user_id uuid, p_request_id text, p_source text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.mobile_capture_inbox; new_id uuid;
begin
  -- auth.uid() is null under service_role: the owner is the server-verified id, and must be a real, non-anonymous user.
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id and not u.is_anonymous)
    then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[a-zA-Z0-9_-]{16,100}$'
    or p_source is null or p_source not in ('shortcut','assistant')
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 8000
    then raise exception 'Invalid capture'; end if;
  -- Same lock as the capture counter; serializes the duplicate check+insert.
  perform pg_advisory_xact_lock(91720601, 1);
  select * into existing from public.mobile_capture_inbox where user_id = p_user_id and request_id = p_request_id;
  if found then
    if existing.source <> p_source or existing.payload <> p_payload then return jsonb_build_object('error','conflict'); end if;
    return jsonb_build_object('id', existing.id, 'duplicate', true);
  end if;
  if not public.mobile_reserve_usage(p_user_id) then return jsonb_build_object('error','limit'); end if;
  insert into public.mobile_capture_inbox (user_id, request_id, source, payload) values (p_user_id, p_request_id, p_source, p_payload)
    returning id into new_id;
  return jsonb_build_object('id', new_id, 'duplicate', false);
end $$;

-- The Assistant's limits and kill switch: one row, edited only by the database owner with SQL (no API role may read
-- it or raise a cap). AI starts disabled here too; `update public.mobile_ai_control set enabled = false` stops every
-- new reservation without a redeploy. Amounts in integer micro-USD (1 USD = 1 000 000 µUSD).
create table public.mobile_ai_control (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  user_month_ceiling_micro_usd bigint not null check (user_month_ceiling_micro_usd >= 0),
  global_day_ceiling_micro_usd bigint not null check (global_day_ceiling_micro_usd >= 0),
  global_month_ceiling_micro_usd bigint not null check (global_month_ceiling_micro_usd >= 0),
  max_request_micro_usd bigint not null check (max_request_micro_usd > 0),
  max_input_tokens integer not null check (max_input_tokens > 0),
  max_output_tokens integer not null check (max_output_tokens > 0),
  user_per_minute integer not null check (user_per_minute >= 0),
  user_per_hour integer not null check (user_per_hour >= 0),
  user_per_day integer not null check (user_per_day >= 0),
  user_per_month integer not null check (user_per_month >= 0),
  user_concurrency integer not null check (user_concurrency >= 0),
  global_concurrency integer not null check (global_concurrency >= 0),
  reservation_ttl_seconds integer not null check (reservation_ttl_seconds > 0)
);
alter table public.mobile_ai_control enable row level security;
revoke all on public.mobile_ai_control from public, anon, authenticated, service_role;
-- STAGING PLACEHOLDER values, disabled: production thresholds come from measured staging cost, not frozen here.
-- $2 per user/month, $1 global/day, $5 global/month, $0.01 per request; 32 000/4 000 tokens; 6/min, 60/h, 200/day,
-- 2 000/month per user; 2 concurrent per user, 10 global; a reservation counts as in flight for 120 s.
insert into public.mobile_ai_control (user_month_ceiling_micro_usd, global_day_ceiling_micro_usd, global_month_ceiling_micro_usd,
  max_request_micro_usd, max_input_tokens, max_output_tokens, user_per_minute, user_per_hour, user_per_day, user_per_month,
  user_concurrency, global_concurrency, reservation_ttl_seconds)
values (2000000, 1000000, 5000000, 10000, 32000, 4000, 6, 60, 200, 2000, 2, 10, 120);

-- One monetary reservation per Assistant request. charged_micro_usd is the maximum while reserved or unsettled and the
-- actual cost once settled (never capped down: above the maximum it is recorded as 'estimate_exceeded'). Every row
-- counts at its charged amount whatever its state, so deleting an account keeps its global spend (user_id null).
create table public.mobile_ai_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_id text not null check (request_id ~ '^[a-zA-Z0-9_-]{16,100}$'),
  model text not null check (char_length(model) between 1 and 100),
  state text not null default 'reserved' check (state in ('reserved','settled','unsettled')),
  max_micro_usd bigint not null check (max_micro_usd > 0),
  charged_micro_usd bigint not null check (charged_micro_usd >= 0),
  input_tokens integer check (input_tokens >= 0),
  cached_input_tokens integer check (cached_input_tokens >= 0),
  cache_write_tokens integer check (cache_write_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens >= 0),
  outcome text check (outcome in ('estimate_exceeded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  day_key date not null default (now() at time zone 'UTC')::date,
  month_key date not null default date_trunc('month', now() at time zone 'UTC')::date,
  unique (user_id, request_id)
);
create index mobile_ai_reservations_day on public.mobile_ai_reservations (day_key);
create index mobile_ai_reservations_month on public.mobile_ai_reservations (month_key, user_id);
create index mobile_ai_reservations_user_created on public.mobile_ai_reservations (user_id, created_at);
create index mobile_ai_reservations_in_flight on public.mobile_ai_reservations (created_at) where state = 'reserved';
alter table public.mobile_ai_reservations enable row level security;
revoke all on public.mobile_ai_reservations from public, anon, authenticated, service_role;

-- Reserve the request's maximum cost before the provider is called. Returns {id} or {error: code}, checked in this
-- order: disabled, duplicate, request_too_large, rate, busy, user_budget, global_budget (the monetary circuit breaker).
create function public.mobile_ai_reserve(p_user_id uuid, p_request_id text, p_model text, p_max_micro_usd bigint,
  p_input_tokens integer, p_output_tokens integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.mobile_ai_control; today date := (now() at time zone 'UTC')::date;
  this_month date := date_trunc('month', now() at time zone 'UTC')::date; new_id uuid;
begin
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id and not u.is_anonymous)
    then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[a-zA-Z0-9_-]{16,100}$' or p_model is null or char_length(p_model) not between 1 and 100
    or p_max_micro_usd is null or p_max_micro_usd <= 0 or p_input_tokens is null or p_input_tokens <= 0
    or p_output_tokens is null or p_output_tokens <= 0 then raise exception 'Invalid reservation'; end if;
  -- ponytail: one global lock for every AI budget decision, fine at staging scale; per-budget row locks if throughput matters.
  perform pg_advisory_xact_lock(91720601, 2);
  select * into c from public.mobile_ai_control where id;
  if not found or not c.enabled then return jsonb_build_object('error','disabled'); end if;
  if exists (select 1 from public.mobile_ai_reservations where user_id = p_user_id and request_id = p_request_id)
    then return jsonb_build_object('error','duplicate'); end if;
  if p_input_tokens > c.max_input_tokens or p_output_tokens > c.max_output_tokens or p_max_micro_usd > c.max_request_micro_usd
    then return jsonb_build_object('error','request_too_large'); end if;
  if exists (select from public.mobile_ai_reservations r where r.user_id = p_user_id
    having count(*) filter (where r.created_at > now() - interval '1 minute') >= c.user_per_minute
      or count(*) filter (where r.created_at > now() - interval '1 hour') >= c.user_per_hour
      or count(*) filter (where r.day_key = today) >= c.user_per_day
      or count(*) filter (where r.month_key = this_month) >= c.user_per_month)
    then return jsonb_build_object('error','rate'); end if;
  if exists (select from public.mobile_ai_reservations r
    where r.state = 'reserved' and r.created_at > now() - make_interval(secs => c.reservation_ttl_seconds)
    having count(*) filter (where r.user_id = p_user_id) >= c.user_concurrency or count(*) >= c.global_concurrency)
    then return jsonb_build_object('error','busy'); end if;
  -- Stale 'reserved' and 'unsettled' rows keep counting at their maximum: no sweep ever releases them.
  if (select coalesce(sum(charged_micro_usd),0) from public.mobile_ai_reservations where user_id = p_user_id and month_key = this_month)
    + p_max_micro_usd > c.user_month_ceiling_micro_usd then return jsonb_build_object('error','user_budget'); end if;
  if (select coalesce(sum(charged_micro_usd),0) from public.mobile_ai_reservations where day_key = today)
    + p_max_micro_usd > c.global_day_ceiling_micro_usd
    or (select coalesce(sum(charged_micro_usd),0) from public.mobile_ai_reservations where month_key = this_month)
    + p_max_micro_usd > c.global_month_ceiling_micro_usd then return jsonb_build_object('error','global_budget'); end if;
  insert into public.mobile_ai_reservations (user_id, request_id, model, max_micro_usd, charged_micro_usd)
    values (p_user_id, p_request_id, p_model, p_max_micro_usd, p_max_micro_usd)
    returning id into new_id;
  return jsonb_build_object('id', new_id);
end $$;

-- Exactly-once settlement of the caller's own 'reserved' row; true when a row moved. 'settled' records the actual
-- cost (lower frees that capacity; higher is kept as 'estimate_exceeded'); 'unsettled' (unknown cost) keeps the maximum.
-- Token columns hold the provider's reported usage (null when unknown); the bound lives in max_micro_usd.
create function public.mobile_ai_settle(p_user_id uuid, p_reservation_id uuid, p_state text, p_charged_micro_usd bigint,
  p_input_tokens integer, p_cached_input_tokens integer, p_cache_write_tokens integer, p_output_tokens integer,
  p_reasoning_tokens integer) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_user_id is null or p_reservation_id is null or p_state is null or p_state not in ('settled','unsettled')
    or (p_state = 'settled' and (p_charged_micro_usd is null or p_charged_micro_usd < 0))
    then raise exception 'Invalid settlement'; end if;
  perform pg_advisory_xact_lock(91720601, 2);
  update public.mobile_ai_reservations set state = p_state, settled_at = now(),
    charged_micro_usd = case when p_state = 'settled' then p_charged_micro_usd else max_micro_usd end,
    outcome = case when p_state = 'settled' and p_charged_micro_usd > max_micro_usd then 'estimate_exceeded' end,
    input_tokens = p_input_tokens, cached_input_tokens = p_cached_input_tokens, cache_write_tokens = p_cache_write_tokens,
    output_tokens = p_output_tokens, reasoning_tokens = p_reasoning_tokens
  where id = p_reservation_id and user_id = p_user_id and state = 'reserved';
  return found;
end $$;

revoke all on function public.mobile_reserve_usage(uuid), public.mobile_receive_capture(uuid,text,text,jsonb),
  public.mobile_ai_reserve(uuid,text,text,bigint,integer,integer),
  public.mobile_ai_settle(uuid,uuid,text,bigint,integer,integer,integer,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.mobile_receive_capture(uuid,text,text,jsonb),
  public.mobile_ai_reserve(uuid,text,text,bigint,integer,integer),
  public.mobile_ai_settle(uuid,uuid,text,bigint,integer,integer,integer,integer,integer) to service_role;
commit;
