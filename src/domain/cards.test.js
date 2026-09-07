import { describe, expect, it } from 'vitest';
import {
  addCardPurchase,
  cardInstallmentsRemaining,
  cardPendingTotal,
  cardStatementGross,
  cardStatementTotal,
  postPendingCardPurchase,
  removeCardPurchase,
} from './cards.js';

describe('credit-card statement math', () => {
  it('counts only the current installment, not the full purchase twice', () => {
    const card = addCardPurchase({ saldo: 0, compras: [], cuotas: [] }, {
      amount: 120000,
      installments: 12,
      merchant: 'Compra grande',
      dateISO: '2026-08-07',
      date: 'Hoy',
    });

    expect(card.saldo).toBe(120000);
    expect(card.compras).toHaveLength(0);
    expect(card.cuotas).toMatchObject([{ cur: 1, tot: 12, monto: 10000 }]);
    expect(cardStatementTotal(card)).toBe(10000);
    expect(cardInstallmentsRemaining(card)).toBe(120000);
  });

  it('links a purchase to its movement and can reverse the card debt safely', () => {
    const card = addCardPurchase({ saldo: 0, compras: [], cuotas: [] }, {
      amount: 120000,
      installments: 12,
      merchant: 'Compra grande',
      dateISO: '2026-08-07',
      txnId: 42,
    });
    expect(card.cuotas[0].txnId).toBe(42);
    const reversed = removeCardPurchase(card, { id: 42, val: 120000, merchant: 'Compra grande · cuota 1/12', dateISO: '2026-08-07' });
    expect(reversed.removed).toBe(true);
    expect(reversed.card.saldo).toBe(0);
    expect(reversed.card.cuotas).toHaveLength(0);
  });

  it('adds a one-payment purchase directly to this statement', () => {
    const card = addCardPurchase({ saldo: 3000, compras: [], cuotas: [] }, {
      amount: 2500,
      installments: 1,
      merchant: 'Café',
    });
    expect(card.saldo).toBe(5500);
    expect(cardStatementTotal(card)).toBe(2500);
  });

  it('subtracts partial payments from the open statement without hiding total debt', () => {
    const card = { saldo: 120000, statementPaid: 20000, compras: [{ monto: 50000 }], cuotas: [{ monto: 30000 }] };
    expect(cardStatementGross(card)).toBe(80000);
    expect(cardStatementTotal(card)).toBe(60000);
    expect(card.saldo).toBe(120000);
  });

  it('reconciles the real statement without inventing a purchase', () => {
    const card = {
      saldo: 175000,
      statementPaid: 0,
      statementAdjustment: -5000,
      compras: [{ monto: 50000 }],
      cuotas: [{ monto: 30000 }],
    };
    expect(cardStatementGross(card)).toBe(75000);
    expect(cardStatementTotal(card)).toBe(75000);
    expect(card.saldo).toBe(175000);
  });

  it('never exposes a negative statement after a real-world credit', () => {
    expect(cardStatementTotal({ statementAdjustment: -10000, compras: [{ monto: 2500 }] })).toBe(0);
  });

  it('keeps pending activity out of the payable statement', () => {
    const card = addCardPurchase({ saldo: 10000, compras: [], cuotas: [], pendientes: [] }, {
      amount: 12000,
      installments: 1,
      merchant: 'KIDDO',
      status: 'pending',
      txnId: 77,
    });
    expect(card.saldo).toBe(22000);
    expect(cardPendingTotal(card)).toBe(12000);
    expect(cardStatementTotal(card)).toBe(0);
  });

  it('posts a pending purchase without increasing total debt twice', () => {
    const pending = addCardPurchase({ saldo: 0, compras: [], cuotas: [], pendientes: [] }, {
      amount: 120000,
      installments: 6,
      merchant: 'Compra pendiente',
      status: 'pending',
      txnId: 88,
    });
    const result = postPendingCardPurchase(pending, 88);
    expect(result.posted).toBe(true);
    expect(result.card.saldo).toBe(120000);
    expect(result.card.pendientes).toHaveLength(0);
    expect(result.card.cuotas).toMatchObject([{ cur: 1, tot: 6, monto: 20000 }]);
    expect(cardStatementTotal(result.card)).toBe(20000);
  });

  it('can delete a linked purchase while it is still pending', () => {
    const card = addCardPurchase({ saldo: 0, compras: [], cuotas: [], pendientes: [] }, {
      amount: 2500,
      merchant: 'Carrefour',
      status: 'pending',
      txnId: 99,
    });
    const result = removeCardPurchase(card, { id: 99, val: 2500, merchant: 'Carrefour' });
    expect(result.removed).toBe(true);
    expect(result.card.saldo).toBe(0);
    expect(result.card.pendientes).toHaveLength(0);
  });

  it('supports an aggregate pending reconciliation without fake purchases', () => {
    expect(cardPendingTotal({ pendientes: [{ monto: 10000 }], pendingAdjustment: 2153 })).toBe(12153);
  });

  it('calculates remaining debt from a real mix of current charges and active installments', () => {
    const card = {
      compras: [{ monto: 1000 }, { monto: 2000 }],
      cuotas: [
        { monto: 3000, cur: 2, tot: 3 },
        { monto: 5000, cur: 6, tot: 12 },
      ],
    };
    const currentCharges = card.compras.reduce((sum, row) => sum + row.monto, 0);
    expect(cardStatementTotal(card)).toBe(11000);
    expect(currentCharges + cardInstallmentsRemaining(card)).toBe(44000);
  });

  it('keeps pending purchases in debt but outside the current statement', () => {
    const card = {
      cuotas: [
        { monto: 4000, cur: 2, tot: 6 },
        { monto: 5000, cur: 6, tot: 12 },
      ],
      pendientes: [{ monto: 10000 }, { monto: 2500 }],
    };
    expect(cardStatementTotal(card)).toBe(9000);
    expect(cardInstallmentsRemaining(card) + cardPendingTotal(card)).toBe(67500);
  });
});
