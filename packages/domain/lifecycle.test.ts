import { describe, expect, it } from 'vitest';
import { ACCOUNT_DELETED_MESSAGE, assertLiveAccount, deleteAccount, isLiveAccount, liveAccounts, validateAccount, validateEntry, type Account, type Entry, type LedgerSnapshot, type Transfer } from './ledger';
import { CARD_DELETED_MESSAGE, assertOpenAccount, assertTransferSides, deleteCreditCard, liquidTotalsByCurrency, postingAccountsFor, validateCreditCardChange, validateCreditCardProfile,
  type CreditCardProfile, type PersonalDebtProfile } from './liabilities';
import { BACKUP_SCHEMA_V10, BACKUP_SCHEMA_V11, createRecoveryBackup, initialRecord, parsePilotBackup, previewBackupImport, sameAccount, validateArchive, type LedgerArchive } from './recovery';
import { spendingReport } from './spending-report';

/** Producto 25B2: the deletion records of normal accounts (a dated tombstone) and cards (a flag). History is never
 * lost: every movement and transfer stays, readable as its account's; nothing new lands on a deleted row. */
const createdAt = '2026-09-01T12:00:00.000Z';
const now = '2026-09-27T10:00:00.000Z';
const cash: Account = { id: 'cash', name: 'Efectivo', currency: 'ARS', openingMinor: 100000, createdAt };
const bank: Account = { id: 'bank', name: 'Banco', currency: 'ARS', openingMinor: 0, createdAt };
const cardAccount: Account = { id: 'card-account', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt };
const card: CreditCardProfile = { id: 'card', accountId: cardAccount.id, issuer: 'Banco', last4: '4009', creditLimitMinor: 500000, closingDay: 20, dueDay: 5,
  active: true, deleted: false, createdAt, revision: 0, updatedAt: createdAt };
const entries: Entry[] = [
  { id: 'e1', accountId: 'cash', kind: 'expense', amountMinor: 1500, merchant: 'Kiosco', category: 'Comida', dateISO: '2026-09-05', createdAt },
  { id: 'e2', accountId: 'card-account', kind: 'expense', amountMinor: 20000, merchant: 'Súper', category: 'Comida', dateISO: '2026-09-10', createdAt },
];
const transfers: Transfer[] = [
  { id: 't1', fromAccountId: 'cash', toAccountId: 'bank', amountMinor: 5000, note: '', dateISO: '2026-09-11', createdAt },
  { id: 't2', fromAccountId: 'bank', toAccountId: 'card-account', amountMinor: 20000, note: 'Pago', dateISO: '2026-09-12', createdAt },
];
const snapshot: LedgerSnapshot = { accounts: [cash, bank, cardAccount], entries, transfers };

