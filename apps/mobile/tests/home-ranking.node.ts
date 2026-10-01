import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as domain from '@finanzapp/domain';
import * as uiPresentation from '../src/ui/presentation.ts';
import { budgetAttentions, homeBudgetAttention } from '../src/ui/home-focus.ts';
import * as budgetPresentation from '../src/ui/budget-presentation.ts';
import * as geometry from '../src/ui/geometry.ts';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
// Read on every render, like the live provider; a test may switch it and must restore it.
let current: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(current) };

// A source/behaviour guard over Inicio's row modules (home-modules.tsx): the metric help, the field's controls (24UX6A:
// the accounts button and the per-currency parts on the pine field) and the upcoming commitments. The insight line
// (HomeInsightRow) was removed by owner decision (24UX6A). 24UX6C2 adds the general budget's attention row (BudgetAttentionRow),
// drawn since 24UX6D as a compact progress row (name and percent, a bar, one quiet line). The look of the rows on an iPhone,
// the bar's motion and the row at the largest text sizes remain device acceptance items. Since the 24UX6D refinement the
// same row draws a category budget, named by its localized category (`useCategoryLabel`), never in the category's hue.
const palette = {
  line: '#ddd', isDark: true, secondary: '#A0A0A8', tertiary: '#7C7C84', expense: '#FF6B5E', warning: '#F5B342', inset: '#171E1B',
  hero: '#14362D', heroInk: '#EEF5F1', heroSecondary: '#A8C4B9', heroControl: '#26493F',
};

/** The harness's English names for stored default categories (the real hook resolves them from the catalogue). */
const CATEGORY_EN: Record<string, string> = { Supermercado: 'Groceries' };

