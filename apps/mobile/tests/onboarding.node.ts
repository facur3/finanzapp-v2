import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as appearance from '../src/ui/appearance.ts';
import * as currencies from '../src/ui/currencies.ts';
import * as flags from '../src/i18n/flags.ts';
import * as geometry from '../src/ui/geometry.ts';
import * as localeOptions from '../src/ui/locale-options.ts';
import * as moneyInput from '../src/ui/money-input.ts';
import * as onboardingFlow from '../src/ui/onboarding-flow.ts';
import * as paletteModule from '../src/ui/palette.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { DISPLAY_CURRENCY_KEY } from '../src/ui/display-currency.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, type PreferenceStore } from '../src/i18n/preference.ts';
import { createLocaleStore, type DeviceReading } from '../src/i18n/store.ts';
import { RELEASED, type AppLocale, type ReleasedSets } from '../src/i18n/locale.ts';
import { es } from '../src/i18n/messages/es/index.ts';
import { NEWER_SCHEMA_MESSAGE } from '../src/storage/database.ts';
import * as backupFile from '../src/ui/backup-file.ts';

// Producto 25B, redesigned in 25O1: the first opening. The pure rules (when it is shown, what it suggests, its steps, the
// illustrations' figures) are tested directly; the route and the illustrations run in harnesses with their hosts replaced
// by names. Not a rendered iPhone screen: the motion's feel, VoiceOver's focus and the splash need the device.
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

test('the region suggests the first account\'s currency when the build offers it; 25O1: four steps, and no way back from the close', () => {
  assert.equal(suggestedCurrency('ES'), 'EUR');
  assert.equal(suggestedCurrency('US'), 'USD');
  assert.equal(suggestedCurrency('AR'), 'ARS');
  assert.equal(suggestedCurrency('JP'), 'JPY');
  assert.equal(suggestedCurrency('KW'), 'ARS', 'KWD is held (three decimals): nothing the build offers');
  assert.equal(suggestedCurrency('KW', ['ARS', 'USD', 'KWD']), 'KWD', 'a preview gate that offers it');
  assert.equal(suggestedCurrency(null), 'ARS');
  assert.equal(suggestedCurrency('US', ['ARS']), 'ARS', 'a gate without the tender');
  assert.deepEqual(onboardingFlow.ONBOARDING_STEPS, ['story', 'start', 'account', 'done']);
  assert.deepEqual(onboardingFlow.ONBOARDING_STEPS.map(nextStep), ['start', 'account', 'done', null]);
  assert.deepEqual(onboardingFlow.ONBOARDING_STEPS.map(previousStep), [null, 'story', 'start', null], 'the close has no previous step: its account exists');
  assert.equal(onboardingFlow.STORY_PAGES, 3);
  // Each preset is a real account icon of the domain and names itself in both catalogues.
  const { t: tEs } = bindLocale('es-AR'), { t: tEn } = bindLocale('en-US');
  assert.deepEqual(Object.entries(onboardingFlow.ACCOUNT_PRESETS).map(([key, preset]) => [key, preset.icon, domain.isAccountIconId(preset.icon), appearance.accountGlyph(preset.icon)]),
    [['cash', 'cash', true, 'cash-outline'], ['bank', 'bank', true, 'business-outline'], ['digital', 'digital', true, 'phone-portrait-outline']]);
  assert.deepEqual(Object.values(onboardingFlow.ACCOUNT_PRESETS).map(preset => [tEs(preset.name), tEn(preset.name)]),
    [['Efectivo', 'Cash'], ['Banco', 'Bank'], ['Billetera virtual', 'Digital wallet']]);
});

