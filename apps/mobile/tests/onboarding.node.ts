import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as i18nFormat from '../src/i18n/format.ts';
import * as localeOptions from '../src/ui/locale-options.ts';
import * as onboardingFlow from '../src/ui/onboarding-flow.ts';
import { DEFAULT_LOOK } from '../src/ui/appearance.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { DISPLAY_CURRENCY_KEY } from '../src/ui/display-currency.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, type PreferenceStore } from '../src/i18n/preference.ts';
import { createLocaleStore, type DeviceReading } from '../src/i18n/store.ts';
import { RELEASED, type ReleasedSets } from '../src/i18n/locale.ts';

// Producto 25B: the first opening. The pure rules (when it is shown, what it suggests, the two stages) are tested
// directly; the route runs in the harness with its hosts replaced by names. Not a rendered iPhone screen.
const { ONBOARDING_KEY, markOnboardingDone, nextStep, onboardingDecision, previousStep, suggestedCurrency } = onboardingFlow;

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

test('a new installation is shown the first opening; anyone with accounts or a saved preference is an existing person, marked done silently and untouched', () => {
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

test('the region suggests the first account\'s currency when the build offers it; Spain → EUR, the United States → USD; unknown or held falls back to the default', () => {
  assert.equal(suggestedCurrency('ES'), 'EUR');
  assert.equal(suggestedCurrency('US'), 'USD');
  assert.equal(suggestedCurrency('AR'), 'ARS');
  assert.equal(suggestedCurrency('JP'), 'JPY');
  assert.equal(suggestedCurrency('KW'), 'ARS', 'KWD is held (three decimals): nothing the build offers');
  assert.equal(suggestedCurrency('KW', ['ARS', 'USD', 'KWD']), 'KWD', 'a preview gate that offers it');
  assert.equal(suggestedCurrency(null), 'ARS');
  assert.equal(suggestedCurrency('US', ['ARS']), 'ARS', 'a gate without the tender');
  assert.deepEqual([nextStep('welcome'), nextStep('account'), previousStep('account'), previousStep('welcome')], ['account', null, 'welcome', null]);
});

// ---- the route ---------------------------------------------------------------------------------------------

type Node = { type: any; props: Record<string, any> };
const HOME_GATE: ReleasedSets = { languages: ['es', 'en'], regions: ['AR', 'US'] };
function device(languageTag: string, regionCode: string | null = null): DeviceReading {
  return { source: 'native', locales: [{ languageTag, languageCode: languageTag.split('-')[0], regionCode }] };
}
const createdAt = '2026-09-26T12:00:00Z';

/** The route with its hosts replaced by names. `prefs` is the key-value store (shared with the locale store, like the
 * device's); `accounts` the ledger's accounts; `addAccount` the real path into the ledger mock, so a saved account shows
 * up in the snapshot on the next render. Pass the same `prefs` again to stand for a cold reopen. */
function harness({ accounts = [] as domain.Account[], reading = device('es-AR', 'AR'), released = HOME_GATE, gate = domain.LEDGER_CURRENCIES, prefs = memory(), failSave = false } = {}) {
  const localeStore = createLocaleStore({ devices: () => reading, store: prefs.store, released });
  const display: { currency: string | null; mode: string | null } = { currency: null, mode: null };
  const source = readFileSync(new URL('../app/onboarding.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const state: unknown[] = [];
  const refs: unknown[] = [];
  const deps: unknown[][] = [];
  const routes: unknown[] = [];
  const saved: domain.Account[] = [];
  let cursor = 0, refCursor = 0, effectCursor = 0;
  const ledger = { accounts: [...accounts] };
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      return [state[index], (value: unknown) => { state[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(state[index]) : value; }]; },
    useRef: (initial: unknown) => { const index = refCursor++; return (refs[index] ??= { current: initial }); },
    useEffect: (fn: () => void | (() => void), next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => item !== previous[i])) { deps[index] = next ?? []; fn(); } } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', ScrollView: 'ScrollView', Platform: { OS: 'ios' }, Keyboard: { dismiss() {} }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { replace: (to: unknown) => routes.push({ replace: to }), push: (to: unknown) => routes.push({ push: to }) } },
    'expo-crypto': { randomUUID: () => 'first-account' },
    'expo-haptics': { NotificationFeedbackType: { Success: 'Success' }, notificationAsync: async () => {} },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: { accounts: ledger.accounts, entries: [] }, gate,
      addAccount: async (account: domain.Account) => { if (failSave) throw new Error('disk full'); saved.push(account); ledger.accounts = [...ledger.accounts, account]; } }) },
    '../src/ui/appearance': { DEFAULT_LOOK },
    '../src/ui/components': Object.fromEntries(['ActionButton', 'AmountField', 'AppText', 'ErrorMessage', 'Field', 'FieldNote', 'NavigationRow', 'PressFeedback', 'Surface'].map(name => [name, name])),
    '../src/ui/form-controls': { CurrencyField: 'CurrencyField' },
    '../src/ui/locale-options': localeOptions,
    '../src/ui/display-currency-provider': { useDisplayCurrency: () => ({ currency: 'ARS', preferred: null, mode: 'consolidated',
      setCurrency: (currency: string) => { display.currency = currency; prefs.rows.set(DISPLAY_CURRENCY_KEY, currency); }, setMode: (mode: string) => { display.mode = mode; } }) },
    '../src/ui/motion': { ValueTransition: 'ValueTransition' },
    '../src/ui/onboarding-flow': onboardingFlow,
    '../src/ui/theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, usePalette: () => ({ background: '#fff', primary: '#2557D6', text: '#000', secondary: '#666' }) },
    '../src/i18n/preference': { defaultPreferenceStore: prefs.store },
    '../src/i18n/provider': { useI18n: () => bindLocale(localeStore.getState().locale), useLocalePreferences: () => ({ state: localeStore.getState(), setLanguage: localeStore.setLanguage, setRegion: localeStore.setRegion }) },
    '../src/i18n/format': i18nFormat,
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(code, { module, exports: module.exports, Date, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected onboarding dependency: ' + name);
    return modules[name];
  } });
  return { render: () => { cursor = 0; refCursor = 0; effectCursor = 0; return module.exports.default!(); }, routes, prefs, display, localeStore, saved, ledger };
}
function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children)];
}
const find = (root: Node, type: string, label?: string) => { const node = nodes(root).find(n => n.type === type && (!label || n.props.label === label || n.props.title === label)); assert.ok(node, 'Missing ' + type + ' ' + (label ?? '')); return node; };
const texts = (root: Node) => nodes(root).filter(n => n.type === 'AppText' || n.type === 'FieldNote').map(n => Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('new installation: welcome with the device\'s language and region as quiet rows, then the first account with the region\'s currency; the account seeds the totals\' currency and ends the setup', async () => {
  const view = harness({ reading: device('en-US', 'US') });
  let root = view.render();
  assert.equal(view.routes.length, 0, 'eligible: no redirect');
  assert.ok(texts(root).includes('Your spending, clear.'), 'the welcome, in the device\'s language');
  assert.equal(JSON.stringify(nodes(root).find(n => n.type === 'Stack.Screen')!.props.options), JSON.stringify({ headerShown: false, gestureEnabled: false }));
  assert.equal(nodes(root).filter(n => n.type === 'ScrollView').length, 1, 'the stage scrolls (the largest text sizes)');
  assert.match(find(root, 'NavigationRow', 'Language').props.subtitle, /English/);
  assert.match(find(root, 'NavigationRow', 'Region').props.subtitle, /United States/);
  find(root, 'NavigationRow', 'Language').props.onPress();
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ push: '/language' }), 'the secondary option is the Más chooser, pushed over the setup');
  find(root, 'ActionButton', 'Continue').props.onPress();
  root = view.render();
  assert.ok(texts(root).includes('Your first account'));
  assert.equal(find(root, 'CurrencyField').props.value, 'USD', 'the United States suggests dollars');
  assert.equal(find(root, 'CurrencyField').props.currencies, domain.LEDGER_CURRENCIES, 'any of the 146 can be chosen');
  assert.ok(texts(root).some(text => text === 'Suggested by your region: US dollars. Each account keeps its own currency.'));
  assert.equal(find(root, 'ActionButton', 'Create account').props.disabled, true, 'a name is needed');
  find(root, 'Field').props.onChangeText('Checking');
  root = view.render();
  find(root, 'AmountField').props.onChangeText('1.000,50');
  root = view.render();
  assert.equal(find(root, 'ActionButton', 'Create account').props.disabled, false);
  find(root, 'ActionButton', 'Create account').props.onPress();
  await settle();
  assert.equal(view.saved.length, 1);
  assert.deepEqual([view.saved[0].name, view.saved[0].currency, view.saved[0].openingMinor, view.saved[0].id], ['Checking', 'USD', 100050, 'first-account']);
  assert.deepEqual(view.display, { currency: 'USD', mode: 'consolidated' }, 'the first account\'s currency is the first suggestion for the totals');
  assert.equal(view.prefs.rows.get(ONBOARDING_KEY), 'done');
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ replace: '/' }));
  assert.equal(view.prefs.rows.has(LANGUAGE_PREFERENCE_KEY), false, 'language and region were never written: they still follow the device');
  assert.equal(view.prefs.rows.has(REGION_PREFERENCE_KEY), false);
});

