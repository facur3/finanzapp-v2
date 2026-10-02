import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as currencies from '../src/ui/currencies.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import * as cardCycleForm from '../src/ui/card-cycle-form.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule } from './real-module.ts';

// Producto 24T2 (stream B): the card form's statement dates. The real CardForm (src/ui/card-form.tsx) runs with the real
// date model (src/ui/card-cycle-form.ts and the domain's planner) on a harness day (`useCurrentDay`) a test can move, so a
// form left open past a closing can be exercised. Hosts are descriptors: the date wheel itself is tests/date-field.node.ts.
type Node = { type: any; props: Record<string, any> };

const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa Gold', currency: 'ARS', openingMinor: 0, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Galicia', last4: '4009', creditLimitMinor: 500000,
  closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const base: domain.LedgerArchive = { accounts: [cash, cardAccount], records: [], cards: [card] };

interface Options { data?: domain.LedgerArchive; day?: string; locale?: AppLocale; save?: () => Promise<void> }
function harness(props: { original?: domain.CreditCardProfile } = {}, options: Options = {}) {
  let data = options.data ?? base;
  let day = options.day ?? '2026-09-20';
  let locale: AppLocale = options.locale ?? 'es-AR';
  const state: unknown[] = [], refs: { current: unknown }[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0, removed = 0;
  const dismissed: unknown[] = [], replaced: unknown[] = [];
  const added: { account: domain.Account; card: domain.CreditCardProfile; rows: readonly domain.CardCycleDates[] | undefined }[] = [];
  const saved: { card: domain.CreditCardProfile; intent: unknown }[] = [];
  const alerts: { title: string; message: string; buttons: { text: string; onPress?: () => void }[] }[] = [];
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    addCard: async (account: domain.Account, profile: domain.CreditCardProfile, rows?: readonly domain.CardCycleDates[]) => { added.push({ account, card: profile, rows }); },
    saveCard: async (profile: domain.CreditCardProfile, intent?: unknown) => { saved.push({ card: profile, intent }); await options.save?.(); } }) };
  const components = Object.fromEntries(['ActionButton', 'AmountField', 'AppText', 'DetailRow', 'ErrorMessage', 'Field', 'IconButton', 'Screen', 'Surface'].map(name => [name, name]));
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (next: unknown) => { state[index] = typeof next === 'function' ? (next as (current: unknown) => unknown)(state[index]) : next; }]; },
    useRef: (initial: unknown) => { const index = refCursor++; return refs[index] ??= { current: initial }; }, useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss() {} }, Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => true, back: () => { backs++; }, push: () => {}, replace: (to: unknown) => { replaced.push(to); },
      dismissTo: (to: unknown) => { dismissed.push(to); } } },
    'expo-crypto': { randomUUID: () => 'id-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../i18n/provider': { useI18n: () => bindLocale(locale) },
    '../storage/LedgerProvider': ledger,
    './components': components,
    './card-cycle-form': cardCycleForm,
    './currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    './use-default-currency': { useDefaultCurrency: ({ accountCurrency }: { accountCurrency?: domain.Currency }) => accountCurrency ?? 'ARS' },
    // 24UX6E: «Eliminar tarjeta» hands the card to the confirmation flow (tests/lifecycle-actions.node.ts); here it confirms at once.
    './commitment-actions': { useCardManagement: () => ({ busyId: null, error: null, remove: (_card: unknown, done?: () => void) => { removed++; done?.(); } }) },
    './currencies': currencies,
    './form-controls': { DateField: 'DateField' },
    './money-input': moneyInput,
    './switch-row': { SwitchRow: 'SwitchRow' },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => day },
  };
  const source = readFileSync(new URL('../src/ui/card-form.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, (props: unknown) => Node> };
  runInNewContext(code, { module, exports: module.exports, Error, Date, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected card form dependency: ' + name);
    return modules[name];
  } });
  return {
    render: () => { cursor = 0; refCursor = 0; return module.exports.CardForm(props); },
    setData: (next: domain.LedgerArchive) => { data = next; }, setDay: (next: string) => { day = next; }, setLocale: (next: AppLocale) => { locale = next; },
    added, saved, alerts, backs: () => backs, dismissed, replaced, removed: () => removed,
  };
}

