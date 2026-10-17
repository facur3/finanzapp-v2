import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as financeView from '../src/fx/finance-view.ts';
import * as frankfurter from '../src/fx/frankfurter.ts';
import * as ratesStore from '../src/fx/rates-store.ts';
import * as presentation from '../src/ui/presentation.ts';

// The real src/fx/rates-provider.tsx, its React hosts replaced by a minimal hook stub (the screens' harnesses stand in for
// useFinanceView; this file pins the glue itself): which watches a screen holds, what it reads through, the foreground
// refresh, the frozen idle snapshot and the cache's open. Synthetic data only; no network, no SQLite.

type Watch = { months: string[]; quotes: string[]; today: string; released: boolean };
const account = (id: string, currency: domain.Currency): domain.Account => ({ id, name: id, currency, openingMinor: 0, createdAt: '2026-09-01T12:00:00.000Z' });

function stubStore(state: Partial<ratesStore.RatesSnapshot> = {}) {
  const watches: Watch[] = [];
  const refreshes: string[] = [];
  let snapshot: ratesStore.RatesSnapshot = { book: domain.rateBook([]), loaded: true, lastFetchedAt: null, ...state };
  const store: ratesStore.RatesStore = {
    getState: () => snapshot, subscribe: () => () => {}, ensure: () => {}, settled: async () => {},
    watch: (months, quotes, today) => { const watch = { months: [...months], quotes: [...quotes], today, released: false }; watches.push(watch); return () => { watch.released = true; }; },
    refresh: today => { refreshes.push(today); },
    activity: (_months, _quotes, today) => today ? 'fetching' : 'idle',
  };
  return { store, watches, refreshes, set: (next: Partial<ratesStore.RatesSnapshot>) => { snapshot = { ...snapshot, ...next }; } };
}

function load(env: { accounts: domain.Account[]; mode?: 'single' | 'consolidated'; currency?: domain.Currency; day?: string; focused?: boolean; store?: ratesStore.RatesStore | null;
  openRates?: () => Promise<unknown> }) {
  const source = readFileSync(new URL('../src/fx/rates-provider.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const cells: Record<string, any[]> = { state: [], memo: [], effect: [] };
  const cursor: Record<string, number> = { state: 0, memo: 0, effect: 0 };
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  let listener: ((state: string) => void) | null = null;
  const snapshot = () => ({ accounts: env.accounts, entries: [] }) as domain.LedgerSnapshot;
  const ledger = snapshot();
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => { const i = cursor.state++; if (!(i in cells.state)) cells.state[i] = typeof initial === 'function' ? (initial as () => unknown)() : initial; return [cells.state[i], () => {}]; },
      useMemo: (fn: () => unknown, deps: unknown[]) => { const i = cursor.memo++; if (!cells.memo[i] || !same(cells.memo[i].deps, deps)) cells.memo[i] = { deps, value: fn() }; return cells.memo[i].value; },
      useEffect: (fn: () => unknown, deps?: unknown[]) => {
        const i = cursor.effect++;
        if (cells.effect[i] && same(cells.effect[i].deps, deps)) return;
        if (typeof cells.effect[i]?.cleanup === 'function') cells.effect[i].cleanup();
        cells.effect[i] = { deps, cleanup: fn() };
      },
      useSyncExternalStore: (_subscribe: unknown, getState: () => unknown) => getState(),
      useContext: () => env.store ?? null,
      createContext: () => ({ Provider: 'Provider' }),
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }) },
    'react-native': { AppState: { addEventListener: (_: string, fn: (state: string) => void) => { listener = fn; return { remove: () => { listener = null; } }; } } },
    'expo-router': { useIsFocused: () => env.focused ?? true },
    '@finanzapp/domain': domain,
    '../storage/rates-database': { initializeRatesDatabase: async () => true, readRates: async () => ({ rates: [], coverage: [] }), saveRates: async () => {} },
    '../storage/nativeDatabase': { openRatesDatabase: () => env.openRates?.() ?? Promise.resolve({}) },
    '../storage/LedgerProvider': { useLedger: () => ({ snapshot: ledger }) },
    '../ui/display-currency-provider': { useDisplayCurrency: () => ({ mode: env.mode ?? 'consolidated', currency: env.currency ?? 'USD' }) },
    '../ui/presentation': presentation,
    '../ui/theme': { useCurrentDay: () => env.day ?? '2026-09-25' },
    './frankfurter': frankfurter, './finance-view': financeView, './rates-store': ratesStore,
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, Error, Promise, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected rates-provider dependency: ' + name);
    return modules[name];
  } });
  const render = <T,>(fn: () => T) => { for (const kind in cursor) cursor[kind] = 0; return fn(); };
  return {
    exports: module.exports,
    view: (months: string[], currency?: domain.Currency) => render(() => module.exports.useFinanceView(months, currency)),
    provider: (store: ratesStore.RatesStore) => render(() => module.exports.RatesProvider({ children: null, store })),
    unmount: () => { for (const cell of cells.effect) if (typeof cell?.cleanup === 'function') cell.cleanup(); },
    foreground: (state = 'active') => listener?.(state),
  };
}

