import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import * as reviewPresentation from '../src/ui/review-presentation.ts';
import * as purchasePlan from '../src/ui/purchase-plan.ts';
import * as installmentPresentation from '../src/ui/installment-presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import { lightPalette } from '../src/ui/palette.ts';
import { REVIEW_ITEM_CHANGED_MESSAGE, type ReviewItem, type ReviewTray } from '../src/storage/review-database.ts';

// Producto 25A-03 over the actual route modules, native hosts replaced by descriptors: the «Para revisar» tray, a
// proposal's detail and its editor. The store's transitions themselves run on real SQLite (tests/review-store.node.ts);
// here the screens must offer exactly what the domain and the store allow, and call only the store's operations.
// Synthetic records only. Not a rendered iOS screen: VoiceOver, Dynamic Type and motion stay iPhone checks.

type Node = { type: any; props: Record<string, any>; rendered?: unknown };
const createdAt = '2026-09-01T12:00:00.000Z';
const today = domain.todayKey();
const bank: domain.Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 500000, createdAt };
const dollars: domain.Account = { id: 'usd', name: 'Ahorro USD', currency: 'USD', openingMinor: 0, createdAt };
const cardAccount: domain.Account = { id: 'visa-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: domain.CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 1000000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const archive: domain.LedgerArchive = { accounts: [bank, dollars, cardAccount], records: [], cards: [card], debts: [], recurring: [], budgets: [] };

function drafted(change: Partial<domain.ReviewDraft> = {}, base: domain.LedgerArchive = archive): domain.ReviewDraft {
  const draft: domain.ReviewDraft = { version: 1, source: 'assistant', capturedAt: createdAt, kind: 'expense', amountMinor: 1500000, currency: 'ARS', merchant: 'Coto',
    category: 'Supermercado', dateISO: today, destinationId: bank.id, purchase: null, basis: [], ...change };
  return { ...draft, basis: domain.reviewBasis(draft, base as domain.ReviewArchive) };
}
let sequence = 0;
function itemOf(draft: domain.ReviewDraft, change: Partial<ReviewItem> = {}): ReviewItem {
  sequence += 1;
  const at = `2026-09-0${Math.min(sequence, 9)}T10:00:00.000Z`;
  return { id: 'item-' + sequence, source: draft.source, captureKey: null, draft, writeId: 'write-' + sequence, status: 'pending', attempt: null, receipt: null,
    createdAt: at, updatedAt: at, revision: 0, ...change };
}
const trayOf = (items: ReviewItem[], change: Partial<ReviewTray> = {}): ReviewTray => ({ writable: true, items, unreadable: [], conflicts: [], ...change });

interface Ledger {
  review: ReviewTray | 'unavailable' | null;
  calls: unknown[][];
  confirmResult?: () => Promise<{ recorded: boolean }>;
  updateResult?: () => Promise<unknown>;
}
function harness(file: string, ledger: Ledger, params: Record<string, string> = {}, options: { locale?: AppLocale; dev?: boolean; canGoBack?: boolean } = {}) {
  const source = readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const refs: { current: unknown }[] = [];
  let cursor = 0, refCursor = 0;
  const pushed: unknown[] = [];
  const alerts: { title: string; detail: string; buttons: { text: string; style?: string; onPress?: () => void }[] }[] = [];
  const nav = { back: 0, replaced: [] as unknown[] };
  const i18n = { useI18n: () => bindLocale(options.locale ?? 'es-AR') };
  const useLedger = () => ({
    archive, snapshot: domain.snapshotFromArchive(archive), review: ledger.review,
    confirmReview: (...args: unknown[]) => { ledger.calls.push(['confirm', ...args]); return ledger.confirmResult?.() ?? Promise.resolve({ recorded: true }); },
    updateReview: (...args: unknown[]) => { ledger.calls.push(['update', ...args]); return ledger.updateResult?.() ?? Promise.resolve(args[2]); },
    dismissReview: (...args: unknown[]) => { ledger.calls.push(['dismiss', ...args]); return Promise.resolve(); },
  });
  const names = ['ActionButton', 'AmountField', 'AppText', 'Choices', 'DetailRow', 'EmptyState', 'ErrorMessage', 'Field', 'GlyphTile', 'IconButton', 'LifecycleNote',
    'Money', 'PressFeedback', 'Screen', 'SectionTitle', 'Surface'];
  const components = Object.fromEntries(names.map(name => [name, name]));
  const hues = { useCategoryLabel: (stored: string) => stored, useAccountNameOf: () => (account: domain.Account) => account.name };
  const theme = { space: { s: 8, m: 12, l: 16, xl: 24 }, usePalette: () => ({ ...lightPalette, isDark: false }) };
  const modules: Record<string, unknown> = {
    react: {
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
        return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (v: unknown) => unknown)(state[index]) : value; }];
      },
      useRef: (initial: unknown) => { const index = refCursor++; refs[index] ??= { current: initial }; return refs[index]; },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss: () => {} },
      Alert: { alert: (title: string, detail: string, buttons: any[]) => { alerts.push({ title, detail, buttons }); } } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => params,
      router: { push: (to: unknown) => pushed.push(to), back: () => { nav.back += 1; }, canGoBack: () => options.canGoBack ?? true, replace: (to: unknown) => nav.replaced.push(to) } },
    'expo-haptics': { notificationAsync: () => Promise.resolve(), NotificationFeedbackType: { Success: 'success' } },
    '@finanzapp/domain': domain,
  };
  for (const prefix of ['../', '../../']) Object.assign(modules, {
    [prefix + 'src/storage/LedgerProvider']: { useLedger },
    [prefix + 'src/storage/review-database']: {},
    [prefix + 'src/ui/components']: components,
    [prefix + 'src/ui/category-hues']: hues,
    // The vm's object literals carry its own Object.prototype, which the strict draft parser refuses: the editor's fields
    // cross into this realm as JSON, as they would arrive from one realm in the app.
    [prefix + 'src/ui/review-presentation']: { ...reviewPresentation, editedReviewDraft: (draft: domain.ReviewDraft, edit: unknown, base: domain.ReviewArchive) =>
      reviewPresentation.editedReviewDraft(draft, JSON.parse(JSON.stringify(edit)), base) },
    [prefix + 'src/ui/theme']: theme,
    [prefix + 'src/i18n/provider']: i18n,
    [prefix + 'src/ui/form-controls']: { AccountField: 'AccountField', CategoryField: 'CategoryField', DateField: 'DateField' },
    [prefix + 'src/ui/purchase-plan']: purchasePlan,
    [prefix + 'src/ui/installment-presentation']: installmentPresentation,
    [prefix + 'src/ui/liability-presentation']: liabilityPresentation,
    [prefix + 'src/ui/money-input']: moneyInput,
  });
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, Error, Date, Promise, __DEV__: options.dev ?? false, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected review dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; refCursor = 0; return module.exports.default!(); }, pushed, alerts, nav };
}
/** Every node, local components rendered once per element (their hooks run in traversal order, as React would). */
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  if (typeof value.type === 'function') value.rendered ??= value.type(value.props);
  return [value, ...(typeof value.type === 'function' ? nodes(value.rendered) : []), ...nodes(value.props.children)];
}
const all = (root: Node, type: string) => nodes(root).filter(node => node.type === type);
const text = (node: Node): string => ([] as unknown[]).concat(node.props.children).filter(part => typeof part === 'string' || typeof part === 'number').join('');
const texts = (root: Node) => all(root, 'AppText').map(text);
const button = (root: Node, label: string) => all(root, 'ActionButton').find(node => node.props.label.startsWith(label));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