function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children)];
}
function find(root: Node, type: string, label?: string): Node {
  const node = nodes(root).find(item => item.type === type && (label === undefined || item.props.label === label));
  assert.ok(node, 'Missing ' + type + ' ' + (label ?? ''));
  return node;
}
const has = (root: Node, type: string) => nodes(root).some(node => node.type === type);
const textOf = (node: Node) => [node.props.children].flat(Infinity).map(child => typeof child === 'string' ? child : '').join('');
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(textOf);
const day = (dateISO: string) => new Date(dateISO + 'T12:00:00');
const keyOf = (value: Date | null) => value === null ? null : domain.todayKey(value);
const saveButton = (root: Node) => find(root, 'ActionButton');
type View = ReturnType<typeof harness>;
const pick = (view: View, label: string, dateISO: string) => { find(view.render(), 'DateField', label).props.onChange(day(dateISO)); };

// ---- the pure model -------------------------------------------------------------------------------------------------

test('24T2: a usual day keeps a 31 clamped to a short month; an edit changes only what the person changed', () => {
  assert.equal(cardCycleForm.usualDayOf('2026-09-30', 31), 31, 'September 30 of a card that closes on the 31st');
  assert.equal(cardCycleForm.usualDayOf('2026-09-30', 30), 30);
  assert.equal(cardCycleForm.usualDayOf('2026-09-29', 31), 29, 'not the month\'s last day: its own day');
  assert.equal(cardCycleForm.usualDayOf('2028-02-29', 30), 30, 'a leap February');
  assert.deepEqual(cardCycleForm.daysOfDates('2026-09-28', '2026-10-05'), { closingDay: 28, dueDay: 5 });
  const shown = domain.cardCycleView(card, [], '2026-10-01');
  const result = cardCycleForm.cycleEditResult(card, shown, { closingISO: shown.open.closingISO, dueISO: shown.open.dueISO, toPayDueISO: '2026-10-06', everyMonth: false });
  assert.equal(JSON.stringify(result.intent), JSON.stringify({ toPay: { statementClosingISO: '2026-09-28', dueISO: '2026-10-06' } }), 'only the part that changed');
  assert.deepEqual([result.changed, result.repeats, result.days.closingDay, result.days.dueDay], [true, false, 28, 5]);
  const same = cardCycleForm.cycleEditResult(card, shown, { closingISO: shown.open.closingISO, dueISO: shown.open.dueISO, toPayDueISO: shown.toPay!.dueISO, everyMonth: true });
  assert.deepEqual([same.changed, JSON.stringify(same.intent)], [false, '{}'], 'the usual days repeated every month change nothing');
});

test('24T2 review: the switch alone (an exact statement on another day, its dates kept) names the statement the form showed, so a form left open past its closing is refused', () => {
  // 28/5 with the open statement corrected once to 26 oct / 4 nov; the form opens on 25 oct and turns the switch on.
  const corrected = domain.planCardCycle({ cardId: card.id, days: card, rows: [], todayISO: '2026-10-20', nowISO: '2026-10-20T12:00:00.000Z',
    intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } } });
  const shown = domain.cardCycleView(card, corrected.rows, '2026-10-25');
  const result = cardCycleForm.cycleEditResult(card, shown, { closingISO: '2026-10-26', dueISO: '2026-11-04', toPayDueISO: null, everyMonth: true });
  assert.deepEqual([result.changed, result.days.closingDay, result.days.dueDay], [true, 26, 4]);
  assert.equal(JSON.stringify(result.intent), JSON.stringify({ open: { statementClosingISO: '2026-10-26', closingISO: '2026-10-26', dueISO: '2026-11-04' } }));
  const plan = (todayISO: string) => domain.planCardCycle({ cardId: card.id, days: card, rows: corrected.rows, todayISO, nowISO: '2026-10-27T12:00:00.000Z',
    intent: { ...result.intent, days: result.days } });
  const closings = plan('2026-10-25');
  assert.deepEqual(domain.cardStatementsFrom(closings.days, closings.rows, '2026-10-20', 0, 3).map(item => item.closingISO), ['2026-10-26', '2026-11-26', '2026-12-26']);
  assert.throws(() => plan('2026-10-27'), new RegExp(domain.CYCLE_STALE_MESSAGE), 'saved after the 26 oct closing it showed');
});

