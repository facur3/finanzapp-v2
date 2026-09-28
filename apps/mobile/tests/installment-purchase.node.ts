import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/presentation.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import * as liabilityPresentation from '../src/ui/liability-presentation.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import * as entryPrefill from '../src/ui/entry-prefill.ts';
import * as purchasePlan from '../src/ui/purchase-plan.ts';
import { INSTALLMENT_COUNT_CHOICES } from '../src/ui/installment-presentation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { translate } from '../src/i18n/messages.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { realModule } from './real-module.ts';

// Producto 24T2 (stream B): the entry form's «Pago» section and the restricted edit of an instalment's movement. The
// real EntryForm (src/ui/entry-form.tsx) runs with the real section (src/ui/installment-purchase.tsx) and the real
// derivation (src/ui/purchase-plan.ts), under a clock fixed at 10:00 of the harness day: `new Date()`, `Date.now()` and
// the domain's `todayKey()` read it, so the statement arithmetic never depends on the day the suite runs. Hosts are
// descriptors: this is not a rendered iOS form, a keyboard or a VoiceOver pass.
type Node = { type: any; props: Record<string, any>; rendered?: Node };

const createdAt = '2026-09-01T12:00:00.000Z';
const cash: domain.Account = { id: 'cash', name: 'Banco', currency: 'ARS', openingMinor: 5000000, createdAt };
const cardAccount: domain.Account = { id: 'card-acc', name: 'Visa Gold', currency: 'ARS', openingMinor: 0, createdAt };
const card: domain.CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Galicia', last4: '4009', creditLimitMinor: null,
  closingDay: 28, dueDay: 5, active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const base: domain.LedgerArchive = { accounts: [cash, cardAccount], records: [], cards: [card] };
const NBSP = ' ';

/** A clock fixed at 10:00 (local) of `todayISO`: a Date built without arguments, and `Date.now()`, read it. */
function fixedClock(todayISO: string): DateConstructor {
  const [year, month, day] = todayISO.split('-').map(Number);
  const now = new Date(year, month - 1, day, 10).getTime();
  class FixedDate extends Date {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now);
      else super(...(args as [number]));
    }
    static now() { return now; }
  }
  return FixedDate as unknown as DateConstructor;
}

interface Options {
  data?: domain.LedgerArchive; today?: string; locale?: AppLocale;
  add?: (entry: domain.Entry) => Promise<void>; update?: (change: domain.EntryChange) => Promise<void>; addPlan?: (plan: domain.InstallmentPlan) => Promise<void>;
}
function harness(props: Record<string, unknown> = {}, options: Options = {}) {
  const FixedDate = fixedClock(options.today ?? '2026-09-20');
  let data = options.data ?? base;
  let locale: AppLocale = options.locale ?? 'es-AR';
  const state: unknown[] = [], refs: { current: unknown }[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const additions: domain.Entry[] = [], updates: domain.EntryChange[] = [], plans: domain.InstallmentPlan[] = [], pushed: unknown[] = [];
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data),
    addEntry: async (value: domain.Entry) => { additions.push(value); await options.add?.(value); },
    updateEntry: async (value: domain.EntryChange) => { updates.push(value); await options.update?.(value); },
    addInstallmentPlan: async (value: domain.InstallmentPlan) => { plans.push(value); await options.addPlan?.(value); } }) };
  const components = Object.fromEntries(['Screen', 'EmptyState', 'ActionButton', 'AppText', 'AmountField', 'Choices', 'ErrorMessage', 'Field', 'IconButton',
    'Surface', 'DetailRow', 'Money'].map(name => [name, name]));
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (next: unknown) => { state[index] = typeof next === 'function' ? (next as (current: unknown) => unknown)(state[index]) : next; }]; },
    useRef: (initial: unknown) => { const index = refCursor++; return refs[index] ??= { current: initial }; }, useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss() {} } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => true, back: () => { backs++; }, push: (to: unknown) => pushed.push(to), replace: (to: unknown) => pushed.push(to) } },
    'expo-crypto': { randomUUID: () => 'operation-' + (++uuid) },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {}, selectionAsync: async () => {} },
    // The real domain, with today read from the fixed clock (the form checks future dates and closed statements with it).
    '@finanzapp/domain': { ...domain, todayKey: (date?: Date) => domain.todayKey(date ?? new FixedDate()) },
    '../storage/LedgerProvider': ledger,
    '../i18n/provider': i18nProvider, '../i18n/format': i18nFormat,
    './components': components,
    './form-controls': { AccountField: 'AccountField', CategoryField: 'CategoryField', DateField: 'DateField' },
    './budget-presentation': budgetPresentation, './money-input': moneyInput, './entry-prefill': entryPrefill,
    './liability-presentation': liabilityPresentation, './presentation': presentation, './purchase-plan': purchasePlan,
    './switch-row': { SwitchRow: 'SwitchRow' },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, usePalette: () => ({ warning: '#B45309', secondary: '#66686F', text: '#0A0A0C' }) },
  };
  const require = (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected purchase dependency: ' + name);
    return modules[name];
  };
  // The section runs for real inside the form, through the same mocks.
  modules['./installment-purchase'] = realModule('src/ui/installment-purchase.tsx', require);
  const source = readFileSync(new URL('../src/ui/entry-form.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, (props: unknown) => Node> };
  runInNewContext(code, { module, exports: module.exports, require, Error, Date: FixedDate });
  return {
    render: () => { cursor = 0; refCursor = 0; return module.exports.EntryForm(props); },
    setData: (next: domain.LedgerArchive) => { data = next; }, setLocale: (next: AppLocale) => { locale = next; },
    additions, updates, plans, pushed, backs: () => backs,
  };
}

/** Every node, with local function components (the «Pago» section) rendered once per element, in place. */
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  if (typeof value.type === 'function' && !('rendered' in value)) value.rendered = value.type(value.props);
  return [value, ...('rendered' in value ? nodes(value.rendered) : []), ...nodes(value.props.children), ...nodes(value.props.action)];
}
function find(root: Node, type: string, label?: string): Node {
  const node = nodes(root).find(item => item.type === type && (label === undefined || item.props.label === label));
  assert.ok(node, 'Missing ' + type + ' ' + (label ?? ''));
  return node;
}
const has = (root: Node, type: string, label?: string) => nodes(root).some(item => item.type === type && (label === undefined || item.props.label === label));
const textOf = (node: Node) => [node.props.children].flat(Infinity).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : '').join('');
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(textOf);
const section = (root: Node) => nodes(root).find(node => typeof node.type === 'function' && node.type.name === 'InstallmentPurchase');
const choices = (root: Node, values: string) => {
  const node = nodes(root).find(item => item.type === 'Choices' && item.props.options.map((option: { value: string }) => option.value).join(',') === values);
  assert.ok(node, 'Missing Choices ' + values);
  return node;
};
const labelsOf = (node: Node) => node.props.options.map((option: { label: string }) => option.label).join('|');
const saveButton = (root: Node) => find(root, 'ActionButton');
const line = (root: Node) => nodes(root).find(node => node.type === 'AppText' && node.props.variant === 'headline');
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
/** The section's own fields, in any language: the typed count is the second Field, the total financed the second AmountField. */
const countField = (root: Node) => { const field = nodes(root).filter(node => node.type === 'Field')[1]; assert.ok(field, 'Missing the count field'); return field; };
const totalField = (root: Node) => { const field = nodes(root).filter(node => node.type === 'AmountField')[1]; assert.ok(field, 'Missing the total field'); return field; };

