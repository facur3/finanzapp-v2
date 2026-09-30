import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { bindLocale } from '../src/i18n/bind.ts';
import type { AppLocale } from '../src/i18n/locale.ts';
let locale: AppLocale = 'es-AR';
const i18nProvider = { useI18n: () => bindLocale(locale) };

// Producto 24UX6A: Inicio's one capture button and its sheet, over the actual module with host components as
// descriptors. The sheet itself (rise, Reduce Motion, VoiceOver modality, the dismissal) is BottomSheet's, pinned in
// tests/date-field.node.ts. The feel of the button and the sheet on an iPhone remains a device acceptance item.
const palette = { primary: '#2557D6', primaryFill: '#2557D6', primarySoft: '#2557D61A', onPrimary: '#FFFFFF', tertiary: '#8A8F99', line: '#E6E6EC', text: '#0A0A0C', inset: '#EEE',
  expense: '#C42F39', expenseSoft: '#C42F391A', income: '#1F8A4C', incomeSoft: '#1F8A4C1A', transfer: '#1C7ED6', transferSoft: '#1C7ED61A', warning: '#B26B00', warningSoft: '#B26B001A' };

function harness({ stacked = false } = {}) {
  const source = readFileSync(new URL('../src/ui/home-capture.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const jsx = (type: any, props: any) => ({ type, props });
  // Hooks persist by call order across renders, like React's.
  const state: unknown[] = [];
  let cursor = 0;
  const routes: { method: string; to: unknown }[] = [];
  const components = { AppText: 'AppText', PressFeedback: 'PressFeedback', useStacked: () => stacked,
    toneColors: (p: typeof palette, tone: 'expense' | 'income' | 'transfer') => ({ color: p[tone], soft: p[`${tone}Soft`] }) };
  const modules: Record<string, any> = {
    react: { useState: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value: unknown) => { state[index] = value; }]; },
      useRef: (initial: unknown) => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 }, View: 'View' },
    'expo-router': { router: { push: (to: unknown) => routes.push({ method: 'push', to }), navigate: (to: unknown) => routes.push({ method: 'navigate', to }) } },
    '@expo/vector-icons/Ionicons': 'Ionicons',
    './components': components,
    './form-controls': { BottomSheet: 'BottomSheet' },
    './theme': { space: { xs: 4, s: 8, m: 12, l: 16, xl: 20 }, usePalette: () => palette },
    '../i18n/provider': i18nProvider,
  };
  const module = { exports: {} as Record<string, any> };
  runInNewContext(code, { module, exports: module.exports, require: (name: string) => {
    if (!Object.hasOwn(modules, name)) throw new Error('Unexpected home-capture dependency: ' + name);
    return modules[name];
  } });
  const render = (props: Record<string, unknown> = { movementCurrency: 'ARS', assistantCurrency: 'ARS' }) => {
    cursor = 0;
    const [button, sheet] = module.exports.CaptureButton(props).props.children;
    const rows = sheet.props.children.props.children.map((row: any) => ({ element: row, rendered: row.type(row.props) }));
    return { button, sheet, rows };
  };
  return { render, routes, exports: module.exports };
}
const flatten = (value: any): any[] => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(flatten)
  : value.props ? [value, ...flatten(value.props.children)] : [];
const json = (value: unknown) => JSON.stringify(value);

test('24UX6A: one filled «＋ Registrar» capsule, the screen\'s only call to action, named for VoiceOver', () => {
  const { render } = harness();
  const { button, sheet } = render();
  assert.equal(button.type, 'PressFeedback');
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.accessibilityLabel, 'Registrar un movimiento');
  assert.equal(button.props.accessibilityHint, 'Abre las formas de registrar: un gasto, un ingreso, una transferencia o el Asistente');
  assert.equal(button.props.containerStyle.alignSelf, 'flex-start', 'as wide as its words, under the number');
  const capsule = button.props.children;
  assert.equal(capsule.props.style[1].backgroundColor, palette.primaryFill, 'cobalt: the primary action');
  assert.ok(capsule.props.style[0].minHeight >= 44 && capsule.props.style[0].borderRadius === capsule.props.style[0].minHeight / 2, 'a capsule, a full target');
  const [glyph, label] = capsule.props.children;
  assert.deepEqual([glyph.props.name, glyph.props.color, glyph.props.accessible], ['add', palette.onPrimary, false]);
  assert.deepEqual([label.props.children, label.props.accessible], ['Registrar', false]);
  assert.equal(sheet.type, 'BottomSheet');
  assert.equal(sheet.props.visible, false, 'the sheet waits for a tap');
  assert.equal(sheet.props.onDone, undefined, 'a sheet of actions: no Listo');
  assert.equal(harness({ stacked: true }).render().button.props.containerStyle.alignSelf, 'stretch', 'accessibility text sizes: the full width, never clipped');
});

