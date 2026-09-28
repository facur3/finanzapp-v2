import { validDateISO } from './ledger.ts';

/** Producto 24T2: the statement calendar of a credit card, date-only (no time, no zone).
 *
 * A **statement** (resumen) is one closing date and the due date of *that* closing, always together: `due > closing`
 * holds inside one statement and never between two (with closing day 28 and due day 5, on 2026-10-01 the next due date,
 * 2026-10-05, belongs to the statement that closed on 2026-09-28, while the next closing is 2026-10-28, due 2026-11-05).
 *
 * The card keeps its **usual days** (`closingDay`, `dueDay` on the profile): the grid statement of a month closes on the
 * closing day of that month (31 → the month's last day) and is due on the first due day after the closing. That grid is
 * exactly 24T1's calendar. A card may also hold **exact cycle dates** (`CardCycleDates`, schema 13): stored statements,
 * each a closing and its due, entered by the person or frozen by FinanzApp before a calendar change. Per card they form
 * one chain of consecutive statements ordered by `sequence`; after the last, statements are generated from the card's
 * usual days, and before the first from the days that were in effect when the chain began (the first row records them:
 * the history before a change of days keeps the calendar it had), each anchored on the neighbouring row (the grid
 * closing nearest to one month after / before it), so an exact date never leaves a duplicated or a missing statement. Weekend or holiday shifts are never simulated:
 * a statement moves only because the person entered its date.
 *
 * Nothing here rewrites history: a plan's schedule is written once (24T1), movements keep their dates, and the planner
 * below freezes every statement that already closed before it applies a change. */

export interface CardCycleDays { closingDay: number; dueDay: number }

/** One statement. `exact` when a stored row defines it; otherwise it is estimated from the usual days. */
export interface CardStatement { closingISO: string; dueISO: string; exact: boolean }

/** A stored statement of one card: its exact closing and the due date of that closing. */
export interface CardCycleDates {
  cardId: string;
  /** Order of the statement in the card's chain: a row and the row with the next sequence are consecutive statements.
   * Rows are appended after the last one (and, only for a chain that began after its previous statement, before the first). */
  sequence: number;
  closingISO: string;
  dueISO: string;
  /** The usual days of the calendar this statement belongs to: the card's days when FinanzApp froze it, or when the
   * person entered it. The first row's days generate the statements before the chain, so history keeps its calendar. */
  closingDay: number;
  dueDay: number;
  createdAt: string;
  revision: number;
  updatedAt: string;
}
export const CARD_CYCLE_DATE_KEYS = ['cardId', 'sequence', 'closingISO', 'dueISO', 'closingDay', 'dueDay', 'createdAt', 'revision', 'updatedAt'] as const;
export const MAX_CARD_CYCLE_SEQUENCE = 100000;

export const CYCLE_CLOSING_MESSAGE = 'Fecha de cierre inválida.';
export const CYCLE_DUE_MESSAGE = 'Fecha de vencimiento inválida.';
export const CYCLE_DUE_ORDER_MESSAGE = 'El vencimiento de un resumen tiene que ser posterior a su cierre.';
export const CYCLE_CLOSING_ORDER_MESSAGE = 'El próximo cierre tiene que ser posterior al cierre anterior.';
export const CYCLE_STALE_MESSAGE = 'Las fechas del ciclo cambiaron desde que abriste la tarjeta. Volvé a revisarlas.';
export const CYCLE_HISTORY_MESSAGE = 'Un resumen que ya cerró conserva sus fechas. No se modificó nada.';
export const CYCLE_INVALID_MESSAGE = 'Las fechas del ciclo de la tarjeta no son válidas.';
export const CYCLE_NEXT_CLOSING_MESSAGE = 'El próximo cierre tiene que ser hoy o una fecha posterior.';

// ---- date arithmetic, UTC day numbers (a date is a calendar day, never an instant) ---------------------------------