type View = ReturnType<typeof harness>;
/** Types a purchase: the price, the merchant and the category (the first AmountField and Field are the form's own). */
function purchase(view: View, amount = '1.200.000', merchant = 'Electro', category = 'Hogar'): Node {
  let root = view.render();
  find(root, 'AmountField').props.onChangeText(amount);
  find(root, 'Field').props.onChangeText(merchant);
  find(root, 'CategoryField').props.onChange(category);
  root = view.render();
  return root;
}
function inInstallments(view: View): Node {
  choices(view.render(), 'once,installments').props.onChange('installments');
  return view.render();
}
function count(view: View, value: string, typed?: string): Node {
  choices(view.render(), '3,6,12,18,other').props.onChange(value);
  if (typed !== undefined) countField(view.render()).props.onChangeText(typed);
  return view.render();
}
async function save(view: View): Promise<void> {
  await saveButton(view.render()).props.onPress();
}

// ---- the pure derivation ----------------------------------------------------------------------------------

test('24T2: the counts offered as one tap are the first four of the catalogue (five segments fit the narrowest iPhone), 12 by default, «Una vez» first', () => {
  assert.deepEqual([...purchasePlan.QUICK_COUNTS], [3, 6, 12, 18]);
  assert.ok(purchasePlan.QUICK_COUNTS.every(value => (INSTALLMENT_COUNT_CHOICES as readonly number[]).includes(value)));
  // A compact segment is at least 64 pt wide with 2 pt gaps inside a 2 pt padded track; the content of a 375 pt iPhone is 335 pt.
  const track = (segments: number) => segments * 64 + (segments - 1) * 2 + 2 * 2;
  assert.ok(track(purchasePlan.QUICK_COUNTS.length + 1) <= 375 - 40, 'the four counts and «Otra» fit an iPhone SE');
  assert.ok(track(INSTALLMENT_COUNT_CHOICES.length + 1) > 393 - 40, 'six segments would overflow an iPhone 15');
  assert.deepEqual({ ...purchasePlan.INITIAL_PURCHASE }, { mode: 'once', count: '12', typedCount: '', placement: 'current', financed: false, totalFinanced: '' });
});

test('24T2: purchaseState reads the count (2 to 120 typed), the financing (total minus price, never below it) and the statements, and is ready only when all are known', () => {
  const input = (draft: Partial<purchasePlan.PurchaseDraft>, principalMinor: number | null = 120000000, currency: domain.Currency = 'ARS') => purchasePlan.purchaseState({
    draft: { ...purchasePlan.INITIAL_PURCHASE, mode: 'installments', ...draft }, card, currency, cycleDates: [], purchaseDateISO: '2026-09-20', principalMinor, todayISO: '2026-09-20' });
  const typed = (text: string) => input({ count: 'other', typedCount: text });
  assert.deepEqual([typed('').count, typed('').countError, typed('').ready, typed('').blocked], [null, null, false, true], 'an empty field is no error yet, and Save waits');
  for (const refused of ['0', '1', '121', '999']) assert.deepEqual([typed(refused).count, typed(refused).countError, typed(refused).ready], [null, 'entryForm.plan.countInvalid', false], refused);
  for (const accepted of [2, 24, 120]) assert.deepEqual([typed(String(accepted)).count, typed(String(accepted)).ready], [accepted, true], String(accepted));
  assert.equal(input({}).count, 12);
  assert.deepEqual([input({}, null).ready, input({}, null).preview], [false, null], 'no price, no preview');
  // Financing: off is zero; on waits for a total; equal is zero; above is the exact difference; below is refused.
  assert.equal(input({}).interestMinor, 0);
  assert.deepEqual([input({ financed: true }).interestMinor, input({ financed: true }).ready, input({ financed: true }).totalError], [null, false, null]);
  assert.deepEqual([input({ financed: true, totalFinanced: '1.200.000' }).interestMinor, input({ financed: true, totalFinanced: '1.200.000' }).ready], [0, true]);
  assert.deepEqual([input({ financed: true, totalFinanced: '1.440.000,01' }).interestMinor, input({ financed: true, totalFinanced: '1.440.000,01' }).totalMinor], [24000001, 144000001]);
  const below = input({ financed: true, totalFinanced: '1.199.999,99' });
  assert.deepEqual([below.totalError, below.interestMinor, below.preview, below.ready, below.blocked], ['errors.installments.totalBelowPrice', null, null, false, true]);
  assert.deepEqual([input({}).blocked, input({ financed: true }).blocked], [false, true], 'a missing total blocks Save; nothing else of the section does');
  // A price too small for the count: every instalment carries at least one minor unit, so 11 units in 12 cannot be split.
  const tiny = input({}, 11);
  assert.deepEqual([tiny.scheduleError, tiny.preview, tiny.blocked], ['errors.installments.tooSmall', null, true]);
  assert.deepEqual([input({}, 12).scheduleError, input({}, 12).blocked], [null, false]);
  // No price yet (or zero): not the section's to refuse; Save says it, as for a purchase paid once.
  assert.deepEqual([input({}, 0).blocked, input({}, 0).scheduleError, input({}, null).blocked], [false, null, false]);
  assert.equal(bindLocale('en-US').errorText(below.totalError!), 'The total financed can’t be less than the price.');
  // A total the card's currency cannot hold exactly is said by the field itself: no second message, not ready.
  const cents = input({ financed: true, totalFinanced: '150.000,5' }, 120000, 'JPY');
  assert.deepEqual([cents.totalError, cents.ready], [null, false]);
  // The statements: the purchase's own and the next one.
  assert.equal(JSON.stringify(input({}).options), JSON.stringify({ current: { closingISO: '2026-09-28', dueISO: '2026-10-05', exact: false }, next: { closingISO: '2026-10-28', dueISO: '2026-11-05', exact: false } }));
  assert.equal(input({ placement: 'next' }).first!.closingISO, '2026-10-28');
});

