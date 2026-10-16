import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';

// Producto 25Q3: the two framework fallbacks, as source with their hosts replaced by descriptors. Whether iOS draws them
// clear of the status bar and the dock, and what VoiceOver focuses, are device checks.
type Node = { type: unknown; props: Record<string, any> };
function load(file: string, locale: AppLocale = 'es-AR') {
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  const routed: { replace: unknown[]; push: unknown[] } = { replace: [], push: [] };
  const i18n = { useI18n: () => bindLocale(locale) };
  const components = { ActionButton: 'ActionButton', EmptyState: 'EmptyState', Screen: 'Screen' };
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { Stack: { Screen: 'Stack.Screen' }, router: { replace: (to: unknown) => routed.replace.push(to), push: (to: unknown) => routed.push.push(to) } },
    '../i18n/provider': i18n, '../src/i18n/provider': i18n,
    './components': components, '../src/ui/components': components,
    './theme': { usePalette: () => ({ background: '#F3EFE6' }) },
  };
  const module = { exports: {} as Record<string, (props: any) => Node> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected ' + file + ' dependency: ' + name);
    return modules[name];
  } });
  return { exports: module.exports, routed };
}
const nodes = (value: any): Node[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes)
  : !value.props ? [] : [value, ...nodes(value.props.children), ...nodes(value.props.action)];
const find = (root: Node, type: string) => nodes(root).find(node => node.type === type)!;

