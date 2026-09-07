import { describe, expect, it } from 'vitest';
import { answerFinancialQuestion, looksLikeFinancialQuestion } from './assistantQueries.js';

const NOW = new Date(2026, 8, 6, 12);
const context = {
  accounts: { galicia: { name: 'Galicia', currency: 'ARS' }, usd: { name: 'Dólares', currency: 'USD' } },
  balances: { galicia: 24000, usd: 10 },
  archived: {},
  categories: { comida: { name: 'Comida', type: 'gasto' }, compras: { name: 'Compras', type: 'gasto' }, ingreso: { name: 'Ingreso', type: 'ingreso' } },
  cards: [{ id: 'visa', brand: 'Visa', bank: 'Galicia', last4: '0078', saldo: 120000, statementPaid: 20000, compras: [{ monto: 50000 }], cuotas: [{ monto: 30000 }] }],
  assets: {
    portfolio: [
      { id: 'spy', ticker: 'SPY', name: 'S&P 500', qty: 10, lastPrice: 20000, quoteCurrency: 'ARS' },
      { id: 'cocorma', ticker: 'COCORMA', name: 'Fondo Rendimiento FCI', qty: 1000, lastPrice: 10, quoteCurrency: 'ARS', fci: true },
    ],
  },
  budgets: { comida: 35000, compras: 20000 },
  transactions: [
    { id: 1, type: 'gasto', val: 10000, amount: -10000, cat: 'comida', merchant: 'Kiddo', account: 'galicia', dateISO: '2026-09-05' },
    { id: 2, type: 'gasto', val: 5000, amount: -5000, cat: 'compras', merchant: 'Zara', account: 'galicia', dateISO: '2026-09-05' },
    { id: 3, type: 'gasto', val: 30000, amount: -30000, cat: 'comida', merchant: 'Restaurante', account: 'galicia', dateISO: '2026-09-02' },
    { id: 4, type: 'ingreso', val: 500000, amount: 500000, cat: 'ingreso', merchant: 'Empresa Acme', account: 'galicia', dateISO: '2026-09-01' },
    { id: 5, type: 'gasto', val: 10000, amount: -10000, cat: 'comida', merchant: 'Kiddo', account: 'galicia', dateISO: '2026-08-05' },
    { id: 6, type: 'gasto', val: 5000, amount: -5000, cat: 'compras', merchant: 'Tienda', account: 'galicia', dateISO: '2026-08-02' },
    { id: 7, type: 'transfer', val: 999999, amount: -999999, from: 'galicia', to: 'usd', dateISO: '2026-09-05' },
  ],
  usdRate: 1500,
  summary: { liquid: 39000, fci: 10000, disp: 49000, inv: 210000, debt: 120000, pat: 129000 },
};