test('25O1: the illustrations\' figures: pesos of their own, dollar-like elsewhere, scaled to two significant digits where a unit is small; every one a positive amount the field accepts', () => {
  const { sampleFigures } = onboardingFlow;
  assert.deepEqual(sampleFigures('ARS'), { coffee: 250_000, groceries: 1_894_000, transport: 120_000, instalment: 1_840_000, available: 48_230_000, spent: 9_640_000 });
  assert.deepEqual(sampleFigures('USD'), { coffee: 450, groceries: 3_890, transport: 275, instalment: 18_400, available: 324_000, spent: 96_400 });
  assert.deepEqual(sampleFigures('EUR'), sampleFigures('USD'));
  assert.deepEqual(sampleFigures('JPY'), { coffee: 680, groceries: 5_800, transport: 410, instalment: 28_000, available: 490_000, spent: 140_000 }, 'yen have no minor unit');
  assert.deepEqual(sampleFigures('COP'), { coffee: 1_800_000, groceries: 16_000_000, transport: 1_100_000, instalment: 74_000_000, available: 1_300_000_000, spent: 390_000_000 },
    'Colombian pesos keep two decimals');
  const significant = (minor: number, currency: domain.Currency) => String(minor / 10 ** domain.minorUnitExponent(currency)).replace(/0+$/, '').length;
  for (const currency of ['JPY', 'KRW', 'CLP', 'COP', 'PYG', 'IDR', 'VND', 'HUF', 'ISK'] as const) {
    for (const [name, minor] of Object.entries(sampleFigures(currency))) assert.ok(significant(minor, currency) <= 2, `${currency} ${name}: ${minor} reads as a round figure`);
  }
  // Every currency of the gate without decimals is scaled: no released region's first opening draws a five-franc coffee.
  const whole = domain.LEDGER_CURRENCIES.filter(currency => domain.minorUnitExponent(currency) === 0);
  assert.ok(whole.length >= 16);
  for (const currency of whole) assert.ok(sampleFigures(currency).coffee >= 100, `${currency}: a coffee of ${sampleFigures(currency).coffee}`);
  assert.deepEqual(sampleFigures('XOF'), { coffee: 2_700, groceries: 23_000, transport: 1_700, instalment: 110_000, available: 1_900_000, spent: 580_000 });
  for (const currency of domain.LEDGER_CURRENCIES) {
    const figures = sampleFigures(currency);
    for (const [name, minor] of Object.entries(figures)) {
      assert.ok(Number.isSafeInteger(minor) && minor > 0 && minor <= domain.MAX_ENTRY_MINOR, `${currency} ${name}`);
      assert.equal(domain.draftFitsCurrency(moneyInput.amountFromMinor(minor, currency), currency).ok, true, `${currency} ${name} fits the amount field`);
    }
    assert.ok(figures.available > figures.spent && figures.spent > figures.coffee, currency + ': what is left is more than what was spent, which is more than a coffee');
  }
  // The scene types the coffee as a person would, one key at a time, and the field groups it.
  assert.deepEqual(onboardingFlow.typingFrames(moneyInput.amountFromMinor(250_000, 'ARS')), ['2', '25', '250', '2500']);
  assert.deepEqual(onboardingFlow.typingFrames(moneyInput.amountFromMinor(450, 'USD')), ['4', '4,', '4,5', '4,50']);
  const shown = (draft: string, locale: AppLocale, currency: domain.Currency) => moneyInput.displayAmount(draft, bindLocale(locale).amountFormat, currency);
  assert.deepEqual(['2', '25', '250', '2500'].map(draft => shown(draft, 'es-AR', 'ARS')), ['2', '25', '250', '2.500']);
  assert.deepEqual(['4', '4,', '4,5', '4,50'].map(draft => shown(draft, 'en-US', 'USD')), ['4', '4.', '4.5', '4.50']);
  // The count runs in whole units and lands exactly on its figure; a scene is scaled down, never up, and not drawn below 160 pt.
  assert.deepEqual([0, 0.5, 0.999, 1, 1.4].map(progress => onboardingFlow.countUp(48_230_037, progress, 2)), [0, 24_115_000, 48_181_800, 48_230_037, 48_230_037]);
  const size = { width: 345, height: 320 };
  assert.equal(onboardingFlow.artScale({ width: 345, height: 900 }, size), 1, 'never up');
  assert.equal(onboardingFlow.artScale({ width: 327, height: 900 }, size), 327 / 345, 'a 375 pt iPhone');
  assert.equal(onboardingFlow.artScale({ width: 345, height: 200 }, size), 200 / 320);
  assert.equal(onboardingFlow.artScale({ width: 345, height: 159 }, size), 0, 'below the minimum, nothing');
  assert.equal(onboardingFlow.artScale({ width: 0, height: 0 }, size), 0, 'not measured yet');
  assert.deepEqual(onboardingFlow.storyCalendar('2026-10-16'), { months: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'], current: 3, due: '2026-10-12' });
  assert.deepEqual(onboardingFlow.storyCalendar('2026-01-31').months, ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'], 'across a year');
});

// ---- harness tools ------------------------------------------------------------------------------------------

type Node = { type: any; props: Record<string, any> };
const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
const transpile = (path: string) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const names = (...list: string[]) => Object.fromEntries(list.map(name => [name, name]));

/** One component instance's hooks, in call order: state and refs by index, an effect when its dependencies change (its
 * previous cleanup first), a shared value kept across renders. */
function hookRuntime() {
  const cells: unknown[] = [];
  const shared: { value: unknown }[] = [];
  let cursor = 0;
  const cell = <T>(init: () => T): { index: number; value: T } => { const index = cursor++; if (!(index in cells)) cells[index] = init(); return { index, value: cells[index] as T }; };
  return {
    reset() { cursor = 0; },
    useState(initial: unknown) {
      const { index, value } = cell(() => typeof initial === 'function' ? (initial as () => unknown)() : initial);
      return [value, (next: unknown) => { cells[index] = typeof next === 'function' ? (next as (current: unknown) => unknown)(cells[index]) : next; }];
    },
    useRef(initial: unknown) { return cell(() => ({ current: initial })).value; },
    useEffect(fn: () => void | (() => void), deps?: unknown[]) {
      const { value: slot } = cell(() => ({ deps: undefined as unknown[] | undefined, cleanup: undefined as void | (() => void) }));
      if (slot.deps && deps && deps.length === slot.deps.length && deps.every((item, i) => Object.is(item, slot.deps![i]))) return;
      slot.cleanup?.();
      slot.deps = deps;
      slot.cleanup = fn();
    },
    useShared(initial: unknown) { return cell(() => { const value = { value: initial }; shared.push(value); return value; }).value; },
    /** The shared values, in the order the component created them. */
    values: () => shared as { value: any }[],
  };
}

/** setTimeout for a harness: nothing runs until `run` (all due, in order) or `next` (one). */
function clock() {
  const queue: { fn: () => void; ms: number; state: 'pending' | 'cancelled' | 'done' }[] = [];
  const due = () => queue.filter(timer => timer.state === 'pending');
  return {
    setTimeout: (fn: () => void, ms = 0) => queue.push({ fn, ms, state: 'pending' }) - 1,
    clearTimeout: (id: number) => { if (queue[id]?.state === 'pending') queue[id].state = 'cancelled'; },
    pending: () => due().map(timer => timer.ms),
    next() { const timer = due()[0]; assert.ok(timer, 'a timer is due'); timer.state = 'done'; timer.fn(); },
    run() { for (let timer = due()[0]; timer; timer = due()[0]) { timer.state = 'done'; timer.fn(); } },
  };
}

function nodes(value: any): Node[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value.props) return [];
  return [value, ...nodes(value.props.children)];
}
const textOf = (value: any): string => typeof value === 'string' || typeof value === 'number' ? String(value)
  : Array.isArray(value) ? value.map(textOf).join('') : value?.props ? textOf(value.props.children) : '';
const find = (root: Node, type: string, label?: string) => {
  const node = nodes(root).find(n => n.type === type && (!label || n.props.label === label || n.props.title === label));
  assert.ok(node, 'Missing ' + type + ' ' + (label ?? ''));
  return node;
};
const texts = (root: Node) => nodes(root).filter(n => n.type === 'AppText').map(n => textOf(n.props.children));
const headers = (root: Node) => nodes(root).filter(n => n.props.accessibilityRole === 'header').map(n => textOf(n.props.children));
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
/** A value made inside a harness's context (its own Object prototype) as a plain one of this realm, for deepEqual. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

// ---- the route ---------------------------------------------------------------------------------------------

const HOME_GATE: ReleasedSets = { languages: ['es', 'en'], regions: ['AR', 'US'] };
function device(languageTag: string, regionCode: string | null = null): DeviceReading {
  return { source: 'native', locales: [{ languageTag, languageCode: languageTag.split('-')[0], regionCode }] };
}
const createdAt = '2026-09-26T12:00:00Z';

/** The route with its hosts replaced by names. `prefs` is the key-value store (shared with the locale store, like the
 * device's); `accounts` the ledger's accounts; `addAccount` the real path into the ledger mock, so a saved account shows
 * up in the snapshot on the next render. Pass the same `prefs` again to stand for a cold reopen. `failSave` fails the first
 * save once it was sent; the retry goes through. `focused()` stands for the screen gaining focus (back from a pushed
 * screen); `hardwareBack()` for Android's back button. */
function harness({ accounts = [] as domain.Account[], reading = device('es-AR', 'AR'), released = HOME_GATE, gate = domain.LEDGER_CURRENCIES, prefs = memory(), failSave = false,
  reduced = false, os = 'ios' } = {}) {
  const localeStore = createLocaleStore({ devices: () => reading, store: prefs.store, released });
  const display: { currency: string | null; mode: string | null } = { currency: null, mode: null };
  const hooks = hookRuntime();
  const timers = clock();
  const routes: unknown[] = [], scrolls: unknown[] = [], focus: unknown[][] = [], bars: string[] = [];
  const saved: domain.Account[] = [], looks: domain.AccountAppearance[] = [], haptics: string[] = [];
  const splash = { hides: 0 };
  const ledger = { accounts: [...accounts] };
  let focusEffect: (() => void) | null = null;
  let hardwareBack: (() => boolean) | null = null;
  const modules: Record<string, unknown> = {
    react: { useState: hooks.useState, useRef: hooks.useRef, useEffect: hooks.useEffect, useCallback: (fn: unknown) => fn },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ...names('View', 'ScrollView'), Platform: { OS: os }, Keyboard: { dismiss() {} },
      BackHandler: { addEventListener: (_: string, handler: () => boolean) => { hardwareBack = handler; return { remove() {} }; } },
      AccessibilityInfo: { sendAccessibilityEvent: (node: unknown, type: string) => focus.push([node, type]) },
      useWindowDimensions: () => ({ width: 393, height: 852, fontScale: 1 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' } },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, useFocusEffect: (effect: () => void) => { focusEffect = effect; },
      router: { replace: (to: unknown) => routes.push({ replace: to }), push: (to: unknown) => routes.push({ push: to }) } },
    'react-native-safe-area-context': names('SafeAreaView'),
    'expo-splash-screen': { hideAsync: async () => { splash.hides++; } },
    'expo-status-bar': { setStatusBarStyle: (style: string) => bars.push(style) },
    'expo-crypto': { randomUUID: () => 'first-account' },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { useLedger: () => ({ snapshot: { accounts: ledger.accounts, entries: [] }, gate,
      addAccount: async (account: domain.Account, look: domain.AccountAppearance) => {
        if (failSave) { failSave = false; throw new Error('disk full'); }
        saved.push(account); looks.push(look); ledger.accounts = [...ledger.accounts, account];
      } }) },
    '../src/ui/appearance': appearance,
    '../src/ui/components': names('ActionButton', 'AmountField', 'AppText', 'ErrorMessage', 'Field', 'GlyphTile', 'IconButton', 'NavigationRow', 'PressFeedback', 'Surface'),
    '../src/ui/currency-chip': names('CurrencyChip'),
    '../src/ui/marks': names('InlineFlag'),
    '../src/ui/locale-options': localeOptions,
    '../src/ui/display-currency-provider': { useDisplayCurrency: () => ({ currency: 'ARS', preferred: null, mode: 'consolidated',
      setCurrency: (currency: string) => { display.currency = currency; prefs.rows.set(DISPLAY_CURRENCY_KEY, currency); }, setMode: (mode: string) => { display.mode = mode; } }) },
    '../src/ui/geometry': geometry,
    // 25Q4 review: each notification haptic by its helper's name (tests/motion.node.ts pins the type each one sends).
    '../src/ui/motion': { ValueTransition: 'ValueTransition', duration: { state: 200 },
      successHaptic() { haptics.push('Success'); }, errorHaptic() { haptics.push('Error'); }, warningHaptic() { haptics.push('Warning'); } },
    '../src/ui/onboarding-art': names('AccountCard', 'AvailableArt', 'CommitmentsArt', 'RecordArt'),
    '../src/ui/onboarding-flow': onboardingFlow,
    '../src/ui/theme': { radius: { group: 16 }, space: { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 }, type: { display: { fontSize: 40 } },
      usePalette: () => ({ ...paletteModule.lightPalette, isDark: false }), useReduceMotion: () => reduced },
    '../src/i18n/flags': flags,
    '../src/i18n/preference': { defaultPreferenceStore: prefs.store },
    '../src/i18n/provider': { useI18n: () => bindLocale(localeStore.getState().locale), useLocalePreferences: () => ({ state: localeStore.getState(), setLanguage: localeStore.setLanguage, setRegion: localeStore.setRegion }) },
  };
  const module = { exports: {} as { default?: () => Node | null } };
  runInNewContext(transpile('../app/onboarding.tsx'), { module, exports: module.exports, Date, Error, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    require: (name: string) => {
      if (!Object.hasOwn(modules, name)) throw new Error('Unexpected onboarding dependency: ' + name);
      return modules[name];
    } });
  return { render: () => { hooks.reset(); return module.exports.default!() as Node; }, routes, prefs, display, localeStore, saved, looks, ledger, haptics, focus, scrolls, bars,
    splash, timers, focused: () => focusEffect?.(), hardwareBack: () => hardwareBack?.() };
}
type View = ReturnType<typeof harness>;

/** The story's pager, wired to record where it is scrolled. */
function pager(view: View, root: Node) {
  const scroller = nodes(root).find(n => n.type === 'ScrollView' && n.props.horizontal)!;
  scroller.props.ref.current = { scrollTo: (to: unknown) => view.scrolls.push(to) };
  return scroller;
}
const progressOf = (root: Node) => nodes(root).find(n => n.props.accessibilityRole === 'progressbar')?.props.accessibilityLabel;
const scenes = (root: Node) => nodes(root).filter(n => /Art$/.test(String(n.type))).map(n => [n.type, n.props.play, n.props.still]);
const pages = (root: Node) => nodes(root).filter(n => n.type === 'ScrollView' && n.props.importantForAccessibility);
const headlines = (root: Node) => nodes(root).filter(n => n.type === 'AppText' && n.props.variant === 'display' && n.props.accessibilityRole === 'header');
const pill = (root: Node, label: string) => nodes(root).find(n => typeof n.type === 'function' && n.type.name === 'Pill' && n.props.label === label);
const skip = (root: Node) => nodes(root).find(n => n.type === 'PressFeedback' && [es.onboarding.skipLabel, 'Skip the rest of the setup'].includes(n.props.accessibilityLabel));
/** Through the story to «¿Dónde tenés tu plata?». */
function toStart(view: View, language: 'es' | 'en' = 'es') {
  for (const label of language === 'es' ? ['Siguiente', 'Siguiente', 'Continuar'] : ['Next', 'Next', 'Continue']) find(view.render(), 'ActionButton', label).props.onPress();
  return view.render();
}

test('25O1, a new installation: the story\'s three pages, stepped or swiped, then where the money is, its opening balance and the close; one account saved, the totals\' currency seeded', async () => {
  const view = harness({ reading: device('en-US', 'US') });
  let root = view.render();
  view.focused();
  assert.equal(view.routes.length, 0, 'eligible: no redirect');
  assert.equal(JSON.stringify(find(root, 'Stack.Screen').props.options), JSON.stringify({ headerShown: false, gestureEnabled: false }));
  // Page 1: its scene plays, the next ones wait; only the page in front exists for VoiceOver.
  assert.equal(progressOf(root), 'Page 1 of 3');
  assert.deepEqual(scenes(root), [['RecordArt', true, false], ['CommitmentsArt', false, false], ['AvailableArt', false, false]]);
  assert.deepEqual(headlines(root).map(node => textOf(node.props.children)), ['Log a purchase in seconds.', 'Cards and installments, month by month.', 'Know what you have left.']);
  assert.deepEqual(headlines(root).map(node => textOf(node.props.children.at(-1))), ['in seconds.', 'month by month.', 'what you have left.'], 'the emphasis is its own run');
  assert.equal(headlines(root)[0].props.children.at(-1).props.style.color, paletteModule.lightPalette.primary);
  // 25D1: a headline grows with Dynamic Type only as far as its longest word still fits the page (393 pt less 2 × 24) whole.
  for (const node of headlines(root)) {
    const scale = node.props.maxFontSizeMultiplier;
    assert.equal(node.props.children.at(-1).props.maxFontSizeMultiplier, scale, 'the emphasis grows with its line');
    assert.ok(scale >= 1 && scale <= 1.5 && geometry.widestWordEm([textOf(node.props.children)]) * 40 * geometry.WEIGHT_WIDTH.bold * scale <= 393 - 48);
  }
  assert.ok(headlines(root)[1].props.maxFontSizeMultiplier < 1.5, '«installments,» stops short of 60 pt');
  assert.deepEqual(pages(root).map(page => [page.props.accessibilityElementsHidden, page.props.importantForAccessibility]),
    [[false, 'auto'], [true, 'no-hide-descendants'], [true, 'no-hide-descendants']]);
  assert.ok(skip(root), 'Skip from the first page on');
  // Next steps the pager (animated) and plays page 2's scene; a swipe that settles on page 3 does the same.
  const scroller = pager(view, root);
  find(root, 'ActionButton', 'Next').props.onPress();
  root = view.render();
  assert.deepEqual([progressOf(root), plain(view.scrolls)], ['Page 2 of 3', [{ x: 393, animated: true }]]);
  assert.deepEqual(scenes(root).map(scene => scene[1]), [true, true, false]);
  scroller.props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 786, y: 0 } } });
  root = view.render();
  assert.deepEqual([progressOf(root), scenes(root).map(scene => scene[1]), view.scrolls.length], ['Page 3 of 3', [true, true, true], 1]);
  find(root, 'ActionButton', 'Continue').props.onPress();
  root = view.render();
  // «Where do you keep your money?»: the three presets, the region and language pills, and the way to restore a copy.
  assert.deepEqual(headers(root), ['Where do you keep your money?']);
  assert.ok(texts(root).includes('Your records stay on your iPhone. No sign-up or bank connection needed.'));
  assert.equal(progressOf(root), undefined, 'the progress belongs to the story');
  assert.equal(find(root, 'IconButton', 'Back').props.name, 'chevron-back');
  assert.deepEqual(nodes(root).filter(n => n.type === 'NavigationRow').map(row => [row.props.title, row.props.subtitle, row.props.leading.props.icon, row.props.leading.props.size]),
    [['Cash', 'What you carry', 'cash-outline', 48], ['Bank account', 'Salary, savings or debit', 'business-outline', 48],
      ['Digital wallet', 'The app you pay with', 'phone-portrait-outline', 48]]);
  const region = pill(root, 'Region: United States')!, language = pill(root, 'Language: English')!;
  assert.deepEqual([region.props.hint, language.props.hint], ['Opens the list of regions', 'Opens the list of languages']);
  assert.equal(find(region, 'InlineFlag').props.flag, flags.regionFlag('US'), 'the region carries its flag');
  assert.equal(nodes(language).some(n => n.type === 'InlineFlag'), false, 'a language never does');
  region.props.onPress();
  language.props.onPress();
  assert.deepEqual(view.routes, [{ push: '/region' }, { push: '/language' }], 'the pills open the Más choosers, pushed over the setup');
  find(root, 'NavigationRow', 'Bank account').props.onPress();
  root = view.render();
  // The bank's opening balance: the question, the region's currency on the chip, the amount, the preset's name.
  assert.deepEqual(headers(root), ['How much is in the bank?']);
  assert.ok(texts(root).includes('Not sure? Leave it at zero.'));
  assert.deepEqual([find(root, 'GlyphTile').props.icon, find(root, 'GlyphTile').props.large], ['business-outline', true]);
  assert.deepEqual([find(root, 'CurrencyChip').props.value, find(root, 'CurrencyChip').props.currencies], ['USD', domain.LEDGER_CURRENCIES], 'the United States suggests dollars; any of the gate\'s can be chosen');
  assert.deepEqual([find(root, 'AmountField').props.bare, find(root, 'AmountField').props.currency, find(root, 'AmountField').props.label], [true, 'USD', 'Opening balance']);
  assert.deepEqual([find(root, 'Field').props.label, find(root, 'Field').props.value, find(root, 'Field').props.maxLength], ['Name', 'Bank', 80]);
  find(root, 'AmountField').props.onChangeText('1.000,50');
  root = view.render();
  assert.equal(find(root, 'ActionButton', 'Create account').props.disabled, false);
  find(root, 'ActionButton', 'Create account').props.onPress();
  await settle();
  assert.equal(view.saved.length, 1);
  assert.deepEqual([view.saved[0].name, view.saved[0].currency, view.saved[0].openingMinor, view.saved[0].id], ['Bank', 'USD', 100050, 'first-account']);
  assert.deepEqual([view.looks[0].icon, view.looks[0].color], ['bank', appearance.DEFAULT_LOOK.color], 'the preset\'s icon, the default colour');
  assert.deepEqual(view.display, { currency: 'USD', mode: 'consolidated' }, 'the first account\'s currency is the first suggestion for the totals');
  assert.deepEqual(view.haptics, ['Success']);
  // The close: the account as a card on the field, no way back, Get started opens the app.
  root = view.render();
  assert.deepEqual(headers(root), ['You’re all set.']);
  assert.ok(texts(root).includes('You can log your first purchase now.'));
  assert.deepEqual(plain(find(root, 'AccountCard').props), { name: 'Bank', glyph: 'business-outline', minor: 100050, currency: 'USD' });
  assert.equal(find(root, 'SafeAreaView', undefined).props.edges.length, 2);
  assert.equal(nodes(root).some(n => n.type === 'IconButton') || !!skip(root), false, 'no back and no skip on the close');
  assert.equal(view.bars.at(-1), 'light', 'the field\'s own status bar');
  assert.equal(view.prefs.rows.has(ONBOARDING_KEY), false, 'not done until Get started');
  assert.equal(find(root, 'ActionButton', 'Get started').props.onField, true);
  find(root, 'ActionButton', 'Get started').props.onPress();
  assert.equal(view.prefs.rows.get(ONBOARDING_KEY), 'done');
  assert.equal(JSON.stringify(view.routes.at(-1)), JSON.stringify({ replace: '/' }));
  assert.equal(view.prefs.rows.has(LANGUAGE_PREFERENCE_KEY), false, 'language and region were never written: they still follow the device');
  assert.equal(view.prefs.rows.has(REGION_PREFERENCE_KEY), false);
});