// ---- a new card ----------------------------------------------------------------------------------------------------

test('24T2: a new card asks its next closing and the due of that closing, both unchosen; the usual days are their days and no row is written when those days produce them', async () => {
  const view = harness();
  let root = view.render();
  const closing = find(root, 'DateField', 'Próximo cierre'), due = find(root, 'DateField', 'Vencimiento');
  assert.deepEqual([closing.props.value, due.props.value], [null, null], 'no guessed date: the person reads their statement');
  assert.deepEqual([closing.props.allowFuture, closing.props.last, due.props.allowFuture, due.props.last], [true, false, true, true], 'two rows in one group, a hairline between them');
  assert.equal(keyOf(closing.props.minimumDate), '2026-09-20', 'the next closing is today or later');
  assert.equal(has(root, 'SwitchRow'), false, 'a new card has no usual days to keep');
  assert.equal(has(root, 'Field') && nodes(root).some(node => node.type === 'Field' && /Día/.test(node.props.label)), false, 'the day numbers are gone');
  assert.ok(texts(root).includes('Están en tu resumen. FinanzApp no consulta al banco.'));
  find(root, 'Field', 'Nombre de la tarjeta').props.onChangeText('Visa Gold');
  assert.equal(saveButton(view.render()).props.disabled, true, 'Save waits for both dates');
  pick(view, 'Próximo cierre', '2026-09-28');
  root = view.render();
  assert.equal(keyOf(find(root, 'DateField', 'Vencimiento').props.minimumDate), '2026-09-29', 'the due comes after the closing');
  assert.equal(saveButton(root).props.disabled, true);
  pick(view, 'Vencimiento', '2026-10-05');
  root = view.render();
  assert.ok(texts(root).includes('Están en tu resumen. FinanzApp no consulta al banco. Los meses siguientes: cierre el día 28 y vencimiento el día 5.'));
  assert.equal(saveButton(root).props.disabled, false);
  await saveButton(root).props.onPress();
  assert.equal(view.added.length, 1);
  const { account, card: created, rows } = view.added[0];
  assert.deepEqual([account.name, account.currency, created.closingDay, created.dueDay, created.revision, created.active], ['Visa Gold', 'ARS', 28, 5, 0, true]);
  assert.equal(JSON.stringify(rows), '[]', 'the usual days already give 28 Sep / 5 Oct: no exact row');
  assert.equal(JSON.stringify(rows), JSON.stringify(domain.newCardCycle({ cardId: created.id, closingISO: '2026-09-28', dueISO: '2026-10-05', todayISO: '2026-09-20', nowISO: created.createdAt }).rows));
  assert.equal(view.backs(), 1);
});

test('24T2: a new card whose dates its days cannot produce is created with the exact rows newCardCycle gives, so the entered pair is its next statement', async () => {
  const view = harness();
  find(view.render(), 'Field', 'Nombre de la tarjeta').props.onChangeText('Naranja');
  pick(view, 'Próximo cierre', '2026-09-30');
  pick(view, 'Vencimiento', '2026-11-02');
  await saveButton(view.render()).props.onPress();
  const { card: created, rows } = view.added[0];
  assert.deepEqual([created.closingDay, created.dueDay], [30, 2]);
  const expected = domain.newCardCycle({ cardId: created.id, closingISO: '2026-09-30', dueISO: '2026-11-02', todayISO: '2026-09-20', nowISO: created.createdAt });
  assert.ok(expected.rows.length > 0);
  assert.equal(JSON.stringify(rows), JSON.stringify(expected.rows));
  assert.ok(rows!.every(row => row.cardId === created.id && row.createdAt === created.createdAt && row.revision === 0), 'rows of this new card, in its own commit');
  const open = domain.cardCycleView(created, rows!, '2026-09-20').open;
  assert.deepEqual([open.closingISO, open.dueISO, open.exact], ['2026-09-30', '2026-11-02', true]);
});

