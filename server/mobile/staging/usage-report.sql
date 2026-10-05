-- STAGING USAGE REPORT (Producto 25A-06). Read-only. Run by the owner in the staging SQL editor; copy the single JSON
-- value it returns into a local file (outside the repository) for `node server/mobile/staging/reconcile.js`
-- (docs/ai-staging-runbook.md §9). Ids, counts, tokens and integer µUSD only: no user id, no content.
-- Edit the two dates (UTC, inclusive) to the provider report's period.
with period as (select date '2026-10-01' as first_day, date '2026-10-31' as last_day)
select jsonb_build_object(
  'kind', 'finanzapp.ai-usage.v1',
  'environment', (select environment from public.mobile_ai_control),
  'firstDay', (select first_day from period), 'lastDay', (select last_day from period),
  'days', coalesce((select jsonb_agg(d order by d->>'day') from (
    select jsonb_build_object(
      'day', r.day_key, 'models', jsonb_agg(distinct r.model),
      'requests', count(*),
      'settled', count(*) filter (where r.state = 'settled'),
      'unsettled', count(*) filter (where r.state = 'unsettled'),
      -- Still 'reserved' after its in-flight window: a settlement that never arrived, counted at its maximum.
      'staleReserved', count(*) filter (where r.state = 'reserved' and r.created_at < now() - interval '10 minutes'),
      'estimateExceeded', count(*) filter (where r.outcome = 'estimate_exceeded'),
      -- Reserved in the day's last minute: the provider call may have run, and been billed, after UTC midnight.
      'nearMidnightMicroUsd', coalesce(sum(r.charged_micro_usd) filter (where r.created_at >= (r.day_key + 1)::timestamp at time zone 'UTC' - interval '60 seconds'), 0),
      'chargedMicroUsd', sum(r.charged_micro_usd),
      'settledMicroUsd', coalesce(sum(r.charged_micro_usd) filter (where r.state = 'settled'), 0),
      'maxMicroUsd', sum(r.max_micro_usd),
      'inputTokens', coalesce(sum(r.input_tokens), 0), 'cachedInputTokens', coalesce(sum(r.cached_input_tokens), 0),
      'outputTokens', coalesce(sum(r.output_tokens), 0), 'reasoningTokens', coalesce(sum(r.reasoning_tokens), 0)) as d
    from public.mobile_ai_reservations r, period p
    where r.day_key between p.first_day and p.last_day
    group by r.day_key) per_day), '[]'::jsonb)) as report;
