import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as bind from '../src/i18n/bind.ts';
import { bindLocale, withHeldCurrencies } from '../src/i18n/bind.ts';
import { currencyName, currencyUnit, formatMoneyAmount, formatWholeUnits, moneyText, spokenMinor, spokenMoney, unitWordShared } from '../src/i18n/format.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import * as locale from '../src/i18n/locale.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import { translator } from '../src/i18n/messages.ts';
import * as preference from '../src/i18n/preference.ts';
import * as storeModule from '../src/i18n/store.ts';
import { createLocaleStore } from '../src/i18n/store.ts';
import * as currencies from '../src/ui/currencies.ts';
import { currencyOptionLabel, currencySwitchMode } from '../src/ui/currencies.ts';
import { amountFieldLayout, amountTextRoom, amountWidthEm, fitFontSize, rowStacks } from '../src/ui/geometry.ts';

// Producto 24B3, stage 4 of docs/currency.md §7.5: presentation and copy for every catalogue
// currency. ARS and USD keep every string they had (the goldens of 24B1 and the presentation
// comparison prove it); this file pins what the other currencies show and say, the spoken-unit
// rule when a ledger holds two currencies sharing a word, the chart scale in whole units, the
// currency switch beyond two currencies, and the fits at 320 pt and at large text.
const LOCALES: AppLocale[] = ['es-AR', 'en-AR', 'es-US', 'en-US'];
type Currency = domain.Currency;

test('24B3: VoiceOver speaks every currency in the interface language with its own decimals; ARS and USD keep their words when nothing shares them', () => {
  const es = (minor: number, currency: Currency) => spokenMoney(minor, currency, 'es-AR');
  const en = (minor: number, currency: Currency) => spokenMoney(minor, currency, 'en-US');
  assert.equal(es(123456, 'ARS'), '1234,56 pesos');
  assert.equal(en(123456, 'USD'), '1234.56 dollars');
  assert.equal(es(123456, 'USD'), '1234,56 dólares');
  assert.equal(es(1234, 'EUR'), '12,34 euros');
  assert.equal(en(1234, 'EUR'), '12.34 euros');
  assert.equal(es(1500, 'JPY'), '1500 yenes japoneses');
  assert.equal(en(1500, 'JPY'), '1500 Japanese yen');
  assert.equal(es(1, 'JPY'), '1 yen japonés', 'the singular for exactly one whole unit of a currency without decimals');
  assert.equal(es(1234567, 'KWD'), '1234,567 dinares kuwaitíes');
  assert.equal(en(1234567, 'KWD'), '1234.567 Kuwaiti dinars');
  assert.equal(es(1500, 'CLP'), '1500 pesos chilenos');
  assert.equal(en(123456, 'CAD'), '1234.56 Canadian dollars');
  assert.equal(es(-1500, 'JPY'), 'Menos 1500 yenes japoneses');
  assert.equal(en(-1500, 'CLP'), 'Minus 1500 Chilean pesos');
  // The region never changes what is said: the language's decimal mark, no grouping.
  for (const tag of LOCALES) {
    assert.equal(spokenMoney(1234567, 'KWD', tag), tag.startsWith('en') ? '1234.567 Kuwaiti dinars' : '1234,567 dinares kuwaitíes', tag);
    assert.equal(spokenMinor(1234567, 'KWD', tag), tag.startsWith('en') ? '1234.567' : '1234,567', tag);
    assert.equal(spokenMinor(1500, 'JPY', tag), '1500', tag);
  }
});

