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
  test(`${name}: the section link is readable on the canvas and on a surface (24UX5, Forest)`, () => {
    // Inicio's «Ver todos» sits on the background; the token also holds on a surface should a link ever sit on a card.
    for (const ground of [p.background, p.surface]) assert.ok(contrast(p.link, ground) >= 4.5, `link on ${ground}: ${ratio(p.link, ground)}`);
  });
  test(`${name}: semantic colours stay readable, and a transfer is a restrained blue-teal apart from the brand (24UX6C)`, () => {
    for (const semantic of [p.expense, p.income, p.transfer, p.warning]) {
      assert.ok(contrast(semantic, p.surface) >= 4.5, `${semantic} on surface: ${ratio(semantic, p.surface)}`);
      assert.notEqual(semantic, p.primary, 'meaning and interaction never share one colour');
    }
    // A transfer moves money between the person's own accounts: neither spending nor income. 24UX6C gives it its own
    // restrained blue-teal: clearly apart from the pine brand (158–168°), never teal-cyan neon or a saturated blue.
    const [r, g, b] = [1, 3, 5].map(index => parseInt(p.transfer.slice(index, index + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), light = (max + min) / 2, d = max - min;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));
    const angle = d === 0 ? 0 : ((max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
    assert.ok(angle >= 185 && angle <= 210, `transfer hue ${angle.toFixed(0)}° is a blue-teal`);
    assert.ok(sat <= 0.5, `restrained, not saturated: ${sat.toFixed(2)}`);
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
  test(`${name}: Inicio's pine field carries its number, subline and compact controls legibly (24UX6A)`, () => {
    // The 46 pt number and the month label: AAA on the field.
    assert.ok(contrast(p.heroInk, p.hero) >= 7, `heroInk on hero: ${ratio(p.heroInk, p.hero)}`);
    // The subline («Hasta hoy · … por día») on the field, and the unselected segment label on the field's track.
    assert.ok(contrast(p.heroSecondary, p.hero) >= 4.5, `heroSecondary on hero: ${ratio(p.heroSecondary, p.hero)}`);
    assert.ok(contrast(p.heroSecondary, p.heroControl) >= 4.5, `heroSecondary on heroControl: ${ratio(p.heroSecondary, p.heroControl)}`);
    // The scope chip and the accounts button: ink on the control fill.
    assert.ok(contrast(p.heroInk, p.heroControl) >= 4.5, `heroInk on heroControl: ${ratio(p.heroInk, p.heroControl)}`);
    // The chosen segment: pine text on the near-white thumb.
    assert.ok(contrast(p.heroThumbInk, p.heroThumb) >= 7, `heroThumbInk on heroThumb: ${ratio(p.heroThumbInk, p.heroThumb)}`);
  });
  test(`${name}: the dock and its «+» read in both themes; the selected capsule separates from the pill (24UX6A)`, () => {
    assert.ok(contrast(p.onAccent, p.accent) >= 4.5, `the «+» glyph on the accent: ${ratio(p.onAccent, p.accent)}`);
    assert.ok(contrast(p.dockInk, p.dock) >= 4.5, `inactive tab glyph on the dock: ${ratio(p.dockInk, p.dock)}`);
    assert.ok(contrast(p.dockActiveInk, p.dockActive) >= 4.5, `selected tab glyph on its capsule: ${ratio(p.dockActiveInk, p.dockActive)}`);
    // The capsule (with the filled glyph) marks the selection, never colour alone, but it must still be visible on the pill.
    assert.ok(contrast(p.dockActive, p.dock) > 1.5, `the capsule separates from the pill: ${ratio(p.dockActive, p.dock)}`);
  });
  test(`${name}: the brand stays pine, inside the Forest hue window and never teal, cyan, blue or emerald (decision 005)`, () => {
    // Every brand token sits in 155–168°. The binding Forest window is 158–168°, but the handoff's exact hex values are
    // authoritative and its HSL figures are rounded: the sage accent #9FD8C1 measures ≈155.8°, the dark primary #94D2BB
    // ≈157.7° and the dark fill/accent #86C9B0 ≈157.6°. 155° admits those hex values unchanged; decision 005 records this
    // measured tolerance. Above 168° the pine drifts towards teal, cyan and blue.
    const brand = [['primary', p.primary], ['primaryFill', p.primaryFill], ['hero', p.hero], ['accent', p.accent], ['dock', p.dock], ['dockActive', p.dockActive]] as const;
    for (const [token, hex] of brand) {
      const angle = hue(hex);
      assert.ok(angle >= 155 && angle <= 168, `${token} ${hex} is ${angle.toFixed(1)}°, outside the 155–168° brand tolerance`);
      const { s, l } = saturationLightness(hex);
      assert.ok(!(s > 0.55 && l > 0.45), `${token} ${hex} reads as emerald (S ${s.toFixed(2)}, L ${l.toFixed(2)})`);
    }
    // The strict 158–168° window binds the financial field in both themes and the light brand (text and fill).
    const strict = p === lightPalette ? [['hero', p.hero], ['primary', p.primary], ['primaryFill', p.primaryFill]] as const : [['hero', p.hero]] as const;
    for (const [token, hex] of strict) {
      const angle = hue(hex);
      assert.ok(angle >= 158 && angle <= 168, `${token} ${hex} is ${angle.toFixed(1)}°, outside the strict 158–168° Forest window`);
    }
  });
}

test('the dark canvas is true OLED black; the light canvas is the mineral grey-green', () => {
  assert.equal(darkPalette.background, '#000000');
  assert.equal(lightPalette.background, '#F0F3F1');
});
