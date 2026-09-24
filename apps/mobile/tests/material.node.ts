import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { MATERIAL_LABELS, composerBottomPadding, drawReason, glassDisabledBy, loadReason, materialFor, subscribeReduceTransparency } from '../src/ui/material-policy.ts';
import { translator } from '../src/i18n/messages.ts';
import * as i18nFormat from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
const i18nProvider = { useI18n: () => bindLocale('es-AR') };

// Producto 22: the material decision (native Liquid Glass or the opaque
// control surface) and the adapter that is the only door to
// expo-glass-effect, in Node. The rule under test: a decorative material can
// never close the app, so the module is not even evaluated on a path that
// could end in a native fatalError. How the glass looks on iOS 26 and how
// Reduce Transparency behaves on the device still need the iPhone.
const devClient = { platform: 'ios', expoGo: false, disabled: false, nativeRegistered: true };
const drawable = { liquidGlass: true, apiAvailable: true, reduceTransparency: false };

test('the module may be loaded only outside Expo Go, on iOS, with the switch off and the view registered in the running binary', () => {
  assert.equal(loadReason(devClient), null);
  assert.equal(loadReason({ ...devClient, expoGo: true }), 'expo-go', 'Expo Go always keeps the opaque material');
  assert.equal(loadReason({ ...devClient, disabled: true }), 'disabled', 'the kill switch wins over everything');
  assert.equal(loadReason({ ...devClient, expoGo: true, disabled: true }), 'disabled');
  assert.equal(loadReason({ ...devClient, platform: 'android' }), 'platform');
  assert.equal(loadReason({ ...devClient, platform: 'web' }), 'platform');
  assert.equal(loadReason({ ...devClient, nativeRegistered: false }), 'not-registered', 'a binary without the view would fatalError on mount');
});

test('glass is drawn only with Liquid Glass available, the API present and Reduce Transparency off', () => {
  assert.equal(drawReason(drawable), 'glass');
  assert.equal(drawReason({ ...drawable, liquidGlass: false }), 'unavailable', 'older iOS, or a build without the Liquid Glass SDK');
  assert.equal(drawReason({ ...drawable, apiAvailable: false }), 'api', 'iOS 26 betas without the API must not crash');
  assert.equal(drawReason({ ...drawable, reduceTransparency: true }), 'reduce-transparency', 'the accessibility setting wins');
  assert.deepEqual(materialFor(devClient, drawable), { material: 'glass', reason: 'glass' });
  assert.deepEqual(materialFor({ ...devClient, expoGo: true }, drawable), { material: 'opaque', reason: 'expo-go' });
  assert.deepEqual(materialFor(devClient, null), { material: 'opaque', reason: 'unavailable' }, 'a module that failed to load draws nothing');
  assert.deepEqual(materialFor(devClient, { ...drawable, reduceTransparency: true }), { material: 'opaque', reason: 'reduce-transparency' });
  for (const reason of Object.keys(MATERIAL_LABELS)) assert.ok(MATERIAL_LABELS[reason as keyof typeof MATERIAL_LABELS].length > 0, reason);
  assert.equal(glassDisabledBy({ EXPO_PUBLIC_DISABLE_GLASS: '1' }), true);
  assert.equal(glassDisabledBy({ EXPO_PUBLIC_DISABLE_GLASS: '0' }), false);
  assert.equal(glassDisabledBy({}), false);
});

test('23.1B2: every material label is a catalogue key, read in Spanish as it always was and in English; the reason ids stay the same', () => {
  const es = translator('es'), en = translator('en');
  assert.equal(Object.keys(MATERIAL_LABELS).join(','), 'disabled,expo-go,platform,not-registered,unavailable,api,reduce-transparency,glass');
  assert.equal(Object.values(MATERIAL_LABELS).map(key => es(key)).join('|'), ['Material opaco (desactivado)', 'Material opaco (Expo Go)', 'Material opaco',
    'Material opaco (sin módulo nativo)', 'Material opaco (iOS sin Liquid Glass)', 'Material opaco (API no disponible)', 'Material opaco (Reducir transparencia)', 'Liquid Glass'].join('|'));
  for (const key of Object.values(MATERIAL_LABELS)) {
    assert.notEqual(en(key), key, key + ' resolves in English');
    assert.ok(key === 'settings.material.glass' || /^Opaque material/.test(en(key)), en(key));
  }
});

