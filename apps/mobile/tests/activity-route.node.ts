import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import { accountDisplayName } from '../src/ui/liability-presentation.ts';
import { bindLocale } from '../src/i18n/bind.ts';

// Producto 24UX6C: Movimientos over the actual route, host components as descriptors, effects run in place and a fake
// clock. It pins what the screen composes (the search pill, the kind filter, the count) and when VoiceOver hears the
// count: after a filter change, after a pause while typing, never on the first render, and never once Movimientos has
// lost focus (Codex, PR #72: the tab stays mounted under other tabs and pushed screens). How VoiceOver actually speaks
// it on an iPhone is a device item.
type Node = { type: string; props: Record<string, any>; key?: string };
const createdAt = '2026-09-12T12:00:00Z';
const snapshot: domain.LedgerSnapshot = {
  accounts: [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt }],
  entries: [
    { id: 'e1', accountId: 'a', kind: 'expense', amountMinor: 1000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-10', createdAt },
    { id: 'e2', accountId: 'a', kind: 'income', amountMinor: 5000, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-01', createdAt },
  ],
  transfers: [],
};

function harness(data: domain.LedgerSnapshot = snapshot, archive?: domain.LedgerArchive) {
  const source = readFileSync(new URL('../app/(tabs)/activity.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  // The automatic runtime passes an element's key as the third argument.
  const jsx = (type: string, props: Record<string, unknown>, key?: string) => ({ type, props, key });
  // 25Q4: the route's params, as a link or the dock last sent them.
  const params: { reset?: string } = {};
  const state: unknown[] = [];
  const deps: (unknown[] | undefined)[] = [];
  const cleanups: (void | (() => void))[] = [];
  let cursor = 0, effectCursor = 0;
  const announced: string[] = [];
  const pushed: unknown[] = [];
  // A fake clock: timers run when the test advances time.
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextTimer = 1;
  const clock = {
    setTimeout: (fn: () => void, ms: number) => { const id = nextTimer++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (id: number) => { timers.delete(id); },
    advance: (ms: number) => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } },
  };
  let focusEffect: (() => void | (() => void)) | null = null;
  let blur: void | (() => void);
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; },
      useRef: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
      useMemo: (fn: () => unknown) => fn(), useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void | (() => void), next?: unknown[]) => {
        const index = effectCursor++;
        const previous = deps[index];
        if (previous && next && next.length === previous.length && next.every((item, i) => item === previous[i])) return;
        if (previous) { const cleanup = cleanups[index]; if (typeof cleanup === 'function') cleanup(); }
        deps[index] = next ?? [];
        cleanups[index] = fn();
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', AccessibilityInfo: { announceForAccessibility: (text: string) => announced.push(text) } },
    'expo-router': { Tabs: { Screen: 'Tabs.Screen' }, router: { push: (to: unknown) => { pushed.push(to); } }, useLocalSearchParams: () => params,
      useFocusEffect: (effect: () => void | (() => void)) => { if (!focusEffect) { focusEffect = effect; blur = effect(); } } },
    '../../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: data, archive }) },
    '../../src/ui/components': { ActionButton: 'ActionButton', AppText: 'AppText', Choices: 'Choices', EmptyState: 'EmptyState', IconButton: 'IconButton', SearchField: 'SearchField' },
    '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../../src/ui/presentation': presentation,
    '../../src/ui/category-hues': { useCategoryLookOf: () => (stored: string) => ({ label: stored }), useAccountNameOf: () => (account: domain.Account) => accountDisplayName(account, archive?.debts ?? []) },
    '../../src/i18n/provider': { useI18n: () => bindLocale('es-AR') },
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected activity dependency: ' + name);
    return modules[name];
  } });
  // 25N1: the screen is its bar options (Tabs.Screen) beside the list; `render` hands back the list, `options` the bar's.
  let screen: Node | null = null;
  const render = () => {
    cursor = 0; effectCursor = 0;
    screen = module.exports.default!();
    return screen?.type === 'Fragment' ? (screen.props.children as Node[]).find(child => child?.type === 'EntryList')! : screen;
  };
  const options = () => (screen!.props.children as Node[]).find(child => child?.type === 'Tabs.Screen')!.props.options;
  return { render, options, announced, pushed, clock, params, blurNow: () => { if (typeof blur === 'function') blur(); }, focusAgain: () => { blur = focusEffect?.(); } };
}
const flat = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flat) : [value, ...flat(value.props?.children)];
const header = (root: Node) => flat(root.props.header);

