import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
let locale: AppLocale = 'es-AR';
// An iPhone in English running FinanzApp in Spanish: VoiceOver must switch voices for the labels.
let device: string | null = 'en';
const i18nProvider = { useI18n: () => bindLocale(locale, 'none', device) };

// Producto 24UX6A: the floating tab bar over the actual module, with host components as descriptors. It pins the
// navigator contract (events, selection, labels), the accessibility shape and the geometry. How the capsule and its glass
// look, the safe-area clearance and VoiceOver's reading on an iPhone remain device acceptance items.
const light = { isDark: false, background: '#F5F6F8', surface: '#FFFFFF', primary: '#2557D6', secondary: '#5E6470', tertiary: '#8A8F99' };
const dark = { ...light, isDark: true, background: '#000000', surface: '#15171C', primary: '#6E93FF', secondary: '#A0A0A8' };

function harness(palette = light, material: 'glass' | 'opaque' = 'opaque') {
  const source = readFileSync(new URL('../src/ui/floating-tab-bar.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: Record<string, any> = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View' },
    '../i18n/provider': i18nProvider,
    './components': { AppText: 'AppText', PressFeedback: 'PressFeedback' },
    './material': { ControlSurface: 'ControlSurface', useMaterial: () => material },
    './theme': { usePalette: () => palette },
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected floating-tab-bar dependency: ' + name);
    return modules[name];
  } });
  return module.exports;
}

const names = ['index', 'activity', 'assistant', 'reports', 'settings'];
const titles = ['Inicio', 'Movimientos', 'Asistente', 'Reportes', 'Más'];
function navigator(index: number, prevent = false) {
  const events: { type: string; target: string; canPreventDefault?: boolean }[] = [];
  const navigated: unknown[][] = [];
  const routes = names.map(name => ({ key: name + '-key', name, params: name === 'reports' ? { currency: 'USD' } : undefined }));
  const icons: unknown[] = [];
  const descriptors = Object.fromEntries(routes.map((route, i) => [route.key, { options: { title: titles[i],
    tabBarIcon: (props: unknown) => { icons.push({ name: route.name, ...(props as object) }); return { type: 'Ionicons', props }; } } }]));
  const navigation = {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { events.push(event); return { defaultPrevented: prevent }; },
    navigate: (...args: unknown[]) => { navigated.push(args); },
  };
  return { props: { state: { index, routes }, descriptors, navigation, insets: { top: 47, bottom: 34, left: 0, right: 0 } }, events, navigated, icons };
}
function tabsOf(bar: any) {
  const surface = bar.props.children;
  const row = surface.props.children;
  return { surface, row, items: row.props.children.map((item: any) => ({ element: item, rendered: item.type(item.props) })) };
}
const flatten = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flatten)
  : value.props ? [value, ...flatten(value.props.children)] : [];

test('24UX6A: one tab bar with the five destinations in order, each a tab that says whether it is selected', () => {
  const { FloatingTabBar } = harness();
  const nav = navigator(0);
  const { row, items } = tabsOf(FloatingTabBar(nav.props));
  assert.equal(row.props.accessibilityRole, 'tabbar', 'VoiceOver reads one tab bar');
  assert.equal(items.length, 5, 'exactly five destinations');
  assert.equal(items.map((item: any) => item.rendered.props.accessibilityLabel).join(','), titles.join(','));
  for (const [index, { rendered }] of items.entries()) {
    assert.equal(rendered.type, 'PressFeedback');
    assert.equal(rendered.props.accessibilityRole, 'tab');
    assert.equal(rendered.props.accessibilityState.selected, index === 0);
    assert.equal(rendered.props.accessibilityLanguage, 'es', 'the labels are read in the interface language, not the device\'s');
    assert.ok(rendered.props.style.minHeight >= 44, 'a full target');
    assert.equal(rendered.props.containerStyle.flex, 1, 'five equal slots');
    const label = flatten(rendered).find(node => node.type === 'AppText');
    assert.equal(label.props.children, titles[index], 'the label is always drawn: no icon to guess');
    assert.equal(label.props.maxFontSizeMultiplier, 1.3, 'grows with Dynamic Type up to the compact-control cap');
    assert.equal(label.props.numberOfLines, 1);
    assert.equal(label.props.accessible, false, 'the tab speaks once, through its label');
  }
  locale = 'en-US';
  try { assert.equal(tabsOf(FloatingTabBar(nav.props)).items[0].rendered.props.accessibilityLanguage, undefined, 'same language as the device: nothing to switch'); }
  finally { locale = 'es-AR'; }
});

