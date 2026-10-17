import assert from 'node:assert/strict';
import * as moneyInput from '../src/ui/money-input.ts';
import * as currencies from '../src/ui/currencies.ts';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import { offeredCurrencies } from '../src/ui/currencies.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { PREVIEW_CURRENCIES } from '../src/storage/currency-gate.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
/** 25D2: what VoiceOver was told through motion.tsx's `announce`, in order (its iOS-only queue is tested in motion.node.ts). */
const announced: string[] = [];

// Producto 19: the budget form on the actual module, with native hosts replaced
// by descriptors. The kind of limit (General / Por categoría) is the first
// question; a general budget never carries a category; saving stays explicit.
type Node = { type: string | ((props: any) => Node); props: Record<string, any> };
const createdAt = '2026-09-01T12:00:00.000Z';
const account: domain.Account = { id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const entry: domain.Entry = { id: 'e', accountId: 'a', kind: 'expense', amountMinor: 3000, merchant: 'Super', category: 'Supermercado', dateISO: '2026-09-10', createdAt };
const total: domain.MonthlyBudget = { id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 500000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const food: domain.MonthlyBudget = { id: 'food', scope: 'category', category: 'Comida', currency: 'ARS', monthISO: '2026-09', amountMinor: 150000, active: true, createdAt, revision: 0, updatedAt: createdAt };
const archive: domain.LedgerArchive = { accounts: [account], records: [domain.initialRecord(entry)], budgets: [total, food] };

function harness(props: any, data: domain.LedgerArchive = archive, save?: (budget: domain.MonthlyBudget) => Promise<void>, locale: AppLocale = 'es-AR', gate?: domain.CurrencyGate) {
  const i18nProvider = { useI18n: () => bindLocale(locale) };
  const source = readFileSync(new URL('../src/ui/budget-form.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const state: any[] = [], refs: any[] = [];
  let cursor = 0, refCursor = 0, uuid = 0, backs = 0;
  const saved: domain.MonthlyBudget[] = [];
  const alerts: any[] = [];
  // 25Q4: every haptic comes from motion.tsx; the recorder keeps each notification's type.
  const haptics: string[] = [];
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const ledger = { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data), ...(gate ? { gate } : {}),
    saveBudget: async (budget: domain.MonthlyBudget) => { saved.push(budget); await save?.(budget); } }) };
  const components = Object.fromEntries(['Screen', 'ActionButton', 'AmountField', 'AppText', 'Choices', 'ErrorMessage', 'FieldNote', 'IconButton'].map(name => [name, name]));
  const GATE = (typeof gate !== 'undefined' && gate) || domain.LEDGER_CURRENCIES;
  const defaults = { useDefaultCurrency: ({ accountCurrency, requested }: { accountCurrency?: string | null; requested?: unknown } = {}) => accountCurrency ?? (domain.isLedgerCurrency(requested, GATE) ? requested : 'ARS') };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useState: (initial: any) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (next: any) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef: (initial: any) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Keyboard: { dismiss() {} }, Alert: { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { canGoBack: () => true, back: () => { backs++; }, push: () => {}, replace: () => {} } },
    'expo-crypto': { randomUUID: () => 'budget-' + (++uuid) },
    './motion': { announce: (text: string, after = 'now') => { announced.push(after === 'leave' ? 'after leaving: ' + text : text); }, successHaptic: () => { haptics.push('Success'); }, errorHaptic: () => { haptics.push('Error'); }, warningHaptic: () => { haptics.push('Warning'); } },
    '@finanzapp/domain': domain,
    '../storage/LedgerProvider': ledger,
    './components': components, './money-input': moneyInput, './currencies': currencies, './currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    './form-controls': { CategoryField: 'CategoryField' },
    './use-default-currency': defaults,
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected budget-form dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; refCursor = 0; return module.exports.BudgetForm(props); }, saved, alerts, haptics, backs: () => backs };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children)];
}
function find(root: Node, type: string, label?: string): Node {
  const result = nodes(root).find(node => node.type === type && (!label || node.props.label === label));
  assert.ok(result, 'Missing ' + type + ' ' + (label ?? ''));
  return result;
}
const choice = (root: Node, value: string) => nodes(root).find(node => node.type === 'Choices' && node.props.options.some((option: any) => option.value === value))!;
const texts = (root: Node) => nodes(root).filter(node => node.type === 'AppText').map(node => Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children));