test('24B3: a short unit word another held currency shares gives way to the full CLDR name; ARS/USD-only ledgers are unchanged', () => {
  const held = (...codes: Currency[]) => codes;
  // The ledgers of today: exactly ARS and USD, in any combination, keep the words of 23.1C2.
  for (const set of [held(), held('ARS'), held('USD'), held('ARS', 'USD')]) {
    assert.equal(spokenMoney(123456, 'ARS', 'es-AR', set), '1234,56 pesos', JSON.stringify(set));
    assert.equal(spokenMoney(123456, 'USD', 'es-AR', set), '1234,56 dólares', JSON.stringify(set));
    assert.equal(spokenMoney(123456, 'ARS', 'en-US', set), '1234.56 pesos', JSON.stringify(set));
    assert.equal(spokenMoney(123456, 'USD', 'en-US', set), '1234.56 dollars', JSON.stringify(set));
  }
  // Another peso or dollar beside them: the full name, in both languages.
  assert.equal(spokenMoney(123456, 'ARS', 'es-AR', held('ARS', 'CLP')), '1234,56 pesos argentinos');
  assert.equal(spokenMoney(123456, 'ARS', 'en-US', held('ARS', 'CLP')), '1234.56 Argentine pesos');
  assert.equal(spokenMoney(1500, 'CLP', 'es-AR', held('ARS', 'CLP')), '1500 pesos chilenos', 'the other currency always used its full name');
  assert.equal(spokenMoney(123456, 'USD', 'es-AR', held('USD', 'CAD')), '1234,56 dólares estadounidenses');
  assert.equal(spokenMoney(123456, 'USD', 'en-US', held('USD', 'CAD')), '1234.56 US dollars');
  assert.equal(spokenMoney(123456, 'USD', 'en-US', held('USD', 'AUD')), '1234.56 US dollars');
  assert.equal(spokenMoney(123456, 'USD', 'es-AR', held('ARS', 'USD', 'EUR', 'JPY')), '1234,56 dólares', 'a currency that shares no word changes nothing');
  assert.equal(spokenMoney(123456, 'ARS', 'es-AR', held('ARS', 'MXN', 'USD')), '1234,56 pesos argentinos');
  assert.equal(spokenMoney(-123456, 'USD', 'en-US', held('USD', 'CAD')), 'Minus 1234.56 US dollars');
  // The rule itself, on whole words.
  assert.equal(unitWordShared('pesos', 'ARS', 'es', held('ARS', 'CLP')), true);
  assert.equal(unitWordShared('pesos', 'ARS', 'es', held('ARS', 'USD')), false);
  assert.equal(unitWordShared('pesos', 'ARS', 'es', held('CLP')), true, 'the currency itself need not be in the set');
  assert.equal(unitWordShared('dollars', 'USD', 'en', held('USD', 'CAD')), true);
  assert.equal(unitWordShared('US dollars', 'USD', 'en', held('USD', 'CAD')), false, 'a two-word legacy name is compared whole');
  assert.equal(unitWordShared('dólares', 'USD', 'es', held('USD', 'SVC', 'XXX')), false, 'a currency without a name in the language cannot share a word');
  assert.equal(unitWordShared('', 'ARS', 'es', held('ARS', 'CLP')), false);
  // `currencyUnit` is what the labels use: the catalogued word, or the full name.
  assert.equal(currencyUnit('ARS', 'es-AR', held('ARS', 'USD'), 'pesos'), 'pesos');
  assert.equal(currencyUnit('ARS', 'es-AR', held('ARS', 'CLP'), 'pesos'), 'pesos argentinos');
  assert.equal(currencyUnit('ARS', 'es-AR', held('ARS', 'CLP'), 'pesos argentinos'), 'pesos argentinos', 'a legacy word that is already the full name is kept');
  assert.equal(currencyUnit('USD', 'en-US', held('USD', 'CAD'), 'US dollars'), 'US dollars');
  assert.equal(currencyUnit('USD', 'es-AR', held('USD', 'CAD'), 'dólares'), 'dólares estadounidenses');
  assert.equal(currencyUnit('JPY', 'es-AR'), 'yenes japoneses');
  assert.equal(currencyUnit('JPY', 'en-US', [], undefined, '1'), 'Japanese yen');
  assert.equal(currencyUnit('KWD', 'en-US'), 'Kuwaiti dinars');
  assert.equal(currencyUnit('VED', 'es-AR'), 'VED', 'no Spanish name in CLDR: the code, never the English name');
});

