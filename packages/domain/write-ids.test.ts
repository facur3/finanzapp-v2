import { describe, expect, it } from 'vitest';
import type { Account, Entry } from './ledger';
import type { CreditCardProfile } from './liabilities';
import { newInstallmentPlan } from './installments';
import { initialRecord, type LedgerArchive } from './recovery';
import { initialTransferRecord } from './transfers';
import { newEntryRefund, newPlanPayoff, operationLineIds } from './operations';
import { WRITE_ID_TAKEN_MESSAGE, assertWriteIdAvailable, ledgerIdOwners } from './write-ids';

// Producto 25A-02: one id, one kind of write. Synthetic records only.
const createdAt = '2026-09-01T12:00:00.000Z';
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 100000, createdAt };
const savings: Account = { id: 'savings', name: 'Ahorro', currency: 'ARS', openingMinor: 0, createdAt };
const cardAccount: Account = { id: 'visa-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'visa', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 500000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const purchase: Entry = { id: 'buy', accountId: bank.id, kind: 'expense', amountMinor: 5000, merchant: 'Súper', category: 'Comida', dateISO: '2026-09-10', createdAt };
const plan = newInstallmentPlan({ id: 'tv', card, cardAccount, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-09-10', principalMinor: 30000, count: 3,
  placement: 'current', createdAt });
const base: LedgerArchive = { accounts: [bank, savings, cardAccount], records: [initialRecord(purchase)], cards: [card], installmentPlans: [plan],
  transfers: [initialTransferRecord({ id: 'move', fromAccountId: bank.id, toAccountId: savings.id, amountMinor: 100, note: '', dateISO: '2026-09-11', createdAt })] };
const refund = newEntryRefund(base, { id: 'r-1', entryId: 'buy', amountMinor: 1000, dateISO: '2026-09-12', todayISO: '2026-09-12', createdAt: '2026-09-12T15:00:00.000Z' });
const payoff = newPlanPayoff(base, { id: 'po-1', planId: 'tv', financing: 'recognised', dateISO: '2026-09-12', todayISO: '2026-09-12', createdAt: '2026-09-12T15:00:00.000Z' });
const archive: LedgerArchive = { ...base, purchaseOperations: [refund, payoff] };

describe('ledgerIdOwners', () => {
  it('names the kind that owns an id: a movement, a transfer, a plan or an operation (its projected lines included)', () => {
    expect(ledgerIdOwners(archive, 'buy')).toEqual(['entry']);
    expect(ledgerIdOwners(archive, 'move')).toEqual(['transfer']);
    expect(ledgerIdOwners(archive, 'tv')).toEqual(['plan']);
    expect(ledgerIdOwners(archive, 'r-1')).toEqual(['operation']);
    for (const line of operationLineIds(payoff)) expect(ledgerIdOwners(archive, line), line).toEqual(['operation']);
    expect(ledgerIdOwners(archive, 'free')).toEqual([]);
  });
  it('reports every owner when stored data already holds one id twice (read as stored, never refused on read)', () => {
    const both = { ...archive, records: [...archive.records, initialRecord({ ...purchase, id: 'tv' })] };
    expect(ledgerIdOwners(both, 'tv')).toEqual(['entry', 'plan']);
  });
});

describe('assertWriteIdAvailable', () => {
  it('lets a new id through, and the same kind through (that is the caller\'s idempotency question)', () => {
    expect(() => assertWriteIdAvailable(archive, 'free', 'entry')).not.toThrow();
    expect(() => assertWriteIdAvailable(archive, 'buy', 'entry')).not.toThrow();
    expect(() => assertWriteIdAvailable(archive, 'tv', 'plan')).not.toThrow();
  });
  it('refuses an id another kind of write owns', () => {
    for (const [id, kind] of [['buy', 'plan'], ['buy', 'transfer'], ['tv', 'entry'], ['move', 'entry'], ['move', 'plan'], ['r-1', 'entry'], ['r-1', 'plan']] as const) {
      expect(() => assertWriteIdAvailable(archive, id, kind), `${id} as ${kind}`).toThrow(WRITE_ID_TAKEN_MESSAGE);
    }
  });
});