// ---- the tray -----------------------------------------------------------------------------------------------------------

test('the tray lists the pending proposals in the store\'s order (oldest first), each opening its detail; nothing on it writes', () => {
  const first = itemOf(drafted({ merchant: 'Primero' })), second = itemOf(drafted({ merchant: 'Segundo', kind: 'income', category: 'Sueldo' }));
  const ledger: Ledger = { review: trayOf([first, second]), calls: [] };
  const view = harness('review.tsx', ledger);
  const root = view.render();
  const rows = all(root, 'PressFeedback');
  assert.equal(rows.length, 2);
  assert.equal(rows.map(row => texts(row)[0]).join('|'), 'Primero|Segundo', 'never re-sorted by the screen');
  rows[1].props.onPress();
  assert.equal(JSON.stringify(view.pushed), JSON.stringify([{ pathname: '/review/[id]', params: { id: second.id } }]));
  assert.equal(ledger.calls.length, 0, 'opening a row writes nothing');
  assert.equal(texts(root)[0], 'Propuestas que esperan tu confirmación. Nada se registra hasta que confirmes.');
});

test('a row names kind, amount, merchant, category, destination, date, source and the instalment mode; missing facts say so, never invented', () => {
  const plan = itemOf(drafted({ destinationId: cardAccount.id, purchase: { mode: 'installments', count: 6, placement: 'current' } }));
  const empty = itemOf(drafted({ amountMinor: null, currency: null, merchant: null, category: null, destinationId: null, dateISO: null, kind: null }));
  const root = harness('review.tsx', { review: trayOf([plan, empty]), calls: [] }).render();
  const [planRow, emptyRow] = all(root, 'PressFeedback');
  const money = all(planRow, 'Money')[0];
  assert.deepEqual([money.props.minor, money.props.currency], [1500000, 'ARS']);
  assert.deepEqual(texts(planRow), ['Coto', 'Gasto · Supermercado · Visa', `${i18nFormat.formatDate(today, 'day', 'es-AR')} · En 6 cuotas · Asistente`, 'Lista para confirmar']);
  assert.equal(all(emptyRow, 'Money').length, 0, 'no amount drawn without one');
  assert.deepEqual(texts(emptyRow), ['Sin comercio', 'Sin monto', 'Gasto o ingreso · Falta completar · Falta completar', 'Falta completar · Asistente', 'Faltan 7 datos']);
  // VoiceOver: one sentence, the amount and the date in their spoken forms.
  assert.equal(planRow.props.accessibilityLabel, `Gasto, 15000,00 pesos, Coto, Supermercado, Dónde se registra: Visa, ${i18nFormat.formatDate(today, 'long', 'es-AR')}, En 6 cuotas, Asistente, Lista para confirmar`);
  assert.match(emptyRow.props.accessibilityLabel, /^Gasto o ingreso, Sin monto, Sin comercio, Categoría: Falta completar, Dónde se registra: Falta completar, Fecha: Falta completar, Asistente, Faltan 7 datos$/);
});