test('the Reduce Transparency subscription feature-detects the API and never throws: missing, rejecting or throwing keeps opaque', async () => {
  const seen: boolean[] = [];
  assert.doesNotThrow(() => subscribeReduceTransparency(undefined, value => seen.push(value))());
  assert.doesNotThrow(() => subscribeReduceTransparency({} as never, value => seen.push(value))());
  assert.doesNotThrow(() => subscribeReduceTransparency({ isReduceTransparencyEnabled: () => { throw new Error('no native'); }, addEventListener: () => { throw new Error('no native'); } }, value => seen.push(value))());
  subscribeReduceTransparency({ isReduceTransparencyEnabled: () => Promise.reject(new Error('unsupported')) }, value => seen.push(value));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(seen.length, 0, 'nothing reported: the default (opaque) stands');
  const listener: { fn: ((value: boolean) => void) | null } = { fn: null };
  let removed = 0;
  const off = subscribeReduceTransparency({ isReduceTransparencyEnabled: () => Promise.resolve(false),
    addEventListener: (_event, fn) => { listener.fn = fn; return { remove: () => { removed += 1; } }; } }, value => seen.push(value));
  await new Promise(resolve => setTimeout(resolve, 0));
  listener.fn!(true);
  assert.deepEqual(seen, [false, true], 'the live setting flows through');
  off();
  listener.fn!(false);
  assert.deepEqual(seen, [false, true], 'nothing after unsubscribe');
  assert.equal(removed, 1);
});

test('the composer padding clears the keyboard or the safe area, minus what sits below the screen, never negative', () => {
  assert.equal(composerBottomPadding(0, 34, 0), 34, 'stack, keyboard down: the home indicator');
  assert.equal(composerBottomPadding(336, 34, 0), 336, 'stack, keyboard up');
  assert.equal(composerBottomPadding(0, 34, 83), 0, 'tab root, keyboard down: the tab bar already covers the inset');
  assert.equal(composerBottomPadding(336, 34, 83), 253, 'tab root, keyboard up: up to the keyboard, not above an empty strip');
  assert.equal(composerBottomPadding(20, 34, 83), 0);
});

type Load = { platform?: string; expoGo?: { expoGoConfig?: unknown; appOwnership?: string | null } | null; env?: Record<string, string>;
  registry?: { modules?: Record<string, unknown>; getViewConfig?: (m: string, v?: string) => unknown } | null;
  liquidGlass?: boolean; apiAvailable?: boolean; throwing?: boolean; reduceTransparency?: boolean; broken?: boolean };

