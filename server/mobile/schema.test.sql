-- Disposable PostgreSQL fixture only; never run on a Supabase project. Runs top to bottom on a FRESH database (it
-- creates the auth fixture, the roles and the schema; CI creates one per run). The sequential checks roll back; the
-- concurrency checks need committed state across dblink connections, so they commit and clean up after themselves.
\set ON_ERROR_STOP on
\o /dev/null
create schema auth;
-- Roles are cluster-wide: created once per cluster, so a fresh database on a reused server still runs.
do $$ declare r text; begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
  end loop;
end $$;
alter role service_role bypassrls;
create table auth.users (id uuid primary key, is_anonymous boolean not null default false);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
-- Supabase's default privileges: every new table and function in public is granted to the API roles; the schema
-- must revoke them explicitly.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
insert into auth.users (id) select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,30) n;
insert into auth.users values ('00000000-0000-4000-8000-000000000099', true);
\ir schema.sql

create function pg_temp.u(n integer) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid $$;
-- Runs one statement as the server (service_role), as runtime.js does with the secret key.
create function pg_temp.server(stmt text) returns jsonb language plpgsql as $$
declare r jsonb;
begin perform set_config('role','service_role',true); execute stmt into r; perform set_config('role','none',true); return r; end $$;
create function pg_temp.capture(n integer, rid text, payload jsonb) returns jsonb language sql as $$
  select pg_temp.server(format('select public.mobile_receive_capture(%L,%L,%L,%L,''staging'')', pg_temp.u(n), rid, 'shortcut', payload)) $$;
create function pg_temp.reserve(n integer, rid text, max bigint, input integer default 100, output integer default 100) returns jsonb language sql as $$
  select pg_temp.server(format('select public.mobile_ai_reserve(%L,%L,%L,%s,%s,%s,''staging'')', pg_temp.u(n), rid, 'openai:fixture-model', max, input, output)) $$;
create function pg_temp.settle(n integer, id uuid, state text, charged bigint) returns boolean language sql as $$
  select pg_temp.server(format('select to_jsonb(public.mobile_ai_settle(%L,%L,%L,%s,10,2,1,5,3))', pg_temp.u(n), id, state, coalesce(charged::text,'null')))::boolean $$;