test('an incomplete draft reads neutral, never as an error; stale and interrupted ask in amber; only a conflict takes the negative tone; lime is never a state', () => {
  const incomplete = itemOf(drafted({ category: null }));
  const stale = itemOf({ ...drafted(), basis: [{ kind: 'account', id: bank.id, revision: 4 }] });
  const interrupted = itemOf(drafted(), { attempt: domain.writeForReviewDraft(drafted(), archive as domain.ReviewArchive, { writeId: 'w-x', createdAt, todayISO: today }) });
  const conflict = itemOf(drafted());
  const root = harness('review.tsx', { review: trayOf([incomplete, stale, interrupted, conflict], { conflicts: [conflict.id] }), calls: [] }).render();
  const states = all(root, 'PressFeedback').map(row => all(row, 'AppText').at(-1)!);
  assert.deepEqual(states.map(text), ['Falta 1 dato', 'Revisala de nuevo', 'Registro sin verificar', 'Ya existe otro registro']);
  assert.deepEqual(states.map(node => node.props.style.color), [lightPalette.secondary, lightPalette.warning, lightPalette.warning, lightPalette.expense]);
  for (const node of states) assert.notEqual(node.props.style.color, lightPalette.primaryFill);
});

test('unreadable rows are counted apart and never listed; an empty tray, an unavailable store and a newer build\'s file each say so', () => {
  let root = harness('review.tsx', { review: trayOf([], { unreadable: ['bad-1', 'bad-2'] }), calls: [] }).render();
  assert.equal(all(root, 'PressFeedback').length, 0, 'an unreadable row is never a proposal');
  assert.ok(texts(root).includes('2 propuestas no se pueden leer. No se registrará nada con ellas.'));
  assert.equal(all(root, 'EmptyState')[0].props.title, 'Nada para revisar');
  root = harness('review.tsx', { review: 'unavailable', calls: [] }).render();
  assert.equal(all(root, 'EmptyState')[0].props.detail, 'No pudimos abrir las propuestas. Tus movimientos no cambiaron.');
  root = harness('review.tsx', { review: trayOf([itemOf(drafted())], { writable: false }), calls: [] }).render();
  assert.equal(all(root, 'LifecycleNote')[0].props.detail, 'Estas propuestas vienen de una versión más nueva de FinanzApp: se pueden ver, no modificar.');
});

test('the tray has no in-app producer: no development action creates a proposal, in any build; the Assistant is the one producer', () => {
  for (const dev of [false, true]) {
    const root = harness('review.tsx', { review: trayOf([]), calls: [] }, {}, { dev }).render();
    assert.equal(all(root, 'ActionButton').length, 0, 'synthetic proposals live in tests only (AGENTS.md rule 6)');
  }
  assert.doesNotMatch(readFileSync(new URL('../app/review.tsx', import.meta.url), 'utf8'), /randomUUID|capture|fixture|__DEV__/);
  // 25A-04: the one producer is the Assistant (a real proposal, never a fixture: its preview never captures).
  const callers = (dir: string): string[] => readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? callers(dir + '/' + entry.name) : /\.tsx?$/.test(entry.name) && /captureReview\(/.test(readFileSync(new URL('../' + dir + '/' + entry.name, import.meta.url), 'utf8')) ? [dir + '/' + entry.name] : []);
  assert.deepEqual([...callers('app'), ...callers('src/ui')], ['app/assistant.tsx']);
});

// ---- the detail ---------------------------------------------------------------------------------------------------------

test('a complete, current proposal: what will be recorded, where and when, and Confirmar (the one lime action) calls the store once at the shown revision', async () => {
  const item = itemOf(drafted(), { revision: 3 });
  const ledger: Ledger = { review: trayOf([item]), calls: [] };
  const view = harness('review/[id].tsx', ledger, { id: item.id });
  let root = view.render();
  assert.ok(texts(root).includes('Al confirmar se registra un gasto.'));
  const rows = Object.fromEntries(all(root, 'DetailRow').map(row => [row.props.label, row.props.value]));
  assert.deepEqual(rows, { Tipo: 'Gasto', Monto: '$ 15.000,00', 'Comercio o concepto': 'Coto', Categoría: 'Supermercado', Cuenta: 'Banco',
    Fecha: i18nFormat.formatDate(today, 'dayYear', 'es-AR'), Origen: 'Asistente' });
  const confirm = button(root, 'Confirmar')!;
  assert.deepEqual([confirm.props.label, confirm.props.spokenLabel, confirm.props.disabled, confirm.props.secondary], ['Confirmar · $ 15.000,00', 'Confirmar, 15000,00 pesos', false, undefined],
    'the primary (lime) fill; Editar and Descartar are secondary');
  assert.deepEqual(['Editar', 'Descartar'].map(label => button(root, label)!.props.secondary), [true, true]);
  confirm.props.onPress();
  confirm.props.onPress(); // A second tap while the first is in flight does nothing.
  await settle();
  assert.deepEqual(ledger.calls, [['confirm', item.id, 3]]);
  assert.equal(view.nav.back, 1, 'back to the tray once recorded');
  root = view.render();
  assert.equal(all(root, 'ErrorMessage')[0].props.message, null);
});

