import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as bind from '../src/i18n/bind.ts';
import * as locale from '../src/i18n/locale.ts';
import * as preference from '../src/i18n/preference.ts';
import * as storeModule from '../src/i18n/store.ts';
import * as localeOptions from '../src/ui/locale-options.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, type PreferenceStore } from '../src/i18n/preference.ts';
import { activeLanguageChoice, createLocaleStore, type DeviceReading, type LocaleStore } from '../src/i18n/store.ts';
import type { ReleasedSets } from '../src/i18n/locale.ts';

// Producto 23.1A: language and region are two live preferences. A change made
// in Más re-renders the app in place: the navigation, the current screen, a
// half-typed draft and the Assistant conversation survive; the ledger
// provider is neither re-rendered nor remounted. These tests drive the real
// provider on a real React reconciler (react-test-renderer), not a snapshot.
const require = createRequire(import.meta.url);
const React = require('react') as typeof import('react');
const renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { act } = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// react-test-renderer announces its deprecation on every create; that notice is not a test failure. Everything else still prints.
const consoleError = console.error;
console.error = (...args: unknown[]) => { if (!String(args[0]).startsWith('react-test-renderer is deprecated')) consoleError(...args); };
const h = React.createElement;

const ALL: ReleasedSets = { languages: ['es', 'en'], regions: ['AR', 'US'] };

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
function device(languageTag: string, regionCode: string | null = null): DeviceReading {
  return { source: 'native', locales: [{ languageTag, languageCode: languageTag.split('-')[0], regionCode }] };
}

test('the store resolves at creation from the saved preferences and the device, and only notifies on a visible change', () => {
  const saved = memory({ [LANGUAGE_PREFERENCE_KEY]: 'en', [REGION_PREFERENCE_KEY]: 'AR' });
  const store = createLocaleStore({ devices: () => device('es-US', 'US'), store: saved.store, released: ALL });
  assert.equal(store.getState().locale, 'en-AR', 'both saved choices beat the device');
  assert.equal(store.getState().device.locale, 'es-US', '"follow the device" would give Spanish, United States');
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);
  const before = store.getState();
  assert.equal(store.setLanguage('en'), true, 'saving the same choice again succeeds');
  assert.equal(store.getState(), before, 'and changes nothing: same object, no re-render');
  assert.equal(notified, 0);
  assert.equal(store.setRegion('system'), true);
  assert.equal(store.getState().locale, 'en-US', 'region now follows the device (US) while the language stays English');
  assert.equal(saved.rows.has(REGION_PREFERENCE_KEY), false, '"follow the device" is the absence of the key');
  assert.equal(notified, 1);
  unsubscribe();
  store.setLanguage('es');
  assert.equal(notified, 1, 'an unsubscribed listener hears nothing');
  assert.equal(saved.rows.get(LANGUAGE_PREFERENCE_KEY), 'es');
});

test('a choice is saved before it is applied: a failed write changes nothing and says so', () => {
  const saved = memory();
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store, released: ALL });
  let notified = 0;
  store.subscribe(() => notified++);
  const before = store.getState();
  saved.faults.set = true;
  assert.equal(store.setLanguage('en'), false);
  assert.equal(store.setRegion('US'), false);
  assert.equal(store.getState(), before, 'nothing applied without a saved choice');
  assert.equal(notified, 0);
  assert.equal(saved.rows.size, 0, 'no partial write, nothing reset');
  saved.faults.set = false;
  assert.equal(store.setRegion('US'), true, 'the next attempt works once the store does');
  assert.equal(store.getState().locale, 'es-US');
});

test('an unreadable store at launch follows the device and never throws', () => {
  const saved = memory({ [LANGUAGE_PREFERENCE_KEY]: 'en' });
  saved.faults.get = true;
  const store = createLocaleStore({ devices: () => device('es-AR', 'US'), store: saved.store, released: ALL });
  assert.deepEqual(store.getState().preferences, { language: 'system', region: 'system' });
  assert.equal(store.getState().locale, 'es-US');
  assert.equal(saved.rows.get(LANGUAGE_PREFERENCE_KEY), 'en', 'a failed read never deletes what is stored');
});

