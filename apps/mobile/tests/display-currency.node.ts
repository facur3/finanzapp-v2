import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { Account, Currency } from '@finanzapp/domain';
import * as displayCurrency from '../src/ui/display-currency.ts';
import type { PreferenceStore } from '../src/i18n/preference.ts';

// Producto 24B6: the display currency Inicio and Reportes share. The pure store
// over a key-value store in memory, its resolution against the currencies held,
// the precedence of a route currency, and the real provider and hook on a real
// React reconciler (react-test-renderer): a choice made by one consumer reaches
// the other in place, mounted or mounted later.
const { DISPLAY_CURRENCY_KEY, createDisplayCurrencyStore, displayCurrencyForRoute, readDisplayCurrency, resolveDisplayCurrency, writeDisplayCurrency } = displayCurrency;
const require = createRequire(import.meta.url);
const React = require('react') as typeof import('react');
const renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { act } = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const consoleError = console.error;
console.error = (...args: unknown[]) => { if (!String(args[0]).startsWith('react-test-renderer is deprecated')) consoleError(...args); };
const h = React.createElement;

function memory(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  const faults = { get: false, set: false };
  const store: PreferenceStore = {
    getItemSync: key => { if (faults.get) throw new Error('database locked'); return rows.get(key) ?? null; },
    setItemSync: (key, value) => { if (faults.set) throw new Error('disk full'); rows.set(key, value); },
    removeItemSync: key => { if (faults.set) throw new Error('disk full'); return rows.delete(key); },
  };
  return { rows, faults, store: () => store };
}
const createdAt = '2026-09-24T12:00:00Z';
const account = (id: string, currency: Currency): Account => ({ id, name: id, currency, openingMinor: 0, createdAt });
const accounts = [account('a', 'ARS'), account('u', 'USD'), account('y', 'JPY')];

test('the preference is read as a storable code or ignored, written under its own key, and never touches another key', () => {
  const saved = memory({ 'finanzapp.language': 'en' });
  assert.equal(readDisplayCurrency(saved.store), null, 'nothing stored: null, never a default written back');
  assert.equal(writeDisplayCurrency('USD', saved.store), true);
  assert.deepEqual([...saved.rows.entries()], [['finanzapp.language', 'en'], [DISPLAY_CURRENCY_KEY, 'USD']]);
  assert.equal(readDisplayCurrency(saved.store), 'USD');
  for (const junk of ['usd', 'XAU', 'ZZZ', '', 'US', 'null']) {
    saved.rows.set(DISPLAY_CURRENCY_KEY, junk);
    assert.equal(readDisplayCurrency(saved.store), null, JSON.stringify(junk) + ' is ignored, not coerced');
  }
  saved.rows.set(DISPLAY_CURRENCY_KEY, 'EUR');
  assert.equal(readDisplayCurrency(saved.store), 'EUR', 'any storable code reads, gated or not: a stored account may hold it');
  saved.faults.get = true;
  assert.equal(readDisplayCurrency(saved.store), null, 'an unreadable store is "no preference", never an error');
  assert.equal(saved.rows.get(DISPLAY_CURRENCY_KEY), 'EUR', 'and deletes nothing');
  saved.faults.get = false; saved.faults.set = true;
  assert.equal(writeDisplayCurrency('ARS', saved.store), false, 'a failed write says so');
  assert.equal(saved.rows.get(DISPLAY_CURRENCY_KEY), 'EUR', 'and leaves the stored value alone');
});

test('what a screen shows is resolved against the currencies held: the preference when held, else the first held, else ARS; the stored value is never rewritten by resolving', () => {
  assert.equal(resolveDisplayCurrency('USD', ['ARS', 'USD']), 'USD');
  assert.equal(resolveDisplayCurrency('USD', ['ARS', 'JPY']), 'ARS', 'the last USD account went: the first currency held');
  assert.equal(resolveDisplayCurrency('JPY', ['ARS', 'USD', 'JPY']), 'JPY', 'a currency outside the production gate but held by an account');
  assert.equal(resolveDisplayCurrency(null, ['USD', 'JPY']), 'USD');
  assert.equal(resolveDisplayCurrency(null, []), 'ARS', 'an empty ledger keeps the pilot default (decision 7.6.4)');
  assert.equal(resolveDisplayCurrency('USD', []), 'ARS');
});