test('a proposal this screen confirmed leaves the tray before the pop: it stays drawn with its actions held, never «no longer pending»; a refusal releases them', async () => {
  const item = itemOf(drafted());
  const ledger: Ledger = { review: trayOf([item]), calls: [] };
  ledger.confirmResult = () => { ledger.review = trayOf([]); return Promise.resolve({ recorded: true }); };
  const view = harness('review/[id].tsx', ledger, { id: item.id });
  button(view.render(), 'Confirmar')!.props.onPress();
  await settle();
  let root = view.render();
  assert.equal(all(root, 'EmptyState').length, 0);
  assert.equal(button(root, 'Confirmar')!.props.busy, true, 'held while the screen pops');
  // Another item that vanishes without this screen acting (confirmed elsewhere, reconciled) says it is no longer pending.
  const other = itemOf(drafted());
  const elsewhere: Ledger = { review: trayOf([other]), calls: [] };
  const second = harness('review/[id].tsx', elsewhere, { id: other.id });
  second.render();
  elsewhere.review = trayOf([]);
  assert.equal(all(second.render(), 'EmptyState')[0].props.title, 'Esta propuesta ya no está pendiente');
  // A refusal: the actions come back.
  const refused: Ledger = { review: trayOf([item]), calls: [], confirmResult: () => Promise.reject(new Error(domain.REVIEW_INCOMPLETE_MESSAGE)) };
  const third = harness('review/[id].tsx', refused, { id: item.id });
  button(third.render(), 'Confirmar')!.props.onPress();
  await settle();
  root = third.render();
  assert.deepEqual([button(root, 'Confirmar')!.props.busy, button(root, 'Descartar')!.props.disabled], [false, false]);
});

test('missing fields are listed by name and keep Confirmar disabled; nothing reads as an error', () => {
  const item = itemOf(drafted({ category: null, destinationId: null }));
  const root = harness('review/[id].tsx', { review: trayOf([item]), calls: [] }, { id: item.id }).render();
  assert.equal(button(root, 'Confirmar')!.props.disabled, true);
  assert.deepEqual(all(root, 'LifecycleNote').map(note => [note.props.detail, note.props.tone ?? 'neutral']),
    [['Elegí una cuenta o tarjeta disponible.', 'neutral'], ['Elegí una categoría que ya uses.', 'neutral']]);
  assert.equal(all(root, 'SectionTitle')[0].props.children, 'Para confirmar falta');
  const rows = Object.fromEntries(all(root, 'DetailRow').map(row => [row.props.label, row.props.value]));
  assert.deepEqual([rows['Dónde se registra'], rows['Categoría']], ['Falta completar', 'Falta completar']);
  assert.equal(all(root, 'ErrorMessage')[0].props.message, null);
});

test('a stale basis keeps Confirmar disabled and asks to review it in Editar; a recorded conflict offers only Descartar, and nothing with a frozen write', () => {
  const stale = itemOf({ ...drafted(), basis: [{ kind: 'account', id: bank.id, revision: 9 }] });
  let root = harness('review/[id].tsx', { review: trayOf([stale]), calls: [] }, { id: stale.id }).render();
  assert.equal(button(root, 'Confirmar')!.props.disabled, true);
  assert.equal(all(root, 'LifecycleNote').find(note => note.props.icon === 'refresh-outline')!.props.tone, 'warning');
  assert.equal(button(root, 'Editar')!.props.disabled, false);
  const conflict = itemOf(drafted());
  root = harness('review/[id].tsx', { review: trayOf([conflict], { conflicts: [conflict.id] }), calls: [] }, { id: conflict.id }).render();
  assert.equal(all(root, 'ActionButton').map(node => node.props.label).join(','), 'Descartar', 'the store refuses a confirmation or an edit; a dismissal stays possible');
  assert.match(all(root, 'LifecycleNote')[0].props.detail, /no se puede confirmar ni editar/);
  // With a frozen write on it the store refuses the dismissal too (it must settle first): nothing is offered.
  const frozen = itemOf(drafted(), { attempt: domain.writeForReviewDraft(drafted(), archive as domain.ReviewArchive, { writeId: 'w', createdAt, todayISO: today }) });
  root = harness('review/[id].tsx', { review: trayOf([frozen], { conflicts: [frozen.id] }), calls: [] }, { id: frozen.id }).render();
  assert.equal(all(root, 'ActionButton').length, 0);
});