test('the release gate holds in the store: unreleased values are refused, and a stored one is not applied or marked', () => {
  const saved = memory({ [LANGUAGE_PREFERENCE_KEY]: 'en', [REGION_PREFERENCE_KEY]: 'US' });
  const store = createLocaleStore({ devices: () => device('en-US', 'US'), store: saved.store });
  assert.equal(store.getState().locale, 'es-AR', 'English iPhone, US region, English and US saved: still Spanish, Argentina today');
  assert.equal(activeLanguageChoice(store.getState()), 'system', 'the chooser marks "follow the device", not an option it does not list');
  assert.equal(store.setLanguage('en'), false);
  assert.equal(store.setRegion('US'), false);
  assert.equal(saved.rows.get(LANGUAGE_PREFERENCE_KEY), 'en', 'refusing does not erase a later build\'s value either');
  assert.equal(store.setLanguage('es'), true);
  assert.equal(store.setRegion('AR'), true);
  assert.equal(store.setLanguage('system'), true);
});

test('a device the app does not support: Portuguese in Brazil reads Spanish with Argentine conventions, and says so beside "follow the device"', () => {
  const store = createLocaleStore({ devices: () => device('pt-BR', 'BR'), store: memory().store, released: ALL });
  const state = store.getState();
  assert.equal(state.locale, 'es-AR');
  assert.equal(state.device.locale, 'es-AR');
  const t = bind.bindLocale(state.locale).t;
  assert.deepEqual(localeOptions.languageOptions(state, t).map(option => [option.value, option.title, option.subtitle ?? '']),
    [['system', 'Según el dispositivo', 'Ahora: Español'], ['es', 'Español', ''], ['en', 'English', '']]);
});

test('"follow the device" follows it live: a changed device reading re-resolves only the halves that follow it', () => {
  let reading = device('es-AR', 'AR');
  const saved = memory({ [LANGUAGE_PREFERENCE_KEY]: 'es' });
  const store = createLocaleStore({ devices: () => reading, store: saved.store, released: ALL });
  let notified = 0;
  store.subscribe(() => notified++);
  store.refreshDevice();
  assert.equal(notified, 0, 'an unchanged device changes nothing');
  reading = device('en-US', 'US');
  store.refreshDevice();
  assert.equal(store.getState().locale, 'es-US', 'the explicit Spanish stays; the region followed the device to the US');
  assert.equal(store.getState().device.locale, 'en-US');
  assert.equal(notified, 1);
});

test('the chooser lists only released values; with the gate closed Idioma offers the device default and Español, and Región is not shown', () => {
  const state = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store }).getState();
  const t = bind.bindLocale(state.locale).t;
  const languages = localeOptions.preferenceChoices('language', state, t);
  assert.deepEqual(languages.options.map(option => option.value), ['system', 'es'], 'English is not offered, not even greyed out');
  assert.equal(languages.options[0].subtitle, 'Ahora: Español', 'honest: the English iPhone gets Spanish today');
  assert.equal(languages.selected, 'system');
  assert.equal(localeOptions.showsPreference('language', state), true);
  assert.equal(localeOptions.showsPreference('region', state), false, 'Región waits for 23.1C');
  assert.deepEqual(localeOptions.preferenceChoices('region', state, t).options.map(option => option.value), ['system', 'AR']);
  assert.equal(localeOptions.preferenceSummary('language', state, t), 'Español · según el dispositivo');
  // With both released (the 23.1C state), each region shows its conventions in the current language.
  const open = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store, released: ALL }).getState();
  const tEn = bind.bindLocale(open.locale).t;
  assert.deepEqual(localeOptions.regionOptions(open, tEn).map(option => [option.title, option.subtitle]),
    [['Same as device', 'Now: United States'], ['Argentina', '22/9/2026 · 1.234,56'], ['United States', '9/22/2026 · 1,234.56']]);
  assert.equal(localeOptions.preferenceSummary('region', open, tEn), 'United States · same as device');
});

// ---- The real provider on a real reconciler ---------------------------------

function loadModule(path: string, modules: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected dependency of ' + path + ': ' + name);
    return modules[name];
  } });
  return module.exports;
}

