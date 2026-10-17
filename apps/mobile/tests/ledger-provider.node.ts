import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import { es } from '../src/i18n/messages/es/index.ts';
import * as ledgerSession from '../src/storage/ledger-session.ts';
import type { CatchUps, LedgerSession } from '../src/storage/ledger-session.ts';
import { REVIEW_ITEM_CHANGED_MESSAGE } from '../src/storage/review-database.ts';

// 25Q4: LedgerProvider itself, its React hosts replaced by a minimal hook stub: the banner it shows after an open, a
// return to the foreground and each kind of write. Storage is scripted here; the passes themselves run on real SQLite
// (tests/installments.node.ts). Not a rendered screen.

const empty: domain.LedgerArchive = { accounts: [], records: [] };
const session = (flags: Partial<CatchUps> = {}): LedgerSession => ({ archive: empty, recurringFailures: [], recurringError: false, installmentError: false, ...flags });
type Script = {
  open: () => Promise<LedgerSession>;
  refresh: () => Promise<LedgerSession>;
  read: () => Promise<domain.LedgerArchive>;
  recurring: () => Promise<number>;
  plan: () => Promise<string | null>;
  restore: () => Promise<CatchUps>;
  /** 25Q4 review: the review store's Confirmar (its own transitions run on real SQLite in tests/review-store.node.ts). */
  confirm: () => Promise<{ recorded: boolean; warning: string | null }>;
};

function provider(change: Partial<Script> = {}) {
  const script: Script = { open: async () => session(), refresh: async () => session(), read: async () => empty, recurring: async () => 0, plan: async () => null,
    restore: async () => ({ recurringError: false, installmentError: false }), confirm: async () => ({ recorded: true, warning: null }), ...change };
  const source = readFileSync(new URL('../src/storage/LedgerProvider.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  // One cell per hook call of each kind, in call order (React's rule: the same hooks in the same order on every render).
  const cells: Record<string, any[]> = { state: [], ref: [], memo: [], effect: [] };
  const cursor: Record<string, number> = { state: 0, ref: 0, memo: 0, effect: 0 };
  const same = (a: unknown[] | undefined, b: unknown[] | undefined) => !!a && !!b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const memo = (fn: () => unknown, deps: unknown[]) => {
    const i = cursor.memo++;
    if (!cells.memo[i] || !same(cells.memo[i].deps, deps)) cells.memo[i] = { deps, value: fn() };
    return cells.memo[i].value;
  };
  let listener: ((state: string) => void) | null = null;
  let reads = 0;
  /** The UI's day (useCurrentDay): a test moves it as midnight or a return to the foreground would. */
  const clock = { day: domain.todayKey(), real: null as string | null };
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => {
        const i = cursor.state++;
        if (!(i in cells.state)) cells.state[i] = initial;
        return [cells.state[i], (value: unknown) => { cells.state[i] = typeof value === 'function' ? (value as (current: unknown) => unknown)(cells.state[i]) : value; }];
      },
      useRef: (initial: unknown) => cells.ref[cursor.ref++] ??= { current: initial },
      useMemo: memo,
      useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
      // Like React: on mount and again only when a dependency changed, after the previous cleanup.
      useEffect: (fn: () => unknown, deps?: unknown[]) => {
        const i = cursor.effect++;
        if (cells.effect[i] && same(cells.effect[i].deps, deps)) return;
        if (typeof cells.effect[i]?.cleanup === 'function') cells.effect[i].cleanup();
        cells.effect[i] = { deps, cleanup: fn() };
      },
      createContext: () => ({ Provider: 'Provider' }),
      useContext: () => null,
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }) },
    'react-native': { AppState: { addEventListener: (_: string, fn: (state: string) => void) => { listener = fn; return { remove() {} }; } } },
    // The device's own day (`todayKey`) a test can move while a pass runs; null: the real clock.
    '@finanzapp/domain': { ...domain, todayKey: () => clock.real ?? domain.todayKey() },
    '../ui/theme': { useCurrentDay: () => clock.day },
    './currency-gate': { currencyGateForBuild: () => domain.LEDGER_CURRENCIES },
    './database': { readArchive: () => { reads++; return script.read(); }, catchUpInstallments: async () => 0, createEntry: async () => {} },
    './ledger-session': { ...ledgerSession, openLedger: () => script.open(), refreshLedger: () => script.refresh(), savePurchasePlan: () => script.plan(),
      restoreFromBackup: () => script.restore(),
      // The composite's own contract (a failing catch-up returned, never thrown) runs on real SQLite in tests/recurring-audit.node.ts.
      saveRecurring: async () => { try { await script.recurring(); return { recurringError: false }; } catch { return { recurringError: true }; } } },
    // 25Q4 review: the review file opens to a scripted store with an empty tray, so Confirmar reaches the provider's rule.
    './nativeDatabase': { openLedgerDatabase: async () => ({}), openReviewDatabase: async () => ({}) },
    './review-database': { openReviewStore: async () => ({ confirm: () => script.confirm() }),
      loadReviewTray: async () => ({ writable: true, items: [], unreadable: [], conflicts: [] }) },
  };
  const module = { exports: {} as { LedgerProvider?: (props: { children: null }) => { props: { value: any } } } };
  runInNewContext(code, { module, exports: module.exports, process: { env: {} }, Error, Promise, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected provider dependency: ' + name);
    return modules[name];
  } });
  const value = () => { for (const kind in cursor) cursor[kind] = 0; return module.exports.LedgerProvider!({ children: null }).props.value; };
  return {
    script, value, reads: () => reads, clock,
    /** An AppState change as iOS sends it (`inactive` for Control Center, `background` when the app leaves). */
    appState: async (state: string) => { listener?.(state); await settle(); },
    /** The first render opens the ledger; the second, with the archive set, registers the foreground listener. */
    start: async () => { value(); await settle(); return value(); },
    foreground: async () => { listener?.('active'); await settle(); },
  };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const { storage } = es.errors;

