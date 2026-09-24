import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as i18nFormat from '../src/i18n/format.ts';
import * as locale from '../src/i18n/locale.ts';
import * as presentation from '../src/ui/presentation.ts';
import { bindLocale } from '../src/i18n/bind.ts';

// Producto 24B1, stage 1: ARS/USD goldens for the visible and spoken money texts that had none
// (docs/currency.md §7.5). They pin today's output so the later stages, which move these sites
// onto the catalogue formatters, are proven byte-identical for ARS and USD.
const jsx = (type: any, props: any) => ({ type, props });
const flat = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flat) : [value, ...flat(value.props?.children)];

function load(file: string, modules: Record<string, unknown>) {
  const source = readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected dependency of ' + file + ': ' + name);
    return modules[name];
  } });
  return module.exports;
}
const reanimated = { __esModule: true, default: { View: 'AnimatedView', ScrollView: 'AnimatedScrollView', Text: 'AnimatedText', createAnimatedComponent: (c: any) => c },
  Extrapolation: { CLAMP: 'clamp' }, interpolate: () => 0, cancelAnimation: () => {}, useAnimatedScrollHandler: () => () => {}, useAnimatedStyle: (fn: () => any) => fn,
  useSharedValue: (value: unknown) => ({ value }), withTiming: (value: number) => value };
const theme = { radius: { m: 12, l: 16 }, space: { s: 8, m: 12, l: 16, xl: 20, xxl: 28 }, usePalette: () => ({ text: '#000', secondary: '#666', line: '#ddd', surface: '#fff', background: '#fff', primary: '#2557D6', warning: '#B45309' }),
  useReduceMotion: () => true, useCurrentDay: () => '2026-09-20' };
const LOCALES = ['es-AR', 'en-AR', 'es-US', 'en-US'] as const;

test('the card face speaks its currency word for word: pesos for ARS, dólares/dollars for USD', () => {
  const read = (i18n: ReturnType<typeof bindLocale>, currency: domain.Currency) => {
    const { CardFace } = load('card-visual.tsx', {
      react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native-reanimated': reanimated, '@expo/vector-icons/Ionicons': 'Ionicons', '@finanzapp/domain': domain,
      'react-native': { StyleSheet: { create: (s: unknown) => s, hairlineWidth: 0.5 }, Text: 'Text', View: 'View', useWindowDimensions: () => ({ width: 393, fontScale: 1 }) },
      '../i18n/provider': { useI18n: () => i18n }, './components': { PressFeedback: 'PressFeedback' }, './geometry': { carouselIndex: () => 0 },
      './motion': { duration: { state: 200 }, selectionHaptic: () => {} }, './theme': theme,
    });
    const face = CardFace({ id: 'card', name: 'Visa Gold', issuer: 'Galicia', last4: '4009', currency, width: 300 });
    return { label: face.props.accessibilityLabel, language: face.props.accessibilityLanguage, chip: flat(face).find(node => node.type === 'Text' && node.props.children === currency)?.props.children };
  };
  assert.deepEqual(read(bindLocale('es-AR'), 'ARS'), { label: 'Tarjeta Visa Gold, Galicia, termina en 4009, pesos', language: undefined, chip: 'ARS' });
  assert.deepEqual(read(bindLocale('es-AR'), 'USD'), { label: 'Tarjeta Visa Gold, Galicia, termina en 4009, dólares', language: undefined, chip: 'USD' });
  assert.equal(read(bindLocale('en-US'), 'ARS').label, 'Card Visa Gold, Galicia, ending in 4009, Argentine pesos');
  assert.equal(read(bindLocale('en-US'), 'USD').label, 'Card Visa Gold, Galicia, ending in 4009, US dollars');
  assert.equal(read(bindLocale('en-US', 'native', 'es'), 'USD').language, 'en');
  for (const tag of LOCALES) assert.equal(read(bindLocale(tag), 'ARS').chip, 'ARS', tag + ': the ISO code is printed on the face, never a symbol');
});

