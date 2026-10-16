import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import { es } from '../src/i18n/messages/es/index.ts';
import * as ledgerSession from '../src/storage/ledger-session.ts';
import type { CatchUps, LedgerSession } from '../src/storage/ledger-session.ts';

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
};

function provider(change: Partial<Script> = {}) {
  const script: Script = { open: async () => session(), refresh: async () => session(), read: async () => empty, recurring: async () => 0, plan: async () => null,
    restore: async () => ({ recurringError: false, installmentError: false }), ...change };
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
    '@finanzapp/domain': domain,
    './currency-gate': { currencyGateForBuild: () => domain.LEDGER_CURRENCIES },
    './database': { readArchive: () => { reads++; return script.read(); }, processRecurring: () => script.recurring(), catchUpInstallments: async () => 0,
      createEntry: async () => {}, saveRecurringRule: async () => {} },
    './ledger-session': { ...ledgerSession, openLedger: () => script.open(), refreshLedger: () => script.refresh(), savePurchasePlan: () => script.plan(),
      restoreFromBackup: () => script.restore() },
    // The review file is out of scope: it never opens, which the ledger tolerates.
    './nativeDatabase': { openLedgerDatabase: async () => ({}), openReviewDatabase: async () => { throw new Error('no review file'); } },
    './review-database': {},
  };
  const module = { exports: {} as { LedgerProvider?: (props: { children: null }) => { props: { value: any } } } };
  runInNewContext(code, { module, exports: module.exports, process: { env: {} }, Error, Promise, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected provider dependency: ' + name);
    return modules[name];
  } });
  const value = () => { for (const kind in cursor) cursor[kind] = 0; return module.exports.LedgerProvider!({ children: null }).props.value; };
  return {
    script, value, reads: () => reads,
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

test('25Q4: an open refused for a newer file or a migration rolled back whole says so; anything else is the calm open sentence, never the engine\'s text', async () => {
  const cases = [[storage.newerVersion, storage.newerVersion], [storage.migrationReferences, storage.migrationReferences], ['disk I/O error', storage.openFailed],
    ["Call to function 'NativeDatabase.openDatabaseAsync' has been rejected", storage.openFailed], [storage.entryState, storage.openFailed]];
  for (const [cause, expected] of cases) {
    const value = await provider({ open: async () => { throw new Error(cause); } }).start();
    assert.deepEqual([value.error, value.snapshot], [expected, null], cause);
  }
});