test('25Q4: a failed catch-up stays in the banner until a pass succeeds: a write that ran no pass keeps it; a write that ran one updates its own half; a committed write never fails because a pass after it did', async () => {
  const view = provider({ open: async () => session({ installmentError: true }) });
  assert.equal((await view.start()).error, storage.installmentsFailed);
  await view.value().addEntry({});
  assert.equal(view.value().error, storage.installmentsFailed, 'an expense ran no pass: the banner and its retry stay');
  await view.value().addInstallmentPlan({});
  assert.equal(view.value().error, null, 'a plan whose recognition ran clears the instalment half');
  view.script.refresh = async () => session({ recurringError: true });
  await view.foreground();
  assert.equal(view.value().error, storage.verifyFailed);
  view.script.plan = async () => ledgerSession.sessionWarning({ recurringError: false, installmentError: true });
  await view.value().addInstallmentPlan({});
  assert.equal(view.value().error, storage.catchUpsFailed, 'the plan\'s failed recognition joins the recurring half, never replaces it');
  // A write whose view could not be read again says so (its own outcome); the next one shows the catch-ups again.
  view.script.read = async () => { throw new Error('disk I/O error'); };
  await assert.rejects(view.value().addEntry({}), { message: storage.refreshFailed });
  assert.equal(view.value().error, storage.refreshFailed);
  view.script.read = async () => empty;
  await view.value().addEntry({});
  assert.equal(view.value().error, storage.catchUpsFailed);
  // A rule is durable before its catch-up: a pass that fails after it is the banner's, never a failed save.
  view.script.recurring = async () => { throw new Error('database is locked'); };
  await view.value().saveRecurring({});
  assert.equal(view.value().error, storage.catchUpsFailed);
  view.script.recurring = async () => 0;
  await view.value().saveRecurring({});
  assert.equal(view.value().error, storage.installmentsFailed, 'its pass succeeded: the recurring half clears');
  // A committed restore adopts both passes' outcome.
  view.script.restore = async () => ({ recurringError: false, installmentError: true });
  await view.value().restoreBackup(empty, 'baseline');
  assert.equal(view.value().error, storage.installmentsFailed);
  view.script.restore = async () => ({ recurringError: false, installmentError: false });
  await view.value().restoreBackup(empty, 'baseline');
  assert.equal(view.value().error, null);
  // A refused import reaches the review with its reason after the archive was read again; it says nothing in the banner.
  const before = view.reads();
  view.script.restore = async () => { throw new Error(es.errors.storageRecords.backupConflict); };
  await assert.rejects(view.value().restoreBackup(empty, 'baseline'), { message: es.errors.storageRecords.backupConflict });
  assert.deepEqual([view.reads() - before, view.value().error], [1, null]);
  // A foreground pass that could not be read back stays said through the next write.
  view.script.refresh = async () => { throw new Error('disk I/O error'); };
  await view.foreground();
  assert.equal(view.value().error, storage.verifyFailed);
  await view.value().addEntry({});
  assert.equal(view.value().error, storage.verifyFailed);
  view.script.refresh = async () => session();
  await view.foreground();
  assert.equal(view.value().error, null);
});