test('24T2: a new card refuses a closing before today and a due on or before the closing, with the catalogued sentence, before anything is sent', async () => {
  const view = harness();
  find(view.render(), 'Field', 'Nombre de la tarjeta').props.onChangeText('Visa');
  pick(view, 'Próximo cierre', '2026-09-19');
  pick(view, 'Vencimiento', '2026-10-05');
  await saveButton(view.render()).props.onPress();
  let message = find(view.render(), 'ErrorMessage').props.message;
  assert.equal(message, domain.CYCLE_NEXT_CLOSING_MESSAGE);
  assert.equal(bindLocale('en-US').errorText(message), 'The next closing date must be today or later.');
  assert.equal(view.added.length, 0);
  assert.equal(find(view.render(), 'Field', 'Nombre de la tarjeta').props.editable, true, 'nothing was sent: still editable');
  for (const dueISO of ['2026-09-28', '2026-09-27']) {
    pick(view, 'Próximo cierre', '2026-09-28');
    pick(view, 'Vencimiento', dueISO);
    await saveButton(view.render()).props.onPress();
    message = find(view.render(), 'ErrorMessage').props.message;
    assert.equal(message, domain.CYCLE_DUE_ORDER_MESSAGE, dueISO);
    assert.equal(bindLocale('en-US').errorText(message), 'A statement’s due date must come after its closing date.');
  }
  assert.equal(view.added.length, 0);
  pick(view, 'Vencimiento', '2026-10-05');
  await saveButton(view.render()).props.onPress();
  assert.equal(view.added.length, 1);
});

// ---- an existing card ----------------------------------------------------------------------------------------------

test('24T2: editing shows the open statement; correcting it sends the card with its usual days and the open dates, naming the statement shown', async () => {
  const view = harness({ original: card });
  let root = view.render();
  assert.equal(has(root, 'DateField') && nodes(root).filter(node => node.type === 'DateField').length, 2, 'no statement to pay on 20 Sep: its due (5 Sep) passed');
  assert.deepEqual([keyOf(find(root, 'DateField', 'Próximo cierre').props.value), keyOf(find(root, 'DateField', 'Vencimiento').props.value)], ['2026-09-28', '2026-10-05']);
  assert.equal(keyOf(find(root, 'DateField', 'Próximo cierre').props.minimumDate), '2026-08-29', 'after the previous closing (a closing before today is allowed)');
  assert.deepEqual([find(root, 'DateField', 'Vencimiento').props.last, find(root, 'SwitchRow').props.value, find(root, 'SwitchRow').props.last], [false, false, true]);
  assert.equal(find(root, 'SwitchRow').props.label, 'Usar estos días todos los meses');
  pick(view, 'Próximo cierre', '2026-09-29');
  pick(view, 'Vencimiento', '2026-10-06');
  root = view.render();
  assert.ok(texts(root).includes('Están en tu resumen. FinanzApp no consulta al banco. Estas fechas corrigen solo este resumen. Los meses siguientes: cierre el día 28 y vencimiento el día 5.'), 'a one-off shift keeps the usual days, and says so');
  await saveButton(root).props.onPress();
  assert.equal(view.saved.length, 1);
  const { card: submitted, intent } = view.saved[0];
  assert.deepEqual([submitted.closingDay, submitted.dueDay, submitted.revision, submitted.issuer, submitted.creditLimitMinor], [28, 5, 1, 'Galicia', 500000]);
  assert.equal(JSON.stringify(intent), JSON.stringify({ open: { statementClosingISO: '2026-09-28', closingISO: '2026-09-29', dueISO: '2026-10-06' } }));
  // What storage plans from it: the statement that closed is frozen, the open one takes its exact dates.
  const plan = domain.planCardCycle({ cardId: card.id, days: card, rows: [], todayISO: '2026-09-20', nowISO: submitted.updatedAt, intent: { ...(intent as object), days: submitted } });
  assert.deepEqual(plan.rows.map(row => row.closingISO + '/' + row.dueISO), ['2026-08-28/2026-09-05', '2026-09-29/2026-10-06']);
  assert.equal(view.backs(), 1);
});