test('24UX6C: Movimientos composes the search pill, the kind filter and the count; it records through the dock, not a header «+»', () => {
  const root = harness().render();
  assert.equal(root.type, 'EntryList');
  const nodes = header(root);
  const search = nodes.find(node => node.type === 'SearchField')!;
  assert.deepEqual([search.props.label, search.props.placeholder], ['Buscar movimientos', 'Comercio, categoría o cuenta']);
  const choices = nodes.find(node => node.type === 'Choices')!;
  assert.equal(choices.props.options.map((option: { label: string }) => option.label).join(','), 'Todos,Gastos,Ingresos,Transf.');
  // 25D2: VoiceOver hears the abbreviated segment whole; the others read as shown.
  assert.equal(JSON.stringify(choices.props.options.map((option: { spokenLabel?: string }) => option.spokenLabel ?? null)), JSON.stringify([null, null, null, 'Transferencias']));
  assert.ok(nodes.some(node => node.type === 'AppText' && [node.props.children].flat().join('') === '2 movimientos'));
  assert.equal(JSON.stringify(root).includes('new-entry') && JSON.stringify(root).includes('headerRight'), false);
});

test('24UX6C: VoiceOver hears the count after a filter change at once and after a pause while typing, never on the first render', () => {
  const view = harness();
  let root = view.render();
  view.clock.advance(1000);
  assert.deepEqual(view.announced, [], 'opening the tab announces nothing');
  header(root).find(node => node.type === 'Choices')!.props.onChange('expense');
  root = view.render();
  view.clock.advance(0);
  assert.deepEqual(view.announced, ['1 movimiento'], 'a filter change is announced at once, with the new count');
  header(root).find(node => node.type === 'SearchField')!.props.onChangeText('zzz');
  view.render();
  view.clock.advance(500);
  assert.equal(view.announced.length, 1, 'typing waits for a pause');
  view.clock.advance(300);
  assert.deepEqual(view.announced, ['1 movimiento', '0 movimientos']);
});

test('25Q1: «Neto del día» heads the days only while nothing narrows the list', () => {
  const view = harness();
  let root = view.render();
  assert.equal(root.props.dayNet, true, 'every movement of the day: its net');
  header(root).find(node => node.type === 'Choices')!.props.onChange('expense');
  root = view.render();
  assert.equal(root.props.dayNet, false, 'Gastos alone: a subset\'s sum is not the day\'s net');
  header(root).find(node => node.type === 'Choices')!.props.onChange('all');
  root = view.render();
  assert.equal(root.props.dayNet, true);
  header(root).find(node => node.type === 'SearchField')!.props.onChangeText('coto');
  assert.equal(view.render().props.dayNet, false, 'a search narrows it too');
  header(view.render()).find(node => node.type === 'SearchField')!.props.onChangeText('   ');
  assert.equal(view.render().props.dayNet, true, 'blank search: the whole list again');
});

test('Codex (PR #72): a pending count announcement is cancelled when Movimientos loses focus, and none starts while unfocused', () => {
  const view = harness();
  const root = view.render();
  header(root).find(node => node.type === 'SearchField')!.props.onChangeText('coto');
  view.render();
  view.clock.advance(300);
  view.blurNow();
  view.clock.advance(2000);
  assert.deepEqual(view.announced, [], 'switching tabs or opening a detail mid-pause never speaks over the next screen');
  const again = view.render();
  header(again).find(node => node.type === 'Choices')!.props.onChange('income');
  view.render();
  view.clock.advance(1000);
  assert.deepEqual(view.announced, [], 'nothing is announced while another screen is in front');
  view.focusAgain();
  const back = view.render();
  header(back).find(node => node.type === 'Choices')!.props.onChange('all');
  view.render();
  view.clock.advance(800); // the search still holds «coto», so the announcement waits for the typing pause
  assert.deepEqual(view.announced, ['1 movimiento'], 'back in focus, a change is announced again');
});

test('25Q4: a link into Movimientos (a new `reset`) shows the whole list from the top without announcing it; the dock\'s repeat of the same params keeps what the person does next', () => {
  const view = harness();
  const search = (root: Node) => header(root).find(node => node.type === 'SearchField')!;
  const choices = (root: Node) => header(root).find(node => node.type === 'Choices')!;
  let root = view.render();
  choices(root).props.onChange('expense');
  root = view.render();
  search(root).props.onChangeText('coto');
  root = view.render();
  view.clock.advance(1000);
  const heard = view.announced.length;
  // «Ver todos» or the Assistant's evidence: a fresh value, applied while rendering.
  view.params.reset = '1700000000000';
  view.render();
  root = view.render();
  assert.deepEqual([search(root).props.value, choices(root).props.value, root.props.dayNet], ['', 'all', true], 'the whole list');
  assert.equal(root.key, '1700000000000', 'a new list, at its own top');
  view.clock.advance(1000);
  assert.equal(view.announced.length, heard, 'an arrival is not the person\'s search: nothing is announced');
  // The dock re-sends the same params: what the person does next stays, in the same list.
  search(root).props.onChangeText('sueldo');
  view.render();
  root = view.render();
  assert.deepEqual([search(root).props.value, root.key], ['sueldo', '1700000000000']);
  // Another link resets again.
  view.params.reset = '1700000000001';
  view.render();
  root = view.render();
  assert.deepEqual([search(root).props.value, root.key], ['', '1700000000001']);
});