test('24T2: buildPurchasePlan writes the previewed schedule, the interest in the stored Intereses spelling only when there is interest, and refuses what the section refuses', () => {
  const build = (draft: Partial<purchasePlan.PurchaseDraft>, principalMinor = 120000000) => purchasePlan.buildPurchasePlan({
    draft: { ...purchasePlan.INITIAL_PURCHASE, mode: 'installments', ...draft }, card, cardAccount, currency: 'ARS', cycleDates: [], purchaseDateISO: '2026-09-20', principalMinor,
    todayISO: '2026-09-20', id: 'plan', createdAt, merchant: ' Electro ', category: 'Hogar', interestCategory: 'Intereses' });
  const plain = build({});
  assert.deepEqual([plain.count, plain.principalMinor, plain.interestMinor, plain.interestCategory, plain.merchant, plain.feeMinor, plain.taxMinor], [12, 120000000, 0, '', 'Electro', 0, 0]);
  const state = purchasePlan.purchaseState({ draft: { ...purchasePlan.INITIAL_PURCHASE, mode: 'installments' }, card, currency: 'ARS', cycleDates: [], purchaseDateISO: '2026-09-20', principalMinor: 120000000, todayISO: '2026-09-20' });
  assert.equal(JSON.stringify(plain.schedule), JSON.stringify(state.preview!.schedule), 'the preview is the schedule the plan is written with');
  const financed = build({ financed: true, totalFinanced: '1.440.000' });
  assert.deepEqual([financed.interestMinor, financed.interestCategory], [24000000, 'Intereses']);
  assert.deepEqual([build({ financed: true, totalFinanced: '1.200.000' }).interestMinor, build({ financed: true, totalFinanced: '1.200.000' }).interestCategory], [0, ''], 'equal to the price: no invented charge');
  assert.throws(() => build({ count: 'other', typedCount: '1' }), /entryForm\.plan\.countInvalid/);
  assert.throws(() => build({ financed: true }), /entryForm\.plan\.totalMissing/);
  assert.throws(() => build({ financed: true, totalFinanced: '1.000.000' }), /errors\.installments\.totalBelowPrice/);
  assert.throws(() => build({ count: '3' }, 2), /errors\.installments\.tooSmall/, 'an empty instalment is refused before the domain is asked');
  assert.throws(() => build({}, 0), /errors\.installments\.principal/);
});

// ---- the section in the form ----------------------------------------------------------------------------

test('24T2: «Pago» appears only on a new expense on an active card: never for cash, income, an edit, or an archived or deleted card', () => {
  assert.ok(section(harness({ accountId: 'card-acc', kind: 'expense' }).render()), 'a new purchase on the card');
  assert.ok(section(harness({ accountId: 'card-acc', kind: 'expense', onKindChange: () => {} }).render()), 'the hosted form (the movement modal) too');
  assert.equal(section(harness({ accountId: 'cash', kind: 'expense' }).render()), undefined, 'cash');
  assert.equal(section(harness({ accountId: 'card-acc', kind: 'income' }).render()), undefined, 'income (it falls back to cash)');
  const purchaseOnCard: domain.Entry = { id: 'p', accountId: 'card-acc', kind: 'expense', amountMinor: 23100, merchant: 'Café', category: 'Comida', dateISO: '2026-09-12', createdAt };
  const editing = harness({ original: domain.initialRecord(purchaseOnCard) }, { data: { ...base, records: [domain.initialRecord(purchaseOnCard)] } }).render();
  assert.equal(section(editing), undefined, 'an edit never becomes a plan');
  for (const [label, profile] of [['archived', { ...card, active: false }], ['deleted', { ...card, active: false, deleted: true }]] as const) {
    const root = harness({ accountId: 'card-acc', kind: 'expense' }, { data: { ...base, cards: [profile] } }).render();
    assert.equal(find(root, 'AccountField').props.value, 'cash', label + ': the card is not offered for a new purchase');
    assert.equal(section(root), undefined, label);
  }
  // In reading order: after the date row, so the form's own switch, fields and Save stay the first of their kind.
  const root = inInstallments(harness({ accountId: 'card-acc', kind: 'expense' }));
  const order = nodes(root).map(node => node.type).filter(type => ['Choices', 'AmountField', 'Field', 'DateField', 'ActionButton'].includes(type));
  assert.equal(order.join(','), 'Choices,AmountField,Field,DateField,Choices,Choices,Choices,ActionButton');
  assert.equal(choices(root, 'expense,income').props.value, 'expense', 'the first Choices is still Gasto / Ingreso');
});