test('an interrupted write is retried through the store (it finds the ledger\'s write or writes the frozen one): Confirmar says so, at the shown revision', async () => {
  const draft = drafted();
  const item = itemOf(draft, { revision: 1, attempt: domain.writeForReviewDraft(draft, archive as domain.ReviewArchive, { writeId: 'w', createdAt, todayISO: today }) });
  const ledger: Ledger = { review: trayOf([item]), calls: [], confirmResult: () => Promise.resolve({ recorded: false }) };
  const view = harness('review/[id].tsx', ledger, { id: item.id });
  const root = view.render();
  assert.equal(all(root, 'LifecycleNote')[0].props.detail, 'Un intento anterior de registrarla no se pudo verificar. Confirmar lo busca en tus datos y lo completa una sola vez.');
  const retry = button(root, 'Reintentar confirmación')!;
  assert.equal(retry.props.disabled, false);
  retry.props.onPress();
  await settle();
  assert.deepEqual(ledger.calls, [['confirm', item.id, 1]]);
  assert.equal(view.nav.back, 1, 'saved either way: an unmarked item is marked by the next reconciliation, never reported as a failure');
});

test('a refusal from the store (the proposal changed, or went stale) is shown and nothing navigates; the next tap asks again', async () => {
  const item = itemOf(drafted());
  const ledger: Ledger = { review: trayOf([item]), calls: [], confirmResult: () => Promise.reject(new Error(domain.REVIEW_STALE_MESSAGE)) };
  const view = harness('review/[id].tsx', ledger, { id: item.id });
  button(view.render(), 'Confirmar')!.props.onPress();
  await settle();
  const root = view.render();
  assert.equal(all(root, 'ErrorMessage')[0].props.message, domain.REVIEW_STALE_MESSAGE);
  assert.equal(view.nav.back, 0);
  button(root, 'Confirmar')!.props.onPress();
  await settle();
  assert.equal(ledger.calls.length, 2);
});

test('Entry or InstallmentPlan: the detail says which one Confirmar writes, and a card\'s mode is shown, never assumed', () => {
  const plan = itemOf(drafted({ destinationId: cardAccount.id, purchase: { mode: 'installments', count: 6, placement: 'next' } }));
  const once = itemOf(drafted({ destinationId: cardAccount.id, purchase: { mode: 'once' } }));
  const open = itemOf(drafted({ destinationId: cardAccount.id, purchase: null }));
  const income = itemOf(drafted({ kind: 'income', category: 'Sueldo' }));
  const render = (item: ReviewItem) => harness('review/[id].tsx', { review: trayOf([plan, once, open, income]), calls: [] }, { id: item.id }).render();
  const pago = (root: Node) => all(root, 'DetailRow').find(row => row.props.label === 'Pago')?.props.value;
  assert.ok(texts(render(plan)).includes('Al confirmar se registra una compra en 6 cuotas: cada cuota se suma al cerrar su resumen, no hoy.'));
  assert.equal(pago(render(plan)), 'En 6 cuotas');
  assert.equal(all(render(plan), 'DetailRow').find(row => row.props.label === 'Tarjeta')!.props.value, 'Visa');
  assert.ok(texts(render(once)).includes('Al confirmar se registra un gasto en la tarjeta.'));
  assert.equal(pago(render(once)), 'Una vez');
  assert.equal(pago(render(open)), 'Falta completar', 'a card without a chosen mode is a gap, not «Una vez»');
  assert.equal(button(render(open), 'Confirmar')!.props.disabled, true);
  assert.ok(texts(render(income)).includes('Al confirmar se registra un ingreso.'));
  assert.equal(pago(render(income)), undefined);
});

test('Descartar asks first, then dismisses at the shown revision; cancelling changes nothing', async () => {
  const item = itemOf(drafted(), { revision: 2 });
  const ledger: Ledger = { review: trayOf([item]), calls: [] };
  const view = harness('review/[id].tsx', ledger, { id: item.id });
  button(view.render(), 'Descartar')!.props.onPress();
  const [alert] = view.alerts;
  assert.deepEqual([alert.title, alert.detail], ['¿Descartar esta propuesta?', 'No se registra nada y no vuelve a aparecer. Tus movimientos no cambian.']);
  assert.equal(JSON.stringify(alert.buttons.map(item => [item.text, item.style])), JSON.stringify([['Cancelar', 'cancel'], ['Descartar', 'destructive']]));
  alert.buttons[0].onPress?.();
  assert.equal(ledger.calls.length, 0);
  alert.buttons[1].onPress!();
  await settle();
  assert.deepEqual(ledger.calls, [['dismiss', item.id, 2]]);
  assert.equal(view.nav.back, 1);
});

test('a confirmed, dismissed or unreadable id is not pending: the detail says so and offers nothing', () => {
  const kept = itemOf(drafted());
  for (const review of [trayOf([kept]), trayOf([], { unreadable: ['gone'] }), 'unavailable' as const]) {
    const root = harness('review/[id].tsx', { review, calls: [] }, { id: 'gone' }).render();
    assert.equal(all(root, 'EmptyState')[0].props.title, 'Esta propuesta ya no está pendiente');
    assert.equal(all(root, 'ActionButton').length, 0);
  }
});

