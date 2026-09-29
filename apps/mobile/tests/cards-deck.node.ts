import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as cardFaces from '../src/ui/card-faces.ts';
import * as geometry from '../src/ui/geometry.ts';
import { bindLocale } from '../src/i18n/bind.ts';

// Producto 24T2: Tarjetas' vertical deck. The pure geometry and the face tones are checked as numbers; the deck and the
// face run for real against descriptor hosts (no UIKit, no frames, no touches): the order of the cards, the layers, the
// touch targets, what VoiceOver hears and which callback a tap reaches. Motion feel and hit testing need the iPhone.

const { deckExposure, deckLayout, DECK_MAX_TEXT_SCALE } = geometry;

test('a strip shows the face\'s first row at every text size, capped with the face text and never under 50 pt', () => {
  assert.equal(deckExposure(1), 50, '16 pt of padding, a 22 pt row and 10 pt of margin');
  assert.equal(deckExposure(0.82), 50, 'a smaller text size keeps a 50 pt target');
  assert.equal(deckExposure(1.15), 53);
  assert.equal(deckExposure(DECK_MAX_TEXT_SCALE), 57, 'the face text stops growing at 1.3, so does the strip');
  assert.equal(deckExposure(3.12), 57, 'the largest accessibility size');
  assert.equal(deckExposure(Number.NaN), 50, 'an unknown scale reads as the default');
  for (const scale of [0.5, 1, 1.2, 1.3, 2]) assert.ok(deckExposure(scale) >= 44, 'always a 44 pt target at least');
});

test('the deck keeps the stored order above the selected card, which is in front, last and highest; the height never depends on the selection', () => {
  const face = 223, strip = 50;
  assert.deepEqual(deckLayout(0, 0, strip, face), { tops: [], zIndex: [], containerHeight: 0 });
  // One card: just its face, no stack.
  assert.deepEqual(JSON.parse(JSON.stringify(deckLayout(1, 0, strip, face))), { tops: [0], zIndex: [0], containerHeight: face });
  // Two cards.
  assert.equal(JSON.stringify(deckLayout(2, 0, strip, face)), JSON.stringify({ tops: [50, 0], zIndex: [1, 0], containerHeight: 273 }));
  assert.equal(JSON.stringify(deckLayout(2, 1, strip, face)), JSON.stringify({ tops: [0, 50], zIndex: [0, 1], containerHeight: 273 }));
  // Three cards, each selection: the other two keep their relative order.
  assert.equal(JSON.stringify(deckLayout(3, 0, strip, face).tops), '[100,0,50]');
  assert.equal(JSON.stringify(deckLayout(3, 1, strip, face).tops), '[0,100,50]');
  assert.equal(JSON.stringify(deckLayout(3, 2, strip, face).tops), '[0,50,100]');
  // Eight cards: seven strips and one face (the page scrolls).
  const eight = deckLayout(8, 5, strip, face);
  assert.equal(JSON.stringify(eight.zIndex), '[0,1,2,3,4,7,5,6]');
  assert.equal(eight.containerHeight, 7 * 50 + face);
  for (let count = 1; count <= 8; count++) {
    const heights = new Set<number>();
    for (let selected = 0; selected < count; selected++) {
      const { tops, zIndex, containerHeight } = deckLayout(count, selected, strip, face);
      heights.add(containerHeight);
      assert.equal(zIndex[selected], count - 1, 'the selected card is above every strip');
      assert.equal(tops[selected], (count - 1) * strip, 'and sits at the bottom of the deck');
      assert.deepEqual([...zIndex].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index), 'one layer per card');
      tops.forEach((top, index) => assert.equal(top, zIndex[index] * strip));
      const others = tops.filter((_, index) => index !== selected);
      assert.ok(others.every((top, index) => index === 0 || top > others[index - 1]), 'the others keep the stored order');
    }
    assert.deepEqual([...heights], [(count - 1) * strip + face], count + ' cards: one height whatever is selected');
  }
  assert.equal(JSON.stringify(deckLayout(3, 7, strip, face).tops), '[100,0,50]', 'an index outside the deck falls back to the first card');
  assert.equal(JSON.stringify(deckLayout(3, -1, strip, face).tops), '[100,0,50]');
});

