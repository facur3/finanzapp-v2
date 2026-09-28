import { describe, expect, it } from 'vitest';
import { CYCLE_CLOSING_ORDER_MESSAGE, CYCLE_DUE_ORDER_MESSAGE, CYCLE_HISTORY_MESSAGE, CYCLE_INVALID_MESSAGE, CYCLE_NEXT_CLOSING_MESSAGE, CYCLE_STALE_MESSAGE,
  addDaysISO, assertCardCycleChange, cardCycleView, cardStatementOnOrAfter, cardStatementsFrom, daysBetweenISO, newCardCycle, planCardCycle,
  validateCardCycleDates, type CardCycleDates, type CardCycleDays } from './card-cycles';
import { cardCycle, cardStatementActivity, type CreditCardProfile } from './liabilities';
import { installmentSchedule, newInstallmentPlan, statementClosingOnOrAfter, statementDueDate } from './installments';
import type { Account, Entry } from './ledger';

/** Producto 24T2: a statement is one closing and the due date of THAT closing. The next due date may belong to the
 * statement that already closed; the rule `due > closing` never compares two statements. */
const now = '2026-10-01T12:00:00.000Z';
const later = '2026-10-27T12:00:00.000Z';
const days = (closingDay: number, dueDay: number): CardCycleDays => ({ closingDay, dueDay });
const row = (sequence: number, closingISO: string, dueISO: string, createdAt = now, generator: CardCycleDays = { closingDay: 28, dueDay: 5 }, monthISO = closingISO.slice(0, 7)): CardCycleDates =>
  ({ cardId: 'card', sequence, closingISO, dueISO, ...generator, monthISO, createdAt, revision: 0, updatedAt: createdAt });
const installmentDates = (plan: { days: CardCycleDays; rows: CardCycleDates[] }, purchaseDateISO: string, count: number) =>
  cardStatementsFrom(plan.days, plan.rows, purchaseDateISO, 0, count).map(item => item.closingISO);
const view = (cycle: CardCycleDays, todayISO: string, rows: CardCycleDates[] = []) => {
  const result = cardCycleView(cycle, rows, todayISO);
  return { previous: [result.previous.closingISO, result.previous.dueISO], open: [result.open.closingISO, result.open.dueISO], start: result.openStartISO,
    nextDue: result.nextDue.dueISO, nextDueOf: result.nextDue.closingISO, toPay: result.toPay?.closingISO ?? null };
};