function parts(dateISO: string): [number, number, number] {
  const [year, month, day] = dateISO.split('-').map(Number);
  return [year, month - 1, day];
}
function dayNumber(dateISO: string): number {
  const [year, monthIndex, day] = parts(dateISO);
  return Math.round(Date.UTC(year, monthIndex, day) / 86400000);
}
function fromDayNumber(value: number): string {
  const date = new Date(value * 86400000);
  return isoOf(date.getUTCFullYear() * 12 + date.getUTCMonth(), date.getUTCDate());
}
export function addDaysISO(dateISO: string, days: number): string {
  return fromDayNumber(dayNumber(dateISO) + days);
}
/** Whole days from `fromISO` to `toISO` (negative when `toISO` is earlier). */
export function daysBetweenISO(fromISO: string, toISO: string): number {
  return dayNumber(toISO) - dayNumber(fromISO);
}
/** A month as one integer (year × 12 + zero-based month), so month arithmetic never loops over dates. */
function monthIndexOf(dateISO: string): number {
  const [year, monthIndex] = parts(dateISO);
  return year * 12 + monthIndex;
}
function daysIn(month: number): number {
  const year = Math.floor(month / 12), monthIndex = month - year * 12;
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}
function isoOf(month: number, day: number): string {
  const year = Math.floor(month / 12), monthIndex = month - year * 12;
  return [String(year).padStart(4, '0'), String(monthIndex + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}
function clamped(month: number, day: number): string {
  return isoOf(month, Math.min(day, daysIn(month)));
}
function validDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}
/** The same day `months` months later (or earlier), clamped to a shorter month: 01-31 + 1 → 02-28. */
function addMonthsClamped(dateISO: string, months: number): string {
  return clamped(monthIndexOf(dateISO) + months, parts(dateISO)[2]);
}

// ---- the grid of the usual days (24T1's calendar, moved here unchanged) --------------------------------------------

/** The first statement closing on or after `dateISO` for a card closing on `closingDay` (a purchase on the closing day
 * itself belongs to that statement). Day 31 lands on the month's last day; the requested day is kept for the next months. */
export function statementClosingOnOrAfter(dateISO: string, closingDay: number): string {
  if (!validDateISO(dateISO) || !validDay(closingDay)) throw new Error(CYCLE_CLOSING_MESSAGE);
  const month = monthIndexOf(dateISO);
  const candidate = clamped(month, closingDay);
  return candidate >= dateISO ? candidate : clamped(month + 1, closingDay);
}

/** The closing `months` statements after `closingISO`, on the card's closing day: the anchor is the configured day, so
 * a January 31 closing gives February 28 (29 in a leap year) and March 31, never a drift to the 28th for good. */
export function statementClosingAfter(closingISO: string, closingDay: number, months: number): string {
  if (!validDateISO(closingISO) || !validDay(closingDay) || !Number.isInteger(months) || months < 0) throw new Error(CYCLE_CLOSING_MESSAGE);
  return clamped(monthIndexOf(closingISO) + months, closingDay);
}

/** The due date of a statement: the card's due day after the closing (the day after the closing at the earliest, so a
 * due day before the closing day falls in the following month). Contractual; weekend or holiday shifts the issuer may
 * apply are not known here and are never simulated. */
export function statementDueDate(closingISO: string, dueDay: number): string {
  if (!validDateISO(closingISO) || !validDay(dueDay)) throw new Error(CYCLE_DUE_MESSAGE);
  return statementClosingOnOrAfter(addDaysISO(closingISO, 1), dueDay);
}

function assertDays(days: CardCycleDays): void {
  if (!validDay(days.closingDay)) throw new Error(CYCLE_CLOSING_MESSAGE);
  if (!validDay(days.dueDay)) throw new Error(CYCLE_DUE_MESSAGE);
}
function gridStatement(days: CardCycleDays, month: number): CardStatement {
  const closingISO = clamped(month, days.closingDay);
  return { closingISO, dueISO: statementDueDate(closingISO, days.dueDay), exact: false };
}
/** The month whose grid closing is nearest to `dateISO` (a tie goes to the earlier month). */
function nearestGridMonth(dateISO: string, closingDay: number): number {
  const month = monthIndexOf(dateISO), target = dayNumber(dateISO);
  let best = month - 1, distance = Infinity;
  for (const candidate of [month - 1, month, month + 1]) {
    const gap = Math.abs(dayNumber(clamped(candidate, closingDay)) - target);
    if (gap < distance) { best = candidate; distance = gap; }
  }
  return best;
}
/** The first grid month whose closing is on or after `dateISO`. */
function gridMonthOnOrAfter(dateISO: string, closingDay: number): number {
  const month = monthIndexOf(dateISO);
  return clamped(month, closingDay) >= dateISO ? month : month + 1;
}

// ---- the effective calendar -------------------------------------------------------------------------------------

/** The rows of one card, in chain order. */
export function cardCycleDatesOf(cardId: string, rows: readonly CardCycleDates[] = []): CardCycleDates[] {
  return rows.filter(row => row.cardId === cardId).sort((a, b) => a.sequence - b.sequence);
}

/** A position in the card's sequence of statements: the month itself without rows; with rows, 0..k-1 are the rows,
 * k.. the statements generated after the last row (the card's days) and ..-1 the ones generated before the first (the
 * first row's days). */
interface Calendar { days: CardCycleDays; beforeDays: CardCycleDays; rows: readonly CardCycleDates[]; after: number; before: number }

function calendarOf(days: CardCycleDays, rows: readonly CardCycleDates[]): Calendar {
  assertDays(days);
  const chain = [...rows].sort((a, b) => a.sequence - b.sequence);
  if (!chain.length) return { days, beforeDays: days, rows: chain, after: 0, before: 0 };
  const beforeDays = { closingDay: chain[0].closingDay, dueDay: chain[0].dueDay };
  assertDays(beforeDays);
  return { days, beforeDays, rows: chain,
    after: nearestGridMonth(addMonthsClamped(chain[chain.length - 1].closingISO, 1), days.closingDay),
    before: nearestGridMonth(addMonthsClamped(chain[0].closingISO, -1), beforeDays.closingDay) };
}
function statementAt(calendar: Calendar, position: number): CardStatement {
  const { rows, days } = calendar;
  if (!rows.length) return gridStatement(days, position);
  if (position >= 0 && position < rows.length) return { closingISO: rows[position].closingISO, dueISO: rows[position].dueISO, exact: true };
  return position >= rows.length ? gridStatement(days, calendar.after + position - rows.length) : gridStatement(calendar.beforeDays, calendar.before + position + 1);
}
function positionOnOrAfter(calendar: Calendar, dateISO: string): number {
  const { rows, days } = calendar;
  if (!rows.length) return gridMonthOnOrAfter(dateISO, days.closingDay);
  if (dateISO <= rows[0].closingISO) {
    const grid = gridMonthOnOrAfter(dateISO, calendar.beforeDays.closingDay);
    return grid <= calendar.before ? grid - calendar.before - 1 : 0;
  }
  if (dateISO > rows[rows.length - 1].closingISO) return rows.length + Math.max(gridMonthOnOrAfter(dateISO, days.closingDay), calendar.after) - calendar.after;
  return rows.findIndex(row => row.closingISO >= dateISO);
}
/** The days of the calendar that generates the statement at `position`. */
function daysAt(calendar: Calendar, position: number): CardCycleDays {
  return position < 0 && calendar.rows.length ? calendar.beforeDays : calendar.days;
}
function assertDate(dateISO: string): void {
  if (!validDateISO(dateISO)) throw new Error('Elegí una fecha válida.');
}

/** The statement a purchase dated `dateISO` belongs to: the first whose closing is on or after it. */
export function cardStatementOnOrAfter(days: CardCycleDays, chain: readonly CardCycleDates[], dateISO: string): CardStatement {
  assertDate(dateISO);
  const calendar = calendarOf(days, chain);
  return statementAt(calendar, positionOnOrAfter(calendar, dateISO));
}

/** `count` consecutive statements, starting `offset` statements after the one `dateISO` belongs to. */
export function cardStatementsFrom(days: CardCycleDays, chain: readonly CardCycleDates[], dateISO: string, offset: number, count: number): CardStatement[] {
  assertDate(dateISO);
  const calendar = calendarOf(days, chain);
  const first = positionOnOrAfter(calendar, dateISO) + offset;
  return Array.from({ length: count }, (_, index) => statementAt(calendar, first + index));
}

/** What a card's calendar says on `todayISO`. */
export interface CardCycleView {
  /** The open statement: the first whose closing is today or later (on its closing day it is still open). */
  open: CardStatement;
  /** The first day of the open statement: the day after the previous closing. */
  openStartISO: string;
  /** The statement that closed last, before today. */
  previous: CardStatement;
  /** The closed statement whose due date is still ahead (today or later), the earliest such; null when none is. */
  toPay: CardStatement | null;
  /** The next due date (today or later) and the statement it belongs to: `toPay` when it comes first, else `open`. */
  nextDue: CardStatement;
}

export function cardCycleView(days: CardCycleDays, chain: readonly CardCycleDates[], todayISO: string): CardCycleView {
  assertDate(todayISO);
  const calendar = calendarOf(days, chain);
  const position = positionOnOrAfter(calendar, todayISO);
  const open = statementAt(calendar, position), previous = statementAt(calendar, position - 1);
  // A generated statement is due at most 31 days after its closing, so only the last few closed ones can still be due;
  // a stored row may carry any due date after its closing, so every closed row is a candidate.
  const candidates = [previous, statementAt(calendar, position - 2), statementAt(calendar, position - 3),
    ...chain.filter(row => row.closingISO < todayISO).map(row => ({ closingISO: row.closingISO, dueISO: row.dueISO, exact: true }))];
  let toPay: CardStatement | null = null;
  for (const statement of candidates) {
    if (statement.dueISO < todayISO) continue;
    if (!toPay || statement.dueISO < toPay.dueISO || (statement.dueISO === toPay.dueISO && statement.closingISO < toPay.closingISO)) toPay = statement;
  }
  return { open, openStartISO: addDaysISO(previous.closingISO, 1), previous, toPay, nextDue: toPay && toPay.dueISO <= open.dueISO ? toPay : open };
}

// ---- validation -----------------------------------------------------------------------------------------------------

function validTimestamp(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** Read acceptance of one row: an existing card, a sequence, two valid dates with the due after the closing, a version. */
export function validateCardCycleDate(row: CardCycleDates, cardIds: ReadonlySet<string>): void {
  if (!row || typeof row !== 'object' || typeof row.cardId !== 'string' || !cardIds.has(row.cardId)) throw new Error(CYCLE_INVALID_MESSAGE);
  if (!Number.isSafeInteger(row.sequence) || Math.abs(row.sequence) > MAX_CARD_CYCLE_SEQUENCE) throw new Error(CYCLE_INVALID_MESSAGE);
  if (!validDay(row.closingDay) || !validDay(row.dueDay)) throw new Error(CYCLE_INVALID_MESSAGE);
  if (typeof row.closingISO !== 'string' || !validDateISO(row.closingISO)) throw new Error(CYCLE_CLOSING_MESSAGE);
  if (typeof row.dueISO !== 'string' || !validDateISO(row.dueISO)) throw new Error(CYCLE_DUE_MESSAGE);
  if (row.dueISO <= row.closingISO) throw new Error(CYCLE_DUE_ORDER_MESSAGE);
  if (!validTimestamp(row.createdAt) || !validTimestamp(row.updatedAt) || !Number.isSafeInteger(row.revision) || row.revision < 0
    || (row.revision === 0 && row.createdAt !== row.updatedAt)) throw new Error(CYCLE_INVALID_MESSAGE);
}

/** The whole collection: each row valid, one row per (card, sequence), and per card the closings strictly increasing in
 * chain order (consecutive statements never overlap). */
export function validateCardCycleDates(rows: readonly CardCycleDates[], cards: readonly { id: string }[]): void {
  const cardIds = new Set(cards.map(card => card.id));
  const seen = new Set<string>();
  for (const row of rows) {
    validateCardCycleDate(row, cardIds);
    const key = row.cardId + '|' + row.sequence;
    if (seen.has(key)) throw new Error('La copia repite una fecha del ciclo de una tarjeta.');
    seen.add(key);
  }
  for (const cardId of cardIds) {
    const chain = cardCycleDatesOf(cardId, rows);
    for (let index = 1; index < chain.length; index++) {
      if (chain[index].closingISO <= chain[index - 1].closingISO) throw new Error(CYCLE_INVALID_MESSAGE);
    }
  }
}

export function sameCardCycleDate(a: CardCycleDates, b: CardCycleDates): boolean {
  return CARD_CYCLE_DATE_KEYS.every(key => a[key] === b[key]);
}

// ---- writes: the planner ------------------------------------------------------------------------------------------

/** What the card form asks for. Each part names the statement the form showed, so a form left open past a closing is
 * refused (`CYCLE_STALE_MESSAGE`) instead of moving another statement. */
export interface CardCycleIntent {
  /** New usual days (the months after the exact dates follow them). */
  days?: CardCycleDays;
  /** The exact dates of the open statement. `statementClosingISO` is the open closing the form showed. */
  open?: { statementClosingISO: string; closingISO: string; dueISO: string };
  /** A corrected due date for the closed statement still to pay; its closing never moves. */
  toPay?: { statementClosingISO: string; dueISO: string };
}
/** The card's usual days and its whole chain after the change (this card's rows only: the caller replaces them). */
export interface CardCyclePlan { days: CardCycleDays; rows: CardCycleDates[]; changed: boolean }

function sameDays(a: CardCycleDays, b: CardCycleDays): boolean {
  return a.closingDay === b.closingDay && a.dueDay === b.dueDay;
}
function assertPair(closingISO: string, dueISO: string): void {
  if (typeof closingISO !== 'string' || !validDateISO(closingISO)) throw new Error(CYCLE_CLOSING_MESSAGE);
  if (typeof dueISO !== 'string' || !validDateISO(dueISO)) throw new Error(CYCLE_DUE_MESSAGE);
  if (dueISO <= closingISO) throw new Error(CYCLE_DUE_ORDER_MESSAGE);
}

/** The card's next calendar for an intent, as of `todayISO`. Deterministic and pure: the form calls it to preview and
 * validate, storage calls it again inside its transaction. Steps: (1) nothing changes → the same rows; (2) every
 * statement from the end of the chain (or from the previous statement, without rows) through the previous statement is
 * frozen as a row at its current dates, so a closed statement never moves; (3) the statement to pay takes its new due;
 * (4) the open statement takes its exact dates (a row only when the calendar would not produce them anyway; a closing
 * before today is accepted: the issuer closed earlier than expected, and the statement is then closed); (5) the usual
 * days change. Rows are never removed or renumbered. */
export function planCardCycle(input: { cardId: string; days: CardCycleDays; rows: readonly CardCycleDates[]; todayISO: string; nowISO: string; intent: CardCycleIntent }): CardCyclePlan {
  const { cardId, todayISO, nowISO, intent } = input;
  if (!validTimestamp(nowISO)) throw new Error('Fecha de actualización inválida.');
  const chain = cardCycleDatesOf(cardId, input.rows);
  const view = cardCycleView(input.days, chain, todayISO);
  const days = intent.days ?? input.days;
  assertDays(days);
  if (intent.open && intent.open.statementClosingISO !== view.open.closingISO) throw new Error(CYCLE_STALE_MESSAGE);
  if (intent.toPay && (!view.toPay || intent.toPay.statementClosingISO !== view.toPay.closingISO)) throw new Error(CYCLE_STALE_MESSAGE);
  if (intent.open) assertPair(intent.open.closingISO, intent.open.dueISO);
  if (intent.toPay) assertPair(view.toPay!.closingISO, intent.toPay.dueISO);
  const daysChanged = !sameDays(days, input.days);
  const openChanged = !!intent.open && (intent.open.closingISO !== view.open.closingISO || intent.open.dueISO !== view.open.dueISO);
  const toPayChanged = !!intent.toPay && intent.toPay.dueISO !== view.toPay!.dueISO;
  if (!daysChanged && !openChanged && !toPayChanged) return { days: input.days, rows: chain, changed: false };

  const calendar = calendarOf(input.days, chain);
  const openPosition = positionOnOrAfter(calendar, todayISO), previousPosition = openPosition - 1;
  const toPayPosition = toPayChanged ? positionOnOrAfter(calendar, view.toPay!.closingISO) : previousPosition;
  // (2) Freeze: afterwards the rows cover, consecutively, every statement from the chain's start (or from the oldest one
  // this change touches) through the previous statement. Without rows a position is a month; with rows, 0..k-1 are the rows.
  const byPosition = new Map<number, CardCycleDates>(chain.map((row, index) => [index, { ...row }]));
  const frozen = (position: number, sequence: number): CardCycleDates => {
    const statement = statementAt(calendar, position), generator = daysAt(calendar, position);
    return { cardId, sequence, closingISO: statement.closingISO, dueISO: statement.dueISO, closingDay: generator.closingDay, dueDay: generator.dueDay,
      createdAt: nowISO, revision: 0, updatedAt: nowISO };
  };
  const low = Math.min(previousPosition, toPayPosition);
  if (!chain.length) {
    for (let position = low; position <= previousPosition; position++) byPosition.set(position, frozen(position, position - low));
  } else {
    const first = chain[0].sequence, last = chain[chain.length - 1].sequence;
    for (let position = -1; position >= low; position--) byPosition.set(position, frozen(position, first + position));
    for (let position = chain.length; position <= previousPosition; position++) byPosition.set(position, frozen(position, last + position - chain.length + 1));
  }
  const touch = (row: CardCycleDates, change: Partial<Pick<CardCycleDates, 'closingISO' | 'dueISO'>>) => {
    Object.assign(row, change);
    // A row written by this same change stays a first version; an older row moves one revision on.
    if (row.revision !== 0 || row.createdAt !== nowISO) { row.revision += 1; row.updatedAt = nowISO; }
  };
  // (3) The statement to pay closed before today, so it is a row now.
  if (toPayChanged) touch(byPosition.get(toPayPosition)!, { dueISO: intent.toPay!.dueISO });
  let rows = [...byPosition.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
  // (4) The open statement: its own row when it has one (an existing row, or one frozen before a chain that began later),
  // else a new row after the previous statement, written only when the calendar would not produce these dates anyway.
  if (openChanged) {
    const { closingISO, dueISO } = intent.open!;
    if (closingISO <= view.previous.closingISO) throw new Error(CYCLE_CLOSING_ORDER_MESSAGE);
    const own = byPosition.get(openPosition);
    if (own) touch(own, { closingISO, dueISO });
    else {
      const generated = cardStatementOnOrAfter(days, rows, addDaysISO(view.previous.closingISO, 1));
      if (generated.closingISO !== closingISO || generated.dueISO !== dueISO) {
        const sequence = rows.length ? rows[rows.length - 1].sequence + 1 : 0;
        rows = [...rows, { cardId, sequence, closingISO, dueISO, closingDay: days.closingDay, dueDay: days.dueDay, createdAt: nowISO, revision: 0, updatedAt: nowISO }];
      }
    }
  }
  validateCardCycleDates(rows, [{ id: cardId }]);
  assertCardCycleChange({ days: input.days, rows: chain }, { days, rows }, todayISO);
  return { days, rows, changed: true };
}

/** Whether the calendar already shows what an intent asks (a retry of a change that committed): the open statement's
 * dates as a statement, the statement to pay with its due. Storage uses it when the card profile itself is unchanged,
 * so a calendar change is never reported as saved without being stored. */
export function cardCycleShows(days: CardCycleDays, rows: readonly CardCycleDates[], intent: Omit<CardCycleIntent, 'days'>): boolean {
  const at = (closingISO: string) => cardStatementOnOrAfter(days, rows, closingISO);
  if (intent.open) {
    const statement = at(intent.open.closingISO);
    if (statement.closingISO !== intent.open.closingISO || statement.dueISO !== intent.open.dueISO) return false;
  }
  if (intent.toPay) {
    const statement = at(intent.toPay.statementClosingISO);
    if (statement.closingISO !== intent.toPay.statementClosingISO || statement.dueISO !== intent.toPay.dueISO) return false;
  }
  return true;
}

/** A new card's calendar from the two dates its form asks: the next closing (today or later) and its due date. The usual
 * days are their days. No row when the usual days already produce that statement as the open one; otherwise the chain
 * starts with the statement before it and the entered one, so the entered closing is the next closing. */
export function newCardCycle(input: { cardId: string; closingISO: string; dueISO: string; todayISO: string; nowISO: string }): { days: CardCycleDays; rows: CardCycleDates[] } {
  assertPair(input.closingISO, input.dueISO);
  assertDate(input.todayISO);
  if (input.closingISO < input.todayISO) throw new Error(CYCLE_NEXT_CLOSING_MESSAGE);
  const days = { closingDay: parts(input.closingISO)[2], dueDay: parts(input.dueISO)[2] };
  const view = cardCycleView(days, [], input.todayISO);
  if (view.open.closingISO === input.closingISO && view.open.dueISO === input.dueISO) return { days, rows: [] };
  const plan = planCardCycle({ cardId: input.cardId, days, rows: [], todayISO: input.todayISO, nowISO: input.nowISO,
    intent: { open: { statementClosingISO: view.open.closingISO, closingISO: input.closingISO, dueISO: input.dueISO } } });
  return { days, rows: plan.rows };
}

/** Storage's check of a calendar change on `todayISO` (defence in depth: the planner already guarantees it): no row is
 * removed or renumbered; a row that closed before today keeps its closing, and its due moves only while that due is
 * still ahead (the statement to pay); and every statement from the start of the old chain (or the old previous
 * statement, without rows) through the old previous statement closes on the same date in the new calendar, with the same
 * due unless that due is still ahead. */
export function assertCardCycleChange(before: { days: CardCycleDays; rows: readonly CardCycleDates[] }, after: { days: CardCycleDays; rows: readonly CardCycleDates[] }, todayISO: string): void {
  for (const row of before.rows) {
    const kept = after.rows.find(item => item.cardId === row.cardId && item.sequence === row.sequence);
    if (!kept) throw new Error(CYCLE_HISTORY_MESSAGE);
    if (row.closingISO < todayISO && (kept.closingISO !== row.closingISO || (kept.dueISO !== row.dueISO && row.dueISO < todayISO))) throw new Error(CYCLE_HISTORY_MESSAGE);
  }
  const old = calendarOf(before.days, before.rows);
  const openPosition = positionOnOrAfter(old, todayISO);
  const start = before.rows.length ? Math.min(0, openPosition - 1) : openPosition - 1;
  for (let position = start; position <= openPosition - 1; position++) {
    const statement = statementAt(old, position);
    const now = cardStatementOnOrAfter(after.days, after.rows, statement.closingISO);
    if (now.closingISO !== statement.closingISO || (now.dueISO !== statement.dueISO && statement.dueISO < todayISO)) throw new Error(CYCLE_HISTORY_MESSAGE);
  }
}