test('Spain suggests EUR for the first account; the person may pick another currency on the chip, which is then the account\'s and the totals\'', async () => {
  const spain = harness({ reading: device('es-ES', 'ES'), released: RELEASED });
  let root = toStart(spain);
  assert.ok(pill(root, 'Región: España'));
  find(root, 'NavigationRow', 'Efectivo').props.onPress();
  root = spain.render();
  assert.deepEqual([headers(root), find(root, 'CurrencyChip').props.value, find(root, 'Field').props.value], [['¿Cuánto tenés en efectivo?'], 'EUR', 'Efectivo']);
  // A different currency than the region's: the account is in it, nothing coerces it back.
  find(root, 'CurrencyChip').props.onChange('USD');
  root = spain.render();
  assert.deepEqual([find(root, 'CurrencyChip').props.value, find(root, 'AmountField').props.currency], ['USD', 'USD']);
  find(root, 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  assert.deepEqual([spain.saved[0].name, spain.saved[0].currency, spain.saved[0].openingMinor], ['Efectivo', 'USD', 0], 'an empty balance is zero');
  assert.deepEqual(spain.display, { currency: 'USD', mode: 'consolidated' });
  const usa = harness({ reading: device('en-US', 'US'), released: RELEASED });
  find(toStart(usa, 'en'), 'NavigationRow', 'Cash').props.onPress();
  assert.equal(find(usa.render(), 'CurrencyChip').props.value, 'USD');
});

test('Omitir skips the rest of the setup from every step and keeps what was already saved: a language chosen in the pushed chooser survives the skip and a cold reopen', () => {
  const view = harness({ reading: device('en-US', 'US') });
  let root = view.render();
  // The Más chooser, opened from the language pill, saved Spanish (as Más does); back on the screen the copy is Spanish.
  assert.equal(view.localeStore.setLanguage('es'), true);
  root = view.render();
  assert.equal(textOf(headlines(root)[0].props.children), 'Anotá un gasto en segundos.');
  assert.equal(view.prefs.rows.get(LANGUAGE_PREFERENCE_KEY), 'es');
  const omitir = skip(root)!;
  assert.deepEqual([omitir.props.accessibilityLabel, omitir.props.accessibilityHint], ['Omitir el resto de la configuración', 'Conserva lo que ya elegiste y abre la app']);
  omitir.props.onPress();
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
  // From «¿Dónde tenés tu plata?» and from the opening balance too, with nothing saved.
  for (const preset of [null, 'Billetera virtual']) {
    const later = harness();
    root = toStart(later);
    if (preset) { find(root, 'NavigationRow', preset).props.onPress(); root = later.render(); }
    skip(root)!.props.onPress();
    assert.deepEqual([later.prefs.rows.get(ONBOARDING_KEY), later.saved.length, JSON.stringify(later.routes.at(-1))], ['done', 0, JSON.stringify({ replace: '/' })]);
  }
});

test('the opening balance keeps the New account form\'s rules: refused before sending (Error, still editable), failed after (Warning, the draft frozen for one retry), Success on the retry', async () => {
  const view = harness({ failSave: true });
  find(toStart(view), 'NavigationRow', 'Efectivo').props.onPress();
  let root = view.render();
  assert.equal(find(root, 'Field').props.value, 'Efectivo', 'the preset names the account');
  // 25Q4 review: an opening balance Crear cuenta lets through but cannot read is refused before anything is sent.
  find(root, 'AmountField').props.onChangeText('12abc');
  find(view.render(), 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  assert.deepEqual([view.haptics.splice(0).join(','), view.saved.length, find(view.render(), 'Field').props.editable], ['Error', 0, true]);
  find(view.render(), 'AmountField').props.onChangeText('');
  find(view.render(), 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, 'accounts.form.saveFailed', '25Q4: the form\'s own sentence, never the engine\'s text');
  assert.ok(find(root, 'ActionButton', 'Reintentar guardado'));
  assert.ok(texts(root).includes(es.accounts.form.retryNote));
  assert.deepEqual([find(root, 'Field').props.editable, find(root, 'AmountField').props.editable, find(root, 'CurrencyChip').props.disabled], [false, false, true],
    'the draft is locked to the pending submission');
  assert.equal(view.haptics.splice(0).join(','), 'Warning', '25Q4 review: sent with an unknown outcome, so Warning');
  // Its account cannot be swapped for another preset: Volver is disabled and does nothing.
  assert.equal(find(root, 'IconButton', 'Volver').props.disabled, true);
  find(root, 'IconButton', 'Volver').props.onPress();
  assert.deepEqual(headers(view.render()), ['¿Cuánto tenés en efectivo?']);
  assert.equal(view.prefs.rows.has(ONBOARDING_KEY), false, 'not done: nothing was saved');
  skip(view.render())!.props.onPress();
  assert.equal(view.prefs.rows.get(ONBOARDING_KEY), 'done');
  assert.deepEqual(view.display, { currency: null, mode: null });
  // The retry instead: the same account (its operation id) goes through, taps Success and reaches the close.
  const retry = harness({ failSave: true });
  find(toStart(retry), 'NavigationRow', 'Efectivo').props.onPress();
  find(retry.render(), 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  find(retry.render(), 'ActionButton', 'Reintentar guardado').props.onPress();
  await settle();
  assert.deepEqual([retry.haptics.join(','), retry.saved.length, retry.saved[0].id], ['Warning,Success', 1, 'first-account']);
  assert.deepEqual(headers(retry.render()), ['Todo listo.']);
});

test('back steps back, never out: page by page in the story, the story (still) from «¿Dónde tenés tu plata?», that screen from the opening balance; Android\'s back mirrors it and finishes on the close', async () => {
  const view = harness({ os: 'android' });
  let root = view.render();
  pager(view, root);
  assert.equal(view.hardwareBack(), true, 'always handled: the setup is never left by back');
  assert.deepEqual([progressOf(view.render()), view.routes, view.scrolls], ['Página 1 de 3', [], []]);
  find(view.render(), 'ActionButton', 'Siguiente').props.onPress();
  view.render();
  view.hardwareBack();
  root = view.render();
  assert.deepEqual([progressOf(root), plain(view.scrolls.at(-1))], ['Página 1 de 3', { x: 0, animated: true }]);
  root = toStart(view);
  view.hardwareBack();
  root = view.render();
  // Back in the story on its last page: every scene is drawn still, never replayed.
  assert.deepEqual([progressOf(root), plain(find(root, 'ScrollView', undefined).props.contentOffset)], ['Página 3 de 3', { x: 786, y: 0 }]);
  assert.deepEqual(scenes(root).map(scene => scene[2]), [true, true, true]);
  find(root, 'ActionButton', 'Continuar').props.onPress();
  find(view.render(), 'NavigationRow', 'Billetera virtual').props.onPress();
  root = view.render();
  assert.deepEqual([headers(root), find(root, 'Field').props.value], [['¿Cuánto tenés en la billetera?'], 'Billetera virtual']);
  find(root, 'IconButton', 'Volver').props.onPress();
  root = view.render();
  assert.deepEqual(headers(root), ['¿Dónde tenés tu plata?']);
  find(root, 'NavigationRow', 'Efectivo').props.onPress();
  root = view.render();
  assert.deepEqual([find(root, 'Field').props.value, find(root, 'GlyphTile').props.icon], ['Efectivo', 'cash-outline'], 'another preset renames the account');
  find(root, 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  assert.deepEqual(headers(view.render()), ['Todo listo.']);
  view.hardwareBack();
  assert.deepEqual([view.prefs.rows.get(ONBOARDING_KEY), JSON.stringify(view.routes.at(-1))], ['done', JSON.stringify({ replace: '/' })], 'from the close, back is Empezar');
  // Under Reduce Motion the pager jumps instead of sliding.
  const still = harness({ reduced: true });
  pager(still, still.render());
  find(still.render(), 'ActionButton', 'Siguiente').props.onPress();
  assert.deepEqual(plain(still.scrolls), [{ x: 393, animated: false }]);
});

test('«Restaurar una copia» opens the import; back with an account in the ledger, the setup ends there and never asks for a duplicate first account', () => {
  const view = harness();
  const root = toStart(view);
  const restore = nodes(root).find(n => n.type === 'PressFeedback' && n.props.accessibilityLabel === 'Restaurar una copia')!;
  assert.equal(restore.props.accessibilityHint, 'Trae tus datos desde una copia guardada');
  assert.equal(textOf(restore.props.children), '¿Venís de otro teléfono? Restaurar una copia');
  restore.props.onPress();
  assert.deepEqual(view.routes, [{ push: '/backup-import' }]);
  // Back with nothing imported: the setup goes on.
  view.focused();
  assert.deepEqual([view.routes.length, view.prefs.rows.has(ONBOARDING_KEY)], [1, false]);
  // The import added the copy's accounts while it was in front.
  view.ledger.accounts = [{ id: 'from-copy', name: 'Efectivo', currency: 'ARS', openingMinor: 0, createdAt }];
  view.render();
  view.focused();
  assert.deepEqual([view.prefs.rows.get(ONBOARDING_KEY), JSON.stringify(view.routes.at(-1)), view.saved.length], ['done', JSON.stringify({ replace: '/' }), 0]);
});

test('25O1: after a step or a page changes in place, VoiceOver is moved to the new title once it is up; the first page is left to VoiceOver itself', async () => {
  const view = harness();
  let root = view.render();
  pager(view, root);
  assert.deepEqual(view.timers.pending(), [], 'nothing moved on arrival');
  const attach = (root: Node, text: string, node: unknown) => nodes(root).find(n => n.type === 'AppText' && n.props.accessibilityRole === 'header' && textOf(n.props.children) === text)!.props.ref(node);
  find(root, 'ActionButton', 'Siguiente').props.onPress();
  root = view.render();
  attach(root, 'Tarjetas y cuotas, mes a mes.', { title: 'page 2' });
  assert.deepEqual(view.timers.pending(), [250]);
  view.timers.run();
  assert.deepEqual(view.focus, [[{ title: 'page 2' }, 'focus']]);
  find(view.render(), 'ActionButton', 'Siguiente').props.onPress();
  find(view.render(), 'ActionButton', 'Continuar').props.onPress();
  root = view.render();
  attach(root, '¿Dónde tenés tu plata?', { title: 'start' });
  view.timers.run();
  assert.deepEqual(view.focus.at(-1), [{ title: 'start' }, 'focus']);
  find(root, 'NavigationRow', 'Cuenta bancaria').props.onPress();
  root = view.render();
  attach(root, '¿Cuánto tenés en el banco?', { title: 'account' });
  view.timers.run();
  assert.deepEqual(view.focus.at(-1), [{ title: 'account' }, 'focus']);
  find(root, 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  view.render();
  const before = view.focus.length;
  view.timers.run();
  assert.equal(view.focus.length, before, 'a title not drawn yet (no native view) is never sent');
});

test('25O1: the close is focused too, and a second change inside the delay cancels the first move', async () => {
  const view = harness();
  const root = toStart(view);
  // Two steps inside the delay: only the latest title is focused.
  view.timers.run();
  find(root, 'NavigationRow', 'Efectivo').props.onPress();
  let next = view.render();
  find(next, 'IconButton', 'Volver').props.onPress();
  next = view.render();
  const title = nodes(next).find(n => n.props.accessibilityRole === 'header')!;
  title.props.ref({ title: 'start again' });
  const sent = view.focus.length;
  view.timers.run();
  assert.deepEqual(view.focus.slice(sent), [[{ title: 'start again' }, 'focus']]);
  find(next, 'NavigationRow', 'Efectivo').props.onPress();
  find(view.render(), 'ActionButton', 'Crear cuenta').props.onPress();
  await settle();
  const done = view.render();
  nodes(done).find(n => n.props.accessibilityRole === 'header')!.props.ref({ title: 'done' });
  view.timers.run();
  assert.deepEqual(view.focus.at(-1), [{ title: 'done' }, 'focus']);
});

test('an existing installation reached through a link or a restored navigation is sent straight to the app: nothing drawn, nothing written, the splash lifted', () => {
  const account: domain.Account = { id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 0, createdAt };
  const withData = harness({ accounts: [account] });
  assert.equal(withData.render(), null);
  withData.focused();
  assert.equal(JSON.stringify(withData.routes), JSON.stringify([{ replace: '/' }]), 'focus never finishes for someone the screen refused');
  assert.equal(withData.prefs.rows.size, 0, 'the route never marks or writes anything; the layout does the silent mark');
  assert.equal(withData.splash.hides, 1, 'nothing will draw here: the splash lifts at once');
  const withPreference = harness({ prefs: memory({ [REGION_PREFERENCE_KEY]: 'US' }) });
  assert.equal(withPreference.render(), null);
  assert.equal(JSON.stringify(withPreference.routes), JSON.stringify([{ replace: '/' }]));
  assert.equal(withPreference.prefs.rows.get(REGION_PREFERENCE_KEY), 'US', 'untouched');
  const done = harness({ prefs: memory({ [ONBOARDING_KEY]: 'done' }) });
  assert.equal(done.render(), null);
  assert.equal(JSON.stringify(done.routes), JSON.stringify([{ replace: '/' }]));
  // A new installation's splash lifts once its first page has drawn, once.
  const fresh = harness();
  const root = fresh.render();
  assert.equal(fresh.splash.hides, 0);
  root.props.onLayout();
  root.props.onLayout();
  assert.equal(fresh.splash.hides, 1);
});

test('the root layout sends a new installation to the setup, which arrives as a cut under the splash; the tabs are replaced into with a fade; no back swipe', () => {
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /onboardingDecision\(defaultPreferenceStore, snapshot\.accounts\.length > 0\)/);
  assert.match(layout, /if \(decision === 'existing'\) markOnboardingDone\(defaultPreferenceStore\)/);
  assert.ok(layout.includes("useEffect(() => { if (onboarding === 'new' && fontsLoaded) router.replace('/onboarding'); }, [onboarding, fontsLoaded]);"), '25Q4: once, with the stack');
  assert.match(layout, /<Stack\.Screen name="onboarding" options=\{\{ headerShown: false, gestureEnabled: false, animation: 'none' \}\} \/>/);
  assert.match(layout, /<Stack\.Screen name="\(tabs\)" options=\{\{ headerShown: false, animation: 'fade' \}\} \/>/);
});

// ---- the root layout ---------------------------------------------------------------------------------------

/** 25Q4: the root layout's Navigation with its hosts replaced by names. `ledger` and `fonts` are what the provider and
 * expo-font report on the next render; `prefs` is the key-value store the first-opening decision reads; `cache` is what
 * the app's cache folder lists (files and folders by name) and what was deleted from it; `splash` counts the lifts. */
function rootLayout({ prefs = memory() } = {}) {
  const state: unknown[] = [];
  const deps: unknown[][] = [];
  const routes: unknown[] = [];
  const timers = clock();
  const splash = { hides: 0 };
  let cursor = 0, effectCursor = 0, retries = 0;
  const ledger: { snapshot: { accounts: domain.Account[]; entries: domain.Entry[] } | null; error: string | null } = { snapshot: null, error: null };
  const fonts: { loaded: boolean; error: Error | null } = { loaded: false, error: null };
  const cache = { files: [] as string[], folders: [] as string[], deleted: [] as string[], listed: 0, unreadable: false };
  class File { name: string; constructor(name: string) { this.name = name; } delete() { cache.deleted.push(this.name); } }
  const folder = (name: string) => ({ name, delete: () => { cache.deleted.push(name + '/'); } });
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }]; },
    useMemo: (fn: () => unknown) => fn(),
    useEffect: (fn: () => void, next?: unknown[]) => { const index = effectCursor++; const previous = deps[index];
      if (!previous || !next || next.length !== previous.length || next.some((item, i) => !Object.is(item, previous[i]))) { deps[index] = next ?? []; fn(); } } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ...names('ActivityIndicator', 'View'), useWindowDimensions: () => ({ fontScale: 1, height: 852 }) },
    'react-native-gesture-handler': names('GestureHandlerRootView'),
    'react-native-safe-area-context': names('SafeAreaProvider', 'SafeAreaView'),
    'expo-router': { DarkTheme: { colors: {} }, DefaultTheme: { colors: {} }, Stack: { Screen: 'Stack.Screen' }, ThemeProvider: 'ThemeProvider', router: { replace: (to: unknown) => routes.push(to) } },
    'expo-status-bar': names('StatusBar'),
    'expo-splash-screen': { preventAutoHideAsync: async () => {}, hideAsync: async () => { splash.hides++; } },
    'expo-system-ui': { setBackgroundColorAsync: async () => {} },
    'expo-font': { useFonts: () => [fonts.loaded, fonts.error] },
    'expo-file-system': { File, Paths: { cache: { list: () => {
      cache.listed++;
      if (cache.unreadable) throw new Error('ENOENT');
      return [...cache.folders.map(folder), ...cache.files.map(name => new File(name))];
    } } } },
    '@expo/vector-icons/Ionicons': { font: {} },
    '@finanzapp/domain': domain,
    '../src/storage/LedgerProvider': { LedgerProvider: 'LedgerProvider', useLedger: () => ({ ...ledger, retry: () => { retries++; } }) },
    '../src/storage/database': { NEWER_SCHEMA_MESSAGE },
    '../src/ui/backup-file': backupFile,
    '../src/ui/category-hues': names('CategoryHuesProvider'),
    '../src/ui/display-currency-provider': names('DisplayCurrencyProvider'),
    '../src/fx/rates-provider': names('RatesProvider'),
    '../src/ui/components': names('ActionButton', 'AppText', 'ErrorMessage'),
    '../src/ui/geometry': { reviewSheetScrolls: () => false },
    '../src/ui/screen-failure': names('ScreenFailure'),
    '../src/ui/theme': { UIProvider: 'UIProvider', themePreferenceStore: () => {}, useReduceMotion: () => false,
      usePalette: () => ({ isDark: false, background: '#fff', surface: '#fff', primary: '#2557D6', text: '#000', secondary: '#666', line: '#ddd' }) },
    '../src/i18n/provider': { ...names('HeldCurrenciesProvider', 'I18nProvider'), useI18n: () => bindLocale('es-AR') },
    '../src/i18n/preference': { defaultPreferenceStore: prefs.store },
    '../src/ui/onboarding-flow': onboardingFlow,
  };
  const module = { exports: {} as { default?: () => Node } };
  runInNewContext(transpile('../app/_layout.tsx'), { module, exports: module.exports, Date, Error, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    require: (name: string) => {
      if (!Object.hasOwn(modules, name)) throw new Error('Unexpected layout dependency: ' + name);
      return modules[name];
    } });
  // Navigation is not exported: it is the function element inside the providers.
  const navigation = nodes(module.exports.default!()).find(node => typeof node.type === 'function' && node.type.name === 'Navigation')!.type as (props: object) => Node;
  return { render: () => { cursor = 0; effectCursor = 0; return navigation({}); }, ledger, fonts, routes, prefs, cache, splash, timers, retries: () => retries };
}

