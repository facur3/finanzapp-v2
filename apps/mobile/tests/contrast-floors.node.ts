import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { APPEARANCE_COLORS } from '@finanzapp/domain';
import * as appearance from '../src/ui/appearance.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { darkPalette, lightPalette, quietTones, QUIET_ALPHA } from '../src/ui/palette.ts';
import { othersColor } from '../src/ui/category-color.ts';
import { contrast } from './contrast.ts';

// Producto 25D1: the colours that stood under their contrast floor on Sapphire + Sand, measured with WCAG's formula on the
// real tokens. Figures, not taste: how a tone reads on the iPhone is the device check.
const schemes = [['light', lightPalette, false], ['dark', darkPalette, true]] as const;

/** An 8-digit hex composited over an opaque ground, as the screen shows it. */
function over(color: string, ground: string): string {
  const alpha = parseInt(color.slice(7, 9), 16) / 255;
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(channel(color, i) * alpha + channel(ground, i) * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

test('25D1: a coloured hero\'s symbol and cents hold 3:1 over the canvas and the surface in both themes, one step under the units each', () => {
  for (const [name, p, isDark] of schemes) {
    for (const tone of ['income', 'expense', 'transfer', 'warning'] as const) {
      const quiet = quietTones(p[tone], isDark)!;
      for (const ground of [p.background, p.surface]) {
        const units = contrast(p[tone], ground), symbol = contrast(over(quiet.symbol, ground), ground), cents = contrast(over(quiet.cents, ground), ground);
        const at = `${name} ${tone} on ${ground}: units ${units.toFixed(2)}, symbol ${symbol.toFixed(2)}, cents ${cents.toFixed(2)}`;
        assert.ok(cents >= 3, at);
        assert.ok(units > symbol && symbol > cents, at + ' (the units carry the number)');
      }
    }
  }
  // The previous single pair (70 % / 55 %) left the light income cents at 2.2:1: the floor is what changed.
  assert.ok(contrast(over(lightPalette.income + '8C', lightPalette.background), lightPalette.background) < 3);
});

test('25D1: quietTones quiets only a six-digit hex, with the recorded alphas', () => {
  for (const ink of ['rgba(0,0,0,0.5)', '#FFF', '#1F7A4FCC', '']) assert.equal(quietTones(ink, false), null, JSON.stringify(ink));
  assert.equal(JSON.stringify(quietTones('#1f7a4f', false)), JSON.stringify({ symbol: '#1f7a4fE6', cents: '#1f7a4fCC' }));
  assert.equal(JSON.stringify(quietTones('#1f7a4f', true)), JSON.stringify({ symbol: '#1f7a4fB3', cents: '#1f7a4f99' }));
  assert.equal(JSON.stringify(QUIET_ALPHA), JSON.stringify({ light: { symbol: 'E6', cents: 'CC' }, dark: { symbol: 'B3', cents: '99' } }));
});

test('25D1: «Otras» is a warm neutral that holds 3:1 on the canvas, the surface and the ring track it shows through', () => {
  for (const [name, p, isDark] of schemes) {
    const others = othersColor({ isDark });
    assert.equal(others, isDark ? '#7A766C' : '#7C786E', name);
    for (const ground of [p.background, p.surface, p.inset]) {
      assert.ok(contrast(others, ground) >= 3, `${name} «Otras» ${others} on ${ground}: ${contrast(others, ground).toFixed(2)}`);
    }
    const [r, g, b] = [1, 3, 5].map(i => parseInt(others.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 22, name + ': a neutral, not a category hue');
    assert.ok(r >= g && g >= b, name + ': warm, like the sand around it');
  }
});

/** The colour picker as compiled, its hosts as descriptors: the colour of every check it draws for `chosen`. */
function pickerChecks(isDark: boolean, chosen: string): string[] {
  const source = readFileSync(new URL('../src/ui/appearance-picker.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: unknown, props: Record<string, any>) => ({ type, props });
  const p = { ...(isDark ? darkPalette : lightPalette), isDark };
  const modules: Record<string, unknown> = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: (styles: unknown) => styles }, View: 'View' },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': { AppText: 'AppText', GlyphTile: 'GlyphTile', PressFeedback: 'PressFeedback' },
    './appearance': appearance, './category-color': { tintOf: (color: string) => color },
    './motion': { duration: { state: 200 }, selectionHaptic: () => {} },
    './theme': { space: { l: 16 }, usePalette: () => p, useReduceMotion: () => false },
    '../i18n/provider': { useI18n: () => bindLocale('es-AR') },
  };
  const module = { exports: {} as Record<string, (props: any) => any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected picker dependency: ' + name);
    return modules[name];
  } });
  const walk = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(walk)
    : !value.props ? [] : [value, ...(typeof value.type === 'function' ? walk(value.type(value.props)) : []), ...walk(value.props.children)];
  const root = module.exports.IconColorPicker({ icons: appearance.ACCOUNT_ICON_CHOICES, colors: appearance.COLOR_CHOICES, icon: appearance.ACCOUNT_ICON_CHOICES[0].id,
    color: chosen, onIconChange: () => {}, onColorChange: () => {} });
  return walk(root).filter(node => node.type === 'Ionicons' && node.props.name === 'checkmark').map(node => node.props.color);
}

test('25D1: the chosen colour\'s check holds 3:1 on every colour in both themes, and the picker draws it in that ink', () => {
  for (const [name, p, isDark] of schemes) {
    for (const color of APPEARANCE_COLORS) {
      const dot = isDark ? color.dark : color.light;
      assert.ok(contrast(p.onSemantic, dot) >= 3, `${name} ${color.id}: ${p.onSemantic} on ${dot} ${contrast(p.onSemantic, dot).toFixed(2)}`);
      // One check, on the chosen dot, in onSemantic: white in light, ink in dark (white fell to 1.97:1 there).
      assert.equal(JSON.stringify(pickerChecks(isDark, color.id)), JSON.stringify([p.onSemantic]), `${name} ${color.id}`);
    }
  }
  assert.equal(darkPalette.onSemantic === '#FFFFFF', false, 'in dark the check is not white');
});
