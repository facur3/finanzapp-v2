import { daysBetweenISO, type CardCycleDays, type CardCycleIntent, type CardCycleView } from '@finanzapp/domain';

/** Producto 24T2: the statement dates of the card form as data (card-cycles.ts is the model). A new card asks its next
 * closing and the due date of that closing; an existing card shows its open statement (and the closed one still to pay)
 * and sends only the parts the person changed, naming the statement the form showed, so storage refuses a stale form.
 * Pure: no React, so Node tests load it directly. */

/** A weekend or a holiday moves a closing a few days. An entered closing further than this from the one the calendar
 * expected cannot be a one-off shift: it is a change of the card's calendar, so the entered days become its usual days. */
export const ONE_OFF_SHIFT_DAYS = 15;

export function isCalendarChange(expectedClosingISO: string, closingISO: string): boolean {
  return Math.abs(daysBetweenISO(expectedClosingISO, closingISO)) > ONE_OFF_SHIFT_DAYS;
}

/** The day of the month a date gives as a usual day. The last day of a short month keeps the later usual day it may come
 * from (a card that closes on the 31st closes on September 30), so confirming that date never moves the card to the 30th. */
export function usualDayOf(dateISO: string, previousDay: number): number {
  const [year, month, day] = dateISO.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day === last && previousDay > last ? previousDay : day;
}

/** A new card's usual days: the days of the two dates entered (what `newCardCycle` stores). */
export function daysOfDates(closingISO: string, dueISO: string): CardCycleDays {
  return { closingDay: Number(closingISO.slice(8, 10)), dueDay: Number(dueISO.slice(8, 10)) };
}

/** What the edit form holds: the open statement's dates, the due of the closed statement still to pay (when there is
 * one), and «Usar estos días todos los meses». */
export interface CycleEdit { closingISO: string; dueISO: string; toPayDueISO: string | null; everyMonth: boolean }

export interface CycleEditResult {
  /** The card's usual days after the save: its own, or the entered dates' days when they repeat every month. */
  days: CardCycleDays;
  /** The entered closing is too far from the expected one to be a one-off correction (the switch is on and fixed). */
  forced: boolean;
  /** The entered dates become the usual days (chosen, or forced). */
  repeats: boolean;
  /** Only the parts that changed, each naming the statement the form showed. */
  intent: Omit<CardCycleIntent, 'days'>;
  /** Whether the calendar changes at all (dates or days). */
  changed: boolean;
}

export function cycleEditResult(usual: CardCycleDays, shown: Pick<CardCycleView, 'open' | 'toPay'>, edit: CycleEdit): CycleEditResult {
  const forced = isCalendarChange(shown.open.closingISO, edit.closingISO);
  const repeats = edit.everyMonth || forced;
  const days = repeats ? { closingDay: usualDayOf(edit.closingISO, usual.closingDay), dueDay: usualDayOf(edit.dueISO, usual.dueDay) } : usual;
  const openChanged = edit.closingISO !== shown.open.closingISO || edit.dueISO !== shown.open.dueISO;
  const toPayChanged = !!shown.toPay && edit.toPayDueISO !== null && edit.toPayDueISO !== shown.toPay.dueISO;
  const daysChanged = days.closingDay !== usual.closingDay || days.dueDay !== usual.dueDay;
  const intent: Omit<CardCycleIntent, 'days'> = {
    // New usual days name the open statement too, even with its dates unchanged: they start from the statement the form
    // showed, so a form left open past that closing is refused instead of moving the change one statement later.
    ...(openChanged || daysChanged ? { open: { statementClosingISO: shown.open.closingISO, closingISO: edit.closingISO, dueISO: edit.dueISO } } : {}),
    ...(toPayChanged ? { toPay: { statementClosingISO: shown.toPay!.closingISO, dueISO: edit.toPayDueISO! } } : {}),
  };
  return { days, forced, repeats, intent, changed: openChanged || toPayChanged || daysChanged };
}