test('25Q4: at launch a ledger from a newer build is said as itself with no «Volver a intentar»; any other open failure keeps it', () => {
  const view = rootLayout();
  view.fonts.loaded = true;
  view.ledger.error = NEWER_SCHEMA_MESSAGE;
  let root = view.render();
  assert.equal(find(root, 'ErrorMessage').props.message, NEWER_SCHEMA_MESSAGE);
  assert.equal(nodes(root).some(node => node.type === 'ActionButton'), false, 'no retry can open a file a newer build wrote');
  assert.ok(view.splash.hides > 0, 'an error is shown, never held under the splash');
  view.ledger.error = es.errors.storage.openFailed;
  root = view.render();
  find(root, 'ActionButton', 'Volver a intentar').props.onPress();
  assert.equal(view.retries(), 1);
  view.ledger.error = es.errors.storage.migrationReferences;
  assert.ok(find(view.render(), 'ActionButton', 'Volver a intentar'), 'a migration rolled back whole may pass on another try');
});

test('25Q4: the root layout sends a new installation to the setup exactly once, after the stack exists; a banner later in that session never sends it again', () => {
  const view = rootLayout();
  view.ledger.snapshot = { accounts: [], entries: [] };
  view.render();
  view.render();
  assert.deepEqual(view.routes, [], 'decided, but the fonts still hold the stack back: nothing to replace yet');
  view.fonts.loaded = true;
  view.render();
  assert.deepEqual(view.routes, ['/onboarding']);
  for (const error of [es.errors.storage.refreshFailed, null, es.errors.storage.installmentsFailed]) {
    view.ledger.error = error;
    view.render();
  }
  assert.deepEqual(view.routes, ['/onboarding'], 'a banner never replaces the setup or a form over it');
  const existing = rootLayout();
  existing.ledger.snapshot = { accounts: [{ id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 0, createdAt }], entries: [] };
  existing.fonts.loaded = true;
  existing.render();
  existing.render();
  assert.deepEqual(existing.routes, []);
  assert.equal(existing.prefs.rows.get(ONBOARDING_KEY), 'done');
});

