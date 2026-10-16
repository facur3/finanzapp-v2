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
/** CIE L*a*b* (D65), to tell a grey-blue from a saturated blue where the hue alone cannot: chroma and colour distance. */
function lab(hex: string): [number, number, number] {
  const lin = [1, 3, 5].map(index => { const c = parseInt(hex.slice(index, index + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const xyz = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]].map(row => row.reduce((sum, k, i) => sum + k * lin[i], 0));
  const [x, y, z] = [xyz[0] / 0.95047, xyz[1], xyz[2] / 1.08883].map(t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const chroma = (hex: string) => { const [, a, b] = lab(hex); return Math.hypot(a, b); };
const deltaE = (one: string, two: string) => { const [p, q] = [lab(one), lab(two)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
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
    // 25VIS2: the currency switch's chosen code sits on the inset.
    assert.ok(contrast(p.primary, p.inset) >= 4.5, `primary on the inset: ${ratio(p.primary, p.inset)}`);
    assert.ok(contrast(p.onPrimary, p.primaryFill) >= 4.5, `button text on the filled call to action: ${ratio(p.onPrimary, p.primaryFill)}`);
    assert.ok(contrast(p.primary, p.primarySoft) >= 4.5, `primary text on its own soft tint: ${ratio(p.primary, p.primarySoft)}`);
    // The compact segment's thumb: ink stays AAA on it, and in dark it is a visible step above the surface track.
    assert.ok(contrast(p.text, p.thumb) >= 7, `ink on the compact thumb: ${ratio(p.text, p.thumb)}`);
    if (p === darkPalette) assert.ok(contrast(p.thumb, p.surface) >= 1.4, `the dark thumb separates from its track: ${ratio(p.thumb, p.surface)}`);
  });
  test(`${name}: a filled semantic button's label holds 4.5:1 on every semantic fill («Pagar tarjeta» in dark was white on slate, 2.1:1)`, () => {
    for (const [tone, fill] of [['expense', p.expense], ['income', p.income], ['transfer', p.transfer], ['warning', p.warning]] as const) {
      assert.ok(contrast(p.onSemantic, fill) >= 4.5, `onSemantic on ${tone} ${fill}: ${ratio(p.onSemantic, fill)}`);
    }
  });
  test(`${name}: the section link is readable on the canvas and on a surface (24UX5)`, () => {
    // Inicio's «Ver todos» sits on the background; the token also holds on a surface should a link ever sit on a card.
    for (const ground of [p.background, p.surface]) assert.ok(contrast(p.link, ground) >= 4.5, `link on ${ground}: ${ratio(p.link, ground)}`);
  });
  test(`${name}: semantic colours stay readable, and a transfer is a neutral slate (24UX6C, slate since 25VIS1)`, () => {
    for (const semantic of [p.expense, p.income, p.transfer, p.warning]) {
      assert.ok(contrast(semantic, p.surface) >= 4.5, `${semantic} on surface: ${ratio(semantic, p.surface)}`);
      assert.notEqual(semantic, p.primary, 'meaning and interaction never share one colour');
    }
    // A transfer moves money between the person's own accounts: neither spending nor income. 24UX6C gave it its own
    // restrained tone; 25VIS1 made it a neutral slate (blue-grey, low saturation), kept apart from the brand below.
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
    // The chosen segment (25VIS1 final, kept in 25VIS2): the light ink on the light surface's thumb, the same in dark.
    assert.equal(p.heroThumb, lightPalette.surface, 'the thumb is the existing light surface, not a new white');
    assert.equal(p.heroThumbInk, lightPalette.text, 'the chosen label is the light ink: the field\'s own ink is white');
    assert.ok(contrast(p.heroThumbInk, p.heroThumb) >= 7, `heroThumbInk on heroThumb: ${ratio(p.heroThumbInk, p.heroThumb)}`);
    // The thumb stands out from the control track it slides on and from the field around it.
    assert.ok(contrast(p.heroThumb, p.heroControl) >= 1.5, `the thumb separates from the track: ${ratio(p.heroThumb, p.heroControl)}`);
    assert.ok(luminance(p.heroThumb) > luminance(p.hero) && luminance(p.hero) > luminance(p.heroControl), 'the thumb is brighter than the field, the track darker');
    // 25VIS2: the hub's resume line sits on the control fill in the field's ink.
    assert.ok(contrast(p.heroInk, p.heroControl) >= 7, `heroInk on heroControl: ${ratio(p.heroInk, p.heroControl)}`);
  });
  test(`${name}: the hero amount's symbol and cents are solid neutral tones on the field, quieter than the units (25A-03)`, () => {
    for (const [token, hex] of [['heroMoneySymbol', p.heroMoneySymbol], ['heroMoneyCents', p.heroMoneyCents]] as const) {
      assert.match(hex, /^#[0-9A-F]{6}$/, `${token} is a solid colour, never an alpha over the field`);
      const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
      // Neutral: the channels within 8 of each other, and green never the highest (it would tint against the field).
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 8 && g <= b, `${token} ${hex} is a neutral tone`);
      // Readable over both fields (AA for text, though the hero is large), and still clearly below the ink.
      for (const field of [lightPalette.hero, darkPalette.hero]) assert.ok(contrast(hex, field) >= 4.5, `${token} on ${field}: ${ratio(hex, field)}`);
      assert.ok(contrast(p.heroInk, p.hero) > contrast(hex, p.hero), `${token} is quieter than the whole units`);
    }
    // The hierarchy, by contrast against the field whichever its lightness: whole units (heroInk) > symbol > cents.
    assert.ok(contrast(p.heroInk, p.hero) > contrast(p.heroMoneySymbol, p.hero) && contrast(p.heroMoneySymbol, p.hero) > contrast(p.heroMoneyCents, p.hero),
      'the symbol is quieter than the units, the cents quieter still');
    assert.ok(contrast(p.heroMoneySymbol, p.heroMoneyCents) >= 1.25, 'the two quiet steps are distinguishable');
  });
  test(`${name}: the dock and its «+» read in both themes; the selected capsule separates from the pill (24UX6A)`, () => {
    assert.ok(contrast(p.onAccent, p.accent) >= 4.5, `the «+» glyph on the accent: ${ratio(p.onAccent, p.accent)}`);
    assert.ok(contrast(p.dockInk, p.dock) >= 4.5, `inactive tab glyph on the dock: ${ratio(p.dockInk, p.dock)}`);
    assert.ok(contrast(p.dockActiveInk, p.dockActive) >= 4.5, `selected tab glyph on its capsule: ${ratio(p.dockActiveInk, p.dockActive)}`);
    // The capsule (with the filled glyph) marks the selection, never colour alone, but it must still be visible on the pill.
    assert.ok(contrast(p.dockActive, p.dock) > 1.5, `the capsule separates from the pill: ${ratio(p.dockActive, p.dock)}`);
  });
  test(`${name}: the brand is a true sapphire, kept apart from every meaning (25VIS2)`, () => {
    // The fields and the brand's text tones sit in 218–232°: a sapphire, never toward violet (≈250°+) or a cyan blue (≈200°).
    const fields = [['primaryFill', p.primaryFill], ['hero', p.hero], ['accent', p.accent]] as const;
    const brandText = [['primary', p.primary], ['link', p.link], ['toggle', p.toggle], ['swipeAccent', p.swipeAccent]] as const;
    for (const [token, hex] of [...fields, ...brandText]) {
      const angle = hue(hex);
      assert.ok(angle >= 218 && angle <= 232, `${token} ${hex} is ${angle.toFixed(1)}°, outside the 218–232° sapphire window`);
      const { s, l } = saturationLightness(hex);
      assert.ok(s >= 0.55, `${token} ${hex} is saturated, not a grey-blue (S ${s.toFixed(2)})`);
      assert.ok(l >= 0.4, `${token} ${hex} is a sapphire, not a navy (L ${l.toFixed(2)})`);
    }
    // What sits on each field: the hero's units AAA, the call to action and the «+» at least AA.
    assert.ok(contrast(p.heroInk, p.hero) >= 7, `the field's ink on the hero: ${ratio(p.heroInk, p.hero)}`);
    assert.ok(contrast(p.onPrimary, p.primaryFill) >= 4.5 && contrast(p.onAccent, p.accent) >= 4.5, 'text on the call to action and the «+»');
    // Sapphire never means success, income, warning or alert: those tones stay far from the brand's hue.
    const distance = (a: string, b: string) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };
    for (const [token, hex] of [...fields, ...brandText]) {
      assert.ok(distance(p.income, hex) >= 60, `income ${p.income} is ${distance(p.income, hex).toFixed(0)}° from ${token}`);
      assert.ok(distance(p.warning, hex) >= 30, `warning ${p.warning} is ${distance(p.warning, hex).toFixed(0)}° from ${token}`);
      assert.ok(distance(p.expense, hex) >= 50, `expense ${p.expense} is ${distance(p.expense, hex).toFixed(0)}° from ${token}`);
      // The slate transfer is near the sapphire's hue (brand-brief.md §4.9, item 2): a grey-blue, apart by colourfulness.
      assert.ok(deltaE(p.transfer, hex) >= 40, `transfer ${p.transfer} is ΔE ${deltaE(p.transfer, hex).toFixed(0)} from ${token}`);
      for (const semantic of [p.income, p.incomeSoft, p.warning, p.expense, p.transfer]) assert.notEqual(semantic, hex);
    }
    assert.ok(chroma(p.transfer) <= 15, `transfer ${p.transfer} is a grey-blue (chroma ${chroma(p.transfer).toFixed(0)})`);
    for (const [token, hex] of [...fields, ...brandText]) assert.ok(chroma(hex) >= 40, `${token} ${hex} is a saturated blue (chroma ${chroma(hex).toFixed(0)})`);
  });
  test(`${name}: everything but the brand is a warm neutral: grounds, ink and the graphite dock with its capsule (25VIS2)`, () => {
    // Sand, stone and graphite: little chroma, and where there is some it is warm (30–60°), never green or blue.
    for (const [token, hex] of [['background', p.background], ['surface', p.surface], ['inset', p.inset], ['line', p.line], ['text', p.text],
      ['secondary', p.secondary], ['tertiary', p.tertiary], ['dock', p.dock], ['dockActive', p.dockActive], ['dockInk', p.dockInk], ['heroThumb', p.heroThumb]] as const) {
      // Chroma (max − min channel), not HSL saturation, which inflates near white and black.
      const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
      const spread = Math.max(...channels) - Math.min(...channels);
      assert.ok(spread <= 22, `${token} ${hex} is a neutral`);
      if (spread > 4) assert.ok(hue(hex) >= 30 && hue(hex) <= 60, `${token} ${hex} is warm (${hue(hex).toFixed(0)}°)`);
    }
    // The dock stays dark in both themes; the «+» beside it floats on the canvas, where it must stand out (brand-brief.md
    // §4.9, item 3: a sapphire «+» cannot hold Lime's 7:1 against the pill).
    assert.ok(luminance(p.dock) < 0.03, `the dock is graphite: ${p.dock}`);
    assert.ok(contrast(p.accent, p.background) >= 3, `the «+» stands apart from the canvas: ${ratio(p.accent, p.background)}`);
  });
  test(`${name}: a switch that is on keeps its white knob visible and differs from the off track (25VIS1)`, () => {
    assert.ok(contrast('#FFFFFF', p.toggle) >= 4.5, `white knob on the on track: ${ratio('#FFFFFF', p.toggle)}`);
    assert.ok(contrast(p.toggle, p.inset) >= 3, `on track against the off track: ${ratio(p.toggle, p.inset)}`);
  });
  test(`${name}: the status bar over Inicio's field follows the field's lightness, and its controls separate from it (25VIS1, 25VIS2)`, () => {
    assert.equal(p.heroStatusBar, luminance(p.hero) > 0.4 ? 'dark' : 'light');
    assert.ok(contrast(p.heroControl, p.hero) >= 1.25, `the scope chip and the accounts button read as controls: ${ratio(p.heroControl, p.hero)}`);
  });
}

test('the dark canvas is a warm near-black, not crushed #000, with surfaces in visible steps; the light canvas a sand off-white (25VIS2)', () => {
  assert.notEqual(darkPalette.background, '#000000');
  assert.ok(luminance(darkPalette.background) < 0.01, `near-black: ${darkPalette.background}`);
  assert.ok(contrast(darkPalette.surface, darkPalette.background) >= 1.1, 'a surface is a visible step above the canvas');
  assert.ok(contrast(darkPalette.elevated, darkPalette.surface) >= 1.3, 'elevated is a step above the surface');
  assert.ok(contrast(darkPalette.dock, darkPalette.background) >= 1.15, 'the dock separates from the canvas (a hairline helps too)');
  assert.ok(luminance(lightPalette.background) > 0.85 && lightPalette.background !== lightPalette.surface, 'off-white, a step under the white surfaces');
});
