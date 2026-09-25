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
import { activeLanguageChoice, activeRegionChoice, createLocaleStore, type DeviceReading, type LocaleStore } from '../src/i18n/store.ts';
import type { ReleasedSets } from '../src/i18n/locale.ts';

/** The gate as Producto 23.1C2 released it (Argentina and the United States): the tests of a two-region
 * chooser, of a region the gate holds back and of travelling across one keep it explicitly since 24R2B opened
 * the catalogue (`RELEASED` itself is tested in tests/regions-integration.node.ts and tests/i18n.node.ts). */
const HOME_GATE: ReleasedSets = { languages: ['es', 'en'], regions: ['AR', 'US'] };
/** The rows a chooser lists, "Según el dispositivo" first, and the chooser itself (24R2A: `ChoiceScreen`'s inputs). */
const chooserOf = localeOptions.localeChooser;
const optionsOf = (...args: Parameters<typeof localeOptions.localeChooser>) => { const chooser = chooserOf(...args); return [chooser.pinned, ...chooser.options]; };

// Producto 23.1A: language and region are two live preferences. A change made
// in Más re-renders the app in place: the navigation, the current screen, a
// half-typed draft and the Assistant conversation survive; the ledger
// provider is neither re-rendered nor remounted. These tests drive the real
// provider on a real React reconciler (react-test-renderer), not a snapshot.
// Producto 23.1C2 released English and the United States: the stores below use
// the default gate unless a test narrows it to stand for a build with a
// language or region not released yet.
const require = createRequire(import.meta.url);
const React = require('react') as typeof import('react');
const renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const { act } = React;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// react-test-renderer announces its deprecation on every create; that notice is not a test failure. Everything else still prints.
const consoleError = console.error;
console.error = (...args: unknown[]) => { if (!String(args[0]).startsWith('react-test-renderer is deprecated')) consoleError(...args); };
const h = React.createElement;

/** The gate as it stood until 23.1C1, standing in for any build that holds a catalogue or a region back. */
const SPANISH_ONLY: ReleasedSets = { languages: ['es'], regions: ['AR'] };

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
  const store = createLocaleStore({ devices: () => device('es-US', 'US'), store: saved.store });
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
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store });
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
  const store = createLocaleStore({ devices: () => device('es-AR', 'US'), store: saved.store });
  assert.deepEqual(store.getState().preferences, { language: 'system', region: 'system' });
  assert.equal(store.getState().locale, 'es-US');
  assert.equal(saved.rows.get(LANGUAGE_PREFERENCE_KEY), 'en', 'a failed read never deletes what is stored');
});

test('a narrower gate still holds in the store: values outside it are refused, and a stored one is not applied or marked', () => {
  const saved = memory({ [LANGUAGE_PREFERENCE_KEY]: 'en', [REGION_PREFERENCE_KEY]: 'US' });
  const store = createLocaleStore({ devices: () => device('en-US', 'US'), store: saved.store, released: SPANISH_ONLY });
  assert.equal(store.getState().locale, 'es-AR', 'English iPhone, US region, English and US saved: Spanish, Argentina, while they are held back');
  assert.equal(activeLanguageChoice(store.getState()), 'system', 'the chooser marks "follow the device", not an option it does not list');
  assert.equal(activeRegionChoice(store.getState()), 'system');
  assert.equal(store.setLanguage('en'), false);
  assert.equal(store.setRegion('US'), false);
  assert.equal(saved.rows.get(LANGUAGE_PREFERENCE_KEY), 'en', 'refusing does not erase a later build\'s value either');
  assert.equal(saved.rows.get(REGION_PREFERENCE_KEY), 'US');
  assert.equal(store.setLanguage('es'), true);
  assert.equal(store.setRegion('AR'), true);
  assert.equal(store.setLanguage('system'), true);
});

test('the 23.1C2 gate offers Spanish and English, Argentina and the United States: an English iPhone reads English', () => {
  assert.equal(createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store }).getState().released, locale.RELEASED, 'no override: the release gate itself');
  const state = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store, released: HOME_GATE }).getState();
  assert.equal(state.locale, 'en-US');
  assert.deepEqual([state.device.locale, state.device.primaryLanguage], ['en-US', 'en']);
  const t = bind.bindLocale(state.locale).t;
  assert.deepEqual(optionsOf('language', state, t).map(option => option.value), ['system', 'es', 'en']);
  assert.deepEqual(optionsOf('region', state, t).map(option => option.value), ['system', 'AR', 'US']);
  assert.equal(localeOptions.showsPreference('language', state), true);
  assert.equal(localeOptions.showsPreference('region', state), true, 'Más lists Región since 23.1C2');
  assert.deepEqual([localeOptions.preferenceSummary('language', state, t), localeOptions.preferenceSummary('region', state, t)],
    ['English · same as device', 'United States · same as device']);
});

test('choices saved during the 23.1C1 preview apply now that they are released: the choosers mark them, and "Según el dispositivo" clears both keys', () => {
  // FinanzApp Dev kept these rows from a Metro session started with EXPO_PUBLIC_LOCALE_PREVIEW=1.
  const saved = memory({ [LANGUAGE_PREFERENCE_KEY]: 'en', [REGION_PREFERENCE_KEY]: 'US' });
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store });
  const state = store.getState();
  assert.equal(state.locale, 'en-US', 'a Spanish iPhone in Argentina opens in English with US formats: the saved choices win');
  assert.equal(state.device.locale, 'es-AR');
  assert.deepEqual([activeLanguageChoice(state), activeRegionChoice(state)], ['en', 'US'], 'the choosers mark the saved choices, not "follow the device"');
  const t = bind.bindLocale(state.locale).t;
  assert.deepEqual([chooserOf('language', state, t).selected, chooserOf('region', state, t).selected], ['en', 'US']);
  assert.deepEqual([localeOptions.preferenceSummary('language', state, t), localeOptions.preferenceSummary('region', state, t)], ['English', 'United States']);
  assert.equal(store.setLanguage('system'), true);
  assert.equal(store.setRegion('system'), true);
  assert.deepEqual([saved.rows.has(LANGUAGE_PREFERENCE_KEY), saved.rows.has(REGION_PREFERENCE_KEY)], [false, false], 'both keys removed: the device decides again');
  assert.equal(store.getState().locale, 'es-AR');
  // The 23.0 value shape an older build saved still reads as its language.
  const legacy = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory({ [LANGUAGE_PREFERENCE_KEY]: 'es-AR' }).store }).getState();
  assert.deepEqual([legacy.locale, activeLanguageChoice(legacy), activeRegionChoice(legacy)], ['es-US', 'es', 'system']);
});