test('Spain suggests EUR for the first account; the person may pick another currency, which is then the account\'s and the totals\'', async () => {
  const spain = harness({ reading: device('es-ES', 'ES'), released: RELEASED });
  let root = spain.render();
  find(root, 'ActionButton', 'Continuar').props.onPress();
  root = spain.render();
  assert.equal(find(root, 'CurrencyField').props.value, 'EUR');
  assert.ok(texts(root).some(text => text.startsWith('Sugerida por tu región: Euros.')));
  // A different currency than the region's: the account is in it, nothing coerces it back.
  find(root, 'CurrencyField').props.onChange('USD');
  root = spain.render();
  assert.equal(find(root, 'CurrencyField').props.value, 'USD');
  assert.ok(texts(root).includes('Cada cuenta conserva su moneda.'), 'the note no longer claims the suggestion');
  find(root, 'Field').props.onChangeText('Viajes');
  root = spain.render();
  find(root, 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  assert.deepEqual([spain.saved[0].currency, spain.saved[0].openingMinor], ['USD', 0]);
  assert.deepEqual(spain.display, { currency: 'USD', mode: 'consolidated' });
  const usa = harness({ reading: device('en-US', 'US'), released: RELEASED });
  root = usa.render();
  find(root, 'ActionButton', 'Continue').props.onPress();
  assert.equal(find(usa.render(), 'CurrencyField').props.value, 'USD');
});

test('Omitir skips the rest of the setup and keeps what was already saved: a language chosen in the pushed chooser survives the skip and a cold reopen; nothing else is written', () => {
  const view = harness({ reading: device('en-US', 'US') });
  let root = view.render();
  // The Más chooser, opened from the welcome row, saved Spanish (as Más does); back on the welcome the copy is Spanish.
  assert.equal(view.localeStore.setLanguage('es'), true);
  root = view.render();
  assert.ok(texts(root).includes('Tus gastos, claros.'));
  assert.equal(view.prefs.rows.get(LANGUAGE_PREFERENCE_KEY), 'es');
  find(root, 'ActionButton', 'Continuar').props.onPress();
  root = view.render();
  const skip = nodes(root).find(n => n.type === 'PressFeedback' && n.props.accessibilityLabel === 'Omitir el resto de la configuración')!;
  assert.equal(skip.props.accessibilityHint, 'Conserva lo que ya elegiste y abre la app');
  skip.props.onPress();
  assert.deepEqual([...view.prefs.rows.entries()].sort(), [[LANGUAGE_PREFERENCE_KEY, 'es'], [ONBOARDING_KEY, 'done']].sort(), 'the language stays; nothing else was written');
  assert.deepEqual(view.display, { currency: null, mode: null });
  assert.equal(view.saved.length, 0);
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ replace: '/' }));
  // A cold reopen with the same store: the layout would not send anyone here (decision "done") and the route itself refuses.
  assert.equal(onboardingDecision(view.prefs.store, false), 'done');
  const reopened = harness({ reading: device('en-US', 'US'), prefs: view.prefs });
  assert.equal(reopened.render(), null, 'nothing drawn');
  assert.equal(JSON.stringify(reopened.routes), JSON.stringify([{ replace: '/' }]));
  assert.equal(bindLocale(reopened.localeStore.getState().locale).t('onboarding.skip'), 'Omitir', 'Spanish still applies after the reopen');
});

