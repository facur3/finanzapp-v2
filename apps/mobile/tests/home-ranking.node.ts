import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as uiPresentation from '../src/ui/presentation.ts';
import { homeBudgetAttention } from '../src/ui/home-focus.ts';
import { percentUsed } from '../src/ui/budget-presentation.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let current: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(current) };

// A source/behaviour guard over Inicio's row modules (home-modules.tsx): the metric help, the field's controls (24UX6A:
// the accounts button and the per-currency parts on the pine field) and the upcoming commitments. The insight line
// (HomeInsightRow) was removed by owner decision (24UX6A). 24UX6C2 adds the general budget's attention row (BudgetAttentionRow). The look of the rows on an iPhone remains a device acceptance item.
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
    './components': { AppText: 'AppText', GlyphTile: 'GlyphTile', MerchantBadge: 'MerchantBadge', Money: 'Money', PressFeedback: 'PressFeedback', useStacked: () => false },
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
  assert.equal(env.required.has('./home-focus'), false, '24UX6C2: only the BudgetAttention type comes from home-focus; nothing at runtime');
  assert.equal(env.required.has('./category-color'), false);
  assert.equal('HomeInsightRow' in exports, false, 'owner decision: Inicio carries no insight line');
  assert.equal(JSON.stringify(Object.keys(exports).sort()), JSON.stringify(['BudgetAttentionRow', 'CurrencyParts', 'FieldButton', 'MetricHelp', 'UpcomingRecurringRow']),
    '24UX6C2: the one budget row joins the modules; still no insight row');
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

// ---- 24UX6C2: the general budget's attention row ---------------------------------------------------------------
// Synthetic fixtures: one ARS account, one general budget of $ 100.000,00 for September, measured by the domain itself.
const budgetAt = '2026-09-01T12:00:00.000Z';
/** The attention the screen would hand the row: the domain's summary of `spentMinor` against a $ 100.000,00 general budget. */
function attentionFor(spentMinor: number, currency: domain.Currency = 'ARS') {
  const snapshot: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Banco', currency, openingMinor: 0, createdAt: budgetAt }],
    entries: [{ id: 'e', accountId: 'a', kind: 'expense', amountMinor: spentMinor, merchant: 'Comercio', category: 'Comida', dateISO: '2026-09-10', createdAt: budgetAt }] };
  const budget: domain.MonthlyBudget = { id: 'total', scope: 'total', currency, monthISO: '2026-09', amountMinor: 10_000_000, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt };
  const attention = homeBudgetAttention(domain.summarizeMonthlyBudgets(snapshot, [budget], currency, '2026-09'));
  assert.ok(attention, 'the fixture needs attention');
  return attention;
}
const NBSP = ' ';
/** The row's parts: the glyph tile, the title and the detail (two AppTexts), the chevron. */
function budgetParts(row: any) {
  const texts = flatten(row).filter(node => node.type === 'AppText');
  assert.equal(texts.length, 2, 'a title and a detail, nothing else');
  return { tile: flatten(row).find(node => node.type === 'GlyphTile'), title: texts[0], detail: texts[1], chevron: flatten(row).find(node => node.type === 'Ionicons') };
}