// WCAG 2 contrast, as tests/theme.node.ts measures the palette (kept local so the theme tests do not run twice more).
function luminance(hex: string): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(parseInt(hex.slice(1, 3), 16)) + 0.7152 * channel(parseInt(hex.slice(3, 5), 16)) + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
}
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
/** `over` at `alpha` composited on `base` (the face's white sheen, the issuer's softer white). */
function mix(base: string, over: string, alpha: number): string {
  return '#' + [1, 3, 5].map(index => Math.round(parseInt(base.slice(index, index + 2), 16) * (1 - alpha) + parseInt(over.slice(index, index + 2), 16) * alpha)
    .toString(16).padStart(2, '0')).join('');
}

test('24T2 review: with many cards the chosen one (always at the bottom of the deck) is scrolled into view; with a few, the page stays', () => {
  const { deckScrollTarget } = geometry;
  // An iPhone 15 (393 × 852): a 223 pt face, 50 pt strips, the deck 20 pt into the content and the page at rest under a
  // 103 pt header (content offset −103).
  const at = (count: number, contentOffset = -103, deckTop = 123) => deckScrollTarget({ count, exposure: 50, faceHeight: 223, deckTop, viewportTop: 0, viewportHeight: 852, contentOffset });
  for (const count of [1, 2, 3, 8, 12]) assert.equal(at(count), null, count + ' cards: the front card is already in view');
  // 20 cards: the front card's top would be at 123 + 19 × 50 = 1073, below the fold: scroll so it sits at a quarter of the viewport.
  assert.equal(at(20), -103 + 1073 - 213);
  // The same deck already scrolled so that its front card shows: nothing moves.
  assert.equal(at(20, 600, 123 - 703), null);
  // Never above the content's top.
  assert.equal(deckScrollTarget({ count: 30, exposure: 57, faceHeight: 223, deckTop: -2000, viewportTop: 0, viewportHeight: 852, contentOffset: 0 }), 0);
});

test('every face tone holds white text at 7:1 (base, sheen and highlight), and the issuer\'s softer white stays AA', () => {
  const tones = [...cardFaces.HASH_FACES, ...Object.values(cardFaces.COLOR_FACES)];
  assert.equal(tones.length, 6 + 11);
  for (const { base, highlight } of tones) {
    for (const ground of [base, highlight, mix(base, '#FFFFFF', 0.05)]) {
      assert.ok(contrast('#FFFFFF', ground) >= 7, `white on ${ground}: ${contrast('#FFFFFF', ground).toFixed(2)}`);
    }
    const issuer = mix(base, '#FFFFFF', 0.72);
    assert.ok(contrast(issuer, mix(base, '#FFFFFF', 0.05)) >= 4.5, `the issuer on ${base}: ${contrast(issuer, base).toFixed(2)}`);
  }
});

test('a card takes the deep tone of the colour its account chose, and its stable hash tone otherwise', () => {
  // Every appearance colour of the domain has its deep face, and nothing else does.
  assert.deepEqual(Object.keys(cardFaces.COLOR_FACES).sort(), domain.APPEARANCE_COLORS.map(color => color.id).sort());
  for (const color of domain.APPEARANCE_COLORS) assert.equal(cardFaces.cardFaceTone('card', color.id), cardFaces.COLOR_FACES[color.id]);
  const hash = cardFaces.HASH_FACES[cardFaces.cardFaceIndex('card')];
  assert.equal(cardFaces.cardFaceTone('card'), hash, 'no appearance row: the tone it always had');
  assert.equal(cardFaces.cardFaceTone('card', null), hash);
  assert.equal(cardFaces.cardFaceTone('card', 'neon'), hash, 'an unknown colour id never breaks a face');
  assert.equal(cardFaces.cardFaceTone('card', '__proto__'), hash);
  assert.equal(cardFaces.cardFaceIndex('card'), cardFaces.cardFaceIndex('card'), 'stable across calls');
  assert.equal(new Set(['a', 'b', 'c', 'd', 'e', 'f', 'visa', 'amex', 'card', 'usd-card'].map(cardFaces.cardFaceIndex)).size > 3, true, 'cards spread over the tones');
  // The hue of a chosen colour is kept: the deep cobalt is still a blue, the deep terracotta still warm.
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const raw = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (raw * 60 + 360) % 360;
  };
  for (const color of domain.APPEARANCE_COLORS) {
    if (color.id === 'graphite') continue; // a neutral: no hue to keep
    const distance = Math.abs(hue(cardFaces.COLOR_FACES[color.id].base) - hue(color.light));
    assert.ok(Math.min(distance, 360 - distance) <= 8, `${color.id} keeps its hue`);
  }
});

