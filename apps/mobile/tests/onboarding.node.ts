import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as i18nFormat from '../src/i18n/format.ts';
import * as localeOptions from '../src/ui/locale-options.ts';
import * as onboardingFlow from '../src/ui/onboarding-flow.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { DISPLAY_CURRENCY_KEY } from '../src/ui/display-currency.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, type PreferenceStore } from '../src/i18n/preference.ts';
import { createLocaleStore, type DeviceReading } from '../src/i18n/store.ts';
import type { ReleasedSets } from '../src/i18n/locale.ts';

// Producto 25B: the first opening. The pure rules (when it is shown, what it suggests, the order of its steps) are
// tested directly; the route runs in the harness with its hosts replaced by names. Not a rendered iPhone screen.
const { ONBOARDING_KEY, currencyStepOptions, markOnboardingDone, nextStep, onboardingDecision, onboardingSteps, previousStep, stepPosition,
  suggestedDisplayCurrency } = onboardingFlow;

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

test('the first opening is shown to a new installation only; anyone with accounts or a saved preference is marked done silently, untouched', () => {
  const fresh = memory();
  assert.equal(onboardingDecision(fresh.store, false), 'new');
  assert.equal(fresh.rows.size, 0, 'deciding writes nothing');
  assert.equal(onboardingDecision(memory().store, true), 'existing', 'a ledger with accounts');
  for (const key of [LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, DISPLAY_CURRENCY_KEY]) {
    assert.equal(onboardingDecision(memory({ [key]: 'x' }).store, false), 'existing', key + ' chosen by an earlier build');
  }
  assert.equal(onboardingDecision(memory({ 'finanzapp.displayMode': 'consolidated' }).store, false), 'new', 'the 24C1 mode marker is written by the app, not chosen');
  assert.equal(onboardingDecision(memory({ [ONBOARDING_KEY]: 'done' }).store, false), 'done');
  const broken = memory(); broken.faults.get = true;
  assert.equal(onboardingDecision(broken.store, false), 'existing', 'an unreadable store never shows a setup');
  const saved = memory();
  assert.equal(markOnboardingDone(saved.store), true);
  assert.deepEqual([...saved.rows.entries()], [[ONBOARDING_KEY, 'done']]);
  assert.equal(onboardingDecision(saved.store, false), 'done');
  const readOnly = memory(); readOnly.faults.set = true;
  assert.equal(markOnboardingDone(readOnly.store), false, 'reported, never thrown');
});

test('the region suggests a display currency the build offers, and only suggests: unknown regions and held currencies fall back to the default', () => {
  assert.equal(suggestedDisplayCurrency('AR'), 'ARS');
  assert.equal(suggestedDisplayCurrency('US'), 'USD');
  assert.equal(suggestedDisplayCurrency('JP'), 'JPY');
  assert.equal(suggestedDisplayCurrency('DE'), 'EUR');
  assert.equal(suggestedDisplayCurrency('KW'), 'ARS', 'KWD is held (three decimals): nothing the build offers');
  assert.equal(suggestedDisplayCurrency('KW', ['ARS', 'USD', 'KWD']), 'KWD', 'a preview gate that offers it');
  assert.equal(suggestedDisplayCurrency(null), 'ARS');
  assert.equal(suggestedDisplayCurrency('US', ['ARS']), 'ARS', 'a gate without the tender');
});

test('the steps: the welcome, then language, region (only when the build offers a choice), the currency of the totals, the optional account', () => {
  assert.deepEqual(onboardingSteps(true), ['welcome', 'language', 'region', 'currency', 'account']);
  assert.deepEqual(onboardingSteps(false), ['welcome', 'language', 'currency', 'account']);
  const steps = onboardingSteps(true);
  assert.equal(nextStep('welcome', steps), 'language');
  assert.equal(nextStep('account', steps), null);
  assert.equal(previousStep('welcome', steps), null);
  assert.equal(previousStep('currency', steps), 'region');
  assert.deepEqual(stepPosition('welcome', steps), null, 'the welcome is not a numbered step');
  assert.deepEqual(stepPosition('region', steps), { index: 2, count: 4 });
  assert.deepEqual(stepPosition('currency', onboardingSteps(false)), { index: 2, count: 3 });
  const rows = currencyStepOptions('USD', domain.LEDGER_CURRENCIES, 'es-AR', 'Sugerida por tu región');
  assert.deepEqual([rows.pinned.value, rows.pinned.title, rows.pinned.subtitle], ['USD', 'Dólares estadounidenses', 'Sugerida por tu región · USD · US$']);
  assert.equal(rows.options.length, domain.LEDGER_CURRENCIES.length - 1, 'every offered currency once; the suggestion is not repeated');
  assert.equal(rows.options.some(row => row.value === 'USD'), false);
  assert.ok(rows.options.every(row => row.searchText), 'searchable by code, name, symbol and country');
});