test('24T2: «Una vez» (the default) saves one movement through addEntry, exactly as before; «En cuotas» saves one plan through addInstallmentPlan and no movement', async () => {
  const once = harness({ accountId: 'card-acc', kind: 'expense' });
  let root = purchase(once);
  assert.equal(choices(root, 'once,installments').props.value, 'once');
  assert.equal(has(root, 'SwitchRow'), false, 'nothing about instalments is shown until «En cuotas»');
  assert.equal(saveButton(root).props.label, 'Guardar gasto' + NBSP + '·' + NBSP + '$' + NBSP + '1.200.000,00');
  assert.ok(texts(root).includes(translate('es', 'entryForm.cardNote')));
  await save(once);
  assert.equal(once.plans.length, 0);
  const at = new (fixedClock('2026-09-20'))().toISOString();
  assert.equal(JSON.stringify(once.additions), JSON.stringify([{ id: 'operation-1', createdAt: at, kind: 'expense', accountId: 'card-acc',
    amountMinor: 120000000, merchant: 'Electro', category: 'Hogar', dateISO: '2026-09-20' }]), 'the same movement as a card purchase before 24T2');
  assert.equal(once.backs(), 1);

  const plan = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(plan);
  root = inInstallments(plan);
  assert.equal(choices(root, '3,6,12,18,other').props.value, '12', '12 by default');
  assert.equal(labelsOf(choices(root, '3,6,12,18,other')), '3|6|12|18|Otra');
  assert.equal(textOf(line(root)!), '12 cuotas de $' + NBSP + '100.000,00');
  assert.equal(line(root)!.props.accessibilityLabel, '12 cuotas de 100000,00 pesos');
  assert.equal(saveButton(root).props.label, 'Guardar en cuotas' + NBSP + '·' + NBSP + '$' + NBSP + '1.200.000,00');
  assert.equal(saveButton(root).props.spokenLabel, 'Guardar en cuotas, 1200000,00 pesos');
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Compra con tarjeta', 'the title stays');
  assert.ok(texts(root).includes('La compra no cuenta toda hoy: cada cuota cuenta como gasto cuando cierra su resumen y suma al saldo pendiente. Las cuotas futuras se ven en Tarjetas.'));
  assert.equal(texts(root).includes(translate('es', 'entryForm.cardNote')), false, 'the single-expense note is gone in instalments');
  await save(plan);
  assert.equal(plan.additions.length, 0, 'no movement: the purchase counts instalment by instalment');
  assert.equal(plan.plans.length, 1);
  const saved = plan.plans[0];
  assert.deepEqual([saved.id, saved.createdAt, saved.updatedAt, saved.revision, saved.cardId, saved.currency, saved.merchant, saved.category, saved.purchaseDateISO],
    ['operation-1', at, at, 0, 'card', 'ARS', 'Electro', 'Hogar', '2026-09-20'], 'the frozen operation: its id and its time');
  assert.deepEqual([saved.principalMinor, saved.count, saved.interestMinor, saved.interestCategory, saved.feeMinor, saved.taxMinor], [120000000, 12, 0, '', 0, 0]);
  assert.equal(saved.schedule[0].billingDateISO, '2026-09-28');
  assert.equal(saved.schedule[11].billingDateISO, '2027-08-28');
  assert.ok(saved.schedule.every(row => row.principalMinor === 10000000));
  assert.equal(plan.backs(), 1, 'the form closes once the plan is saved (a failed recognition afterwards is the provider\'s banner, never a failed save)');
});

