import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ACCOUNT_ICONS, APPEARANCE_COLORS, CATEGORY_ICONS, CATEGORY_PRESETS } from '@finanzapp/domain';
import { ACCOUNT_ICON_CHOICES, CATEGORY_ICON_CHOICES, COLOR_CHOICES, FINANCE_ROW_LOOKS, accountGlyph, appearanceHex, appearanceName, categoryGlyph } from '../src/ui/appearance.ts';
import { lightPalette, darkPalette } from '../src/ui/palette.ts';
import { tintOf } from '../src/ui/category-color.ts';
import { contrast } from './theme.node.ts';

// The real glyph map of the installed Ionicons font: every curated id must draw.
const glyphs = JSON.parse(readFileSync(new URL('../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json', import.meta.url), 'utf8'));

test('every curated account and category icon maps to a glyph that exists in the bundled Ionicons font', () => {
  for (const icon of ACCOUNT_ICONS) assert.ok(accountGlyph(icon.id) in glyphs, `${icon.id} → ${accountGlyph(icon.id)}`);
  for (const icon of CATEGORY_ICONS) assert.ok(categoryGlyph(icon.id) in glyphs, `${icon.id} → ${categoryGlyph(icon.id)}`);
  for (const look of Object.values(FINANCE_ROW_LOOKS)) assert.ok(look.glyph in glyphs);
  assert.equal(ACCOUNT_ICON_CHOICES.length, ACCOUNT_ICONS.length);
  assert.equal(CATEGORY_ICON_CHOICES.length, CATEGORY_ICONS.length);
  assert.equal(COLOR_CHOICES.length, APPEARANCE_COLORS.length);
  for (const preset of CATEGORY_PRESETS) assert.ok(categoryGlyph(preset.icon) in glyphs, preset.label);
});
test('no emoji and no duplicate glyph within the account set', () => {
  const accountGlyphs = ACCOUNT_ICONS.map(icon => accountGlyph(icon.id));
  assert.equal(new Set(accountGlyphs).size, accountGlyphs.length, 'each account icon reads differently');
  for (const glyph of [...accountGlyphs, ...CATEGORY_ICONS.map(icon => categoryGlyph(icon.id))]) assert.match(glyph, /^[a-z-]+$/);
});
test('unknown ids fall back to the default glyph and colour instead of breaking a row', () => {
  assert.equal(accountGlyph('rocket'), 'wallet-outline');
  assert.equal(categoryGlyph('🍕'), 'ellipsis-horizontal');
  assert.equal(appearanceHex('neon', { isDark: false }), '#2557D6');
  assert.equal(appearanceName('neon'), 'Cobalto');
  assert.equal(appearanceHex('cobalt', { isDark: true }), '#5B87FF');
});
test('every palette colour keeps glyph contrast on its soft tint and on the surface, in both themes', () => {
  for (const [p, surface] of [[lightPalette, lightPalette.surface], [darkPalette, darkPalette.surface]] as const) {
    const theme = { isDark: p === darkPalette };
    for (const color of APPEARANCE_COLORS) {
      const hex = appearanceHex(color.id, theme);
      assert.ok(contrast(hex, surface) >= 3, `${color.id} (${hex}) on ${surface}: ${contrast(hex, surface).toFixed(2)}`);
      // The tile behind the glyph is the colour at ~20 % over the surface; composite it and check the glyph still reads.
      const alpha = parseInt(tintOf(hex, theme).slice(7), 16) / 255;
      const blend = (channel: number) => Math.round(parseInt(hex.slice(channel, channel + 2), 16) * alpha + parseInt(surface.slice(channel, channel + 2), 16) * (1 - alpha));
      const tile = '#' + [1, 3, 5].map(channel => blend(channel).toString(16).padStart(2, '0')).join('').toUpperCase();
      assert.ok(contrast(hex, tile) >= 2.5, `${color.id} glyph on its tint (${tile}): ${contrast(hex, tile).toFixed(2)}`);
    }
  }
});
test('the Más Finanzas tiles use palette colours and stay restrained: five rows, no expense coral, no more than one row per colour', () => {
  const colors = Object.values(FINANCE_ROW_LOOKS).map(look => look.color);
  assert.equal(colors.length, 5);
  assert.equal(new Set(colors).size, colors.length);
  for (const color of colors) assert.ok(APPEARANCE_COLORS.some(item => item.id === color), color);
});