test('a new budget asks for its kind first; General hides the category picker and saves a total without any category', async () => {
  const view = harness({ monthISO: '2026-10', currency: 'ARS' }, { ...archive, budgets: [] });
  let root = view.render();
  const kind = choice(root, 'total');
  assert.deepEqual(kind.props.options.map((option: any) => option.label).join(','), 'General,Por categoría');
  assert.equal(kind.props.value, 'category', 'a sublimit unless the caller asked for a general budget');
  assert.ok(nodes(root).some(node => node.type === 'CategoryField'));
  kind.props.onChange('total');
  root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'CategoryField'), false, 'no category for a general budget');
  assert.ok(texts(root).includes('Presupuesto general'));
  // «Menos texto»: one line under the amount, the whole rule behind its information button.
  assert.equal(find(root, 'FieldNote').props.children, 'Techo de todos los gastos del mes en esta moneda.');
  assert.match(find(root, 'FieldNote').props.help.detail, /techo de todos los gastos registrados/);
  assert.equal(texts(root).some(text => text.includes('techo de todos los gastos registrados')), false, 'the full rule is not a standing paragraph');
  assert.equal(find(root, 'AmountField').props.currency, 'ARS');
  assert.equal(find(root, 'ActionButton', 'Guardar presupuesto').props.disabled, true, 'an amount is still required');
  find(root, 'AmountField').props.onChangeText('500.000');
  root = view.render();
  assert.equal(find(root, 'ActionButton', 'Guardar presupuesto').props.disabled, false, 'no category needed');
  await find(root, 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.equal(view.saved.length, 1);
  assert.equal(JSON.stringify({ ...view.saved[0] }), JSON.stringify({ id: 'budget-1', currency: 'ARS', monthISO: '2026-10', amountMinor: 50000000, active: true, createdAt: view.saved[0].createdAt, revision: 0, updatedAt: view.saved[0].createdAt, scope: 'total' }));
  assert.equal(Object.hasOwn(view.saved[0], 'category'), false);
  assert.equal(view.backs(), 1);
});

test('the scope parameter preselects General, and Por categoría still requires a category and keeps its semantics', async () => {
  const view = harness({ monthISO: '2026-10', currency: 'USD', scope: 'total' }, { ...archive, budgets: [] });
  let root = view.render();
  assert.equal(choice(root, 'total').props.value, 'total');
  assert.equal(find(root, 'AmountField').props.currency, 'USD');
  choice(root, 'total').props.onChange('category');
  root = view.render();
  assert.ok(texts(root).includes('Límite por categoría'));
  assert.ok(['sublímite', 'no se suma al presupuesto general'].every(part => find(root, 'FieldNote').props.help.detail.includes(part)));
  find(root, 'AmountField').props.onChangeText('1.500');
  root = view.render();
  assert.equal(find(root, 'ActionButton', 'Guardar presupuesto').props.disabled, true, 'a sublimit needs its category');
  find(root, 'CategoryField').props.onChange(' Comida ');
  root = view.render();
  await find(root, 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.deepEqual([view.saved[0].scope, view.saved[0].category, view.saved[0].currency, view.saved[0].amountMinor], ['category', 'Comida', 'USD', 150000]);
});

test('editing keeps the kind fixed: a total edits its amount only, a sublimit keeps its category and identity', async () => {
  const editTotal = harness({ original: total, monthISO: total.monthISO });
  let root = editTotal.render();
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false, 'kind and currency are not editable');
  assert.equal(nodes(root).some(node => node.type === 'CategoryField'), false);
  assert.equal(find(root, 'AmountField').props.value, '5.000,00');
  find(root, 'AmountField').props.onChangeText('600.000');
  root = editTotal.render();
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(JSON.stringify(editTotal.saved[0]), JSON.stringify({ ...total, amountMinor: 60000000, revision: 1, updatedAt: editTotal.saved[0].updatedAt }));
  assert.equal(Object.hasOwn(editTotal.saved[0], 'category'), false);
  const editFood = harness({ original: food, monthISO: food.monthISO });
  root = editFood.render();
  assert.equal(find(root, 'CategoryField').props.value, 'Comida');
  await find(root, 'ActionButton', 'Guardar cambios').props.onPress();
  assert.equal(editFood.saved.length, 0, 'an unchanged budget closes without writing');
  assert.equal(editFood.backs(), 1);
});

test('25N1 review: a save that committed but could not refresh keeps its own scope for the retry when the ledger later shows it', async () => {
  const data: domain.LedgerArchive = { ...archive, budgets: [food] };
  const view = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, data, async () => { throw new Error('database is locked'); });
  find(view.render(), 'AmountField').props.onChangeText('1');
  await find(view.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  // The write did land: a later refresh (the app back in front) shows the very budget this form is retrying.
  data.budgets = [food, view.saved[0]!];
  const root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'CategoryField'), false, 'still the general budget it was creating, never a category limit');
  const retry = find(root, 'ActionButton', 'Reintentar guardado');
  assert.equal(retry.props.disabled ?? false, false, 'the retry stays available');
  assert.equal(nodes(root).some(node => node.type === 'AppText' && /Para cambiarlo/.test(String(node.props.children))), false, 'never told it is taken by itself');
});

