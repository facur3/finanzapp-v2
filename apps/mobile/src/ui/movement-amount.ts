/** How a typed movement's amount is SHOWN (Producto 24UX6C). Pure, so Node tests read it.
 *
 * Ledger sign and presentation sign are two different things. The ledger stores every expense, income and transfer as
 * a positive magnitude in integer minor units plus its kind (`Entry.kind`, a `Transfer` between two accounts); what a
 * movement does to a balance comes from that kind, never from a stored sign. Nothing here changes a stored amount.
 *
 * On a row (or a detail) whose kind is already known, the kind is said by the row itself (its glyph, its caption and,
 * for VoiceOver, the words «gasto», «ingreso», «transferencia»), so the amount does not repeat it as a sign:
 *   - expense: the amount as stored, no sign, in ink: an outflow is the normal case of a spending app, never an alarm;
 *   - income: a leading «+» in the income tone;
 *   - transfer: the amount as stored, no sign, in the transfer tone: money moved between the person's own accounts.
 *
 * A sign that carries a computed meaning keeps it wherever it is shown: a negative balance, a net flow, a day's net, a
 * delta between periods, a debt or card balance. Those are not typed movements and never go through this function. No
 * absolute value is taken here: a stored magnitude is shown as stored. */
export type MovementKind = 'expense' | 'income' | 'transfer';

export type PresentedAmount = {
  /** The minor units to show: the stored magnitude, untouched. */
  minor: number;
  /** Whether `Money` draws an explicit sign (only «+» for income). */
  signed: boolean;
  /** The `Money` tone: expense is ink, income the income green, transfer the transfer tone. */
  tone: MovementKind;
};

export function presentedAmount(kind: MovementKind, storedMinor: number): PresentedAmount {
  return { minor: storedMinor, signed: kind === 'income', tone: kind };
}