test('24T2: a closed statement still to pay shows its due first, labelled by its closing; correcting it sends only that due', async () => {
  const view = harness({ original: card }, { day: '2026-10-01' });
  let root = view.render();
  const toPay = find(root, 'DateField', 'Vence el resumen del 28 sep');
  assert.equal(keyOf(toPay.props.value), '2026-10-05');
  assert.equal(keyOf(toPay.props.minimumDate), '2026-09-29');
  assert.deepEqual(nodes(root).filter(node => node.type === 'DateField').map(node => node.props.label), ['Vence el resumen del 28 sep', 'Próximo cierre', 'Vencimiento'],
    'the next due first (5 Oct), then the open statement (28 Oct, due 5 Nov): two facts, never one line');
  assert.deepEqual([keyOf(find(root, 'DateField', 'Próximo cierre').props.value), keyOf(find(root, 'DateField', 'Vencimiento').props.value)], ['2026-10-28', '2026-11-05']);
  pick(view, 'Vence el resumen del 28 sep', '2026-10-06');
  await saveButton(view.render()).props.onPress();
  const { card: submitted, intent } = view.saved[0];
  assert.equal(JSON.stringify(intent), JSON.stringify({ toPay: { statementClosingISO: '2026-09-28', dueISO: '2026-10-06' } }));
  assert.deepEqual([submitted.closingDay, submitted.dueDay, submitted.revision], [28, 5, 1]);
});

test('24T2: «Usar estos días todos los meses» makes the entered days the usual ones; however far the closing moved, it stays the person\'s choice', async () => {
  const view = harness({ original: card });
  pick(view, 'Próximo cierre', '2026-09-25');
  pick(view, 'Vencimiento', '2026-10-03');
  find(view.render(), 'SwitchRow').props.onValueChange(true);
  let root = view.render();
  assert.equal(find(root, 'SwitchRow').props.value, true);
  assert.ok(texts(root).some(text => text.endsWith('Los meses siguientes: cierre el día 25 y vencimiento el día 3.')));
  await saveButton(root).props.onPress();
  assert.deepEqual([view.saved[0].card.closingDay, view.saved[0].card.dueDay], [25, 3]);
  assert.equal(JSON.stringify(view.saved[0].intent), JSON.stringify({ open: { statementClosingISO: '2026-09-28', closingISO: '2026-09-25', dueISO: '2026-10-03' } }));

  // Seventeen days away is still a correction of this statement alone unless the person turns the switch on.
  const moved = harness({ original: card });
  pick(moved, 'Próximo cierre', '2026-10-15');
  pick(moved, 'Vencimiento', '2026-10-25');
  root = moved.render();
  const switchRow = find(root, 'SwitchRow');
  assert.deepEqual([switchRow.props.value, switchRow.props.disabled, switchRow.props.detail], [false, false, undefined], 'never forced by distance');
  assert.ok(texts(root).includes('Están en tu resumen. FinanzApp no consulta al banco. Estas fechas corrigen solo este resumen. Los meses siguientes: cierre el día 28 y vencimiento el día 5.'));
  await saveButton(root).props.onPress();
  assert.deepEqual([moved.saved[0].card.closingDay, moved.saved[0].card.dueDay], [28, 5], 'the usual days stay');
  assert.equal(JSON.stringify(moved.saved[0].intent), JSON.stringify({ open: { statementClosingISO: '2026-09-28', closingISO: '2026-10-15', dueISO: '2026-10-25' } }));
  // The same dates with the switch on: their days become the usual ones.
  const repeated = harness({ original: card });
  pick(repeated, 'Próximo cierre', '2026-10-15');
  pick(repeated, 'Vencimiento', '2026-10-25');
  find(repeated.render(), 'SwitchRow').props.onValueChange(true);
  await saveButton(repeated.render()).props.onPress();
  assert.deepEqual([repeated.saved[0].card.closingDay, repeated.saved[0].card.dueDay], [15, 25]);

  // A card that closes on the 31st shows 30 September; repeating it keeps the 31st, so nothing changes and nothing is written.
  const last = { ...card, closingDay: 31 };
  const clamped = harness({ original: last }, { data: { ...base, cards: [last] } });
  assert.equal(keyOf(find(clamped.render(), 'DateField', 'Próximo cierre').props.value), '2026-09-30');
  find(clamped.render(), 'SwitchRow').props.onValueChange(true);
  assert.ok(texts(clamped.render()).some(text => text.endsWith('cierre el día 31 y vencimiento el día 5.')));
  await saveButton(clamped.render()).props.onPress();
  assert.deepEqual([clamped.saved.length, clamped.backs()], [0, 1]);
});