test('a relaunch is a new store over the same saved rows: explicit choices persist, and "follow the device" reads the device of that launch', () => {
  const saved = memory();
  const first = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store });
  assert.equal(first.setLanguage('en'), true);
  assert.equal(first.setRegion('US'), true);
  const second = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store });
  assert.equal(second.getState().locale, 'en-US', 'the choices made before the relaunch');
  assert.deepEqual({ ...second.getState().preferences }, { language: 'en', region: 'US' });
  assert.equal(second.setLanguage('system'), true);
  assert.equal(second.setRegion('system'), true);
  const third = createLocaleStore({ devices: () => device('en-US', 'US'), store: saved.store });
  assert.deepEqual([third.getState().locale, third.getState().preferences.language, third.getState().preferences.region], ['en-US', 'system', 'system'],
    'both follow the device the app relaunched on (an iPhone language change quits the app)');
  assert.equal(createLocaleStore({ devices: () => device('es-AR', 'US'), store: saved.store }).getState().locale, 'es-US');
});

test('a device the app does not support: Portuguese in Brazil reads Spanish with Argentine conventions, and says so beside "follow the device"', () => {
  const store = createLocaleStore({ devices: () => device('pt-BR', 'BR'), store: memory().store, released: HOME_GATE });
  const state = store.getState();
  assert.equal(state.locale, 'es-AR');
  assert.equal(state.device.locale, 'es-AR');
  assert.equal(state.device.primaryLanguage, 'pt', 'the device language is kept as read, catalogue or not');
  assert.equal(bind.bindLocale(state.locale, state.device.source, state.device.primaryLanguage).speechLanguage, 'es', 'so VoiceOver reads the Spanish labels with a Spanish voice');
  const t = bind.bindLocale(state.locale).t;
  assert.deepEqual(optionsOf('language', state, t).map(option => [option.value, option.title, option.subtitle ?? '']),
    [['system', 'Según el dispositivo', 'Ahora: Español'], ['es', 'Español', ''], ['en', 'English', '']]);
});

test('"follow the device" follows it live: a changed device reading re-resolves only the halves that follow it', () => {
  let reading = device('es-AR', 'AR');
  const saved = memory({ [LANGUAGE_PREFERENCE_KEY]: 'es' });
  const store = createLocaleStore({ devices: () => reading, store: saved.store });
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

test('the chooser lists only released values: a Spanish-only gate offers the device default and Español and hides Región; the default gate lists both of each', () => {
  const state = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store, released: SPANISH_ONLY }).getState();
  const t = bind.bindLocale(state.locale).t;
  const languages = chooserOf('language', state, t);
  assert.deepEqual([languages.pinned, ...languages.options].map(option => option.value), ['system', 'es'], 'a language held back is not offered, not even greyed out');
  assert.equal(languages.pinned.subtitle, 'Ahora: Español', 'honest: the English iPhone gets Spanish in such a build');
  assert.equal(languages.selected, 'system');
  assert.equal(localeOptions.showsPreference('language', state), true);
  assert.equal(localeOptions.showsPreference('region', state), false, 'a single released region: no Región row');
  assert.deepEqual(optionsOf('region', state, t).map(option => option.value), ['system', 'AR']);
  assert.equal(localeOptions.preferenceSummary('language', state, t), 'Español · según el dispositivo');
  // The default gate (23.1C2): each region shows its conventions in the current language.
  const open = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store, released: HOME_GATE }).getState();
  assert.deepEqual(optionsOf('language', open, bind.bindLocale(open.locale).t).map(option => [option.value, option.title, option.subtitle ?? '']),
    [['system', 'Same as device', 'Now: English'], ['es', 'Español', ''], ['en', 'English', '']], 'each language by its own name');
  const tEn = bind.bindLocale(open.locale).t;
  assert.deepEqual(optionsOf('region', open, tEn).map(option => [option.title, option.subtitle]),
    [['Same as device', 'Now: United States'], ['Argentina', '22/9/2026 · 1.234,56'], ['United States', '9/22/2026 · 1,234.56']]);
  assert.equal(localeOptions.preferenceSummary('region', open, tEn), 'United States · same as device');
});

// ---- The real provider on a real reconciler ---------------------------------

