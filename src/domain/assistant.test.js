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
    { id: 'salary', type: 'ingreso', concept: 'Sueldo empresa', amount: 1150000, cat: 'ingreso', targetKind: 'account', targetId: 'galicia' },
  ],
  cards: [{ id: 'visa-galicia', brand: 'Visa', bank: 'Galicia', last4: '4242' }],
  archived: {},
};

describe('parseSpokenAmount', () => {
  it.each([
    ['$1.150.000', 1150000],
    ['1,5 millones', 1500000],
    ['25 mil', 25000],
    ['diez mil pesos', 10000],
    ['veinticinco lucas', 25000],
    ['doscientos cincuenta pesos', 250],
    ['50.25 dólares', 50.25],
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
  it('does not confuse the currency with the merchant', () => {
    const draft = parseAssistantCommand('Gasté 10 mil pesos', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', transactionType: 'gasto', amount: 10000, currency: 'ARS', merchant: 'Gasto' });
    expect(draft.merchant.toLowerCase()).not.toContain('peso');
  });
  it('keeps ropa as useful detail and maps it to Compras', () => {
    const draft = parseAssistantCommand('Gasté 10 mil en ropa', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', transactionType: 'gasto', amount: 10000, categoryId: 'compras', merchant: 'Gasto' });
    expect(draft.note.toLowerCase()).toContain('ropa');
    expect(parseAssistantCommand('Gasté 10 mil pesos ropa', context, NOW)).toMatchObject({ amount: 10000, categoryId: 'compras', merchant: 'Gasto', note: 'Ropa' });
  });
  it.each([
    ['Me dieron 25 mil pesos de Empresa Acme en Galicia', 25000, 'Empresa Acme', 'galicia'],
    ['Ingresé 100 mil de Mercado Libre a Galicia', 100000, 'Mercado Libre', 'galicia'],
    ['Me ingresaron 50 mil de Acme en Galicia', 50000, 'Acme', 'galicia'],
    ['Me prestaron 30 mil Juan', 30000, 'Juan', ''],
    ['Me regalaron 10 mil mis padres', 10000, 'Mis padres', ''],
    ['Me devolvieron 5 mil de Amazon a Galicia', 5000, 'Amazon', 'galicia'],
    ['Juan me prestó 12 mil pesos', 12000, 'Juan', ''],
    ['Me llegó una transferencia de 8 mil de Juan', 8000, 'Juan', ''],
    ['Recibí 1 palo de regalo de mis viejos', 1000000, 'Mis viejos', ''],
  ])('treats natural incoming-money phrase %s as income', (phrase, amount, merchant, accountId) => {
    const draft = parseAssistantCommand(phrase, context, NOW);
    expect(draft).toMatchObject({
      intent: 'transaction', transactionType: 'ingreso', amount,
      accountId, categoryId: 'ingreso', merchant,
    });
    expect(draft.merchant.toLowerCase()).not.toContain('peso');
  });
  it('keeps a source-less incoming amount generic instead of turning currency into the source', () => {
    const draft = parseAssistantCommand('Me dieron 10 mil pesos', context, NOW);
    expect(draft).toMatchObject({ transactionType: 'ingreso', amount: 10000, merchant: 'Ingreso' });
    expect(parseAssistantCommand('Me cayó 10 mil pesos', context, NOW)).toMatchObject({ transactionType: 'ingreso', amount: 10000, merchant: 'Ingreso' });
  });
  it('prioritizes the incoming reimbursement even when the phrase mentions the original expense', () => {
    const draft = parseAssistantCommand('Me devolvieron 10 mil que gasté en ropa', context, NOW);
    expect(draft).toMatchObject({ transactionType: 'ingreso', amount: 10000, categoryId: 'ingreso', merchant: 'Ingreso' });
    expect(draft.note.toLowerCase()).toContain('ropa');
  });
  it('separates amounts spoken entirely in words from the purchase detail', () => {
    const draft = parseAssistantCommand('Gasté diez mil en una remera', context, NOW);
    expect(draft).toMatchObject({ amount: 10000, categoryId: 'compras', merchant: 'Gasto' });
    expect(draft.note.toLowerCase()).toContain('remera');
    expect(draft.merchant.toLowerCase()).not.toContain('mil');
  });
  it('separates an item, its category and the actual merchant', () => {
    const draft = parseAssistantCommand('Compré ropa por 10 mil en Zara', context, NOW);
    expect(draft).toMatchObject({ amount: 10000, categoryId: 'compras', merchant: 'Zara' });
    expect(draft.note.toLowerCase()).toContain('ropa');
  });
  it('handles the merchant before or after a category word', () => {
    expect(parseAssistantCommand('Gasté 10 mil en Zara ropa', context, NOW)).toMatchObject({ merchant: 'Zara', categoryId: 'compras' });
    expect(parseAssistantCommand('Gasté 10 mil en ropa Zara', context, NOW)).toMatchObject({ merchant: 'Zara', categoryId: 'compras' });
  });
  it('understands common passive expense phrasing', () => {
    const draft = parseAssistantCommand('Me cobraron 30 mil pesos por una remera', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', amount: 30000, merchant: 'Gasto', categoryId: 'compras' });
    expect(draft.note.toLowerCase()).toContain('remera');
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
  it('keeps the item as detail and the actual fuel station as merchant', () => {
    const draft = parseAssistantCommand('Pagué 18 mil de nafta en YPF con Galicia', context, NOW);
    expect(draft).toMatchObject({ amount: 18000, merchant: 'YPF', note: 'Nafta', categoryId: 'auto', accountId: 'galicia' });
  });
  it('prepares a full card payment without inventing an amount', () => {
    const draft = parseAssistantCommand('Pagué el resumen completo de la Visa desde Galicia', context, NOW);
    expect(draft).toMatchObject({ intent: 'card_payment', amount: null, cardId: 'visa-galicia', accountId: 'galicia' });
  });
  it('treats paying a merchant with Visa as a purchase, not a card payment', () => {
    const draft = parseAssistantCommand('Pagué 10 mil de Uber con la Visa', context, NOW);
    expect(draft).toMatchObject({ intent: 'transaction', transactionType: 'gasto', amount: 10000, merchant: 'Uber', categoryId: 'auto', cardId: 'visa-galicia' });
  });
  it('does not create movements from questions or negated phrases', () => {
    expect(parseAssistantCommand('¿Cuánto gasté en comida?', context, NOW).intent).toBe('none');
    expect(parseAssistantCommand('¿En qué gasté ayer?', context, NOW).intent).toBe('none');
    expect(parseAssistantCommand('Por qué gasté más este mes', context, NOW).intent).toBe('none');
    expect(parseAssistantCommand('No gasté 10 mil en ropa', context, NOW).intent).toBe('none');
    expect(parseAssistantCommand('No me dieron 10 mil pesos', context, NOW).intent).toBe('none');
    expect(parseAssistantCommand('Nunca me prestaron 30 mil', context, NOW).intent).toBe('none');
    expect(parseAssistantCommand('No me llegó la transferencia de 8 mil', context, NOW).intent).toBe('none');
  });
  it('prepares a transfer without treating it as income or expense', () => {
    const draft = parseAssistantCommand('Transferí 25 mil desde Efectivo a Banco Galicia', context, NOW);
    expect(draft).toMatchObject({ intent: 'transfer', amount: 25000, fromAccountId: 'cash', toAccountId: 'galicia' });
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
