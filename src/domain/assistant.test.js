import { describe, expect, it } from 'vitest';
import { normalizeAssistantDraft, parseAssistantCommand, parseSpokenAmount, resolveAssistantReferences } from './assistant.js';

const NOW = new Date(2026, 7, 7, 12);
const context = {
  accounts: {
    galicia: { name: 'Banco Galicia', type: 'Banco' },
    cash: { name: 'Efectivo', type: 'Efectivo' },
  },
  categories: {
    comida: { name: 'Comida', type: 'gasto' },
    auto: { name: 'Auto', type: 'gasto' },
    compras: { name: 'Compras', type: 'gasto' },
    ingreso: { name: 'Ingreso', type: 'ingreso' },
  },
  recurring: [
    { id: 'salary', type: 'ingreso', concept: 'Sueldo Qnity', amount: 1150000, cat: 'ingreso', targetKind: 'account', targetId: 'galicia' },
  ],
  cards: [{ id: 'visa-galicia', brand: 'Visa', bank: 'Galicia', last4: '4242' }],
  archived: {},
};

describe('parseSpokenAmount', () => {
  it.each([
    ['$1.150.000', 1150000],
    ['1,5 millones', 1500000],
    ['25 mil', 25000],
    ['12.500,50', 12500.5],
  ])('parses %s', (input, expected) => expect(parseSpokenAmount(input)).toBe(expected));
});

describe('parseAssistantCommand', () => {
  it('reuses a saved salary recurring when the user says they got paid', () => {
    const draft = parseAssistantCommand('Cobré el sueldo', context, NOW);
    expect(draft).toMatchObject({ intent: 'recurring', recurringId: 'salary', amount: 1150000, accountId: 'galicia', transactionType: 'ingreso' });
  });
  it('prepares an expense with amount, account and date', () => {
    const draft = parseAssistantCommand('Gasté 25 mil en comida con Galicia ayer', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', transactionType: 'gasto', amount: 25000, accountId: 'galicia', categoryId: 'comida', dateISO: '2026-08-06' });
    expect(draft.merchant).toBe('Gasto');
  });
  it('treats hoy as the actual local calendar date supplied to the parser', () => {
    const draft = parseAssistantCommand('Gasté 1500 en comida con Galicia hoy', context, NOW);
    expect(draft).toMatchObject({ amount: 1500, accountId: 'galicia', categoryId: 'comida', dateISO: '2026-08-07' });
  });
  it('understands a weekday as a real date instead of treating it as the merchant', () => {
    const draft = parseAssistantCommand('Gasté 25 mil en comida el lunes anterior', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', amount: 25000, categoryId: 'comida', dateISO: '2026-08-03', merchant: 'Gasto' });
  });
  it('infers food, merchant and item detail from natural speech', () => {
    const draft = parseAssistantCommand('Compré 2 hamburguesas por 2000, en Kiddo', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', amount: 2000, categoryId: 'comida', merchant: 'Kiddo', dateISO: '2026-08-07' });
    expect(draft.note.toLowerCase()).toContain('2 hamburguesas');
  });
  it('learns a merchant category locally from previous movements', () => {
    const learned = { ...context, transactions: [{ id: 9, merchant: 'Kiddo', cat: 'comida' }] };
    const draft = parseAssistantCommand('Gasté 3500 en Kiddo', learned, NOW);
    expect(draft).toMatchObject({ amount: 3500, categoryId: 'comida', merchant: 'Kiddo' });
  });
  it('understands named calendar dates and common transport vocabulary', () => {
    const draft = parseAssistantCommand('Pagué 5 mil de Uber el 5 de agosto', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', amount: 5000, categoryId: 'auto', dateISO: '2026-08-05' });
  });
  it('prepares a full card payment without inventing an amount', () => {
    const draft = parseAssistantCommand('Pagué el resumen completo de la Visa desde Galicia', context, NOW);
    expect(draft).toMatchObject({ intent: 'card_payment', amount: null, cardId: 'visa-galicia', accountId: 'galicia' });
  });
  it('prepares a monthly budget for an existing category', () => {
    const draft = parseAssistantCommand('Creá un presupuesto de 80 mil para comida', context, NOW);
    expect(draft).toMatchObject({ intent: 'create_budget', amount: 80000, categoryId: 'comida' });
  });
  it('prepares a recurring rule without posting it immediately', () => {
    const draft = parseAssistantCommand('Creá un gasto recurrente gimnasio por 25 mil el día 5 desde Galicia en comida', context, NOW);
    expect(draft).toMatchObject({ intent: 'create_recurring', transactionType: 'gasto', amount: 25000, scheduleDay: 5, accountId: 'galicia', categoryId: 'comida' });
    expect(draft.merchant.toLowerCase()).toContain('gimnasio');
  });
  it('prepares new categories and tags', () => {
    expect(parseAssistantCommand('Creá una categoría Viajes', context, NOW)).toMatchObject({ intent: 'create_category', merchant: 'Viajes' });
    expect(parseAssistantCommand('Agregá una etiqueta trabajo', context, NOW)).toMatchObject({ intent: 'create_tag', merchant: 'trabajo' });
  });
  it('does not pretend to understand an unrelated request', () => {
    expect(parseAssistantCommand('¿Cómo viene mi mes?', context, NOW).intent).toBe('none');
  });
});

describe('normalizeAssistantDraft', () => {
  it('drops model-provided ids that do not exist in local state', () => {
    const draft = normalizeAssistantDraft({ intent: 'transaction', transactionType: 'gasto', amount: 10, accountId: 'invented', categoryId: 'invented', dateISO: '2026-08-01' }, context, NOW);
    expect(draft.accountId).toBe('');
    expect(draft.categoryId).toBe('');
    expect(draft.tags).toContain('asistente');
  });

  it('resolves model text references only against local entities', () => {
    const resolved = resolveAssistantReferences({ accountRef: 'Galicia', categoryRef: 'comida', cardRef: 'Visa' }, context);
    expect(resolved).toMatchObject({ accountId: 'galicia', categoryId: 'comida', cardId: 'visa-galicia' });
  });

  it('can resolve an FCI virtual funding source supplied by the app context', () => {
    const withFund = { ...context, accounts: { ...context.accounts, 'fci-spend:portfolio:fund-1': { name: 'Cocos Rendimiento FCI', type: 'FCI COCORMA' } } };
    const resolved = resolveAssistantReferences({ accountRef: 'Cocos Rendimiento' }, withFund);
    expect(resolved.accountId).toBe('fci-spend:portfolio:fund-1');
  });
});
