import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { tabHostOptions, tabScreenOptions } from '../src/ui/navigation.ts';

// A configuration regression guard over the actual layout module, NOT an iOS
// render/gesture test. It catches overrides that accidentally bring back the
// fade + native-detachment combination. Physical stress testing is still needed.
const source = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;

function renderLayout(background: string) {
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const Tabs = Object.assign(() => null, { Screen: 'TabScreen' });
  const module = { exports: {} as { default?: () => any } };
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { Tabs, router: { push: () => {} } },
    '@expo/vector-icons/Ionicons': () => null,
    '../../src/ui/components': { IconButton: () => null },
    '../../src/ui/navigation': { tabHostOptions, tabScreenOptions },
    '../../src/ui/theme': { usePalette: () => ({ background, text: '#FFFFFF', accent: '#7AB3FF', secondary: '#A6B0C0', surface: '#151A22', line: '#2B3544' }) },
  };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected layout dependency: ' + name);
    return modules[name];
  } });
  return module.exports.default!();
}

for (const [theme, background] of [['light', '#F5F6F8'], ['dark', '#080B10']]) {
  test('tab layout keeps scenes opaque, mounted and unfrozen in ' + theme, () => {
    const { props } = renderLayout(background);
    assert.equal(props.detachInactiveScreens, false);
    const screens = props.children;
    assert.equal(screens.map((screen: any) => screen.props.name).join(','), 'index,activity,settings');
    for (const screen of screens) {
      const options = { ...props.screenOptions, ...screen.props.options };
      assert.equal(options.animation, 'none');
      assert.equal(options.lazy, false);
      assert.equal(options.freezeOnBlur, false);
      assert.equal(options.transitionSpec, undefined);
      assert.equal(options.sceneStyleInterpolator, undefined);
      assert.equal(options.sceneStyle.backgroundColor, background);
      assert.equal(options.sceneStyle.opacity, undefined);
    }
  });
}