test('25Q3: a screen that fails to draw shows a calm card in the app\'s words, with «Volver a intentar» that draws it again, and never the error', () => {
  let retries = 0;
  const { exports } = load('src/ui/screen-failure.tsx');
  const root = exports.ScreenFailure({ retry: async () => { retries++; }, error: new Error('probe Visa Galicia 1234,50') });
  assert.equal(JSON.stringify([root.type, root.props.edges, root.props.style.backgroundColor]), JSON.stringify(['SafeAreaView', ['top'], '#F3EFE6']),
    'clear of the status bar on a header-less tab, nothing extra under a header');
  const card = find(root, 'EmptyState');
  assert.deepEqual([card.props.title, card.props.detail], ['No pudimos mostrar esta pantalla', 'Lo que ya guardaste sigue ahí. Podés volver atrás o abrir otra pestaña.']);
  const retry = find(root, 'ActionButton');
  assert.equal(retry.props.label, 'Volver a intentar');
  retry.props.onPress();
  assert.equal(retries, 1);
  assert.equal(JSON.stringify(root).includes('1234'), false, 'the error\'s text never reaches the screen');
  assert.doesNotMatch(readFileSync(new URL('../src/ui/screen-failure.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), /error\.|\.stack/);
  const english = find(load('src/ui/screen-failure.tsx', 'en-US').exports.ScreenFailure({ retry: async () => {}, error: new Error('x') }), 'EmptyState');
  assert.equal(english.props.title, 'We couldn’t show this screen');
});

test('25Q3: an unknown link opens a screen in the app\'s language whose one action replaces it with Inicio', () => {
  const { exports, routed } = load('app/+not-found.tsx');
  const root = exports.default({});
  assert.equal(find(root, 'Stack.Screen').props.options.title, 'Pantalla no encontrada');
  const card = find(root, 'EmptyState');
  assert.deepEqual([card.props.title, card.props.detail], ['No encontramos esa pantalla', 'El enlace no lleva a ninguna pantalla de FinanzApp.']);
  const home = find(root, 'ActionButton');
  assert.equal(home.props.label, 'Ir a Inicio');
  home.props.onPress();
  assert.equal(JSON.stringify(routed), JSON.stringify({ replace: ['/'], push: [] }), 'a cold start has no back stack: replace, never push');
  assert.equal(find(load('app/+not-found.tsx', 'en-US').exports.default({}), 'EmptyState').props.title, 'We couldn’t find that screen');
});

test('25Q3: the root stack hands ScreenFailure to every route, through a prop the installed expo-router still reads', () => {
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /import \{ ScreenFailure \} from '\.\.\/src\/ui\/screen-failure';/);
  assert.match(layout, /<Stack unstable_screenErrorBoundary=\{ScreenFailure\} /);
  // An Expo upgrade that renames this unstable prop fails here instead of silently dropping the fallback.
  const require = createRequire(import.meta.url);
  const installed = readFileSync(require.resolve('expo-router/build/layouts/withLayoutContext.js'), 'utf8');
  assert.match(installed, /unstable_screenErrorBoundary/);
});

// Codex (PR #116): does a tab that throws take the dock with it? expo-router wraps each leaf route, inside its navigator,
// in its own `Try` boundary (useScreens.js, pinned below); the tabs layout, which draws the dock, is never wrapped. This
// renders that shape with expo-router's real `Try` and React's real error handling.
const requireHere = createRequire(import.meta.url);
const React = requireHere('react');
const TestRenderer = requireHere('react-test-renderer');
function routerTry() {
  const module = { exports: {} as { Try: any } };
  const stubs: Record<string, unknown> = { react: React, 'react/jsx-runtime': requireHere('react/jsx-runtime'),
    './Splash': { hideAsync: () => {} }, '../rsc/router/errors': { MetroServerError: class extends Error {} } };
  runInNewContext(readFileSync(requireHere.resolve('expo-router/build/views/Try.js'), 'utf8'), { module, exports: module.exports, __DEV__: false, Object, Promise,
    require: (name: string) => { if (!Object.hasOwn(stubs, name)) throw new Error('Unexpected Try dependency: ' + name); return stubs[name]; } });
  return module.exports.Try;
}

test('25Q3 (Codex, PR #116): a tab that throws is replaced inside the tabs layout, the dock stays and retry draws the tab again; around the layout it would take the dock', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const Try = routerTry();
  const h = React.createElement;
  let broken = true;
  const ReportsTab = () => { if (broken) throw new Error('probe 1234,50'); return h('Text', null, 'Reportes'); };
  const Fallback = ({ retry }: { retry: () => Promise<void> }) => h('ScreenFailure', { retry });
  const tabsLayout = (scene: unknown) => h('TabsLayout', null, h('Scene', null, scene), h('Dock'));
  const quiet = console.error;
  console.error = () => {}; // React reports every caught render error; expected here.
  try {
    let root: any;
    await TestRenderer.act(async () => { root = TestRenderer.create(tabsLayout(h(Try, { catch: Fallback }, h(ReportsTab)))); });
    assert.equal(root.root.findAllByType('Dock').length, 1, 'the dock stays beside the failed tab');
    assert.equal(root.root.findAllByType('ScreenFailure').length, 1);
    assert.equal(JSON.stringify(root.toJSON()).includes('1234'), false);
    broken = false;
    // Not awaited inside act: Try's retry resolves in its setState callback, which runs when act flushes.
    await TestRenderer.act(async () => { void root.root.findByType('ScreenFailure').props.retry(); });
    assert.equal(root.root.findAllByType('ScreenFailure').length, 0, 'retry draws the tab again');
    assert.ok(JSON.stringify(root.toJSON()).includes('Reportes'));
    // The shape the finding feared: a boundary around the layout replaces the dock with the tab.
    broken = true;
    let whole: any;
    await TestRenderer.act(async () => { whole = TestRenderer.create(h(Try, { catch: Fallback }, tabsLayout(h(ReportsTab)))); });
    assert.equal(whole.root.findAllByType('Dock').length, 0);
    await TestRenderer.act(async () => { root.unmount(); whole.unmount(); });
  } finally { console.error = quiet; }
});

test('25Q3 (Codex, PR #116): expo-router wraps leaf routes only, inside their navigator; the root stack and the tabs both hand the fallback on', () => {
  const screens = readFileSync(requireHere.resolve('expo-router/build/useScreens.js'), 'utf8');
  assert.match(screens, /const isRouteType = value\.type === 'route';/);
  assert.match(screens, /ScreenErrorBoundary && isRouteType \? \(\(0, jsx_runtime_1\.jsx\)\(Try_1\.Try, \{ catch: ScreenErrorBoundary, children: screenComponent \}\)\)/,
    'a layout route (the tabs) is never wrapped by the inherited boundary; each of its screens is');
  const layoutContext = readFileSync(requireHere.resolve('expo-router/build/layouts/withLayoutContext.js'), 'utf8');
  assert.match(layoutContext, /ScreenErrorBoundaryContext, \{ value: unstable_screenErrorBoundary, children: content \}/);
  const tabs = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /<Tabs unstable_screenErrorBoundary=\{ScreenFailure\} /);
});
