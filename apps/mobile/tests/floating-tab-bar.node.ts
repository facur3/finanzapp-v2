import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
import * as dockGeometry from '../src/ui/dock-geometry.ts';
import { darkPalette, lightPalette } from '../src/ui/palette.ts';
let locale: AppLocale = 'es-AR';
// An iPhone in English running FinanzApp in Spanish: VoiceOver must switch voices for the labels.
let device: string | null = 'en';
const i18nProvider = { useI18n: () => bindLocale(locale, 'none', device) };

// Producto 24UX6A (amended): the dock over the actual module, with host components as descriptors. Four icon-only tabs on
// a pine pill and, beside it, the «+» that opens the capture hub (an action, never a tab). It pins the navigator contract
// (events, selection, labels), the accessibility shape and the geometry. How the glass and the solid pine look, the
// safe-area clearance, the Large Content Viewer and VoiceOver's reading on an iPhone remain device acceptance items.
const light = { ...lightPalette, isDark: false };
const dark = { ...darkPalette, isDark: true };

function harness(palette: typeof light = light, material: 'glass' | 'opaque' = 'opaque', os: 'ios' | 'android' = 'ios') {
  const source = readFileSync(new URL('../src/ui/floating-tab-bar.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const modules: Record<string, any> = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Platform: { OS: os }, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, Text: 'Text', View: 'View' },
    '../i18n/provider': i18nProvider,
    './capture-hub': { CaptureAction: 'CaptureAction' },
    './components': { AppText: 'AppText', PressFeedback: 'PressFeedback' },
    './dock-geometry': dockGeometry,
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

const names = ['index', 'activity', 'reports', 'settings'];
const titles = ['Inicio', 'Movimientos', 'Reportes', 'Más'];
function navigator(index: number, prevent = false, badges: Record<string, unknown> = {}) {
  const events: { type: string; target: string; canPreventDefault?: boolean }[] = [];
  const navigated: unknown[][] = [];
  const routes = names.map(name => ({ key: name + '-key', name, params: name === 'reports' ? { currency: 'USD' } : undefined }));
  const icons: unknown[] = [];
  const descriptors = Object.fromEntries(routes.map((route, i) => [route.key, { options: { title: titles[i], tabBarBadge: badges[route.name],
    tabBarIcon: (props: unknown) => { icons.push({ name: route.name, ...(props as object) }); return { type: 'Ionicons', props }; } } }]));
  const navigation = {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { events.push(event); return { defaultPrevented: prevent }; },
    navigate: (...args: unknown[]) => { navigated.push(args); },
  };
  return { props: { state: { index, routes }, descriptors, navigation, insets: { top: 47, bottom: 34, left: 0, right: 0 } }, events, navigated, icons };
}
const childrenOf = (node: any): any[] => ([] as any[]).concat(node.props.children ?? []).filter(Boolean);
function dockOf(bar: any) {
  const [surface, plus, ...rest] = childrenOf(bar);
  const row = surface.props.children;
  return { surface, plus, rest, row, items: childrenOf(row).map((item: any) => ({ element: item, rendered: item.type(item.props) })) };
}
const flatten = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flatten)
  : value.props ? [value, ...flatten(value.props.children)] : [];

test('24UX6A: one tab list with the four destinations in order, each read as the stock bar reads it and saying whether it is selected', () => {
  const { FloatingTabBar } = harness();
  const nav = navigator(0);
  const { row, items } = dockOf(FloatingTabBar(nav.props));
  assert.equal(row.props.accessibilityRole, 'tablist', 'the stock bar\'s container role');
  assert.equal(items.length, 4, 'exactly four destinations: no Assistant tab, and the «+» is not one');
  // iOS: React Native's `tab` role maps to no trait, so the tab is a button whose name says it is a tab and where it sits.
  assert.equal(items.map((item: any) => item.rendered.props.accessibilityLabel).join(' | '),
    'Inicio, pestaña, 1 de 4 | Movimientos, pestaña, 2 de 4 | Reportes, pestaña, 3 de 4 | Más, pestaña, 4 de 4');
  const android = dockOf(harness(light, 'opaque', 'android').FloatingTabBar(navigator(0).props)).items;
  assert.equal(android.map((item: any) => item.rendered.props.accessibilityRole + ':' + item.rendered.props.accessibilityLabel).join(','),
    titles.map(title => 'tab:' + title).join(','), 'elsewhere the tab role and the plain name');
  for (const [index, { rendered }] of items.entries()) {
    assert.equal(rendered.type, 'PressFeedback');
    assert.equal(rendered.props.accessibilityRole, 'button');
    assert.equal(rendered.props.accessibilityState.selected, index === 0);
    assert.equal(JSON.stringify([rendered.props.accessibilityShowsLargeContentViewer, rendered.props.accessibilityLargeContentTitle]),
      JSON.stringify([true, titles[index]]), 'a long press shows the plain name large, as the system tab bar does');
    assert.equal(rendered.props.accessibilityLanguage, 'es', 'the labels are read in the interface language, not the device\'s');
    assert.ok(rendered.props.style.minHeight >= 44, 'a full target');
    assert.equal(rendered.props.containerStyle.flex, 1, 'four equal slots');
  }
  locale = 'en-US';
  try {
    const english = dockOf(FloatingTabBar(nav.props)).items[0].rendered.props;
    assert.equal(english.accessibilityLanguage, undefined, 'same language as the device: nothing to switch');
    assert.equal(english.accessibilityLabel, 'Inicio, tab, 1 of 4', 'the position in the interface language');
  } finally { locale = 'es-AR'; }
});

test('24UX6A: the tabs are icon-only to the eye; the name exists only for assistive technology', () => {
  const { FloatingTabBar } = harness();
  const { items } = dockOf(FloatingTabBar(navigator(1).props));
  for (const [index, { rendered }] of items.entries()) {
    const drawn = flatten(rendered.props.children);
    assert.equal(drawn.filter(node => node.type === 'AppText').length, 0, 'no visible label in the tab');
    assert.equal(drawn.some(node => node.type === 'Text'), false);
    assert.equal(JSON.stringify(drawn).includes(titles[index]), false, 'the name is not drawn anywhere inside the tab');
    assert.equal(rendered.props.accessibilityLargeContentTitle, titles[index], 'but VoiceOver and the Large Content Viewer have it');
    const capsule = rendered.props.children;
    assert.equal(capsule.type, 'View');
    assert.equal(capsule.props.accessible, false);
    assert.equal(capsule.props.importantForAccessibility, 'no-hide-descendants', 'the glyph is decoration: the tab speaks once, through its label');
    assert.equal(childrenOf(capsule).map((child: any) => child.type).join(','), 'Ionicons', 'the glyph the layout supplied, inside the capsule (no badge without one)');
  }
});

test('24UX6A: the selected tab is marked twice (filled glyph and pine capsule), never by colour alone, in light and dark', () => {
  for (const palette of [light, dark]) {
    const { FloatingTabBar } = harness(palette);
    const nav = navigator(2);
    const { items } = dockOf(FloatingTabBar(nav.props));
    assert.equal(JSON.stringify(nav.icons.map((icon: any) => [icon.name, icon.focused, icon.color, icon.size])),
      JSON.stringify(names.map((name, index) => [name, index === 2, index === 2 ? palette.dockActiveInk : palette.dockInk, 24])),
      'focused → the filled glyph in the active ink; the others the dock ink');
    for (const [index, { rendered }] of items.entries()) {
      const capsule = rendered.props.children;
      assert.equal(([] as any[]).concat(capsule.props.style).filter(Boolean).find((style: any) => style.backgroundColor)?.backgroundColor,
        index === 2 ? palette.dockActive : undefined, 'only the selected tab sits on the lighter pine capsule');
    }
    assert.notEqual(palette.dockActive, palette.dock, 'the capsule is a visible step on the pill');
  }
});

test('24UX6A: the «+» is a sibling of the pill, outside the tab list, drawn once and never counted as a tab', () => {
  const { FloatingTabBar } = harness();
  const nav = navigator(0);
  const bar = FloatingTabBar(nav.props);
  const { surface, plus, rest, row, items } = dockOf(bar);
  assert.equal(surface.type, 'ControlSurface');
  assert.equal(plus.type, 'CaptureAction', 'the capture hub\'s «+» beside the pill');
  assert.equal(rest.length, 0, 'the dock is exactly the pill and the «+»');
  assert.equal(flatten(bar).filter(node => node.type === 'CaptureAction').length, 1, 'one «+»');
  assert.equal(flatten(surface).some(node => node.type === 'CaptureAction'), false, 'not inside the pill');
  assert.equal(flatten(row).some(node => node.type === 'CaptureAction'), false, 'not inside the tab list');
  assert.equal(items.length, 4, 'four tabs with the «+» on screen');
  assert.equal(Object.keys(plus.props).length, 0, 'no selection, index or route: an action, not a destination');
});

test('24UX6A: a tap sends the stock tabPress, then navigates only to another tab that nobody prevented; a long press sends tabLongPress', () => {
  const { FloatingTabBar } = harness();
  const nav = navigator(0);
  const { items } = dockOf(FloatingTabBar(nav.props));
  items[2].rendered.props.onPress();
  assert.equal(JSON.stringify(nav.events.at(-1)), JSON.stringify({ type: 'tabPress', target: 'reports-key', canPreventDefault: true }), 'the layout\'s listeners (the selection tick) still hear it');
  assert.equal(JSON.stringify(nav.navigated), JSON.stringify([['reports', { currency: 'USD' }]]), 'the route and its params, as the stock bar navigates');
  items[0].rendered.props.onPress();
  assert.equal(nav.events.at(-1)?.target, 'index-key');
  assert.equal(nav.navigated.length, 1, 'the selected tab is not pushed again');
  items[1].rendered.props.onLongPress();
  assert.equal(JSON.stringify(nav.events.at(-1)), JSON.stringify({ type: 'tabLongPress', target: 'activity-key' }));
  const blocked = navigator(0, true);
  dockOf(FloatingTabBar(blocked.props)).items[3].rendered.props.onPress();
  assert.equal(JSON.stringify(blocked.events.at(-1)), JSON.stringify({ type: 'tabPress', target: 'settings-key', canPreventDefault: true }));
  assert.equal(blocked.navigated.length, 0, 'a prevented press stays where it is');
});

test('24UX6A, 25UX1: the dock floats over the roots with no ground of its own, inside the safe area; the pill is the control material tinted pine', () => {
  const exports = harness(light, 'glass');
  const { DOCK, tabBarBottomGap, dockMaterial } = exports;
  assert.equal(DOCK, dockGeometry.DOCK, 'the geometry is the pure module\'s, re-exported');
  assert.equal(tabBarBottomGap, dockGeometry.tabBarBottomGap);
  const nav = navigator(0);
  const bar = exports.FloatingTabBar(nav.props);
  assert.equal(bar.type, 'View');
  // 25UX1 (owner): no rectangle behind the dock. It is pinned to the window's bottom, out of the layout, paints nothing, and
  // lets touches in its empty margins through; the roots keep their last row clear of it (`dockClearance`).
  assert.equal(bar.props.style.backgroundColor, undefined, 'no strip of canvas behind the pill and the «+»');
  assert.deepEqual([bar.props.style.position, bar.props.style.left, bar.props.style.right, bar.props.style.bottom], ['absolute', 0, 0, 0], 'pinned to the window\'s bottom edge, full width');
  assert.equal(bar.props.pointerEvents, 'box-none', 'the margins around and between the controls never swallow a touch');
  assert.equal(bar.props.style.flexDirection, 'row', 'the pill and the «+» side by side');
  assert.equal(bar.props.style.gap, DOCK.gap);
  assert.equal(bar.props.style.paddingTop, DOCK.top);
  assert.equal(bar.props.style.paddingBottom, 20, 'above the home indicator');
  assert.equal(bar.props.style.paddingBottom, tabBarBottomGap(34));
  assert.equal(bar.props.style.paddingHorizontal, DOCK.side);
  const landscape = navigator(0);
  landscape.props.insets = { top: 0, bottom: 21, left: 47, right: 47 };
  const turned = exports.FloatingTabBar(landscape.props);
  assert.equal(turned.props.style.paddingHorizontal, DOCK.side + 47, 'clear of the sensor housing in landscape');
  assert.equal(turned.props.style.paddingBottom, 10);
  const { surface } = dockOf(bar);
  assert.equal(surface.props.material, 'glass', 'Liquid Glass where the running iOS draws it');
  assert.equal(surface.props.tint, light.dock, 'tinted pine');
  assert.equal(JSON.stringify(surface.props.opaque), JSON.stringify(dockMaterial(light)), 'and the solid pine pill for Reduce Transparency, older iOS and Android');
  assert.equal(surface.props.style.borderRadius, DOCK.height / 2, 'a capsule');
  assert.equal(surface.props.style.minHeight, DOCK.height, 'a floor, not a fixed height');
  assert.equal(surface.props.style.flex, 1, 'the pill takes the width the «+» leaves');
  assert.equal(harness(light, 'opaque').FloatingTabBar(nav.props).props.children[0].props.material, 'opaque');
  for (const palette of [light, dark]) {
    const solid = dockMaterial(palette);
    assert.equal(solid.backgroundColor, palette.dock, 'the solid pill is the pine dock fill');
    assert.equal(solid.borderWidth, 0.5, 'with a hairline edge');
    assert.ok(solid.borderColor);
  }
  assert.ok(dockMaterial(light).shadowOpacity > 0, 'a soft lift on the light ground');
  assert.equal(dockMaterial(dark).shadowOpacity, undefined, 'on black the hairline edge separates it');
});

test('24UX6A: the dock geometry is pure numbers shared by the dock and the capture hub', () => {
  const { DOCK, tabBarBottomGap, dockSide, plusFrame, hubInset } = dockGeometry;
  assert.equal(JSON.stringify(DOCK), JSON.stringify({ height: 60, side: 16, top: 8, gap: 10, plus: 60 }));
  assert.equal(tabBarBottomGap(34), 20, 'in the upper part of the home indicator\'s safe area');
  assert.equal(tabBarBottomGap(21), 10, 'a small safe area still keeps a margin');
  assert.equal(tabBarBottomGap(0), 10, 'an iPhone without a home indicator');
  assert.equal(dockSide({ left: 0, right: 0 }), 16);
  assert.equal(dockSide({ left: 47, right: 0 }), 63, 'the larger landscape inset');
  assert.equal(dockSide({ left: 0, right: 59 }), 75);
  const portrait = { bottom: 34, left: 0, right: 0 };
  assert.equal(JSON.stringify(plusFrame(portrait)), JSON.stringify({ right: 16, bottom: 20, size: 60 }), 'the hub\'s close control sits exactly on the «+»');
  assert.equal(JSON.stringify(plusFrame({ bottom: 0, left: 0, right: 0 })), JSON.stringify({ right: 16, bottom: 10, size: 60 }));
  assert.equal(JSON.stringify(plusFrame({ bottom: 21, left: 47, right: 47 })), JSON.stringify({ right: 63, bottom: 10, size: 60 }));
  assert.equal(JSON.stringify(hubInset(portrait)), JSON.stringify({ bottom: 20 + 60 + 12, side: 12 }), 'the hub card floats 12 pt above the dock');
  assert.equal(JSON.stringify(hubInset({ bottom: 21, left: 47, right: 47 })), JSON.stringify({ bottom: 82, side: 59 }));
  // At 375 pt the pill (375 − 2·16 − 10 − 60 = 273 pt, less its 6 pt padding each side) leaves each of four tabs ≥ 64 pt.
  assert.ok((375 - 2 * DOCK.side - DOCK.gap - DOCK.plus - 12) / 4 >= 44, 'every tab keeps a full target at 375 pt');
});

test('25UX1: the roots clear the floating dock by its exact height, inside the tabs only', () => {
  // The dock's top edge above the window's bottom: its air, its 60 pt and the 8 pt above it.
  assert.equal(dockGeometry.dockClearance(34), 20 + 60 + 8, 'an iPhone with a home indicator');
  assert.equal(dockGeometry.dockClearance(21), 10 + 60 + 8, 'landscape');
  assert.equal(dockGeometry.dockClearance(0), 10 + 60 + 8, 'no home indicator');
  for (const inset of [0, 21, 34, 48]) {
    assert.equal(dockGeometry.dockClearance(inset), dockGeometry.DOCK.top + dockGeometry.DOCK.height + dockGeometry.tabBarBottomGap(inset));
    // The hub floats 12 pt above the dock's pill: the clearance never reaches into it.
    assert.ok(dockGeometry.hubInset({ bottom: inset, left: 0, right: 0 }).bottom > dockGeometry.dockClearance(inset) - dockGeometry.DOCK.top);
  }
  const source = readFileSync(new URL('../src/ui/dock-clearance.ts', import.meta.url), 'utf8');
  assert.match(source, /BottomTabBarHeightContext/, 'a scene of the tab navigator is what has a clearance');
  assert.match(source, /inTabs \? dockClearance\(insets\.bottom\) : 0/, 'a pushed screen, a modal or the hub keeps 0');
  // 25OPS1: how the roots take it (bottom padding on every platform, no native content inset) is pinned in
  // tests/dock-clearance.node.ts.
  assert.match(source, /if \(!clearance\) return \{ extraPadding: 0, indicator: undefined \}/, 'off the tabs: nothing');
});

test('25A-03: Más shows the pending count as a small neutral badge on its glyph, said after the tab\'s name; zero draws nothing', () => {
  for (const palette of [light, dark]) {
    const { FloatingTabBar } = harness(palette);
    const { items } = dockOf(FloatingTabBar(navigator(0, false, { settings: 3 }).props));
    const more = items[3].rendered;
    assert.equal(more.props.accessibilityLabel, 'Más, pestaña, 4 de 4, 3 para revisar');
    const [glyph, badge] = childrenOf(more.props.children);
    assert.equal(glyph.type, 'Ionicons');
    assert.equal(badge.type, 'View');
    const style = Object.assign({}, ...[badge.props.style].flat());
    assert.deepEqual([style.backgroundColor, badge.props.children.props.style[1].color], [palette.dockActiveInk, palette.dock], 'white with graphite: never lime, never red');
    assert.notEqual(style.backgroundColor, palette.accent);
    assert.equal(badge.props.children.props.children, 3);
    assert.equal(badge.props.children.props.accessibilityLanguage, 'es');
    for (const other of items.slice(0, 3)) assert.equal(childrenOf(other.rendered.props.children).length, 1, 'only the tab that carries a count');
  }
  const many = dockOf(harness().FloatingTabBar(navigator(0, false, { settings: 140 }).props)).items[3].rendered;
  assert.equal(childrenOf(many.props.children)[1].props.children.props.children, '99+');
  const none = dockOf(harness().FloatingTabBar(navigator(0, false, { settings: 0 }).props)).items[3].rendered;
  assert.equal(childrenOf(none.props.children).length, 1);
  assert.equal(none.props.accessibilityLabel, 'Más, pestaña, 4 de 4');
});