test('25O1: a new installation\'s splash waits for the first opening to draw (the timer only catches one that never does); anyone else\'s lifts once the app is ready', () => {
  const view = rootLayout();
  view.ledger.snapshot = { accounts: [], entries: [] };
  view.fonts.loaded = true;
  view.render();
  view.render();
  assert.deepEqual([view.routes, view.splash.hides, view.timers.pending()], [['/onboarding'], 0, [1500]], 'the setup lifts it on its first layout');
  view.timers.run();
  assert.equal(view.splash.hides, 1, 'the net, for a setup that never draws');
  const existing = rootLayout();
  existing.ledger.snapshot = { accounts: [{ id: 'a', name: 'Pesos', currency: 'ARS', openingMinor: 0, createdAt }], entries: [] };
  existing.render();
  assert.equal(existing.splash.hides, 0, 'not before the fonts');
  existing.fonts.loaded = true;
  existing.render();
  existing.render();
  assert.deepEqual([existing.splash.hides > 0, existing.timers.pending()], [true, []]);
});

test('25Q4: once the ledger has opened, the launch deletes the exports an ended process left in the cache, once per process; nothing else there, and never before', () => {
  const view = rootLayout();
  view.cache.files = ['FinanzApp-backup-2026-10-15-1432.json', 'finanzapp-piloto-1728900000000.json', 'fonts.json', 'ledger.sqlite'];
  view.cache.folders = ['FinanzApp-backup-2026-10-15-1500.json', 'ExponentExperienceData'];
  view.render();
  assert.equal(view.cache.listed, 0, 'not while the ledger opens');
  view.ledger.snapshot = { accounts: [], entries: [] };
  view.render();
  assert.deepEqual(view.cache.deleted, ['FinanzApp-backup-2026-10-15-1432.json', 'finanzapp-piloto-1728900000000.json'], 'only the app\'s own exports, never a folder');
  // An export started since lives in the same folder: no later render, write (a new snapshot), banner or font load sweeps it.
  view.cache.files = ['FinanzApp-backup-2026-10-16-0910.json'];
  view.fonts.loaded = true;
  view.render();
  view.ledger.snapshot = { accounts: [], entries: [] };
  view.ledger.error = es.errors.storage.refreshFailed;
  view.render();
  assert.equal(view.cache.listed, 1);
  assert.equal(view.cache.deleted.length, 2);
  // A cache that cannot be listed never stops the launch.
  const unreadable = rootLayout();
  unreadable.cache.unreadable = true;
  unreadable.ledger.snapshot = { accounts: [], entries: [] };
  unreadable.fonts.loaded = true;
  assert.equal(unreadable.render().type, 'ThemeProvider');
  assert.equal(unreadable.cache.listed, 1);
});