test('the spending timeline caption and bar labels for ARS and USD in the four locales', () => {
  const buckets: domain.SpendingBucket[] = [
    { currency: 'ARS', startISO: '2026-09-01', endISO: '2026-09-07', amountMinor: 1234567, count: 3 },
    { currency: 'ARS', startISO: '2026-09-08', endISO: '2026-09-14', amountMinor: 50, count: 1 },
  ];
  const read = (i18n: ReturnType<typeof bindLocale>, currency: domain.Currency) => {
    const { SpendingTimeline } = load('spending-timeline.tsx', {
      react: { useEffect: () => {} }, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { ScrollView: 'ScrollView', View: 'View' }, 'react-native-reanimated': reanimated,
      'expo-router': { router: { push: () => {} } }, '@finanzapp/domain': domain, './components': { AppText: 'AppText', PressFeedback: 'PressFeedback' },
      './motion': { timing: () => ({ duration: 0 }) }, './theme': theme, '../i18n/format': i18nFormat, '../i18n/locale': locale, '../i18n/provider': { useI18n: () => i18n },
    });
    const tree = SpendingTimeline({ buckets: buckets.map(bucket => ({ ...bucket, currency })), currency });
    const texts = flat(tree).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
    const bars = flat(tree).filter(node => node.type === 'PressFeedback').map(node => node.props.accessibilityLabel);
    return { caption: texts[0], bars, axis: texts.slice(1, 3), footer: texts[3] };
  };
  assert.deepEqual(read(bindLocale('es-AR'), 'ARS'), { caption: 'Gasto registrado · máximo ARS 12.345,67',
    bars: ['1 sep – 7 sep, 12345,67 ARS, 3 gastos registrados', '8 sep – 14 sep, 0,50 ARS, 1 gasto registrado'], axis: ['1–7', '8–14'], footer: 'Días del período · tocá una barra para ver el detalle' });
  assert.deepEqual(read(bindLocale('es-AR'), 'USD').caption, 'Gasto registrado · máximo USD 12.345,67');
  assert.deepEqual(read(bindLocale('en-US'), 'USD'), { caption: 'Recorded spending · max USD 12,345.67',
    bars: ['Sep 1 – Sep 7, 12345.67 USD, 3 recorded expenses', 'Sep 8 – Sep 14, 0.50 USD, 1 recorded expense'], axis: ['1–7', '8–14'], footer: 'Days in the period · tap a bar for details' });
  assert.equal(read(bindLocale('en-AR'), 'ARS').caption, 'Recorded spending · max ARS 12.345,67');
  assert.equal(read(bindLocale('es-US'), 'ARS').caption, 'Gasto registrado · máximo ARS 12,345.67');
  assert.equal(read(bindLocale('es-US'), 'ARS').bars[0], '1 sep – 7 sep, 12345,67 ARS, 3 gastos registrados', 'VoiceOver keeps the language\'s decimal mark whatever the region');
});

test('the day-net header of the movement list: sign, visible amount and spoken twin for ARS and USD', () => {
  const at = '2026-09-20T12:00:00.000Z';
  const accounts: domain.Account[] = [{ id: 'a', name: 'Caja', currency: 'ARS', openingMinor: 0, createdAt: at }, { id: 'u', name: 'Dólares', currency: 'USD', openingMinor: 0, createdAt: at }];
  const entry = (id: string, accountId: string, kind: domain.EntryKind, amountMinor: number): domain.Entry =>
    ({ id, accountId, kind, amountMinor, merchant: 'Prueba', category: 'Comida', dateISO: '2026-09-19', createdAt: at });
  const read = (i18n: ReturnType<typeof bindLocale>, entries: domain.Entry[]) => {
    const { EntryList } = load('entry-list.tsx', {
      react: { useMemo: (fn: () => any) => fn() }, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { SectionList: 'SectionList', View: 'View' }, '@finanzapp/domain': domain,
      './components': { AppText: 'AppText', MovementRow: 'MovementRow' }, '../i18n/provider': { useI18n: () => i18n }, './presentation': presentation, './theme': theme,
    });
    const list = EntryList({ entries, accounts });
    const header = list.props.renderSectionHeader({ section: list.props.sections[0] });
    const texts = flat(header).filter(node => node.type === 'AppText');
    return { date: texts[0].props.children, net: texts[1] ? [texts[1].props.children].flat().join('') : null, spoken: texts[1]?.props.accessibilityLabel ?? null };
  };
  const mixed = [entry('e1', 'a', 'expense', 123456), entry('i1', 'a', 'income', 500000)];
  // The visible amount keeps a no-break space after the symbol; the spoken twin uses the language's decimal mark and no symbol.
  assert.deepEqual(read(bindLocale('es-AR'), mixed), { date: 'Ayer · 19 sep', net: '+$\u00A03.765,44', spoken: 'Neto del día 3765,44 ARS' });
  assert.deepEqual(read(bindLocale('es-AR'), [entry('e1', 'a', 'expense', 123456)]), { date: 'Ayer · 19 sep', net: '−$\u00A01.234,56', spoken: 'Neto del día menos 1234,56 ARS' });
  assert.deepEqual(read(bindLocale('en-US'), [entry('e1', 'u', 'expense', 99)]), { date: 'Yesterday · Sep 19', net: '−US$\u00A00.99', spoken: 'Net for the day minus 0.99 USD' });
  assert.deepEqual(read(bindLocale('en-AR'), [entry('e1', 'a', 'expense', 100)]), { date: 'Yesterday · Sep 19', net: '−$\u00A01,00', spoken: 'Net for the day minus 1.00 ARS' });
  assert.deepEqual(read(bindLocale('es-US'), [entry('i1', 'a', 'income', 100)]), { date: 'Ayer · 19 sep', net: '+AR$\u00A01.00', spoken: 'Neto del día 1,00 ARS' });
  // A day that mixes currencies shows no net at all, and a zero net shows nothing either.
  assert.deepEqual(read(bindLocale('es-AR'), [entry('e1', 'a', 'expense', 1), entry('e2', 'u', 'expense', 1)]).net, null);
  assert.deepEqual(read(bindLocale('es-AR'), [entry('e1', 'a', 'expense', 7), entry('i1', 'a', 'income', 7)]).net, null);
});
