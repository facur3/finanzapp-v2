import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as geometry from '../src/ui/geometry.ts';
import * as presentation from '../src/ui/report-presentation.ts';
import { moneyText } from '../src/i18n/format.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import { DEFAULT_LOCALE, type AppLocale } from '../src/i18n/locale.ts';

// 24UX6C2: a category row puts its amount (and its share) under the name when the two cannot share one line, instead of
// wrapping the name into a stray last letter («Supermercad / o») or shrinking the money. These are line-fit estimates;
// how the rows actually wrap at 375 pt and at the AX sizes is a physical-device item.

const { labelWidthEm, labelAmountStacks, rowStacks, ROW_CHROME, SAFETY } = geometry;
/** A legend row (and a category row with its chevron): the list row's chrome plus the chevron (15) and its gap (12). */
const LEGEND_CHROME = ROW_CHROME + 27;
/** The iPhone widths in points, from the SE (1st gen) to the 16 Pro Max. */
const WIDTHS = [320, 375, 390, 393, 402, 414, 428, 430, 440];
const near = (a: number, b: number, message?: string) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}${message ? ': ' + message : ''}`);
/** What `useCategoryRowStacks` decides: the amount's own rule (useStacked → rowStacks) or the name-and-amount line fit. */
const rowDecision = (width: number, fontScale: number, label: string, amount: string, chrome = LEGEND_CHROME) =>
  rowStacks(width, fontScale, amount) || labelAmountStacks(width, fontScale, label, amount, chrome);

const SUPERMERCADO = moneyText(41276040, 'ARS', 'es-AR');
const THIRTEEN_DIGITS = moneyText(1234567890123, 'ARS', 'es-AR');
const FORTY = 'Mantenimiento del hogar y reparaciones v';

test('labelWidthEm: narrow lowercase, wide capitals and digits, thin spaces and punctuation, with the safety margin', () => {
  assert.equal(labelWidthEm(''), 0);
  near(labelWidthEm(' '), 0.28 * SAFETY, 'a space');
  for (const thin of ['.', ',', ':', ';', '·', "'", '’', '!', '|', 'i', 'l']) near(labelWidthEm(thin), 0.3 * SAFETY, 'thin ' + thin);
  for (const wide of ['S', 'Á', 'É', 'Ñ', 'Ü', '0', '9', 'm', 'w', 'M', 'W']) near(labelWidthEm(wide), 0.68 * SAFETY, 'wide ' + wide);
  for (const other of ['a', 'e', 'o', 'é', 'ñ', 'z', '&', '-']) near(labelWidthEm(other), 0.54 * SAFETY, 'regular ' + other);
  // «Supermercado»: S and m wide, ten regular letters.
  near(labelWidthEm('Supermercado'), (2 * 0.68 + 10 * 0.54) * SAFETY);
  near(labelWidthEm('Café y bar'), (0.68 + 0.54 * 6 + 0.28 * 2 + 0.54) * SAFETY);
  assert.ok(labelWidthEm('Supermercado') > labelWidthEm('Comida'));
  assert.equal(FORTY.length, 40);
});

test('«Supermercado» with $ 412.760,40: stacks at 375 pt in a legend row, and fits on one line at 393 pt', () => {
  assert.equal(SUPERMERCADO, '$ 412.760,40');
  // The estimate: name 7.03 em and amount 6.55 em at 17 pt, plus the 8 pt gap, need 238.9 pt.
  const needed = labelWidthEm('Supermercado') * 17 + 8 + geometry.amountWidthEm(SUPERMERCADO) * 17;
  assert.ok(needed > 375 - LEGEND_CHROME && needed < 393 - LEGEND_CHROME, `${needed.toFixed(1)} pt`);
  assert.equal(labelAmountStacks(375, 1, 'Supermercado', SUPERMERCADO, LEGEND_CHROME), true, 'iPhone SE / mini: 224 pt of room, it stacks');
  // Documented decision: on a 393 pt iPhone the estimate leaves 242 pt, so the name and the amount share the line (3 pt to spare).
  assert.equal(labelAmountStacks(393, 1, 'Supermercado', SUPERMERCADO, LEGEND_CHROME), false, 'iPhone 14 Pro / 15 / 16: 242 pt, one line');
  assert.equal(labelAmountStacks(430, 1, 'Supermercado', SUPERMERCADO, LEGEND_CHROME), false);
  // The amount alone fits its share of the row: it is the name beside it that decides at 375 pt.
  assert.equal(rowStacks(375, 1, SUPERMERCADO), false);
  // A list row without the chevron (a compact category row) has 27 pt more: one line at 375 pt.
  assert.equal(labelAmountStacks(375, 1, 'Supermercado', SUPERMERCADO), false);
  assert.equal(labelAmountStacks(375, 1, 'Supermercado', SUPERMERCADO, ROW_CHROME), false);
  // Before layout (no width) only the text scale decides.
  assert.equal(labelAmountStacks(0, 1, 'Supermercado', SUPERMERCADO, LEGEND_CHROME), false);
  assert.equal(labelAmountStacks(Number.NaN, 1, 'Supermercado', SUPERMERCADO, LEGEND_CHROME), false);
});

test('short names with everyday amounts stay on one line at every iPhone width', () => {
  for (const width of WIDTHS) {
    for (const [label, amount] of [['Comida', moneyText(120000, 'ARS', 'es-AR')], ['Café', moneyText(4500, 'ARS', 'es-AR')], ['Salud', moneyText(123456, 'USD', 'en-US')],
      ['Comida', moneyText(12345, 'JPY', 'es-AR')], ['Comida', moneyText(12345, 'KWD', 'en-US')]] as const) {
      assert.equal(labelAmountStacks(width, 1, label, amount, LEGEND_CHROME), false, `${label} ${amount} at ${width} pt`);
      // At 320 pt a long prefix (US$ 1,234.56) already stacks by the amount's own rule (rowStacks, 24B3), as before.
      if (width >= 375) assert.equal(rowDecision(width, 1, label, amount), false, `${label} ${amount} at ${width} pt (row rule)`);
    }
  }
  assert.equal(rowDecision(320, 1, 'Comida', moneyText(120000, 'ARS', 'es-AR')), false, 'the peso\'s short sign fits at 320 pt too');
  assert.equal(rowDecision(320, 1, 'Salud', moneyText(123456, 'USD', 'en-US')), true, 'US$ 1,234.56 stacks at 320 pt by the amount rule');
});

test('a 40-character category or a 13-digit ARS amount stacks', () => {
  assert.equal(THIRTEEN_DIGITS, '$ 12.345.678.901,23');
  for (const width of WIDTHS) {
    assert.equal(labelAmountStacks(width, 1, FORTY, moneyText(100, 'ARS', 'es-AR'), LEGEND_CHROME), true, `40 characters at ${width} pt, even with $ 1,00`);
    assert.equal(labelAmountStacks(width, 1, FORTY, moneyText(100, 'ARS', 'es-AR'), ROW_CHROME), true, `40 characters at ${width} pt in a list row`);
    assert.equal(labelAmountStacks(width, 1, 'Supermercado', THIRTEEN_DIGITS, LEGEND_CHROME), true, `13 digits beside Supermercado at ${width} pt`);
  }
  // A short name beside 13 digits: the amount's own rule (useStacked) stacks it up to the 430 pt iPhones, where the line
  // fit alone would be borderline (223.7 pt of 224 at 375 pt).
  for (const width of WIDTHS.filter(width => width <= 430)) assert.equal(rowDecision(width, 1, 'Ropa', THIRTEEN_DIGITS), true, `Ropa + 13 digits at ${width} pt`);
  assert.equal(labelAmountStacks(375, 1, 'Ropa', THIRTEEN_DIGITS, LEGEND_CHROME), false, 'the line fit alone: 223.7 pt in 224');
  // Documented: on the 440 pt Pro Max the estimate fits «Ropa» and 13 digits on one line (223.7 pt of 289), so the row keeps them side by side.
  assert.equal(rowDecision(440, 1, 'Ropa', THIRTEEN_DIGITS), false);
});

test('large text always stacks; the threshold is above 1.2', () => {
  for (const width of WIDTHS) {
    for (const scale of [1.235, 1.353, 1.786, 2.353, 3.118]) {
      assert.equal(labelAmountStacks(width, scale, 'Café', moneyText(100, 'ARS', 'es-AR'), LEGEND_CHROME), true, `${scale} at ${width} pt`);
      assert.equal(labelAmountStacks(width, scale, 'Café', moneyText(100, 'ARS', 'es-AR')), true);
    }
    assert.equal(labelAmountStacks(width, 1.2, 'Café', moneyText(100, 'ARS', 'es-AR'), LEGEND_CHROME), false, 'exactly 1.2 still measures');
  }
  assert.equal(labelAmountStacks(0, 1.4, 'Café', moneyText(100, 'ARS', 'es-AR')), true, 'even before layout');
  // Below 1.2 the text scale enlarges both widths: «Supermercado» at 393 pt fits at 1, not at 1.1.
  assert.equal(labelAmountStacks(393, 1.1, 'Supermercado', SUPERMERCADO, LEGEND_CHROME), true);
});

test('USD, JPY and KWD long formats: a long name with a long amount stacks on the narrow and regular iPhones', () => {
  const usd = moneyText(4127604, 'USD', 'en-US');
  const jpy = moneyText(41276040, 'JPY', 'es-AR');
  const kwd = moneyText(4127604, 'KWD', 'en-US');
  assert.deepEqual([usd, jpy, kwd], ['US$ 41,276.04', 'JP¥ 41.276.040', 'KWD 4,127.604']);
  for (const amount of [usd, jpy, kwd]) {
    assert.equal(labelAmountStacks(375, 1, 'Supermercado', amount, LEGEND_CHROME), true, amount + ' at 375 pt');
    assert.equal(labelAmountStacks(393, 1, 'Supermercado', amount, LEGEND_CHROME), true, amount + ' at 393 pt');
    assert.equal(labelAmountStacks(430, 1, 'Supermercado', amount, LEGEND_CHROME), false, amount + ' fits at 430 pt');
    assert.equal(rowStacks(393, 1, amount), false, 'the amount alone fits its share: the name decides');
  }
  // Wider prefixes need more room than the peso's sign for the same digits.
  assert.ok(geometry.amountWidthEm(usd) > geometry.amountWidthEm(moneyText(4127604, 'ARS', 'es-AR')));
});

// 24UX6C2: a category name is the person's own text, so it can be Japanese or carry an emoji. Full-width scripts count
// about one em per character and a pictograph 1.25 em; joiners, variation selectors, skin-tone modifiers and combining
// marks add nothing (they draw no glyph of their own).
const CJK = '食料品・日用品';
/** Man, woman, girl, boy joined by three ZERO WIDTH JOINERs: one glyph on screen, seven code points. */
const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
/** Argentina's flag: two regional indicator symbols. */
const FLAG = '\u{1F1E6}\u{1F1F7}';

test('labelWidthEm: an ideograph, kana, hangul or a full-width form is one em; «食料品・日用品» is wide enough to stack at 375 pt', () => {
  for (const wide of ['食', '料', '品', '日', '用', 'ひ', 'カ', '한', '。', '（', 'Ａ']) near(labelWidthEm(wide), 1 * SAFETY, 'full-width ' + wide);
  // Six ideographs at one em each, at least (the middle dot between them is not counted narrower than a Latin letter).
  assert.ok(labelWidthEm(CJK) >= (6 + 0.54) * SAFETY - 1e-9, `${labelWidthEm(CJK)} em`);
  assert.equal(labelAmountStacks(375, 1, CJK, SUPERMERCADO, LEGEND_CHROME), true, '«食料品・日用品» with $ 412.760,40 stacks at 375 pt in a legend row');
  assert.equal(rowDecision(375, 1, CJK, SUPERMERCADO), true);
  // Counting each ideograph as a Latin letter (0.54 em) would have put them on one line at 375 pt.
  const asLatin = 0.54 * [...CJK].length * SAFETY * 17 + 8 + geometry.amountWidthEm(SUPERMERCADO) * 17;
  assert.ok(asLatin <= 375 - LEGEND_CHROME, `${asLatin.toFixed(1)} pt: the Latin estimate would not stack`);
  for (const scale of [1.235, 1.353]) assert.equal(labelAmountStacks(430, scale, CJK, SUPERMERCADO, LEGEND_CHROME), true, 'large text stacks');
  // The legend row itself (the real useCategoryRowStacks): the amount and its share go under the name.
  const row = rows({ width: 375, fontScale: 1 }).CategoryLegendRow({ category: { key: 'super', category: CJK, amountMinor: 41276040, count: 3 }, totalMinor: 142331172,
    currency: 'ARS', onPress: () => {} });
  assert.equal(legend(row).column.props.style.flexDirection, 'column');
  assert.equal(textOf(legend(row).name), CJK);
  assert.equal(legend(row).name.props.numberOfLines, undefined, 'a stacked name has no line limit');
});

test('labelWidthEm: an emoji is 1.25 em; joiners, variation selectors, skin tones and combining marks add nothing', () => {
  near(labelWidthEm('🐶'), 1.25 * SAFETY, 'a pictograph');
  near(labelWidthEm('Mascotas 🐶'), labelWidthEm('Mascotas ') + 1.25 * SAFETY, '«Mascotas 🐶»: the name plus one emoji');
  // The invisible parts of an emoji sequence, and combining marks, draw nothing of their own.
  for (const silent of ['\u200D', '\uFE0F', '\uFE0E', '\u{1F3FD}', '\u0301', '\u0308', '\u0303']) {
    assert.equal(labelWidthEm(silent), 0, 'U+' + silent.codePointAt(0)!.toString(16).toUpperCase());
  }
  near(labelWidthEm('\u{1F44D}\u{1F3FD}'), labelWidthEm('\u{1F44D}'), 'a skin tone does not add a second emoji');
  near(labelWidthEm('❤\uFE0F'), labelWidthEm('❤'), 'the emoji presentation selector adds nothing');
  near(labelWidthEm('a\u200Db'), labelWidthEm('ab'), 'a joiner between letters adds nothing');
  // A family and a flag are each at least one wide glyph, and the joiners are not glyphs.
  assert.equal([...FAMILY].length, 7);
  assert.ok(labelWidthEm(FAMILY) >= 1.25 * SAFETY - 1e-9, `family ${labelWidthEm(FAMILY)} em`);
  assert.ok(labelWidthEm(FAMILY) < [...FAMILY].length * 1.25 * SAFETY, 'not one em and a quarter per code point');
  assert.ok(labelWidthEm(FLAG) >= 1 * SAFETY, `flag ${labelWidthEm(FLAG)} em`);
  assert.ok(labelWidthEm('Viajes ' + FLAG) > labelWidthEm('Viajes '));
  // A decomposed accent measures as its precomposed letter.
  near(labelWidthEm('Cafe\u0301'), labelWidthEm('Café'));
  near(labelWidthEm('Pequen\u0303o'), labelWidthEm('Pequeño'));
  near(labelWidthEm('Pingu\u0308ino'), labelWidthEm('Pingüino'), 'a decomposed diaeresis');
});

// The legend row itself, through the real useCategoryRowStacks (spending-chart.tsx harness).
const rowAmountText = (minor: number, currency: domain.Currency, signed = false, locale: AppLocale = DEFAULT_LOCALE) =>
  Number.isSafeInteger(minor) ? moneyText(minor, currency, locale, false, signed) : '—';
function rows(window: { width: number; fontScale: number }, locale: Parameters<typeof bindLocale>[0] = 'es-AR') {
  const source = readFileSync(new URL('../src/ui/spending-chart.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const i18n = bindLocale(locale);
  const modules: Record<string, any> = {
    '../i18n/provider': { useI18n: () => i18n }, react: { useEffect: () => {} }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { hairlineWidth: 0.5 }, useWindowDimensions: () => ({ ...window, height: 800, scale: 3 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (fn: () => any) => fn,
      withTiming: (value: number) => value, cancelAnimation: () => {} },
    '@expo/vector-icons/Ionicons': 'Icon', '@finanzapp/domain': domain,
    // useStacked is components.tsx's real rule: rowStacks over the row's amount text at this window.
    './components': { AppText: 'AppText', CategoryBadge: 'CategoryBadge', Money: 'Money', PressFeedback: 'PressFeedback', rowAmountText,
      useStacked: (amount?: { minor: number; currency: domain.Currency; signed?: boolean }) =>
        rowStacks(window.width, window.fontScale, amount ? rowAmountText(amount.minor, amount.currency, amount.signed ?? false, i18n.locale) : undefined) },
    './geometry': geometry, './report-presentation': presentation, './motion': { timing: () => ({ duration: 0 }) },
    './theme': { useReduceMotion: () => true, usePalette: () => ({ text: '#000', inset: '#ECEFF4', line: '#ddd', secondary: '#666', tertiary: '#999' }) },
    './category-hues': { useCategoryLook: (s: string) => ({ label: s, hex: '#3E6FB0', glyph: 'pricetag-outline' }) },
  };
  const module = { exports: {} as Record<string, (props: any) => any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected chart dependency: ' + name);
    return modules[name];
  } });
  return module.exports;
}
const textOf = (node: any): string => [node.props?.children].flat(Infinity).map(part => typeof part === 'string' ? part : '').join('');
/** The parts of a legend row: its text column, the name block and the amount block. */
function legend(row: any) {
  const column = row.props.children[1];
  const [nameBlock, amountBlock] = column.props.children;
  return { column, name: nameBlock.props.children[0], count: nameBlock.props.children[1], nameBlock, amountBlock };
}
const supermercado = { key: 'supermercado', category: 'Supermercado', amountMinor: 41276040, count: 12 };

test('a legend row at 375 pt puts «Supermercado» $ 412.760,40 under the name, with its share beside the amount', () => {
  const row = rows({ width: 375, fontScale: 1 }).CategoryLegendRow({ category: supermercado, totalMinor: 142331172, currency: 'ARS', onPress: () => {} });
  const { column, name, amountBlock, nameBlock } = legend(row);
  assert.equal(column.props.style.flexDirection, 'column', 'the amount goes under the name');
  assert.equal(column.props.style.alignItems, 'flex-start');
  assert.equal(textOf(name), 'Supermercado');
  assert.equal(name.props.numberOfLines, undefined, 'a stacked name has no line limit');
  assert.equal(nameBlock.props.style.flex, undefined, 'the name block takes its own height, not a share of a line');
  // The amount and its percentage stay together, in one column under the name.
  const [money, share] = amountBlock.props.children;
  assert.equal(money.type, 'Money');
  assert.deepEqual([money.props.minor, money.props.currency], [41276040, 'ARS'], 'the exact amount, never shrunk to fit');
  assert.equal(share.type, 'AppText');
  assert.equal(textOf(share), presentation.spendingShare(41276040, 142331172, 'es-AR').label);
  assert.equal(textOf(share), '29 %');
  assert.equal(amountBlock.props.style.alignItems, 'flex-start', 'the amount column starts under the name');
  // The same row at 393 pt: one line, name beside the amount, the name limited to two lines.
  const wide = legend(rows({ width: 393, fontScale: 1 }).CategoryLegendRow({ category: supermercado, totalMinor: 142331172, currency: 'ARS', onPress: () => {} }));
  assert.equal(wide.column.props.style.flexDirection, 'row');
  assert.equal(wide.name.props.numberOfLines, 2);
  assert.equal(wide.amountBlock.props.style.alignItems, 'flex-end');
  assert.equal(wide.nameBlock.props.style.flex, 1);
});

test('a legend row stacks at large text and keeps a short name beside its amount at the default size', () => {
  const comida = { key: 'comida', category: 'Comida', amountMinor: 120000, count: 2 };
  assert.equal(legend(rows({ width: 375, fontScale: 1 }).CategoryLegendRow({ category: comida, totalMinor: 240000, currency: 'ARS', onPress: () => {} })).column.props.style.flexDirection, 'row');
  const large = legend(rows({ width: 430, fontScale: 1.353 }).CategoryLegendRow({ category: comida, totalMinor: 240000, currency: 'ARS', onPress: () => {} }));
  assert.equal(large.column.props.style.flexDirection, 'column');
  assert.equal(large.name.props.numberOfLines, undefined);
  // A 13-digit amount stacks even beside a short name (the amount's own rule), on every width up to 430 pt.
  for (const width of [320, 375, 393, 430]) {
    const ropa = { key: 'ropa', category: 'Ropa', amountMinor: 1234567890123, count: 1 };
    assert.equal(legend(rows({ width, fontScale: 1 }).CategoryLegendRow({ category: ropa, totalMinor: 1234567890123, currency: 'ARS', onPress: () => {} })).column.props.style.flexDirection, 'column', `${width} pt`);
  }
});

test('a chosen legend row is marked beyond colour: selected for VoiceOver, a bold name and a 1.5 pt outline in its hue', () => {
  const view = rows({ width: 393, fontScale: 1 });
  const chosen = view.CategoryLegendRow({ category: supermercado, totalMinor: 142331172, currency: 'ARS', onPress: () => {}, chosen: true });
  assert.equal(chosen.props.accessibilityState.selected, true);
  assert.equal(legend(chosen).name.props.style.fontWeight, '700');
  const outline = chosen.props.style[1];
  assert.equal(outline.borderWidth, 1.5);
  assert.equal(outline.borderColor, '#3E6FB0', 'the category\'s own hue');
  assert.equal(outline.borderBottomWidth, 1.5, 'the outline replaces the hairline separator');
  assert.equal(outline.borderBottomColor, '#3E6FB0');
  assert.equal(outline.borderRadius, 14);
  assert.equal(outline.backgroundColor, '#3E6FB014', 'an 8 % tint of the hue');
  const plain = view.CategoryLegendRow({ category: supermercado, totalMinor: 142331172, currency: 'ARS', onPress: () => {} });
  assert.equal(plain.props.accessibilityState.selected, false);
  assert.equal(legend(plain).name.props.style.fontWeight, '500');
  assert.equal(plain.props.style[1], null, 'not chosen: no outline');
  assert.equal(plain.props.accessibilityLabel, chosen.props.accessibilityLabel, 'the label is the same; the state says the choice');
  // A chosen row that stacks keeps both the mark and the stacked layout.
  const narrow = rows({ width: 375, fontScale: 1 }).CategoryLegendRow({ category: supermercado, totalMinor: 142331172, currency: 'ARS', onPress: () => {}, chosen: true });
  assert.equal(legend(narrow).column.props.style.flexDirection, 'column');
  assert.equal(legend(narrow).name.props.style.fontWeight, '700');
});

test('a category spending row follows the same rule: with its chevron it stacks at 375 pt, compact it has room', () => {
  const view = rows({ width: 375, fontScale: 1 });
  const nameLine = (row: any) => row.props.children[1].props.children[0];
  const full = nameLine(view.CategorySpendingRow({ category: supermercado, totalMinor: 142331172, currency: 'ARS', onPress: () => {} }));
  assert.equal(full.props.style.flexDirection, 'column');
  assert.equal(full.props.style.alignItems, 'flex-start');
  assert.equal(full.props.children[0].props.numberOfLines, undefined);
  const compact = nameLine(view.CategorySpendingRow({ category: supermercado, totalMinor: 142331172, currency: 'ARS', onPress: () => {}, compact: true }));
  assert.equal(compact.props.style.flexDirection, 'row', 'no chevron: 27 pt more, one line');
  assert.equal(compact.props.children[0].props.numberOfLines, 2);
});

test('24UX6C2 review: a joined emoji sequence and a flag are one glyph each; the katakana middle dot is full width', () => {
  const em = (text: string) => Math.round(geometry.labelWidthEm(text) / geometry.SAFETY * 100) / 100;
  assert.equal(em('\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}'), 1.25, 'a family of four people joined by U+200D is one emoji');
  assert.equal(em('\u{1F3F3}️‍\u{1F308}'), 1.25, 'the rainbow flag is one emoji');
  assert.equal(em('\u{1F1E6}\u{1F1F7}'), 1.25, 'two regional indicators are one flag');
  assert.equal(em('\u{1F1E6}\u{1F1F7}\u{1F1FA}\u{1F1F8}'), 2.5, 'two flags side by side are two glyphs');
  assert.equal(em('・'), 1, 'the katakana middle dot');
  assert.equal(em('食料品・日用品'), 7);
});