test('24B3: the bound locale carries the held currencies and rebinds only the unit words', () => {
  const plain = bindLocale('es-AR');
  assert.equal('formatAmount' in plain, false, 'the currency-less visible formatter is no longer bound');
  assert.equal('spokenNumber' in plain, false, 'nor the currency-less spoken one');
  assert.deepEqual(plain.heldCurrencies, []);
  assert.equal(plain.spokenMoney(123456, 'ARS'), '1234,56 pesos');
  assert.equal(plain.spokenMinor(1234567, 'KWD'), '1234,567');
  assert.equal(plain.formatMoneyAmount(1500, 'JPY'), '1.500');
  assert.equal(plain.formatWholeUnits(123456789, 'ARS'), '1.234.568');
  assert.equal(plain.currencyUnit('JPY'), 'yenes japoneses');
  const held = withHeldCurrencies(plain, ['ARS', 'CLP']);
  assert.deepEqual(held.heldCurrencies, ['ARS', 'CLP']);
  assert.equal(held.spokenMoney(123456, 'ARS'), '1234,56 pesos argentinos');
  assert.equal(held.currencyUnit('ARS', 'pesos'), 'pesos argentinos');
  assert.equal(held.spokenAmount(123456, 'ARS'), '1234,56 ARS', 'the code form never changes');
  for (const name of ['formatMoneyAmount', 'moneyText', 'codedAmount', 'spokenMinor', 'spokenAmount', 'formatDate', 'currencyName', 'currencySymbol', 't'] as const) {
    assert.equal(held[name], plain[name], name + ' is the same function: a consumer that never speaks a unit sees no change');
  }
  assert.equal(bindLocale('en-US', 'none', null, ['USD', 'CAD']).spokenMoney(5, 'USD'), '0.05 US dollars');
  assert.equal(withHeldCurrencies(plain, []).spokenMoney(123456, 'ARS'), '1234,56 pesos');
});

test('24B3: the chart scale is the amount in whole units of its currency, rounded half up on the digits, never a float', () => {
  assert.equal(formatWholeUnits(123456789, 'ARS'), '1.234.568');
  assert.equal(formatWholeUnits(123456749, 'ARS'), '1.234.567');
  assert.equal(formatWholeUnits(123456750, 'USD', 'en-US'), '1,234,568');
  assert.equal(formatWholeUnits(49, 'ARS'), '0');
  assert.equal(formatWholeUnits(50, 'ARS'), '1');
  assert.equal(formatWholeUnits(0, 'ARS'), '0');
  assert.equal(formatWholeUnits(-40, 'ARS'), '0', 'no minus sign on a zero');
  assert.equal(formatWholeUnits(-150, 'ARS'), '-2');
  assert.equal(formatWholeUnits(1500, 'JPY'), '1.500', 'no decimals: the amount itself');
  assert.equal(formatWholeUnits(1500, 'JPY', 'en-US'), '1,500');
  assert.equal(formatWholeUnits(1234567, 'KWD'), '1.235', '1234,567 dinars round to 1.235');
  assert.equal(formatWholeUnits(1234499, 'KWD'), '1.234');
  assert.equal(formatWholeUnits(999999999999999, 'ARS'), '10.000.000.000.000', 'the largest typed amount rounds up exactly');
  assert.equal(formatWholeUnits(Number.MAX_SAFE_INTEGER, 'JPY'), '9.007.199.254.740.991', 'the safe limit is exact');
  assert.throws(() => formatWholeUnits(Number.MAX_SAFE_INTEGER + 2, 'ARS'), /Monto inválido/, 'an unsafe value is refused, never rounded');
});

