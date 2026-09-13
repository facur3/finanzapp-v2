import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportSelection, shiftReportMonth, spendingShare } from '../src/ui/report-presentation.ts';
import type { LedgerSnapshot } from '@finanzapp/domain';

const createdAt = '2026-09-12T12:00:00Z';
const snapshot: LedgerSnapshot = { accounts: [
  { id: 'a', name: 'ARS de prueba', currency: 'ARS', openingMinor: 0, createdAt },
  { id: 'u', name: 'USD de prueba', currency: 'USD', openingMinor: 0, createdAt },
], entries: [
  { id: 'old', accountId: 'a', amountMinor: 101, kind: 'expense', merchant: 'Prueba', category: 'Otra', dateISO: '2025-12-31', createdAt },
  { id: 'future', accountId: 'u', amountMinor: 101, kind: 'expense', merchant: 'Prueba', category: 'Otra', dateISO: '2027-01-01', createdAt },
] };

test('malformed route params cannot crash report dates or mix currencies', () => {
  assert.equal(reportSelection(snapshot, ['USD', 'ARS'], ['2025-12'], '2026-09-12').currency, 'ARS');
  for (const month of ['2026-00', '2026-13', '2026-10', '1899-12', 'bad', ['2026-08']]) {
    assert.equal(reportSelection(snapshot, 'ARS', month, '2026-09-12').monthISO, '2026-09');
  }
  assert.equal(reportSelection(snapshot, 'USD', '2026-08', '2026-09-12').monthISO, '2026-08');
});
test('month navigation uses the selected currency history and never offers future months', () => {
  assert.equal(reportSelection(snapshot, 'ARS', undefined, '2026-09-12').earliestMonth, '2025-12');
  const usd = reportSelection(snapshot, 'USD', undefined, '2026-09-12');
  assert.equal(usd.earliestMonth, '2026-09');
  assert.equal(usd.currentMonth, '2026-09');
});
test('empty/single currency selection has a safe default and does not depend on ARS existing', () => {
  assert.equal(reportSelection({ ...snapshot, accounts: [snapshot.accounts[1]] }, 'ARS', undefined, '2026-09-12').currency, 'USD');
  assert.equal(reportSelection({ accounts: [], entries: [] }, undefined, undefined, '2026-09-12').currency, 'ARS');
});
test('month navigation crosses year boundaries without adding a fixed number of days', () => {
  assert.equal(shiftReportMonth('2026-01', -1), '2025-12');
  assert.equal(shiftReportMonth('2025-12', 1), '2026-01');
  assert.equal(shiftReportMonth('2024-03', -1), '2024-02');
});
test('the bar scale is share of total, not share of the largest category', () => {
  assert.deepEqual(spendingShare(300, 1000), { fraction: 0.3, label: '30 %' });
  assert.deepEqual(spendingShare(1000, 1000), { fraction: 1, label: '100 %' });
  assert.equal(spendingShare(1, Number.MAX_SAFE_INTEGER).label, '<0,1 %');
  assert.ok(spendingShare(1, Number.MAX_SAFE_INTEGER).fraction > 0);
});
test('invalid totals never produce NaN/Infinity widths or a fabricated percentage', () => {
  for (const [part, total] of [[1, 0], [2, 1], [-1, 1], [1, Infinity], [NaN, 10], [1.5, 10]]) {
    assert.deepEqual(spendingShare(part, total), { fraction: 0, label: '—' });
  }
});