test('"Ahora no" on the account stage ends the setup with empty data; a failed save keeps the draft and its operation id for one retry', async () => {
  const view = harness({ failSave: true });
  let root = view.render();
  find(root, 'ActionButton', 'Continuar').props.onPress();
  root = view.render();
  find(root, 'Field').props.onChangeText('Efectivo');
  root = view.render();
  find(root, 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'disk full');
  assert.equal(find(root, 'ActionButton', 'Reintentar guardado').props.label, 'Reintentar guardado');
  assert.equal(find(root, 'Field').props.editable, false, 'the draft is locked to the pending submission');
  assert.equal(view.prefs.rows.has(ONBOARDING_KEY), false, 'not done: nothing was saved');
  find(root, 'ActionButton', 'Ahora no').props.onPress();
  assert.equal(view.prefs.rows.get(ONBOARDING_KEY), 'done');
  assert.deepEqual(view.display, { currency: null, mode: null });
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ replace: '/' }));
});

test('an existing installation reached through a link or a restored navigation is sent straight to the app: nothing drawn, nothing written', () => {
  const account: domain.Account = { id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 0, createdAt };
  const withData = harness({ accounts: [account] });
  assert.equal(withData.render(), null);
  assert.equal(JSON.stringify(withData.routes), JSON.stringify([{ replace: '/' }]));
  assert.equal(withData.prefs.rows.size, 0, 'the route never marks or writes anything; the layout does the silent mark');
  const withPreference = harness({ prefs: memory({ [REGION_PREFERENCE_KEY]: 'US' }) });
  assert.equal(withPreference.render(), null);
  assert.equal(JSON.stringify(withPreference.routes), JSON.stringify([{ replace: '/' }]));
  assert.equal(withPreference.prefs.rows.get(REGION_PREFERENCE_KEY), 'US', 'untouched');
  const done = harness({ prefs: memory({ [ONBOARDING_KEY]: 'done' }) });
  assert.equal(done.render(), null);
  assert.equal(JSON.stringify(done.routes), JSON.stringify([{ replace: '/' }]));
});

test('the root layout sends a new installation to the setup before the splash lifts and marks an existing person done; the route has no header and no back swipe', () => {
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /onboardingDecision\(defaultPreferenceStore, snapshot\.accounts\.length > 0\)/);
  assert.match(layout, /if \(decision === 'existing'\) markOnboardingDone\(defaultPreferenceStore\)/);
  assert.match(layout, /if \(onboarding === 'new'\) router\.replace\('\/onboarding'\)/);
  assert.match(layout, /fontsLoaded && snapshot && onboarding !== null\)\) void SplashScreen\.hideAsync/, 'the splash waits for the decision');
  assert.match(layout, /<Stack\.Screen name="onboarding" options=\{\{ headerShown: false, gestureEnabled: false, animation: 'fade' \}\} \/>/);
});