// ---- the route ---------------------------------------------------------------------------------------------

type Node = { type: any; props: Record<string, any> };
const HOME_GATE: ReleasedSets = { languages: ['es', 'en'], regions: ['AR', 'US'] };
function device(languageTag: string, regionCode: string | null = null): DeviceReading {
  return { source: 'native', locales: [{ languageTag, languageCode: languageTag.split('-')[0], regionCode }] };
}

function harness({ accounts = 0, reading = device('es-AR', 'AR'), released = HOME_GATE, gate = domain.LEDGER_CURRENCIES }: {
  accounts?: number; reading?: DeviceReading; released?: ReleasedSets; gate?: domain.CurrencyGate } = {}) {
  const prefs = memory();
  const localeStore = createLocaleStore({ devices: () => reading, store: prefs.store, released });
  const display: { currency: string | null; mode: string | null } = { currency: null, mode: null };
  const source = readFileSync(new URL('../app/onboarding.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const deps: unknown[][] = [];
  const routes: unknown[] = [];
  let cursor = 0, effectCursor = 0;
  let accountCount = accounts;
  const snapshot = () => ({ accounts: Array.from({ length: accountCount }, (_, index) => ({ id: 'a' + index, name: 'a', currency: 'ARS', openingMinor: 0, createdAt: '2026-09-26T12:00:00Z' })), entries: [] });
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }]; },
    useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => void | (() => void), next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => item !== previous[i])) { deps[index] = next ?? []; fn(); } } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Platform: { OS: 'ios' }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { replace: (to: unknown) => routes.push({ replace: to }), push: (to: unknown) => routes.push({ push: to }) } },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: snapshot(), gate }) },
    '../src/ui/components': { ActionButton: 'ActionButton', AppText: 'AppText', PressFeedback: 'PressFeedback' },
    '../src/ui/choice-screen': { ChoiceScreen: 'ChoiceScreen' },
    '../src/ui/locale-choosers': { LocaleChooser: 'LocaleChooser' },
    '../src/ui/locale-options': localeOptions,
    '../src/ui/display-currency-provider': { useDisplayCurrency: () => ({ currency: 'ARS', preferred: null, mode: 'consolidated',
      setCurrency: (currency: string) => { display.currency = currency; }, setMode: (mode: string) => { display.mode = mode; } }) },
    '../src/ui/motion': { ValueTransition: 'ValueTransition' },
    '../src/ui/onboarding-flow': onboardingFlow,
    '../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, usePalette: () => ({ background: '#fff', primary: '#2557D6', text: '#000', secondary: '#666' }) },
    '../src/i18n/preference': { defaultPreferenceStore: prefs.store },
    '../src/i18n/provider': { useI18n: () => bindLocale(localeStore.getState().locale), useLocalePreferences: () => ({ state: localeStore.getState(), setLanguage: localeStore.setLanguage, setRegion: localeStore.setRegion }) },
    '../src/i18n/format': i18nFormat,
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected onboarding dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; effectCursor = 0; return module.exports.default!(); }, routes, prefs, display, localeStore, addAccount: () => { accountCount++; } };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children)];
}
const buttons = (root: Node) => nodes(root).filter(n => n.type === 'ActionButton');
const button = (root: Node, label: string) => { const node = buttons(root).find(n => n.props.label === label); assert.ok(node, 'Missing button ' + label); return node; };
const texts = (root: Node) => nodes(root).filter(n => n.type === 'AppText').map(n => Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children));