/** Runs a source file with a hand-written dependency map; `globals` are the bundle's own (process.env, __DEV__). */
function loadModule(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { ...globals, module, exports: module.exports, require: (name: string) => {
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

/** iOS's locale-change event as the provider reaches it (device-runtime's
 * `subscribeRuntimeLocaleChanges`): the listeners are kept, the unsubscribe
 * removes them, and `emit` stands for NSCurrentLocaleDidChangeNotification. */
function localeEvents() {
  const listeners = new Set<() => void>();
  return { listeners, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    emit: () => { for (const listener of [...listeners]) listener(); } };
}

/** The real provider. `runtimeDevices` is what the probed device reader
 * returns to a provider that builds its own store (no `store` prop). */
function loadProvider(runtimeDevices?: () => DeviceReading, globals: Record<string, unknown> = {}) {
  const native = appState(), events = localeEvents();
  const provider = loadModule('../src/i18n/provider.tsx', {
    react: React, 'react-native': { AppState: native.AppState },
    './bind.ts': bind, './locale.ts': locale, './preference.ts': preference, './store.ts': storeModule,
    './device-runtime': {
      readRuntimeDeviceLocales: () => { if (!runtimeDevices) throw new Error('the runtime device reader must not run when a store is given'); return runtimeDevices(); },
      subscribeRuntimeLocaleChanges: events.subscribe,
    },
  }, globals);
  return { provider, native, events };
}

/** A stand-in for the app: a ledger provider that must never re-render or
 * remount, a navigation stack holding a form with a half-typed draft and the
 * Assistant with a conversation, all under the real I18nProvider. */
function mountApp(store: LocaleStore) {
  const { provider, native, events } = loadProvider();
  const counts = { ledgerRenders: 0, ledgerMounts: 0, navigationMounts: 0, formMounts: 0, formRenders: 0, assistantMounts: 0, unmounts: 0 };
  const handles: { setDraft?: (value: string) => void; addMessage?: (value: string) => void; choose?: ReturnType<typeof provider.useLocalePreferences>;
    i18n?: ReturnType<typeof provider.useI18n> } = {};
  const lifecycle = (key: keyof typeof counts) => React.useEffect(() => { counts[key]++; return () => { counts.unmounts++; }; }, []);
  function Ledger({ children }: { children: React.ReactNode }) { counts.ledgerRenders++; lifecycle('ledgerMounts'); return children; }
  function Navigation({ children }: { children: React.ReactNode }) { lifecycle('navigationMounts'); return h('stack', null, children); }
  function EntryForm() {
    counts.formRenders++;
    lifecycle('formMounts');
    const i18n = provider.useI18n();
    const [draft, setDraft] = React.useState('');
    handles.setDraft = setDraft;
    return h('form', { title: i18n.t('amount.label'), draft, total: i18n.moneyText(123456, 'ARS'), date: i18n.formatDate('2026-09-22', 'dayYear'),
      accessibilityLabel: i18n.spokenMoney(123456, 'ARS'), accessibilityLanguage: i18n.speechLanguage });
  }
  function Assistant() {
    lifecycle('assistantMounts');
    const { t } = provider.useI18n();
    const [messages, setMessages] = React.useState<string[]>([]);
    handles.addMessage = message => setMessages(list => [...list, message]);
    return h('assistant', { messages, cancel: t('common.cancel') });
  }
  // The chooser re-renders on every preferences change; the I18n value it reads shows whether the forms' value changed.
  function Chooser() { handles.choose = provider.useLocalePreferences(); handles.i18n = provider.useI18n(); return null; }
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(Ledger, null, h(Navigation, null, h(EntryForm), h(Assistant), h(Chooser))))); });
  const form = () => root.root.findByType('form' as never).props;
  const assistant = () => root.root.findByType('assistant' as never).props;
  return { root, counts, handles, form, assistant, native, events };
}

test('switching the language with a form and a conversation mounted: labels change in place, nothing remounts, the draft and the messages survive', () => {
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: memory().store });
  const app = mountApp(store);
  assert.deepEqual([app.form().title, app.form().total, app.form().date, app.assistant().cancel], ['Monto', '$ 1.234,56', '22 sep 2026', 'Cancelar']);
  act(() => { app.handles.setDraft!('1.234,5'); app.handles.addMessage!('¿Cuánto gasté en comida?'); });
  act(() => { assert.equal(app.handles.choose!.setLanguage('en'), true); });
  assert.deepEqual([app.form().title, app.form().date, app.assistant().cancel], ['Amount', 'Sep 22, 2026', 'Cancel'], 'the words follow the new language at once');
  assert.equal(app.form().total, '$ 1.234,56', 'English with Argentine conventions: the amount is written exactly as before');
  assert.equal(app.form().accessibilityLabel, '1234.56 pesos', 'VoiceOver strings re-render too, with the decimal mark of the new language and no grouping');
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
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store });
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
  const store = createLocaleStore({ devices: () => reading, store: memory().store });
  const app = mountApp(store);
  act(() => app.handles.setDraft!('50'));
  reading = device('en-US', 'US');
  act(() => app.native.emit('background'));
  assert.equal(app.form().title, 'Monto', 'nothing is re-read while in the background');
  act(() => app.native.emit('active'));
  assert.deepEqual([app.form().title, app.form().total, app.form().draft], ['Amount', 'AR$ 1,234.56', '50']);
  assert.equal(app.counts.formMounts, 1);
  assert.deepEqual([app.native.listeners.size, app.events.listeners.size], [1, 1]);
  act(() => app.root.unmount());
  assert.deepEqual([app.native.listeners.size, app.events.listeners.size], [0, 0], 'no listener left behind');
});

test('iOS\'s locale-change event re-reads the device with no foreground signal: labels change in place, the draft and the conversation survive, a following "active" re-renders nothing', () => {
  let reading = device('es-AR', 'AR');
  const store = createLocaleStore({ devices: () => reading, store: memory().store });
  const app = mountApp(store);
  assert.deepEqual([app.native.listeners.size, app.events.listeners.size], [1, 1], 'one listener for each signal');
  act(() => { app.handles.setDraft!('1.234,5'); app.handles.addMessage!('¿Cuánto gasté en comida?'); });
  const renders = app.counts.formRenders;
  act(() => app.events.emit());
  assert.equal(app.counts.formRenders, renders, 'an unchanged device re-renders nothing');
  reading = device('en-US', 'US');
  act(() => app.events.emit());
  assert.deepEqual([app.form().title, app.form().total, app.form().date, app.assistant().cancel], ['Amount', 'AR$ 1,234.56', 'Sep 22, 2026', 'Cancel']);
  assert.equal(app.form().draft, '1.234,5', 'the half-typed amount survives');
  assert.deepEqual(app.assistant().messages, ['¿Cuánto gasté en comida?'], 'the conversation survives');
  assert.deepEqual([app.counts.ledgerMounts, app.counts.navigationMounts, app.counts.formMounts, app.counts.assistantMounts, app.counts.unmounts], [1, 1, 1, 1, 0], 'nothing remounted');
  assert.equal(app.counts.ledgerRenders, 1);
  const after = app.counts.formRenders;
  assert.equal(after, renders + 1, 'one re-render for the change');
  // The two signals arrive in no documented order; whichever comes second finds the device already read.
  act(() => app.native.emit('active'));
  act(() => app.events.emit());
  assert.equal(app.counts.formRenders, after, 'a following "active" (or a repeated event) re-renders nothing');
  act(() => app.root.unmount());
  assert.deepEqual([app.native.listeners.size, app.events.listeners.size], [0, 0], 'unmount removes both listeners');
});

