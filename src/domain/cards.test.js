import { describe, expect, it } from 'vitest';
import { addCardPurchase, cardInstallmentsRemaining, cardStatementTotal } from './cards.js';

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

  it('adds a one-payment purchase directly to this statement', () => {
    const card = addCardPurchase({ saldo: 3000, compras: [], cuotas: [] }, {
      amount: 2500,
      installments: 1,
      merchant: 'Café',
    });
    expect(card.saldo).toBe(5500);
    expect(cardStatementTotal(card)).toBe(2500);
  });
});