function harness() {
  const source = readFileSync(new URL('../src/ui/home-modules.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  // 24UX6D: the window the budget row measures (`useWindowDimensions`), the Reduce Motion setting its bar reads, and every
  // `withTiming` the bar asks for, so a test can drive the row at large text and check the motion without React.
  const env = { alerts: [] as unknown[][], pushed: [] as unknown[], required: new Set<string>(), window: { width: 393, height: 852, fontScale: 1 }, reduced: false,
    timings: [] as { to: number; config: any }[],
    /** Every stored category the row asked `useCategoryLabel` to localize, in order. */
    labels: [] as string[],
    // A minimal hook runtime for the bar (24UX6D review): shared values keep their slot across renders, and effects are
    // queued with their deps and run only by `flush()`, after the render, as React does. `begin()` starts a render.
    slots: [] as { value: number }[], deps: [] as (unknown[] | undefined)[], queued: [] as (() => void)[], cursor: 0, effectCursor: 0,
    begin() { this.cursor = 0; this.effectCursor = 0; }, flush() { const run = this.queued.splice(0); for (const effect of run) effect(); } };
  const modules: Record<string, any> = {
    '../i18n/provider': i18nProvider,
    'react': { useEffect: (effect: () => void, deps?: unknown[]) => {
      const index = env.effectCursor++, previous = env.deps[index];
      if (!previous || !deps || deps.length !== previous.length || deps.some((item, i) => item !== previous[i])) { env.deps[index] = deps; env.queued.push(effect); }
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Alert: { alert: (...args: unknown[]) => { env.alerts.push(args); } }, StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View',
      useWindowDimensions: () => env.window },
    'react-native-reanimated': { __esModule: true, default: { View: 'Animated.View' }, useSharedValue: (value: number) => { const index = env.cursor++; if (!(index in env.slots)) env.slots[index] = { value }; return env.slots[index]; }, useAnimatedStyle: (style: () => unknown) => style(),
      withTiming: (to: number, config: unknown) => { env.timings.push({ to, config }); return to; } },
    'expo-router': { router: { push: (to: unknown) => { env.pushed.push(to); } } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './budget-presentation': budgetPresentation,
    './components': { AppText: 'AppText', MerchantBadge: 'MerchantBadge', Money: 'Money', PressFeedback: 'PressFeedback', useStacked: () => false },
    './category-hues': { useCategoryLook: (label: string) => ({ label, hex: '#' + label.length.toString().padStart(6, 'A'), glyph: 'restaurant-outline' }),
      // Localizes like the real hook: a stored default category reads in the interface language («Supermercado» → «Groceries»).
      useCategoryLabel: (stored: string) => { env.labels.push(stored); return current === 'en-US' ? CATEGORY_EN[stored] ?? stored : stored; } },
    './geometry': geometry,
    // motion.tsx's own rule (`timing`: the kind's duration, zero under Reduce Motion), without loading Reanimated.
    './motion': { timing: (kind: string, reduced: boolean) => ({ kind, duration: reduced ? 0 : kind === 'data' ? 260 : -1 }) },
    './presentation': uiPresentation,
    './theme': { usePalette: () => palette, useReduceMotion: () => env.reduced },
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
  assert.equal([...env.required].sort().join(','), [...mocked].sort().join(','), 'no stale mock (Surface, washOf, home-focus, GlyphTile are no longer imported) and no missing one');
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

// ---- 24UX6C2, 24UX6D: the general budget's attention row as a compact progress row -----------------------------------
// Synthetic fixtures: one account, one general budget for September (by default $ 100.000,00), measured by the domain itself.
const budgetAt = '2026-09-01T12:00:00.000Z';
/** The attention the screen would hand the row: the domain's summary of `spentMinor` against a general budget of `limitMinor`. */
function attentionFor(spentMinor: number, currency: domain.Currency = 'ARS', limitMinor = 10_000_000) {
  const snapshot: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Banco', currency, openingMinor: 0, createdAt: budgetAt }],
    entries: [{ id: 'e', accountId: 'a', kind: 'expense', amountMinor: spentMinor, merchant: 'Comercio', category: 'Comida', dateISO: '2026-09-10', createdAt: budgetAt }] };
  const budget: domain.MonthlyBudget = { id: 'total', scope: 'total', currency, monthISO: '2026-09', amountMinor: limitMinor, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt };
  const attention = homeBudgetAttention(domain.summarizeMonthlyBudgets(snapshot, [budget], currency, '2026-09'));
  assert.ok(attention, 'the fixture needs attention');
  return attention;
}
const NBSP = ' ';
const es = bindLocale('es-AR');
const budgetRow = (exports: Record<string, any>, spent: number, labelsCurrency = false, onPress = () => {}) =>
  exports.BudgetAttentionRow({ attention: attentionFor(spent), currency: 'ARS', labelsCurrency, onPress });
/** The row's parts (24UX6D): the name, the percent (with the alert glyph only when exceeded), the bar, the quiet detail, the chevron. */
function budgetParts(row: any) {
  const all = flatten(row);
  const texts = all.filter(node => node.type === 'AppText');
  assert.equal(texts.length, 3, 'the name, the percent and the detail, nothing else');
  const [content, chevron] = row.props.children;
  const [header] = content.props.children;
  return { all, header, title: texts[0], percent: texts[1], detail: texts[2], chevron,
    meter: all.find(node => typeof node.type === 'function' && node.type.name === 'BudgetMeter'),
    alert: all.find(node => node.type === 'Ionicons' && node.props.name === 'alert-circle'),
    tile: all.find(node => node.type === 'GlyphTile') };
}

test('24UX6D: a general budget at 87 % is a warning progress row: «Presupuesto», «87 %» in amber, an amber bar at 0.87, «Quedan $ 13.000,00» quiet', () => {
  const { exports } = harness();
  const attention = attentionFor(8_700_000);
  assert.equal(attention.state, 'warning');
  assert.equal(JSON.stringify([attention.progress.spentMinor, attention.progress.remainingMinor, attention.progress.ratio]), JSON.stringify([8_700_000, 1_300_000, 0.87]));
  const row = exports.BudgetAttentionRow({ attention, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
  assert.equal(row.type, 'PressFeedback');
  assert.equal(row.props.feedback, 'highlight', 'a cell in a grouped surface: the press tints it');
  assert.equal(row.props.accessibilityRole, 'button');
  assert.ok(row.props.style.minHeight >= 44, 'a 44 pt target at least');
  assert.equal(row.props.style.minHeight, 64);
  const { all, header, title, percent, detail, chevron, meter, alert, tile } = budgetParts(row);
  assert.equal(textOf(title), 'Presupuesto', 'one word: Inicio is already the month');
  assert.equal(title.props.style.fontWeight, '600');
  assert.equal(title.props.style.color, undefined, 'the name is the ink');
  assert.equal(textOf(percent), '87' + NBSP + '%', 'formatPercent, with its no-break space');
  assert.equal(JSON.stringify([percent.props.style.color, percent.props.style.fontWeight, percent.props.style.fontVariant]), JSON.stringify([palette.warning, '600', ['tabular-nums']]));
  assert.equal(alert, undefined, 'the alert glyph is the exceeded state\'s only');
  assert.equal(JSON.stringify([header.props.style.flexDirection, header.props.style.justifyContent]), JSON.stringify(['row', 'space-between']), 'the name left, the percent right');
  assert.equal(JSON.stringify([meter.props.fraction, meter.props.color]), JSON.stringify([0.87, palette.warning]));
  assert.equal(textOf(detail), 'Quedan $' + NBSP + '13.000,00', 'no «de {limit}», no «Usaste … del presupuesto del mes»');
  assert.equal(JSON.stringify([detail.props.variant, detail.props.secondary, detail.props.style]), JSON.stringify(['footnote', true, undefined]), 'quiet: secondary ink, no tone of its own');
  assert.equal(all.filter(node => node.type === 'AppText').every(node => node.props.accessible === false), true, 'one element for VoiceOver: the row');
  assert.equal(all.some(node => node.props.numberOfLines !== undefined), false, 'nothing truncated: the name and the detail wrap');
  assert.equal(JSON.stringify([chevron.type, chevron.props.name, chevron.props.color, chevron.props.size, chevron.props.accessible]), JSON.stringify(['Ionicons', 'chevron-forward', palette.tertiary, 13, false]));
  assert.equal(tile, undefined, '24UX6D: no glyph tile; the bar carries the state');
});

test('24UX6C2 review, 24UX6D: the row shows the whole percent Presupuestos and Reportes show (percentUsed), never a decimal', () => {
  const { exports } = harness();
  for (const [spent, whole] of [[8_750_000, 88], [8_740_000, 87], [8_500_000, 85], [9_949_000, 99], [10_049_000, 100], [12_345_678, 123]] as const) {
    const attention = attentionFor(spent);
    const row = exports.BudgetAttentionRow({ attention, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
    assert.equal(textOf(budgetParts(row).percent), whole + NBSP + '%', String(spent));
    assert.equal(budgetPresentation.percentUsed(attention.progress), whole, 'the same number Presupuestos shows');
  }
});

test('24UX6C2, 24UX6D: the warning holds from exactly 85 % through exactly 100 % («Límite alcanzado», still amber); one minor unit over is exceeded', () => {
  const { exports } = harness();
  const at = (spent: number) => homeBudgetAttention(domain.summarizeMonthlyBudgets({ accounts: [{ id: 'a', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt: budgetAt }],
    entries: [{ id: 'e', accountId: 'a', kind: 'expense', amountMinor: spent, merchant: 'Comercio', category: 'Comida', dateISO: '2026-09-10', createdAt: budgetAt }] },
  [{ id: 'total', scope: 'total', currency: 'ARS', monthISO: '2026-09', amountMinor: 10_000_000, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt }], 'ARS', '2026-09'));
  assert.equal(at(8_499_999), null, 'calm below 85 %: no row');
  const edge = budgetParts(budgetRow(exports, 8_500_000));
  assert.equal(at(8_500_000)?.state, 'warning');
  assert.equal(JSON.stringify([textOf(edge.percent), textOf(edge.detail), edge.meter.props.fraction, edge.meter.props.color]),
    JSON.stringify(['85' + NBSP + '%', 'Quedan $' + NBSP + '15.000,00', 0.85, palette.warning]));
  const full = at(10_000_000)!;
  assert.equal(full.state, 'warning', 'exactly the limit is still a warning');
  const reached = exports.BudgetAttentionRow({ attention: full, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
  const parts = budgetParts(reached);
  assert.equal(JSON.stringify([textOf(parts.percent), parts.percent.props.style.color, textOf(parts.detail), parts.meter.props.fraction, parts.meter.props.color, parts.alert]),
    JSON.stringify(['100' + NBSP + '%', palette.warning, 'Límite alcanzado', 1, palette.warning, undefined]), 'a full amber bar, never the alert tone before the limit is passed');
  assert.equal(reached.props.accessibilityLabel, 'Presupuesto del mes, límite alcanzado, ' + es.spokenPercent(1) + ' usado');
  assert.equal(at(10_000_001)?.state, 'exceeded', 'one minor unit over');
});

test('24UX6D: an exceeded general budget at 120 %: the text says 120 %, the bar stops at the full track, the alert tone, the alert glyph and «por encima»', () => {
  const { exports } = harness();
  const attention = attentionFor(12_000_000);
  assert.equal(attention.state, 'exceeded');
  assert.equal(attention.progress.remainingMinor, -2_000_000);
  const row = exports.BudgetAttentionRow({ attention, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
  const { header, percent, detail, meter, alert } = budgetParts(row);
  assert.equal(textOf(percent), '120' + NBSP + '%', 'the real share, past 100 %');
  assert.equal(percent.props.style.color, palette.expense);
  assert.equal(JSON.stringify([meter.props.fraction, meter.props.color]), JSON.stringify([1, palette.expense]), 'visually clamped at the full track');
  assert.ok(alert, 'more than colour: an alert glyph beside the percent');
  assert.equal(JSON.stringify([alert.props.color, alert.props.size, alert.props.accessible]), JSON.stringify([palette.expense, 15, false]));
  const group = header.props.children[1];
  assert.equal(JSON.stringify([group.props.children[0].props.name, group.props.children[1].type]), JSON.stringify(['alert-circle', 'AppText']), 'the glyph before the percent');
  assert.equal(textOf(detail), '$' + NBSP + '20.000,00 por encima', 'the amount over, unsigned, without the limit');
  assert.equal(row.props.accessibilityLabel, 'Presupuesto del mes superado, ' + es.spokenPercent(1.2) + ' usado, ' + es.spokenMoney(2_000_000, 'ARS') + ' por encima');
  assert.equal(row.props.accessibilityLabel, 'Presupuesto del mes superado, 120' + NBSP + '% usado, 20000,00 pesos por encima', 'spoken money: ungrouped, the unit in words');
});

test('24UX6D: when Inicio shows another currency the row names the budget\'s («Presupuesto · ARS»), codes its amounts and VoiceOver says the currency', () => {
  const { exports } = harness();
  const warningRow = budgetRow(exports, 8_700_000, true);
  const warning = budgetParts(warningRow);
  assert.equal(textOf(warning.title), 'Presupuesto · ARS');
  assert.equal(textOf(warning.detail), 'Quedan ' + es.codedAmount(1_300_000, 'ARS'));
  assert.equal(textOf(warning.detail), 'Quedan ARS' + NBSP + '13.000,00', 'coded, never the bare $ another currency could share');
  assert.equal(warningRow.props.accessibilityLabel, 'Presupuesto del mes en ARS, cerca del límite, ' + es.spokenPercent(0.87) + ' usado, quedan 13000,00 pesos',
    'spoken money even when the screen codes the amounts');
  const exceededRow = budgetRow(exports, 12_000_000, true);
  const exceeded = budgetParts(exceededRow);
  assert.equal(textOf(exceeded.title), 'Presupuesto · ARS');
  assert.equal(textOf(exceeded.detail), 'ARS' + NBSP + '20.000,00 por encima');
  assert.equal(exceededRow.props.accessibilityLabel, 'Presupuesto del mes en ARS superado, ' + es.spokenPercent(1.2) + ' usado, 20000,00 pesos por encima');
});

test('24UX6D: VoiceOver hears one button: the state, the spoken percent and the spoken amount; the hint says it opens Presupuestos; a tap is the caller\'s', () => {
  const { exports } = harness();
  let pressed = 0;
  const row = budgetRow(exports, 8_700_000, false, () => { pressed++; });
  assert.equal(row.props.accessibilityLabel, 'Presupuesto del mes, cerca del límite, ' + es.spokenPercent(0.87) + ' usado, quedan ' + es.spokenMoney(1_300_000, 'ARS'));
  assert.equal(row.props.accessibilityLabel, 'Presupuesto del mes, cerca del límite, 87' + NBSP + '% usado, quedan 13000,00 pesos');
  assert.equal(row.props.accessibilityLabel.includes('$'), false, 'no visible money formatter reaches the label');
  assert.equal(row.props.accessibilityHint, 'Abre Presupuestos');
  assert.equal(flatten(row).filter(node => node.props.accessible === false && node.type !== 'Ionicons').length, 3, 'the three texts are hidden; the row is the element');
  row.props.onPress();
  assert.equal(pressed, 1, 'onPress is wired to the row');
});

test('24UX6D: the budget row in English', () => {
  const { exports } = harness();
  try {
    current = 'en-US';
    const en = bindLocale('en-US');
    const warning = budgetRow(exports, 8_700_000);
    const parts = budgetParts(warning);
    assert.equal(JSON.stringify([textOf(parts.title), textOf(parts.percent), textOf(parts.detail)]), JSON.stringify(['Budget', en.formatPercent(0.87), en.moneyText(1_300_000, 'ARS') + ' left']));
    assert.equal(textOf(parts.detail), 'AR$' + NBSP + '13,000.00 left');
    assert.equal(textOf(parts.percent), '87%');
    assert.equal(warning.props.accessibilityHint, 'Opens Budgets');
    assert.equal(warning.props.accessibilityLabel, 'This month’s budget, close to the limit, ' + en.spokenPercent(0.87) + ' used, ' + en.spokenMoney(1_300_000, 'ARS') + ' left');
    const coded = budgetParts(budgetRow(exports, 8_700_000, true));
    assert.equal(textOf(coded.title), 'Budget · ARS');
    assert.equal(textOf(coded.detail), en.codedAmount(1_300_000, 'ARS') + ' left');
    const exceeded = budgetRow(exports, 12_000_000);
    assert.equal(JSON.stringify([textOf(budgetParts(exceeded).percent), textOf(budgetParts(exceeded).detail)]), JSON.stringify(['120%', en.moneyText(2_000_000, 'ARS') + ' over']));
    assert.equal(exceeded.props.accessibilityLabel, 'This month’s budget, over the limit, 120% used, 20000.00 pesos over');
    assert.equal(budgetRow(exports, 12_000_000, true).props.accessibilityLabel, 'This month’s ARS budget, over the limit, 120% used, 20000.00 pesos over');
    assert.equal(textOf(budgetParts(budgetRow(exports, 10_000_000)).detail), 'Limit reached');
  } finally { current = 'es-AR'; }
});

test('24UX6D: the bar starts at its value and moves with the data timing; Reduce Motion makes the change instant; it is a 6 pt capsule on the inset track', () => {
  for (const reduced of [false, true]) {
    const { exports, env } = harness();
    env.reduced = reduced;
    const meterOf = (spent: number) => budgetParts(budgetRow(exports, spent)).meter;
    const render = (spent: number) => { const meter = meterOf(spent); env.begin(); const track = meter.type(meter.props); return track; };
    const width = (track: any) => track.props.children.props.style[1].width;
    // Mount: the fill is already at the share BEFORE any effect runs (a bar that grew from empty would read 0 % here).
    const track = render(8_700_000);
    assert.equal(JSON.stringify([track.type, track.props.accessible, track.props.importantForAccessibility]), JSON.stringify(['View', false, 'no-hide-descendants']), 'the row says it');
    assert.equal(JSON.stringify([track.props.style.height, track.props.style.borderRadius, track.props.style.backgroundColor, track.props.style.overflow]),
      JSON.stringify([6, 3, palette.inset, 'hidden']));
    const fill = track.props.children;
    assert.equal(fill.type, 'Animated.View');
    assert.equal(JSON.stringify([fill.props.style[0].backgroundColor, fill.props.style[0].height, width(track)]), JSON.stringify([palette.warning, 6, '87%']),
      'the shared value starts at the share: nothing plays on mount');
    env.flush();
    env.timings.length = 0;
    // A re-render with the same share asks for nothing.
    render(8_700_000); env.flush();
    assert.equal(env.timings.length, 0, 'no new timing without a change');
    // A new share: the bar is still where it was when the render reads it, then the effect moves it with the data timing.
    const moved = render(9_500_000);
    assert.equal(width(moved), '87%', 'the change animates from the old value, it does not jump during render');
    env.flush();
    assert.equal(JSON.stringify(env.timings), JSON.stringify([{ to: 0.95, config: { kind: 'data', duration: reduced ? 0 : 260 } }]),
      reduced ? 'Reduce Motion: zero-length, the bar jumps' : 'a value change runs the data timing');
    assert.equal(width(render(9_500_000)), '95%');
  }
});

test('24UX6D: the name and the percent share a line only when both fit; large text and a long percent stack them, and nothing is ever cut', () => {
  const { exports, env } = harness();
  const header = (spent = 8_700_000, labelsCurrency = false, limit?: number) =>
    budgetParts(exports.BudgetAttentionRow({ attention: attentionFor(spent, 'ARS', limit), currency: 'ARS', labelsCurrency, onPress: () => {} })).header.props.style;
  assert.equal(JSON.stringify([header().flexDirection, header().alignItems, header().gap]), JSON.stringify(['row', 'center', 8]));
  assert.equal(header(12_000_000, true).flexDirection, 'row', '«Presupuesto · ARS», the glyph and «120 %» fit a 393 pt iPhone');
  env.window = { width: 393, height: 852, fontScale: 1.35 };
  assert.equal(JSON.stringify([header().flexDirection, header().alignItems, header().gap]), JSON.stringify(['column', 'flex-start', 2]), 'large text always stacks');
  env.window = { width: 375, height: 667, fontScale: 1 };
  // A tiny limit and a large overspend: a percent too long to sit beside the name on a 375 pt iPhone.
  assert.equal(header(1_000_000_000_000, true, 100).flexDirection, 'column', 'a percent that does not fit moves under the name');
  assert.equal(header(1_000_000_000_000, true, 100).flexDirection === 'column',
    geometry.labelAmountStacks(375, 1, 'Presupuesto · ARS', es.formatPercent(budgetPresentation.percentUsed(attentionFor(1_000_000_000_000, 'ARS', 100).progress) * 0.01), 116), 'the shared rule (labelAmountStacks)');
});

// ---- 24UX6D refinement: a category budget's attention row -------------------------------------------------------------
/** The attention the screen would hand the row for a CATEGORY budget: the domain's summary of `spentMinor` in `category`
 * against a sublimit of `limitMinor` (by default $ 100.000,00), through `budgetAttentions` as `homeBudgets` reads it. */
function categoryAttentionFor(spentMinor: number, category = 'Supermercado', currency: domain.Currency = 'ARS', limitMinor = 10_000_000) {
  const snapshot: domain.LedgerSnapshot = { accounts: [{ id: 'a', name: 'Banco', currency, openingMinor: 0, createdAt: budgetAt }],
    entries: [{ id: 'e', accountId: 'a', kind: 'expense', amountMinor: spentMinor, merchant: 'Comercio', category, dateISO: '2026-09-10', createdAt: budgetAt }] };
  const budget: domain.MonthlyBudget = { id: 'cat', scope: 'category', category, currency, monthISO: '2026-09', amountMinor: limitMinor, active: true, createdAt: budgetAt, revision: 0, updatedAt: budgetAt };
  const [attention] = budgetAttentions(domain.summarizeMonthlyBudgets(snapshot, [budget], currency, '2026-09'));
  assert.ok(attention && attention.progress.budget.scope === 'category', 'the fixture needs attention');
  return attention;
}
const categoryRow = (exports: Record<string, any>, spent: number, extra: { labelsCurrency?: boolean; currency?: domain.Currency; last?: boolean; category?: string } = {}) =>
  exports.BudgetAttentionRow({ attention: categoryAttentionFor(spent, extra.category, extra.currency ?? 'ARS'), currency: extra.currency ?? 'ARS', labelsCurrency: extra.labelsCurrency ?? false,
    onPress: () => {}, ...(extra.last === undefined ? {} : { last: extra.last }) });
/** Every colour the row draws with: `color` props and every style key that names a colour. */
function coloursOf(row: any): string[] {
  const found: string[] = [];
  for (const node of flatten(row)) {
    if (typeof node.props.color === 'string') found.push(node.props.color);
    for (const style of [node.props.style].flat(Infinity)) if (style && typeof style === 'object')
      for (const [key, value] of Object.entries(style)) if (/color$/i.test(key) && typeof value === 'string') found.push(value);
  }
  return found;
}
/** The look the harness would give a category (`useCategoryLook`'s mock): the hue the row must never use. */
const categoryHex = (label: string) => '#' + label.length.toString().padStart(6, 'A');

test('24UX6D refinement: a category budget at 97 % is the same warning progress row, named by its localized category in ink: «Supermercado», «97 %», «Quedan $ 3.000,00»', () => {
  const { exports, env } = harness();
  const attention = categoryAttentionFor(9_700_000);
  assert.equal(JSON.stringify([attention.state, attention.progress.ratio, attention.progress.remainingMinor]), JSON.stringify(['warning', 0.97, 300_000]));
  env.labels.length = 0;
  const row = exports.BudgetAttentionRow({ attention, currency: 'ARS', labelsCurrency: false, onPress: () => {} });
  assert.ok(env.labels.includes('Supermercado'), 'the stored category goes through useCategoryLabel');
  const { all, title, percent, detail, meter, alert, tile } = budgetParts(row);
  assert.equal(textOf(title), 'Supermercado', 'the category\'s name, not «Presupuesto»');
  assert.equal(JSON.stringify([title.props.style.color, title.props.style.fontWeight, title.props.style.flexShrink]), JSON.stringify([undefined, '600', 1]), 'ink, like the general row');
  assert.equal(textOf(percent), '97' + NBSP + '%');
  assert.equal(percent.props.style.color, palette.warning);
  assert.equal(JSON.stringify([meter.props.fraction, meter.props.color]), JSON.stringify([0.97, palette.warning]));
  assert.equal(alert, undefined);
  assert.equal(tile, undefined, 'no category glyph tile');
  assert.equal(textOf(detail), 'Quedan $' + NBSP + '3.000,00');
  assert.equal(all.some(node => node.type === 'CategoryBadge' || node.type === 'MerchantBadge'), false, 'no category badge');
  // No category hue anywhere: every colour is the state's or the row's chrome.
  const colours = coloursOf(row);
  assert.equal(colours.includes(categoryHex('Supermercado')), false, 'never the category\'s hue');
  assert.deepEqual([...new Set(colours)].sort(), [palette.line, palette.tertiary, palette.warning].sort(), 'warning amber, the hairline\'s and the chevron\'s chrome only');
  // VoiceOver: one button naming the category budget, spoken percent and spoken money.
  assert.equal(row.props.accessibilityLabel, 'Presupuesto de Supermercado, cerca del límite, ' + es.spokenPercent(0.97) + ' usado, quedan ' + es.spokenMoney(300_000, 'ARS'));
  assert.equal(row.props.accessibilityLabel, 'Presupuesto de Supermercado, cerca del límite, 97' + NBSP + '% usado, quedan 3000,00 pesos');
  assert.equal(row.props.accessibilityLabel.includes('$'), false);
  assert.equal(row.props.accessibilityHint, 'Abre Presupuestos');
  assert.equal(all.filter(node => node.type === 'AppText').every(node => node.props.accessible === false), true);
});

test('24UX6D refinement: a category row looks exactly like the general row in the same state; only the name and the spoken name differ', () => {
  const { exports } = harness();
  for (const spent of [8_500_000, 9_700_000, 10_000_000, 12_000_000]) {
    const general = exports.BudgetAttentionRow({ attention: attentionFor(spent), currency: 'ARS', labelsCurrency: false, onPress: () => {} });
    const category = categoryRow(exports, spent);
    const look = (row: any) => { const parts = budgetParts(row);
      return JSON.stringify([textOf(parts.percent), parts.percent.props.style, parts.meter.props, textOf(parts.detail), parts.alert?.props, row.props.style, parts.header.props.style, coloursOf(row)]); };
    assert.equal(look(category), look(general), String(spent));
    assert.equal(textOf(budgetParts(general).title), 'Presupuesto');
    assert.equal(textOf(budgetParts(category).title), 'Supermercado');
  }
});

test('24UX6D refinement: an exceeded category budget: the alert tone and glyph, «por encima», and VoiceOver «Presupuesto de Supermercado superado, …»', () => {
  const { exports } = harness();
  const row = categoryRow(exports, 12_000_000);
  const { title, percent, detail, meter, alert } = budgetParts(row);
  assert.equal(textOf(title), 'Supermercado');
  assert.equal(JSON.stringify([textOf(percent), percent.props.style.color, meter.props.fraction, meter.props.color]), JSON.stringify(['120' + NBSP + '%', palette.expense, 1, palette.expense]));
  assert.ok(alert, 'the alert glyph');
  assert.equal(alert.props.color, palette.expense);
  assert.equal(textOf(detail), '$' + NBSP + '20.000,00 por encima');
  assert.equal(coloursOf(row).includes(categoryHex('Supermercado')), false);
  assert.deepEqual([...new Set(coloursOf(row))].sort(), [palette.expense, palette.line, palette.tertiary].sort());
  assert.equal(row.props.accessibilityLabel, 'Presupuesto de Supermercado superado, ' + es.spokenPercent(1.2) + ' usado, ' + es.spokenMoney(2_000_000, 'ARS') + ' por encima');
  assert.equal(row.props.accessibilityLabel, 'Presupuesto de Supermercado superado, 120' + NBSP + '% usado, 20000,00 pesos por encima');
  // Exactly at the limit: still amber, «Límite alcanzado».
  const reached = categoryRow(exports, 10_000_000);
  assert.equal(JSON.stringify([textOf(budgetParts(reached).detail), budgetParts(reached).percent.props.style.color]), JSON.stringify(['Límite alcanzado', palette.warning]));
  assert.equal(reached.props.accessibilityLabel, 'Presupuesto de Supermercado, límite alcanzado, ' + es.spokenPercent(1) + ' usado');
});

test('24UX6D refinement: a category budget in another currency than Inicio\'s is «Supermercado · USD», its amounts coded, VoiceOver naming the currency', () => {
  const { exports } = harness();
  const row = categoryRow(exports, 9_700_000, { currency: 'USD', labelsCurrency: true });
  const { title, detail } = budgetParts(row);
  assert.equal(textOf(title), 'Supermercado · USD');
  assert.equal(textOf(detail), 'Quedan ' + es.codedAmount(300_000, 'USD'));
  assert.equal(row.props.accessibilityLabel, 'Presupuesto de Supermercado en USD, cerca del límite, ' + es.spokenPercent(0.97) + ' usado, quedan ' + es.spokenMoney(300_000, 'USD'));
  const over = categoryRow(exports, 12_000_000, { currency: 'USD', labelsCurrency: true });
  assert.equal(textOf(budgetParts(over).title), 'Supermercado · USD');
  assert.equal(over.props.accessibilityLabel, 'Presupuesto de Supermercado en USD superado, ' + es.spokenPercent(1.2) + ' usado, ' + es.spokenMoney(2_000_000, 'USD') + ' por encima');
  // Not named: the bare category.
  assert.equal(textOf(budgetParts(categoryRow(exports, 9_700_000, { currency: 'USD' })).title), 'Supermercado');
});

test('24UX6D refinement: a category budget row in English uses the localized category («Groceries»)', () => {
  const { exports } = harness();
  try {
    current = 'en-US';
    const en = bindLocale('en-US');
    const warning = categoryRow(exports, 9_700_000);
    const parts = budgetParts(warning);
    assert.equal(JSON.stringify([textOf(parts.title), textOf(parts.percent), textOf(parts.detail)]), JSON.stringify(['Groceries', '97%', en.moneyText(300_000, 'ARS') + ' left']),
      'the stored «Supermercado» reads in English: the row uses the hook\'s label, never the stored string');
    assert.equal(warning.props.accessibilityLabel, 'Groceries budget, close to the limit, ' + en.spokenPercent(0.97) + ' used, ' + en.spokenMoney(300_000, 'ARS') + ' left');
    assert.equal(warning.props.accessibilityLabel, 'Groceries budget, close to the limit, 97% used, 3000.00 pesos left');
    assert.equal(warning.props.accessibilityHint, 'Opens Budgets');
    const exceeded = categoryRow(exports, 12_000_000);
    assert.equal(exceeded.props.accessibilityLabel, 'Groceries budget, over the limit, 120% used, 20000.00 pesos over');
    const coded = categoryRow(exports, 9_700_000, { currency: 'USD', labelsCurrency: true });
    assert.equal(textOf(budgetParts(coded).title), 'Groceries · USD');
    assert.equal(coded.props.accessibilityLabel, 'Groceries USD budget, close to the limit, 97% used, ' + en.spokenMoney(300_000, 'USD') + ' left');
    assert.equal(textOf(budgetParts(categoryRow(exports, 10_000_000)).detail), 'Limit reached');
  } finally { current = 'es-AR'; }
});

test('24UX6D refinement: in the grouped surface a row that is not last draws a hairline under it; the last (the default) draws none', () => {
  const { exports } = harness();
  const general = (last?: boolean) => exports.BudgetAttentionRow({ attention: attentionFor(9_000_000), currency: 'ARS', labelsCurrency: false, onPress: () => {}, ...(last === undefined ? {} : { last }) });
  for (const [label, make] of [['general', general], ['category', (last?: boolean) => categoryRow(exports, 9_000_000, { last })]] as const) {
    const first = make(false).props.style;
    assert.equal(JSON.stringify([first.borderBottomWidth, first.borderBottomColor]), JSON.stringify([0.5, palette.line]), label + ': StyleSheet.hairlineWidth in the separator colour');
    assert.equal(make(true).props.style.borderBottomWidth, 0, label + ': the last row has no hairline');
    assert.equal(make(undefined).props.style.borderBottomWidth, 0, label + ': `last` defaults to true (a single row)');
    assert.equal(JSON.stringify([first.minHeight, first.paddingHorizontal, first.paddingVertical]), JSON.stringify([64, 16, 12]), label + ': the separator changes nothing else');
  }
});

test('24UX6D refinement: a 60-character category with a 13-digit ARS amount stacks at 375 pt and at 1.35× text, and nothing is cut', () => {
  const { exports, env } = harness();
  const name = 'Supermercados mayoristas, almacenes y verdulerías del barrio';
  assert.equal(name.length, 60, 'the longest category the domain accepts');
  // A limit of $ 10.000.000.000,00 (13 digits) and $ 12.345.678.901,23 over it.
  const limit = 1_000_000_000_000, spent = 2_234_567_890_123;
  const make = (labelsCurrency: boolean) => exports.BudgetAttentionRow({ attention: categoryAttentionFor(spent, name, 'ARS', limit), currency: 'ARS', labelsCurrency, onPress: () => {} });
  try {
    for (const window of [{ width: 375, height: 667, fontScale: 1 }, { width: 393, height: 852, fontScale: 1.35 }, { width: 375, height: 667, fontScale: 1.35 }]) {
      env.window = window;
      for (const labelsCurrency of [false, true]) {
        const label = window.width + ' pt × ' + window.fontScale + (labelsCurrency ? ', named' : '');
        const row = make(labelsCurrency);
        const { all, header, title, percent, detail } = budgetParts(row);
        assert.equal(JSON.stringify([header.props.style.flexDirection, header.props.style.alignItems]), JSON.stringify(['column', 'flex-start']), label + ': the percent goes under the name');
        assert.equal(textOf(title), labelsCurrency ? name + ' · ARS' : name, label + ': the whole name');
        assert.equal(textOf(percent), es.formatPercent(budgetPresentation.percentUsed(categoryAttentionFor(spent, name, 'ARS', limit).progress) * 0.01), label);
        const amount = labelsCurrency ? es.codedAmount(1_234_567_890_123, 'ARS') : es.moneyText(1_234_567_890_123, 'ARS');
        assert.equal(textOf(detail), amount + ' por encima', label + ': the whole 13-digit amount');
        assert.match(textOf(detail), /12\.345\.678\.901,23/);
        assert.equal(all.some(node => node.props.numberOfLines !== undefined || node.props.adjustsFontSizeToFit), false, label + ': no numberOfLines, no shrinking: it wraps');
        assert.equal(title.props.style.flexShrink, 1, label + ': the name may wrap inside the row');
        assert.equal(row.props.accessibilityLabel, 'Presupuesto de ' + name + (labelsCurrency ? ' en ARS' : '') + ' superado, ' + es.spokenPercent(budgetPresentation.percentUsed(categoryAttentionFor(spent, name, 'ARS', limit).progress) * 0.01)
          + ' usado, ' + es.spokenMoney(1_234_567_890_123, 'ARS') + ' por encima', label);
      }
    }
  } finally { env.window = { width: 393, height: 852, fontScale: 1 }; }
});