test('25Q4 review: Confirmar keeps a catch-up banner it did not earn: a movement leaves it, a refusal leaves it, a plan whose recognition failed joins it', async () => {
  const view = provider({ open: async () => session({ installmentError: true }) });
  assert.equal((await view.start()).error, storage.installmentsFailed);
  assert.equal((await view.value().confirmReview('item', 0)).recorded, true);
  assert.equal(view.value().error, storage.installmentsFailed, 'an expense ran no instalment pass (a null warning): the banner and its retry stay');
  view.script.confirm = async () => { throw new Error(REVIEW_ITEM_CHANGED_MESSAGE); };
  await assert.rejects(view.value().confirmReview('item', 0), { message: REVIEW_ITEM_CHANGED_MESSAGE });
  assert.equal(view.value().error, storage.installmentsFailed, 'a refused Confirmar wrote nothing: the banner is as it was');
  view.script.refresh = async () => session({ recurringError: true });
  await view.foreground();
  assert.equal(view.value().error, storage.verifyFailed);
  view.script.confirm = async () => ({ recorded: true, warning: storage.installmentsFailed });
  await view.value().confirmReview('item', 0);
  assert.equal(view.value().error, storage.catchUpsFailed, 'a plan whose first instalments could not be recognised joins the recurring half');
});

test('25Q4: an open refused for a newer file or a migration rolled back whole says so; anything else is the calm open sentence, never the engine\'s text', async () => {
  const cases = [[storage.newerVersion, storage.newerVersion], [storage.migrationReferences, storage.migrationReferences], ['disk I/O error', storage.openFailed],
    ["Call to function 'NativeDatabase.openDatabaseAsync' has been rejected", storage.openFailed], [storage.entryState, storage.openFailed]];
  for (const [cause, expected] of cases) {
    const value = await provider({ open: async () => { throw new Error(cause); } }).start();
    assert.deepEqual([value.error, value.snapshot], [expected, null], cause);
  }
});

test('25R1: the catch-up runs once per change of day and on a real return, never for a Control Center pull on a day already caught up', async () => {
  let refreshes = 0;
  const view = provider({ refresh: async () => { refreshes++; return session(); } });
  const today = view.clock.day;
  assert.equal((await view.start()).asOfISO, today, 'the archive is current to the day the open ran its passes');
  await view.appState('inactive');
  await view.appState('active');
  assert.equal(refreshes, 0, 'Control Center, Notification Center, a system alert: nothing is due');
  await view.appState('background');
  await view.appState('active');
  assert.equal(refreshes, 1, 'a return from the background always runs the pass');
  // A pass that failed is run again on the next return, even from inactive.
  view.script.refresh = async () => { refreshes++; return session({ recurringError: true }); };
  await view.appState('background');
  await view.appState('active');
  await view.appState('inactive');
  await view.appState('active');
  assert.equal(refreshes, 3);
  view.script.refresh = async () => { refreshes++; return session(); };
  await view.appState('background');
  await view.appState('active');
  assert.equal(refreshes, 4);
  // Midnight with the app open: the UI's day changes; the ledger runs the pass for it once, however often it renders.
  view.clock.day = '2099-01-01';
  view.value();
  view.value();
  await settle();
  view.value();
  assert.equal(refreshes, 5);
});

test('25R1 review: a midnight that passes while a pass runs is not lost: the pass runs once more for the new day', async () => {
  let refreshes = 0, release: () => void = () => {};
  const view = provider({ refresh: async () => { refreshes++; if (refreshes === 1) await new Promise<void>(resolve => { release = resolve; }); return session(); } });
  await view.start();
  await view.appState('background');
  await view.appState('active');
  await settle();
  assert.equal(refreshes, 1, 'a pass is running for today');
  view.clock.real = '2099-01-02';
  view.clock.day = '2099-01-02';
  view.value();
  await settle();
  assert.equal(refreshes, 1, 'the change of day is coalesced into the running pass');
  release();
  await settle();
  assert.equal(refreshes, 2, 'and runs once more once that pass ends');
  view.value();
  await settle();
  assert.equal(refreshes, 2, 'never again for the same day');
});

test('25R1: a foreground return and a change of day on the same new day run one pass, and returns that arrive while one is queued add nothing', async () => {
  let refreshes = 0, release: () => void = () => {};
  const view = provider({ refresh: async () => { refreshes++; await new Promise<void>(resolve => { release = resolve; }); return session(); } });
  await view.start();
  await view.appState('background');
  view.clock.day = '2099-01-01';
  view.value();
  await view.appState('active');
  await view.appState('active');
  view.value();
  await settle();
  assert.equal(refreshes, 1, 'one pass is running; nothing else queued behind it');
  release();
  await settle();
  view.value();
  await settle();
  assert.equal(refreshes, 1);
});