// ---- The real card-visual.tsx against descriptor hosts ----------------------------------------------------------------
type Node = { type: any; props: Record<string, any> };
const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
const flat = (value: any): Node[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flat) : [value, ...flat(value.props?.children)];

function visual(options: { locale?: ReturnType<typeof bindLocale>; reduced?: boolean; fontScale?: number; dark?: boolean } = {}) {
  const source = readFileSync(new URL('../src/ui/card-visual.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  let haptics = 0;
  const timings: { value: number; duration: number | undefined }[] = [];
  const modules: Record<string, unknown> = {
    react: { useEffect: (fn: () => void) => { fn(); } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Pressable: 'Pressable', StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, Text: 'Text', View: 'View',
      useWindowDimensions: () => ({ width: 393, fontScale: options.fontScale ?? 1 }) },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => ({ value }),
      withTiming: (value: number, config: { duration?: number }) => { timings.push({ value, duration: config?.duration }); return value; }, useAnimatedStyle: (fn: () => unknown) => fn },
    '@finanzapp/domain': domain,
    '../i18n/provider': { useI18n: () => options.locale ?? bindLocale('es-AR') },
    './card-faces': cardFaces, './geometry': geometry,
    './motion': { duration: { press: 100, release: 160 }, easeOut: 'easeOut', selectionHaptic: () => { haptics++; },
      timing: (kind: string, reduced: boolean) => ({ duration: reduced ? 0 : kind === 'data' ? 260 : 200 }) },
    './theme': { radius: { creditCard: 18 }, space: { xl: 20 }, usePalette: () => ({ isDark: options.dark ?? false }), useReduceMotion: () => options.reduced ?? false },
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected card-visual dependency: ' + name);
    return modules[name];
  } });
  return { ...module.exports, haptics: () => haptics, timings } as { CardDeck: (props: any) => Node; CardFace: (props: any) => Node; cardFaceLabel: any; cardFaceHeight: (w: number) => number;
    haptics: () => number; timings: typeof timings };
}

const visa = { id: 'visa', name: 'Visa Gold', issuer: 'Galicia', last4: '4009', currency: 'ARS' as const, color: null };
const amex = { id: 'amex', name: 'Amex', issuer: '', last4: '1001', currency: 'USD' as const, color: 'green' };
const naranja = { id: 'naranja', name: 'Naranja X', issuer: 'Naranja', last4: '', currency: 'ARS' as const, color: null };

/** Each card of a rendered deck: its layer, its offset, its face and its touch target. */
function slots(deck: Node) {
  return (deck.props.children as Node[]).map(slot => {
    const view = slot.type(slot.props) as Node;
    const style = view.props.style as any[];
    const animated = style.find(item => typeof item === 'function')();
    const [face, hit] = view.props.children as Node[];
    const target = Object.assign({}, ...(hit.props.style as object[]));
    return { id: face.props.id, zIndex: style.find(item => item && 'zIndex' in item).zIndex, top: animated.transform[0].translateY, scale: animated.transform[1].scale, face,
      hit: { ...hit.props, height: target.height, position: target.position } as Record<string, any> };
  });
}