// ---- the illustrations -------------------------------------------------------------------------------------

/** `src/ui/onboarding-art.tsx` with its hosts replaced by names: Reanimated's assignments are kept as descriptors (what
 * would run, after how long), timers and animation frames wait for the test, and `time.now` is the clock `Date.now()`
 * reads. `mount` gives a component hooks of its own. */
function artHarness({ reduced = false, locale = 'es-AR' as AppLocale, day = '2026-10-16' } = {}) {
  const timers = clock();
  const frames: (() => void)[] = [];
  const time = { now: 0 };
  class HarnessDate extends Date { static now() { return time.now; } }
  let current = hookRuntime();
  const modules: Record<string, unknown> = {
    react: { useState: (initial: unknown) => current.useState(initial), useRef: (initial: unknown) => current.useRef(initial),
      useEffect: (fn: () => void | (() => void), deps?: unknown[]) => current.useEffect(fn, deps) },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': names('View'),
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View', createAnimatedComponent: (component: string) => 'Animated(' + component + ')' },
      useSharedValue: (initial: unknown) => current.useShared(initial), useAnimatedStyle: (fn: () => unknown) => fn, useAnimatedProps: (fn: () => unknown) => fn,
      withTiming: (to: unknown, config: Record<string, unknown> = {}) => ({ to, ...config }), withDelay: (delay: number, then: unknown) => ({ delay, then }),
      withSequence: (...steps: unknown[]) => ({ sequence: steps }) },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    '@finanzapp/domain': domain,
    './components': names('AppText', 'GlyphTile', 'Money', 'Surface'),
    // charts.tsx's shortMonth, the day of the 1st without the day.
    './charts': { shortMonth: (month: string, formatDate: (iso: string, style: 'day') => string) => formatDate(month + '-01', 'day').replace(/(^1\s+|\s+1$)/, '') },
    './geometry': geometry,
    './money-input': moneyInput,
    './motion': { duration: { data: 260, enter: 200 }, easeOut: { factory: () => (x: number) => x }, sheetTiming: (kind: string, isReduced: boolean) => ({ sheet: kind, reduced: isReduced }) },
    './onboarding-flow': onboardingFlow,
    './palette': paletteModule,
    './theme': { radius: { sheet: 24 }, useCurrentDay: () => day, usePalette: () => ({ ...paletteModule.lightPalette, isDark: false }), useReduceMotion: () => reduced },
    '../i18n/provider': { useI18n: () => bindLocale(locale) },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(transpile('../src/ui/onboarding-art.tsx'), { module, exports: module.exports, Date: HarnessDate, Error, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    requestAnimationFrame: (fn: () => void) => frames.push(fn), cancelAnimationFrame: () => {},
    require: (name: string) => {
      if (!Object.hasOwn(modules, name)) throw new Error('Unexpected illustration dependency: ' + name);
      return modules[name];
    } });
  /** A component with hooks of its own: `render(props?)` draws it again (with the last props by default). */
  const mount = (component: (props: any) => Node, props: Record<string, unknown>) => {
    const own = hookRuntime();
    let last = props;
    return { render: (next: Record<string, unknown> = last) => { last = next; current = own; own.reset(); return component(next); }, values: own.values };
  };
  /** A story scene without its box: the component the exported art wraps. */
  const scene = (name: string, props: Record<string, unknown>) => { const box = module.exports[name](props); return mount(box.props.children.type, box.props.children.props); };
  return { exports: module.exports, mount, scene, timers, frames, time };
}
/** The animated styles of a scene's Animated.Views, in tree order, each returning a plain object. */
const animated = (root: Node) => nodes(root).filter(n => n.type === 'Animated.View').map(n => [n.props.style].flat().find(style => typeof style === 'function'))
  .map(style => style && (() => plain(style())));