test('24UX6C2: a general budget at 87 % is a warning row: the speedometer in the warning tone, «Usaste 87 % del presupuesto del mes», what is left in amber', () => {
  const { exports } = harness();
  const attention = attentionFor(8_700_000);
  assert.equal(attention.state, 'warning');
  assert.equal(JSON.stringify([attention.progress.spentMinor, attention.progress.remainingMinor, attention.progress.ratio]), JSON.stringify([8_700_000, 1_300_000, 0.87]));
  const row = exports.BudgetAttentionRow({ attention, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
  assert.equal(row.type, 'PressFeedback');
  assert.equal(row.props.feedback, 'highlight', 'a cell in a grouped surface: the press tints it');
  assert.equal(row.props.accessibilityRole, 'button');
  assert.equal(row.props.style.minHeight, 60);
  const { tile, title, detail, chevron } = budgetParts(row);
  assert.equal(JSON.stringify([tile.props.icon, tile.props.tone, tile.props.size]), JSON.stringify(['speedometer-outline', 'warning', 36]));
  assert.equal(textOf(title), 'Usaste 87' + NBSP + '% del presupuesto del mes', 'formatPercent, with its no-break space');
  assert.equal(title.props.style.fontWeight, '600');
  assert.equal(title.props.style.color, undefined, 'the title is the ink');
  assert.equal(textOf(detail), 'Quedan $' + NBSP + '13.000,00 de $' + NBSP + '100.000,00');
  assert.equal(detail.props.variant, 'footnote');
  assert.equal(JSON.stringify([detail.props.style.color, detail.props.style.fontWeight]), JSON.stringify([palette.warning, '500']), 'amber, never the alert tone before the limit is passed');
  assert.equal(JSON.stringify([title.props.accessible, detail.props.accessible]), JSON.stringify([false, false]), 'one element for VoiceOver: the row');
  assert.equal(JSON.stringify([chevron.props.name, chevron.props.color, chevron.props.accessible]), JSON.stringify(['chevron-forward', palette.tertiary, false]));
});


test('24UX6C2 review: the row shows the whole percent Presupuestos and Reportes show (percentUsed), never a decimal', () => {
  const { exports } = harness();
  for (const [spent, percent] of [[8_750_000, 88], [8_740_000, 87], [8_500_000, 85], [9_949_000, 99]] as const) {
    const attention = attentionFor(spent);
    const row = exports.BudgetAttentionRow({ attention, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
    assert.equal(textOf(budgetParts(row).title), 'Usaste ' + percent + NBSP + '% del presupuesto del mes', String(spent));
    assert.equal(percentUsed(attention.progress), percent, 'the same number Presupuestos shows');
  }
});
test('24UX6C2: the warning holds from 85 % through exactly 100 %; above the limit it is exceeded', () => {
  const { exports } = harness();
  const at = (spent: number) => homeBudgetAttention(domain.summarizeMonthlyBudgets({ accounts: [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: budgetAt }],
    entries: [{ id: 'e', accountId: 'a', kind: 'expense', amountMinor: spent, merchant: 'Comercio', category: 'Comida', dateISO: '2026-09-10', createdAt: budgetAt }] },
  [{ id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 10_000_000, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt }], 'ARS', '2026-09'));
  assert.equal(at(8_499_999), null, 'calm below 85 %: no row');
  assert.equal(at(8_500_000)?.state, 'warning');
  const full = at(10_000_000)!;
  assert.equal(full.state, 'warning', 'exactly the limit is still a warning');
  assert.equal(textOf(budgetParts(exports.BudgetAttentionRow({ attention: full, currency: 'ARS', labelsCurrency: false, onPress: () => {} })).detail), 'Quedan $' + NBSP + '0,00 de $' + NBSP + '100.000,00');
  assert.equal(at(10_000_001)?.state, 'exceeded', 'one minor unit over');
});

test('24UX6C2: an exceeded general budget is the alert row: the alert glyph in the expense tone, «Superaste el presupuesto del mes», how much over in the expense colour', () => {
  const { exports } = harness();
  const attention = attentionFor(10_400_000);
  assert.equal(attention.state, 'exceeded');
  assert.equal(attention.progress.remainingMinor, -400_000);
  const row = exports.BudgetAttentionRow({ attention, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
  const { tile, title, detail } = budgetParts(row);
  assert.equal(JSON.stringify([tile.props.icon, tile.props.tone, tile.props.size]), JSON.stringify(['alert-circle-outline', 'expense', 36]));
  assert.equal(textOf(title), 'Superaste el presupuesto del mes', 'no percentage once the limit is passed');
  assert.equal(textOf(detail), '$' + NBSP + '4.000,00 por encima de $' + NBSP + '100.000,00', 'the amount over, unsigned');
  assert.equal(JSON.stringify([detail.props.style.color, detail.props.style.fontWeight]), JSON.stringify([palette.expense, '500']));
  assert.equal(row.props.accessibilityLabel, 'Superaste el presupuesto del mes, ' + bindLocale('es-AR').spokenMoney(400_000, 'ARS') + ' por encima de ' + bindLocale('es-AR').spokenMoney(10_000_000, 'ARS'));
  assert.equal(row.props.accessibilityLabel, 'Superaste el presupuesto del mes, 4000,00 pesos por encima de 100000,00 pesos', 'spoken money: ungrouped, the unit in words');
});

test('24UX6C2: when Inicio shows another currency the row names the budget\'s («del mes en ARS») and codes its amounts', () => {
  const { exports } = harness();
  const warning = budgetParts(exports.BudgetAttentionRow({ attention: attentionFor(8_700_000), currency: 'ARS', labelsCurrency: true, onPress: () => {} }));
  assert.equal(textOf(warning.title), 'Usaste 87' + NBSP + '% del presupuesto del mes en ARS');
  assert.equal(textOf(warning.detail), 'Quedan ' + bindLocale('es-AR').codedAmount(1_300_000, 'ARS') + ' de ' + bindLocale('es-AR').codedAmount(10_000_000, 'ARS'));
  assert.equal(textOf(warning.detail), 'Quedan ARS' + NBSP + '13.000,00 de ARS' + NBSP + '100.000,00', 'coded, never the bare $ another currency could share');
  const exceeded = budgetParts(exports.BudgetAttentionRow({ attention: attentionFor(10_400_000), currency: 'ARS', labelsCurrency: true, onPress: () => {} }));
  assert.equal(textOf(exceeded.title), 'Superaste el presupuesto del mes en ARS');
  assert.equal(textOf(exceeded.detail), 'ARS' + NBSP + '4.000,00 por encima de ARS' + NBSP + '100.000,00');
});

test('24UX6C2: VoiceOver hears the spoken percent and spoken money, the hint says the row opens Presupuestos, and a tap is the caller\'s', () => {
  const { exports } = harness();
  let pressed = 0;
  const es = bindLocale('es-AR');
  const row = exports.BudgetAttentionRow({ attention: attentionFor(8_700_000), currency: 'ARS', labelsCurrency: false, onPress: () => { pressed++; } });
  assert.equal(row.props.accessibilityLabel, 'Usaste ' + es.spokenPercent(0.87) + ' del presupuesto del mes, Quedan ' + es.spokenMoney(1_300_000, 'ARS') + ' de ' + es.spokenMoney(10_000_000, 'ARS'));
  assert.equal(row.props.accessibilityLabel.includes('$'), false, 'no visible money formatter reaches the label');
  assert.match(row.props.accessibilityLabel, /13000,00 pesos de 100000,00 pesos$/);
  assert.equal(row.props.accessibilityHint, 'Abre Presupuestos');
  const coded = exports.BudgetAttentionRow({ attention: attentionFor(8_700_000), currency: 'ARS', labelsCurrency: true, onPress: () => {} });
  assert.equal(coded.props.accessibilityLabel, 'Usaste ' + es.spokenPercent(0.87) + ' del presupuesto del mes en ARS, Quedan 13000,00 pesos de 100000,00 pesos', 'spoken money even when the screen codes the amounts');
  row.props.onPress();
  assert.equal(pressed, 1, 'onPress is wired to the row');
});

test('24UX6C2: the budget row in English', () => {
  const { exports } = harness();
  try {
    current = 'en-US';
    const en = bindLocale('en-US');
    const warning = exports.BudgetAttentionRow({ attention: attentionFor(8_700_000), currency: 'ARS', labelsCurrency: false, onPress: () => {} });
    assert.equal(textOf(budgetParts(warning).title), 'You used ' + en.formatPercent(0.87) + ' of this month’s budget');
    assert.equal(textOf(budgetParts(warning).detail), en.moneyText(1_300_000, 'ARS') + ' left of ' + en.moneyText(10_000_000, 'ARS'));
    assert.equal(textOf(budgetParts(warning).detail), 'AR$' + NBSP + '13,000.00 left of AR$' + NBSP + '100,000.00');
    assert.equal(warning.props.accessibilityHint, 'Opens Budgets');
    assert.equal(warning.props.accessibilityLabel, 'You used ' + en.spokenPercent(0.87) + ' of this month’s budget, ' + en.spokenMoney(1_300_000, 'ARS') + ' left of ' + en.spokenMoney(10_000_000, 'ARS'));
    const coded = budgetParts(exports.BudgetAttentionRow({ attention: attentionFor(8_700_000), currency: 'ARS', labelsCurrency: true, onPress: () => {} }));
    assert.equal(textOf(coded.title), 'You used ' + en.formatPercent(0.87) + ' of this month’s ARS budget');
    assert.equal(textOf(coded.detail), en.codedAmount(1_300_000, 'ARS') + ' left of ' + en.codedAmount(10_000_000, 'ARS'));
    const exceeded = exports.BudgetAttentionRow({ attention: attentionFor(10_400_000), currency: 'ARS', labelsCurrency: false, onPress: () => {} });
    assert.equal(textOf(budgetParts(exceeded).title), 'You went over this month’s budget');
    assert.equal(textOf(budgetParts(exceeded).detail), en.moneyText(400_000, 'ARS') + ' over ' + en.moneyText(10_000_000, 'ARS'));
    assert.equal(exceeded.props.accessibilityLabel, 'You went over this month’s budget, ' + en.spokenMoney(400_000, 'ARS') + ' over ' + en.spokenMoney(10_000_000, 'ARS'));
    assert.equal(textOf(budgetParts(exports.BudgetAttentionRow({ attention: attentionFor(10_400_000), currency: 'ARS', labelsCurrency: true, onPress: () => {} })).title), 'You went over this month’s ARS budget');
  } finally { current = 'es-AR'; }
});