test('useFinanceView holds one watch per (months, quotes, day) and releases it on a change, on blur and on unmount', () => {
  const rates = stubStore();
  const env = { accounts: [account('ars', 'ARS'), account('eur', 'EUR')], store: rates.store, day: '2026-09-25', focused: true };
  const harness = load(env);
  const months = ['2026-09'];
  const view = harness.view(months);
  assert.deepEqual(view && [view.mode, view.currency, view.quotes], ['consolidated', 'USD', ['ARS', 'EUR']]);
  harness.view(months);
  assert.deepEqual(rates.watches.map(watch => [watch.months.join(), watch.quotes.join(), watch.today, watch.released]), [['2026-09', 'ARS,EUR', '2026-09-25', false]], 'a re-render watches nothing more');
  env.day = '2026-09-26';
  harness.view(months);
  assert.deepEqual(rates.watches.map(watch => [watch.today, watch.released]), [['2026-09-25', true], ['2026-09-26', false]], 'a new day: released, then watched again');
  env.focused = false;
  harness.view(months);
  assert.equal(rates.watches.at(-1)!.released, true, 'a covered or blurred screen holds no watch, so no retry runs for it');
  assert.equal(rates.watches.length, 2);
  env.focused = true;
  harness.view(months);
  assert.deepEqual([rates.watches.length, rates.watches.at(-1)!.released], [3, false], 'focus watches again (which also asks what is due)');
  harness.unmount();
  assert.ok(rates.watches.every(watch => watch.released));
});

test('useFinanceView never watches in single mode or with one held currency, passes the store\'s state through and reads the day\'s activity', () => {
  for (const env of [{ accounts: [account('ars', 'ARS'), account('eur', 'EUR')], mode: 'single' as const }, { accounts: [account('ars', 'ARS')], mode: 'consolidated' as const, currency: 'EUR' as const }]) {
    const rates = stubStore();
    const view = load({ ...env, store: rates.store }).view(['2026-09']);
    assert.deepEqual([view?.mode, view?.quotes, rates.watches.length], ['single', [], 0], JSON.stringify(env));
  }
  const rates = stubStore({ loaded: false, lastFetchedAt: '2026-09-25T10:00:00.000Z' });
  const harness = load({ accounts: [account('ars', 'ARS'), account('eur', 'EUR')], store: rates.store });
  const view = harness.view(['2026-09']);
  assert.deepEqual([view?.loaded, view?.lastFetchedAt, view?.activity], [false, '2026-09-25T10:00:00.000Z', 'fetching'], 'the first frame: loaded and the derived activity come from the store');
  rates.set({ loaded: true, lastFetchedAt: '2026-09-25T11:00:00.000Z' });
  assert.deepEqual([harness.view(['2026-09'])?.loaded, harness.view(['2026-09'])?.lastFetchedAt], [true, '2026-09-25T11:00:00.000Z']);
});

test('RatesProvider asks the store to refresh on a return to the foreground only; a screen without the provider reads one frozen idle snapshot', () => {
  const rates = stubStore();
  const harness = load({ accounts: [], store: null });
  harness.provider(rates.store);
  harness.foreground('inactive');
  harness.foreground('background');
  harness.foreground('active');
  assert.equal(rates.refreshes.length, 1);
  assert.match(rates.refreshes[0], /^\d{4}-\d{2}-\d{2}$/, 'the device\'s day');
  const idle = harness.exports.useRates();
  assert.equal(idle.getState(), idle.getState(), 'the same object every read: useSyncExternalStore would loop on a fresh one');
  assert.ok(Object.isFrozen(idle.getState()));
  assert.doesNotThrow(() => idle.refresh('2026-09-25'));
});

test('the rate cache forgets an open that failed: the next read opens the file again instead of failing for the whole session', async () => {
  let opens = 0;
  const harness = load({ accounts: [], openRates: async () => { if (++opens === 1) throw new Error('database is locked'); return {}; } });
  const cache = harness.exports.nativeCache();
  await assert.rejects(cache.load(), /database is locked/);
  assert.deepEqual(await cache.load(), { rates: [], coverage: [] });
  await cache.save([], []);
  assert.equal(opens, 2, 'opened once more, then kept');
});
