-- Disposable PostgreSQL fixture only; never run on a Supabase project.
\set ON_ERROR_STOP on
create schema auth;
create role anon nologin;
create role authenticated nologin;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
insert into auth.users select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,11) n;
\ir schema.sql
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
do $$
declare first_result jsonb; retry jsonb;
begin
  first_result := public.mobile_receive_capture('fixture-event-0001','shortcut','{"amountMinor":100}');
  retry := public.mobile_receive_capture('fixture-event-0001','shortcut','{"amountMinor":100}');
  if first_result->>'id' is null or first_result->>'id' is distinct from retry->>'id' or retry->>'duplicate' is distinct from 'true' then raise exception 'Retry duplicated'; end if;
  if (select count(*) from public.mobile_capture_inbox) <> 1 then raise exception 'Unexpected count'; end if;
  if public.mobile_receive_capture('fixture-event-0001','shortcut','{"amountMinor":200}')->>'error' is distinct from 'conflict' then raise exception 'Conflict accepted'; end if;
  begin
    insert into public.mobile_capture_inbox (user_id,request_id,source,payload) values (auth.uid(),'fixture-event-0002','shortcut','{}');
    raise exception 'Direct write allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.mobile_api_usage;
    raise exception 'Quota reset allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from public.mobile_capture_inbox) <> 0 then raise exception 'Cross-user read'; end if;
  if public.mobile_receive_capture('fixture-event-0001','shortcut','{"amountMinor":100}')->>'duplicate' is distinct from 'false' then raise exception 'User scopes share receipts'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.mobile_receive_capture('fixture-event-0003','shortcut','{}');
    raise exception 'Anonymous call allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.mobile_capture_inbox;
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
do $$
begin
  for owner in 1..10 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-' || lpad(owner::text,12,'0'),true);
    for attempt in 1..30 loop
      if not public.mobile_reserve_usage('assistant') then raise exception 'Quota denied too early'; end if;
    end loop;
    if public.mobile_reserve_usage('assistant') then raise exception 'User exceeded quota'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011',true);
  if public.mobile_reserve_usage('assistant') then raise exception 'Application exceeded quota'; end if;
end $$;
rollback;
