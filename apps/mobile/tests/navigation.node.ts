import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { tabHostOptions, tabScreenOptions } from '../src/ui/navigation.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let locale: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(locale) };

// A configuration regression guard over the actual layout module, NOT an iOS
// render/gesture test. It catches overrides that accidentally bring back the
// fade + native-detachment combination. Physical stress testing is still needed.
const source = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;

const pushed: unknown[] = [];
function renderLayout(background: string) {
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const Tabs = Object.assign(() => null, { Screen: 'TabScreen' });
  const module = { exports: {} as { default?: () => any } };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { Tabs, router: { push: (to: unknown) => pushed.push(to) } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    // 24UX6C: the layout draws no header buttons any more, so it needs no component module: an IconButton coming back fails here.
    '../../src/ui/floating-tab-bar': { FloatingTabBar: 'FloatingTabBar' },
    '../../src/ui/navigation': { tabHostOptions, tabScreenOptions },
    '../../src/ui/motion': { selectionHaptic: () => {} },
    '../../src/ui/theme': { usePalette: () => ({ background, primary: '#5B87FF', text: '#FFFFFF', tertiary: '#7C7C84', secondary: '#A6B0C0', surface: '#151A22', line: '#2B3544' }) },
  };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected layout dependency: ' + name);
    return modules[name];
  } });
  return module.exports.default!();
}

const ROOTS = 'index,activity,reports,settings';

for (const [theme, background] of [['light', '#F5F6F8'], ['dark', '#080B10']]) {
  test('tab layout keeps all four scenes opaque, mounted and unfrozen in ' + theme, () => {
    const { props } = renderLayout(background);
    assert.equal(props.detachInactiveScreens, false);
    const screens = props.children;
    assert.equal(screens.map((screen: any) => screen.props.name).join(','), ROOTS);
    assert.equal(screens.length, 4);
    for (const screen of screens) {
      const options = { ...props.screenOptions, ...screen.props.options };
      assert.equal(options.animation, 'none', screen.props.name);
      assert.equal(options.lazy, false, screen.props.name);
      assert.equal(options.freezeOnBlur, false, screen.props.name);
      assert.equal(options.transitionSpec, undefined, screen.props.name);
      assert.equal(options.sceneStyleInterpolator, undefined, screen.props.name);
      assert.equal(options.sceneStyle.backgroundColor, background, screen.props.name);
      assert.equal(options.sceneStyle.opacity, undefined, screen.props.name);
    }
    // 24UX6A: the bar is the app's own dock, handed the navigator's props untouched; its colours are its own
    // (tests/floating-tab-bar.node.ts), so no stock tint or style is left to disagree with it.
    const bar = props.tabBar({ state: 'state', descriptors: 'descriptors', navigation: 'navigation', insets: 'insets' });
    assert.equal(bar.type, 'FloatingTabBar');
    assert.deepEqual({ ...bar.props }, { state: 'state', descriptors: 'descriptors', navigation: 'navigation', insets: 'insets' });
    for (const key of ['tabBarActiveTintColor', 'tabBarInactiveTintColor', 'tabBarStyle', 'tabBarLabelStyle', 'tabBarBackground']) assert.equal(props.screenOptions[key], undefined, key);
  });
}

test('24UX6A: four sections, no Assistant tab, Tarjetas stays in Más, and Inicio has no header of its own', () => {
  const { props } = renderLayout('#F5F6F8');
  const screens = props.children;
  const byName = Object.fromEntries(screens.map((screen: any) => [screen.props.name, screen.props.options]));
  assert.equal(screens.map((screen: any) => screen.props.options.title).join(','), 'Inicio,Movimientos,Reportes,Más');
  assert.equal(byName.assistant, undefined, 'the Assistant is a root-stack screen opened from the capture hub, never a tab');
  assert.equal(screens.some((screen: any) => screen.props.name === 'assistant'), false);
  assert.equal(byName.cards, undefined, 'Tarjetas is no longer a tab');
  assert.equal(JSON.stringify(screens).includes('Agregar tarjeta'), false, 'the card header action moved with the screen');
  assert.equal(JSON.stringify(screens).includes('tabBarBackground'), false, 'no stock bar background: the dock draws its own material');
  assert.equal(JSON.stringify(screens).includes('assistant-preview'), false);
  // Each root has a filled glyph when focused and an outline otherwise (the dock is icon-only, so the glyph carries it).
  const glyphs: Record<string, [string, string]> = {
    index: ['home', 'home-outline'], activity: ['receipt', 'receipt-outline'], reports: ['pie-chart', 'pie-chart-outline'],
    settings: ['ellipsis-horizontal-circle', 'ellipsis-horizontal-circle-outline'],
  };
  for (const [name, [filled, outline]] of Object.entries(glyphs)) {
    assert.equal(byName[name].tabBarIcon({ color: '#000', size: 24, focused: true }).props.name, filled, name);
    assert.equal(byName[name].tabBarIcon({ color: '#000', size: 24, focused: false }).props.name, outline, name);
  }
  // Inicio draws no root title (the selected tab names it) and keeps its accounts shortcut in its own field
  // (tests/spending-home.node.ts); the other roots keep their headers. 24UX6C: Movimientos lost its header «+»:
  // the dock's «+» records from every tab (tests/floating-tab-bar.node.ts), so no root carries a second record button.
  assert.equal(byName.index.headerShown, false);
  assert.equal(byName.index.headerRight, undefined);
  for (const name of ['activity', 'reports', 'settings']) assert.notEqual(byName[name].headerShown, false, name + ' keeps its title');
  for (const name of ['index', 'activity', 'reports', 'settings']) assert.equal(byName[name].headerRight, undefined, name + ' has no header action');
  assert.equal(JSON.stringify(screens).includes('/new-entry'), false);
  assert.equal(pushed.length, 0, 'rendering the layout navigates nowhere');
});

test('24UX6A: the Assistant moved to the root stack, pushed like any detail screen', () => {
  assert.equal(existsSync(new URL('../app/(tabs)/assistant.tsx', import.meta.url)), false, 'no tab route file left behind');
  assert.equal(existsSync(new URL('../app/assistant.tsx', import.meta.url)), true);
  const root = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const registrations = root.match(/<Stack\.Screen\s+name="assistant"[^>]*\/>/g) ?? [];
  assert.equal(registrations.length, 1, 'the root stack registers the assistant screen exactly once');
  assert.match(registrations[0], /title:\s*t\('assistant\.title'\)/);
  assert.doesNotMatch(registrations[0], /presentation/, 'a push, not a modal: native back returns to the tab it came from');
  assert.doesNotMatch(registrations[0], /headerShown:\s*false/);
});

test('23.1B1: tab labels follow the language; routes and order never change', () => {
  const labels = () => {
    const { props } = renderLayout('#F5F6F8');
    return props.children.map((screen: any) => screen.props.name + '=' + screen.props.options.title).join(',');
  };
  assert.equal(labels(), 'index=Inicio,activity=Movimientos,reports=Reportes,settings=Más');
  locale = 'en-AR';
  try {
    assert.equal(labels(), 'index=Home,activity=Activity,reports=Reports,settings=More');
    // 24UX6C: no header button left to translate (the dock «+» carries its own label, tests/floating-tab-bar.node.ts).
    const { props } = renderLayout('#F5F6F8');
    for (const screen of props.children) assert.equal(screen.props.options.headerRight, undefined, screen.props.name);
  } finally { locale = 'es-AR'; }
});
