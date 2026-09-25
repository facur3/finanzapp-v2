import { describe, expect, it } from 'vitest';
import { advanceRecurringDate, deleteRecurringRule, materializeRecurringRule, pauseRecurringRule, recurringEntryId, recurringHistory, recurringOccurrenceOf, recurringOccurrencesThrough,
  resumeRecurringRule, validateRecurringRule, validateRecurringRuleChange, type RecurringRule } from './recurring';
import type { Account } from './ledger';

const account: Account = {
  id: 'account',
  name: 'Cuenta',
  currency: 'ARS',
  openingMinor: 0,
  createdAt: '2026-01-01T12:00:00.000Z',
};
const monthly: RecurringRule = {
  id: 'rent',
  accountId: account.id,
  kind: 'expense',
  amountMinor: 125000,
  merchant: 'Alquiler',
  category: 'Vivienda',
  frequency: 'monthly',
  anchorDateISO: '2026-01-31',
  nextDateISO: '2026-01-31',
  active: true,
  deleted: false,
  createdAt: '2026-01-01T12:00:00.000Z',
  revision: 0,
  updatedAt: '2026-01-01T12:00:00.000Z',
};

describe('native recurring schedules', () => {
  it('keeps the original day across short months instead of drifting forever', () => {
    const february = advanceRecurringDate('2026-01-31', 'monthly', '2026-01-31');
    const march = advanceRecurringDate(february, 'monthly', '2026-01-31');
    const april = advanceRecurringDate(march, 'monthly', '2026-01-31');
    expect(february).toBe('2026-02-28');
    expect(march).toBe('2026-03-31');
    expect(april).toBe('2026-04-30');
  });

  it('handles leap-day yearly schedules without changing the anchor', () => {
    expect(advanceRecurringDate('2028-02-29', 'yearly', '2028-02-29')).toBe('2029-02-28');
    expect(advanceRecurringDate('2031-02-28', 'yearly', '2028-02-29')).toBe('2032-02-29');
  });

  it('returns every missed active occurrence exactly once and stops paused rules', () => {
    expect(recurringOccurrencesThrough(monthly, '2026-04-30')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
    expect(recurringOccurrencesThrough({ ...monthly, active: false }, '2026-04-30')).toEqual([]);
  });

  it('materializes deterministic ledger entries and advances the rule atomically', () => {
    const result = materializeRecurringRule(monthly, [account], '2026-03-31', '2026-04-01T00:00:00.000Z');
    expect(result.entries.map(entry => entry.id)).toEqual([
      recurringEntryId('rent', '2026-01-31'),
      recurringEntryId('rent', '2026-02-28'),
      recurringEntryId('rent', '2026-03-31'),
    ]);
    expect(result.entries.every(entry => entry.amountMinor === monthly.amountMinor && entry.accountId === account.id)).toBe(true);
    expect(result.rule.nextDateISO).toBe('2026-04-30');
    expect(result.rule.revision).toBe(1);
  });

  it('rejects malformed rules before they can affect a balance', () => {
    validateRecurringRule(monthly, [account]);
    expect(() => validateRecurringRule({ ...monthly, accountId: 'missing' }, [account])).toThrow();
    expect(() => validateRecurringRule({ ...monthly, amountMinor: 0 }, [account])).toThrow();
    expect(() => validateRecurringRule({ ...monthly, nextDateISO: '2025-12-31' }, [account])).toThrow();
    expect(() => validateRecurringRule({ ...monthly, updatedAt: 'invalid' }, [account])).toThrow();
  });
});

describe('the payments a rule registered', () => {
  it('reads the rule and date back from a registered occurrence id', () => {
    expect(recurringOccurrenceOf(recurringEntryId('rent', '2026-03-31'))).toEqual({ ruleId: 'rent', dateISO: '2026-03-31' });
    expect(recurringOccurrenceOf(recurringEntryId('a_b_20260101', '2026-02-01'))).toEqual({ ruleId: 'a_b_20260101', dateISO: '2026-02-01' });
    expect(recurringOccurrenceOf('1f0c9a8e-uuid')).toBeNull();
    expect(recurringOccurrenceOf('rec_rent_20261399')).toBeNull();
    expect(recurringOccurrenceOf('rec__20260101')).toBeNull();
  });

  it('lists only the movements in the ledger, newest first, and never a scheduled date', () => {
    const { entries } = materializeRecurringRule(monthly, [account], '2026-03-31', '2026-03-31T12:00:00.000Z');
    const manual = { ...entries[0], id: 'manual', merchant: 'Alquiler' };
    const sibling = { ...entries[0], id: recurringEntryId('rent_2', '2026-01-31') };
    // The person moved the February payment to another day: it still belongs to its rule.
    const moved = entries.map(entry => entry.dateISO === '2026-02-28' ? { ...entry, dateISO: '2026-03-02' } : entry);
    const history = recurringHistory(monthly, [manual, sibling, ...moved]);
    expect(history.map(entry => entry.dateISO)).toEqual(['2026-03-31', '2026-03-02', '2026-01-31']);
    expect(recurringHistory(monthly, [])).toEqual([]);
    expect(recurringHistory({ id: 'rent_2' }, [sibling]).length).toBe(1);
  });
});

describe('pausing, resuming and deleting a rule (Producto 24UX4)', () => {
  const now = '2026-03-10T09:00:00.000Z';
  it('pausing keeps the next date and records nothing while paused', () => {
    const paused = pauseRecurringRule(monthly, now);
    expect(paused).toMatchObject({ active: false, deleted: false, nextDateISO: monthly.nextDateISO, revision: 1, updatedAt: now });
    expect(() => validateRecurringRule(paused, [account])).not.toThrow();
    expect(materializeRecurringRule(paused, [account], '2026-12-31', now).entries).toEqual([]);
  });

  it('resuming skips what fell due while paused and keeps the anchor day', () => {
    const paused = pauseRecurringRule(monthly, now);
    const resumed = resumeRecurringRule(paused, '2026-04-10', now);
    // January 31 → the first occurrence on or after April 10 on the 31st-anchored calendar is April 30.
    expect(resumed).toMatchObject({ active: true, nextDateISO: '2026-04-30', anchorDateISO: '2026-01-31', revision: 2 });
    expect(materializeRecurringRule(resumed, [account], '2026-04-10', now).entries).toEqual([]);
    // A next date still ahead is kept as it was; one due today is recorded today.
    expect(resumeRecurringRule({ ...paused, nextDateISO: '2026-05-31' }, '2026-04-10', now).nextDateISO).toBe('2026-05-31');
    expect(resumeRecurringRule(paused, '2026-01-31', now).nextDateISO).toBe('2026-01-31');
  });

  it('a deletion record is inactive for good, keeps every other field and refuses any later change', () => {
    const deleted = deleteRecurringRule(monthly, now);
    expect(deleted).toEqual({ ...monthly, active: false, deleted: true, revision: 1, updatedAt: now });
    expect(() => validateRecurringRule(deleted, [account])).not.toThrow();
    expect(recurringOccurrencesThrough(deleted, '2026-12-31')).toEqual([]);
    expect(() => validateRecurringRule({ ...deleted, active: true }, [account])).toThrow('Estado de recurrente inválido.');
    expect(() => pauseRecurringRule(deleted, now)).toThrow('Este recurrente fue eliminado.');
    expect(() => resumeRecurringRule(deleted, '2026-04-10', now)).toThrow('Este recurrente fue eliminado.');
    expect(() => deleteRecurringRule(deleted, now)).toThrow('Este recurrente fue eliminado.');
    expect(() => validateRecurringRuleChange(deleted, { ...deleted, merchant: 'Otro', revision: 2 }, [account])).toThrow('Este recurrente fue eliminado.');
    expect(() => validateRecurringRule({ ...monthly, deleted: undefined as unknown as boolean }, [account])).toThrow('Estado de recurrente inválido.');
  });

  it('deleting never touches the movements the rule recorded: its history still reads them by id', () => {
    const recorded = materializeRecurringRule(monthly, [account], '2026-02-28', now).entries;
    deleteRecurringRule(monthly, now);
    expect(recurringHistory(monthly, recorded).map(entry => entry.dateISO)).toEqual(['2026-02-28', '2026-01-31']);
  });
});
