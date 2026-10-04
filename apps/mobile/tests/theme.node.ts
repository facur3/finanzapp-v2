import assert from 'node:assert/strict';
import { test } from 'node:test';
import { darkPalette, lightPalette } from '../src/ui/palette.ts';

// WCAG 2 contrast over the actual palette. A pure check of the numbers: the
// rendered look, blending on device and Dynamic Type still need the iPhone.
function luminance(hex: string): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}
/** Hue angle in degrees, to tell pine apart from teal, cyan or blue where a contrast ratio cannot. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const raw = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (raw * 60 + 360) % 360;
}
/** HSL saturation and lightness (0–1), to keep the brand off the bright emerald. */
function saturationLightness(hex: string): { s: number; l: number } {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  return { s: max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)), l };
}
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
const ratio = (a: string, b: string) => contrast(a, b).toFixed(2);

for (const [name, p] of [['light', lightPalette], ['dark', darkPalette]] as const) {
  test(`${name}: the brand primary reads as text on every surface it is used on`, () => {
    // Background (section links, "Ver todos"), surface (selector cards, picker checks) and the elevated segmented thumb (the selected label).
    // Primary text never sits directly on the inset track.
    for (const ground of [p.background, p.surface, p.elevated]) assert.ok(contrast(p.primary, ground) >= 4.5, `primary on ${ground}: ${ratio(p.primary, ground)}`);
    assert.ok(contrast(p.onPrimary, p.primaryFill) >= 4.5, `button text on the filled call to action: ${ratio(p.onPrimary, p.primaryFill)}`);
    assert.ok(contrast(p.primary, p.primarySoft) >= 4.5, `primary text on its own soft tint: ${ratio(p.primary, p.primarySoft)}`);
    // The compact segment's thumb: ink stays AAA on it, and in dark it is a visible step above the surface track.
    assert.ok(contrast(p.text, p.thumb) >= 7, `ink on the compact thumb: ${ratio(p.text, p.thumb)}`);
    if (p === darkPalette) assert.ok(contrast(p.thumb, p.surface) >= 1.4, `the dark thumb separates from its track: ${ratio(p.thumb, p.surface)}`);
  });
  test(`${name}: the section link is readable on the canvas and on a surface (24UX5)`, () => {
    // Inicio's «Ver todos» sits on the background; the token also holds on a surface should a link ever sit on a card.
    for (const ground of [p.background, p.surface]) assert.ok(contrast(p.link, ground) >= 4.5, `link on ${ground}: ${ratio(p.link, ground)}`);
  });
  test(`${name}: semantic colours stay readable, and a transfer is a neutral slate apart from the brand (24UX6C, slate since 25VIS1)`, () => {
    for (const semantic of [p.expense, p.income, p.transfer, p.warning]) {
      assert.ok(contrast(semantic, p.surface) >= 4.5, `${semantic} on surface: ${ratio(semantic, p.surface)}`);
      assert.notEqual(semantic, p.primary, 'meaning and interaction never share one colour');
    }
    // A transfer moves money between the person's own accounts: neither spending nor income. 24UX6C gave it its own
    // restrained tone; 25VIS1 makes it a neutral slate (blue-grey, low saturation), far from the lime brand.
    const [r, g, b] = [1, 3, 5].map(index => parseInt(p.transfer.slice(index, index + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), light = (max + min) / 2, d = max - min;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
    const angle = d === 0 ? 0 : ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
    assert.ok(angle >= 185 && angle <= 215, `transfer hue ${angle.toFixed(0)}° is a blue-grey`);
    assert.ok(sat <= 0.3, `restrained, not saturated: ${sat.toFixed(2)}`);
    assert.notEqual(p.transfer, p.secondary, 'its own tone, not body text');
    assert.ok(contrast(p.transfer, p.transferSoft) >= 4.5, `transfer text on its soft tile: ${ratio(p.transfer, p.transferSoft)}`);
    // Red never means "spent": the negative tone and the positive tone are apart from each other and from the brand.
    assert.notEqual(p.expense, p.income);
    assert.ok(contrast(p.text, p.surface) >= 12, 'normal text stays high-contrast neutral');
    // 24UX4: white labels on the trailing swipe actions.
    for (const fill of [p.swipeDestructive, p.swipeNeutral, p.swipeAccent]) assert.ok(contrast('#FFFFFF', fill) >= 4.5, `white on swipe action ${fill}: ${ratio('#FFFFFF', fill)}`);
    assert.ok(contrast(p.secondary, p.surface) >= 4.5);
  });
  test(`${name}: secondary text and tertiary glyphs read on every ground (24UX1)`, () => {
    // Secondary is text: captions and empty sentences sit on the background, the unselected segment labels on the inset track.
    for (const ground of [p.background, p.surface, p.inset]) assert.ok(contrast(p.secondary, ground) >= 4.5, `secondary on ${ground}: ${ratio(p.secondary, ground)}`);
    // Tertiary is never body text: chevrons, placeholders, cents at a large size. A glyph or large text needs 3:1.
    for (const ground of [p.background, p.surface, p.inset]) assert.ok(contrast(p.tertiary, ground) >= 3, `tertiary on ${ground}: ${ratio(p.tertiary, ground)}`);
    // Three distinct steps of ink remain: text, secondary, tertiary.
    assert.ok(contrast(p.text, p.surface) > contrast(p.secondary, p.surface) && contrast(p.secondary, p.surface) > contrast(p.tertiary, p.surface));
  });
  test(`${name}: Inicio's brand field carries its number, subline and compact controls legibly (24UX6A)`, () => {
    // The 46 pt number and the month label: AAA on the field.
    assert.ok(contrast(p.heroInk, p.hero) >= 7, `heroInk on hero: ${ratio(p.heroInk, p.hero)}`);
    // The subline («Hasta hoy · … por día») on the field, and the unselected segment label on the field's track.
    assert.ok(contrast(p.heroSecondary, p.hero) >= 4.5, `heroSecondary on hero: ${ratio(p.heroSecondary, p.hero)}`);
    assert.ok(contrast(p.heroSecondary, p.heroControl) >= 4.5, `heroSecondary on heroControl: ${ratio(p.heroSecondary, p.heroControl)}`);
    // The scope chip and the accounts button: ink on the control fill.
    assert.ok(contrast(p.heroInk, p.heroControl) >= 4.5, `heroInk on heroControl: ${ratio(p.heroInk, p.heroControl)}`);
    // The chosen segment (25VIS1 final): ink on the light surface's white thumb, the same in dark (the field stays light).
    assert.equal(p.heroThumb, lightPalette.surface, 'the thumb is the existing white surface, not a new white');
    assert.equal(p.heroThumbInk, p.heroInk, 'the chosen label is the field\'s ink');
    assert.ok(contrast(p.heroThumbInk, p.heroThumb) >= 7, `heroThumbInk on heroThumb: ${ratio(p.heroThumbInk, p.heroThumb)}`);
    // The thumb stands out from the lime track it slides on and from the field around it.
    assert.ok(contrast(p.heroThumb, p.heroControl) >= 1.5, `the thumb separates from the track: ${ratio(p.heroThumb, p.heroControl)}`);
    assert.ok(luminance(p.heroThumb) > luminance(p.hero) && luminance(p.hero) > luminance(p.heroControl), 'the thumb is brighter than the field, the track darker');
  });
  test(`${name}: the dock and its «+» read in both themes; the selected capsule separates from the pill (24UX6A)`, () => {
    assert.ok(contrast(p.onAccent, p.accent) >= 4.5, `the «+» glyph on the accent: ${ratio(p.onAccent, p.accent)}`);
    assert.ok(contrast(p.dockInk, p.dock) >= 4.5, `inactive tab glyph on the dock: ${ratio(p.dockInk, p.dock)}`);
    assert.ok(contrast(p.dockActiveInk, p.dockActive) >= 4.5, `selected tab glyph on its capsule: ${ratio(p.dockActiveInk, p.dockActive)}`);
    // The capsule (with the filled glyph) marks the selection, never colour alone, but it must still be visible on the pill.
    assert.ok(contrast(p.dockActive, p.dock) > 1.5, `the capsule separates from the pill: ${ratio(p.dockActive, p.dock)}`);
  });
  test(`${name}: the brand is Electric Lime, a yellow-chartreuse kept apart from a bright green and from every meaning (25VIS1)`, () => {
    // The lime fields and their text tone sit in 68–82°, on the yellow side of a conventional bright green (#9FE870 is ≈97°).
    const fields = [['primaryFill', p.primaryFill], ['hero', p.hero], ['accent', p.accent]] as const;
    const brandText = [['primary', p.primary], ['link', p.link], ['toggle', p.toggle], ['swipeAccent', p.swipeAccent]] as const;
    for (const [token, hex] of [...fields, ...brandText]) {
      const angle = hue(hex);
      assert.ok(angle >= 68 && angle <= 82, `${token} ${hex} is ${angle.toFixed(1)}°, outside the 68–82° chartreuse window`);
    }
    for (const [token, hex] of fields) {
      const { s, l } = saturationLightness(hex);
      assert.ok(s >= 0.7 && l >= 0.45, `${token} ${hex} is a vivid field (S ${s.toFixed(2)}, L ${l.toFixed(2)})`);
      // Ink, never white, on the lime: AAA wherever a word or glyph sits on it.
      assert.ok(contrast(p.heroInk, hex) >= 7, `ink on ${token}: ${ratio(p.heroInk, hex)}`);
    }
    assert.ok(contrast(p.onPrimary, p.primaryFill) >= 7 && contrast(p.onAccent, p.accent) >= 7, 'ink on the call to action and the «+»');
    // Lime never means success, income, warning or alert: every semantic tone stays far from the brand's hue.
    const distance = (a: string, b: string) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };
    for (const [token, hex] of [...fields, ...brandText]) {
      assert.ok(distance(p.income, hex) >= 60, `income ${p.income} is ${distance(p.income, hex).toFixed(0)}° from ${token}`);
      assert.ok(distance(p.warning, hex) >= 30, `warning ${p.warning} is ${distance(p.warning, hex).toFixed(0)}° from ${token}`);
      assert.ok(distance(p.expense, hex) >= 50, `expense ${p.expense} is ${distance(p.expense, hex).toFixed(0)}° from ${token}`);
      assert.ok(distance(p.transfer, hex) >= 90, `transfer ${p.transfer} is ${distance(p.transfer, hex).toFixed(0)}° from ${token}`);
      for (const semantic of [p.income, p.incomeSoft, p.warning, p.expense, p.transfer]) assert.notEqual(semantic, hex);
    }
  });
  test(`${name}: everything but the brand is neutral: grounds, ink and the graphite dock with its capsule (25VIS1)`, () => {
    // No forest-green second brand: grounds, ink and the dock carry almost no chroma.
    for (const [token, hex] of [['background', p.background], ['inset', p.inset], ['line', p.line], ['text', p.text], ['secondary', p.secondary],
      ['tertiary', p.tertiary], ['dock', p.dock], ['dockActive', p.dockActive], ['dockInk', p.dockInk], ['heroThumb', p.heroThumb]] as const) {
      // Chroma (max − min channel), not HSL saturation, which inflates near white and black.
      const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
      assert.ok(Math.max(...channels) - Math.min(...channels) <= 10, `${token} ${hex} is neutral`);
    }
    // The dock stays dark in both themes, so the lime «+» beside it is the one bright object.
    assert.ok(luminance(p.dock) < 0.03, `the dock is graphite: ${p.dock}`);
    assert.ok(contrast(p.accent, p.dock) >= 7, `the «+» stands apart from the pill: ${ratio(p.accent, p.dock)}`);
  });
  test(`${name}: a switch that is on keeps its white knob visible and differs from the off track (25VIS1)`, () => {
    assert.ok(contrast('#FFFFFF', p.toggle) >= 4.5, `white knob on the on track: ${ratio('#FFFFFF', p.toggle)}`);
    assert.ok(contrast(p.toggle, p.inset) >= 3, `on track against the off track: ${ratio(p.toggle, p.inset)}`);
  });
  test(`${name}: Inicio's lime field is light, so the status bar over it is dark, and its controls separate from it (25VIS1)`, () => {
    assert.equal(p.heroStatusBar, luminance(p.hero) > 0.4 ? 'dark' : 'light');
    assert.ok(contrast(p.heroControl, p.hero) >= 1.25, `the scope chip and the accounts button read as controls: ${ratio(p.heroControl, p.hero)}`);
  });
}

test('the dark canvas is a neutral near-black, not crushed #000, with surfaces in visible steps; the light canvas a mineral off-white (25VIS1)', () => {
  assert.notEqual(darkPalette.background, '#000000');
  assert.ok(luminance(darkPalette.background) < 0.01, `near-black: ${darkPalette.background}`);
  assert.ok(contrast(darkPalette.surface, darkPalette.background) >= 1.1, 'a surface is a visible step above the canvas');
  assert.ok(contrast(darkPalette.elevated, darkPalette.surface) >= 1.3, 'elevated is a step above the surface');
  assert.ok(contrast(darkPalette.dock, darkPalette.background) >= 1.15, 'the dock separates from the canvas (a hairline helps too)');
  assert.ok(luminance(lightPalette.background) > 0.85 && lightPalette.background !== lightPalette.surface, 'off-white, a step under the white surfaces');
});