test('25O1: a scene is drawn at its own size and scaled down to its room, never up, hidden from VoiceOver; below 160 pt it is not drawn at all', () => {
  const art = artHarness();
  const box = art.exports.RecordArt({ play: false, still: false, currency: 'ARS' });
  const frame = art.mount(box.type, box.props);
  let root = frame.render();
  assert.deepEqual([root.props.accessibilityElementsHidden, root.props.importantForAccessibility, root.props.accessible], [true, 'no-hide-descendants', false]);
  assert.equal(nodes(root).length, 1, 'nothing before it is measured');
  const layout = (width: number, height: number) => { root.props.onLayout({ nativeEvent: { layout: { width, height } } }); root = frame.render(); };
  layout(375, 520);
  const inner = () => nodes(root).find(n => n.props.style?.transform)!;
  assert.deepEqual([inner().props.style.width, inner().props.style.height, inner().props.style.transform[0].scale], [345, 320, 327 / 345], 'a 375 pt iPhone: 24 pt sides');
  layout(430, 900);
  assert.equal(inner().props.style.transform[0].scale, 1, 'never up');
  layout(393, 150);
  assert.equal(nodes(root).length, 1, 'the largest text on a compact iPhone: no picture, the headline keeps the room');
});

test('25O1: the recording scene types the coffee key by key, the caret blinks twice and stays, then the movement rises in front of the two recorded before it', () => {
  const art = artHarness();
  const record = art.scene('RecordArt', { play: false, still: false, currency: 'ARS' });
  const typed = (root: Node) => textOf(nodes(root).find(n => n.type === 'AppText' && n.props.style?.fontSize === 56)!.props.children);
  let root = record.render();
  assert.equal(typed(root), '$ ', 'its page is not current yet: the symbol and the caret only');
  const [caretStyle, frontStyle, nearStyle, farStyle] = animated(root);
  assert.deepEqual([caretStyle!(), frontStyle!(), nearStyle!(), farStyle!()],
    [{ opacity: 1 }, { opacity: 0, transform: [{ translateY: 12 }] }, { opacity: 0 }, { opacity: 0 }], 'the rows wait for the typing');
  assert.deepEqual(art.timers.pending(), []);
  record.render({ play: true, still: false, currency: 'ARS' });
  assert.deepEqual(art.timers.pending(), [240, 330, 420, 510], 'one keystroke every 90 ms once the page has arrived');
  const shown: string[] = [];
  for (let key = 0; key < 4; key++) { art.timers.next(); shown.push(typed(record.render())); }
  assert.deepEqual(shown, ['$ 2', '$ 25', '$ 250', '$ 2.500']);
  // After the last key: the caret blinks twice a quarter-second apart and stays on; the movement rises, then the two behind it.
  const [caret, front, behind] = record.values();
  const off = { to: 0, duration: 0 }, on = { to: 1, duration: 0 };
  assert.deepEqual(caret.value, { delay: 760, then: { sequence: [off, { delay: 250, then: on }, { delay: 250, then: off }, { delay: 250, then: on }] } });
  assert.deepEqual([front.value.delay, front.value.then.to, front.value.then.duration], [630, 1, 260]);
  assert.deepEqual([behind.value.delay, behind.value.then.to], [750, 1]);
  root = record.render();
  const rows = nodes(root).filter(n => n.type === 'Animated.View').slice(1);
  assert.deepEqual(rows.map(row => [row.props.style].flat()[0]?.marginHorizontal ?? 0), [0, 10, 20], 'the two before it inset 10 and 20 pt');
  const { moneyText } = bindLocale('es-AR');
  assert.deepEqual(nodes(root).filter(n => typeof n.type === 'function' && n.type.name === 'ArtRow').map(row => [row.props.icon, row.props.title, row.props.detail, row.props.amount]),
    [['cafe-outline', 'Café', 'Hoy · Efectivo', moneyText(250_000, 'ARS')], ['cart-outline', 'Supermercado', 'Ayer', moneyText(1_894_000, 'ARS')],
      ['bus-outline', 'Transporte', 'Ayer', moneyText(120_000, 'ARS')]], 'the rows as the lists draw them, in the app\'s own format');
  assert.equal(art.frames.length, 0);
});

test('25O1: Reduce Motion, and a page seen before this mount, draw every scene final at once: no timer, no frame, the rows at rest, the bar filled, the check drawn', () => {
  for (const options of [{ reduced: true, still: false }, { reduced: false, still: true }]) {
    const art = artHarness({ reduced: options.reduced });
    const props = { play: true, still: options.still, currency: 'ARS' };
    const record = art.scene('RecordArt', props).render();
    assert.equal(textOf(nodes(record).find(n => n.props.style?.fontSize === 56)!.props.children), '$ 2.500');
    const [caret, front, near, far] = animated(record);
    assert.deepEqual([caret!(), front!(), near!(), far!()], [{ opacity: 1 }, { opacity: 1, transform: [{ translateY: 0 }] }, { opacity: 0.55 }, { opacity: 0.28 }]);
    const commitments = art.scene('CommitmentsArt', props).render();
    const marks = nodes(commitments).filter(n => typeof n.type === 'function' && n.type.name === 'Pop');
    assert.equal(marks.length, 4, 'three paid months and this one');
    assert.ok(marks.every(mark => mark.props.value.value === 1));
    assert.deepEqual((animated(commitments).at(-1) as () => unknown)(), { opacity: 1, transform: [{ translateY: 0 }] }, 'the pill');
    const available = art.scene('AvailableArt', props).render();
    assert.equal(find(available, 'Money').props.minor, onboardingFlow.sampleFigures('ARS').available);
    assert.deepEqual((animated(available)[0] as () => unknown)(), { width: '22%' });
    assert.deepEqual([art.timers.pending(), art.frames.length], [[], 0], JSON.stringify(options));
  }
  // The close's card under Reduce Motion: it only fades, and its check is drawn.
  const art = artHarness({ reduced: true });
  const card = art.mount(art.exports.AccountCard, { name: 'Efectivo', glyph: 'cash-outline', minor: 5_000_000, currency: 'ARS' });
  const root = card.render();
  const [rise, check] = card.values();
  assert.deepEqual([rise.value, check.value], [{ to: 1, sheet: 'sheet', reduced: true }, 1]);
  assert.deepEqual(plain(find(root, 'Animated(Path)').props.animatedProps()), { strokeDashoffset: 0 });
  assert.deepEqual(plain(([root.props.style].flat().find(style => typeof style === 'function') as () => { transform: unknown })().transform), [{ translateY: 0 }], 'no rise');
});

