import { describe, expect, it } from 'vitest';
import { advanceRecurringDate, materializeRecurringRule, recurringEntryId, recurringHistory, recurringOccurrenceOf, recurringOccurrencesThrough,
  validateRecurringRule, type RecurringRule } from './recurring';
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