test('a device read that throws, on return to the foreground or on iOS\'s event, keeps the locale and the draft and never throws out of the listener', () => {
  let reading = device('es-AR', 'AR'), broken = false;
  const store = createLocaleStore({ devices: () => { if (broken) throw new TypeError('getLocales is broken'); return reading; }, store: memory().store });
  const app = mountApp(store);
  act(() => app.handles.setDraft!('1.234,5'));
  const renders = app.counts.formRenders;
  broken = true;
  reading = device('en-US', 'US');
  assert.doesNotThrow(() => act(() => app.native.emit('active')));
  assert.doesNotThrow(() => act(() => app.events.emit()));
  assert.deepEqual([app.form().title, app.form().total, app.form().draft], ['Monto', '$ 1.234,56', '1.234,5'], 'the last good reading stays on screen, the draft with it');
  assert.equal(app.counts.formRenders, renders, 'nothing re-rendered');
  assert.equal(app.counts.formMounts, 1);
  assert.deepEqual({ ...app.handles.choose!.state.preferences }, { language: 'system', region: 'system' }, 'no choice reset');
  broken = false;
  act(() => app.native.emit('active'));
  assert.deepEqual([app.form().title, app.form().draft], ['Amount', '1.234,5'], 'the next good reading applies');
  act(() => app.root.unmount());
});

test('an explicit region ignores a device Region change: forms do not re-render, only the chooser\'s "Según el dispositivo" subtitle moves', () => {
  let reading = device('es-AR', 'AR');
  const store = createLocaleStore({ devices: () => reading, store: memory().store });
  const app = mountApp(store);
  act(() => { assert.equal(app.handles.choose!.setRegion('AR'), true); });
  act(() => app.handles.setDraft!('1.234,5'));
  const renders = app.counts.formRenders, value = app.handles.i18n;
  reading = device('es-AR', 'US');
  act(() => app.native.emit('active'));
  assert.equal(app.counts.formRenders, renders, 'the form does not re-render');
  assert.equal(app.handles.i18n, value, 'the I18n value is the same object');
  assert.deepEqual([app.form().total, app.form().draft], ['$ 1.234,56', '1.234,5']);
  const state = app.handles.choose!.state;
  assert.deepEqual([state.region, state.device.region], ['AR', 'US'], 'the chooser sees the device move');
  assert.equal(optionsOf('region', state, app.handles.i18n!.t)[0].subtitle, 'Ahora: Estados Unidos');
  act(() => app.root.unmount());
});

test('VoiceOver\'s language through the real provider: English on a Spanish iPhone names it, Spanish again clears it, and a same-locale save re-renders nothing', () => {
  const app = mountApp(createLocaleStore({ devices: () => device('es-AR', 'AR'), store: memory().store, released: HOME_GATE }));
  assert.equal(app.form().accessibilityLanguage, undefined, 'device and app agree: VoiceOver keeps the voice chosen in iOS Settings');
  act(() => { app.handles.choose!.setLanguage('en'); });
  assert.deepEqual([app.form().title, app.form().accessibilityLabel, app.form().accessibilityLanguage], ['Amount', '1234.56 pesos', 'en'],
    'English labels on a Spanish iPhone are spoken by an English voice');
  act(() => { app.handles.choose!.setLanguage('es'); });
  assert.deepEqual([app.form().title, app.form().accessibilityLanguage], ['Monto', undefined]);
  const renders = app.counts.formRenders;
  act(() => { app.handles.choose!.setLanguage('system'); });
  assert.equal(app.counts.formRenders, renders, 'Español → Según el dispositivo on a Spanish iPhone: same locale, same voice, no re-render');
  act(() => app.root.unmount());
  // A device language without a catalogue: the app reads Spanish and tells VoiceOver so.
  let reading = device('pt-BR', 'BR');
  const portuguese = mountApp(createLocaleStore({ devices: () => reading, store: memory().store, released: HOME_GATE }));
  assert.deepEqual([portuguese.form().title, portuguese.form().accessibilityLanguage], ['Monto', 'es']);
  // Portuguese → French: another language without a catalogue. Still Spanish, still a Spanish voice: nothing re-renders.
  const before = portuguese.counts.formRenders;
  reading = device('fr-BR', 'BR');
  act(() => portuguese.events.emit());
  assert.equal(portuguese.counts.formRenders, before, 'the I18n value is keyed on whether VoiceOver needs the interface language, not on the device language itself');
  assert.equal(portuguese.form().accessibilityLanguage, 'es');
  act(() => portuguese.root.unmount());
});

test('with a narrower gate, the provider keeps the whole app in Spanish with Argentine conventions whatever the device and the saved rows say', () => {
  const store = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory({ [LANGUAGE_PREFERENCE_KEY]: 'en', [REGION_PREFERENCE_KEY]: 'US' }).store,
    released: SPANISH_ONLY });
  const app = mountApp(store);
  assert.deepEqual([app.form().title, app.form().total, app.form().date], ['Monto', '$ 1.234,56', '22 sep 2026']);
  assert.equal(app.form().accessibilityLanguage, 'es', 'an English iPhone reading Spanish: VoiceOver is told the labels are Spanish');
  act(() => { assert.equal(app.handles.choose!.setLanguage('en'), false); });
  assert.equal(app.form().title, 'Monto');
  act(() => app.root.unmount());
});

test('the runtime store of a release bundle (no store prop, no preview flag) opens the default gate: an English iPhone reads English, and iOS\'s event reaches it', () => {
  let reading = device('en-US', 'US');
  // A release bundle: babel-preset-expo inlines __DEV__ as false and the flag as undefined. Node has no
  // key-value store, which reads as "follow the device" (preference.ts never throws on it).
  const { provider, native, events } = loadProvider(() => reading, { process: { env: {} }, __DEV__: false });
  let i18n!: ReturnType<typeof provider.useI18n>, preferences!: ReturnType<typeof provider.useLocalePreferences>;
  function Probe() { i18n = provider.useI18n(); preferences = provider.useLocalePreferences(); return null; }
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, null, h(Probe))); });
  assert.deepEqual([i18n.locale, i18n.speechLanguage, i18n.localeSource], ['en-US', undefined, 'native']);
  assert.equal(preferences!.state.released, locale.RELEASED, 'the release gate itself, not the preview set');
  reading = device('en-US', 'AR');
  act(() => events.emit());
  assert.equal(i18n.locale, 'en-AR', 'a Region change while running, through the native event');
  assert.deepEqual([native.listeners.size, events.listeners.size], [1, 1]);
  act(() => root.unmount());
  assert.deepEqual([native.listeners.size, events.listeners.size], [0, 0]);
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