test('24B3: one template names every currency in a chooser, with the short words kept for ARS and USD', () => {
  const es = translator('es'), en = translator('en');
  assert.equal(currencyOptionLabel('ARS', es, 'es-AR'), 'Pesos · ARS');
  assert.equal(currencyOptionLabel('USD', es, 'es-AR'), 'Dólares · USD');
  assert.equal(currencyOptionLabel('ARS', en, 'en-US'), 'Pesos · ARS');
  assert.equal(currencyOptionLabel('USD', en, 'en-US'), 'Dollars · USD');
  assert.equal(currencyOptionLabel('EUR', es, 'es-AR'), 'Euros · EUR');
  assert.equal(currencyOptionLabel('JPY', es, 'es-AR'), 'Yenes japoneses · JPY');
  assert.equal(currencyOptionLabel('JPY', en, 'en-US'), 'Japanese yen · JPY');
  assert.equal(currencyOptionLabel('KWD', en, 'en-AR'), 'Kuwaiti dinars · KWD');
  assert.equal(currencyOptionLabel('CLP', es, 'es-US'), 'Pesos chilenos · CLP');
  assert.equal(currencyOptionLabel('CAD', en, 'en-US'), 'Canadian dollars · CAD');
  assert.equal(currencyOptionLabel('VED', es, 'es-AR'), 'VED · VED', 'no name in the language: the code stands in, never another language');
  assert.deepEqual([0, 1, 2, 3, 7, 150].map(currencySwitchMode), ['segments', 'segments', 'segments', 'picker', 'picker', 'picker']);
  assert.deepEqual(currencies.offeredCurrencies(), ['ARS', 'USD'], 'a new card, debt or budget still takes exactly the gate\'s currencies');
});