test('a new installation walks welcome → language → region → currency → account; each step keeps its own choice and the end marks the setup done', () => {
  const view = harness({ reading: device('en-US', 'US') });
  let root = view.render();
  assert.ok(texts(root).includes('Your spending, clear.'), 'the welcome, in the device\'s language');
  assert.equal(nodes(root).find(n => n.type === 'Stack.Screen')!.props.options.headerShown, false);
  button(root, 'Get started').props.onPress();
  root = view.render();
  assert.equal(find(root, 'LocaleChooser').props.kind, 'language', 'the same chooser as Más');
  assert.ok(texts(root).includes('Step 1 of 4'));
  // Choosing Spanish here re-titles the flow in place, like Más does.
  view.localeStore.setLanguage('es');
  root = view.render();
  assert.ok(texts(root).includes('Paso 1 de 4'));
  button(root, 'Continuar').props.onPress();
  root = view.render();
  assert.equal(find(root, 'LocaleChooser').props.kind, 'region');
  button(root, 'Continuar').props.onPress();
  root = view.render();
  const chooser = find(root, 'ChoiceScreen');
  assert.deepEqual([chooser.props.pinned.value, chooser.props.selected], ['USD', 'USD'], 'the United States suggests dollars, checked');
  assert.match(chooser.props.pinned.subtitle, /^Sugerida por tu región · USD/);
  assert.equal(view.display.currency, null, 'nothing written before Continuar');
  chooser.props.onChoose('EUR');
  root = view.render();
  assert.equal(find(root, 'ChoiceScreen').props.selected, 'EUR');
  button(root, 'Continuar').props.onPress();
  assert.deepEqual(view.display, { currency: 'EUR', mode: 'consolidated' }, 'the display currency, consolidated, is a choice once continued');
  root = view.render();
  assert.ok(texts(root).includes('Tu primera cuenta'));
  button(root, 'Crear una cuenta').props.onPress();
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ push: { pathname: '/new-account', params: { currency: 'EUR' } } }), 'the form, with the chosen currency preselected');
  assert.equal(view.prefs.rows.get(ONBOARDING_KEY), undefined, 'not done yet');
  view.addAccount();
  view.render();
  assert.equal(view.prefs.rows.get(ONBOARDING_KEY), 'done', 'an account created ends the setup');
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ replace: '/' }));
  assert.equal(view.prefs.rows.get(LANGUAGE_PREFERENCE_KEY), 'es', 'the language chosen stays');
  assert.equal(view.prefs.rows.has(REGION_PREFERENCE_KEY), false, 'the region was not touched: it still follows the device');
});

test('Omitir at any step ends the setup writing no preference; "Ahora no" on the account step does the same; a single-region build skips the region step', () => {
  const view = harness();
  let root = view.render();
  nodes(root).find(n => n.type === 'PressFeedback' && n.props.accessibilityLabel === 'Omitir la configuración inicial')!.props.onPress();
  assert.deepEqual([...view.prefs.rows.entries()], [[ONBOARDING_KEY, 'done']]);
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ replace: '/' }));
  assert.deepEqual(view.display, { currency: null, mode: null });
  const single = harness({ released: { languages: ['es'], regions: ['AR'] } });
  root = single.render();
  button(root, 'Empezar').props.onPress();
  root = single.render();
  assert.ok(texts(root).includes('Paso 1 de 3'), 'no region step when the build offers one region');
  button(root, 'Continuar').props.onPress();
  root = single.render();
  assert.equal(find(root, 'ChoiceScreen').props.pinned.value, 'ARS', 'Argentina suggests pesos');
  button(root, 'Continuar').props.onPress();
  root = single.render();
  button(root, 'Ahora no').props.onPress();
  assert.deepEqual(single.display, { currency: 'ARS', mode: 'consolidated' });
  assert.equal(single.prefs.rows.get(ONBOARDING_KEY), 'done');
});

function find(root: Node, type: string) {
  const node = nodes(root).find(item => item.type === type);
  assert.ok(node, 'Missing ' + type);
  return node;
}

test('the root layout sends a new installation to the setup before the splash lifts and marks an existing person done; the route has no header and no back swipe', () => {
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /onboardingDecision\(defaultPreferenceStore, snapshot\.accounts\.length > 0\)/);
  assert.match(layout, /if \(decision === 'existing'\) markOnboardingDone\(defaultPreferenceStore\)/);
  assert.match(layout, /if \(onboarding === 'new'\) router\.replace\('\/onboarding'\)/);
  assert.match(layout, /fontsLoaded && snapshot && onboarding !== null\)\) void SplashScreen\.hideAsync/, 'the splash waits for the decision');
  assert.match(layout, /<Stack\.Screen name="onboarding" options=\{\{ headerShown: false, gestureEnabled: false, animation: 'fade' \}\} \/>/);
});