test('a failed write, a zero amount and a negative one keep the draft, and archiving asks first', async () => {
  // 24UX6E: a duplicate is now refused before the submission freezes (next test); the frozen retry is for a write that
  // failed after the input was valid, here a storage error on a budget nothing else conflicts with.
  const failed = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, { ...archive, budgets: [food] }, async () => { throw new Error('database is locked'); });
  find(failed.render(), 'AmountField').props.onChangeText('1');
  await find(failed.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  let root = failed.render();
  assert.equal(failed.saved.length, 1, 'the write was attempted');
  assert.equal(find(root, 'ErrorMessage').props.message, 'budgets.form.saveFailed', '25Q4: the form\'s own sentence, never the engine\'s text');
  assert.equal(find(root, 'AmountField').props.editable, false, 'the same submission stays frozen for retry');
  assert.equal(find(root, 'ActionButton', 'Reintentar guardado').props.label, 'Reintentar guardado');
  assert.equal(failed.haptics.join(','), 'Warning', '25Q4: sent and frozen for «Reintentar guardado», so Warning');
  const zero = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, { ...archive, budgets: [] });
  find(zero.render(), 'AmountField').props.onChangeText('0');
  await find(zero.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  root = zero.render();
  assert.match(find(root, 'ErrorMessage').props.message, /mayor que cero/);
  assert.equal(zero.saved.length, 0);
  assert.equal(find(root, 'AmountField').props.editable, true, 'invalid input never freezes the draft');
  assert.equal(zero.haptics.join(','), 'Error', '25Q4: refused before sending, so Error');
  const negative = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, { ...archive, budgets: [] });
  find(negative.render(), 'AmountField').props.onChangeText('-5');
  await find(negative.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.ok(find(negative.render(), 'ErrorMessage').props.message, 'a negative limit is refused');
  assert.equal(negative.saved.length, 0);
  assert.equal(negative.haptics.join(','), 'Error');
  const archiving = harness({ original: total, monthISO: total.monthISO });
  await find(archiving.render(), 'ActionButton', 'Eliminar presupuesto').props.onPress();
  assert.equal(archiving.alerts.length, 1);
  assert.equal(archiving.saved.length, 0, 'nothing until the person confirms');
  archiving.alerts[0].buttons[1].onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual([archiving.saved[0].scope, archiving.saved[0].active, archiving.saved[0].revision], ['total', false, 1]);
  assert.equal(archiving.haptics.join(','), 'Success');
});