describe('local financial questions', () => {
  it('recognizes questions without mistaking registration commands', () => {
    expect(looksLikeFinancialQuestion('¿En qué gasté ayer?')).toBe(true);
    expect(looksLikeFinancialQuestion('Por qué gasté más este mes')).toBe(true);
    expect(looksLikeFinancialQuestion('Gasté 10 mil en ropa')).toBe(false);
  });

  it('answers what was spent yesterday and ignores transfers', () => {
    const answer = answerFinancialQuestion('¿En qué gasté ayer?', context, NOW);
    expect(answer).toMatchObject({ matched: true, kind: 'spending', amount: 15000 });
    expect(answer.text).toContain('$15.000,00');
    expect(answer.text).toContain('Comida');
    expect(answer.lines[0]).toMatchObject({ label: 'Comida', value: '$10.000,00' });
  });

  it('filters spending by a known category and period', () => {
    const answer = answerFinancialQuestion('¿Cuánto gasté en comida este mes?', context, NOW);
    expect(answer.amount).toBe(40000);
    expect(answer.title).toBe('Gastos en Comida');
  });

  it('can filter a spending question by a known merchant', () => {
    const answer = answerFinancialQuestion('¿Cuánto gasté en Kiddo este mes?', context, NOW);
    expect(answer).toMatchObject({ title: 'Gastos en Kiddo', amount: 10000 });
  });

  it('explains month-to-date growth using category deltas', () => {
    const answer = answerFinancialQuestion('¿Por qué gasté más este mes?', context, NOW);
    expect(answer).toMatchObject({ kind: 'comparison', amount: 30000 });
    expect(answer.text).toContain('$30.000,00 más');
    expect(answer.text).toContain('Comida');
    expect(answer.lines[0]).toMatchObject({ label: 'Comida', value: '+$30.000,00' });
  });

  it('corrects the premise when spending did not increase', () => {
    const smaller = { ...context, transactions: context.transactions.map(row => row.id === 3 ? { ...row, val: 0, amount: 0 } : row) };
    const answer = answerFinancialQuestion('¿Por qué gasté más este mes?', smaller, NOW);
    expect(answer.title).toBe('Gastaste menos');
    expect(answer.text).toContain('En realidad');
  });

  it('answers income, balance and net-worth questions from local data', () => {
    expect(answerFinancialQuestion('¿Cuánto ingresó este mes?', context, NOW).text).toContain('$500.000,00');
    expect(answerFinancialQuestion('¿Cómo viene mi mes?', context, NOW)).toMatchObject({ kind: 'balance', amount: 455000 });
    const worth = answerFinancialQuestion('¿Cuál es mi patrimonio?', context, NOW);
    expect(worth.text).toContain('$129.000,00');
    expect(worth.text).toContain('no se cuentan dos veces');
    expect(answerFinancialQuestion('¿Cuánto tengo disponible?', context, NOW)).toMatchObject({ kind: 'available', amount: 49000 });
  });

  it('understands natural income, spending and rolling-period questions', () => {
    expect(answerFinancialQuestion('¿Quién me pagó este mes?', context, NOW).text).toContain('Empresa Acme');
    expect(answerFinancialQuestion('¿Dónde se me fue la plata ayer?', context, NOW)).toMatchObject({ kind: 'spending', amount: 15000 });
    expect(answerFinancialQuestion('¿Cuánto ahorré este mes?', context, NOW)).toMatchObject({ kind: 'balance', amount: 455000 });
    expect(answerFinancialQuestion('¿Cuánto gasté los últimos 7 días?', context, NOW)).toMatchObject({ kind: 'spending', amount: 45000 });
  });

  it('answers holding and portfolio questions from the current local assets', () => {
    const holding = answerFinancialQuestion('¿Cuánto tengo en SPY?', context, NOW);
    expect(holding).toMatchObject({ kind: 'asset', amount: 200000 });
    expect(holding.text).toContain('10 SPY');
    const portfolio = answerFinancialQuestion('¿Qué inversiones tengo?', context, NOW);
    expect(portfolio.kind).toBe('investments');
    expect(portfolio.lines.map(line => line.label)).toContain('SPY');
  });

  it('explains how the current month is tracking against budgets', () => {
    const answer = answerFinancialQuestion('¿Cómo voy con mis presupuestos?', context, NOW);
    expect(answer).toMatchObject({ kind: 'budgets', title: 'Presupuestos excedidos', amount: 10000 });
    expect(answer.text).toContain('Comida por $5.000,00');
  });

  it('answers account and card questions, including a partially paid statement', () => {
    expect(answerFinancialQuestion('¿Cuánto tengo en Galicia?', context, NOW).text).toContain('$24.000,00');
    const card = answerFinancialQuestion('¿Cuánto debo en la Visa?', context, NOW);
    expect(card.text).toContain('$120.000,00');
    expect(card.text).toContain('$60.000,00');
    expect(answerFinancialQuestion('¿Cuánto debo?', context, NOW)).toMatchObject({ kind: 'debt', amount: 120000 });
  });

  it('adds matching cards instead of choosing one arbitrarily when they share a bank', () => {
    const twoCards = {
      ...context,
      cards: [
        { ...context.cards[0], brand: 'Visa', bank: 'Galicia', last4: '1111', saldo: 200000, pendingAdjustment: 30000 },
        { ...context.cards[0], brand: 'Mastercard', bank: 'Galicia', last4: '2222', saldo: 100000, statementAdjustment: 40000, compras: [], cuotas: [], statementPaid: 0 },
      ],
    };
    const answer = answerFinancialQuestion('¿Cuánto debo en las tarjetas Galicia?', twoCards, NOW);
    expect(answer).toMatchObject({ kind: 'cards', amount: 300000, title: 'Tus tarjetas de Galicia' });
    expect(answer.lines).toHaveLength(2);
    expect(answer.text).toContain('$30.000,00');
  });

  it('answers an FCI balance through its holding value instead of a virtual zero-balance account', () => {
    expect(answerFinancialQuestion('¿Qué saldo tengo en Fondo Rendimiento?', context, NOW)).toMatchObject({ kind: 'asset' });
  });

  it('keeps USD and ARS separate when no exchange rate is available', () => {
    const withoutRate = {
      ...context,
      usdRate: 0,
      transactions: [{ id: 8, type: 'gasto', val: 10, amount: -10, cat: 'compras', merchant: 'Amazon', account: 'usd', currency: 'USD', dateISO: '2026-09-05' }],
    };
    const answer = answerFinancialQuestion('¿En qué gasté ayer?', withoutRate, NOW);
    expect(answer.text).toContain('US$10,00');
    expect(answer.text).toContain('falta una cotización');
    expect(answer.lines).toEqual([]);
    expect(answer.amount).toBeNull();
  });

  it('states when there is no activity instead of inventing it', () => {
    const answer = answerFinancialQuestion('¿En qué gasté hoy?', context, NOW);
    expect(answer.title).toBe('Sin gastos registrados');
    expect(answer.amount).toBeUndefined();
  });
});
