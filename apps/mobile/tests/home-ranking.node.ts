import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as uiPresentation from '../src/ui/presentation.ts';
import { washOf } from '../src/ui/category-color.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let current: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(current) };

// A source/behaviour guard over Inicio's row modules (home-modules.tsx): the metric help, the one contextual line
// (24UX6A, it replaced the category ranking and the budget card) and the upcoming commitments. The look of the rows on
// an iPhone remains a device acceptance item.
const palette = { line: '#ddd', isDark: true, secondary: '#A0A0A8', tertiary: '#7C7C84', expense: '#FF6B5E', expenseSoft: '#FF6B5E22', warning: '#F5B342', warningSoft: '#F5B34222' };

function harness() {
  const source = readFileSync(new URL('../src/ui/home-modules.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  const env = { alerts: [] as unknown[][], pushed: [] as unknown[] };
  const modules: Record<string, any> = {
    '../i18n/provider': i18nProvider,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Alert: { alert: (...args: unknown[]) => { env.alerts.push(args); } }, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View' },
    'expo-router': { router: { push: (to: unknown) => { env.pushed.push(to); } } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': { AppText: 'AppText', MerchantBadge: 'MerchantBadge', Money: 'Money', PressFeedback: 'PressFeedback', Surface: 'Surface', useStacked: () => false },
    './category-color': { washOf },
    './category-hues': { useCategoryLook: (label: string) => ({ label, hex: '#' + label.length.toString().padStart(6, 'A'), glyph: 'restaurant-outline' }) },
    './presentation': uiPresentation,
    './theme': { usePalette: () => palette },
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected home-modules dependency: ' + name);
    return modules[name];
  } });
  return { env, exports: module.exports };
}
function flatten(value: any): any[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!value.props) return [];
  return [value, ...flatten(value.props.children)];
}
const textOf = (node: any) => [node.props.children].flat().join('');

test('24UX6A: an exceeded budget is one sentence with the amount over, in coral, and opens Presupuestos', () => {
  const { exports } = harness();
  let pressed = 0;
  const row = exports.HomeInsightRow({ insight: { kind: 'budgetExceeded', scope: 'total', category: null, currency: 'ARS', overMinor: 100000 }, onPress: () => { pressed++; } });
  assert.equal(row.type, 'PressFeedback');
  assert.equal(row.props.accessibilityRole, 'button');
  assert.equal(row.props.accessibilityLabel, 'Superaste tu presupuesto del mes por 1000,00 ARS.', 'VoiceOver hears the amount in words, ungrouped');
  assert.equal(row.props.accessibilityHint, 'Abre Presupuestos');
  const nodes = flatten(row);
  assert.equal(textOf(nodes.find(node => node.type === 'AppText')), 'Superaste tu presupuesto del mes por $ 1.000,00.');
  const glyph = nodes.find(node => node.type === 'Ionicons');
  assert.deepEqual([glyph.props.name, glyph.props.color], ['speedometer-outline', palette.expense]);
  assert.equal(nodes.find(node => node.type === 'View').props.style.backgroundColor, palette.expenseSoft);
  assert.equal(nodes.filter(node => node.type === 'Surface').length, 1, 'one quiet card, nothing else');
  assert.ok(nodes.filter(node => node.type !== 'PressFeedback').every(node => node.props.accessible === false || node.type === 'Surface' || node.type === 'View'), 'one element for VoiceOver');
  row.props.onPress();
  assert.equal(pressed, 1);
  const category = exports.HomeInsightRow({ insight: { kind: 'budgetExceeded', scope: 'category', category: 'Ocio', currency: 'USD', overMinor: 1250 }, labelsCurrency: true, onPress: () => {} });
  assert.equal(category.props.accessibilityLabel, 'Superaste tu presupuesto de Ocio por 12,50 USD.');
  assert.match(textOf(flatten(category).find(node => node.type === 'AppText')), /^Superaste tu presupuesto de Ocio por USD 12,50\.$/, 'another currency than the display: the amount carries its code');
});

test('24UX6A: a budget nearly spent says what share is left, in amber; the English reads the same facts', () => {
  const { exports } = harness();
  try {
    const low = { kind: 'budgetLow', scope: 'category', category: 'Comida', currency: 'ARS', leftShare: 0.12 };
    const row = exports.HomeInsightRow({ insight: low, onPress: () => {} });
    assert.equal(textOf(flatten(row).find(node => node.type === 'AppText')), 'Te queda 12 % de tu presupuesto de Comida.');
    assert.equal(row.props.accessibilityLabel, 'Te queda 12\u00A0% de tu presupuesto de Comida.', 'the share in the speech locale, ungrouped (VoiceOver says «por ciento»)');
    assert.equal(flatten(row).find(node => node.type === 'Ionicons').props.color, palette.warning);
    const total = exports.HomeInsightRow({ insight: { ...low, scope: 'total', category: null }, onPress: () => {} });
    assert.equal(total.props.accessibilityLabel, 'Te queda 12\u00A0% de tu presupuesto del mes.');
    current = 'en-US';
    const english = exports.HomeInsightRow({ insight: low, onPress: () => {} });
    assert.equal(textOf(flatten(english).find(node => node.type === 'AppText')), '12% of your Comida budget is left.');
    assert.equal(english.props.accessibilityHint, 'Opens Budgets');
    assert.equal(exports.HomeInsightRow({ insight: { kind: 'budgetExceeded', scope: 'total', category: null, currency: 'ARS', overMinor: 100000 }, onPress: () => {} }).props.accessibilityLabel,
      'You’re 1000.00 ARS over this month’s budget.');
  } finally { current = 'es-AR'; }
});

test('24UX6A: a concentrated month names the category with its own glyph and hue, and opens Reportes', () => {
  const { exports } = harness();
  const row = exports.HomeInsightRow({ insight: { kind: 'concentration', category: 'Comida', key: 'comida', currency: 'ARS', share: 0.46 }, onPress: () => {} });
  assert.equal(textOf(flatten(row).find(node => node.type === 'AppText')), 'Comida concentra 46 % de tus gastos de este mes.');
  assert.equal(row.props.accessibilityLabel, 'Comida concentra 46\u00A0% de tus gastos de este mes.');
  assert.equal(row.props.accessibilityHint, 'Abre Reportes');
  const glyph = flatten(row).find(node => node.type === 'Ionicons');
  assert.deepEqual([glyph.props.name, glyph.props.color], ['restaurant-outline', '#AAAAA6']);
  assert.equal(flatten(row).find(node => node.type === 'View').props.style.backgroundColor, washOf('#AAAAA6', palette), 'the category\'s faint wash, never a new colour');
  assert.doesNotMatch(JSON.stringify(row), /porque|because|deberías|should/i, 'a computed fact, never a cause or advice');
});

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
