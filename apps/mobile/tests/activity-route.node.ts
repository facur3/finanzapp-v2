import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import { bindLocale } from '../src/i18n/bind.ts';

// Producto 24UX6C: Movimientos over the actual route, host components as descriptors, effects run in place and a fake
// clock. It pins what the screen composes (the search pill, the kind filter, the count) and when VoiceOver hears the
// count: after a filter change, after a pause while typing, never on the first render, and never once Movimientos has
// lost focus (Codex, PR #72: the tab stays mounted under other tabs and pushed screens). How VoiceOver actually speaks
// it on an iPhone is a device item.
type Node = { type: string; props: Record<string, any> };
const createdAt = '2026-09-12T12:00:00Z';
const snapshot: domain.LedgerSnapshot = {
  accounts: [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt }],
  entries: [
    { id: 'e1', accountId: 'a', kind: 'expense', amountMinor: 1000, merchant: 'Coto', category: 'Supermercado', dateISO: '2026-09-10', createdAt },
    { id: 'e2', accountId: 'a', kind: 'income', amountMinor: 5000, merchant: 'Sueldo', category: 'Sueldo', dateISO: '2026-09-01', createdAt },
  ],
  transfers: [],
};

function harness() {
  const source = readFileSync(new URL('../app/(tabs)/activity.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: string, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const deps: (unknown[] | undefined)[] = [];
  const cleanups: (void | (() => void))[] = [];
  let cursor = 0, effectCursor = 0;
  const announced: string[] = [];
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
    'expo-router': { router: { push: () => {} }, useFocusEffect: (effect: () => void | (() => void)) => { if (!focusEffect) { focusEffect = effect; blur = effect(); } } },
    '../../src/storage/LedgerProvider': { useLedger: () => ({ snapshot }) },
    '../../src/ui/components': { ActionButton: 'ActionButton', AppText: 'AppText', Choices: 'Choices', EmptyState: 'EmptyState', SearchField: 'SearchField' },
    '../../src/ui/entry-list': { EntryList: 'EntryList' },
    '../../src/ui/presentation': presentation,
    '../../src/ui/category-hues': { useCategoryLookOf: () => (stored: string) => ({ label: stored }) },
    '../../src/i18n/provider': { useI18n: () => bindLocale('es-AR') },
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected activity dependency: ' + name);
    return modules[name];
  } });
  const render = () => { cursor = 0; effectCursor = 0; return module.exports.default!(); };
  return { render, announced, clock, blurNow: () => { if (typeof blur === 'function') blur(); }, focusAgain: () => { blur = focusEffect?.(); } };
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