test('24T2: a form showing a stale statement is refused by the planner with the catalogued sentence, and nothing is sent; unchanged closes without writing', async () => {
  // The day passed the closing the form showed (opened on 27 Sep, saved on 29 Sep).
  const late = harness({ original: card }, { day: '2026-09-27' });
  assert.equal(keyOf(find(late.render(), 'DateField', 'Próximo cierre').props.value), '2026-09-28');
  late.setDay('2026-09-29');
  assert.equal(keyOf(find(late.render(), 'DateField', 'Próximo cierre').props.value), '2026-09-28', 'the form keeps the statement it opened on');
  pick(late, 'Vencimiento', '2026-10-06');
  await saveButton(late.render()).props.onPress();
  const message = find(late.render(), 'ErrorMessage').props.message;
  assert.equal(message, domain.CYCLE_STALE_MESSAGE);
  assert.equal(bindLocale('es-AR').errorText(message), 'Las fechas del ciclo cambiaron desde que abriste la tarjeta. Volvé a revisarlas.');
  assert.equal(bindLocale('en-US').errorText(message), 'The card’s cycle dates changed since you opened it. Review them again.');
  assert.equal(late.saved.length, 0, 'refused locally: saveCard never ran');
  assert.equal(find(late.render(), 'Field', 'Emisor (opcional)').props.editable, true, 'and the draft stays editable');
  // The dates changed elsewhere (another save, a restored backup) while the form was open: the open statement is another one.
  const elsewhere = harness({ original: card });
  assert.equal(keyOf(find(elsewhere.render(), 'DateField', 'Próximo cierre').props.value), '2026-09-28');
  const moved = domain.planCardCycle({ cardId: card.id, days: card, rows: [], todayISO: '2026-09-20', nowISO: createdAt,
    intent: { open: { statementClosingISO: '2026-09-28', closingISO: '2026-09-25', dueISO: '2026-10-03' } } });
  assert.equal(domain.cardCycleView(card, moved.rows, '2026-09-20').open.closingISO, '2026-09-25');
  elsewhere.setData({ ...base, cardCycleDates: moved.rows });
  pick(elsewhere, 'Vencimiento', '2026-10-06');
  await saveButton(elsewhere.render()).props.onPress();
  assert.equal(find(elsewhere.render(), 'ErrorMessage').props.message, domain.CYCLE_STALE_MESSAGE);
  assert.equal(elsewhere.saved.length, 0);
  // Opening and saving without a change writes nothing.
  const unchanged = harness({ original: card });
  await saveButton(unchanged.render()).props.onPress();
  assert.deepEqual([unchanged.saved.length, unchanged.backs()], [0, 1]);
});

