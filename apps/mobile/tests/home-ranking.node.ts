import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as uiPresentation from '../src/ui/presentation.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let current: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(current) };

// A source/behaviour guard over Inicio's row modules (home-modules.tsx): the metric help, the field's controls (24UX6A:
// the accounts button and the per-currency parts on the pine field) and the upcoming commitments. The insight line
// (HomeInsightRow) was removed by owner decision (24UX6A). The look of the rows on an iPhone remains a device acceptance item.
const palette = {
  line: '#ddd', isDark: true, secondary: '#A0A0A8', tertiary: '#7C7C84', expense: '#FF6B5E', warning: '#F5B342',
  hero: '#14362D', heroInk: '#EEF5F1', heroSecondary: '#A8C4B9', heroControl: '#26493F',
};

function harness() {
  const source = readFileSync(new URL('../src/ui/home-modules.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const env = { alerts: [] as unknown[][], pushed: [] as unknown[], required: new Set<string>() };
  const modules: Record<string, any> = {
    '../i18n/provider': i18nProvider,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Alert: { alert: (...args: unknown[]) => { env.alerts.push(args); } }, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View' },
    'expo-router': { router: { push: (to: unknown) => { env.pushed.push(to); } } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': { AppText: 'AppText', MerchantBadge: 'MerchantBadge', Money: 'Money', PressFeedback: 'PressFeedback', useStacked: () => false },
    './category-hues': { useCategoryLook: (label: string) => ({ label, hex: '#' + label.length.toString().padStart(6, 'A'), glyph: 'restaurant-outline' }) },
    './presentation': uiPresentation,
    './theme': { usePalette: () => palette },
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected home-modules dependency: ' + name);
    env.required.add(name);
    return modules[name];
  } });
  return { env, exports: module.exports, mocked: Object.keys(modules) };
}
function flatten(value: any): any[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!value.props) return [];
  return [value, ...flatten(value.props.children)];
}
const textOf = (node: any) => [node.props.children].flat().join('');

test('the metric help opens a native alert whose button is named in the interface language, never left to iOS', () => {
  const { env, exports } = harness();
  try {
    for (const locale of ['es-AR', 'en-US'] as AppLocale[]) {
      current = locale;
      env.alerts.length = 0;
      const help = exports.MetricHelp({ title: 'Disponible', detail: 'Es el dinero registrado.' });
      assert.equal(help.props.accessibilityLabel, locale === 'es-AR' ? 'Qué significa Disponible' : 'What Disponible means');
      assert.equal(help.props.accessibilityRole, 'button');
      assert.deepEqual([help.props.children.type, help.props.children.props.color, help.props.children.props.size], ['Ionicons', '#A0A0A8', 18], '24UX1: the glyph is a control drawn in secondary ink, never tertiary');
      help.props.onPress();
      assert.equal(JSON.stringify(env.alerts), JSON.stringify([['Disponible', 'Es el dinero registrado.', [{ text: 'OK', style: 'cancel' }]]]), locale + ': one explicit button from the catalogue, still the cancel action (Esc and the escape gesture close it)');
    }
  } finally { current = 'es-AR'; }
});

test('an upcoming commitment reads its day inside the VoiceOver sentence in lower case, and keeps the capital where the caption starts', () => {
  const { exports } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 1234567, nextDateISO: '2026-09-22', accountId: 'a' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS' };
  const caption = (row: any) => flatten(row).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
  try {
    const spanish = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true });
    assert.equal(spanish.props.accessibilityLabel, 'Netflix, Suscripciones, 12345,67 ARS, próximo pago hoy, Banco', 'the account is always spoken');
    // 24UX2: the caption is the category (the secondary signal); the day appears once, beside the amount, capitalised.
    assert.equal(JSON.stringify(caption(spanish)), JSON.stringify(['Netflix', 'Suscripciones', 'Hoy']));
    current = 'en-US';
    const english = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true, showAccount: true });
    assert.equal(english.props.accessibilityLabel, 'Netflix, Suscripciones, 12345.67 ARS, next payment today, Banco');
    assert.ok(caption(english).includes('Suscripciones · Banco'), 'the account only when another could be meant');
    assert.ok(caption(english).includes('Today'));
    // A later day is the short date either way; within a week a count of days.
    const later = exports.UpcomingRecurringRow({ rule: { ...rule, nextDateISO: '2026-10-01' }, account, day: '2026-09-22', last: true });
    assert.equal(later.props.accessibilityLabel, 'Netflix, Suscripciones, 12345.67 ARS, next payment Oct 1, Banco');
    assert.ok(caption(later).includes('Oct 1'));
    assert.ok(caption(exports.UpcomingRecurringRow({ rule: { ...rule, nextDateISO: '2026-09-26' }, account, day: '2026-09-22', last: true })).includes('In 4 days'));
  } finally { current = 'es-AR'; }
});