test('24UX6E: a second general budget or a second limit for the same category, currency and month is an input error before anything freezes; the draft stays editable and a different choice saves once', async () => {
  // archive: a general ARS budget and a «Comida» sublimit for 2026-09, the rule storage applies (validateBudgetCollection).
  // 25N1: with a general budget already there «General» is never offered, even when asked for: the form is a category limit.
  const view = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' });
  let root = view.render();
  assert.equal(nodes(root).some(node => node.type === 'Choices'), false, 'no scope switch: General is taken');
  assert.ok(texts(root).includes('Límite por categoría'));
  find(root, 'AmountField').props.onChangeText('1');
  find(view.render(), 'CategoryField').props.onChange(' comida ');
  await find(view.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  root = view.render();
  assert.equal(view.saved.length, 0, 'nothing is written');
  assert.equal(find(root, 'ErrorMessage').props.message, 'Ya existe un presupuesto activo para esa categoría, moneda y mes.', 'the normalised category is the same one');
  assert.ok(texts(root).includes('Para cambiarlo, tocalo en Presupuestos.'), '25N1: the refusal says where to go');
  assert.equal(find(root, 'AmountField').props.editable, true, 'the draft is not frozen');
  assert.equal(nodes(root).some(node => node.type === 'ActionButton' && node.props.label === 'Reintentar guardado'), false, 'no retry that could never succeed');
  assert.equal(texts(root).some(text => text.includes('congelado')), false);
  find(view.render(), 'CategoryField').props.onChange('Ocio');
  root = view.render();
  assert.equal(texts(root).includes('Para cambiarlo, tocalo en Presupuestos.'), false, 'a free category: no pointer');
  await find(root, 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.deepEqual([view.saved.length, view.saved[0].scope, view.saved[0].category, view.saved[0].amountMinor], [1, 'category', 'Ocio', 100]);
  assert.equal(view.backs(), 1);
  assert.equal(view.haptics.join(','), 'Error,Success', '25Q4: one Error tap for the refusal before sending, then Success');
  // Another currency has no general budget: the switch is back and General saves.
  const other = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' });
  find(other.render(), 'CurrencySwitch').props.onChange('USD');
  assert.equal(choice(other.render(), 'total').props.value, 'total');
  // Another currency, or an archived general budget, is no conflict.
  const usd = harness({ monthISO: '2026-09', currency: 'USD', scope: 'total' });
  find(usd.render(), 'AmountField').props.onChangeText('1');
  await find(usd.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.equal(usd.saved.length, 1);
  const archived = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, { ...archive, budgets: [{ ...total, active: false, revision: 1, updatedAt: '2026-09-02T12:00:00.000Z' }, food] });
  find(archived.render(), 'AmountField').props.onChangeText('1');
  await find(archived.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.equal(archived.saved.length, 1);
  // Editing a sublimit onto another sublimit's category is refused the same way; English reads the rule in English.
  const leisure: domain.MonthlyBudget = { ...food, id: 'leisure', category: 'Ocio' };
  const edit = harness({ original: leisure, monthISO: leisure.monthISO }, { ...archive, budgets: [total, food, leisure] }, undefined, 'en-AR');
  find(edit.render(), 'CategoryField').props.onChange('Comida');
  await find(edit.render(), 'ActionButton', 'Save changes').props.onPress();
  root = edit.render();
  assert.equal(edit.saved.length, 0);
  assert.equal(bindLocale('en-AR').errorText(find(root, 'ErrorMessage').props.message), bindLocale('en-AR').errorText('Ya existe un presupuesto activo para esa categoría, moneda y mes.'));
  assert.equal(find(root, 'AmountField').props.editable, true);
  assert.notEqual(bindLocale('en-AR').errorText(find(root, 'ErrorMessage').props.message), find(root, 'ErrorMessage').props.message, 'the domain message has an English text');
});

test('24UX6E: «Eliminar presupuesto» is the app\'s destructive button (secondary, the alert tone, the trash glyph); the month title is on the type scale', () => {
  const root = harness({ original: total, monthISO: total.monthISO }).render();
  const remove = find(root, 'ActionButton', 'Eliminar presupuesto');
  assert.deepEqual([remove.props.secondary, remove.props.tone, remove.props.icon], [true, 'expense', 'trash-outline']);
  const month = nodes(root).find(node => node.type === 'AppText' && node.props.children === 'Septiembre de 2026')!;
  assert.deepEqual([month.props.variant, month.props.style], ['subhead', undefined]);
});

test('24UX6E: /new-budget opens the current month for a month the domain does not accept, and keeps a valid one', () => {
  const source = readFileSync(new URL('../app/new-budget.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const route = (params: Record<string, string>) => {
    const module = { exports: {} as { default?: () => Node } };
    const modules: Record<string, unknown> = { 'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }) },
      'expo-router': { useLocalSearchParams: () => params }, '@finanzapp/domain': domain, '../src/ui/budget-form': { BudgetForm: 'BudgetForm' } };
    runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
      if (!Object.hasOwn(modules, name)) throw new Error('Unexpected new-budget dependency: ' + name);
      return modules[name];
    } });
    return module.exports.default!().props;
  };
  const current = domain.currentMonthISO(domain.todayKey());
  for (const month of ['2026-13', '2026-00', '26-09', '']) assert.equal(route({ month }).monthISO, current, JSON.stringify(month));
  assert.deepEqual({ ...route({ month: '2026-02', currency: 'USD', scope: 'total' }) }, { currency: 'USD', scope: 'total', monthISO: '2026-02' });
});

test('in English the budget form is labelled in English, keeps the category as stored and saves exactly what Spanish saves', async () => {
  const run = async (locale: AppLocale) => {
    const view = harness({ monthISO: '2026-10', currency: 'ARS' }, { ...archive, budgets: [] }, undefined, locale);
    find(view.render(), 'AmountField').props.onChangeText('1.500');
    find(view.render(), 'CategoryField').props.onChange('Comida');
    const root = view.render();
    await find(root, 'ActionButton', locale === 'en-AR' ? 'Save budget' : 'Guardar presupuesto').props.onPress();
    return { root, saved: view.saved };
  };
  const english = await run('en-AR'), spanish = await run('es-AR');
  const root = english.root;
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'New budget');
  assert.equal(choice(root, 'total').props.options.map((option: any) => option.label).join(','), 'Overall,By category');
  // 24B3: the currency choice is the shared switch over the gate's currencies (its labels are tested in currency-switch.node.ts).
  assert.deepEqual({ ...find(root, 'CurrencySwitch').props, onChange: undefined }, { value: 'ARS', currencies: offeredCurrencies(domain.LEDGER_CURRENCIES, 'en-AR'), disabled: false, onChange: undefined });
  assert.equal(find(root, 'AmountField').props.label, 'Budget');
  assert.ok(texts(root).includes('October 2026'));
  assert.ok(texts(root).includes('Category limit'));
  assert.equal(find(root, 'FieldNote').props.children, 'A limit within the overall budget.');
  assert.ok(find(root, 'FieldNote').props.help.detail.startsWith('Compared with the expenses recorded in this category'));
  assert.equal(find(root, 'CategoryField').props.value, 'Comida', 'the stored category is never translated');
  const stable = (saved: domain.MonthlyBudget[]) => JSON.stringify(saved.map(({ createdAt: _c, updatedAt: _u, ...rest }) => rest));
  assert.equal(stable(english.saved), stable(spanish.saved), 'the language changes no stored field');
  assert.equal(english.saved[0].category, 'Comida');
  const archiving = harness({ original: total, monthISO: total.monthISO }, archive, undefined, 'en-AR');
  await find(archiving.render(), 'ActionButton', 'Delete budget').props.onPress();
  assert.equal(archiving.alerts[0].title, 'Delete this budget?');
  assert.equal(archiving.alerts[0].buttons.map((button: any) => button.text).join(','), 'Cancel,Delete');
  assert.equal(archiving.saved.length, 0);
});