test('the store applies a choice to every subscriber and writes it; the same choice again is silent; an unwritable store keeps the choice for the session and reports it', () => {
  const saved = memory({ [DISPLAY_CURRENCY_KEY]: 'USD' });
  const store = createDisplayCurrencyStore(saved.store);
  assert.equal(store.getState(), 'USD', 'read once at creation');
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);
  assert.equal(store.set('USD'), true);
  assert.equal(notified, 0, 'nothing changed: no re-render');
  assert.equal(store.set('ARS'), true);
  assert.deepEqual([store.getState(), notified, saved.rows.get(DISPLAY_CURRENCY_KEY)], ['ARS', 1, 'ARS']);
  assert.equal(store.set('xx' as Currency), false, 'a code that is not storable is refused');
  assert.equal(store.set('XAU' as Currency), false);
  assert.deepEqual([store.getState(), notified], ['ARS', 1]);
  saved.faults.set = true;
  assert.equal(store.set('JPY'), false, 'the write failed');
  assert.equal(store.getState(), 'JPY', 'the person asked to see yen: the view still switches this session');
  assert.equal(notified, 2);
  assert.equal(saved.rows.get(DISPLAY_CURRENCY_KEY), 'ARS', 'the stored value is the last one that landed, never a partial write');
  unsubscribe();
  saved.faults.set = false;
  store.set('USD');
  assert.equal(notified, 2, 'an unsubscribed listener hears nothing');
  assert.equal(saved.rows.get(DISPLAY_CURRENCY_KEY), 'USD');
  const unreadable = memory({ [DISPLAY_CURRENCY_KEY]: 'USD' });
  unreadable.faults.get = true;
  assert.equal(createDisplayCurrencyStore(unreadable.store).getState(), null, 'an unreadable store at launch is "no preference" and never throws');
});

test('a route currency: held and storable, it is shown and becomes the shared choice; otherwise the shared choice shows and nothing is applied', () => {
  assert.deepEqual(displayCurrencyForRoute(accounts, 'USD', 'ARS'), { currency: 'USD', apply: 'USD' });
  assert.deepEqual(displayCurrencyForRoute(accounts, 'JPY', null), { currency: 'JPY', apply: 'JPY' }, 'held is what counts, not the gate');
  for (const param of [undefined, 'usd', 'XAU', 'ZZZ', 'EUR', 'KWD', '', ['USD'], 42, null]) {
    assert.deepEqual(displayCurrencyForRoute(accounts, param, 'USD'), { currency: 'USD', apply: null }, JSON.stringify(param) + ' with a USD preference');
    assert.deepEqual(displayCurrencyForRoute(accounts, param, null), { currency: 'ARS', apply: null }, JSON.stringify(param) + ' without a preference');
  }
  assert.deepEqual(displayCurrencyForRoute([account('u', 'USD')], 'ARS', 'ARS'), { currency: 'USD', apply: null }, 'a preference no account holds: the first held, and the unheld link applies nothing');
  assert.deepEqual(displayCurrencyForRoute([], 'ARS', null), { currency: 'ARS', apply: null }, 'an empty ledger: ARS, nothing applied');
});

// ---- The real provider and hook on a real reconciler ------------------------------------------

function loadProvider() {
  const source = readFileSync(new URL('../src/ui/display-currency-provider.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    const modules: Record<string, unknown> = { react: React, 'react/jsx-runtime': require('react/jsx-runtime'), './display-currency': displayCurrency };
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected dependency of the display-currency provider: ' + name);
    return modules[name];
  } });
  return module.exports as { DisplayCurrencyProvider: (props: any) => any; useDisplayCurrency: (held: readonly Currency[]) => { currency: Currency; preferred: Currency | null; setCurrency: (currency: Currency) => void } };
}