describe('the next closing and the next due date are two events', () => {
  it('closing 28, due 5, on 2026-10-01: the next due (5 oct) belongs to the statement closed on 28 sep, the next closing is 28 oct (due 5 nov)', () => {
    expect(view(days(28, 5), '2026-10-01')).toEqual({ previous: ['2026-09-28', '2026-10-05'], open: ['2026-10-28', '2026-11-05'], start: '2026-09-29',
      nextDue: '2026-10-05', nextDueOf: '2026-09-28', toPay: '2026-09-28' });
  });

  it('a due day after the closing day: both dates are the open statement once the previous due passed', () => {
    expect(view(days(20, 29), '2026-10-01')).toEqual({ previous: ['2026-09-20', '2026-09-29'], open: ['2026-10-20', '2026-10-29'], start: '2026-09-21',
      nextDue: '2026-10-29', nextDueOf: '2026-10-20', toPay: null });
    expect(view(days(20, 29), '2026-09-25').nextDue).toBe('2026-09-29');
  });

  it('the same numeric day in the following month (closing 5, due 5)', () => {
    expect(view(days(5, 5), '2026-10-10')).toEqual({ previous: ['2026-10-05', '2026-11-05'], open: ['2026-11-05', '2026-12-05'], start: '2026-10-06',
      nextDue: '2026-11-05', nextDueOf: '2026-10-05', toPay: '2026-10-05' });
  });

  it('on the closing day the statement is still open; the day after it is the one to pay', () => {
    expect(view(days(28, 5), '2026-10-28')).toMatchObject({ open: ['2026-10-28', '2026-11-05'], previous: ['2026-09-28', '2026-10-05'], nextDue: '2026-11-05', toPay: null });
    expect(view(days(28, 5), '2026-10-29')).toMatchObject({ open: ['2026-11-28', '2026-12-05'], previous: ['2026-10-28', '2026-11-05'], nextDue: '2026-11-05', toPay: '2026-10-28' });
  });

  it('on the due day it is still the next due date; the day after, the open statement is', () => {
    expect(view(days(28, 5), '2026-11-05')).toMatchObject({ nextDue: '2026-11-05', nextDueOf: '2026-10-28' });
    expect(view(days(28, 5), '2026-11-06')).toMatchObject({ nextDue: '2026-12-05', nextDueOf: '2026-11-28', toPay: null });
  });

  it('February, leap years, days 29–31 and the year boundary', () => {
    expect(view(days(31, 10), '2026-02-10')).toMatchObject({ open: ['2026-02-28', '2026-03-10'], previous: ['2026-01-31', '2026-02-10'], nextDue: '2026-02-10' });
    expect(view(days(30, 10), '2028-02-15')).toMatchObject({ open: ['2028-02-29', '2028-03-10'] });
    expect(view(days(29, 5), '2027-02-10')).toMatchObject({ open: ['2027-02-28', '2027-03-05'] });
    expect(view(days(31, 31), '2026-03-01')).toMatchObject({ open: ['2026-03-31', '2026-04-30'], previous: ['2026-02-28', '2026-03-31'] });
    expect(view(days(28, 5), '2026-12-30')).toEqual({ previous: ['2026-12-28', '2027-01-05'], open: ['2027-01-28', '2027-02-05'], start: '2026-12-29',
      nextDue: '2027-01-05', nextDueOf: '2026-12-28', toPay: '2026-12-28' });
    expect(view(days(1, 10), '2027-01-01')).toMatchObject({ open: ['2027-01-01', '2027-01-10'], previous: ['2026-12-01', '2026-12-10'], start: '2026-12-02' });
  });

  it('cardCycle keeps its 24T1 shape: the open statement and ITS due', () => {
    expect(cardCycle(days(28, 5), '2026-10-01')).toEqual({ startISO: '2026-09-29', closingISO: '2026-10-28', dueISO: '2026-11-05' });
  });
});