test('24UX5: an upcoming commitment names its category only when asked; the day stays under the amount and VoiceOver keeps everything', () => {
  const { exports } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 100, nextDateISO: '2026-09-23', accountId: 'a' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS' };
  const texts = (row: any) => flatten(row).filter(node => node.type === 'AppText').map(node => [node.props.children].flat().join(''));
  const bare = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true, showCategory: false });
  assert.equal(JSON.stringify(texts(bare)), JSON.stringify(['Netflix', 'Mañana']), 'name, then the day under the amount');
  assert.equal(bare.props.accessibilityLabel, 'Netflix, Suscripciones, 1,00 ARS, próximo pago 23 sep, Banco', '24UX5 review: VoiceOver keeps the account the caption leaves out');
  const withAccount = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true, showCategory: false, showAccount: true });
  assert.equal(JSON.stringify(texts(withAccount)), JSON.stringify(['Netflix', 'Banco', 'Mañana']));
  const urgent = flatten(bare).filter(node => node.type === 'AppText').at(-1);
  assert.equal(urgent.props.style.fontWeight, '600', 'tomorrow is urgent (the warning tone)');
});

test('24UX2: an upcoming commitment draws its merchant mark with the category behind it, never instead of the category name', () => {
  const { exports } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 100, nextDateISO: '2026-09-23', accountId: 'a' };
  const row = exports.UpcomingRecurringRow({ rule, account: { id: 'a', name: 'Banco', currency: 'ARS' }, day: '2026-09-22', last: true });
  const badge = flatten(row).find(node => node.type === 'MerchantBadge');
  assert.equal(JSON.stringify([badge.props.merchant, badge.props.category, badge.props.kind]), JSON.stringify(['Netflix', 'Suscripciones', 'expense']));
  assert.equal(flatten(row).some(node => node.type === 'CategoryBadge'), false, 'the badge owns its fallback to the category glyph');
});

test('24UX3: the commitments are an agenda on the ground', () => {
  const { exports } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 100, nextDateISO: '2026-09-23', accountId: 'a' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS' };
  const row = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: false });
  assert.equal(row.props.feedback, 'opacity', 'no cell to tint on the ground: the press answer is a dim');
  assert.equal(row.props.style.paddingHorizontal, undefined, 'aligned with the section title, no inset card padding');
  assert.equal(flatten(row).find(node => node.type === 'MerchantBadge').props.size, undefined, '24UX5: the 40 pt mark of the latest transactions');
  assert.equal(row.props.style.minHeight, 56, 'the agenda stays tighter than the 64 pt ledger rows');
  const content = row.props.children[1];
  assert.equal(content.props.style.paddingVertical, 8);
  assert.equal(content.props.style.borderBottomWidth, 0.5, 'the hairline starts under the text, not under the mark');
  assert.equal(exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true }).props.children[1].props.style.borderBottomWidth, 0);
});

test('25B3: an upcoming commitment opens the rule\'s detail, never its form, and VoiceOver hears the rule and that the row opens details', () => {
  const { exports, env } = harness();
  const rule = { id: 'r', merchant: 'Netflix', category: 'Suscripciones', kind: 'expense', amountMinor: 100, nextDateISO: '2026-09-23', accountId: 'a' };
  const account = { id: 'a', name: 'Banco', currency: 'ARS' };
  try {
    const row = exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true });
    assert.equal(row.props.accessibilityRole, 'button');
    assert.equal(row.props.accessibilityHint, 'Abre el detalle del recurrente');
    assert.doesNotMatch(row.props.accessibilityLabel, /Editar|Edit/);
    row.props.onPress();
    assert.equal(JSON.stringify(env.pushed), JSON.stringify([{ pathname: '/recurring/[id]', params: { id: 'r' } }]));
    current = 'en-US';
    assert.equal(exports.UpcomingRecurringRow({ rule, account, day: '2026-09-22', last: true }).props.accessibilityHint, 'Opens the details of this recurring item');
  } finally { current = 'es-AR'; }
});

test('24UX6A: home-modules imports exactly what the harness mocks, and the insight row is gone', () => {
  const { env, exports, mocked } = harness();
  assert.equal([...env.required].sort().join(','), [...mocked].sort().join(','), 'no stale mock (Surface, washOf, home-focus are no longer imported) and no missing one');
  assert.equal(env.required.has('./home-focus'), false);
  assert.equal(env.required.has('./category-color'), false);
  assert.equal('HomeInsightRow' in exports, false, 'owner decision: Inicio carries no insight line');
  assert.equal(JSON.stringify(Object.keys(exports).sort()), JSON.stringify(['CurrencyParts', 'FieldButton', 'MetricHelp', 'UpcomingRecurringRow']));
});