test('24T2: a failed save keeps the card and its dates frozen; the retry resends the same submission; archiving keeps its own path without dates', async () => {
  let attempts = 0;
  const view = harness({ original: card }, { save: async () => { if (++attempts === 1) throw new Error('El guardado terminó, pero no pudimos actualizar la vista. Verificá de nuevo antes de registrar otro movimiento; no lo cargues otra vez.'); } });
  pick(view, 'Vencimiento', '2026-10-06');
  await saveButton(view.render()).props.onPress();
  let root = view.render();
  assert.equal(view.backs(), 0);
  assert.equal(find(root, 'DateField', 'Vencimiento').props.disabled, true, 'locked while frozen');
  assert.equal(saveButton(root).props.label, 'Reintentar guardado');
  await saveButton(root).props.onPress();
  assert.equal(view.saved.length, 2);
  assert.equal(JSON.stringify(view.saved[1]), JSON.stringify(view.saved[0]), 'the same card and intent');
  assert.equal(view.backs(), 1);

  const archiving = harness({ original: card });
  root = archiving.render();
  nodes(root).find(node => node.type === 'ActionButton' && node.props.label === 'Archivar tarjeta')!.props.onPress();
  assert.equal(archiving.alerts[0].message, 'Las compras y pagos anteriores siguen en tus registros y reportes. La tarjeta pasa a Archivadas en Tarjetas: podés pagarla y reactivarla.');
  archiving.alerts[0].buttons[1].onPress!();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(archiving.saved.length, 1);
  assert.deepEqual([archiving.saved[0].card.active, archiving.saved[0].card.revision, archiving.saved[0].intent], [false, 1, undefined], 'no cycle intent');
});

test('24T2: the card form\'s dates read in English, and the statement to pay is named by its closing', () => {
  const view = harness({ original: card }, { day: '2026-10-01', locale: 'en-US' });
  const root = view.render();
  assert.deepEqual(nodes(root).filter(node => node.type === 'DateField').map(node => node.props.label), ['Due date of the Sep 28 statement', 'Next closing', 'Due date']);
  assert.equal(find(root, 'SwitchRow').props.label, 'Use these days every month');
  assert.ok(texts(root).includes('They’re on your statement. FinanzApp doesn’t contact your bank. Following months: closing on day 28, due on day 5.'));
  const created = harness({}, { locale: 'en-US' }).render();
  assert.deepEqual(nodes(created).filter(node => node.type === 'DateField').map(node => node.props.label), ['Next closing', 'Due date']);
  assert.ok(texts(created).includes('They’re on your statement. FinanzApp doesn’t contact your bank.'));
  const moved = harness({ original: card }, { locale: 'en-US' });
  pick(moved, 'Next closing', '2026-10-20');
  assert.equal(find(moved.render(), 'SwitchRow').props.value, false, 'a far date is still this statement only until the person says otherwise');
  assert.ok(texts(moved.render()).some(text => text.includes('These dates correct this statement only.')));
});

test('24T2 review: the switch row speaks its reason with its label (a hint may be turned off), and ticks once per change', () => {
  let haptics = 0;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, Switch: 'Switch', View: 'View' },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '../i18n/provider': { useI18n: () => ({ speechLanguage: 'es-AR' }) },
    './components': { AppText: 'AppText' },
    './motion': { selectionHaptic: () => { haptics++; } },
    './theme': { usePalette: () => ({ line: '#DDD', secondary: '#666', inset: '#EEE', primaryFill: '#2557D6' }) },
  };
  const { SwitchRow } = realModule('src/ui/switch-row.tsx', name => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected switch-row dependency: ' + name);
    return modules[name];
  });
  const changes: boolean[] = [];
  const toggleOf = (row: { props: { children: unknown } }) => [row.props.children].flat(Infinity).find((node: any) => node?.type === 'Switch') as { props: Record<string, any> };
  const forced = toggleOf(SwitchRow({ label: 'Usar estos días todos los meses', value: true, disabled: true, onValueChange: (value: boolean) => changes.push(value),
    detail: 'Un motivo de prueba.' }));
  assert.equal(forced.props.accessibilityLabel, 'Usar estos días todos los meses, Un motivo de prueba.');
  assert.deepEqual([forced.props.accessibilityHint, forced.props.disabled, forced.props.accessibilityLanguage], [undefined, true, 'es-AR']);
  const plain = toggleOf(SwitchRow({ label: 'Con interés', value: false, onValueChange: (value: boolean) => changes.push(value) }));
  assert.equal(plain.props.accessibilityLabel, 'Con interés');
  plain.props.onValueChange(true);
  assert.deepEqual([changes, haptics], [[true], 1]);
});