/** Más → Idioma / Región since 24R2A: the real `LocaleChooser` over the real `ChoiceScreen` (hosts replaced by names,
 * FlatList drawing every row), with its recents in a memory store. */
function loadPreferenceScreen(provider: Record<string, any>, recentStore = memory().store) {
  const host = (name: string) => name;
  let haptics = 0;
  function FlatList(props: any) {
    return h('FlatList', null, props.ListHeaderComponent, ...props.data.map((item: any) => h(React.Fragment, { key: props.keyExtractor(item) }, props.renderItem({ item }))),
      props.ListFooterComponent);
  }
  const components = { AppText: host('AppText'), CheckRow: host('CheckRow'), ErrorMessage: host('ErrorMessage'), Field: host('Field'), Screen: host('Screen') };
  const choiceScreen = loadModule('../src/ui/choice-screen.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': { FlatList, View: host('View'), StyleSheet: { create: (styles: unknown) => styles } },
    'expo-router': { Stack: { Screen: host('Stack.Screen') } }, '../i18n/provider': provider, './components': components,
    './choice-list': require('../src/ui/choice-list.ts'), './motion': { selectionHaptic: () => { haptics++; } },
    './theme': { radius: { group: 16 }, space: { s: 8, m: 12, l: 16, xl: 20 }, usePalette: () => ({ background: '#F2F2F6', surface: '#FFFFFF' }) },
  });
  const recentModule = require('../src/i18n/recent.ts');
  const screen = loadModule('../src/ui/locale-choosers.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'expo-router': { Stack: { Screen: host('Stack.Screen') } },
    '../i18n/provider': provider, './choice-screen': choiceScreen, './components': components, './locale-options': localeOptions,
    '../i18n/recent': {
      readRecent: (kind: string, accept: (value: unknown) => boolean) => recentModule.readRecent(kind, accept, recentStore),
      rememberRecent: (kind: string, value: string, accept: (value: unknown) => boolean) => recentModule.rememberRecent(kind, value, accept, recentStore),
    },
  });
  return { screen: { LocaleChooser: screen.LocaleChooser, LocalePreferenceScreen: screen.LocaleChooser }, haptics: () => haptics };
}

test('Idioma: a tap saves and applies in place, the checkmark moves, the screen title follows the language, and a failed save keeps the old checkmark', () => {
  const saved = memory();
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: saved.store });
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

test('LocaleChooser for the onboarding: confirming the checked value calls onChosen and writes nothing; Más (no onChosen) stays inert; a new value is saved once', () => {
  const saved = memory({ [REGION_PREFERENCE_KEY]: 'AR' });
  const recents = memory();
  const store = createLocaleStore({ devices: () => device('es-AR', 'US'), store: saved.store, released: HOME_GATE });
  const { provider } = loadProvider();
  const { screen } = loadPreferenceScreen(provider, recents.store);
  let notified = 0;
  store.subscribe(() => notified++);
  const chosen: string[] = [];
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(screen.LocaleChooser, { kind: 'region', onChosen: (value: string) => chosen.push(value) }))); });
  const rows = () => root.root.findAllByType('CheckRow' as never).map(row => row.props);
  const writes = () => JSON.stringify([...saved.rows], null) + JSON.stringify([...recents.rows]);
  const before = writes();
  act(() => rows()[1].onPress()); // Argentina, already checked
  assert.deepEqual(chosen, ['AR'], 'the onboarding continues with the value in use');
  assert.equal(writes(), before, 'no preference and no recent written');
  assert.equal(notified, 0, 'the locale did not change: nothing re-renders');
  assert.equal(root.root.findByType('ErrorMessage' as never).props.message, null);
  act(() => rows()[2].onPress()); // Estados Unidos
  assert.deepEqual(chosen, ['AR', 'US']);
  assert.deepEqual([saved.rows.get(REGION_PREFERENCE_KEY), recents.rows.get('finanzapp.recent.region')], ['US', '["US"]'], 'a new value is saved first, then remembered');
  // Más: the same screen without onChosen; a tap on the checked row does nothing at all.
  act(() => root.update(h(provider.I18nProvider, { store }, h(screen.LocaleChooser, { kind: 'region' }))));
  const again = writes(), count = notified;
  act(() => rows()[2].onPress());
  assert.deepEqual([writes(), notified, chosen.length], [again, count, 2]);
  act(() => root.unmount());
});

test('Idioma and Región on the default gate: Según el dispositivo, Español and English; Argentina and Estados Unidos with their samples; no "for now" note', () => {
  const store = createLocaleStore({ devices: () => device('es-AR', 'US'), store: memory().store, released: HOME_GATE });
  const { provider } = loadProvider();
  const { screen } = loadPreferenceScreen(provider);
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(screen.LocalePreferenceScreen, { kind: 'language' }))); });
  const rows = () => root.root.findAllByType('CheckRow' as never).map(row => row.props);
  const note = () => root.root.findAllByType('AppText' as never).map(node => String(node.props.children)).join(' ');
  assert.equal(root.root.findByType('Stack.Screen' as never).props.options.title, 'Idioma');
  assert.deepEqual(rows().map(row => [row.title, row.subtitle ?? '', row.selected]), [['Según el dispositivo', 'Ahora: Español', true], ['Español', '', false], ['English', '', false]]);
  assert.deepEqual(rows().map(row => row.accessibilityLanguage ?? ''), ['', 'es', 'en'], 'each language is spoken in its own language, as in iOS Settings');
  assert.doesNotMatch(note(), /Por ahora/, 'English is released: the note no longer says the app is Spanish-only');
  assert.match(note(), /no modifica tus movimientos, tus cuentas ni tus copias de seguridad/);
  act(() => root.update(h(provider.I18nProvider, { store }, h(screen.LocalePreferenceScreen, { kind: 'region' }))));
  assert.equal(root.root.findByType('Stack.Screen' as never).props.options.title, 'Región');
  assert.deepEqual(rows().map(row => [row.title, row.subtitle, row.selected]), [['Según el dispositivo', 'Ahora: Estados Unidos', true],
    ['Argentina', '22/9/2026 · 1.234,56', false], ['Estados Unidos', '9/22/2026 · 1,234.56', false]], 'Spanish names, each region\'s own conventions');
  assert.match(note(), /No cambia la moneda de tus cuentas/);
  act(() => rows()[1].onPress());
  assert.deepEqual(rows().map(row => row.selected), [false, true, false], 'Argentina chosen over the device\'s United States');
  act(() => root.unmount());
});

