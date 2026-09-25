import assert from 'node:assert/strict';
import { test } from 'node:test';
import { darkPalette, lightPalette } from '../src/ui/palette.ts';

// WCAG 2 contrast over the actual palette. A pure check of the numbers: the
// rendered look, blending on device and Dynamic Type still need the iPhone.
function luminance(hex: string): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}
/** Hue angle in degrees, to tell two blues apart where a contrast ratio cannot. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const raw = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (raw * 60 + 360) % 360;
}
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

for (const [name, p] of [['light', lightPalette], ['dark', darkPalette]] as const) {
  test(`${name}: the brand primary reads as text on every surface it is used on`, () => {
    // Background (section links, "Este mes"), surface (selector cards, picker checks) and the elevated segmented thumb (the selected label).
    // Primary text never sits directly on the inset track.
    for (const ground of [p.background, p.surface, p.elevated]) assert.ok(contrast(p.primary, ground) >= 4.5, `primary on ${ground}: ${contrast(p.primary, ground).toFixed(2)}`);
    assert.ok(contrast(p.onPrimary, p.primaryFill) >= 4.5, 'button text on the filled call to action');
    assert.ok(contrast(p.primary, p.primarySoft) >= 4.5, 'primary text on its own soft tint');
  });
  test(`${name}: semantic colours stay distinct from the brand primary and readable`, () => {
    for (const semantic of [p.expense, p.income, p.transfer, p.warning]) {
      assert.ok(contrast(semantic, p.surface) >= 4.5, `${semantic} on surface`);
      assert.notEqual(semantic, p.primary);
    }
    // Transfer blue and brand blue are different swatches: meaning and interaction never share one colour.
    assert.ok(Math.abs(hue(p.transfer) - hue(p.primary)) >= 12, `transfer azure (${hue(p.transfer).toFixed(0)}°) sits apart from the cobalt primary (${hue(p.primary).toFixed(0)}°)`);
    assert.ok(contrast(p.transfer, p.transferSoft) >= 4.5, 'transfer text on its soft tile');
    assert.ok(contrast(p.text, p.surface) >= 12, 'normal text stays high-contrast neutral');
    assert.ok(contrast(p.secondary, p.surface) >= 4.5);
  });
  test(`${name}: secondary text and tertiary glyphs read on every ground of Inicio (24UX1)`, () => {
    // Secondary is text: the hero's month, the quick-action captions and the empty sentences sit on the background,
    // the unselected segment labels on the inset track. Before 24UX1 the light palette gave 4.42:1 and 4.27:1.
    for (const ground of [p.background, p.surface, p.inset]) assert.ok(contrast(p.secondary, ground) >= 4.5, `secondary on ${ground}: ${contrast(p.secondary, ground).toFixed(2)}`);
    // Tertiary is never body text: chevrons, placeholders, the hero's cents at 44 pt bold. A glyph or large text needs 3:1.
    for (const ground of [p.background, p.surface, p.inset]) assert.ok(contrast(p.tertiary, ground) >= 3, `tertiary on ${ground}: ${contrast(p.tertiary, ground).toFixed(2)}`);
    // Three distinct steps of ink remain: text, secondary, tertiary.
    assert.ok(contrast(p.text, p.surface) > contrast(p.secondary, p.surface) && contrast(p.secondary, p.surface) > contrast(p.tertiary, p.surface));
  });
}

test('the primary is a cobalt blue, not purple or green', () => {
  for (const p of [lightPalette, darkPalette]) {
    const [r, g, b] = [1, 3, 5].map(index => parseInt(p.primary.slice(index, index + 2), 16));
    assert.ok(b > g && g > r, `${p.primary} is blue-dominant with green over red (no purple cast)`);
    assert.ok(b - r > 100, 'saturated enough to be a brand colour');
  }
});
