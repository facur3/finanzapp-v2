import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { composerBottomPadding, materialFor } from '../src/ui/material-policy.ts';

// Producto 22: the material decision (native Liquid Glass or the opaque
// control surface) and the control-surface component, in Node. Whether iOS
// 26 actually draws the glass, how it looks against our backgrounds and how
// Reduce Transparency behaves on the device still need the iPhone.
const glassReady = { platform: 'ios', liquidGlass: true, apiAvailable: true, reduceTransparency: false };

test('glass is drawn only on iOS 26 with the API present and Reduce Transparency off; every other case is the opaque material', () => {
  assert.equal(materialFor(glassReady), 'glass');
  assert.equal(materialFor({ ...glassReady, liquidGlass: false }), 'opaque', 'older iOS, or a build without the Liquid Glass SDK');
  assert.equal(materialFor({ ...glassReady, apiAvailable: false }), 'opaque', 'iOS 26 betas without the API must not crash');
  assert.equal(materialFor({ ...glassReady, reduceTransparency: true }), 'opaque', 'the accessibility setting wins');
  assert.equal(materialFor({ ...glassReady, platform: 'android' }), 'opaque');
  assert.equal(materialFor({ ...glassReady, platform: 'web' }), 'opaque');
});

test('the composer padding clears the keyboard or the safe area, minus what sits below the screen, never negative', () => {
  assert.equal(composerBottomPadding(0, 34, 0), 34, 'stack, keyboard down: the home indicator');
  assert.equal(composerBottomPadding(336, 34, 0), 336, 'stack, keyboard up');
  assert.equal(composerBottomPadding(0, 34, 83), 0, 'tab root, keyboard down: the tab bar already covers the inset');
  assert.equal(composerBottomPadding(336, 34, 83), 253, 'tab root, keyboard up: up to the keyboard, not above an empty strip');
  assert.equal(composerBottomPadding(20, 34, 83), 0);
});

function loadMaterial({ platform = 'ios', liquidGlass = true, apiAvailable = true, reduceTransparency = false, throwing = false } = {}) {
  const source = readFileSync(new URL('../src/ui/material.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const calls = { liquidGlass: 0, api: 0 };
  const modules: Record<string, unknown> = {
    react: { useMemo: (fn: () => unknown) => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Platform: { OS: platform } },
    'expo-glass-effect': { GlassView: 'GlassView',
      isLiquidGlassAvailable: () => { calls.liquidGlass += 1; if (throwing) throw new Error('no native module'); return liquidGlass; },
      isGlassEffectAPIAvailable: () => { calls.api += 1; return apiAvailable; } },
    './material-policy': { materialFor },
    './theme': { useReduceTransparency: () => reduceTransparency },
  };
  const module = { exports: {} as { useMaterial: () => string; ControlSurface: (props: any) => any } };
  runInNewContext(code, { module, exports: module.exports, Error, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected material dependency: ' + name);
    return modules[name];
  } });
  return { ...module.exports, calls };
}

test('useMaterial combines the native checks with the live accessibility setting and never throws', () => {
  assert.equal(loadMaterial().useMaterial(), 'glass');
  assert.equal(loadMaterial({ liquidGlass: false }).useMaterial(), 'opaque');
  assert.equal(loadMaterial({ reduceTransparency: true }).useMaterial(), 'opaque');
  assert.equal(loadMaterial({ platform: 'android' }).useMaterial(), 'opaque');
  const broken = loadMaterial({ throwing: true });
  assert.equal(broken.useMaterial(), 'opaque', 'a missing native module means the opaque material, not a crash');
});

test('ControlSurface draws a regular GlassView with the tint when the material is glass, and a View with the opaque style otherwise', () => {
  const { ControlSurface } = loadMaterial();
  const geometry = { width: 54, height: 54, borderRadius: 27 };
  const opaque = { backgroundColor: '#FFFFFF', borderWidth: 0.5 };
  const glass = ControlSurface({ material: 'glass', style: geometry, opaque, tint: '#2557D640', children: 'glyph' });
  assert.equal(glass.type, 'GlassView');
  assert.equal(glass.props.glassEffectStyle, 'regular', 'regular, not clear: enough body behind a glyph or a text field');
  assert.equal(glass.props.tintColor, '#2557D640');
  assert.equal(glass.props.isInteractive, false, 'press feedback stays our scale; no second native bounce');
  assert.equal(glass.props.style, geometry);
  assert.equal(glass.props.children, 'glyph');
  assert.equal(JSON.stringify(glass.props).includes('opacity'), false, 'opacity is never set on a glass view: at 0 the effect stops drawing');
  const plain = ControlSurface({ material: 'opaque', style: geometry, opaque, tint: '#2557D640', children: 'glyph' });
  assert.equal(plain.type, 'View');
  assert.equal(JSON.stringify(plain.props.style), JSON.stringify([geometry, opaque]));
  assert.equal(plain.props.children, 'glyph');
});

test('glass stays on the control layer: no content surface, row, chip, list or tab bar imports the material', () => {
  const uses = ['components.tsx', 'entry-list.tsx', 'home-modules.tsx', 'spending-chart.tsx', 'charts.tsx', 'card-visual.tsx', 'form-controls.tsx', 'liability-rows.tsx', 'assistant-messages.tsx']
    .filter(file => /expo-glass-effect|from '\.\/material'/.test(readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8')));
  assert.deepEqual(uses, []);
  const tabs = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.equal(/expo-glass-effect|tabBarBackground|position: 'absolute'/.test(tabs), false, 'the JS tab bar is not dressed as glass; native tabs are a later phase');
  const glassUsers = ['quick-actions.tsx', 'assistant-composer.tsx'].filter(file => /from '\.\/material'/.test(readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8')));
  assert.deepEqual(glassUsers, ['quick-actions.tsx', 'assistant-composer.tsx']);
  const direct = ['quick-actions.tsx', 'assistant-composer.tsx'].filter(file => /expo-glass-effect/.test(readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8')));
  assert.deepEqual(direct, [], 'only material.tsx talks to expo-glass-effect');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.dependencies['expo-glass-effect'], /^~57\./, 'the SDK 57 version bundled in Expo Go');
});