describe('exact cycle dates', () => {
  const exact = [row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-26', '2026-11-04')];

  it('an exact statement replaces its usual one; the next ones follow the usual days, anchored on it', () => {
    expect(view(days(28, 5), '2026-10-01', exact)).toMatchObject({ open: ['2026-10-26', '2026-11-04'], previous: ['2026-09-28', '2026-10-05'], nextDue: '2026-10-05' });
    expect(view(days(28, 5), '2026-10-27', exact)).toMatchObject({ open: ['2026-11-28', '2026-12-05'], previous: ['2026-10-26', '2026-11-04'], start: '2026-10-27',
      nextDue: '2026-11-04', toPay: '2026-10-26' });
    expect(view(days(28, 5), '2026-08-20', exact)).toMatchObject({ open: ['2026-08-28', '2026-09-05'] });
  });

  it('a closing moved across a month boundary never duplicates nor drops a statement', () => {
    // Closing day 1: the 1 nov statement closes on 31 oct this time.
    const moved = [row(0, '2026-10-01', '2026-10-10', now, days(1, 10)), row(1, '2026-10-31', '2026-11-10', now, days(1, 10), '2026-11')];
    const closings = cardStatementsFrom(days(1, 10), moved, '2026-08-15', 0, 6).map(item => item.closingISO);
    expect(closings).toEqual(['2026-09-01', '2026-10-01', '2026-10-31', '2026-12-01', '2027-01-01', '2027-02-01']);
  });

  it('dates may fall in different months; only due > closing inside one statement is required', () => {
    const far = [row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-28', '2026-12-15')];
    // The october statement is due after the november one: the next due date is the earliest one still ahead.
    expect(view(days(28, 5), '2026-11-01', far)).toEqual({ previous: ['2026-10-28', '2026-12-15'], open: ['2026-11-28', '2026-12-05'], start: '2026-10-29',
      nextDue: '2026-12-05', nextDueOf: '2026-11-28', toPay: '2026-10-28' });
    expect(view(days(28, 5), '2026-12-10', far)).toMatchObject({ nextDue: '2026-12-15', nextDueOf: '2026-10-28', open: ['2026-12-28', '2027-01-05'] });
  });
});

describe('planning a change never moves a statement that closed', () => {
  const base = { cardId: 'card', days: days(28, 5), rows: [] as CardCycleDates[], todayISO: '2026-10-01', nowISO: now };

  it('nothing to change is no change', () => {
    expect(planCardCycle({ ...base, intent: {} })).toEqual({ days: days(28, 5), rows: [], changed: false });
    expect(planCardCycle({ ...base, intent: { days: days(28, 5), open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-28', dueISO: '2026-11-05' } } }).changed).toBe(false);
  });

  it('exact dates for the open statement freeze the previous one and keep the usual days', () => {
    const plan = planCardCycle({ ...base, intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } } });
    expect(plan.days).toEqual(days(28, 5));
    expect(plan.rows).toEqual([row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-26', '2026-11-04')]);
    expect(view(plan.days, '2026-10-01', plan.rows)).toMatchObject({ open: ['2026-10-26', '2026-11-04'], nextDue: '2026-10-05' });
  });

  it('new usual days alone apply after the open statement (it keeps its dates); the statement still to pay keeps its due', () => {
    const plan = planCardCycle({ ...base, intent: { days: days(15, 25) } });
    expect(plan.rows).toEqual([row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-28', '2026-11-05')]);
    expect(view(plan.days, '2026-10-01', plan.rows)).toMatchObject({ previous: ['2026-09-28', '2026-10-05'], open: ['2026-10-28', '2026-11-05'], nextDue: '2026-10-05' });
    expect(cardStatementsFrom(plan.days, plan.rows, '2026-10-29', 0, 2).map(item => item.closingISO)).toEqual(['2026-11-15', '2026-12-15']);
    // Without the freeze the previous statement would have become 15 sep and its due would have vanished.
    expect(view(days(15, 25), '2026-10-01')).toMatchObject({ previous: ['2026-09-15', '2026-09-25'], nextDue: '2026-10-25' });
  });

  it('a calendar moving from the 1st to the 30th keeps one statement per cycle', () => {
    const start = { ...base, days: days(1, 10), rows: [row(0, '2026-10-01', '2026-10-10', now, days(1, 10)), row(1, '2026-10-31', '2026-11-10', now, days(1, 10), '2026-11')], todayISO: '2026-11-05' };
    const plan = planCardCycle({ ...start, nowISO: later, intent: { days: days(30, 10), open: { statementClosingISO: '2026-12-01', closingISO: '2026-11-30', dueISO: '2026-12-10' } } });
    const closings = cardStatementsFrom(plan.days, plan.rows, '2026-09-15', 0, 6).map(item => item.closingISO);
    expect(closings).toEqual(['2026-10-01', '2026-10-31', '2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28']);
    expect(plan.rows.slice(0, 2)).toEqual(start.rows);
  });

  it('review round: new usual days never invent a statement before the chain; history keeps the calendar it had', () => {
    // Closing 1, due 8, changed to 13/2 on 2026-10-02: the statement to pay is still the 1 oct one (due 8 oct).
    const first = planCardCycle({ ...base, days: days(1, 8), todayISO: '2026-10-02', intent: { days: days(13, 2) } });
    expect(first.rows).toEqual([row(0, '2026-10-01', '2026-10-08', now, days(1, 8)), row(1, '2026-11-01', '2026-11-08', now, days(1, 8))]);
    expect(view(first.days, '2026-10-02', first.rows)).toMatchObject({ previous: ['2026-10-01', '2026-10-08'], nextDue: '2026-10-08', toPay: '2026-10-01', open: ['2026-11-01', '2026-11-08'] });
    expect(cardStatementsFrom(first.days, first.rows, '2026-08-15', 0, 4).map(item => item.closingISO)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-13']);
    // Closing 28, due 5, changed to 12/11: no «12 sep» statement appears, and a purchase of 10 sep stays in the 28 sep one.
    const second = planCardCycle({ ...base, todayISO: '2026-10-02', intent: { days: days(12, 11) } });
    expect(cardStatementOnOrAfter(second.days, second.rows, '2026-09-10').closingISO).toBe('2026-09-28');
    expect(cardStatementsFrom(second.days, second.rows, '2026-08-15', 0, 2).map(item => item.closingISO)).toEqual(['2026-08-28', '2026-09-28']);
    for (const day of ['2026-10-06', '2026-10-09', '2026-10-11']) expect(view(second.days, day, second.rows).nextDue).not.toBe('2026-10-11');
    // Closing 28, due 31 in March: two closed statements share the 31 mar due; after new days, the older one is still the one to pay.
    const march = planCardCycle({ ...base, days: days(28, 31), todayISO: '2027-03-30', intent: { days: days(10, 20) } });
    expect(view(march.days, '2027-03-30', march.rows)).toMatchObject({ toPay: '2027-02-28', nextDue: '2027-03-31' });
    expect(cardStatementOnOrAfter(march.days, march.rows, '2027-02-20').closingISO).toBe('2027-02-28');
  });

  it('review round: the calendar reviewer\'s cases', () => {
    // F1: 9/15 changed to 10/10 on 2026-07-10 keeps the next due on 15 jul (no statement «closing 10 jun» appears).
    const f1 = planCardCycle({ ...base, days: days(9, 15), todayISO: '2026-07-10', intent: { days: days(10, 10) } });
    expect(view(f1.days, '2026-07-10', f1.rows)).toMatchObject({ nextDue: '2026-07-15', previous: ['2026-07-09', '2026-07-15'], toPay: '2026-07-09' });
    expect(cardStatementOnOrAfter(f1.days, f1.rows, '2026-06-05').closingISO).toBe('2026-06-09');
    // F3: the open 28 oct corrected to 12 oct: October keeps one statement; after it, November.
    const f3 = planCardCycle({ ...base, intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-12', dueISO: '2026-10-20' } } });
    expect(cardStatementsFrom(f3.days, f3.rows, '2026-09-01', 0, 4).map(item => item.closingISO)).toEqual(['2026-09-28', '2026-10-12', '2026-11-28', '2026-12-28']);
    expect(view(f3.days, '2026-10-13', f3.rows).open[0]).toBe('2026-11-28');
    expect(installmentDates(f3, '2026-10-05', 3)).toEqual(['2026-10-12', '2026-11-28', '2026-12-28']);
    // The «closed earlier» variant: on 27 oct the open 28 oct is corrected to 11 oct; the next closing is 28 nov, and the
    // same correction sent again from a reopened form is stale-proof (it finds its own statement closed).
    const earlier = planCardCycle({ ...base, todayISO: '2026-10-27', intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-11', dueISO: '2026-11-04' } } });
    expect(view(earlier.days, '2026-10-27', earlier.rows)).toMatchObject({ previous: ['2026-10-11', '2026-11-04'], open: ['2026-11-28', '2026-12-05'] });
    // F4: new usual days alone never close the open statement retroactively.
    const f4 = planCardCycle({ ...base, todayISO: '2026-10-25', intent: { days: days(13, 14) } });
    expect(view(f4.days, '2026-10-25', f4.rows)).toMatchObject({ previous: ['2026-09-28', '2026-10-05'], open: ['2026-10-28', '2026-11-05'], nextDue: '2026-11-05' });
    expect(cardStatementsFrom(f4.days, f4.rows, '2026-09-29', 0, 1)[0].closingISO).toBe('2026-10-28');
    // F5: new days with the open dates the person kept: the open statement keeps exactly those dates.
    const f5 = planCardCycle({ ...base, intent: { days: days(15, 25), open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-28', dueISO: '2026-11-05' } } });
    expect(view(f5.days, '2026-10-01', f5.rows).open).toEqual(['2026-10-28', '2026-11-05']);
  });

  it('property: correcting the open closing by 1 to 20 days either way leaves one statement per slot', () => {
    for (let closingDay = 1; closingDay <= 31; closingDay += 2) {
      for (const todayISO of ['2026-01-10', '2026-02-20', '2026-06-01', '2026-12-15', '2028-02-10']) {
        const cycle = days(closingDay, closingDay === 31 ? 10 : closingDay + 1 > 31 ? 1 : closingDay + 1);
        const before = cardCycleView(cycle, [], todayISO);
        for (let shift = -20; shift <= 20; shift++) {
          if (!shift) continue;
          const closingISO = addDaysISO(before.open.closingISO, shift);
          if (closingISO <= before.previous.closingISO) continue;
          const plan = planCardCycle({ cardId: 'card', days: cycle, rows: [], todayISO, nowISO: now,
            intent: { open: { statementClosingISO: before.open.closingISO, closingISO, dueISO: addDaysISO(closingISO, 8) } } });
          const list = cardStatementsFrom(plan.days, plan.rows, addDaysISO(before.previous.closingISO, -40), 0, 5).map(item => item.closingISO);
          const nextGrid = cardStatementsFrom(cycle, [], addDaysISO(before.open.closingISO, 1), 0, 2).map(item => item.closingISO);
          const expected = [cardStatementsFrom(cycle, [], addDaysISO(before.previous.closingISO, -40), 0, 1)[0].closingISO, before.previous.closingISO, closingISO,
            ...nextGrid.filter(item => item > closingISO)].slice(0, 5);
          expect(list.slice(0, expected.length)).toEqual(expected);
        }
      }
    }
  });

  it('corrects the due date of the statement still to pay; its closing stays', () => {
    const plan = planCardCycle({ ...base, intent: { toPay: { statementClosingISO: '2026-09-28', dueISO: '2026-10-06' } } });
    expect(plan.rows).toEqual([row(0, '2026-09-28', '2026-10-06')]);
    expect(view(plan.days, '2026-10-01', plan.rows)).toMatchObject({ nextDue: '2026-10-06', open: ['2026-10-28', '2026-11-05'] });
  });

  it('the issuer closed earlier than expected: the open statement becomes the closed one', () => {
    const plan = planCardCycle({ ...base, todayISO: '2026-10-27', intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } } });
    expect(view(plan.days, '2026-10-27', plan.rows)).toMatchObject({ previous: ['2026-10-26', '2026-11-04'], open: ['2026-11-28', '2026-12-05'], toPay: '2026-10-26', start: '2026-10-27' });
  });

  it('a later correction of the same statement updates its row; the next month appends one; closed rows never change', () => {
    const first = planCardCycle({ ...base, intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } } });
    const again = planCardCycle({ ...base, rows: first.rows, nowISO: '2026-10-02T09:00:00.000Z', intent: { open: { statementClosingISO: '2026-10-26', closingISO: '2026-10-27', dueISO: '2026-11-04' } } });
    expect(again.rows[1]).toEqual({ ...row(1, '2026-10-27', '2026-11-04'), revision: 1, updatedAt: '2026-10-02T09:00:00.000Z' });
    const november = planCardCycle({ ...base, rows: again.rows, todayISO: '2026-11-10', nowISO: '2026-11-10T09:00:00.000Z',
      intent: { open: { statementClosingISO: '2026-11-28', closingISO: '2026-11-25', dueISO: '2026-12-03' } } });
    expect(november.rows.slice(0, 2)).toEqual(again.rows);
    expect(november.rows[2]).toEqual(row(2, '2026-11-25', '2026-12-03', '2026-11-10T09:00:00.000Z'));
    // A month without any correction between two corrections is frozen too, so the chain stays consecutive.
    const january = planCardCycle({ ...base, rows: november.rows, todayISO: '2027-01-10', nowISO: '2027-01-10T09:00:00.000Z',
      intent: { open: { statementClosingISO: '2027-01-28', closingISO: '2027-01-27', dueISO: '2027-02-04' } } });
    expect(january.rows.map(item => item.closingISO)).toEqual(['2026-09-28', '2026-10-27', '2026-11-25', '2026-12-28', '2027-01-27']);
  });

  it('refuses a stale form, a due on or before its closing and a closing on or before the previous one', () => {
    expect(() => planCardCycle({ ...base, intent: { open: { statementClosingISO: '2026-09-28', closingISO: '2026-10-26', dueISO: '2026-11-04' } } })).toThrow(CYCLE_STALE_MESSAGE);
    expect(() => planCardCycle({ ...base, todayISO: '2026-10-06', intent: { toPay: { statementClosingISO: '2026-09-28', dueISO: '2026-10-08' } } })).toThrow(CYCLE_STALE_MESSAGE);
    expect(() => planCardCycle({ ...base, intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-10-28', dueISO: '2026-10-28' } } })).toThrow(CYCLE_DUE_ORDER_MESSAGE);
    expect(() => planCardCycle({ ...base, intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-11-05', dueISO: '2026-11-01' } } })).toThrow(CYCLE_DUE_ORDER_MESSAGE);
    expect(() => planCardCycle({ ...base, intent: { open: { statementClosingISO: '2026-10-28', closingISO: '2026-09-28', dueISO: '2026-10-10' } } })).toThrow(CYCLE_CLOSING_ORDER_MESSAGE);
    expect(() => planCardCycle({ ...base, intent: { toPay: { statementClosingISO: '2026-09-28', dueISO: '2026-09-28' } } })).toThrow(CYCLE_DUE_ORDER_MESSAGE);
  });

  it('storage refuses a change that would move or remove a closed statement', () => {
    const rows = [row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-26', '2026-11-04')];
    expect(() => assertCardCycleChange({ days: days(28, 5), rows }, { days: days(28, 5), rows: rows.slice(1) }, '2026-10-01')).toThrow(CYCLE_HISTORY_MESSAGE);
    expect(() => assertCardCycleChange({ days: days(28, 5), rows }, { days: days(28, 5), rows: [row(0, '2026-09-27', '2026-10-05'), rows[1]] }, '2026-10-01')).toThrow(CYCLE_HISTORY_MESSAGE);
    // New days without freezing the previous statement would move it.
    expect(() => assertCardCycleChange({ days: days(28, 5), rows: [] }, { days: days(15, 25), rows: [] }, '2026-10-01')).toThrow(CYCLE_HISTORY_MESSAGE);
    // The open statement and the due still ahead may change.
    expect(() => assertCardCycleChange({ days: days(28, 5), rows }, { days: days(28, 5), rows: [row(0, '2026-09-28', '2026-10-06'), row(1, '2026-10-27', '2026-11-05')] }, '2026-10-01')).not.toThrow();
  });
});

describe('a new card', () => {
  it('takes its usual days from the two dates; no row when those days already give that statement', () => {
    expect(newCardCycle({ cardId: 'card', closingISO: '2026-10-28', dueISO: '2026-11-05', todayISO: '2026-10-01', nowISO: now })).toEqual({ days: days(28, 5), rows: [] });
    expect(newCardCycle({ cardId: 'card', closingISO: '2026-10-20', dueISO: '2026-10-29', todayISO: '2026-10-01', nowISO: now })).toEqual({ days: days(20, 29), rows: [] });
    expect(newCardCycle({ cardId: 'card', closingISO: '2027-02-28', dueISO: '2027-03-10', todayISO: '2027-02-01', nowISO: now })).toEqual({ days: days(28, 10), rows: [] });
  });

  it('stores the statement exactly when the usual days cannot reproduce it, starting with the statement before it', () => {
    const late = newCardCycle({ cardId: 'card', closingISO: '2026-10-28', dueISO: '2026-12-05', todayISO: '2026-10-01', nowISO: now });
    expect(late).toEqual({ days: days(28, 5), rows: [row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-28', '2026-12-05')] });
    const skipped = newCardCycle({ cardId: 'card', closingISO: '2026-11-28', dueISO: '2026-12-05', todayISO: '2026-10-01', nowISO: now });
    expect(view(skipped.days, '2026-10-01', skipped.rows)).toMatchObject({ open: ['2026-11-28', '2026-12-05'], previous: ['2026-09-28', '2026-10-05'] });
  });

  it('refuses a past next closing and a due on or before it', () => {
    expect(() => newCardCycle({ cardId: 'card', closingISO: '2026-09-30', dueISO: '2026-10-10', todayISO: '2026-10-01', nowISO: now })).toThrow(CYCLE_NEXT_CLOSING_MESSAGE);
    expect(() => newCardCycle({ cardId: 'card', closingISO: '2026-10-28', dueISO: '2026-10-28', todayISO: '2026-10-01', nowISO: now })).toThrow(CYCLE_DUE_ORDER_MESSAGE);
  });
});

describe('instalment schedules read the calendar known at creation', () => {
  const account: Account = { id: 'card-acc', name: 'Visa', currency: 'ARS', openingMinor: 0, createdAt: now };
  const card: CreditCardProfile = { id: 'card', accountId: account.id, issuer: '', last4: '', creditLimitMinor: null, closingDay: 28, dueDay: 5,
    active: true, deleted: false, createdAt: now, revision: 0, updatedAt: now };
  const exact = [row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-26', '2026-11-04')];

  it('without exact dates the schedule is the 24T1 grid, date for date', () => {
    const schedule = installmentSchedule(card, '2026-10-10', 'current', 1200, 12);
    expect(schedule.map(item => item.billingDateISO)).toEqual(Array.from({ length: 12 }, (_, index) =>
      statementClosingOnOrAfter(`${2026 + Math.floor((9 + index) / 12)}-${String(((9 + index) % 12) + 1).padStart(2, '0')}-01`, 28)));
    expect(schedule.every(item => item.dueDateISO === statementDueDate(item.billingDateISO, 5))).toBe(true);
  });

  it('a plan created after exact dates uses them; one created before keeps its schedule', () => {
    const before = newInstallmentPlan({ id: 'old', card, cardAccount: account, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-10-10', principalMinor: 3000, count: 3, placement: 'current', createdAt: now });
    const after = newInstallmentPlan({ id: 'new', card, cardAccount: account, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-10-10', principalMinor: 3000, count: 3, placement: 'current', createdAt: now, cycleDates: exact });
    expect(before.schedule.map(item => [item.billingDateISO, item.dueDateISO])).toEqual([['2026-10-28', '2026-11-05'], ['2026-11-28', '2026-12-05'], ['2026-12-28', '2027-01-05']]);
    expect(after.schedule.map(item => [item.billingDateISO, item.dueDateISO])).toEqual([['2026-10-26', '2026-11-04'], ['2026-11-28', '2026-12-05'], ['2026-12-28', '2027-01-05']]);
    // Rows of another card are ignored.
    expect(newInstallmentPlan({ id: 'other', card, cardAccount: account, merchant: 'Electro', category: 'Hogar', purchaseDateISO: '2026-10-10', principalMinor: 3000, count: 3,
      placement: 'current', createdAt: now, cycleDates: exact.map(item => ({ ...item, cardId: 'someone-else' })) }).schedule).toEqual(before.schedule);
  });

  it('a purchase on the exact closing belongs to it; the day after belongs to the next one; "next" skips one statement', () => {
    expect(installmentSchedule(card, '2026-10-26', 'current', 100, 1, undefined, exact)[0].billingDateISO).toBe('2026-10-26');
    expect(installmentSchedule(card, '2026-10-27', 'current', 100, 1, undefined, exact)[0].billingDateISO).toBe('2026-11-28');
    expect(installmentSchedule(card, '2026-10-10', 'next', 100, 1, undefined, exact)[0].billingDateISO).toBe('2026-11-28');
    expect(installmentSchedule(card, '2026-09-20', 'current', 200, 2, undefined, exact).map(item => item.billingDateISO)).toEqual(['2026-09-28', '2026-10-26']);
  });

  it('the open-cycle activity starts the day after the exact previous closing', () => {
    const entries: Entry[] = [
      { id: 'a', accountId: account.id, kind: 'expense', amountMinor: 100, merchant: 'A', category: 'Hogar', dateISO: '2026-10-27', createdAt: now },
      { id: 'b', accountId: account.id, kind: 'expense', amountMinor: 200, merchant: 'B', category: 'Hogar', dateISO: '2026-10-26', createdAt: now },
    ];
    const activity = cardStatementActivity(card, { accounts: [account], entries, transfers: [] }, '2026-10-28', exact);
    expect(activity).toMatchObject({ startISO: '2026-10-27', closingISO: '2026-11-28', purchasesMinor: 100, purchaseCount: 1 });
  });
});

describe('validation', () => {
  const cards = [{ id: 'card' }];

  it('accepts a chain and refuses repeated sequences, unordered closings, a due on or before its closing, an unknown card and bad versions', () => {
    expect(() => validateCardCycleDates([row(0, '2026-09-28', '2026-10-05'), row(1, '2026-10-26', '2026-11-04')], cards)).not.toThrow();
    expect(() => validateCardCycleDates([row(0, '2026-09-28', '2026-10-05'), row(0, '2026-10-26', '2026-11-04')], cards)).toThrow('repite');
    expect(() => validateCardCycleDates([row(0, '2026-10-26', '2026-11-04'), row(1, '2026-09-28', '2026-10-05')], cards)).toThrow(CYCLE_INVALID_MESSAGE);
    expect(() => validateCardCycleDates([row(0, '2026-10-26', '2026-10-26')], cards)).toThrow(CYCLE_DUE_ORDER_MESSAGE);
    expect(() => validateCardCycleDates([{ ...row(0, '2026-10-26', '2026-11-04'), cardId: 'ghost' }], cards)).toThrow(CYCLE_INVALID_MESSAGE);
    expect(() => validateCardCycleDates([{ ...row(0, '2026-10-26', '2026-11-04'), sequence: 1.5 }], cards)).toThrow(CYCLE_INVALID_MESSAGE);
    expect(() => validateCardCycleDates([{ ...row(0, '2026-10-26', '2026-11-04'), updatedAt: later }], cards)).toThrow(CYCLE_INVALID_MESSAGE);
    expect(() => validateCardCycleDates([{ ...row(0, '2026-02-30', '2026-11-04') }], cards)).toThrow('Fecha de cierre inválida.');
  });

  it('property: around any exact date, statements stay strictly ordered, each due after its closing, one per cycle', () => {
    const anchors = ['2026-01-31', '2026-02-27', '2026-03-01', '2026-06-15', '2026-12-31', '2028-02-29'];
    for (let closingDay = 1; closingDay <= 31; closingDay += 3) {
      for (let dueDay = 1; dueDay <= 31; dueDay += 5) {
        for (const anchor of anchors) {
          for (const shift of [-9, -3, 0, 4, 10]) {
            const base = statementClosingOnOrAfter(anchor, closingDay);
            const exactClosing = addDaysISO(base, shift);
            const rows = [row(0, exactClosing, addDaysISO(exactClosing, 7), now, days(closingDay, dueDay), base.slice(0, 7))];
            const list = cardStatementsFrom(days(closingDay, dueDay), rows, addDaysISO(exactClosing, -80), 0, 7);
            for (let index = 0; index < list.length; index++) {
              expect(list[index].dueISO > list[index].closingISO).toBe(true);
              if (index) {
                const gap = daysBetweenISO(list[index - 1].closingISO, list[index].closingISO);
                expect(gap).toBeGreaterThanOrEqual(12);
                expect(gap).toBeLessThanOrEqual(50);
              }
            }
            expect(list.filter(item => item.exact).map(item => item.closingISO)).toEqual([exactClosing]);
            expect(cardStatementOnOrAfter(days(closingDay, dueDay), rows, exactClosing).closingISO).toBe(exactClosing);
          }
        }
      }
    }
  });
});