test('a newer build\'s review file is shown read only: no Confirmar, Editar or Descartar', () => {
  const item = itemOf(drafted());
  const root = harness('review/[id].tsx', { review: trayOf([item], { writable: false }), calls: [] }, { id: item.id }).render();
  assert.equal(all(root, 'ActionButton').length, 0);
  assert.ok(all(root, 'LifecycleNote').some(note => note.props.detail.startsWith('Estas propuestas vienen de una versión más nueva')));
});

test('English: the tray, the detail and the editor follow the interface language', () => {
  const item = itemOf(drafted({ category: null }));
  const tray = harness('review.tsx', { review: trayOf([item]), calls: [] }, {}, { locale: 'en-US' }).render();
  assert.equal(texts(all(tray, 'PressFeedback')[0]).at(-1), '1 detail missing');
  const detail = harness('review/[id].tsx', { review: trayOf([item]), calls: [] }, { id: item.id }, { locale: 'en-US' }).render();
  assert.equal(button(detail, 'Confirm')!.props.disabled, true);
  assert.equal(all(detail, 'LifecycleNote')[0].props.detail, 'Choose a category you already use.');
});

// ---- the editor ---------------------------------------------------------------------------------------------------------

function editor(item: ReviewItem, ledger: Ledger = { review: trayOf([item]), calls: [] }) {
  const view = harness('edit-review/[id].tsx', ledger, { id: item.id });
  return { view, ledger, root: () => view.render() };
}
const field = (root: Node, type: string) => all(root, type)[0];
const choices = (root: Node) => all(root, 'Choices');

test('Editar keeps the item\'s id, source and capture, saves at the revision it opened, and re-bases the draft on what the person reviewed', async () => {
  const item = itemOf({ ...drafted(), basis: [{ kind: 'account', id: bank.id, revision: 9 }] }, { revision: 4 });
  const { view, ledger, root } = editor(item);
  field(root(), 'Field').props.onChangeText('Coto Palermo');
  // The store moves on while the editor is open (another edit): the editor still sends the revision it opened.
  ledger.review = trayOf([{ ...item, revision: 5 }]);
  button(root(), 'Guardar cambios')!.props.onPress();
  await settle();
  const [[kind, id, revision, draft]] = ledger.calls as [string, string, number, domain.ReviewDraft][];
  assert.deepEqual([kind, id, revision], ['update', item.id, 4]);
  assert.deepEqual([draft.source, draft.capturedAt, draft.merchant], [item.draft.source, item.draft.capturedAt, 'Coto Palermo']);
  assert.equal(JSON.stringify(draft.basis), JSON.stringify(domain.reviewBasis(draft, archive as domain.ReviewArchive)), 'reviewed against the ledger now');
  assert.equal(domain.isStaleReviewDraft(draft, archive as domain.ReviewArchive), false);
  assert.equal(view.nav.back, 1);
});

test('Editar refused because the proposal changed since it opened: the message shows, the editor stays open, nothing else is written', async () => {
  const item = itemOf(drafted());
  const ledger: Ledger = { review: trayOf([item]), calls: [], updateResult: () => Promise.reject(new Error(REVIEW_ITEM_CHANGED_MESSAGE)) };
  const { view, root } = editor(item, ledger);
  button(root(), 'Guardar cambios')!.props.onPress();
  await settle();
  assert.equal(all(root(), 'ErrorMessage')[0].props.message, REVIEW_ITEM_CHANGED_MESSAGE);
  assert.equal(view.nav.back, 0);
  assert.equal(ledger.calls.length, 1);
});

test('nothing is filled in: no kind, destination or amount scale is chosen for the person, and the amount is entered in the destination\'s currency', async () => {
  const item = itemOf(drafted({ kind: null, amountMinor: null, currency: null, category: null, destinationId: null }));
  const { ledger, root } = editor(item);
  let screen = root();
  assert.equal(choices(screen)[0].props.value, null, 'Gasto | Ingreso with no thumb');
  assert.equal(all(screen, 'AmountField').length, 0, 'no currency yet: no amount field');
  assert.ok(texts(screen).includes('Elegí dónde se registra para cargar el monto en su moneda.'));
  assert.equal(field(screen, 'AccountField').props.value, '');
  assert.deepEqual(field(screen, 'AccountField').props.accounts.map((account: domain.Account) => account.id), [bank.id, dollars.id, cardAccount.id],
    'the kind is open: an expense\'s destinations, never a debt');
  field(screen, 'AccountField').props.onChange(dollars.id);
  screen = root();
  assert.equal(field(screen, 'AmountField').props.currency, 'USD');
  field(screen, 'AmountField').props.onChangeText('12,50');
  button(root(), 'Guardar cambios')!.props.onPress();
  await settle();
  const draft = (ledger.calls[0] as any[])[3] as domain.ReviewDraft;
  assert.deepEqual([draft.kind, draft.amountMinor, draft.currency, draft.destinationId, draft.category], [null, 1250, 'USD', dollars.id, null]);
  assert.deepEqual(domain.reviewGaps(draft, archive as domain.ReviewArchive, today), ['kind', 'category'], 'still a draft: what is missing stays missing');
});