test('24T2: counts 2, 3, 12, 24 and 120 save that many instalments from exactly the previewed schedule; 1 and 121 are refused before anything is sent', async () => {
  for (const [choice, typed, expected] of [['other', '2', 2], ['3', undefined, 3], ['12', undefined, 12], ['other', '24', 24], ['other', '120', 120]] as const) {
    const view = harness({ accountId: 'card-acc', kind: 'expense' });
    purchase(view, '1.000.000');
    inInstallments(view);
    const root = count(view, choice, typed);
    const preview = section(root)!.props.state.preview;
    await save(view);
    assert.equal(view.plans.length, 1, String(expected));
    assert.equal(view.plans[0].count, expected);
    assert.equal(view.plans[0].schedule.length, expected);
    assert.equal(JSON.stringify(view.plans[0].schedule), JSON.stringify(preview.schedule), expected + ': the preview is what is saved');
    assert.equal(view.plans[0].schedule.reduce((total, row) => total + row.principalMinor, 0), 100000000, 'every minor unit, once');
  }
  // 100.000.000 minor units in 3: 33.333.334 + 33.333.333 + 33.333.333, so the line says «aprox.» with the largest one.
  const three = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(three, '1.000.000');
  inInstallments(three);
  let root = count(three, '3');
  assert.equal(textOf(line(root)!), '3 cuotas de aprox. $' + NBSP + '333.333,34');
  assert.equal(line(root)!.props.accessibilityLabel, '3 cuotas de aproximadamente 333333,34 pesos');
  for (const refused of ['1', '121']) {
    const view = harness({ accountId: 'card-acc', kind: 'expense' });
    purchase(view);
    inInstallments(view);
    root = count(view, 'other', refused);
    assert.ok(texts(root).includes('Elegí entre 2 y 120 cuotas. Para un solo pago, elegí «Una vez».'), refused);
    assert.equal(saveButton(root).props.disabled, true, refused + ': Save waits for a count from 2 to 120');
    assert.equal(line(root), undefined, 'no per-instalment line without a count');
    await save(view); // Even pressed, nothing is sent and the draft stays editable.
    assert.deepEqual([view.plans.length, view.additions.length], [0, 0]);
    assert.equal(find(view.render(), 'ErrorMessage').props.message, 'entryForm.plan.countInvalid');
    assert.equal(find(view.render(), 'AmountField').props.editable, true);
  }
  const english = harness({ accountId: 'card-acc', kind: 'expense' }, { locale: 'en-US' });
  purchase(english);
  inInstallments(english);
  assert.ok(texts(count(english, 'other', '121')).includes('Choose between 2 and 120 installments. For a single payment, choose “In full”.'));
  // A price too small for the count says why and waits; a zero price is refused by Save with its sentence, sending nothing.
  const tiny = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(tiny, '0,11');
  root = inInstallments(tiny);
  assert.ok(texts(root).includes('Cada cuota debe ser de al menos una unidad menor de la moneda.'));
  assert.equal(saveButton(root).props.disabled, true);
  root = count(tiny, '6');
  assert.equal(saveButton(root).props.disabled, false, '11 units in 6 instalments: 2, 2, 2, 2, 2, 1');
  await save(tiny);
  assert.equal(JSON.stringify(tiny.plans[0].schedule.map(row => row.principalMinor)), '[2,2,2,2,2,1]');
  const zero = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(zero, '0');
  root = inInstallments(zero);
  assert.equal(saveButton(root).props.disabled, false, 'as for a purchase paid once, Save explains instead of staying silent');
  await save(zero);
  assert.equal(find(zero.render(), 'ErrorMessage').props.message, 'errors.installments.principal');
  assert.equal(bindLocale('es-AR').errorText('errors.installments.principal'), 'El precio de la compra en cuotas debe ser mayor que cero.');
  assert.deepEqual([zero.plans.length, zero.additions.length, find(zero.render(), 'AmountField').props.editable], [0, 0, true]);
});

test('24T2: «Primera cuota» offers the purchase\'s statement and the next by their closing dates; the caption says the chosen one\'s closing and due, spoken in words', async () => {
  const view = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(view);
  let root = inInstallments(view);
  const placement = choices(root, 'current,next');
  assert.equal(placement.props.value, 'current', 'the statement the purchase belongs to, by default');
  assert.equal(labelsOf(placement), '28 sep|28 oct');
  assert.ok(texts(root).includes('Cierra el 28 sep y vence el 5 oct.'));
  assert.equal(nodes(root).find(node => node.type === 'AppText' && textOf(node) === 'Cierra el 28 sep y vence el 5 oct.')!.props.accessibilityLabel,
    'Cierra el 28 de septiembre de 2026 y vence el 5 de octubre de 2026.');
  placement.props.onChange('next');
  root = view.render();
  assert.ok(texts(root).includes('Cierra el 28 oct y vence el 5 nov.'));
  await save(view);
  assert.deepEqual([view.plans[0].schedule[0].billingDateISO, view.plans[0].schedule[0].dueDateISO], ['2026-10-28', '2026-11-05'], 'the next statement');
  assert.equal(view.plans[0].schedule[11].billingDateISO, '2027-09-28');

  // A purchase on the closing day belongs to that statement, which reaches its closing today: the first instalment is recorded on save.
  const closingDay = harness({ accountId: 'card-acc', kind: 'expense' }, { today: '2026-09-28' });
  purchase(closingDay);
  root = inInstallments(closingDay);
  assert.equal(labelsOf(choices(root, 'current,next')), '28 sep|28 oct');
  assert.ok(texts(root).includes('Ese resumen ya llegó a su cierre: la primera cuota se registra al guardar.'));
  choices(root, 'current,next').props.onChange('next');
  assert.equal(texts(closingDay.render()).some(text => text.includes('llegó a su cierre')), false, 'the next statement is still open');
  // The day after the closing: the purchase is in the next statement already.
  const dayAfter = harness({ accountId: 'card-acc', kind: 'expense' }, { today: '2026-09-29' });
  purchase(dayAfter);
  root = inInstallments(dayAfter);
  assert.equal(labelsOf(choices(root, 'current,next')), '28 oct|28 nov');
  assert.ok(texts(root).includes('Cierra el 28 oct y vence el 5 nov.'));
  assert.equal(texts(root).some(text => text.includes('llegó a su cierre')), false);
  await save(dayAfter);
  assert.equal(dayAfter.plans[0].schedule[0].billingDateISO, '2026-10-28');

  // Recorded late: a purchase of 10 August, statement closed on 28 August. Changing the date re-derives both options.
  const late = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(late);
  inInstallments(late);
  find(late.render(), 'DateField').props.onChange(new Date(2026, 7, 10, 12));
  root = late.render();
  assert.equal(labelsOf(choices(root, 'current,next')), '28 ago|28 sep');
  assert.equal(choices(root, 'current,next').props.value, 'current', 'the choice stays «current»');
  assert.ok(texts(root).includes('Ese resumen ya llegó a su cierre: la primera cuota se registra al guardar.'));
  assert.equal(section(root)!.props.state.closedCount, 1);
  find(root, 'DateField').props.onChange(new Date(2026, 5, 10, 12));
  root = late.render();
  assert.ok(texts(root).includes('Esos resúmenes ya llegaron a su cierre: las primeras 3 cuotas se registran al guardar.'), 'June: June, July and August closed');
  await save(late);
  assert.deepEqual(late.plans[0].schedule.slice(0, 3).map(row => row.billingDateISO), ['2026-06-28', '2026-07-28', '2026-08-28']);
  // A statement of another year carries its year.
  const lastYear = harness({ accountId: 'card-acc', kind: 'expense' }, { today: '2027-01-05' });
  purchase(lastYear);
  inInstallments(lastYear);
  find(lastYear.render(), 'DateField').props.onChange(new Date(2026, 11, 20, 12));
  assert.equal(labelsOf(choices(lastYear.render(), 'current,next')), '28 dic 2026|28 ene');
  // A future purchase date stays refused, in instalments too.
  const future = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(future);
  inInstallments(future);
  find(future.render(), 'DateField').props.onChange(new Date(2026, 8, 21, 12));
  await save(future);
  assert.deepEqual([future.plans.length, find(future.render(), 'ErrorMessage').props.message, find(future.render(), 'AmountField').props.editable], [0, 'entryForm.futureDate', true]);
});