test('the provider shares one store: a choice made by one screen re-renders the other in place, reaches a screen mounted later, and is persisted; the provider never keys or remounts its children', async () => {
  const { DisplayCurrencyProvider, useDisplayCurrency } = loadProvider();
  const saved = memory();
  const store = createDisplayCurrencyStore(saved.store);
  const held: Currency[] = ['ARS', 'USD', 'JPY'];
  const renders = { home: 0, reports: 0 };
  const latest: Record<string, { currency: Currency; setCurrency: (currency: Currency) => void }> = {};
  const mounts: string[] = [];
  function Screen({ name }: { name: 'home' | 'reports' }) {
    renders[name]++;
    const value = useDisplayCurrency(held);
    latest[name] = value;
    React.useEffect(() => { mounts.push('mount ' + name); return () => { mounts.push('unmount ' + name); }; }, [name]);
    return h('Text', null, name + ':' + value.currency);
  }
  const app = (showReports: boolean) => h(DisplayCurrencyProvider, { store }, h(Screen, { name: 'home' }), showReports ? h(Screen, { name: 'reports' }) : null);
  let tree!: ReturnType<typeof renderer.create>;
  await act(() => { tree = renderer.create(app(true)); });
  assert.deepEqual([latest.home.currency, latest.reports.currency], ['ARS', 'ARS'], 'no preference: the first currency held');
  await act(() => { latest.home.setCurrency('USD'); });
  assert.deepEqual([latest.home.currency, latest.reports.currency], ['USD', 'USD'], 'Reportes followed Inicio');
  assert.deepEqual(renders, { home: 2, reports: 2 }, 'one re-render each, no remount');
  assert.equal(saved.rows.get(DISPLAY_CURRENCY_KEY), 'USD');
  await act(() => { latest.reports.setCurrency('JPY'); });
  assert.deepEqual([latest.home.currency, latest.reports.currency], ['JPY', 'JPY'], 'Inicio followed Reportes');
  await act(() => { latest.home.setCurrency('JPY'); });
  assert.deepEqual(renders, { home: 3, reports: 3 }, 'the same choice again re-renders nothing');
  // Reportes unmounted, the choice changes on Inicio, Reportes comes back: it reads the current choice.
  await act(() => { tree.update(app(false)); });
  await act(() => { latest.home.setCurrency('ARS'); });
  await act(() => { tree.update(app(true)); });
  assert.equal(latest.reports.currency, 'ARS');
  assert.deepEqual(mounts, ['mount home', 'mount reports', 'unmount reports', 'mount reports'], 'the provider never remounted Inicio');
  assert.equal(saved.rows.get(DISPLAY_CURRENCY_KEY), 'ARS');
  await act(() => { tree.unmount(); });
  const source = readFileSync(new URL('../src/ui/display-currency-provider.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState\(\(\) => store \?\? createDisplayCurrencyStore\(\)\)/, 'one store per provider, created lazily once');
  assert.match(source, /useSyncExternalStore\(store\.subscribe, store\.getState, store\.getState\)/);
  assert.equal(/\bkey[:=]/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'the provider never keys its children');
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<LedgerProvider><LedgerCurrencies><DisplayCurrencyProvider>/, 'mounted once for the whole app, inside the ledger provider, outside the navigation');
  assert.equal(/<DisplayCurrencyProvider[^>]*key=/.test(layout), false);
});

test('without a provider the hook still works on an in-memory store, so an isolated screen neither throws nor persists', async () => {
  const { useDisplayCurrency } = loadProvider();
  let latest!: { currency: Currency; setCurrency: (currency: Currency) => void };
  function Alone() { latest = useDisplayCurrency(['ARS', 'USD']); return h('Text', null, latest.currency); }
  let tree!: ReturnType<typeof renderer.create>;
  await act(() => { tree = renderer.create(h(Alone)); });
  assert.equal(latest.currency, 'ARS');
  await act(() => { latest.setCurrency('USD'); });
  assert.equal(latest.currency, 'USD');
  await act(() => { tree.unmount(); });
});