test('Idioma with a narrower gate lists no unfinished language; Región lists only the released region', () => {
  const store = createLocaleStore({ devices: () => device('en-US', 'US'), store: memory().store, released: SPANISH_ONLY });
  const { provider } = loadProvider();
  const { screen } = loadPreferenceScreen(provider);
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(screen.LocalePreferenceScreen, { kind: 'language' }))); });
  assert.deepEqual(root.root.findAllByType('CheckRow' as never).map(row => [row.props.title, row.props.subtitle ?? '']), [['Según el dispositivo', 'Ahora: Español'], ['Español', '']]);
  assert.match(root.root.findAllByType('AppText' as never).map(node => String(node.props.children)).join(' '), /no modifica tus movimientos, tus cuentas ni tus copias de seguridad/);
  act(() => root.update(h(provider.I18nProvider, { store }, h(screen.LocalePreferenceScreen, { kind: 'region' }))));
  // 24R1: the device's Region (US) is one the catalogue names but this gate does not honour: the subtitle says whose formats stand in.
  assert.deepEqual(root.root.findAllByType('CheckRow' as never).map(row => [row.props.title, row.props.subtitle]), [['Según el dispositivo', 'Ahora: Estados Unidos (formatos de Argentina)'], ['Argentina', '22/9/2026 · 1.234,56']]);
  assert.equal(root.root.findByType('Stack.Screen' as never).props.options.title, 'Región');
  assert.match(root.root.findAllByType('AppText' as never).map(node => String(node.props.children)).join(' '), /No cambia la moneda de tus cuentas/);
  act(() => root.unmount());
});

// ---- Producto 23.1C1: the real amount field under the real provider -------

function loadAmountField(provider: Record<string, any>, announcements: string[]) {
  const host = (name: string) => name;
  const i18nFormat = require('../src/i18n/format.ts');
  return loadModule('../src/ui/components.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { AccessibilityInfo: { announceForAccessibility: (text: string) => announcements.push(text) }, ActivityIndicator: host('ActivityIndicator'),
      Alert: {}, InputAccessoryView: host('InputAccessoryView'), Keyboard: { dismiss() {} }, Platform: { OS: 'ios' }, Pressable: host('Pressable'),
      ScrollView: host('ScrollView'), StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5, absoluteFill: {}, flatten: (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) },
      Text: host('Text'), TextInput: host('TextInput'), View: host('View'), useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }) },
    'react-native-reanimated': { __esModule: true, default: { View: host('Animated.View'), Text: host('Animated.Text') }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number) => value, useAnimatedStyle: (fn: () => unknown) => fn() },
    '@expo/vector-icons/Ionicons': host('Ionicons'), 'expo-router': { router: {} },
    '@finanzapp/domain': require('@finanzapp/domain'),
    './theme': { radius: {}, space: { s: 8 }, type: { body: {}, footnote: {} }, useCurrentDay: () => '2026-09-22', useReduceMotion: () => true,
      usePalette: () => ({ text: '#000', secondary: '#666', tertiary: '#999', primary: '#25D', surface: '#FFF', warning: '#A60', isDark: false }) },
    './category-color': { tintOf: (color: string) => color }, './category-hues': { useAccountLook: () => ({}), useAccountNameOf: () => () => '', useCategoryLook: () => ({}) },
    './geometry': require('../src/ui/geometry.ts'), './motion': { duration: {}, easeOut: {}, selectionHaptic: () => {}, timing: () => ({}) },
    './money-input': require('../src/ui/money-input.ts'), './merchant-mark': require('../src/ui/merchant-mark.ts'),
    '../i18n/provider': provider, '../i18n/format': i18nFormat, '../i18n/locale': locale,
  });
}

/** A form holding an ARS amount draft (ledger notation) in the real
 * AmountField under the real provider; every draft the field emits is kept. */
function mountAmountField(store: LocaleStore) {
  const { provider, native, events } = loadProvider();
  const announcements: string[] = [];
  const components = loadAmountField(provider, announcements);
  const drafts: string[] = [];
  const counts = { formMounts: 0 };
  const handles: { choose?: ReturnType<typeof provider.useLocalePreferences> } = {};
  function Form() {
    React.useEffect(() => { counts.formMounts++; }, []);
    const [amount, setAmount] = React.useState('');
    handles.choose = provider.useLocalePreferences();
    return h(components.AmountField, { currency: 'ARS', value: amount, onChangeText: (value: string) => { drafts.push(value); setAmount(value); } });
  }
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(h(provider.I18nProvider, { store }, h(Form))); });
  const input = () => root.root.findByType('TextInput' as never).props;
  const texts = () => root.root.findAllByType('Text' as never).map(node => String([node.props.children].flat().join('')));
  const type = (char: string) => {
    const { value, selection } = input();
    const caret = selection ? selection.end : value.length;
    const text = value.slice(0, caret) + char + value.slice(caret);
    act(() => input().onChange({ nativeEvent: { text, selection: { start: caret + char.length, end: caret + char.length } } }));
  };
  return { root, input, texts, type, drafts, announcements, counts, choose: () => handles.choose!, native, events };
}