test('24T2: «Con interés» is off by default (no financing field); on, «Total financiado» gives the exact interest in ARS, JPY and KWD, equal is none and below is refused', async () => {
  const view = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(view);
  let root = inInstallments(view);
  assert.equal(find(root, 'SwitchRow').props.value, false);
  assert.equal(find(root, 'SwitchRow').props.label, 'Con interés');
  assert.equal(has(root, 'AmountField', 'Total financiado'), false, 'no financing field while off');
  find(root, 'SwitchRow').props.onValueChange(true);
  root = view.render();
  assert.equal(find(root, 'AmountField', 'Total financiado').props.currency, 'ARS');
  assert.equal(saveButton(root).props.disabled, true, 'an empty total blocks Save');
  assert.equal(line(root), undefined, 'the per-instalment line waits for the total');
  find(root, 'AmountField', 'Total financiado').props.onChangeText('1.440.000');
  root = view.render();
  assert.ok(texts(root).includes('Interés total: $' + NBSP + '240.000,00'));
  assert.equal(nodes(root).find(node => node.type === 'AppText' && textOf(node).startsWith('Interés total'))!.props.accessibilityLabel, 'Interés total: 240000,00 pesos');
  assert.equal(textOf(line(root)!), '12 cuotas de $' + NBSP + '120.000,00', 'each instalment includes its interest');
  assert.equal(saveButton(root).props.disabled, false);
  await save(view);
  assert.deepEqual([view.plans[0].principalMinor, view.plans[0].interestMinor, view.plans[0].interestCategory, view.plans[0].feeMinor, view.plans[0].taxMinor], [120000000, 24000000, 'Intereses', 0, 0]);
  assert.ok(view.plans[0].schedule.every(row => row.principalMinor === 10000000 && row.interestMinor === 2000000));

  const equal = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(equal);
  inInstallments(equal);
  find(equal.render(), 'SwitchRow').props.onValueChange(true);
  find(equal.render(), 'AmountField', 'Total financiado').props.onChangeText('1.200.000');
  assert.ok(texts(equal.render()).includes('Interés total: $' + NBSP + '0,00'));
  await save(equal);
  assert.deepEqual([equal.plans[0].interestMinor, equal.plans[0].interestCategory], [0, ''], 'the total equals the price: no invented charge');

  const below = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(below);
  inInstallments(below);
  find(below.render(), 'SwitchRow').props.onValueChange(true);
  find(below.render(), 'AmountField', 'Total financiado').props.onChangeText('1.199.999,99');
  root = below.render();
  assert.ok(texts(root).includes('El total financiado no puede ser menor que el precio.'));
  assert.equal(saveButton(root).props.disabled, true);
  await save(below);
  assert.equal(below.plans.length, 0, 'refused before anything is sent');
  assert.equal(find(below.render(), 'ErrorMessage').props.message, 'errors.installments.totalBelowPrice');
  // Turning the switch off again is «Sin interés»: the kept total is ignored.
  find(below.render(), 'SwitchRow').props.onValueChange(false);
  await save(below);
  assert.deepEqual([below.plans.length, below.plans[0].interestMinor], [1, 0]);

  // The currency's own scale: yen have no decimals, dinars three.
  for (const [currency, price, total, principal, interest] of [['JPY', '120.000', '150.000', 120000, 30000], ['KWD', '1.200,000', '1.440,500', 1200000, 240500]] as const) {
    const account: domain.Account = { ...cardAccount, id: 'fx-acc', name: 'Tarjeta ' + currency, currency };
    const profile: domain.CreditCardProfile = { ...card, id: 'fx', accountId: account.id };
    const fx = harness({ accountId: 'fx-acc', kind: 'expense' }, { data: { accounts: [cash, account], records: [], cards: [profile] } });
    purchase(fx, price);
    inInstallments(fx);
    find(fx.render(), 'SwitchRow').props.onValueChange(true);
    assert.equal(find(fx.render(), 'AmountField', 'Total financiado').props.currency, currency);
    find(fx.render(), 'AmountField', 'Total financiado').props.onChangeText(total);
    await save(fx);
    assert.deepEqual([fx.plans[0].currency, fx.plans[0].principalMinor, fx.plans[0].interestMinor], [currency, principal, interest], currency);
    assert.equal(fx.plans[0].schedule.reduce((sum, row) => sum + row.interestMinor, 0), interest, currency + ': every unit of interest, once');
  }
});

test('24T2: the interest is recorded under the Intereses category\'s stored spelling, whatever the interface language or a renamed definition says', async () => {
  const financed = async (options: Options) => {
    const view = harness({ accountId: 'card-acc', kind: 'expense' }, options);
    purchase(view);
    inInstallments(view);
    find(view.render(), 'SwitchRow').props.onValueChange(true);
    totalField(view.render()).props.onChangeText('1.300.000');
    await save(view);
    return view.plans[0];
  };
  assert.equal((await financed({})).interestCategory, 'Intereses');
  assert.equal((await financed({ locale: 'en-US' })).interestCategory, 'Intereses', 'never the translated «Interest»');
  const renamed: domain.CategoryDefinition = { kind: 'expense', key: 'intereses', storedLabel: 'intereses', label: 'Financiación de tarjetas', icon: 'bank', color: 'ochre',
    archived: false, createdAt, revision: 0, updatedAt: createdAt };
  assert.equal(domain.interestCategoryLabel([renamed]), 'intereses');
  assert.equal((await financed({ data: { ...base, categories: [renamed] } })).interestCategory, 'intereses', 'a renamed definition keeps its stored identity');
});