test('a producer\'s currency is never reinterpreted: only destinations in it are offered', () => {
  const item = itemOf(drafted({ currency: 'USD', amountMinor: 3000, destinationId: null }));
  const screen = editor(item).root();
  assert.deepEqual(field(screen, 'AccountField').props.accounts.map((account: domain.Account) => account.id), [dollars.id]);
  assert.equal(field(screen, 'AmountField').props.value, '30,00', 'its own amount, in its own currency');
});

test('a card purchase: «Pago» starts unchosen, cuotas start with no count (never 12), and a card purchase never becomes cuotas unless chosen', async () => {
  const item = itemOf(drafted({ destinationId: cardAccount.id, purchase: null }));
  const { ledger, root } = editor(item);
  let screen = root();
  const [, mode] = choices(screen);
  assert.equal(mode.props.value, null);
  button(screen, 'Guardar cambios')!.props.onPress();
  await settle();
  assert.equal(((ledger.calls[0] as any[])[3] as domain.ReviewDraft).purchase, null, 'saved untouched: still no mode, still a gap');
  mode.props.onChange('installments');
  screen = root();
  const [, , count, placement] = choices(screen);
  assert.equal(count.props.value, null, 'no count preselected');
  assert.deepEqual(count.props.options.map((option: any) => option.value), ['3', '6', '12', '18', 'other']);
  assert.equal(placement.props.value, 'current');
  ledger.calls.length = 0;
  button(screen, 'Guardar cambios')!.props.onPress();
  await settle();
  const open = ((ledger.calls[0] as any[])[3] as domain.ReviewDraft);
  assert.deepEqual(open.purchase, { mode: 'installments', count: null, placement: 'current' });
  assert.ok(domain.reviewGaps(open, archive as domain.ReviewArchive, today).includes('installmentCount'));
  count.props.onChange('6');
  ledger.calls.length = 0;
  button(root(), 'Guardar cambios')!.props.onPress();
  await settle();
  assert.deepEqual(((ledger.calls[0] as any[])[3] as domain.ReviewDraft).purchase, { mode: 'installments', count: 6, placement: 'current' });
});

test('a stored count shows as chosen, a typed one under «Otra»; an income or a cash account drops the purchase mode instead of carrying it', async () => {
  const typed = itemOf(drafted({ destinationId: cardAccount.id, purchase: { mode: 'installments', count: 24, placement: 'next' } }));
  let screen = editor(typed).root();
  assert.deepEqual([choices(screen)[2].props.value, all(screen, 'Field').at(-1)!.props.value, choices(screen)[3].props.value], ['other', '24', 'next']);
  const once = itemOf(drafted({ destinationId: cardAccount.id, purchase: { mode: 'once' } }));
  const { ledger, root } = editor(once);
  choices(root())[0].props.onChange('income');
  screen = root();
  assert.equal(choices(screen).length, 1, 'no «Pago» on an income');
  button(screen, 'Guardar cambios')!.props.onPress();
  await settle();
  const draft = (ledger.calls[0] as any[])[3] as domain.ReviewDraft;
  assert.deepEqual([draft.kind, draft.purchase, draft.destinationId], ['income', null, cardAccount.id], 'the card stays named (a destination gap), never swapped');
  assert.ok(domain.reviewGaps(draft, archive as domain.ReviewArchive, today).includes('destination'));
});

test('the editor only opens a pending item of a writable store', () => {
  const item = itemOf(drafted());
  for (const review of [trayOf([item], { writable: false }), trayOf([]), 'unavailable' as const]) {
    const root = harness('edit-review/[id].tsx', { review, calls: [] }, { id: item.id }).render();
    assert.equal(all(root, 'EmptyState')[0].props.title, 'Esta propuesta ya no está pendiente');
  }
});

// ---- the pure derivation ------------------------------------------------------------------------------------------------

test('canConfirm follows the domain and the store: gaps, a stale basis, a conflict or a read-only file each withhold it; an interrupted write keeps it', () => {
  const context = { todayISO: today, writable: true, conflicts: [] as string[] };
  const facts = (item: ReviewItem, change = {}) => reviewPresentation.reviewFacts(item, archive as domain.ReviewArchive, { ...context, ...change });
  const ready = itemOf(drafted());
  assert.deepEqual([facts(ready).state, facts(ready).canConfirm], ['ready', true]);
  assert.equal(facts(ready, { writable: false }).canConfirm, false);
  assert.deepEqual([facts(ready, { conflicts: [ready.id] }).state, facts(ready, { conflicts: [ready.id] }).canConfirm], ['conflict', false]);
  const future = itemOf(drafted({ dateISO: '2999-01-01' }));
  assert.deepEqual([facts(future).state, facts(future).gaps, facts(future).canConfirm], ['incomplete', ['date'], false]);
  const stale = itemOf({ ...drafted(), basis: [] });
  assert.deepEqual([facts(stale).state, facts(stale).canConfirm], ['stale', false]);
  const interrupted = itemOf({ ...drafted(), basis: [] }, { attempt: domain.writeForReviewDraft(drafted(), archive as domain.ReviewArchive, { writeId: 'w', createdAt, todayISO: today }) });
  assert.deepEqual([facts(interrupted).state, facts(interrupted).canConfirm], ['interrupted', true], 'the store re-checks it against the ledger');
  // A destination the ledger no longer offers (an archived card) is a gap, its name still shown.
  const archived = { ...archive, cards: [{ ...card, active: false }] };
  const onArchived = reviewPresentation.reviewFacts(itemOf(drafted({ destinationId: cardAccount.id, purchase: { mode: 'once' } })), archived as domain.ReviewArchive, context);
  assert.deepEqual([onArchived.destination?.name, onArchived.gaps.includes('destination'), onArchived.canConfirm], ['Visa', true, false]);
});