test('the amount field under the real provider: typing, a region change with the amount half-typed, a refused paste and a language change', () => {
  const { parseMinorUnits } = require('@finanzapp/domain') as typeof import('@finanzapp/domain');
  const store = createLocaleStore({ devices: () => device('es-AR', 'AR'), store: memory().store });
  const field = mountAmountField(store);
  const { root, input, texts, type, drafts, announcements, counts } = field;
  const choose = field.choose();
  for (const key of '1234,5') type(key);
  assert.equal(input().value, '1.234,5');
  assert.equal(drafts.at(-1), '1.234,5');
  assert.ok(texts().includes('$'), 'the peso is a bare "$" in Argentina');
  act(() => input().onSelectionChange({ nativeEvent: { selection: { start: 5, end: 5 }, text: '1.234,5' } })); // after the 4
  const before = drafts.length;
  act(() => { choose.setRegion('US'); });
  assert.equal(input().value, '1,234.5', 'the separators follow the region at once');
  assert.deepEqual({ ...input().selection }, { start: 5, end: 5 }, 'the caret is still after the 4');
  assert.equal(drafts.length, before, 'the draft is not rewritten: the form never hears of the region change');
  assert.ok(texts().includes('AR$'), 'in the United States the peso carries its prefix');
  type('9');
  assert.deepEqual([input().value, drafts.at(-1)], ['12,349.5', '12.349,5']);
  assert.equal(parseMinorUnits(drafts.at(-1)!), 1234950, 'the amount the form saves is exact integer minor units');
  // An ambiguous paste in the United States: refused, explained, announced; nothing changes.
  const { value } = input();
  act(() => input().onChange({ nativeEvent: { text: value + '1.000', selection: { start: value.length + 5, end: value.length + 5 } } }));
  assert.equal(input().value, '12,349.5');
  assert.deepEqual({ ...input().selection }, { start: 6, end: 6 }, 'the caret is back where it was, after the 9');
  assert.equal(drafts.at(-1), '12.349,5');
  const note = 'No se pegó «1.000»: puede leerse de dos maneras. Escribí los decimales con «.».';
  assert.ok(texts().includes(note), 'the note says why');
  assert.deepEqual(announcements, [note], 'and VoiceOver hears it');
  act(() => { choose.setLanguage('en'); });
  assert.ok(texts().includes('Didn’t paste “1.000”: it can be read two ways. Use “.” for decimals.'), 'the note follows a language change like any label');
  assert.equal(input().accessibilityLabel, 'Amount in Argentine pesos');
  act(() => input().onSelectionChange({ nativeEvent: { selection: { start: 8, end: 8 }, text: '12,349.5' } }));
  type('7');
  assert.equal(texts().some(text => text.startsWith('Didn’t paste')), false, 'the next accepted edit clears the note');
  act(() => { choose.setRegion('AR'); });
  assert.equal(input().value, '12.349,57');
  // A note about a refused paste belongs to the region that read it: a region change removes it.
  act(() => input().onChange({ nativeEvent: { text: '12.349,571,000', selection: { start: 14, end: 14 } } }));
  assert.equal(texts().some(text => text.startsWith('Didn’t paste')), true);
  act(() => { choose.setRegion('US'); });
  assert.equal(texts().some(text => text.startsWith('Didn’t paste')), false, 'no stale note after a region change');
  act(() => { choose.setRegion('AR'); });
  act(() => input().onBlur({}));
  assert.deepEqual([input().value, drafts.at(-1)], ['12.349,57', '12.349,57']);
  assert.equal(counts.formMounts, 1, 'the form was never remounted');
  act(() => root.unmount());
});

test('24R2A preview: a half-typed amount under the real provider across India, Switzerland, France and Poland keeps its draft, its caret and its exact value', () => {
  const { parseMinorUnits } = require('@finanzapp/domain') as typeof import('@finanzapp/domain');
  let reading = device('es-AR', 'IN');
  const store = createLocaleStore({ devices: () => reading, store: memory().store, released: locale.PREVIEW });
  const field = mountAmountField(store);
  const { input, type, drafts } = field;
  for (const key of '1234567') type(key);
  assert.deepEqual([input().value, drafts.at(-1)], ['12,34,567', '1.234.567'], 'lakh grouping on screen, the ledger notation in the draft');
  act(() => input().onSelectionChange({ nativeEvent: { selection: { start: 4, end: 4 }, text: '12,34,567' } })); // after "12,3"
  const before = drafts.length;
  const choose = field.choose();
  act(() => { choose.setRegion('CH'); });
  assert.equal(input().value, "1'234'567");
  assert.deepEqual({ ...input().selection }, { start: 4, end: 4 }, "still after the 3: \"1'23|4'567\"");
  act(() => { choose.setRegion('FR'); });
  assert.equal(input().value, '1\u202F234\u202F567', 'a narrow no-break space');
  act(() => { choose.setRegion('system'); });
  reading = device('es-AR', 'PL');
  act(() => store.refreshDevice());
  assert.equal(input().value, '1\u00A0234\u00A0567', 'following the device: the iPhone\'s Region changed to Poland while the form was open');
  assert.equal(drafts.length, before, 'no region change ever emitted a draft');
  type('9');
  assert.deepEqual([input().value, drafts.at(-1)], ['12\u00A0394\u00A0567', '12.394.567'], 'the 9 lands after the 3, where the caret stayed');
  assert.equal(parseMinorUnits(drafts.at(-1)!), 1239456700, 'exact integer minor units');
  const { counts, root } = field;
  assert.equal(counts.formMounts, 1, 'the form was never remounted');
  act(() => root.unmount());
});

test('following the device, a US→AR Region change on return to the foreground reformats a half-typed amount in place and emits no new draft', () => {
  const { parseMinorUnits } = require('@finanzapp/domain') as typeof import('@finanzapp/domain');
  let reading = device('es-US', 'US');
  const store = createLocaleStore({ devices: () => reading, store: memory().store });
  const { root, input, texts, type, drafts, counts, native } = mountAmountField(store);
  for (const key of '1234.5') type(key);
  assert.deepEqual([input().value, drafts.at(-1)], ['1,234.5', '1.234,5'], 'US separators on screen, ledger notation in the draft');
  assert.ok(texts().includes('AR$'));
  act(() => input().onSelectionChange({ nativeEvent: { selection: { start: 5, end: 5 }, text: '1,234.5' } })); // after the 4
  // A refused paste leaves a note that belongs to the US reading of it.
  act(() => input().onChange({ nativeEvent: { text: '1,234.51.000', selection: { start: 12, end: 12 } } }));
  assert.equal(texts().some(text => text.startsWith('No se pegó')), true);
  const before = drafts.length;
  // iOS Settings → Region: Argentina, then back to FinanzApp (iOS keeps the app running across a Region change).
  reading = device('es-AR', 'AR');
  act(() => native.emit('active'));
  assert.equal(input().value, '1.234,5', 'the separators follow the device region at once');
  assert.deepEqual({ ...input().selection }, { start: 5, end: 5 }, 'the caret is still after the 4');
  assert.equal(drafts.length, before, 'no new draft: the form never hears of the region change');
  assert.equal(parseMinorUnits(drafts.at(-1)!), 123450, 'the amount the form would save is the same integer minor units');
  assert.ok(texts().includes('$'), 'the peso is a bare "$" again');
  assert.equal(texts().some(text => text.startsWith('No se pegó')), false, 'no stale note from the other region');
  assert.equal(counts.formMounts, 1, 'nothing remounted');
  type('9');
  assert.deepEqual([input().value, drafts.at(-1)], ['12.349,5', '12.349,5'], 'typing goes on in Argentine separators');
  act(() => root.unmount());
});