test('24T2: a failed save keeps the exact plan frozen and the retry resends it; a double tap or Close during the save posts once and waits', async () => {
  let attempts = 0;
  const view = harness({ accountId: 'card-acc', kind: 'expense' }, { addPlan: async () => { if (++attempts === 1) throw new Error('El guardado terminó, pero no pudimos actualizar la vista. Verificá de nuevo antes de registrar otro movimiento; no lo cargues otra vez.'); } });
  purchase(view);
  inInstallments(view);
  count(view, '6');
  await save(view);
  let root = view.render();
  assert.equal(view.backs(), 0);
  assert.equal(find(root, 'AmountField').props.editable, false, 'sent once: the draft is locked');
  assert.equal(section(root)!.props.disabled, true, 'and so is the section');
  assert.equal(saveButton(root).props.label, 'Reintentar guardado');
  assert.ok(texts(root).includes(translate('es', 'entryForm.retryNote')));
  // Even a change of the underlying data (the commit did land) resends the identical plan: storage treats it as done.
  view.setData({ ...base, installmentPlans: [view.plans[0]] });
  await save(view);
  assert.equal(view.plans.length, 2);
  assert.equal(JSON.stringify(view.plans[1]), JSON.stringify(view.plans[0]), 'the same id, createdAt and schedule');
  assert.equal(view.additions.length, 0);
  assert.equal(view.backs(), 1);

  let finish!: () => void;
  const slow = harness({ accountId: 'card-acc', kind: 'expense' }, { addPlan: () => new Promise<void>(resolve => { finish = resolve; }) });
  purchase(slow);
  root = inInstallments(slow);
  const saving = saveButton(root).props.onPress();
  await saveButton(root).props.onPress();
  find(slow.render(), 'Stack.Screen').props.options.headerLeft().props.onPress();
  assert.equal(slow.backs(), 0, 'Close waits for the durable save');
  assert.equal(slow.plans.length, 1, 'a double tap posts once');
  finish();
  await saving;
  await flush();
  assert.equal(slow.backs(), 1);
});

test('24T2: switching to cash or to Ingreso hides «Pago» and the next save is a plain movement; coming back to the card restores every choice', async () => {
  const view = harness({ accountId: 'card-acc', kind: 'expense' });
  purchase(view);
  inInstallments(view);
  count(view, 'other', '9');
  choices(view.render(), 'current,next').props.onChange('next');
  find(view.render(), 'SwitchRow').props.onValueChange(true);
  find(view.render(), 'AmountField', 'Total financiado').props.onChangeText('1.300.000');
  find(view.render(), 'AccountField').props.onChange('cash');
  let root = view.render();
  assert.equal(section(root), undefined);
  assert.equal(has(root, 'AmountField', 'Total financiado'), false);
  assert.equal(saveButton(root).props.label, 'Guardar gasto' + NBSP + '·' + NBSP + '$' + NBSP + '1.200.000,00');
  find(root, 'AccountField').props.onChange('card-acc');
  root = view.render();
  const restored = section(root)!.props.draft;
  assert.equal(JSON.stringify(restored), JSON.stringify({ mode: 'installments', count: 'other', typedCount: '9', placement: 'next', financed: true, totalFinanced: '1.300.000' }));
  choices(root, 'expense,income').props.onChange('income');
  root = view.render();
  assert.equal(section(root), undefined, 'Ingreso: no section (and no card)');
  choices(root, 'expense,income').props.onChange('expense');
  root = view.render();
  assert.equal(find(root, 'AccountField').props.value, 'card-acc', 'Gasto finds the card again');
  assert.equal(section(root)!.props.draft.typedCount, '9');
  // On cash, the save is one movement.
  find(root, 'AccountField').props.onChange('cash');
  await save(view);
  assert.deepEqual([view.additions.length, view.plans.length, view.additions[0].accountId], [1, 0, 'cash']);
});

test('24T2: in English the section reads from the catalogue and the plan saved is identical to the Spanish one', async () => {
  const record = async (locale: AppLocale) => {
    const view = harness({ accountId: 'card-acc', kind: 'expense' }, { locale });
    purchase(view);
    const root = inInstallments(view);
    await save(view);
    return { view, root };
  };
  const spanish = await record('es-AR');
  const english = await record('en-US');
  const root = english.root;
  assert.equal(labelsOf(choices(root, 'once,installments')), 'In full|In installments');
  assert.equal(labelsOf(choices(root, '3,6,12,18,other')), '3|6|12|18|Other');
  assert.equal(labelsOf(choices(root, 'current,next')), 'Sep 28|Oct 28');
  for (const label of ['Payment', 'Installments', 'First installment']) assert.ok(texts(root).includes(label), label);
  assert.ok(texts(root).includes('Closes Sep 28, due Oct 5.'));
  assert.equal(find(root, 'SwitchRow').props.label, 'With interest');
  assert.equal(textOf(line(root)!), '12 installments of AR$' + NBSP + '100,000.00');
  assert.equal(line(root)!.props.accessibilityLabel, '12 installments of 100000.00 pesos');
  assert.equal(saveButton(root).props.label, 'Save in installments' + NBSP + '·' + NBSP + 'AR$' + NBSP + '1,200,000.00');
  assert.equal(saveButton(root).props.spokenLabel, 'Save in installments, 1200000.00 pesos');
  assert.ok(texts(root).includes('The purchase doesn’t count all at once: each installment counts as an expense when its statement closes and adds to the outstanding balance. Future installments are shown in Cards.'));
  assert.equal(JSON.stringify(english.view.plans[0]), JSON.stringify(spanish.view.plans[0]), 'the language never reaches the ledger');
  // Buttons and headers fit their room in both languages (translation.node.ts budgets: 24 characters).
  for (const language of ['es', 'en'] as const) for (const key of ['entryForm.plan.save', 'entryForm.installmentEdit.title'] as const) {
    assert.ok(translate(language, key).length <= 24, language + ' ' + key);
  }
  for (const language of ['es', 'en'] as const) for (const key of ['entryForm.plan.once', 'entryForm.plan.installments'] as const) {
    assert.ok(translate(language, key).length <= 16, language + ' ' + key + ': one of two segments');
  }
});