test('25O1: the commitments scene: six months from three before this one, the paid ones filled, this month\'s ring, the instalment due on the 12th; the marks appear in order, then the pill', () => {
  const art = artHarness();
  const commitments = art.scene('CommitmentsArt', { play: false, still: false, currency: 'ARS' });
  let root = commitments.render();
  assert.ok(texts(root).includes('Heladera · 6 cuotas') && texts(root).includes(bindLocale('es-AR').moneyText(1_840_000, 'ARS')) && texts(root).includes('por mes'));
  const months = nodes(root).filter(n => n.type === 'AppText' && n.props.variant === 'footnote');
  assert.deepEqual(months.map(n => textOf(n.props.children)), ['jul', 'ago', 'sep', 'oct', 'nov', 'dic']);
  assert.deepEqual(months.map(n => n.props.style?.color ?? null), [null, null, null, paletteModule.lightPalette.primary, null, null], 'this month in the brand colour');
  assert.ok(texts(root).includes('Cuota 4 de 6') && texts(root).includes('vence el 12 oct'));
  const marks = nodes(root).filter(n => typeof n.type === 'function' && n.type.name === 'Pop');
  assert.ok(marks.every(mark => mark.props.value.value === 0), 'nothing filled before its page is current');
  assert.deepEqual((animated(root).at(-1) as () => unknown)(), { opacity: 0, transform: [{ translateY: 6 }] }, 'the pill waits 6 pt low');
  commitments.render({ play: true, still: false, currency: 'ARS' });
  assert.deepEqual(marks.map(mark => mark.props.value.value.delay), [240, 300, 360, 420], '60 ms apart, left to right, this month last');
  assert.deepEqual([commitments.values().at(-1)!.value.delay, commitments.values().at(-1)!.value.then.to], [600, 1], 'then the pill');
  const english = artHarness({ locale: 'en-US' }).scene('CommitmentsArt', { play: true, still: true, currency: 'USD' }).render();
  assert.ok(texts(english).includes('Fridge · 6 installments') && texts(english).includes('Installment 4 of 6') && texts(english).includes('due Oct 12'));
  assert.ok(texts(english).includes(bindLocale('en-US').moneyText(18_400, 'USD')));
});

test('25O1: what-is-left counts up on the app\'s curve in whole units and ends exactly on the figure, while the spent share of the bar grows to 22 %', () => {
  const art = artHarness();
  const available = art.scene('AvailableArt', { play: false, still: false, currency: 'ARS' });
  const root = available.render();
  // Sized once for the figure it ends on (56 pt, or what fits the scene's 333 pt), so the count never changes its size.
  const size = geometry.fitFontSize(bindLocale('es-AR').moneyText(onboardingFlow.sampleFigures('ARS').available, 'ARS'), 333, 56, 28);
  assert.ok(size < 56 && size >= 28);
  assert.deepEqual([find(root, 'Money').props.minor, find(root, 'Money').props.size, find(root, 'Money').props.large], [0, size, true]);
  assert.ok(texts(root).includes('Disponible') && texts(root).includes('Gastado en octubre') && texts(root).includes(bindLocale('es-AR').moneyText(9_640_000, 'ARS')));
  assert.deepEqual((animated(root)[0] as () => unknown)(), { width: '0%' });
  available.render({ play: true, still: false, currency: 'ARS' });
  const [fill] = available.values();
  assert.deepEqual([fill.value.delay, fill.value.then.to, fill.value.then.duration], [240, 0.22, 400]);
  const target = onboardingFlow.sampleFigures('ARS').available;
  const shown: number[] = [];
  const sizes = new Set<number>();
  for (const now of [240, 500, 760]) {
    art.time.now = now;
    art.frames.shift()!();
    const money = find(available.render(), 'Money');
    shown.push(money.props.minor);
    sizes.add(money.props.size);
  }
  assert.deepEqual([shown, [...sizes]], [[0, onboardingFlow.countUp(target, 0.5, 2), target], [size]]);
  assert.equal(shown[1] % 100, 0, 'whole pesos while it counts');
  assert.equal(art.frames.length, 0, 'it stops on the figure');
});

test('25O1: the close\'s card: one VoiceOver element with the spoken balance, light ink in both themes, and a check that draws itself after the card starts to rise', () => {
  const art = artHarness();
  const mounted = art.mount(art.exports.AccountCard, { name: 'Efectivo', glyph: 'cash-outline', minor: 5_000_000, currency: 'ARS' });
  const card = mounted.render();
  const { spokenMoney } = bindLocale('es-AR');
  assert.deepEqual([card.type, card.props.accessible, card.props.accessibilityLabel], ['Animated.View', true, 'Efectivo, saldo ' + spokenMoney(5_000_000, 'ARS')]);
  assert.equal(card.props.accessibilityLabel, 'Efectivo, saldo 50000,00 pesos');
  assert.deepEqual([find(card, 'Money').props.size, find(card, 'Money').props.align, find(card, 'Money').props.color], [44, 'center', paletteModule.lightPalette.heroThumbInk]);
  assert.equal(find(card, 'Ionicons').props.color, paletteModule.lightPalette.primary, 'the light palette\'s ink on the sand-white card');
  const [rise, check] = mounted.values();
  assert.deepEqual(rise.value, { to: 1, sheet: 'sheet', reduced: false }, 'the sheet\'s own rise');
  assert.deepEqual([check.value.delay, check.value.then.to, check.value.then.duration], [160, 1, 360]);
  const path = find(card, 'Animated(Path)');
  assert.deepEqual([path.props.d, path.props.strokeWidth, path.props.strokeLinecap], ['M8 18 L14.5 24.5 L27 10.5', 4, 'round']);
  check.value = 0;
  assert.deepEqual(plain(path.props.animatedProps()), { strokeDashoffset: 28.5 }, 'hidden by its own length');
  check.value = 1;
  assert.deepEqual(plain(path.props.animatedProps()), { strokeDashoffset: 0 }, 'drawn');
});

// ---- the currency chip -------------------------------------------------------------------------------------

/** `src/ui/currency-chip.tsx` with its hosts replaced by names; the currency list is the real one. */
function chipHarness(locale: AppLocale = 'es-AR') {
  const hooks = hookRuntime();
  const dismissed: number[] = [];
  const modules: Record<string, unknown> = {
    react: { useState: hooks.useState, useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Keyboard: { dismiss: () => dismissed.push(1) } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': names('AppText', 'PressFeedback'),
    './currencies': currencies,
    './form-controls': names('CurrencySheet'),
    './marks': names('InlineFlag'),
    './theme': { radius: { chip: 14 }, usePalette: () => ({ ...paletteModule.lightPalette, isDark: false }) },
    '../i18n/flags': flags,
    '../i18n/provider': { useI18n: () => bindLocale(locale) },
  };
  const module = { exports: {} as { CurrencyChip?: (props: Record<string, unknown>) => Node } };
  runInNewContext(transpile('../src/ui/currency-chip.tsx'), { module, exports: module.exports, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected chip dependency: ' + name);
    return modules[name];
  } });
  return { render: (props: Record<string, unknown>) => { hooks.reset(); return module.exports.CurrencyChip!(props); }, dismissed };
}

test('25O1: the currency chip shows the issuer\'s flag beside the code, names the currency for VoiceOver, and opens the forms\' searchable sheet over the gate', () => {
  const chip = chipHarness();
  const changes: string[] = [];
  const props = { value: 'ARS', onChange: (currency: string) => changes.push(currency), currencies: domain.LEDGER_CURRENCIES };
  let root = chip.render(props);
  const button = find(root, 'PressFeedback');
  assert.deepEqual([button.props.accessibilityRole, button.props.accessibilityLabel, button.props.disabled], ['button', 'Moneda: Pesos argentinos', false]);
  assert.deepEqual([find(button, 'InlineFlag').props.flag, textOf(find(button, 'AppText').props.children), find(button, 'Ionicons').props.name],
    [flags.currencyFlag('ARS'), 'ARS', 'chevron-down']);
  let sheet = find(root, 'CurrencySheet');
  assert.deepEqual([sheet.props.visible, sheet.props.value, sheet.props.searchable, sheet.props.title, sheet.props.options.length],
    [false, 'ARS', true, 'Elegir moneda', domain.LEDGER_CURRENCIES.length], 'every currency the gate offers, searchable');
  assert.deepEqual(sheet.props.options.slice(0, 2).map((option: { code: string }) => option.code), ['ARS', 'USD']);
  button.props.onPress();
  root = chip.render(props);
  sheet = find(root, 'CurrencySheet');
  assert.deepEqual([sheet.props.visible, chip.dismissed.length], [true, 1], 'the keyboard goes down and the sheet comes up');
  sheet.props.onChange('USD');
  assert.deepEqual([changes, find(chip.render(props), 'CurrencySheet').props.visible], [['USD'], false]);
  // A supranational currency has no issuer to show; a locked draft's chip cannot be opened.
  const franc = chip.render({ ...props, value: 'XOF', disabled: true });
  assert.equal(find(franc, 'InlineFlag').props.flag, null);
  assert.deepEqual([find(franc, 'PressFeedback').props.disabled, find(franc, 'PressFeedback').props.style.opacity], [true, 0.5]);
});