// ---- Producto 24R1: the device's Region as the catalogue names it ------------------------------------

test('24R1: the device Region is read as a catalogue code, released or not, and "Según el dispositivo" names it with the formats that stand in; the resolved region stays a released one', () => {
  const japan = createLocaleStore({ devices: () => device('ja-JP', 'JP'), store: memory().store, released: HOME_GATE });
  let state = japan.getState();
  assert.deepEqual([state.locale, state.region, state.device.region, state.device.detectedRegion, state.device.primaryLanguage], ['es-AR', 'AR', 'AR', 'JP', 'ja'], 'Japan is known, not released: Argentine formats, and the state says which iPhone this is');
  const t = bind.bindLocale('es-AR').t;
  assert.equal(optionsOf('region', state, t)[0].subtitle, 'Ahora: Japón (formatos de Argentina)');
  const englishPhone = createLocaleStore({ devices: () => device('en-JP', 'JP'), store: memory().store, released: HOME_GATE }).getState();
  assert.deepEqual([englishPhone.language, englishPhone.region, englishPhone.device.detectedRegion], ['en', 'AR', 'JP']);
  assert.equal(localeOptions.deviceRegionSummary(englishPhone, bind.bindLocale('en-AR').t), 'Now: Japan (Argentina formats)', 'named in the interface language');
  assert.equal(localeOptions.preferenceSummary('region', state, t), 'Argentina · según el dispositivo', 'the Más row names the formats in use');
  // A released Region: the plain sentence, unchanged from 23.1C2.
  state = createLocaleStore({ devices: () => device('es-US', 'US'), store: memory().store, released: HOME_GATE }).getState();
  assert.deepEqual([state.device.detectedRegion, optionsOf('region', state, t)[0].subtitle], ['US', 'Ahora: Estados Unidos']);
  // A Region the catalogue does not know, or none: nothing detected, the plain sentence.
  for (const reading of [device('es-AR', 'ZZ'), device('es', null), { source: 'none' as const, locales: [] }]) {
    state = createLocaleStore({ devices: () => reading, store: memory().store, released: HOME_GATE }).getState();
    assert.equal(state.device.detectedRegion, null, JSON.stringify(reading));
    assert.equal(optionsOf('region', state, t)[0].subtitle, 'Ahora: Argentina');
  }
  // Only Intl answered (an older binary): the tag's region is read, never a second language's.
  state = createLocaleStore({ devices: () => ({ source: 'intl', locales: [{ languageTag: 'en-GB' }] }), store: memory().store, released: HOME_GATE }).getState();
  assert.deepEqual([state.device.detectedRegion, state.region, state.language], ['GB', 'AR', 'en']);
});

test('24R1: travelling with "Según el dispositivo" follows the Region setting live, and only among released regions; a manual choice never moves, and a half-typed draft survives either way', () => {
  let reading = device('es-AR', 'AR');
  const saved = memory();
  const store = createLocaleStore({ devices: () => reading, store: saved.store, released: HOME_GATE });
  const app = mountApp(store);
  act(() => app.handles.setDraft!('1.234,5'));
  // Following the device: Argentina → Japan (not released) keeps Argentine formats but names Japan; → United States applies US formats in place.
  reading = device('es-AR', 'JP');
  act(() => app.native.emit('active'));
  let state = app.handles.choose!.state;
  assert.deepEqual([state.region, state.device.detectedRegion], ['AR', 'JP']);
  assert.equal(optionsOf('region', state, app.handles.i18n!.t)[0].subtitle, 'Ahora: Japón (formatos de Argentina)');
  assert.equal([app.form().total, app.form().draft].join('|'), '$\u00A01.234,56|1.234,5', 'nothing moved: Japan is not released');
  reading = device('es-AR', 'US');
  act(() => app.native.emit('active'));
  state = app.handles.choose!.state;
  assert.deepEqual([state.region, state.device.detectedRegion], ['US', 'US']);
  // The stand-in form keeps its raw draft text; the real AmountField's re-writing of a draft on a region change is the 23.1C2 test above.
  assert.equal([app.form().total, app.form().draft].join('|'), 'AR$\u00A01,234.56|1.234,5', 'US formats applied in place, the draft not lost');
  assert.equal(saved.rows.size, 0, 'following the device stores nothing');
  // A manual choice: Argentina. The phone then travels to Japan and to the United States: nothing changes but the chooser\'s subtitle.
  act(() => { assert.equal(app.handles.choose!.setRegion('AR'), true); });
  assert.equal(saved.rows.get(REGION_PREFERENCE_KEY), 'AR');
  const renders = app.counts.formRenders;
  for (const region of ['JP', 'US', 'GB', 'AR']) {
    reading = device('es-AR', region);
    act(() => app.native.emit('active'));
    state = app.handles.choose!.state;
    assert.deepEqual([state.region, state.preferences.region, state.device.detectedRegion], ['AR', 'AR', region], region);
    assert.equal([app.form().total, app.form().draft].join('|'), '$\u00A01.234,56|1.234,5', region + ': the draft is kept');
  }
  assert.equal(app.counts.formRenders, renders, 'a manual region ignores every device change: the form never re-renders');
  assert.equal(saved.rows.get(REGION_PREFERENCE_KEY), 'AR', 'the saved choice is untouched by travel');
  // A relaunch after the trip: the same saved choice, whatever the device says now.
  reading = device('ja-JP', 'JP');
  const relaunched = createLocaleStore({ devices: () => reading, store: saved.store, released: HOME_GATE }).getState();
  assert.deepEqual([relaunched.region, relaunched.preferences.region, relaunched.device.detectedRegion, relaunched.language], ['AR', 'AR', 'JP', 'es']);
  act(() => app.root.unmount());
});
