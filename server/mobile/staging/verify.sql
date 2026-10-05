-- STAGING VERIFICATION (Producto 25A-06). Run by the owner in the staging project's SQL editor, right after
-- server/mobile/schema.sql was applied and BEFORE the Assistant is enabled (docs/ai-staging-runbook.md, Phase B). Plain
-- SQL, no psql commands. It writes three throwaway users and their rows inside one block and undoes all of them at the
-- end (a deliberate rollback of the block), so it leaves the project as it found it. Its last line prints
-- STAGING_VERIFY_OK; any failure stops with «FAIL: …» and nothing is kept. CI runs it too, on disposable PostgreSQL.
-- It proves, on the real roles and grants: AI installed disabled and bound to staging; no client role (anon,
-- authenticated) may execute a function or touch a budget; the server role reaches the tables only through the
-- functions; one person never sees another's inbox nor settles another's reservation; the per-user day and month and the
-- global day and month ceilings refuse at +1. Concurrency is proven by the CI dblink race and by the probe's race on
-- staging (runbook §6), because this editor holds a single connection.
do $verify$
declare
  a uuid := 'f25a0600-0000-4000-8000-00000000000a';
  b uuid := 'f25a0600-0000-4000-8000-00000000000b';
  ghost uuid := 'f25a0600-0000-4000-8000-0000000000ff';
  r jsonb; id_a uuid; t text; f text;
  client_tables text[] := array['mobile_ai_control', 'mobile_ai_reservations', 'mobile_api_usage', 'mobile_capture_inbox'];
  functions text[] := array['public.mobile_reserve_usage(uuid)', 'public.mobile_receive_capture(uuid,text,text,jsonb,text)',
    'public.mobile_ai_reserve(uuid,text,text,bigint,integer,integer,text)', 'public.mobile_ai_settle(uuid,uuid,text,bigint,integer,integer,integer,integer,integer)'];