create function pg_temp.denied(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when insufficient_privilege then return true; end $$;
create function pg_temp.raises(stmt text) returns boolean language plpgsql as $$
begin perform pg_temp.server(stmt); return false; exception when raise_exception then return true; end $$;
create function pg_temp.assert_denied(who text, stmts text[]) returns void language plpgsql as $$
declare s text;
begin foreach s in array stmts loop if not pg_temp.denied(s) then raise exception '% was allowed: %', who, s; end if; end loop; end $$;
-- What no client role may do (the first three are the server's functions): every function, and any read or write of the budget, the counters or the reservations.
create function pg_temp.client_forbidden() returns text[] language sql as $$ select array[
  'select public.mobile_ai_reserve(''00000000-0000-4000-8000-000000000001'',''fixture-ai-client-01'',''openai:x'',1,1,1,''staging'')',
  'select public.mobile_ai_settle(''00000000-0000-4000-8000-000000000001'',gen_random_uuid(),''settled'',0,null,null,null,null,null)',
  'select public.mobile_receive_capture(''00000000-0000-4000-8000-000000000001'',''fixture-event-client'',''shortcut'',''{}'',''staging'')',
  'select public.mobile_reserve_usage(''00000000-0000-4000-8000-000000000001'')',
  'select * from public.mobile_ai_control',
  'insert into public.mobile_ai_control default values',
  'update public.mobile_ai_control set user_month_ceiling_micro_usd = 999999999999',
  'update public.mobile_ai_control set enabled = true',
  'delete from public.mobile_ai_control',
  'select * from public.mobile_ai_reservations',
  'insert into public.mobile_ai_reservations (user_id,request_id,model,max_micro_usd,charged_micro_usd) values (''00000000-0000-4000-8000-000000000001'',''fixture-ai-direct-01'',''x'',1,0)',
  'update public.mobile_ai_reservations set charged_micro_usd = 0',
  'delete from public.mobile_ai_reservations',
  'select * from public.mobile_api_usage',
  'insert into public.mobile_api_usage values (''00000000-0000-4000-8000-000000000001'',current_date,''capture'',1)',
  'update public.mobile_api_usage set used = 1',
  'delete from public.mobile_api_usage',
  'insert into public.mobile_capture_inbox (user_id,request_id,source,payload) values (''00000000-0000-4000-8000-000000000001'',''fixture-event-direct'',''shortcut'',''{}'')',
  'update public.mobile_capture_inbox set payload = ''{}''',
  'delete from public.mobile_capture_inbox'] $$;

begin;
-- Installed fail closed: one control row, disabled.
do $$ begin
  if (select count(*) from public.mobile_ai_control) <> 1 or (select enabled from public.mobile_ai_control) then raise exception 'AI control not installed disabled'; end if;
  if (select environment from public.mobile_ai_control) is distinct from 'staging' then raise exception 'The staging script did not record staging'; end if;
end $$;

-- (a) (b) (c) Client roles execute nothing and touch no budget, counter or reservation.
set local role anon;
select pg_temp.assert_denied('anon', pg_temp.client_forbidden() || 'select * from public.mobile_capture_inbox'::text);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
select pg_temp.assert_denied('authenticated', pg_temp.client_forbidden());
-- (d) The server role raises no cap and writes no reservation or counter directly: only through the functions.
set local role service_role;
select pg_temp.assert_denied('service_role', (pg_temp.client_forbidden())[4:] || 'select * from public.mobile_capture_inbox'::text);
reset role;

-- (f) Server path: captures dedupe, conflict, scope per user, and refuse unknown or anonymous owners.
do $$
declare first_result jsonb; retry jsonb;
begin
  first_result := pg_temp.capture(1, 'fixture-event-0001', '{"amountMinor":100}');
  retry := pg_temp.capture(1, 'fixture-event-0001', '{"amountMinor":100}');
  if first_result->>'id' is null or first_result->>'id' is distinct from retry->>'id' or retry->>'duplicate' is distinct from 'true' then raise exception 'Retry duplicated'; end if;
  if (select count(*) from public.mobile_capture_inbox) <> 1 then raise exception 'Unexpected count'; end if;
  if pg_temp.capture(1, 'fixture-event-0001', '{"amountMinor":200}')->>'error' is distinct from 'conflict' then raise exception 'Conflict accepted'; end if;
  if pg_temp.capture(2, 'fixture-event-0001', '{"amountMinor":100}')->>'duplicate' is distinct from 'false' then raise exception 'User scopes share receipts'; end if;
  if not pg_temp.raises(format('select public.mobile_receive_capture(%L,%L,%L,%L,''staging'')', gen_random_uuid(), 'fixture-event-0002', 'shortcut', '{}')) then raise exception 'Unknown owner captured'; end if;
  if not pg_temp.raises(format('select public.mobile_receive_capture(%L,%L,%L,%L,''staging'')', pg_temp.u(99), 'fixture-event-0002', 'shortcut', '{}')) then raise exception 'Anonymous owner captured'; end if;
  if not pg_temp.raises('select public.mobile_receive_capture(null,''fixture-event-0002'',''shortcut'',''{}'',''staging'')') then raise exception 'Null owner captured'; end if;
  if not pg_temp.raises(format('select public.mobile_receive_capture(%L,%L,%L,%L,''staging'')', pg_temp.u(1), 'short', 'shortcut', '{}')) then raise exception 'Bad request id captured'; end if;
end $$;

-- (e) A signed-in person reads only their own inbox.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $$ begin
  if (select count(*) from public.mobile_capture_inbox) <> 1 or exists (select 1 from public.mobile_capture_inbox where user_id <> auth.uid()) then raise exception 'Cross-user read'; end if;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
do $$ begin if (select count(*) from public.mobile_capture_inbox) <> 0 then raise exception 'Cross-user read'; end if; end $$;
reset role;

-- (f) Capture limits: 120 per person per UTC day, 2000 for the whole app.
do $$
declare total integer := 2; r jsonb;
begin
  for owner in 3..20 loop
    for attempt in 1..120 loop
      r := pg_temp.capture(owner, format('fixture-cap-%s-%s', lpad(owner::text,3,'0'), lpad(attempt::text,4,'0')), '{}');
      if total < 2000 then
        if r->>'id' is null then raise exception 'Capture denied too early (owner %, attempt %)', owner, attempt; end if;
        total := total + 1;
      elsif r->>'error' is distinct from 'limit' then raise exception 'Application exceeded the capture limit';
      end if;
    end loop;
    if pg_temp.capture(owner, format('fixture-cap-%s-extra', lpad(owner::text,3,'0')), '{}')->>'error' is distinct from 'limit' then raise exception 'Person exceeded the capture limit'; end if;
  end loop;
  if total <> 2000 or (select count(*) from public.mobile_capture_inbox) <> 2000 then raise exception 'Global capture limit not reached exactly'; end if;
end $$;

-- (g) Kill switch: disabled (or no row) refuses and records nothing.
do $$ begin
  if pg_temp.reserve(1, 'fixture-ai-kill-0001', 10)->>'error' is distinct from 'disabled' then raise exception 'Disabled AI reserved'; end if;
  delete from public.mobile_ai_control;
  if pg_temp.reserve(1, 'fixture-ai-kill-0002', 10)->>'error' is distinct from 'disabled' then raise exception 'Missing control row reserved'; end if;
  if exists (select 1 from public.mobile_ai_reservations) then raise exception 'Kill switch recorded a reservation'; end if;
  insert into public.mobile_ai_control values (true, 'staging', true, 1000000, 1000000, 1000000, 1000000, 500, 1000, 100, 1000, 1000, 1000, 1000, 1000, 1000, 120);
end $$;

-- (h) Idempotency, (i) request_too_large and argument validation.
do $$
declare first_result jsonb;
begin
  first_result := pg_temp.reserve(1, 'fixture-ai-dup-00001', 10);
  if first_result->>'id' is null then raise exception 'Reservation refused: %', first_result; end if;
  if pg_temp.reserve(1, 'fixture-ai-dup-00001', 10)->>'error' is distinct from 'duplicate' then raise exception 'Duplicate reserved twice'; end if;
  if (select count(*) from public.mobile_ai_reservations where request_id = 'fixture-ai-dup-00001') <> 1 then raise exception 'Duplicate inserted a second row'; end if;
  if pg_temp.reserve(2, 'fixture-ai-dup-00001', 10)->>'id' is null then raise exception 'Request ids not scoped per user'; end if;
  if pg_temp.reserve(1, 'fixture-ai-big-00001', 10, 1001, 100)->>'error' is distinct from 'request_too_large'
    or pg_temp.reserve(1, 'fixture-ai-big-00002', 10, 100, 101)->>'error' is distinct from 'request_too_large'
    or pg_temp.reserve(1, 'fixture-ai-big-00003', 501)->>'error' is distinct from 'request_too_large' then raise exception 'Oversized request reserved'; end if;
  if pg_temp.reserve(1, 'fixture-ai-big-00004', 500, 1000, 100)->>'id' is null then raise exception 'Request at the caps refused'; end if;
  if exists (select 1 from public.mobile_ai_reservations where request_id in ('fixture-ai-big-00001','fixture-ai-big-00002','fixture-ai-big-00003')) then raise exception 'Refusal recorded a row'; end if;
  if not pg_temp.raises('select public.mobile_ai_reserve(null,''fixture-ai-bad-00001'',''m'',1,1,1,''staging'')')
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''fixture-ai-bad-00001'',''m'',1,1,1,''staging'')', gen_random_uuid()))
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''fixture-ai-bad-00001'',''m'',1,1,1,''staging'')', pg_temp.u(99)))
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''bad id'',''m'',1,1,1,''staging'')', pg_temp.u(1)))
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''fixture-ai-bad-00001'','''',1,1,1,''staging'')', pg_temp.u(1)))
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''fixture-ai-bad-00001'',%L,1,1,1,''staging'')', pg_temp.u(1), repeat('m',101)))
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''fixture-ai-bad-00001'',''m'',0,1,1,''staging'')', pg_temp.u(1)))
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''fixture-ai-bad-00001'',''m'',1,0,1,''staging'')', pg_temp.u(1)))
    or not pg_temp.raises(format('select public.mobile_ai_reserve(%L,''fixture-ai-bad-00001'',''m'',1,1,0,''staging'')', pg_temp.u(1)))
    then raise exception 'Nonsense reservation accepted'; end if;
end $$;

-- (i) Rate windows, each alone: full at 2, freed only when the rows leave that window.
do $$
declare w text;
begin
  foreach w in array array['minute','hour','day','month'] loop
    delete from public.mobile_ai_reservations;
    update public.mobile_ai_control set user_per_minute = 1000, user_per_hour = 1000, user_per_day = 1000, user_per_month = 1000;
    execute format('update public.mobile_ai_control set user_per_%s = 2', w);
    if pg_temp.reserve(1, 'fixture-ai-rate-' || w || '-1', 1)->>'id' is null or pg_temp.reserve(1, 'fixture-ai-rate-' || w || '-2', 1)->>'id' is null then raise exception 'Rate % denied too early', w; end if;
    if pg_temp.reserve(1, 'fixture-ai-rate-' || w || '-3', 1)->>'error' is distinct from 'rate' then raise exception 'Rate % window exceeded', w; end if;
    if pg_temp.reserve(2, 'fixture-ai-rate-' || w || '-3', 1)->>'id' is null then raise exception 'Rate % shared across users', w; end if;
    update public.mobile_ai_reservations set created_at = created_at - case w when 'minute' then interval '2 minutes' when 'hour' then interval '2 hours' else interval '40 days' end,
      day_key = case when w in ('day','month') then day_key - 40 else day_key end,
      month_key = case when w = 'month' then (month_key - interval '1 month')::date else month_key end;
    if pg_temp.reserve(1, 'fixture-ai-rate-' || w || '-4', 1)->>'id' is null then raise exception 'Rate % window never frees', w; end if;
  end loop;
end $$;

-- (i) Concurrency: per user and global, counted only while reserved and younger than the TTL.
do $$
declare first_id uuid;
begin
  delete from public.mobile_ai_reservations;
  update public.mobile_ai_control set user_per_minute = 1000, user_per_hour = 1000, user_per_day = 1000, user_per_month = 1000, user_concurrency = 2, global_concurrency = 3;
  first_id := pg_temp.reserve(1, 'fixture-ai-busy-0001', 1)->>'id';
  if pg_temp.reserve(1, 'fixture-ai-busy-0002', 1)->>'id' is null then raise exception 'Concurrency denied too early'; end if;
  if pg_temp.reserve(1, 'fixture-ai-busy-0003', 1)->>'error' is distinct from 'busy' then raise exception 'User concurrency exceeded'; end if;
  if pg_temp.reserve(2, 'fixture-ai-busy-0004', 1)->>'id' is null then raise exception 'Global concurrency denied too early'; end if;
  if pg_temp.reserve(3, 'fixture-ai-busy-0005', 1)->>'error' is distinct from 'busy' then raise exception 'Global concurrency exceeded'; end if;
  if not pg_temp.settle(1, first_id, 'settled', 1) then raise exception 'Settlement failed'; end if;
  if pg_temp.reserve(1, 'fixture-ai-busy-0006', 1)->>'id' is null then raise exception 'Settlement did not free concurrency'; end if;
  update public.mobile_ai_reservations set created_at = created_at - interval '121 seconds';
  if pg_temp.reserve(3, 'fixture-ai-busy-0007', 1)->>'id' is null then raise exception 'Stale reservation still in flight'; end if;
end $$;

-- (j) Ceilings refuse a maximum that does not fit: fits at sum + max = ceiling, refused at +1.
do $$ begin
  delete from public.mobile_ai_reservations;
  update public.mobile_ai_control set user_concurrency = 1000, global_concurrency = 1000, max_request_micro_usd = 1000,
    user_month_ceiling_micro_usd = 1000, global_day_ceiling_micro_usd = 3000, global_month_ceiling_micro_usd = 5000;
  if pg_temp.reserve(1, 'fixture-ai-cap-00001', 600)->>'id' is null then raise exception 'User budget denied too early'; end if;
  if pg_temp.reserve(1, 'fixture-ai-cap-00002', 401)->>'error' is distinct from 'user_budget' then raise exception 'User ceiling exceeded by 1'; end if;
  if pg_temp.reserve(1, 'fixture-ai-cap-00003', 400)->>'id' is null then raise exception 'User ceiling refused an exact fit'; end if;
  if pg_temp.reserve(2, 'fixture-ai-cap-00004', 1000)->>'id' is null or pg_temp.reserve(3, 'fixture-ai-cap-00005', 999)->>'id' is null then raise exception 'Global day denied too early'; end if;
  if pg_temp.reserve(4, 'fixture-ai-cap-00006', 2)->>'error' is distinct from 'global_budget' then raise exception 'Global day ceiling exceeded by 1'; end if;
  if pg_temp.reserve(4, 'fixture-ai-cap-00007', 1)->>'id' is null then raise exception 'Global day refused an exact fit'; end if;
  -- Earlier days of the same month: the day is free again, the month is not.
  update public.mobile_ai_reservations set day_key = day_key - 1;
  if pg_temp.reserve(5, 'fixture-ai-cap-00008', 1000)->>'id' is null or pg_temp.reserve(6, 'fixture-ai-cap-00009', 999)->>'id' is null then raise exception 'Global month denied too early'; end if;
  if pg_temp.reserve(7, 'fixture-ai-cap-00010', 2)->>'error' is distinct from 'global_budget' then raise exception 'Global month ceiling exceeded by 1'; end if;
  if pg_temp.reserve(7, 'fixture-ai-cap-00012', 1)->>'id' is null then raise exception 'Global month refused an exact fit'; end if;
  if pg_temp.reserve(5, 'fixture-ai-cap-00011', 1)->>'error' is distinct from 'user_budget' then raise exception 'User ceiling not checked before the global one'; end if;
end $$;

-- (k) Settlement: exactly once, own rows only; settled frees exactly the difference, unsettled keeps the maximum,
-- above the maximum the higher actual is recorded.
do $$
declare first_id uuid := (select id from public.mobile_ai_reservations where request_id = 'fixture-ai-cap-00001');
  second_id uuid := (select id from public.mobile_ai_reservations where request_id = 'fixture-ai-cap-00003');
  big_id uuid := (select id from public.mobile_ai_reservations where request_id = 'fixture-ai-cap-00004'); r public.mobile_ai_reservations;
begin
  update public.mobile_ai_control set global_month_ceiling_micro_usd = 1000000;
  if not pg_temp.settle(1, first_id, 'settled', 250) then raise exception 'Settlement did not move'; end if;
  select * into r from public.mobile_ai_reservations where id = first_id;
  if r.state <> 'settled' or r.charged_micro_usd <> 250 or r.outcome is not null or r.settled_at is null or r.input_tokens <> 10 or r.reasoning_tokens <> 3 then raise exception 'Settlement recorded %', to_jsonb(r); end if;
  if pg_temp.reserve(1, 'fixture-ai-set-00001', 351)->>'error' is distinct from 'user_budget' then raise exception 'Settlement freed more than the difference'; end if;
  if pg_temp.reserve(1, 'fixture-ai-set-00002', 350)->>'id' is null then raise exception 'Settlement did not free the difference'; end if;
  if pg_temp.settle(1, first_id, 'settled', 0) then raise exception 'Second settlement moved'; end if;
  if (select charged_micro_usd from public.mobile_ai_reservations where id = first_id) <> 250 then raise exception 'Second settlement changed the charge'; end if;
  if pg_temp.settle(2, second_id, 'settled', 0) then raise exception 'Another user settled a reservation'; end if;
  if pg_temp.settle(1, gen_random_uuid(), 'settled', 0) then raise exception 'Unknown reservation settled'; end if;
  if not pg_temp.settle(1, second_id, 'unsettled', null) then raise exception 'Unsettled did not move'; end if;
  select * into r from public.mobile_ai_reservations where id = second_id;
  if r.state <> 'unsettled' or r.charged_micro_usd <> 400 then raise exception 'Unsettled released its maximum: %', to_jsonb(r); end if;
  if pg_temp.settle(1, second_id, 'settled', 0) then raise exception 'Unsettled settled again'; end if;
  if not pg_temp.settle(2, big_id, 'settled', 1500) then raise exception 'Exceeded settlement did not move'; end if;
  select * into r from public.mobile_ai_reservations where id = big_id;
  if r.charged_micro_usd <> 1500 or r.outcome is distinct from 'estimate_exceeded' then raise exception 'Exceeded estimate capped: %', to_jsonb(r); end if;
  if not pg_temp.raises(format('select public.mobile_ai_settle(%L,%L,''bogus'',0,null,null,null,null,null)', pg_temp.u(1), first_id))
    or not pg_temp.raises(format('select public.mobile_ai_settle(%L,%L,''settled'',null,null,null,null,null,null)', pg_temp.u(1), first_id))
    or not pg_temp.raises(format('select public.mobile_ai_settle(%L,%L,''settled'',-1,null,null,null,null,null)', pg_temp.u(1), first_id))
    then raise exception 'Nonsense settlement accepted'; end if;
end $$;

-- (l) Deleting an account keeps its global spend.
do $$ begin
  delete from public.mobile_ai_reservations;
  update public.mobile_ai_control set global_day_ceiling_micro_usd = 1000;
  if pg_temp.reserve(8, 'fixture-ai-del-00001', 1000)->>'id' is null then raise exception 'Reservation refused'; end if;
  delete from auth.users where id = pg_temp.u(8);
  if (select count(*) from public.mobile_ai_reservations where user_id is null and charged_micro_usd = 1000) <> 1 then raise exception 'Account deletion dropped its spend'; end if;
  if pg_temp.reserve(9, 'fixture-ai-del-00002', 1)->>'error' is distinct from 'global_budget' then raise exception 'Account deletion freed global budget'; end if;
end $$;

-- (n) Per-user daily ceiling: fits at sum + max = ceiling, refused at +1 (as user_budget), never shared between people;
-- an earlier day of the month frees the person's day but still counts in their month.
do $$ begin
  delete from public.mobile_ai_reservations;
  update public.mobile_ai_control set user_month_ceiling_micro_usd = 5000, user_day_ceiling_micro_usd = 1000,
    global_day_ceiling_micro_usd = 1000000, global_month_ceiling_micro_usd = 1000000;
  if pg_temp.reserve(10, 'fixture-ai-uday-0001', 600)->>'id' is null then raise exception 'User day denied too early'; end if;
  if pg_temp.reserve(10, 'fixture-ai-uday-0002', 401)->>'error' is distinct from 'user_budget' then raise exception 'User day ceiling exceeded by 1'; end if;
  if pg_temp.reserve(10, 'fixture-ai-uday-0003', 400)->>'id' is null then raise exception 'User day refused an exact fit'; end if;
  if pg_temp.reserve(11, 'fixture-ai-uday-0004', 1000)->>'id' is null then raise exception 'User day shared across people'; end if;
  if exists (select 1 from public.mobile_ai_reservations where request_id = 'fixture-ai-uday-0002') then raise exception 'Refusal recorded a row'; end if;
  update public.mobile_ai_reservations set day_key = day_key - 1 where user_id = pg_temp.u(10);
  if pg_temp.reserve(10, 'fixture-ai-uday-0005', 500)->>'id' is null then raise exception 'User day never frees'; end if;
  update public.mobile_ai_control set user_month_ceiling_micro_usd = 1500;
  if pg_temp.reserve(10, 'fixture-ai-uday-0006', 1)->>'error' is distinct from 'user_budget' then raise exception 'An earlier day left the month'; end if;
end $$;

-- (o) Environment binding: a deployment naming another environment (or none) is refused first, before the kill switch,
-- the budget or the inbox, and records nothing; the column accepts only the two names.
do $$
declare inbox bigint := (select count(*) from public.mobile_capture_inbox); counted bigint := (select coalesce(sum(u.used),0) from public.mobile_api_usage u);
begin
  delete from public.mobile_ai_reservations;
  update public.mobile_ai_control set enabled = true, user_month_ceiling_micro_usd = 1000000, user_day_ceiling_micro_usd = 1000000;
  if pg_temp.server(format('select public.mobile_ai_reserve(%L,%L,%L,1,1,1,%L)', pg_temp.u(12), 'fixture-ai-env-00001', 'm', 'production'))->>'error' is distinct from 'environment'
    or pg_temp.server(format('select public.mobile_ai_reserve(%L,%L,%L,1,1,1,null)', pg_temp.u(12), 'fixture-ai-env-00002', 'm'))->>'error' is distinct from 'environment'
    then raise exception 'Another environment reserved'; end if;
  if pg_temp.server(format('select public.mobile_receive_capture(%L,%L,%L,%L,%L)', pg_temp.u(12), 'fixture-event-env-01', 'shortcut', '{}', 'production'))->>'error' is distinct from 'environment'
    or pg_temp.server(format('select public.mobile_receive_capture(%L,%L,%L,%L,null)', pg_temp.u(12), 'fixture-event-env-02', 'shortcut', '{}'))->>'error' is distinct from 'environment'
    then raise exception 'Another environment captured'; end if;
  if exists (select 1 from public.mobile_ai_reservations) or (select count(*) from public.mobile_capture_inbox) <> inbox
    or (select coalesce(sum(u.used),0) from public.mobile_api_usage u) <> counted then raise exception 'A refused environment recorded a row'; end if;
  if pg_temp.reserve(12, 'fixture-ai-env-00003', 1)->>'id' is null then raise exception 'Own environment refused'; end if;
  begin update public.mobile_ai_control set environment = 'preview'; raise exception 'Unknown environment accepted';
  exception when check_violation then null; end;
end $$;
rollback;

-- (m) True concurrency: two connections race for the last budget that fits one request; the second waits on the lock
-- and is refused once the first commits. Needs committed state (the connections see nothing uncommitted), so each
-- round's setup is a top-level statement, and everything is cleaned up at the end.
create extension dblink;
create function pg_temp.race(expected text, second_owner integer) returns void language plpgsql as $$
declare conn text := 'dbname=' || current_database() || ' user=postgres'; a jsonb; b jsonb;
begin
  perform dblink_connect('race_a', conn); perform dblink_connect('race_b', conn);
  perform dblink_exec('race_a', 'set role service_role'); perform dblink_exec('race_b', 'set role service_role');
  perform dblink_exec('race_a', 'begin');
  select r into a from dblink('race_a', format('select public.mobile_ai_reserve(%L,%L,''m'',600,1,1,''staging'')', pg_temp.u(1), 'fixture-race-' || expected || '-a')) as t(r jsonb);
  if a->>'id' is null then raise exception 'Race %: first connection refused: %', expected, a; end if;
  perform dblink_send_query('race_b', format('select public.mobile_ai_reserve(%L,%L,''m'',600,1,1,''staging'')', pg_temp.u(second_owner), 'fixture-race-' || expected || '-b'));
  perform pg_sleep(0.3);
  if dblink_is_busy('race_b') <> 1 then raise exception 'Race %: second connection was not blocked by the budget lock', expected; end if;
  perform dblink_exec('race_a', 'commit');
  select r into b from dblink_get_result('race_b') as t(r jsonb);
  perform * from dblink_get_result('race_b') as t(r jsonb);
  perform dblink_disconnect('race_a'); perform dblink_disconnect('race_b');
  if b->>'error' is distinct from expected then raise exception 'Race %: second connection got %', expected, b; end if;
  if (select count(*) from public.mobile_ai_reservations) <> 1 then raise exception 'Race %: both reserved', expected; end if;
end $$;
update public.mobile_ai_control set enabled = true, user_month_ceiling_micro_usd = 1000000, global_day_ceiling_micro_usd = 1000,
  global_month_ceiling_micro_usd = 1000000, max_request_micro_usd = 1000, user_per_minute = 1000, user_per_hour = 1000,
  user_per_day = 1000, user_per_month = 1000, user_concurrency = 1000, global_concurrency = 1000;
select pg_temp.race('global_budget', 2);
delete from public.mobile_ai_reservations;
update public.mobile_ai_control set global_day_ceiling_micro_usd = 1000000, user_month_ceiling_micro_usd = 1000;
select pg_temp.race('user_budget', 1);
delete from public.mobile_ai_reservations;
update public.mobile_ai_control set enabled = false;
drop extension dblink;