test('24T2 owner decision: any exact correction may be one-off (+1, +14, +16, +20, across a month); the next normal statement follows; the switch alone makes days usual', () => {
  const closings = (plan: { days: domain.CardCycleDays; rows: domain.CardCycleDates[] }, count = 4) =>
    domain.cardStatementsFrom(plan.days, plan.rows, '2026-09-01', 0, count).map(item => item.closingISO);
  const apply = (usual: domain.CreditCardProfile, todayISO: string, closingISO: string, dueISO: string, everyMonth: boolean) => {
    const shown = domain.cardCycleView(usual, [], todayISO);
    const result = cardCycleForm.cycleEditResult(usual, shown, { closingISO, dueISO, toPayDueISO: null, everyMonth });
    const plan = domain.planCardCycle({ cardId: usual.id, days: usual, rows: [], todayISO, nowISO: '2026-10-01T12:00:00.000Z', intent: { ...result.intent, days: result.days } });
    return { result, plan };
  };
  // 28/5 on 1 oct: the open statement closes 28 oct.
  for (const [closing, due] of [['2026-10-29', '2026-11-06'], ['2026-11-11', '2026-11-19'], ['2026-11-13', '2026-11-21'], ['2026-11-17', '2026-11-25'], ['2026-11-02', '2026-11-10']]) {
    const { result, plan } = apply(card, '2026-10-01', closing, due, false);
    assert.deepEqual([result.repeats, plan.days.closingDay, plan.days.dueDay], [false, 28, 5], closing + ': one-off');
    assert.deepEqual(closings(plan), ['2026-09-28', closing, '2026-11-28', '2026-12-28'], closing + ': then the next normal statement, none missing or repeated');
  }
  // Across a month backwards: a card closing on the 1st, whose 1 nov closing comes on 29 oct this time.
  const first = { ...card, closingDay: 1, dueDay: 10 };
  const back = apply(first, '2026-10-05', '2026-10-29', '2026-11-08', false).plan;
  assert.deepEqual(closings(back), ['2026-09-01', '2026-10-01', '2026-10-29', '2026-12-01']);
  // The same large shift (+20) with the switch on: its days become the usual ones from there.
  const repeated = apply(card, '2026-10-01', '2026-11-17', '2026-11-25', true);
  assert.deepEqual([repeated.result.repeats, repeated.plan.days.closingDay, repeated.plan.days.dueDay], [true, 17, 25]);
  assert.deepEqual(closings(repeated.plan), ['2026-09-28', '2026-11-17', '2026-12-17', '2027-01-17']);
  // History never moves: the statement that closed on 28 sep keeps its dates either way.
  assert.deepEqual(domain.cardCycleView(repeated.plan.days, repeated.plan.rows, '2026-10-01').previous, { closingISO: '2026-09-28', dueISO: '2026-10-05', exact: true });
});

// 24UX6E (bug fix): after deleting a card the form dismisses to Tarjetas in one step (expo-router `dismissTo`: pops to it when it
// is in the stack, else replaces the modal with it), never a pop-to-top followed by a replace on top of the stack.
test('24UX6E: «Eliminar tarjeta» dismisses to Tarjetas once the deletion is confirmed', () => {
  const view = harness({ original: card });
  find(view.render(), 'ActionButton', 'Eliminar tarjeta').props.onPress();
  assert.equal(view.removed(), 1);
  assert.deepEqual([view.dismissed, view.replaced, view.backs()], [['/cards'], [], 0]);
});