describe('a deleted account', () => {
  it('is a dated tombstone one revision on; never twice; always a revised row', () => {
    const gone = deleteAccount(cash, now);
    expect(gone).toEqual({ ...cash, revision: 1, updatedAt: now, deletedAt: now });
    expect(isLiveAccount(gone)).toBe(false);
    expect(liveAccounts([cash, gone, bank]).map(item => item.id)).toEqual(['cash', 'bank']);
    expect(() => deleteAccount(gone, now)).toThrow(ACCOUNT_DELETED_MESSAGE);
    expect(() => validateAccount(gone)).not.toThrow();
    expect(() => validateAccount({ ...cash, deletedAt: now })).toThrow('Estado de cuenta inválido.');
    expect(() => validateAccount({ ...gone, deletedAt: 'ayer' })).toThrow('Estado de cuenta inválido.');
    expect(() => deleteAccount(cash, 'no-date')).toThrow('Fecha de actualización inválida.');
    expect(sameAccount(cash, { ...cash })).toBe(true);
    expect(sameAccount(gone, { ...gone, deletedAt: undefined, revision: 1, updatedAt: now })).toBe(false);
  });

  it('keeps its history readable and counted, but leaves Disponible, the posting choices and new transfers', () => {
    const gone = deleteAccount(cash, now);
    const after: LedgerSnapshot = { ...snapshot, accounts: [gone, bank, cardAccount] };
    // The stored rows still validate against the tombstoned account (history), and reports still count its spending.
    expect(() => validateEntry(entries[0], after.accounts)).not.toThrow();
    const report = spendingReport(after, 'ARS', '2026-09', '2026-09-27');
    expect(report.status === 'ready' && report.expenseMinor).toBe(1500 + 20000);
    // Disponible: the deleted account's balance is history, the card is not liquid, the bank stays.
    expect(liquidTotalsByCurrency(snapshot, [card])).toEqual({ ARS: 100000 - 1500 - 5000 + 5000 - 20000 });
    expect(liquidTotalsByCurrency(after, [card])).toEqual({ ARS: 5000 - 20000 });
    // Nothing new lands on it.
    expect(postingAccountsFor('expense', after.accounts, [card]).map(item => item.id)).toEqual(['bank', 'card-account']);
    expect(() => assertLiveAccount('cash', after.accounts)).toThrow(ACCOUNT_DELETED_MESSAGE);
    expect(() => assertOpenAccount('cash', after.accounts, [card])).toThrow(ACCOUNT_DELETED_MESSAGE);
    expect(() => assertTransferSides({ fromAccountId: 'bank', toAccountId: 'cash' }, [card], [], after.accounts)).toThrow(ACCOUNT_DELETED_MESSAGE);
    expect(() => assertTransferSides({ fromAccountId: 'cash', toAccountId: 'bank' }, [card], [], after.accounts)).toThrow(ACCOUNT_DELETED_MESSAGE);
    expect(() => assertTransferSides({ fromAccountId: 'bank', toAccountId: 'card-account' }, [card], [], after.accounts)).not.toThrow();
    expect(() => assertLiveAccount('missing', after.accounts)).not.toThrow();
  });
});

describe('a deleted card', () => {
  it('is inactive and deleted, one revision on; never reactivated, never edited, never twice', () => {
    const gone = deleteCreditCard(card, now);
    expect(gone).toEqual({ ...card, active: false, deleted: true, revision: 1, updatedAt: now });
    expect(() => validateCreditCardProfile(gone, [cardAccount])).not.toThrow();
    expect(() => validateCreditCardProfile({ ...gone, active: true }, [cardAccount])).toThrow('Estado de tarjeta inválido.');
    expect(() => validateCreditCardProfile({ ...card, deleted: 'no' as never }, [cardAccount])).toThrow('Estado de tarjeta inválido.');
    expect(() => deleteCreditCard(gone, now)).toThrow(CARD_DELETED_MESSAGE);
    expect(() => validateCreditCardChange(gone, { ...gone, active: true, deleted: false, revision: 2 })).toThrow(CARD_DELETED_MESSAGE);
    expect(() => validateCreditCardChange(card, gone)).not.toThrow();
  });

  it('takes no purchase and no payment, while its purchases, payments and internal account stay', () => {
    const gone = deleteCreditCard(card, now);
    expect(postingAccountsFor('expense', snapshot.accounts, [gone]).map(item => item.id)).toEqual(['cash', 'bank']);
    expect(() => assertOpenAccount('card-account', snapshot.accounts, [gone])).toThrow(CARD_DELETED_MESSAGE);
    expect(() => assertTransferSides({ fromAccountId: 'bank', toAccountId: 'card-account' }, [gone], [], snapshot.accounts)).toThrow(CARD_DELETED_MESSAGE);
    // The internal account is still hidden from Disponible and its balance is unchanged: the recorded debt stays.
    expect(liquidTotalsByCurrency(snapshot, [gone])).toEqual({ ARS: 100000 - 1500 - 5000 + 5000 - 20000 });
    const debt: PersonalDebtProfile = { id: 'd', accountId: 'bank', direction: 'owed_by_me', counterparty: 'Ana', dueDateISO: null, note: '', active: false, deleted: true, createdAt, revision: 1, updatedAt: now };
    expect(() => assertOpenAccount('bank', snapshot.accounts, [gone], [debt])).toThrow('Esta deuda fue eliminada.');
  });
});

