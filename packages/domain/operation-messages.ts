/** Producto 24T3: the Spanish domain messages of purchase operations (devoluciones and adelantos de cuotas), in a leaf
 * module with no imports so `installments.ts`, `operations.ts`, `liabilities.ts` and `recovery.ts` all read them without an
 * import cycle. The mobile errors catalogue maps each one to its English twin.
 *
 * Vocabulary (decision 003, A28): a purchase refund is a **devolución** (never «reembolso», the income preset); an early
 * payoff is an **adelanto de cuotas** (it brings the recognition of the remaining instalments forward; it is never a payment
 * and nothing is ever «pagada»); a stopped plan is **sin seguimiento** («Dejar de seguir el plan»). */

/** What the person (or the app) is doing when an archive guard fires: the same invariant reads differently on an undo, a
 * restore or an import (A22), so a guard never says «no se puede deshacer» on a restore or an import. */
export type OperationContext = 'create' | 'edit' | 'void' | 'restore' | 'import' | 'cancel' | 'reactivate';
/** The archive guards that involve a devolución or an adelanto and name it in their message. */
export type OperationGuard = 'refund-link' | 'refund-cap' | 'refund-credit' | 'refund-recorded' | 'refund-overlap' | 'payoff-overlap' | 'payoff-refund';

// ---- shape and identity --------------------------------------------------------------------------------------------
export const OPERATION_INVALID_MESSAGE = 'Una devolución o un adelanto de cuotas no es válido. No se modificó nada.';
export const OPERATION_TARGET_MESSAGE = 'Una devolución o un adelanto de cuotas no encuentra su compra. No se modificó nada.';
export const OPERATION_ID_MESSAGE = 'Una devolución o un adelanto de cuotas repite un identificador. No se modificó nada.';
/** A12: a retry with the same operation id and other inputs (never a recomputed allocation). */
export const OPERATION_EXISTS_MESSAGE = 'Esta operación ya existe con otros datos. Revisá tus movimientos.';
/** A13: the allocation storage computes after its catch-up differs from the one the form previewed. */
export const OPERATION_CHANGED_MESSAGE = 'Las cuotas cambiaron desde que abriste el formulario; revisá.';
/** A void or a restore that does not match the operation's state (already undone, already restored, stale revision). */
export const OPERATION_STATE_MESSAGE = 'La devolución o el adelanto cambió desde que lo abriste. Volvé a abrirlo.';
/** A20: a backup whose operations contradict this device's instalments (combined validation of an import). */
export const OPERATION_IMPORT_MESSAGE = 'La copia tiene devoluciones o adelantos que no encajan con las cuotas de este dispositivo. No se importó nada.';

// ---- creation (and the creation-only checks of restore, A7) ---------------------------------------------------------
export const REFUND_AMOUNT_MESSAGE = 'Ingresá un monto mayor que cero y con hasta dos decimales.';
export const REFUND_OVER_MESSAGE = 'La devolución supera lo que queda por devolver de esta compra.';
export const REFUND_TARGET_MESSAGE = 'Una devolución se registra sobre un gasto guardado que no sea una cuota.';
export const REFUND_DATE_MESSAGE = 'Elegí una fecha entre la de la compra y hoy.';
/** A6: plan operations are dated between the plan's floor (purchase, last recorded instalment, last adelanto) and today. */
export const PLAN_OPERATION_DATE_MESSAGE = 'Elegí una fecha entre la última cuota registrada del plan y hoy.';
export const OPERATION_ACCOUNT_DELETED_MESSAGE = 'La cuenta de esta compra fue eliminada.';
/** A9: undo and restore never touch the history of a deleted account or card. */
export const OPERATION_HISTORY_DELETED_MESSAGE = 'La tarjeta o la cuenta fue eliminada; su historial no cambia.';
/** A9: a plan without tracking takes no adelanto and no reduction of future instalments, and none is undone or restored. */
export const OPERATION_PLAN_STOPPED_MESSAGE = 'Este plan no se sigue. Reactivalo primero.';
export const PAYOFF_NOTHING_MESSAGE = 'No quedan cuotas por adelantar.';
/** A4(d): an adelanto always brings principal forward; a financing-only one is «Dejar de seguir el plan». */
export const PAYOFF_PRINCIPAL_MESSAGE = 'No queda precio por adelantar. Para dejar de registrar el interés, dejá de seguir el plan.';
export const PAYOFF_FINANCING_MESSAGE = 'Elegí si los intereses y cargos futuros se registran o no se cobran.';
export const PAYOFF_DATE_MESSAGE = 'La fecha del adelanto debe ser anterior al cierre de las cuotas que adelanta.';