test('a failed save stores the catalogue key, which reads the old Spanish text and English', async () => {
  const view = harness({ monthISO: '2026-09', currency: 'ARS', scope: 'total' }, { ...archive, budgets: [] }, async () => { throw 'offline'; });
  find(view.render(), 'AmountField').props.onChangeText('10');
  await find(view.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  const key = find(view.render(), 'ErrorMessage').props.message;
  assert.equal(key, 'budgets.form.saveFailed');
  assert.equal(bindLocale('es-AR').errorText(key), 'No se pudo guardar el presupuesto.');
  assert.equal(bindLocale('en-AR').errorText(key), 'Couldn’t save the budget.');
});

test('24B5: the budget form offers the gate\'s currencies before the amount; with the preview gate a Chilean peso and a dinar budget are saved at their own scale, and a route currency outside the gate is never coerced into it', async () => {
  const release = harness({ monthISO: '2026-10', currency: 'KWD' }, { ...archive, budgets: [] });
  assert.deepEqual(find(release.render(), 'CurrencySwitch').props.currencies, offeredCurrencies(domain.LEDGER_CURRENCIES, 'es-AR'), '24M: the 146 gated currencies, ARS and USD first');
  assert.equal(find(release.render(), 'CurrencySwitch').props.value, 'ARS', 'a route currency the release does not offer (held KWD) falls to ARS, never to KWD');
  assert.equal(find(harness({ monthISO: '2026-10', currency: 'CLP' }, { ...archive, budgets: [] }).render(), 'CurrencySwitch').props.value, 'CLP', '24M: the release offers CLP');
  const clp = harness({ monthISO: '2026-10', currency: 'CLP', scope: 'total' }, { ...archive, budgets: [] }, undefined, 'es-AR', PREVIEW_CURRENCIES);
  assert.deepEqual(find(clp.render(), 'CurrencySwitch').props.currencies, offeredCurrencies(PREVIEW_CURRENCIES, 'es-AR'));
  assert.equal(find(clp.render(), 'CurrencySwitch').props.value, 'CLP', 'the preview gate honours the route currency');
  assert.equal(find(clp.render(), 'AmountField').props.currency, 'CLP');
  find(clp.render(), 'AmountField').props.onChangeText('25.000');
  await find(clp.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.deepEqual([clp.saved[0].currency, clp.saved[0].amountMinor, clp.saved[0].scope], ['CLP', 25000, 'total'], '25.000 pesos chilenos are 25000 units');
  const kwd = harness({ monthISO: '2026-10', scope: 'total' }, { ...archive, budgets: [] }, undefined, 'es-AR', PREVIEW_CURRENCIES);
  find(kwd.render(), 'CurrencySwitch').props.onChange('KWD');
  assert.equal(find(kwd.render(), 'AmountField').props.currency, 'KWD');
  find(kwd.render(), 'AmountField').props.onChangeText('12,345');
  await find(kwd.render(), 'ActionButton', 'Guardar presupuesto').props.onPress();
  assert.deepEqual([kwd.saved[0].currency, kwd.saved[0].amountMinor], ['KWD', 12345]);
});

// Producto 24T3 (A24): the Presupuestos screen when devoluciones leave the month (or a category) below zero. The actual
// route with its hosts as descriptors and the real projection (`snapshotFromArchive`) of a purchase operation.
async function budgetsScreen(data: domain.LedgerArchive, locale: AppLocale = 'es-AR', window = { width: 390, height: 844, scale: 3, fontScale: 1 }, route: Record<string, string> = { currency: 'ARS', month: '2026-09' }) {
  const presentation = await import('../src/ui/presentation.ts');
  const reportPresentation = await import('../src/ui/report-presentation.ts');
  const budgetPresentation = await import('../src/ui/budget-presentation.ts');
  const geometry = await import('../src/ui/geometry.ts');
  const source = readFileSync(new URL('../app/budgets.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: Node['type'], props: Node['props']) => ({ type, props });
  const state: unknown[] = [];
  // 25D2: what VoiceOver is told through motion.tsx's `announce`, and the ticks of the month steps.
  const announced: string[] = [], ticks: string[] = [];
  let cursor = 0;
  const names = ['ActionButton', 'AppText', 'CategoryBadge', 'EmptyState', 'IconButton', 'Money', 'PressFeedback', 'Screen', 'SectionTitle', 'Stat', 'StatRow', 'Surface'];
  const modules: Record<string, unknown> = {
    '../src/i18n/provider': { useI18n: () => bindLocale(locale) },
    react: { useEffect: () => {}, useMemo: (fn: () => unknown) => fn(), useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', StyleSheet: { hairlineWidth: 0.5 }, useWindowDimensions: () => window },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useLocalSearchParams: () => route, router: { push: () => {} } },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }), withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ archive: data, snapshot: domain.snapshotFromArchive(data) }) },
    '../src/ui/budget-presentation': budgetPresentation,
    '../src/ui/category-hues': { useCategoryLabel: (s: string) => s },
    '../src/ui/components': Object.fromEntries(names.map(name => [name, name])),
    '../src/ui/currency-switch': { CurrencySwitch: 'CurrencySwitch' },
    '../src/ui/geometry': geometry,
    '../src/ui/use-default-currency': { useDefaultCurrency: () => 'ARS' },
    '../src/ui/presentation': presentation, '../src/ui/report-presentation': reportPresentation,
    '../src/ui/motion': { timing: () => ({ duration: 0 }), selectionHaptic: () => { ticks.push('Selection'); }, announce: (text: string) => { announced.push(text); } },
    '../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, useCurrentDay: () => '2026-09-20', useReduceMotion: () => true,
      usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', line: '#ddd', inset: '#eee', expense: '#c00', warning: '#a60', link: '#1D5647' }) },
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected budgets dependency: ' + name);
    return modules[name];
  } });
  // The screen's own row and panel components are expanded, so their texts and labels are read too.
  const expand = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(expand)
    : !value.props ? [] : [value, ...(typeof value.type === 'function' ? expand(value.type(value.props)) : []), ...expand(value.props.children)];
  return Object.assign(() => { cursor = 0; return expand(module.exports.default!()) as Node[]; }, { announced, ticks });
}

test('25Q1 (BUDGETS-02): a budget in a currency no account holds stays reachable: the switch offers it, its panel opens, and a note says there is nothing to compare', async () => {
  const textOf = (node: Node) => [node.props.children].flat().join('');
  const eur: domain.MonthlyBudget = { ...total, id: 'eur', currency: 'EUR', amountMinor: 20000 };
  const render = await budgetsScreen({ ...archive, budgets: [total, food, eur] });
  const currencySwitch = render().find(node => node.type === 'CurrencySwitch')!;
  assert.equal(currencySwitch.props.currencies.join(), 'ARS,EUR', 'before: ARS alone, so the EUR budget could be neither listed, edited nor deleted');
  const note = 'Todavía no tenés cuentas en euros, así que no hay gastos para comparar con este presupuesto.';
  assert.equal(render().filter(node => node.type === 'AppText').map(textOf).includes(note), false, 'ARS has an account: no note');
  currencySwitch.props.onChange('EUR');
  const tree = render();
  assert.ok(tree.filter(node => node.type === 'AppText').map(textOf).includes(note), 'a zero spent is no data here, never a verified zero');
  assert.ok(tree.some(node => node.type === 'View' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Presupuesto general')), 'its panel opens');
  // A deleted EUR account still holds the month's EUR spending: the budget reads it, with no note.
  const gone: domain.Account = { id: 'gone', name: 'Euros', currency: 'EUR', openingMinor: 0, createdAt, deletedAt: createdAt, revision: 1 };
  const spentInEuros: domain.Entry = { ...entry, id: 'eur-e', accountId: 'gone', amountMinor: 700 };
  const withHistory = await budgetsScreen({ ...archive, accounts: [account, gone], records: [entry, spentInEuros].map(domain.initialRecord), budgets: [total, food, eur] });
  withHistory().find(node => node.type === 'CurrencySwitch')!.props.onChange('EUR');
  const read = withHistory();
  assert.equal(read.filter(node => node.type === 'AppText').map(textOf).includes(note), false);
  assert.equal(read.filter(node => node.type === 'Stat').map(node => (node.props.children as Node).props.minor)[0], 700, 'Gastado reads the deleted account\'s euros');
  // Codex (#114): Reportes' «Administrar» names the budget's currency; Presupuestos opens on it although no account holds it.
  const routed = (await budgetsScreen({ ...archive, budgets: [total, food, eur] }, 'es-AR', undefined, { currency: 'EUR', month: '2026-09' }))();
  assert.equal(routed.find(node => node.type === 'CurrencySwitch')!.props.value, 'EUR');
  assert.ok(routed.filter(node => node.type === 'AppText').map(textOf).includes(note));
  // In a month with no EUR budget the note does not speak of «este presupuesto».
  const october = await budgetsScreen({ ...archive, budgets: [total, food, { ...eur, monthISO: '2026-10' }] });
  october().find(node => node.type === 'CurrencySwitch')!.props.onChange('EUR');
  assert.equal(october().filter(node => node.type === 'AppText').map(textOf).includes(note), false, 'September holds no EUR budget');
  // An inactive EUR budget adds no currency.
  assert.equal((await budgetsScreen({ ...archive, budgets: [total, food, { ...eur, active: false }] }))().some(node => node.type === 'CurrencySwitch'), false);
  const { budgetCurrencies } = await import('../src/ui/budget-presentation.ts');
  assert.equal(budgetCurrencies(['USD', 'ARS'], [eur, { ...eur, id: 'usd', currency: 'USD' }, { ...eur, id: 'jpy', currency: 'JPY', active: false }]).join(), 'ARS,USD,EUR');
});

test('24T3 (A24): devoluciones above a month\'s purchases leave the whole limit available, never more, and say so; Gastado keeps the exact net', async () => {
  const ropa: domain.Entry = { id: 'ropa', accountId: 'a', kind: 'expense', amountMinor: 80000, merchant: 'Tienda', category: 'Ropa', dateISO: '2026-08-20', createdAt };
  const comida: domain.Entry = { id: 'comida', accountId: 'a', kind: 'expense', amountMinor: 10000, merchant: 'Almacén', category: 'Comida', dateISO: '2026-09-10', createdAt };
  const refund: domain.EntryRefund = { id: 'dev-1', kind: 'refund', target: { entryId: 'ropa' }, accountId: 'a', currency: 'ARS', amountMinor: 30000, dateISO: '2026-09-05',
    voided: false, createdAt, revision: 0, updatedAt: createdAt };
  const ropaBudget: domain.MonthlyBudget = { ...food, id: 'ropa-budget', category: 'Ropa', amountMinor: 50000 };
  const data: domain.LedgerArchive = { accounts: [account], records: [ropa, comida].map(domain.initialRecord), purchaseOperations: [refund], budgets: [total, food, ropaBudget] };
  const summary = domain.summarizeMonthlyBudgets(domain.snapshotFromArchive(data), data.budgets!, 'ARS', '2026-09');
  assert.equal(summary.total!.spentMinor, 10000 - 30000);
  assert.equal(summary.total!.remainingMinor, 500000 + 20000, 'the domain keeps limit − spent (documented); the screen clamps it');
  const tree = (await budgetsScreen(data))();
  const textOf = (node: Node) => [node.props.children].flat().join('');
  const shown = tree.filter(node => node.type === 'AppText').map(textOf);
  const month = tree.find(node => node.type === 'AppText' && node.props.accessibilityRole === 'header' && node.props.variant === 'title3')!;
  // 25D1: Reportes' rule (Title 3's iOS size; beside the arrows while the year's longest word fits there).
  const geometry = await import('../src/ui/geometry.ts');
  const wordEm = geometry.widestWordEm(Array.from({ length: 12 }, (_, i) => bindLocale('es-AR').formatMonthTitle('2026-' + String(i + 1).padStart(2, '0'))));
  const fit = geometry.titleFit(1, 55 / 20, wordEm, 20 * 1.06, 390 - 144, 390 - 40);
  assert.equal(fit.stacked, false);
  assert.deepEqual([textOf(month), month.props.maxFontSizeMultiplier, month.props.numberOfLines], ['Septiembre de 2026', fit.maxScale, 2]);
  const state = tree.find(node => node.type === 'AppText' && node.props.variant === 'caption' && textOf(node) === 'Mes en curso')!;
  assert.equal(state.props.maxFontSizeMultiplier, undefined, 'its caption follows Caption 1\'s own ceiling, through AppText');
  // At AX5 the title takes the screen's width and the arrows move under it.
  const large = (await budgetsScreen(data, 'es-AR', { width: 390, height: 844, scale: 3, fontScale: 3.571 }))();
  const largeTitle = large.find(node => node.type === 'AppText' && node.props.accessibilityRole === 'header' && node.props.variant === 'title3')!;
  const ax5 = geometry.titleFit(3.571, 55 / 20, wordEm, 20 * 1.06, 390 - 144, 390 - 40);
  assert.deepEqual([ax5.stacked, largeTitle.props.maxFontSizeMultiplier], [true, ax5.maxScale]);
  const stepper = large.find(node => node.type === 'View' && [node.props.children].flat().some((child: any) => child === largeTitle || [child?.props?.children].flat().includes(largeTitle)))!;
  const steps = large.filter(node => node.type === 'View' && [node.props.children].flat().filter(Boolean).every((child: any) => child?.type === 'IconButton') && [node.props.children].flat().filter(Boolean).length === 2);
  assert.equal(steps.length, 1, 'the two arrows share a row of their own');
  assert.ok(stepper, 'the title is found');
  const hero = tree.find(node => node.type === 'Money' && node.props.large)!;
  assert.equal(hero.props.minor, 500000, 'Disponible is the limit, never above it');
  assert.ok(shown.includes('Las devoluciones superan lo gastado'));
  const spent = tree.filter(node => node.type === 'Stat').map(node => [node.props.label, (node.props.children as Node).props.minor]);
  assert.equal(JSON.stringify(spent), JSON.stringify([['Gastado', -20000], ['Límite', 500000]]), 'Gastado is the exact net: the devolución is shown');
  const panel = tree.find(node => node.type === 'View' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Presupuesto general'))!;
  assert.equal(panel.props.accessibilityLabel, 'Presupuesto general: ' + bindLocale('es-AR').spokenMoney(-20000, 'ARS') + ' de 5000,00 pesos, 0 por ciento usado. Quedan 5000,00 pesos. Las devoluciones superan lo gastado');
  // The Ropa sublimit: its devolución exceeds its (zero) purchases this month; the Comida one is untouched.
  const rows = tree.filter(node => node.type === 'PressFeedback' && /^Presupuesto (Ropa|Comida)/.test(node.props.accessibilityLabel));
  assert.equal(rows.find(row => row.props.accessibilityLabel.startsWith('Presupuesto Ropa'))!.props.accessibilityLabel,
    'Presupuesto Ropa: ' + bindLocale('es-AR').spokenMoney(-30000, 'ARS') + ' de 500,00 pesos, 0 por ciento. Quedan 500,00 pesos. Las devoluciones superan lo gastado');
  assert.ok(shown.includes('Quedan $ 500,00 de $ 500,00 · las devoluciones superan lo gastado'));
  assert.ok(shown.includes('Quedan $ 1.400,00 de $ 1.500,00'), 'Comida: 100,00 of 1.500,00 as before');
  assert.equal(shown.some(text => /Además gastaste/.test(text)), false, 'nothing unbudgeted is invented: the domain clamps it at zero');
  const english = (await budgetsScreen(data, 'en-AR'))().filter(node => node.type === 'AppText').map(textOf);
  assert.ok(english.includes('Refunds exceed what was spent'));
});

test('25D2: Presupuestos\' month steps tick and tell VoiceOver the month and its state; «Este mes» is named by its visible words', async () => {
  const render = await budgetsScreen({ ...archive, budgets: [total, food] });
  const arrow = (label: string) => render().find(node => node.type === 'IconButton' && node.props.label === label)!;
  arrow('Mes anterior').props.onPress();
  assert.deepEqual(render.announced, ['Agosto de 2026. Mes cerrado']);
  const link = render().find(node => node.type === 'PressFeedback' && node.props.accessibilityLabel === 'Este mes')!;
  assert.ok(link, 'Voice Control: «Tocar Este mes» finds it');
  assert.equal(link.props.accessibilityHint, 'Volver al mes actual');
  link.props.onPress();
  arrow('Mes siguiente').props.onPress();
  assert.deepEqual(render.announced.slice(1), ['Septiembre de 2026. Mes en curso', 'Octubre de 2026. Mes futuro · podés prepararlo']);
  assert.deepEqual(render.ticks, ['Selection', 'Selection', 'Selection'], 'each step ticks once, as on Reportes');
});

test('25D2: the general budget in amber says «Cerca del límite» to VoiceOver, as its status line shows; a calm one does not', async () => {
  const near = { ...total, amountMinor: 3500 };
  const render = await budgetsScreen({ ...archive, budgets: [near] });
  const panel = render().find(node => node.type === 'View' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Presupuesto general'))!;
  assert.equal(panel.props.accessibilityLabel, 'Presupuesto general: 30,00 pesos de 35,00 pesos, 85 por ciento usado. Cerca del límite. Quedan 5,00 pesos');
  const calm = (await budgetsScreen(archive))().find(node => node.type === 'View' && typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Presupuesto general'))!;
  assert.match(calm.props.accessibilityLabel, /\. Quedan 4970,00 pesos$/);
});