describe('backup v11', () => {
  const archive: LedgerArchive = { accounts: [cash, bank, cardAccount], records: entries.map(initialRecord), cards: [card] };

  it('is written only once an account or a card is deleted; without one the file stays v10 or older, byte for byte', () => {
    const plain = createRecoveryBackup(archive, new Date(now));
    expect(plain.schema).toBe('finanzapp.native-pilot.v8');
    expect(Object.keys(plain.cards[0])).not.toContain('deleted');
    expect(Object.keys(plain.accounts[0])).not.toContain('deletedAt');
    const v10 = createRecoveryBackup({ ...archive, recurring: [{ id: 'r', accountId: 'cash', kind: 'expense', amountMinor: 100, merchant: 'M', category: 'C', frequency: 'monthly',
      anchorDateISO: '2026-09-01', nextDateISO: '2026-10-01', active: false, deleted: true, createdAt, revision: 1, updatedAt: now }] }, new Date(now));
    expect(v10.schema).toBe(BACKUP_SCHEMA_V10);
    expect(Object.keys(v10.cards[0])).not.toContain('deleted');
  });

  it('round-trips a deleted account and a deleted card exactly, and an import never brings either back', () => {
    const gone = deleteAccount(cash, now), goneCard = deleteCreditCard(card, now);
    const withDeletions: LedgerArchive = { ...archive, accounts: [gone, bank, cardAccount], cards: [goneCard] };
    const backup = createRecoveryBackup(withDeletions, new Date(now));
    expect(backup.schema).toBe(BACKUP_SCHEMA_V11);
    expect(backup.accounts.find(item => item.id === 'cash')).toEqual(gone);
    expect(backup.accounts.find(item => item.id === 'bank')).toEqual(bank);
    expect(backup.cards[0]).toEqual(goneCard);
    const parsed = parsePilotBackup(JSON.stringify(backup)).archive;
    expect(parsed.accounts.find(item => item.id === 'cash')).toEqual(gone);
    expect(parsed.cards?.[0]).toEqual(goneCard);
    expect(() => validateArchive(parsed)).not.toThrow();
    // A copy from before the deletion meets the deleted rows: the live versions are conflicts, never applied.
    const older = createRecoveryBackup(archive, new Date(createdAt));
    const preview = previewBackupImport(withDeletions, parsePilotBackup(JSON.stringify(older)).archive);
    expect(preview.conflicts).toBeGreaterThan(0);
    expect(preview.accounts).toEqual([]);
    expect(preview.cards).toEqual([]);
  });

  it('reads older files without the new keys, and refuses the new keys in older schemas and an unknown version', () => {
    const v8 = createRecoveryBackup(archive, new Date(now));
    const parsed = parsePilotBackup(JSON.stringify(v8)).archive;
    expect(parsed.cards?.[0]).toEqual(card);
    expect(parsed.accounts.every(item => item.deletedAt === undefined)).toBe(true);
    const v11 = createRecoveryBackup({ ...archive, cards: [deleteCreditCard(card, now)] }, new Date(now));
    expect(() => parsePilotBackup(JSON.stringify({ ...v11, schema: BACKUP_SCHEMA_V10 }))).toThrow('campos faltantes');
    expect(() => parsePilotBackup(JSON.stringify({ ...v8, accounts: [{ ...cash, revision: 1, updatedAt: now, deletedAt: now }, bank, cardAccount] }))).toThrow('campos faltantes');
    expect(() => parsePilotBackup(JSON.stringify({ ...v11, schema: 'finanzapp.native-pilot.v12' }))).toThrow('versiones 1 a 11');
    expect(() => parsePilotBackup(JSON.stringify({ ...v11, cards: [{ ...v11.cards[0], active: true }] }))).toThrow('Estado de tarjeta inválido.');
  });
});