// ---- one write path ------------------------------------------------------------------------------------------------------

test('no second write path: the review screens never build or send a ledger write; the provider confirms only through the store, in the ledger\'s queue', () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  for (const file of ['app/review.tsx', 'app/review/[id].tsx', 'app/edit-review/[id].tsx', 'src/ui/review-presentation.ts']) {
    assert.doesNotMatch(read(file), /writeForReviewDraft|createEntry|createInstallmentPlan|savePurchasePlan|addEntry|addInstallmentPlan|newInstallmentPlan|openReviewStore/, file);
    assert.doesNotMatch(read(file), /^import \{[^}]*\} from '[^']*storage\/(review-database|database)'/m, file + ': types only from storage');
  }
  const provider = read('src/storage/LedgerProvider.tsx');
  assert.match(provider, /const reviewOperation = [\s\S]*?return rereadOnRefusal\(async db => \{[\s\S]*?finally \{ await loadReview\(db\); \}/, 'every review operation runs in the ledger\'s queue (re-reading it on a refusal) and reloads the tray');
  assert.match(provider, /confirmReview: \(id, expectedRevision\) => reviewOperation\(async store => \{\s*const result = await store\.confirm\(id, \{ expectedRevision, todayISO: todayKey\(\), at: new Date\(\)\.toISOString\(\) \}\);/);
  // A review file that cannot be opened never stops the ledger: its failure is caught and the ledger's archive is already set.
  assert.match(provider, /setArchive\(session\.archive\);\s*setError\(sessionWarning\(session\)\);\s*await loadReview\(db\);/);
  assert.match(provider, /const loadReview = async \(db: LedgerDatabase\) => \{\s*try \{[\s\S]*?\} catch \{/);
});

test('opened from a link with nothing under it, a confirmed proposal hands over to the tray instead of holding the screen', async () => {
  const item = itemOf(drafted());
  const view = harness('review/[id].tsx', { review: trayOf([item]), calls: [] }, { id: item.id }, { canGoBack: false });
  button(view.render(), 'Confirmar')!.props.onPress();
  await settle();
  assert.deepEqual([view.nav.back, JSON.stringify(view.nav.replaced)], [0, '["/review"]']);
});

test('an amount typed for one destination is cleared when a destination in another currency is chosen, never rescaled', () => {
  const item = itemOf(drafted({ amountMinor: null, currency: null, destinationId: null }));
  const { root } = editor(item);
  field(root(), 'AccountField').props.onChange(bank.id);
  field(root(), 'AmountField').props.onChangeText('100,00');
  field(root(), 'AccountField').props.onChange(cardAccount.id);
  assert.equal(field(root(), 'AmountField').props.value, '100,00', 'the same currency keeps it');
  field(root(), 'AccountField').props.onChange(dollars.id);
  assert.deepEqual([field(root(), 'AmountField').props.currency, field(root(), 'AmountField').props.value], ['USD', '']);
});

test('the review editor\'s category picker offers only existing categories, and one chosen there makes the draft confirmable', async () => {
  const custom = domain.editedCategoryDefinition(domain.resolveCategory('expense', 'Mascotas'), { label: 'Mascotas' }, createdAt);
  const withCustom: domain.LedgerArchive = { ...archive, categories: [custom] };
  assert.deepEqual(domain.reviewGaps(drafted({ category: 'Mascotas' }, withCustom), withCustom as domain.ReviewArchive, today), [], 'a stored custom category is known');
  const item = itemOf(drafted({ category: null }));
  const { ledger, root } = editor(item);
  const picker = field(root(), 'CategoryField');
  assert.equal(picker.props.allowCreate, false, 'no «Usar …» for a typed name in the review picker');
  picker.props.onChange('Supermercado');
  button(root(), 'Guardar cambios')!.props.onPress();
  await settle();
  const saved = (ledger.calls[0] as any[])[3] as domain.ReviewDraft;
  assert.deepEqual(domain.reviewGaps(saved, archive as domain.ReviewArchive, today), [], 'complete');
  const facts = reviewPresentation.reviewFacts(itemOf(saved), archive as domain.ReviewArchive, { todayISO: today, writable: true, conflicts: [] });
  assert.deepEqual([facts.state, facts.canConfirm], ['ready', true]);
});