test('24UX6A: the selected tab is cobalt over a neutral lens; the others keep the secondary ink, in light and dark', () => {
  for (const palette of [light, dark]) {
    const { FloatingTabBar, tabLensColor } = harness(palette);
    const nav = navigator(2);
    const { items } = tabsOf(FloatingTabBar(nav.props));
    assert.equal(JSON.stringify(nav.icons.map((icon: any) => [icon.name, icon.focused, icon.color, icon.size])),
      JSON.stringify(names.map((name, index) => [name, index === 2, index === 2 ? palette.primary : palette.secondary, 24])));
    for (const [index, { rendered }] of items.entries()) {
      const lens = rendered.props.children;
      const label = flatten(rendered).find(node => node.type === 'AppText');
      assert.equal(label.props.style.color, index === 2 ? palette.primary : palette.secondary);
      assert.equal(label.props.style.fontWeight, index === 2 ? '600' : '500');
      assert.equal(lens.props.style[1]?.backgroundColor, index === 2 ? tabLensColor(palette) : undefined, 'only the selected tab has a lens');
      assert.equal(lens.props.children[0].props.importantForAccessibility, 'no-hide-descendants', 'the glyph is decoration');
    }
    assert.doesNotMatch(tabLensColor(palette), /2557D6|6E93FF/i, 'the lens is a state, not cobalt');
  }
});

test('24UX6A: a tap sends the stock tabPress, then navigates only to another tab that nobody prevented; a long press sends tabLongPress', () => {
  const { FloatingTabBar } = harness();
  const nav = navigator(0);
  const { items } = tabsOf(FloatingTabBar(nav.props));
  items[3].rendered.props.onPress();
  assert.equal(JSON.stringify(nav.events.at(-1)), JSON.stringify({ type: 'tabPress', target: 'reports-key', canPreventDefault: true }), 'the layout\'s listeners (the selection tick) still hear it');
  assert.equal(JSON.stringify(nav.navigated), JSON.stringify([['reports', { currency: 'USD' }]]), 'the route and its params, as the stock bar navigates');
  items[0].rendered.props.onPress();
  assert.equal(nav.events.at(-1)?.target, 'index-key');
  assert.equal(nav.navigated.length, 1, 'the selected tab is not pushed again');
  items[1].rendered.props.onLongPress();
  assert.equal(JSON.stringify(nav.events.at(-1)), JSON.stringify({ type: 'tabLongPress', target: 'activity-key' }));
  const blocked = navigator(0, true);
  tabsOf(FloatingTabBar(blocked.props)).items[4].rendered.props.onPress();
  assert.equal(blocked.navigated.length, 0, 'a prevented press stays where it is');
});

test('24UX6A: the capsule floats inside the safe area on the screen\'s ground, in the app\'s one control material', () => {
  const exports = harness(light, 'glass');
  const { TAB_BAR, tabBarBottomGap, tabBarMaterial } = exports;
  const nav = navigator(0);
  const bar = exports.FloatingTabBar(nav.props);
  assert.equal(bar.type, 'View');
  assert.equal(bar.props.style.backgroundColor, light.background, 'the ground under the capsule is the screen\'s own');
  assert.equal(bar.props.style.position, undefined, 'in the layout, never absolute: every screen ends above it');
  assert.equal(bar.props.style.paddingBottom, 20, 'above the home indicator');
  assert.equal(bar.props.style.paddingHorizontal, TAB_BAR.side);
  assert.equal(tabBarBottomGap(34), 20);
  assert.equal(tabBarBottomGap(21), 10, 'a small safe area still keeps a margin');
  assert.equal(tabBarBottomGap(0), 10, 'an iPhone without a home indicator');
  const landscape = navigator(0);
  landscape.props.insets = { top: 0, bottom: 21, left: 47, right: 47 };
  assert.equal(exports.FloatingTabBar(landscape.props).props.style.paddingHorizontal, TAB_BAR.side + 47, 'clear of the sensor housing in landscape');
  const { surface } = tabsOf(bar);
  assert.equal(surface.type, 'ControlSurface');
  assert.equal(surface.props.material, 'glass', 'Liquid Glass where the running iOS draws it');
  assert.equal(JSON.stringify(surface.props.opaque), JSON.stringify(tabBarMaterial(light)), 'and the opaque surface for Reduce Transparency, older iOS and Android');
  assert.equal(surface.props.style.borderRadius, TAB_BAR.height / 2, 'a capsule');
  assert.equal(surface.props.style.minHeight, TAB_BAR.height, 'a floor, not a fixed height: larger text may grow it');
  assert.equal(tabBarMaterial(light).backgroundColor, light.surface);
  assert.ok(tabBarMaterial(light).shadowOpacity! > 0, 'a soft lift on the light ground');
  assert.equal(tabBarMaterial(dark).shadowOpacity, undefined, 'on black the hairline edge separates it');
  assert.equal(tabBarMaterial(dark).borderWidth, 0.5);
});