test('24UX6A: the metric help takes the pine field\'s colour and keeps its «Qué significa» name and 44 pt target', () => {
  const { exports, env } = harness();
  const help = exports.MetricHelp({ title: 'Disponible', detail: 'Es el dinero registrado.', color: palette.heroSecondary });
  assert.equal(help.type, 'PressFeedback');
  assert.equal(help.props.accessibilityRole, 'button');
  assert.equal(help.props.accessibilityLabel, 'Qué significa Disponible', 'common.whatIs, whatever the colour');
  assert.equal(help.props.hitSlop, 10, 'an 18 pt glyph with the slop that makes a 44 pt target');
  assert.deepEqual([help.props.children.type, help.props.children.props.name, help.props.children.props.color, help.props.children.props.size, help.props.children.props.accessible],
    ['Ionicons', 'information-circle-outline', palette.heroSecondary, 18, false], 'drawn in the field\'s secondary ink on Inicio');
  help.props.onPress();
  assert.equal(JSON.stringify(env.alerts), JSON.stringify([['Disponible', 'Es el dinero registrado.', [{ text: 'OK', style: 'cancel' }]]]));
  assert.equal(exports.MetricHelp({ title: 'Gastado', detail: 'x' }).props.children.props.color, palette.secondary, 'off the field it stays the canvas\'s secondary ink');
});

test('24UX6A: the field button is a 44 pt circle with its label, the field\'s control fill and its ink', () => {
  const { exports } = harness();
  let pressed = 0;
  try {
    const button = exports.FieldButton({ icon: 'wallet-outline', label: 'Cuentas', onPress: () => { pressed++; } });
    assert.equal(button.type, 'PressFeedback');
    assert.equal(button.props.accessibilityRole, 'button');
    assert.equal(button.props.accessibilityLabel, 'Cuentas', 'named by the caller, so it follows the interface language');
    const style = button.props.style;
    assert.deepEqual([style.width, style.height, style.minHeight, style.borderRadius], [44, 44, 44, 22], 'a 44 pt circle');
    assert.equal(style.backgroundColor, palette.heroControl);
    const glyph = button.props.children;
    assert.deepEqual([glyph.type, glyph.props.name, glyph.props.color, glyph.props.accessible], ['Ionicons', 'wallet-outline', palette.heroInk, false], 'one element for VoiceOver');
    button.props.onPress();
    assert.equal(pressed, 1);
    current = 'en-US';
    assert.equal(exports.FieldButton({ icon: 'wallet-outline', label: 'Accounts', onPress: () => {} }).props.accessibilityLabel, 'Accounts');
  } finally { current = 'es-AR'; }
});

test('24C1/24UX6A: each currency\'s own figure stands in for a missing total; on the field it uses the field\'s ink and secondary ink', () => {
  const { exports } = harness();
  const parts = [{ currency: 'ARS', minor: 150000 }, { currency: 'USD', minor: 2500 }];
  const props = { parts, line: 'Falta la cotización', detail: 'Sin cotización del día.' };
  const onField = exports.CurrencyParts({ ...props, onField: true });
  const nodes = flatten(onField);
  const money = nodes.filter(node => node.type === 'Money');
  assert.equal(JSON.stringify(money.map(node => [node.props.currency, node.props.minor, node.props.color])),
    JSON.stringify([['ARS', 150000, palette.heroInk], ['USD', 2500, palette.heroInk]]), 'one figure per currency, never a partial sum');
  const line = nodes.find(node => node.type === 'AppText');
  assert.equal(textOf(line), 'Falta la cotización');
  assert.equal([line.props.style].flat().find((style: any) => style && style.color)?.color, palette.heroSecondary);
  const help = nodes.find(node => node.type === exports.MetricHelp);
  assert.ok(help, 'the reason sits behind the info button');
  assert.deepEqual([help.props.title, help.props.detail, help.props.color], ['Cotizaciones', 'Sin cotización del día.', palette.heroSecondary]);

  const canvas = flatten(exports.CurrencyParts(props));
  assert.equal(canvas.filter(node => node.type === 'Money').every(node => node.props.color === undefined), true, 'off the field: the canvas\'s own ink');
  assert.equal([canvas.find(node => node.type === 'AppText').props.style].flat().some((style: any) => style && style.color), false);
  assert.equal(canvas.find(node => node.type === exports.MetricHelp).props.color, undefined);
});