function appState() {
  const listeners = new Set<(status: string) => void>();
  return { listeners, AppState: { addEventListener: (_: string, listener: (status: string) => void) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } },
    emit: (status: string) => { for (const listener of listeners) listener(status); } };
}

function loadProvider(runtimeStore?: () => LocaleStore) {
  const native = appState();
  const provider = loadModule('../src/i18n/provider.tsx', {
    react: React, 'react-native': { AppState: native.AppState },
    './bind.ts': bind, './locale.ts': locale, './preference.ts': preference, './store.ts': storeModule,
    './device-runtime': { readRuntimeDeviceLocales: () => { if (!runtimeStore) throw new Error('the runtime device reader must not run when a store is given'); return runtimeStore().getState().device; } },
  });
  return { provider, native };
}

/** A stand-in for the app: a ledger provider that must never re-render or
 * remount, a navigation stack holding a form with a half-typed draft and the
 * Assistant with a conversation, all under the real I18nProvider. */
function mountApp(store: LocaleStore) {
  const { provider, native } = loadProvider();
  const counts = { ledgerRenders: 0, ledgerMounts: 0, navigationMounts: 0, formMounts: 0, formRenders: 0, assistantMounts: 0, unmounts: 0 };
  const handles: { setDraft?: (value: string) => void; addMessage?: (value: string) => void; choose?: ReturnType<typeof provider.useLocalePreferences> } = {};
  const lifecycle = (key: keyof typeof counts) => React.useEffect(() => { counts[key]++; return () => { counts.unmounts++; }; }, []);
  function Ledger({ children }: { children: React.ReactNode }) { counts.ledgerRenders++; lifecycle('ledgerMounts'); return children; }
  function Navigation({ children }: { children: React.ReactNode }) { lifecycle('navigationMounts'); return h('stack', null, children); }
  function EntryForm() {
    counts.formRenders++;
    lifecycle('formMounts');
    const i18n = provider.useI18n();
    const [draft, setDraft] = React.useState('');
    handles.setDraft = setDraft;
    return h('form', { title: i18n.t('amount.label'), draft, total: i18n.moneyText(123456, 'ARS'), date: i18n.formatDate('2026-09-22', 'dayYear'), accessibilityLabel: i18n.spokenMoney(123456, 'ARS') });
  }
  function Assistant() {
    lifecycle('assistantMounts');
    const { t } = provider.useI18n();
    const [messages, setMessages] = React.useState<string[]>([]);
    handles.addMessage = message => setMessages(list => [...list, message]);
    return h('assistant', { messages, cancel: t('common.cancel') });
  }
  function Chooser() { handles.choose = provider.useLocalePreferences(); return null; }
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(Ledger, null, h(Navigation, null, h(EntryForm), h(Assistant), h(Chooser))))); });
  const form = () => root.root.findByType('form' as never).props;
  const assistant = () => root.root.findByType('assistant' as never).props;
  return { root, counts, handles, form, assistant, native };
}

test('switching the language with a form and a conversation mounted: labels change in place, nothing remounts, the draft and the messages survive', () => {
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: memory().store, released: ALL });
  const app = mountApp(store);
  assert.deepEqual([app.form().title, app.form().total, app.form().date, app.assistant().cancel], ['Monto', '$ 1.234,56', '22 sep 2026', 'Cancelar']);
  act(() => { app.handles.setDraft!('1.234,5'); app.handles.addMessage!('¿Cuánto gasté en comida?'); });
  act(() => { assert.equal(app.handles.choose!.setLanguage('en'), true); });
  assert.deepEqual([app.form().title, app.form().date, app.assistant().cancel], ['Amount', 'Sep 22, 2026', 'Cancel'], 'the words follow the new language at once');
  assert.equal(app.form().total, '$ 1.234,56', 'English with Argentine conventions: the amount is written exactly as before');
  assert.equal(app.form().accessibilityLabel, '1.234,56 pesos', 'VoiceOver strings re-render too');
  assert.equal(app.form().draft, '1.234,5', 'the half-typed amount survives');
  assert.deepEqual(app.assistant().messages, ['¿Cuánto gasté en comida?'], 'the conversation survives');
  assert.deepEqual([app.counts.ledgerMounts, app.counts.navigationMounts, app.counts.formMounts, app.counts.assistantMounts, app.counts.unmounts], [1, 1, 1, 1, 0], 'nothing remounted');
  assert.equal(app.counts.ledgerRenders, 1, 'the ledger provider (SQLite) is not even re-rendered');
  act(() => { app.handles.choose!.setRegion('US'); });
  assert.equal(app.form().total, 'AR$ 1,234.56', 'the region changes the separators and what "$" means, independently of the language');
  assert.equal(app.form().title, 'Amount');
  assert.equal(app.form().draft, '1.234,5');
  act(() => { app.handles.choose!.setLanguage('es'); });
  assert.deepEqual([app.form().title, app.form().total], ['Monto', 'AR$ 1,234.56'], 'Spanish with US conventions');
  assert.deepEqual([app.counts.ledgerRenders, app.counts.formMounts, app.counts.unmounts], [1, 1, 0]);
  act(() => app.root.unmount());
});