// ---- the movement of an instalment: merchant and category only ------------------------------------------------------

const tv = domain.newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-08-10', principalMinor: 120000000, count: 12,
  placement: 'current', interestMinor: 2400000, interestCategory: 'Intereses', createdAt });
const [principalShare, interestShare] = domain.installmentEntries(tv, cardAccount.id, tv.schedule[0]);
const planData: domain.LedgerArchive = { ...base, records: [domain.initialRecord(principalShare), domain.initialRecord(interestShare)], installmentPlans: [tv] };

test('24T2: an instalment\'s movement opens a restricted form: the amount, the date and the card read as facts, only the merchant and the category are editable', async () => {
  assert.equal(principalShare.id, 'inst_tv_001');
  const view = harness({ original: planData.records[0] }, { data: planData });
  let root = view.render();
  for (const input of ['AmountField', 'DateField', 'AccountField', 'Choices']) assert.equal(has(root, input), false, 'no ' + input);
  assert.equal(section(root), undefined);
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Editar cuota');
  assert.ok(texts(root).includes('Importe de la cuota' + NBSP + '·' + NBSP + 'ARS'));
  assert.deepEqual([find(root, 'Money').props.minor, find(root, 'Money').props.currency], [10000000, 'ARS']);
  assert.equal(find(root, 'DetailRow', 'Tarjeta').props.value, 'Visa Gold');
  assert.equal(find(root, 'DetailRow', 'Tarjeta').props.onPress, undefined, 'a fact, not a selector');
  assert.deepEqual([find(root, 'DetailRow', 'Fecha').props.value, find(root, 'DetailRow', 'Fecha').props.spokenValue], ['28 ago 2026', '28 de agosto de 2026']);
  assert.ok(texts(root).includes('El importe, la fecha y la tarjeta los define el plan de cuotas. Podés corregir el comercio y la categoría.'));
  assert.equal(texts(root).includes(translate('es', 'entryForm.correctionNote')), false);
  assert.deepEqual([find(root, 'Field').props.value, find(root, 'CategoryField').props.value], ['Electro', 'Hogar']);
  // Unchanged: closes without writing.
  await saveButton(root).props.onPress();
  assert.deepEqual([view.updates.length, view.backs()], [0, 1]);

  const edit = harness({ original: planData.records[0] }, { data: planData });
  find(edit.render(), 'Field').props.onChangeText('Electro Centro');
  find(edit.render(), 'CategoryField').props.onChange('Tecnología');
  root = edit.render();
  assert.equal(saveButton(root).props.label, 'Guardar cambios');
  await saveButton(root).props.onPress();
  assert.equal(edit.updates.length, 1);
  const change = edit.updates[0];
  assert.equal(change.action, 'edit');
  assert.equal(JSON.stringify(change.before), JSON.stringify(planData.records[0]));
  assert.equal(JSON.stringify(change.after.entry), JSON.stringify({ ...principalShare, merchant: 'Electro Centro', category: 'Tecnología' }), 'the same amount, date, account and kind');
  assert.doesNotThrow(() => domain.assertInstallmentEntryChange(change.before.entry, change.after.entry), 'exactly what storage permits');
  assert.deepEqual([edit.additions.length, edit.plans.length, edit.backs()], [0, 0, 1]);

  // The interest share of the same instalment is restricted the same way.
  const interest = harness({ original: planData.records[1] }, { data: planData });
  root = interest.render();
  assert.equal(interestShare.id, 'insti_tv_001');
  assert.deepEqual([find(root, 'Stack.Screen').props.options.title, find(root, 'Money').props.minor, find(root, 'CategoryField').props.value], ['Editar cuota', 200000, 'Intereses']);
  assert.equal(has(root, 'AmountField'), false);
  // English.
  const english = harness({ original: planData.records[0] }, { data: planData, locale: 'en-US' }).render();
  assert.equal(find(english, 'Stack.Screen').props.options.title, 'Edit installment');
  assert.ok(texts(english).includes('The installment plan sets the amount, the date and the card. You can correct the merchant and the category.'));
  assert.equal(find(english, 'DetailRow', 'Card').props.value, 'Visa Gold');
});

test('24T2: a plain movement\'s edit is unchanged: amount, kind, account and date stay editable, with the correction note', async () => {
  const plain: domain.Entry = { id: 'plain', accountId: 'card-acc', kind: 'expense', amountMinor: 23100, merchant: 'Café', category: 'Comida', dateISO: '2026-09-12', createdAt };
  const view = harness({ original: domain.initialRecord(plain) }, { data: { ...planData, records: [...planData.records, domain.initialRecord(plain)] } });
  const root = view.render();
  for (const input of ['AmountField', 'DateField', 'AccountField', 'Choices']) assert.equal(has(root, input), true, input);
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Editar movimiento');
  assert.ok(texts(root).includes(translate('es', 'entryForm.correctionNote')));
  assert.equal(section(root), undefined);
  find(root, 'AmountField').props.onChangeText('250');
  await saveButton(view.render()).props.onPress();
  assert.deepEqual([view.updates.length, view.updates[0].after.entry.amountMinor, view.updates[0].after.entry.dateISO], [1, 25000, '2026-09-12']);
});