begin
  begin
    -- 1. Installed fail closed, for this environment.
    if (select count(*) from public.mobile_ai_control) <> 1 then raise exception 'FAIL: the control row is missing or duplicated'; end if;
    if (select enabled from public.mobile_ai_control) then raise exception 'FAIL: AI is enabled; verify with mobile_ai_control.enabled = false'; end if;
    if (select environment from public.mobile_ai_control) is distinct from 'staging' then raise exception 'FAIL: this database is not recorded as staging'; end if;

    -- 2. Grants and RLS, read from the catalogue: no table privilege for the API roles but the person's own inbox read.
    foreach t in array client_tables loop
      if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'FAIL: RLS off on %', t; end if;
      if has_table_privilege('anon', 'public.' || t, 'select,insert,update,delete')
        or has_table_privilege('service_role', 'public.' || t, 'select,insert,update,delete')
        or has_table_privilege('authenticated', 'public.' || t, 'insert,update,delete')
        or (t <> 'mobile_capture_inbox' and has_table_privilege('authenticated', 'public.' || t, 'select'))
        then raise exception 'FAIL: an API role holds a privilege on %', t; end if;
      -- Column grants and the other table privileges count too (TRUNCATE ignores RLS).
      if has_table_privilege('anon', 'public.' || t, 'truncate,references,trigger') or has_table_privilege('authenticated', 'public.' || t, 'truncate,references,trigger')
        or has_table_privilege('service_role', 'public.' || t, 'truncate,references,trigger')
        or has_any_column_privilege('anon', 'public.' || t, 'select,insert,update,references')
        or has_any_column_privilege('service_role', 'public.' || t, 'select,insert,update,references')
        or has_any_column_privilege('authenticated', 'public.' || t, 'insert,update,references')
        or (t <> 'mobile_capture_inbox' and has_any_column_privilege('authenticated', 'public.' || t, 'select'))
        then raise exception 'FAIL: an API role holds a column or table privilege on %', t; end if;
    end loop;
    foreach f in array functions loop
      if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then raise exception 'FAIL: a client role may execute %', f; end if;
      if has_function_privilege('service_role', f, 'execute') <> (f <> 'public.mobile_reserve_usage(uuid)') then raise exception 'FAIL: service_role execute on % is wrong', f; end if;
      if not coalesce((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = f::regprocedure), false) then raise exception 'FAIL: % is not security definer with an empty search_path', f; end if;
    end loop;
    -- One ephemeral conversation (production-plan.md §5.7): no chat history is stored server-side.
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename ~ '(message|thread|conversation|chat)') then raise exception 'FAIL: a chat-history table exists'; end if;

    -- Throwaway people, undone at the end: two signed-in, one anonymous.
    insert into auth.users (id, is_anonymous) values (a, false), (b, false), (ghost, true);

    -- 3. Client roles, by actually calling: refused by the grant, whoever they claim to be.
    foreach t in array array['anon', 'authenticated'] loop
      begin
        perform set_config('role', t, true);
        perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', t)::text, true);
        perform set_config('request.jwt.claim.sub', a::text, true);
        perform public.mobile_ai_reserve(a, 'staging-verify-client', 'm', 1, 1, 1, 'staging');
        raise exception 'FAIL: % executed mobile_ai_reserve', t;
      exception when insufficient_privilege then null; end;
      begin
        perform set_config('role', t, true);
        perform public.mobile_ai_settle(a, gen_random_uuid(), 'settled', 0, null, null, null, null, null);
        raise exception 'FAIL: % executed mobile_ai_settle', t;
      exception when insufficient_privilege then null; end;
      begin
        perform set_config('role', t, true);
        perform public.mobile_receive_capture(a, 'staging-verify-client', 'shortcut', '{}', 'staging');
        raise exception 'FAIL: % executed mobile_receive_capture', t;
      exception when insufficient_privilege then null; end;
      begin
        perform set_config('role', t, true);
        update public.mobile_ai_control set enabled = true;
        raise exception 'FAIL: % changed the kill switch', t;
      exception when insufficient_privilege then null; end;
      if t = 'anon' then
        begin
          perform set_config('role', t, true);
          perform 1 from public.mobile_capture_inbox limit 1;
          raise exception 'FAIL: anon read the inbox';
        exception when insufficient_privilege then null; end;
      end if;
    end loop;

    -- 4. The server path (service_role, as the secret key runs): disabled refuses and records nothing; the environment
    -- binding refuses another name; captures work and stay per person.
    perform set_config('role', 'service_role', true);
    if public.mobile_ai_reserve(a, 'staging-verify-0001', 'm', 1, 1, 1, 'staging')->>'error' is distinct from 'disabled' then raise exception 'FAIL: disabled AI reserved'; end if;
    if public.mobile_ai_reserve(a, 'staging-verify-0002', 'm', 1, 1, 1, 'production')->>'error' is distinct from 'environment' then raise exception 'FAIL: another environment reserved'; end if;
    if public.mobile_receive_capture(a, 'staging-verify-0005', 'shortcut', '{}', 'production')->>'error' is distinct from 'environment' then raise exception 'FAIL: another environment captured'; end if;
    if public.mobile_receive_capture(a, 'staging-verify-0003', 'shortcut', '{"amountMinor":null}', 'staging')->>'id' is null then raise exception 'FAIL: the server could not capture'; end if;
    begin
      perform public.mobile_ai_reserve(ghost, 'staging-verify-0004', 'm', 1, 1, 1, 'staging');
      raise exception 'FAIL: an anonymous owner reached the reservation';
    exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
    begin
      perform 1 from public.mobile_ai_reservations limit 1;
      raise exception 'FAIL: service_role read the reservations directly';
    exception when insufficient_privilege then null; end;
    perform set_config('role', 'none', true);
    if exists (select 1 from public.mobile_ai_reservations where user_id in (a, b)) then raise exception 'FAIL: a refusal recorded a reservation'; end if;

    -- 5. Cross-user: B reads none of A's inbox; A reads their own.
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', b::text, true);
    if exists (select 1 from public.mobile_capture_inbox) then raise exception 'FAIL: B sees A''s inbox'; end if;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', a::text, true);
    if (select count(*) from public.mobile_capture_inbox) <> 1 then raise exception 'FAIL: A does not see exactly their own inbox'; end if;
    perform set_config('role', 'none', true);

    -- 6. Ceilings, enabled only inside this block, each alone (the others far above): per-user day, per-user month,
    -- global day, global month; each fits exactly and refuses at +1. The month must hold no real reservation yet.
    if exists (select 1 from public.mobile_ai_reservations where month_key = date_trunc('month', now() at time zone 'UTC')::date) then
      raise exception 'FAIL: this month already has reservations; run the verification before the first real request'; end if;
    update public.mobile_ai_control set enabled = true, max_request_micro_usd = 2000, user_day_ceiling_micro_usd = 1000,
      user_month_ceiling_micro_usd = 100000, global_day_ceiling_micro_usd = 100000, global_month_ceiling_micro_usd = 100000,
      user_per_minute = 100, user_per_hour = 100, user_per_day = 100, user_per_month = 100, user_concurrency = 100, global_concurrency = 100;
    perform set_config('role', 'service_role', true);
    r := public.mobile_ai_reserve(a, 'staging-verify-0010', 'm', 1000, 1, 1, 'staging');
    id_a := (r->>'id')::uuid;
    if id_a is null then raise exception 'FAIL: the server path did not reserve: %', r; end if;
    if public.mobile_ai_reserve(a, 'staging-verify-0010', 'm', 1, 1, 1, 'staging')->>'error' is distinct from 'duplicate' then raise exception 'FAIL: a duplicate request id reserved'; end if;
    if public.mobile_ai_reserve(a, 'staging-verify-0011', 'm', 1, 1, 1, 'staging')->>'error' is distinct from 'user_budget' then raise exception 'FAIL: the per-user day ceiling exceeded by 1'; end if;
    -- B cannot settle A's reservation; A settles it exactly once, at a lower actual cost (A now holds 400).
    if public.mobile_ai_settle(b, id_a, 'settled', 0, 1, 0, 0, 1, 0) then raise exception 'FAIL: B settled A''s reservation'; end if;
    if not public.mobile_ai_settle(a, id_a, 'settled', 400, 1, 0, 0, 1, 0) then raise exception 'FAIL: the owner could not settle'; end if;
    if public.mobile_ai_settle(a, id_a, 'settled', 0, 1, 0, 0, 1, 0) then raise exception 'FAIL: a reservation settled twice'; end if;
    perform set_config('role', 'none', true);
    update public.mobile_ai_control set user_day_ceiling_micro_usd = 100000, user_month_ceiling_micro_usd = 1500;
    perform set_config('role', 'service_role', true);
    if public.mobile_ai_reserve(a, 'staging-verify-0012', 'm', 1100, 1, 1, 'staging')->>'id' is null then raise exception 'FAIL: an exact fit of the per-user month refused'; end if;
    if public.mobile_ai_reserve(a, 'staging-verify-0013', 'm', 1, 1, 1, 'staging')->>'error' is distinct from 'user_budget' then raise exception 'FAIL: the per-user month ceiling exceeded by 1'; end if;
    perform set_config('role', 'none', true);
    -- 1 500 is reserved today and this month (all of it A's); B is far below their own ceilings.
    update public.mobile_ai_control set user_month_ceiling_micro_usd = 100000, global_day_ceiling_micro_usd = 1600;
    perform set_config('role', 'service_role', true);
    if public.mobile_ai_reserve(b, 'staging-verify-0014', 'm', 101, 1, 1, 'staging')->>'error' is distinct from 'global_budget' then raise exception 'FAIL: the global day ceiling exceeded by 1'; end if;
    if public.mobile_ai_reserve(b, 'staging-verify-0015', 'm', 100, 1, 1, 'staging')->>'id' is null then raise exception 'FAIL: an exact fit of the global day refused'; end if;
    perform set_config('role', 'none', true);
    update public.mobile_ai_control set global_day_ceiling_micro_usd = 100000, global_month_ceiling_micro_usd = 1700;
    perform set_config('role', 'service_role', true);
    if public.mobile_ai_reserve(b, 'staging-verify-0016', 'm', 101, 1, 1, 'staging')->>'error' is distinct from 'global_budget' then raise exception 'FAIL: the global month ceiling exceeded by 1'; end if;
    if public.mobile_ai_reserve(b, 'staging-verify-0017', 'm', 100, 1, 1, 'staging')->>'id' is null then raise exception 'FAIL: an exact fit of the global month refused'; end if;
    perform set_config('role', 'none', true);

    -- Undo everything above: the users, their rows and the control changes.
    raise exception using errcode = 'PV001', message = 'staging verification complete';
  exception when sqlstate 'PV001' then null;
  end;
end $verify$;
select 'STAGING_VERIFY_OK' as result;