test('24UX6A: the sheet offers the four ways to record, in order, each in its own colour, the Assistant with what it does', () => {
  const { render } = harness();
  const { button } = render();
  button.props.onPress();
  const { sheet, rows } = render();
  assert.deepEqual([sheet.props.visible, sheet.props.title], [true, 'Registrar']);
  assert.equal(rows.length, 4, 'four rows, not four large controls');
  assert.equal(rows.map((row: any) => row.rendered.props.accessibilityLabel).join(' | '),
    'Registrar gasto | Registrar ingreso | Transferir entre cuentas | Hablar con el Asistente, Contale qué pasó: te propone el movimiento y vos lo confirmás');
  const looks = rows.map((row: any) => { const tile = flatten(row.rendered).find(node => node.type === 'View' && node.props.style?.[1]?.backgroundColor);
    const glyph = tile.props.children; return [glyph.props.name, glyph.props.color, tile.props.style[1].backgroundColor]; });
  assert.equal(json(looks), json([['remove', palette.expense, palette.expenseSoft], ['add', palette.income, palette.incomeSoft],
    ['swap-horizontal', palette.transfer, palette.transferSoft], ['sparkles', palette.primary, palette.primarySoft]]));
  for (const [index, { rendered }] of rows.entries()) {
    assert.equal(rendered.props.accessibilityRole, 'button');
    assert.ok(rendered.props.style[0].minHeight >= 44);
    assert.equal(rendered.props.style[1].borderBottomWidth, index === 3 ? 0 : 0.5, 'hairlines between rows, none under the last');
    assert.ok(flatten(rendered).filter(node => node.type === 'AppText' || node.type === 'Ionicons').every(node => node.props.accessible === false), 'each row speaks once');
  }
  locale = 'en-US';
  try {
    assert.equal(render().rows.map((row: any) => row.rendered.props.accessibilityLabel).join(' | '),
      'Record an expense | Record income | Transfer between accounts | Talk to the Assistant, Tell it what happened: it proposes the transaction and you confirm it');
  } finally { locale = 'es-AR'; }
});

test('24UX6A: a row opens its screen only once the sheet has left, exactly where the old controls went; a cancel opens nothing', () => {
  const cases: [number, Record<string, unknown>, { method: string; to: unknown }][] = [
    [0, { movementCurrency: 'USD', assistantCurrency: 'USD' }, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'expense', currency: 'USD' } } }],
    [1, { movementCurrency: 'ARS', assistantCurrency: 'ARS' }, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'income', currency: 'ARS' } } }],
    [2, { movementCurrency: 'ARS', assistantCurrency: 'ARS' }, { method: 'push', to: { pathname: '/new-transfer', params: {} } }],
    [3, { movementCurrency: undefined, assistantCurrency: 'EUR' }, { method: 'navigate', to: { pathname: '/assistant', params: { currency: 'EUR' } } }],
    [0, { movementCurrency: undefined, assistantCurrency: 'EUR' }, { method: 'push', to: { pathname: '/new-entry', params: { kind: 'expense' } } }],
  ];
  for (const [index, props, expected] of cases) {
    const { render, routes } = harness();
    render(props).button.props.onPress();
    render(props).rows[index].rendered.props.onPress();
    const { sheet } = render(props);
    assert.equal(sheet.props.visible, false, 'the sheet leaves first');
    assert.equal(routes.length, 0, 'nothing is presented while the sheet is still on screen');
    sheet.props.onDismissed();
    assert.equal(json(routes), json([expected]), 'row ' + index);
    sheet.props.onDismissed();
    assert.equal(routes.length, 1, 'one screen per choice');
  }
  const { render, routes } = harness();
  render().button.props.onPress();
  render().sheet.props.onClose();
  const { sheet } = render();
  assert.equal(sheet.props.visible, false);
  sheet.props.onDismissed();
  assert.equal(routes.length, 0, 'Cancelar, the scrim or the back gesture open nothing');
});

test('24UX6A: while a chosen screen is on its way the button does not reopen the sheet, and the module never writes', () => {
  const { render, routes } = harness();
  render().button.props.onPress();
  render().rows[0].rendered.props.onPress();
  render().button.props.onPress();
  assert.equal(render().sheet.props.visible, false, 'a second tap during the exit waits for the first choice');
  render().sheet.props.onDismissed();
  assert.equal(routes.length, 1);
  render().button.props.onPress();
  assert.equal(render().sheet.props.visible, true, 'afterwards it opens as usual');
  const source = readFileSync(new URL('../src/ui/home-capture.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from '[^']*(storage|LedgerProvider|assistant-engine|integrations)[^']*'|useLedger/, 'a shortcut to the forms and the Assistant: nothing here records');
});

test('24UX6A: captureDestination is the one table of where each choice goes', () => {
  const { exports } = harness();
  assert.equal(json(exports.CAPTURE_CHOICES), json(['expense', 'income', 'transfer', 'assistant']));
  assert.equal(json(exports.captureDestination('transfer', 'USD', 'USD')), json({ method: 'push', pathname: '/new-transfer', params: {} }), 'a transfer chooses its accounts in its form');
  assert.equal(json(exports.captureDestination('assistant')), json({ method: 'navigate', pathname: '/assistant', params: {} }), 'the centre tab, never a stacked copy');
});