// ---- plan lifecycle -------------------------------------------------------------------------------------------------
/** A16: a plan with any operation (undone included) is never deleted. */
export const PLAN_OPERATION_HISTORY_MESSAGE = 'Este plan tiene devoluciones o adelantos registrados. Dejá de seguirlo; no se puede eliminar.';
/** A9: stopping a plan with nothing left to record is refused (it never coexists with an adelanto that covers everything). */
export const PLAN_NOTHING_TO_STOP_MESSAGE = 'Este plan no tiene cuotas por registrar; no hay nada que dejar de seguir.';
export const PLAN_NOT_CANCELLED_MESSAGE = 'Este plan se sigue registrando; no hay nada que reactivar.';

// ---- archive guards, worded by context (A22) --------------------------------------------------------------------------
const GUARD_MESSAGES: Record<OperationGuard, Partial<Record<OperationContext, string>> & { default: string }> = {
  // An ordinary purchase with live devoluciones keeps its account, currency, kind, date and an amount ≥ what was returned.
  'refund-link': {
    default: 'Esta compra tiene devoluciones registradas. Deshacelas primero.',
    restore: 'La compra de esta devolución cambió o se deshizo; no se puede restaurar.',
    create: REFUND_OVER_MESSAGE,
  },
  // Σ live devoluciones of an ordinary purchase ≤ its amount: lowering the purchase below them, or restoring a devolución
  // another one replaced since.
  'refund-cap': {
    default: 'Esta compra tiene devoluciones registradas. Deshacelas primero.',
    restore: 'Otra devolución ya usa lo que queda por devolver de esta compra; no se puede restaurar.',
    create: REFUND_OVER_MESSAGE,
  },
  // Σ credit of a plan's live devoluciones ≤ principal recognised (instalments + adelantos).
  'refund-credit': {
    default: 'Una devolución usa estas cuotas. Deshacé la devolución primero.',
    restore: 'Las cuotas de esta devolución ya no están registradas; no se puede restaurar.',
    create: REFUND_OVER_MESSAGE,
  },
  // A recorded instalment equals its share minus the live reductions on it (voided records included).
  'refund-recorded': {
    default: 'Ya se registraron cuotas que esta devolución redujo; no se puede deshacer.',
    restore: 'Ya se registraron cuotas que esta devolución reduce; no se puede restaurar.',
    create: OPERATION_CHANGED_MESSAGE,
  },
  // Reductions on one instalment never exceed its principal share.
  'refund-overlap': {
    default: 'Otra devolución ya redujo esas cuotas.',
    restore: 'Otra devolución ya redujo esas cuotas; registrá la devolución de nuevo.',
    create: OPERATION_CHANGED_MESSAGE,
  },
  // A4: one live adelanto per share, at the share's current amount, never over a recorded share, dated inside the plan.
  'payoff-overlap': {
    default: 'Un adelanto usa esas cuotas. Deshacé el adelanto primero.',
    restore: 'Algunas cuotas ya se registraron o se adelantaron; registrá un adelanto nuevo.',
    create: OPERATION_CHANGED_MESSAGE,
  },
  // A4(b): a live adelanto covers each share at its amount after the live reductions: undoing a devolución that reduced a
  // share an adelanto covers, or restoring either across the other, would lose or double principal.
  'payoff-refund': {
    default: 'Un adelanto usa esas cuotas. Deshacé el adelanto primero.',
    restore: 'Una devolución y un adelanto usan las mismas cuotas; no se puede restaurar.',
    create: OPERATION_CHANGED_MESSAGE,
  },
};

/** The sentence an archive guard throws in a context. An import always reads as the one import refusal. */
export function operationGuardMessage(guard: OperationGuard, context: OperationContext = 'edit'): string {
  if (context === 'import') return OPERATION_IMPORT_MESSAGE;
  const messages = GUARD_MESSAGES[guard];
  return messages[context] ?? messages.default;
}
/** Every guard sentence, for the errors catalogue and its tests. */
export function operationGuardMessages(): string[] {
  return [...new Set(Object.values(GUARD_MESSAGES).flatMap(messages => Object.values(messages)))];
}