test('the deck draws every card in the stored order, the selected one in front at the bottom; each card is one button with its face, its position and its state', () => {
  const view = visual();
  const { CardDeck, cardFaceHeight } = view;
  const selected: string[] = [], opened: string[] = [];
  const deck = CardDeck({ cards: [visa, amex, naranja], selectedId: 'amex', onSelect: (id: string) => selected.push(id), onOpen: (id: string) => opened.push(id) });
  const height = cardFaceHeight(353);
  assert.equal(height, 223);
  assert.equal(deck.props.style.height, 2 * 50 + height, 'two strips and one whole face');
  const cards = slots(deck);
  assert.equal(cards.map(card => card.id).join(','), 'visa,amex,naranja', 'the React tree keeps the stored order');
  assert.equal(cards.map(card => card.zIndex).join(','), '0,2,1');
  assert.equal(cards.map(card => card.top).join(','), '0,100,50');
  assert.equal(cards.map(card => card.hit.height).join(','), '50,223,50', 'a strip is touched only where it shows; the front card everywhere');
  assert.ok(cards.every(card => card.hit.position === 'absolute'), 'the target lies over the face, from its top edge');
  assert.ok(cards.every(card => card.scale === 1));
  // iOS layers the slots by zIndex and VoiceOver reads them top to bottom: Visa, Naranja, then the selected Amex. The
  // positions it hears follow that order, so the first card heard is «1 de 3» and the selected one «3 de 3».
  assert.deepEqual(cards.map(card => card.hit.accessibilityLabel), [
    'Tarjeta Visa Gold, Galicia, termina en 4009, pesos, Tarjeta 1 de 3',
    'Tarjeta Amex, termina en 1001, dólares, Tarjeta 3 de 3',
    'Tarjeta Naranja X, Naranja, pesos, Tarjeta 2 de 3',
  ]);
  assert.deepEqual(cards.map(card => card.hit.accessibilityHint), ['Selecciona esta tarjeta', 'Abre el detalle de la tarjeta', 'Selecciona esta tarjeta']);
  assert.deepEqual(cards.map(card => card.hit.accessibilityState.selected), [false, true, false]);
  assert.ok(cards.every(card => card.hit.accessibilityRole === 'button'));
  // The faces inside are pictures only: the button around each speaks for its card.
  for (const card of cards) {
    const face = card.face.type(card.face.props) as Node;
    assert.equal(face.props.accessible, false);
    assert.equal(face.props.accessibilityElementsHidden, true);
    assert.equal(face.props.accessibilityLabel, undefined);
  }
  assert.equal(cards[1].face.props.color, 'green', 'the colour chosen for the account reaches the face');

  // A strip selects its card, with one selection haptic; the card in front opens its detail, with none.
  cards[0].hit.onPress();
  assert.equal(JSON.stringify([selected, opened, view.haptics()]), JSON.stringify([['visa'], [], 1]), 'one haptic per change');
  cards[2].hit.onPress();
  assert.equal(JSON.stringify([selected, view.haptics()]), JSON.stringify([['visa', 'naranja'], 2]));
  cards[1].hit.onPress();
  assert.equal(JSON.stringify([opened, view.haptics()]), JSON.stringify([['amex'], 2]), 'opening is not a selection');
});

test('24T2 review: in dark mode the deck separates its cards by the faces\' rims, without the light-mode shadow', () => {
  const shadows = (deck: Node) => (deck.props.children as Node[]).map(slot => {
    const view = slot.type(slot.props) as Node;
    return (view.props.style as unknown[]).some(item => !!item && typeof item === 'object' && 'shadowOpacity' in (item as object));
  });
  const props = { cards: [visa, amex, naranja], selectedId: 'amex', onSelect() {}, onOpen() {} };
  assert.deepEqual(shadows(visual().CardDeck(props)), [true, true, true]);
  assert.deepEqual(shadows(visual({ dark: true }).CardDeck(props)), [false, false, false]);
  // The same layout and the same sentences in both themes: only the material changes.
  assert.equal(JSON.stringify(slots(visual({ dark: true }).CardDeck(props)).map(card => [card.top, card.hit.accessibilityLabel])),
    JSON.stringify(slots(visual().CardDeck(props)).map(card => [card.top, card.hit.accessibilityLabel])));
});

test('the cards move to their places in 260 ms, press like any card, and jump without movement under Reduce Motion', () => {
  const moving = visual();
  const cards = slots(moving.CardDeck({ cards: [visa, amex], selectedId: 'visa', onSelect: () => {}, onOpen: () => {} }));
  assert.equal(JSON.stringify(moving.timings.map(item => [item.value, item.duration])), JSON.stringify([[50, 260], [0, 260]]), 'each card animates to its target with timing(data)');
  moving.timings.length = 0;
  cards[1].hit.onPressIn();
  assert.equal(JSON.stringify(moving.timings.map(item => [item.value, item.duration])), JSON.stringify([[1, 100]]), 'pressed in 100 ms (0.97)');
  cards[1].hit.onPressOut();
  assert.equal(JSON.stringify(moving.timings.at(-1)), JSON.stringify({ value: 0, duration: 160 }));

  const still = visual({ reduced: true });
  const flat = slots(still.CardDeck({ cards: [visa, amex], selectedId: 'amex', onSelect: () => {}, onOpen: () => {} }));
  assert.ok(still.timings.every(item => item.duration === 0), 'Reduce Motion: the positions change without movement');
  still.timings.length = 0;
  flat[0].hit.onPressIn();
  assert.equal(still.timings.length, 0, 'and a press never scales');
  assert.equal(JSON.stringify(flat.map(card => card.top)), '[0,50]');
});