test('saving a choice that resolves to the same locale re-renders no screen; a failed save re-renders nothing and keeps the choice', () => {
  const saved = memory();
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store, released: ALL });
  const app = mountApp(store);
  const renders = app.counts.formRenders;
  act(() => { app.handles.choose!.setLanguage('es'); });
  assert.equal(app.counts.formRenders, renders, 'system → Español on a Spanish iPhone: same locale, the form does not re-render');
  assert.equal(app.handles.choose!.state.preferences.language, 'es', 'the chooser itself sees the new choice');
  saved.faults.set = true;
  let result = true;
  act(() => { result = app.handles.choose!.setLanguage('en'); });
  assert.equal(result, false);
  assert.equal(app.form().title, 'Monto', 'a failed write leaves the interface as it was');
  assert.equal(app.counts.formRenders, renders);
  assert.equal(app.handles.choose!.state.preferences.language, 'es');
  act(() => app.root.unmount());
});

test('returning to the foreground re-reads the device: "follow the device" updates in place; the listener is removed on unmount', () => {
  let reading = device('es-AR', 'AR');
  const store = createLocaleStore({ devices: () => reading, store: memory().store, released: ALL });
  const app = mountApp(store);
  act(() => app.handles.setDraft!('50'));
  reading = device('en-US', 'US');
  act(() => app.native.emit('background'));
  assert.equal(app.form().title, 'Monto', 'nothing is re-read while in the background');
  act(() => app.native.emit('active'));
  assert.deepEqual([app.form().title, app.form().total, app.form().draft], ['Amount', 'AR$ 1,234.56', '50']);
  assert.equal(app.counts.formMounts, 1);
  assert.equal(app.native.listeners.size, 1);
  act(() => app.root.unmount());
  assert.equal(app.native.listeners.size, 0, 'no listener left behind');
});

test('with the release gate closed, the provider keeps the whole app in Spanish with Argentine conventions whatever the device says', () => {
  const store = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory({ [LANGUAGE_PREFERENCE_KEY]: 'en', [REGION_PREFERENCE_KEY]: 'US' }).store });
  const app = mountApp(store);
  assert.deepEqual([app.form().title, app.form().total, app.form().date], ['Monto', '$ 1.234,56', '22 sep 2026']);
  act(() => { assert.equal(app.handles.choose!.setLanguage('en'), false); });
  assert.equal(app.form().title, 'Monto');
  act(() => app.root.unmount());
});