/** The adapter with React Native, expo-constants and the module registry replaced; `required` counts evaluations of expo-glass-effect. */
function loadMaterial({ platform = 'ios', expoGo = { expoGoConfig: null, appOwnership: null }, env = {}, registry = { modules: { ExpoGlassEffect: {} }, getViewConfig: () => ({ validAttributes: {} }) },
  liquidGlass = true, apiAvailable = true, throwing = false, reduceTransparency = false, broken = false }: Load = {}) {
  const source = readFileSync(new URL('../src/ui/material.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  let required = 0;
  const policy = { drawReason, glassDisabledBy, loadReason, materialFor };
  const modules: Record<string, unknown> = {
    '../i18n/format': i18nFormat, '../src/i18n/format': i18nFormat, '../../src/i18n/format': i18nFormat, '../i18n/provider': i18nProvider, '../src/i18n/provider': i18nProvider, '../../src/i18n/provider': i18nProvider,
    react: { useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Platform: { OS: platform } },
    'expo-constants': { __esModule: true, default: expoGo },
    './material-policy': policy,
    './theme': { useReduceTransparency: () => reduceTransparency },
  };
  const glassModule = { GlassView: 'GlassView',
    isLiquidGlassAvailable: () => { if (throwing) throw new Error('no native module'); return liquidGlass; },
    isGlassEffectAPIAvailable: () => apiAvailable };
  type Api = { useMaterialDecision: () => { material: string; reason: string }; useMaterial: () => string; ControlSurface: (props: any) => any;
    runningInExpoGo: (constants?: unknown) => boolean; glassViewRegistered: (registry?: unknown) => boolean };
  const module = { exports: {} as Api };
  runInNewContext(code, { module, exports: module.exports, Error, process: { env }, globalThis: { expo: registry ?? undefined }, require: (name: string) => {
    if (name === 'expo-glass-effect') { required += 1; if (broken) throw new Error('Unable to resolve module'); return glassModule; }
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected material dependency: ' + name);
    return modules[name];
  } });
  return Object.assign({ required: () => required }, module.exports);
}

test('in Expo Go the glass module is never evaluated and the material is opaque, whatever iOS says', () => {
  for (const goMarker of [{ expoGoConfig: { debuggerHost: 'x' }, appOwnership: null }, { expoGoConfig: null, appOwnership: 'expo' }]) {
    const go = loadMaterial({ expoGo: goMarker });
    assert.deepEqual(go.useMaterialDecision(), { material: 'opaque', reason: 'expo-go' });
    assert.equal(go.useMaterial(), 'opaque');
    assert.equal(go.required(), 0, 'expo-glass-effect was not required');
    // Even a caller asking for glass gets the opaque View: the module is not there to draw it.
    const surface = go.ControlSurface({ material: 'glass', style: { width: 54 }, opaque: { backgroundColor: '#FFF' }, children: 'glyph' });
    assert.equal(surface.type, 'View');
    assert.equal(go.required(), 0);
  }
  assert.equal(loadMaterial({ expoGo: null }).runningInExpoGo(), true, 'no constants at all is treated as the store client');
  assert.equal(loadMaterial({ expoGo: null }).useMaterialDecision().reason, 'expo-go');
});

test('the kill switch EXPO_PUBLIC_DISABLE_GLASS=1 forces opaque without evaluating the module, in any environment', () => {
  const off = loadMaterial({ env: { EXPO_PUBLIC_DISABLE_GLASS: '1' } });
  assert.deepEqual(off.useMaterialDecision(), { material: 'opaque', reason: 'disabled' });
  assert.equal(off.required(), 0);
  assert.equal(off.ControlSurface({ material: 'glass', style: {}, opaque: {}, children: null }).type, 'View');
  const on = loadMaterial({ env: { EXPO_PUBLIC_DISABLE_GLASS: '0' } });
  assert.equal(on.useMaterialDecision().material, 'glass');
});

test('a binary without the registered view, or a module that fails to load or throws, means opaque and never an error', () => {
  const unregistered = loadMaterial({ registry: { modules: {}, getViewConfig: () => null } });
  assert.deepEqual(unregistered.useMaterialDecision(), { material: 'opaque', reason: 'not-registered' });
  assert.equal(unregistered.required(), 0, 'a view the binary cannot create is never asked for');
  const noConfig = loadMaterial({ registry: { modules: { ExpoGlassEffect: {} }, getViewConfig: () => null } });
  assert.equal(noConfig.useMaterialDecision().reason, 'not-registered');
  const noRegistry = loadMaterial({ registry: null });
  assert.equal(noRegistry.useMaterialDecision().reason, 'not-registered');
  const throwingRegistry = loadMaterial({ registry: { modules: { ExpoGlassEffect: {} }, getViewConfig: () => { throw new Error('boom'); } } });
  assert.equal(throwingRegistry.useMaterialDecision().reason, 'not-registered');
  const broken = loadMaterial({ broken: true });
  assert.deepEqual(broken.useMaterialDecision(), { material: 'opaque', reason: 'unavailable' });
  assert.equal(broken.required(), 1, 'tried once');
  assert.equal(broken.useMaterialDecision().material, 'opaque');
  assert.equal(broken.required(), 1, 'never retried in the session');
  const throwing = loadMaterial({ throwing: true });
  assert.deepEqual(throwing.useMaterialDecision(), { material: 'opaque', reason: 'unavailable' });
  assert.equal(throwing.ControlSurface({ material: 'glass', style: {}, opaque: {}, children: null }).type, 'View');
});

test('a development build on iOS 26 with the view registered loads the module once and draws regular glass; older iOS, a missing API or Reduce Transparency draw opaque', () => {
  const dev = loadMaterial();
  assert.deepEqual(dev.useMaterialDecision(), { material: 'glass', reason: 'glass' });
  dev.useMaterial();
  assert.equal(dev.required(), 1, 'one evaluation per session');
  const geometry = { width: 54, height: 54, borderRadius: 27 };
  const opaque = { backgroundColor: '#FFFFFF', borderWidth: 0.5 };
  const glass = dev.ControlSurface({ material: 'glass', style: geometry, opaque, tint: '#2557D640', children: 'glyph' });
  assert.equal(glass.type, 'GlassView');
  assert.equal(glass.props.glassEffectStyle, 'regular', 'regular, not clear: enough body behind a glyph or a text field');
  assert.equal(glass.props.tintColor, '#2557D640');
  assert.equal(glass.props.isInteractive, false, 'press feedback stays our scale; no second native bounce');
  assert.equal(glass.props.style, geometry);
  assert.equal(glass.props.children, 'glyph');
  assert.equal(JSON.stringify(glass.props).includes('opacity'), false, 'opacity is never set on a glass view: at 0 the effect stops drawing');
  const plain = dev.ControlSurface({ material: 'opaque', style: geometry, opaque, tint: '#2557D640', children: 'glyph' });
  assert.equal(plain.type, 'View');
  assert.equal(JSON.stringify(plain.props.style), JSON.stringify([geometry, opaque]));
  assert.equal(loadMaterial({ liquidGlass: false }).useMaterialDecision().reason, 'unavailable');
  assert.equal(loadMaterial({ apiAvailable: false }).useMaterialDecision().reason, 'api');
  assert.equal(loadMaterial({ reduceTransparency: true }).useMaterialDecision().reason, 'reduce-transparency');
  assert.equal(loadMaterial({ platform: 'android' }).required(), 0);
  assert.equal(loadMaterial({ platform: 'android' }).useMaterialDecision().reason, 'platform');
});

test('glass stays on the control layer and behind the adapter: only material.tsx names expo-glass-effect, and only lazily', () => {
  const read = (file: string) => readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const uses = ['components.tsx', 'entry-list.tsx', 'home-modules.tsx', 'spending-chart.tsx', 'charts.tsx', 'card-visual.tsx', 'form-controls.tsx', 'liability-rows.tsx', 'assistant-messages.tsx']
    .filter(file => /expo-glass-effect|from '\.\/material'/.test(read(file)));
  assert.deepEqual(uses, []);
  const tabs = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.equal(/expo-glass-effect|tabBarBackground|position: 'absolute'/.test(tabs), false, 'the JS tab bar is not dressed as glass; native tabs are a later phase');
  assert.deepEqual(['quick-actions.tsx', 'assistant-composer.tsx'].filter(file => /from '\.\/material'/.test(read(file))), ['quick-actions.tsx', 'assistant-composer.tsx']);
  assert.deepEqual(['quick-actions.tsx', 'assistant-composer.tsx'].filter(file => /expo-glass-effect/.test(read(file))), [], 'only material.tsx talks to expo-glass-effect');
  const adapter = read('material.tsx');
  assert.equal(/^import .* from 'expo-glass-effect'/m.test(adapter), false, 'no static import: the module binds its native view at evaluation time');
  assert.match(adapter, /require\('expo-glass-effect'\)/);
  assert.match(adapter, /import type .* from 'expo-glass-effect'|typeof import\('expo-glass-effect'\)/, 'types only');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.dependencies['expo-glass-effect'], /^~57\./, 'the SDK 57 version bundled in Expo Go');
  const theme = read('theme.ts');
  assert.equal(theme.includes('AccessibilityInfo.isReduceTransparencyEnabled()'), false, 'the accessibility API is feature-detected through the policy helper, never called blindly');
  assert.match(theme, /subscribeReduceTransparency\(/);
});