test('25O1: an empty Movimientos leaves the filled action to the dock\'s «+» once an account exists; without one, adding an account stays the filled way forward', () => {
  const empty = (accounts: domain.Account[]) => { const view = harness({ accounts, entries: [], transfers: [] }); return { view, state: view.render().props.empty }; };
  const withAccount = empty(snapshot.accounts);
  assert.equal(withAccount.state.type, 'EmptyState');
  const record = withAccount.state.props.action;
  assert.deepEqual([record.props.label, record.props.secondary], ['Registrar movimiento', true], 'secondary: the dock\'s «+» is the one filled action');
  record.props.onPress();
  const none = empty([]);
  const add = none.state.props.action;
  assert.deepEqual([add.props.label, add.props.secondary], ['Agregar cuenta', false], 'the only way forward stays filled');
  add.props.onPress();
  assert.deepEqual([...withAccount.view.pushed, ...none.view.pushed], ['/new-entry', '/new-account']);
});

test('25N1: Movimientos deshechos is a button of Movimientos\' bar while a movement, a transfer or an operation is undone; none otherwise', () => {
  const records = snapshot.entries.map(domain.initialRecord);
  const base: domain.LedgerArchive = { accounts: snapshot.accounts, records };
  const buttonOf = (archive?: domain.LedgerArchive) => { const view = harness(snapshot, archive); view.render(); return { view, right: view.options().headerRight }; };
  assert.equal(buttonOf().right, undefined, 'the ledger not read yet: no button');
  assert.equal(buttonOf(base).right, undefined, 'nothing undone: nothing to open');
  const withEntry = buttonOf({ ...base, records: [{ ...records[0], voided: true }, records[1]] });
  const button = withEntry.right();
  assert.deepEqual([button.type, button.props.name, button.props.label], ['IconButton', 'arrow-undo-outline', 'Movimientos deshechos']);
  button.props.onPress();
  assert.deepEqual(withEntry.view.pushed, ['/undone-entries']);
  const transfer: domain.Transfer = { id: 't1', fromAccountId: 'a', toAccountId: 'a', amountMinor: 100, note: '', dateISO: '2026-09-11', createdAt };
  assert.equal(typeof buttonOf({ ...base, transfers: [{ transfer, revision: 1, voided: true, updatedAt: createdAt }] }).right, 'function', 'an undone transfer');
  const refund = domain.newEntryRefund(base, { id: 'r1', entryId: 'e1', amountMinor: 500, dateISO: '2026-09-11', todayISO: '2026-09-12', createdAt });
  assert.equal(buttonOf({ ...base, purchaseOperations: [refund] }).right, undefined, 'a live devolución is not undone');
  const undoneRefund = domain.makeOperationChange('undo', refund, 'void', createdAt).after;
  assert.equal(typeof buttonOf({ ...base, purchaseOperations: [undoneRefund] }).right, 'function', 'an undone devolución is listed there too');
});

test('25T review: the search finds a debt\'s payment by the counterparty its row shows («Juan Pérez»), not only by the stored «Debo · Juan»', () => {
  const owed: domain.Account = { id: 'owed', name: 'Debo · Juan', currency: 'ARS', openingMinor: 0, createdAt, hidden: true } as domain.Account;
  const debt: domain.PersonalDebtProfile = { id: 'debt', accountId: owed.id, direction: 'owed_by_me', counterparty: 'Juan Pérez', dueDateISO: null,
    note: '', active: true, deleted: false, createdAt, revision: 1, updatedAt: createdAt };
  const payment: domain.Transfer = { id: 'pay', fromAccountId: 'a', toAccountId: owed.id, amountMinor: 2000, note: '', dateISO: '2026-09-11', createdAt };
  const data = { ...snapshot, accounts: [...snapshot.accounts, owed], transfers: [payment] };
  const view = harness(data, { accounts: data.accounts, records: [], transfers: [payment], debts: [debt] } as unknown as domain.LedgerArchive);
  header(view.render()).find(node => node.type === 'SearchField')!.props.onChangeText('pérez');
  assert.deepEqual(view.render().props.transfers.map((transfer: domain.Transfer) => transfer.id), ['pay']);
});