test('without a store prop the provider builds the runtime store once; a provider without children changes is never recreated', () => {
  const source = readFileSync(new URL('../src/i18n/provider.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState\(\(\) => store \?\? createRuntimeLocaleStore\(\)\)/, 'one store per provider, created lazily once');
  assert.match(source, /useSyncExternalStore\(localeStore\.subscribe, localeStore\.getState/);
  assert.equal(/\bkey[:=]/.test(source.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'the provider never keys its children');
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<I18nProvider><LedgerProvider>/, 'the ledger provider sits inside the locale provider as a stable child');
  assert.equal(/<I18nProvider[^>]*key=|<LedgerProvider[^>]*key=|<Navigation[^>]*key=/.test(layout), false, 'nothing above the navigation is keyed on the locale');
});

// ---- The Idioma screen, rendered with the real provider --------------------

function loadPreferenceScreen(provider: Record<string, any>) {
  const host = (name: string) => name;
  let haptics = 0;
  const screen = loadModule('../src/ui/locale-preference.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': { View: host('View') },
    'expo-router': { Stack: { Screen: host('Stack.Screen') } },
    '../i18n/provider': provider,
    './components': { AppText: host('AppText'), CheckRow: host('CheckRow'), ErrorMessage: host('ErrorMessage'), Screen: host('Screen'), Surface: host('Surface') },
    './locale-options': localeOptions,
    './motion': { selectionHaptic: () => { haptics++; } },
  });
  return { screen, haptics: () => haptics };
}

test('Idioma: a tap saves and applies in place, the checkmark moves, the screen title follows the language, and a failed save keeps the old checkmark', () => {
  const saved = memory();
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store, released: ALL });
  const { provider } = loadProvider();
  const { screen, haptics } = loadPreferenceScreen(provider);
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(screen.LocalePreferenceScreen, { kind: 'language' }))); });
  const rows = () => root.root.findAllByType('CheckRow' as never).map(row => row.props);
  const title = () => root.root.findByType('Stack.Screen' as never).props.options.title;
  assert.equal(title(), 'Idioma');
  assert.deepEqual(rows().map(row => [row.title, row.subtitle ?? '', row.selected]), [['Según el dispositivo', 'Ahora: Español', true], ['Español', '', false], ['English', '', false]]);
  act(() => rows()[2].onPress());
  assert.equal(saved.rows.get(LANGUAGE_PREFERENCE_KEY), 'en', 'saved first');
  assert.equal(title(), 'Language', 'the header title re-renders in the new language without leaving the screen');
  assert.deepEqual(rows().map(row => [row.title, row.selected]), [['Same as device', false], ['Español', false], ['English', true]]);
  assert.equal(haptics(), 1);
  act(() => rows()[2].onPress());
  assert.equal(haptics(), 1, 'choosing the current option again does nothing');
  saved.faults.set = true;
  act(() => rows()[0].onPress());
  assert.equal(root.root.findByType('ErrorMessage' as never).props.message, 'The preference could not be saved. Your previous choice is still active; please try again.');
  assert.equal(rows()[2].selected, true, 'the checkmark stays on the saved choice');
  assert.equal(saved.rows.get(LANGUAGE_PREFERENCE_KEY), 'en');
  saved.faults.set = false;
  act(() => rows()[0].onPress());
  assert.equal(root.root.findByType('ErrorMessage' as never).props.message, null, 'the error clears on the next successful save');
  assert.equal(saved.rows.has(LANGUAGE_PREFERENCE_KEY), false);
  act(() => root.unmount());
});

test('Idioma with the gate closed lists no unfinished language and explains why; Región lists its conventions when opened', () => {
  const store = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store });
  const { provider } = loadProvider();
  const { screen } = loadPreferenceScreen(provider);
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(screen.LocalePreferenceScreen, { kind: 'language' }))); });
  assert.deepEqual(root.root.findAllByType('CheckRow' as never).map(row => row.props.title), ['Según el dispositivo', 'Español']);
  const note = root.root.findAllByType('AppText' as never).map(node => String(node.props.children)).join(' ');
  assert.match(note, /Por ahora FinanzApp está disponible en español/);
  assert.match(note, /no modifica tus movimientos, tus cuentas ni tus copias de seguridad/);
  act(() => root.update(h(provider.I18nProvider, { store }, h(screen.LocalePreferenceScreen, { kind: 'region' }))));
  assert.deepEqual(root.root.findAllByType('CheckRow' as never).map(row => [row.props.title, row.props.subtitle]), [['Según el dispositivo', 'Ahora: Argentina'], ['Argentina', '22/9/2026 · 1.234,56']]);
  assert.equal(root.root.findByType('Stack.Screen' as never).props.options.title, 'Región');
  assert.match(root.root.findAllByType('AppText' as never).map(node => String(node.props.children)).join(' '), /No cambia la moneda de tus cuentas/);
  act(() => root.unmount());
});