test('one card is just its face; large text grows the strips with the capped face text; English reads the same deck', () => {
  const { CardDeck } = visual();
  const [only] = slots(CardDeck({ cards: [visa], selectedId: null, onSelect: () => {}, onOpen: () => {} }));
  assert.equal(only.hit.accessibilityLabel, 'Tarjeta Visa Gold, Galicia, termina en 4009, pesos', 'no position for a single card');
  assert.equal(only.hit.height, 223);
  assert.equal(only.top, 0);

  const large = visual({ fontScale: 2 });
  const deck = large.CardDeck({ cards: [visa, amex], selectedId: 'missing', onSelect: () => {}, onOpen: () => {} });
  const cards = slots(deck);
  assert.equal(cards.map(card => card.top).join(','), '57,0', 'a selection that no longer exists falls back to the first card');
  assert.equal(deck.props.style.height, 57 + 223);

  const english = visual({ locale: bindLocale('en-US', 'native', 'es') });
  const read = slots(english.CardDeck({ cards: [visa, amex], selectedId: 'visa', onSelect: () => {}, onOpen: () => {} }));
  // Visa is selected: in front, read last («2 of 2»); Amex is the strip above it, read first.
  assert.deepEqual(read.map(card => card.hit.accessibilityLabel), ['Card Visa Gold, Galicia, ending in 4009, Argentine pesos, Card 2 of 2', 'Card Amex, ending in 1001, US dollars, Card 1 of 2']);
  assert.deepEqual(read.map(card => card.hit.accessibilityHint), ['Opens the card details', 'Selects this card']);
  assert.ok(read.every(card => card.hit.accessibilityLanguage === 'en'), 'the interface language, not the device\'s');
});

test('the face is identity only: name and «•••• 4009» on the strip row, the issuer and (with cards in several currencies) the code below; no contactless glyph', () => {
  const { CardFace } = visual();
  const face = CardFace({ ...visa, width: 353 });
  assert.equal(face.props.accessibilityLabel, 'Tarjeta Visa Gold, Galicia, termina en 4009, pesos');
  assert.equal(face.props.accessibilityRole, 'image');
  const texts = flat(face).filter(node => node.type === 'Text');
  assert.deepEqual(texts.map(node => node.props.children), ['Visa Gold', '•••• 4009', 'GALICIA', 'ARS']);
  for (const text of texts) assert.equal(text.props.maxFontSizeMultiplier, DECK_MAX_TEXT_SCALE, 'the face text is capped with the strip');
  const [name, last4] = texts;
  assert.equal(name.props.numberOfLines, 1);
  assert.equal(name.props.style.flexShrink, 1, 'the name gives way first');
  assert.equal(last4.props.style.flexShrink, 0, 'the last four digits are never cut or overlapped');
  assert.equal(face.props.style[1].backgroundColor, cardFaces.HASH_FACES[cardFaces.cardFaceIndex('visa')].base);
  // One currency held: no code printed (VoiceOver still says it); a chosen colour; no digits, no dots.
  const quiet = CardFace({ ...naranja, width: 353, showCurrency: false, color: 'terracotta' });
  assert.deepEqual(flat(quiet).filter(node => node.type === 'Text').map(node => node.props.children), ['Naranja X', 'NARANJA']);
  assert.equal(quiet.props.accessibilityLabel, 'Tarjeta Naranja X, Naranja, pesos');
  assert.equal(quiet.props.style[1].backgroundColor, cardFaces.COLOR_FACES.terracotta.base);
  const source = readFileSync(new URL('../src/ui/card-visual.tsx', import.meta.url), 'utf8');
  assert.equal(/wifi|Ionicons/.test(source), false, 'no fake contactless mark or network logo');
});