// ---- The currency switch component --------------------------------------------------------
type Node = { type: any; props: Record<string, any> };
/** Objects made inside the vm context have another realm's prototypes: compare by value. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const nodes = (value: any): Node[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : !value.props ? [] : [value, ...nodes(value.props.children)];

function loadSwitch(tag: AppLocale = 'es-AR', held: readonly Currency[] = []) {
  const source = readFileSync(new URL('../src/ui/currency-switch.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const state: unknown[] = [];
  let cursor = 0;
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; }, useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    'react-native': { StyleSheet: { hairlineWidth: 0.5 } },
    '@finanzapp/domain': domain,
    './components': { AppText: 'AppText', Choices: 'Choices', PressFeedback: 'PressFeedback' },
    './form-controls': { CurrencySheet: 'CurrencySheet' },
    './currencies': currencies,
    '../i18n/provider': { useI18n: () => bindLocale(tag, 'none', null, held) },
    './theme': { radius: { button: 14 }, usePalette: () => ({ inset: '#EEEEF3', primary: '#2557D6' }) },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected currency-switch dependency: ' + name);
    return modules[name];
  } });
  return { render: (props: any) => { cursor = 0; return module.exports.CurrencySwitch(props); }, SEARCHABLE_FROM: module.exports.SEARCHABLE_FROM as unknown as number };
}

test('24B3: with one or two currencies the switch is the segmented control of before; the forms\' segments read exactly as they did', () => {
  const chosen: string[] = [];
  const es = loadSwitch('es-AR');
  const two = es.render({ value: 'ARS', currencies: ['ARS', 'USD'], onChange: (code: string) => chosen.push(code) });
  assert.equal(two.type, 'Choices');
  assert.deepEqual(plain(two.props.options), [{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]);
  assert.equal(two.props.value, 'ARS');
  two.props.onChange('USD');
  assert.deepEqual(chosen, ['USD']);
  assert.deepEqual(loadSwitch('en-US').render({ value: 'USD', currencies: ['ARS', 'USD'], onChange: () => {} }).props.options.map((option: any) => option.label), ['Pesos · ARS', 'Dollars · USD']);
  // Inicio keeps its bare codes beside the metric control.
  assert.deepEqual(plain(es.render({ value: 'ARS', currencies: ['ARS', 'USD'], onChange: () => {}, labels: 'code' }).props.options), [{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }]);
  assert.equal(es.render({ value: 'ARS', currencies: ['ARS', 'USD'], onChange: () => {}, disabled: true }).props.disabled, true);
  assert.equal(es.render({ value: 'ARS', currencies: ['ARS'], onChange: () => {} }).type, 'Choices', 'one currency is still the compact control (the screens hide it)');
  assert.deepEqual(es.render({ value: 'JPY', currencies: ['ARS', 'JPY'], onChange: () => {} }).props.options.map((option: any) => option.label), ['Pesos · ARS', 'Yenes japoneses · JPY']);
});

test('24B3: with three or more currencies the switch is a row that opens the currency sheet, and it lists exactly the currencies given', () => {
  const chosen: string[] = [];
  const es = loadSwitch('es-AR', ['ARS', 'USD', 'JPY']);
  let view = es.render({ value: 'JPY', currencies: ['ARS', 'USD', 'JPY'], onChange: (code: string) => chosen.push(code) });
  assert.equal(view.type, 'Fragment');
  const row = nodes(view).find(node => node.type === 'PressFeedback')!;
  assert.equal(row.props.accessibilityRole, 'button');
  assert.equal(row.props.accessibilityLabel, 'Moneda: Yenes japoneses');
  assert.equal(row.props.accessibilityHint, 'Abre la lista de monedas para elegir otra');
  assert.deepEqual(nodes(row).filter(node => node.type === 'AppText').map(node => [node.props.children, node.props.accessible, node.props.numberOfLines]), [['Yenes japoneses · JPY', false, 1]]);
  assert.ok(nodes(row).some(node => node.type === 'Ionicons' && node.props.name === 'chevron-down'));
  let sheet = nodes(view).find(node => node.type === 'CurrencySheet')!;
  assert.equal(sheet.props.visible, false);
  assert.equal(sheet.props.title, 'Elegir moneda');
  assert.equal(sheet.props.value, 'JPY');
  assert.equal(sheet.props.searchable, false, 'three currencies need no search field');
  assert.deepEqual(plain(sheet.props.options).map(({ code, name, symbol }: any) => ({ code, name, symbol })), [{ code: 'ARS', name: 'Pesos argentinos', symbol: '$' }, { code: 'USD', name: 'Dólares estadounidenses', symbol: 'US$' }, { code: 'JPY', name: 'Yenes japoneses', symbol: 'JP¥' }],
    'the currencies given, in their order, with the language\'s names and the region\'s symbols: never the whole catalogue');
  row.props.onPress();
  view = es.render({ value: 'JPY', currencies: ['ARS', 'USD', 'JPY'], onChange: (code: string) => chosen.push(code) });
  sheet = nodes(view).find(node => node.type === 'CurrencySheet')!;
  assert.equal(sheet.props.visible, true);
  sheet.props.onChange('USD');
  assert.deepEqual(chosen, ['USD'], 'choosing reports the code and nothing else: no amount is converted');
  view = es.render({ value: 'USD', currencies: ['ARS', 'USD', 'JPY'], onChange: () => {} });
  assert.equal(nodes(view).find(node => node.type === 'CurrencySheet')!.props.visible, false, 'the sheet closes on a choice');
  assert.equal(nodes(view).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, 'Moneda: Dólares estadounidenses');
  // The bare-code variant (Inicio) keeps the row short; the sheet still names every currency.
  const compact = es.render({ value: 'ARS', currencies: ['ARS', 'USD', 'JPY'], onChange: () => {}, labels: 'code' });
  assert.deepEqual(nodes(compact).filter(node => node.type === 'AppText').map(node => node.props.children), ['ARS']);
  // Six or more: a search field.
  const many = loadSwitch('en-US').render({ value: 'ARS', currencies: ['ARS', 'USD', 'EUR', 'JPY', 'KWD', 'CLP', 'CAD'], onChange: () => {} });
  const manySheet = nodes(many).find(node => node.type === 'CurrencySheet')!;
  assert.equal(manySheet.props.searchable, true);
  assert.deepEqual(manySheet.props.options.map((option: any) => option.name), ['Argentine pesos', 'US dollars', 'Euros', 'Japanese yen', 'Kuwaiti dinars', 'Chilean pesos', 'Canadian dollars']);
  assert.equal(nodes(many).find(node => node.type === 'PressFeedback')!.props.accessibilityLabel, 'Currency: Argentine pesos');
  assert.equal(loadSwitch().SEARCHABLE_FROM, 6);
  const disabled = es.render({ value: 'ARS', currencies: ['ARS', 'USD', 'JPY'], onChange: () => {}, disabled: true });
  assert.deepEqual(plain(nodes(disabled).find(node => node.type === 'PressFeedback')!.props.accessibilityState), { disabled: true });
});

// ---- The held currencies reach every consumer through the real provider ----------------------
const require = createRequire(import.meta.url);
const React = require('react') as typeof import('react');
const renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { act } = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const consoleError = console.error;
console.error = (...args: unknown[]) => { if (!String(args[0]).startsWith('react-test-renderer is deprecated')) consoleError(...args); };
const h = React.createElement;

function loadProvider() {
  const source = readFileSync(new URL('../src/i18n/provider.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const modules: Record<string, unknown> = {
    react: React, 'react-native': { AppState: { addEventListener: () => ({ remove: () => {} }) } },
    './bind.ts': bind, './format.ts': i18nFormat, './locale.ts': locale, './preference.ts': preference, './store.ts': storeModule,
    './device-runtime': { readRuntimeDeviceLocales: () => { throw new Error('not used'); }, subscribeRuntimeLocaleChanges: () => () => {} },
  };
  const module = { exports: {} as any };
  runInNewContext(code, { module, exports: module.exports, process: { env: {} }, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected provider dependency: ' + name);
    return modules[name];
  } });
  return module.exports as typeof import('../src/i18n/provider.tsx');
}

test('24B3: HeldCurrenciesProvider tells every consumer which currencies the ledger holds, rebuilding the binding only when the set changes', () => {
  const provider = loadProvider();
  const seen: { label: string; i18n: bind.I18n }[] = [];
  function Consumer() {
    const i18n = provider.useI18n();
    seen.push({ label: i18n.spokenMoney(123456, 'ARS'), i18n });
    return null;
  }
  const rows = new Map<string, string>();
  const store = createLocaleStore({ devices: () => ({ source: 'native', locales: [{ languageTag: 'es-AR', languageCode: 'es', regionCode: 'AR' }] }),
    store: () => ({ getItemSync: key => rows.get(key) ?? null, setItemSync: (key, value) => { rows.set(key, value); }, removeItemSync: key => rows.delete(key) }) });
  let root: ReturnType<typeof renderer.create>;
  let currencies: Currency[] = ['ARS', 'USD'];
  const App = () => h(provider.I18nProvider, { store, children: h(provider.HeldCurrenciesProvider, { currencies, children: h(Consumer) }) });
  act(() => { root = renderer.create(h(App)); });
  assert.equal(seen.at(-1)!.label, '1234,56 pesos');
  const first = seen.at(-1)!.i18n;
  currencies = ['ARS', 'USD'];
  act(() => { root.update(h(App)); });
  assert.equal(seen.at(-1)!.i18n, first, 'the same set (a new array) keeps the same binding');
  currencies = ['ARS', 'USD', 'CLP'];
  act(() => { root.update(h(App)); });
  assert.equal(seen.at(-1)!.label, '1234,56 pesos argentinos', 'a Chilean peso account makes the Argentine one say its full name');
  assert.notEqual(seen.at(-1)!.i18n, first);
  currencies = [];
  act(() => { root.update(h(App)); });
  assert.equal(seen.at(-1)!.label, '1234,56 pesos', 'an empty ledger reads like an ARS/USD one');
  act(() => { store.setLanguage('en'); });
  currencies = ['USD', 'CAD'];
  act(() => { root.update(h(App)); });
  assert.equal(seen.at(-1)!.i18n.spokenMoney(5, 'USD'), '0.05 US dollars', 'a language change and the held set compose');
  act(() => { root.unmount(); });
});

// ---- Fits at 320 pt and at large text -------------------------------------------------------
const NARROW = 320 - 40;
const LONGEST: { text: string; currency: Currency; minor: number }[] = [
  { text: moneyText(999999999999999, 'JPY'), currency: 'JPY', minor: 999999999999999 },
  { text: moneyText(999999999999999, 'KWD'), currency: 'KWD', minor: 999999999999999 },
  { text: moneyText(999999999999999, 'ARS'), currency: 'ARS', minor: 999999999999999 },
  { text: moneyText(-999999999999999, 'CAD', 'en-US', false, true), currency: 'CAD', minor: -999999999999999 },
];

test('24B3: the longest amount of every exponent fits a hero and a row at 320 pt, and long symbols never clip', () => {
  assert.equal(LONGEST[0].text, 'JP¥ 999.999.999.999.999');
  assert.equal(LONGEST[1].text, 'KWD 999.999.999.999,999');
  assert.equal(LONGEST[3].text, '−CA$ 9,999,999,999,999.99');
  for (const { text } of LONGEST) {
    for (const scale of [1, 1.4]) {
      // The hero shrinks to the largest size at which the whole string fits, never below half its base (22 pt).
      const size = fitFontSize(text, NARROW, 44, 22, scale);
      assert.ok(size >= 22 && size <= 44, text + ' ×' + scale + ': ' + size);
      if (size > 22) assert.ok(amountWidthEm(text) * size * scale <= NARROW, text + ' fits whole at ' + size);
    }
    // A row cannot hold it beside a name: it stacks (the amount takes its own line) instead of shrinking or clipping.
    assert.equal(rowStacks(320, 1, text), true, text + ' stacks at 320 pt');
    assert.equal(rowStacks(320, 1.8, text), true, text + ' stacks at the largest text size');
    // The amount field: the symbol's width is taken from the row, and the digits keep at least the minimum size.
    const display = formatMoneyAmount(999999999999999, 'KWD');
    for (const symbol of ['JP¥', 'KWD', 'CA$']) {
      const box = amountFieldLayout(display, NARROW, symbol, 6, 1.4);
      assert.ok(box.fontSize >= 24, symbol + ': the field keeps its floor');
      if (box.fontSize > 24) assert.ok(amountTextRoom(NARROW, symbol, box.symbolSize, 6, 1.4) >= amountWidthEm(display) * box.fontSize * 1.4 - 0.5, symbol + ' fits beside the symbol');
    }
  }
  // Short amounts in the same currencies stay at full size and inline.
  assert.equal(fitFontSize(moneyText(1500, 'JPY'), NARROW, 44, 22), 44);
  assert.equal(rowStacks(320, 1, moneyText(1234, 'KWD')), false, 'KWD 1,234 sits beside a name at 320 pt');
  assert.equal(rowStacks(320, 1, moneyText(1500, 'JPY')), false, 'JP¥ 1.500 too');
  assert.equal(rowStacks(393, 1, moneyText(1234567, 'KWD')), false, 'KWD 1.234,567 sits beside a name on the reported iPhone');
  assert.equal(rowStacks(320, 1, moneyText(1234567, 'KWD')), true, 'and stacks at 320 pt rather than shrinking');
  assert.equal(rowStacks(320, 1, moneyText(1500, 'CAD', 'en-US')), false, 'CA$ 15.00 fits beside a name');
  assert.equal(rowStacks(320, 1, moneyText(150000, 'CAD', 'en-US')), true, 'CA$ 1,500.00 stacks at 320 pt: a long symbol counts');
});

test('24B3: the names every locale shows for the fixture currencies are CLDR\'s, capitalised, never in another language', () => {
  const table: Record<string, [string, string]> = {
    ARS: ['Pesos argentinos', 'Argentine pesos'], USD: ['Dólares estadounidenses', 'US dollars'], EUR: ['Euros', 'Euros'], JPY: ['Yenes japoneses', 'Japanese yen'],
    KWD: ['Dinares kuwaitíes', 'Kuwaiti dinars'], CLP: ['Pesos chilenos', 'Chilean pesos'], CAD: ['Dólares canadienses', 'Canadian dollars'],
  };
  for (const [code, [es, en]] of Object.entries(table)) {
    assert.equal(currencyName(code as Currency, 'es-AR'), es, code);
    assert.equal(currencyName(code as Currency, 'es-US'), es, code + ': the region never changes a word');
    assert.equal(currencyName(code as Currency, 'en-US'), en, code);
    assert.equal(currencyName(code as Currency, 'en-AR'), en, code);
  }
});
