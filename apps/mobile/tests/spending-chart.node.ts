import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as presentation from '../src/ui/report-presentation.ts';

// A source/behavior guard over the actual component; animation timing/visual
// quality and VoiceOver are still physical-device acceptance items.
test('bars retain real proportions, animate data changes only, and honor reduced motion', () => {
  const source = readFileSync(new URL('../src/ui/spending-chart.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  let reduced = false;
  let previousDeps: unknown[] = [];
  let shared: { value: number } | undefined;
  let effect: (() => any) | undefined;
  const timings: { value: number; duration: number }[] = [];
  const modules: Record<string, any> = {
    react: { useEffect: (fn: () => any, deps: unknown[]) => {
      if (deps.some((dep, index) => dep !== previousDeps[index])) { previousDeps = deps; effect = fn; }
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', useWindowDimensions: () => ({ fontScale: 1, width: 393 }), StyleSheet: { hairlineWidth: 0.5 } },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' },
      useSharedValue: (value: number) => shared ??= { value }, useAnimatedStyle: (fn: () => any) => fn,
      withTiming: (value: number, options: { duration: number }) => { timings.push({ value, duration: options.duration }); return value; }, cancelAnimation: () => {} },
    '@expo/vector-icons/Ionicons': 'Icon', '@finanzapp/domain': domain,
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', Money: 'Money', PressFeedback: 'PressFeedback' },
    './report-presentation': presentation,
    './theme': { useReduceMotion: () => reduced, usePalette: () => ({ accent: '#2467DC', inset: '#ECEFF4' }) },
  };
  const module = { exports: {} as { CategorySpendingRow?: (props: any) => any } };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected chart dependency: ' + name);
    return modules[name];
  } });
  const category = { key: 'comida', category: 'Comida', amountMinor: 300, count: 1 };
  const row = module.exports.CategorySpendingRow!({ category, totalMinor: 1000, currency: 'ARS', onPress: () => {} });
  assert.equal(row.props.accessibilityRole, 'button');
  assert.match(row.props.accessibilityLabel, /30 % del gasto del mes/);
  const bar = row.props.children[1].props.children[1];
  assert.equal(bar.props.fraction, 0.3);
  let view = bar.type(bar.props);
  assert.equal(shared!.value, 0.3, 'first frame uses the actual proportion, not zero');
  assert.equal(view.props.accessibilityElementsHidden, true);
  effect!(); effect = undefined;
  assert.equal(view.props.children.props.style[1]().width, '30%');
  view = bar.type({ fraction: 0.6 });
  effect!(); effect = undefined;
  assert.equal(timings.at(-1)!.duration, 260);
  assert.equal(view.props.children.props.style[1]().width, '60%');
  bar.type({ fraction: 0.6 });
  assert.equal(effect, undefined, 'returning with the same data must not replay');
  reduced = true;
  bar.type({ fraction: 0.5 });
  effect!();
  assert.equal(timings.at(-1)!.duration, 0);
});
