import { draftFitsCurrency, interestFromTotalFinanced, minorFromLedgerDraft, newInstallmentPlan, type Account, type CardCycleDates, type CardStatement,
  type CreditCardProfile, type Currency, type InstallmentPlan, type StatementPlacement } from '@finanzapp/domain';
import { INSTALLMENT_COUNT_CHOICES, parseInstallmentCount, placementOptions, purchasePreview, type PurchasePreview } from './installment-presentation.ts';
import type { MessageKey } from '../i18n/messages.ts';

/** Producto 24T2: the «Pago» section of a new card purchase as data, so the form, the section and the tests read one
 * derivation. «Una vez» is today's purchase (one expense). «En cuotas» is one `InstallmentPlan` and no expense: the plan
 * is built by `buildPurchasePlan` from exactly the schedule `purchaseState` previews. Pure: no React, so Node tests load
 * it directly (`.ts` import extensions). Words are the section's; this module names states and catalogue keys. */

export type PurchaseMode = 'once' | 'installments';
/** A count as the segmented control holds it: one of `QUICK_COUNTS` written as text, or «Otra» (a typed count). */
export type CountChoice = `${number}` | 'other';

/** The counts offered as one tap, before «Otra»: the first four of `INSTALLMENT_COUNT_CHOICES`. A compact segment is at
 * least 64 pt wide, so five segments are the most that fit the content width of the narrowest iPhone (375 − 40 = 335 pt;
 * six need 398 pt and would overflow every iPhone under 440 pt); 24 and every other count from 2 to 120 are typed. */
export const QUICK_COUNTS: readonly number[] = INSTALLMENT_COUNT_CHOICES.slice(0, 4);
/** «El caso normal es 12 cuotas» (docs/mobile-design.md, 24T1C): the count a new plan starts on, shown in the
 * per-instalment line and on the Save button before anything is saved. */
export const DEFAULT_COUNT: CountChoice = '12';

/** What the person chose in the section. Kept by the form while the section is hidden (another account, Ingreso), so
 * coming back finds the same choices; saved only through `buildPurchasePlan`. */
export interface PurchaseDraft {
  mode: PurchaseMode;
  count: CountChoice;
  /** The «Cantidad de cuotas» field, read only while `count` is «Otra». */
  typedCount: string;
  /** Whether the first instalment goes to the statement the purchase belongs to or to the next one. */
  placement: StatementPlacement;
  /** «Con interés»: off is «Sin interés» (no financing field at all). */
  financed: boolean;
  /** The «Total financiado» draft, in the ledger's notation (AmountField), in the card's currency. */
  totalFinanced: string;
}
export const INITIAL_PURCHASE: PurchaseDraft = { mode: 'once', count: DEFAULT_COUNT, typedCount: '', placement: 'current', financed: false, totalFinanced: '' };

export interface PurchaseState {
  /** The count to save, or null while «Otra» holds no count from 2 to 120. */
  count: number | null;
  /** Why the typed count is refused (null while it is empty or valid). */
  countError: MessageKey | null;
  /** The two statements the first instalment may go to (the purchase's own and the next), from the card's calendar. */
  options: Record<StatementPlacement, CardStatement> | null;
  /** The chosen one. */
  first: CardStatement | null;
  /** The total financed in minor units, while «Con interés» is on and its draft reads. */
  totalMinor: number | null;
  /** Total financed minus price: 0 without financing or when the total equals the price (never an invented charge);
   * null while «Con interés» is on and the total or the price is still missing. */
  interestMinor: number | null;
  /** A catalogue key or a domain sentence about the total (below the price, unreadable), shown under its field. */
  totalError: string | null;
  /** Exactly the schedule the plan will be written with, once the price, the count and the financing are known. */
  preview: PurchasePreview | null;
  /** A price too small for the count (an instalment would be empty): the domain's catalogued sentence, shown by the count. */
  scheduleError: MessageKey | null;
  /** Instalments whose statement already closed (a purchase recorded late): they are recognised when the plan is saved. */
  closedCount: number;
  /** The preview is known: the price, the count and the financing all read. */
  ready: boolean;
  /** Save waits for the section: no count yet, a financing total missing or refused, or an empty instalment; each one is
   * an empty field or says why. Anything else (a zero price, an unreadable amount) is refused by Save with its sentence,
   * as for a purchase paid once. */
  blocked: boolean;
}

export interface PurchaseInput {
  draft: PurchaseDraft;
  card: Pick<CreditCardProfile, 'id' | 'closingDay' | 'dueDay'>;
  /** The card's currency (its hidden account's): the plan's and the total financed's. */
  currency: Currency;
  cycleDates: readonly CardCycleDates[];
  purchaseDateISO: string;
  /** The price read from the amount field, or null while it does not read. */
  principalMinor: number | null;
  todayISO: string;
}

export function purchaseState(input: PurchaseInput): PurchaseState {
  const { draft, currency } = input;
  const typed = draft.count === 'other';
  const count = typed ? parseInstallmentCount(draft.typedCount) : Number(draft.count);
  const countError: MessageKey | null = typed && draft.typedCount.trim() !== '' && count === null ? 'entryForm.plan.countInvalid' : null;
  const options = placementOptions(input.card, input.cycleDates, input.purchaseDateISO);
  const price = input.principalMinor !== null && input.principalMinor > 0 ? input.principalMinor : null;
  let totalMinor: number | null = null, interestMinor: number | null = draft.financed ? null : 0, totalError: string | null = null;
  // A draft the card's currency cannot hold exactly (kept across a card change) says why under the field itself.
  if (draft.financed && draft.totalFinanced.trim() && draftFitsCurrency(draft.totalFinanced, currency).ok) {
    try {
      totalMinor = minorFromLedgerDraft(draft.totalFinanced, currency);
      if (price !== null) {
        if (totalMinor < price) totalError = 'errors.installments.totalBelowPrice';
        else interestMinor = interestFromTotalFinanced(price, totalMinor);
      }
    } catch (cause) {
      totalMinor = null;
      totalError = cause instanceof Error ? cause.message : 'errors.installments.financing';
    }
  }
  const preview = count !== null && price !== null && interestMinor !== null && !totalError
    ? purchasePreview({ card: input.card, cycleDates: input.cycleDates, purchaseDateISO: input.purchaseDateISO, placement: draft.placement,
      principalMinor: price, count, interestMinor, todayISO: input.todayISO }) : null;
  // Every instalment carries at least one minor unit of the price (distributeMinor): 0,05 in 12 cannot be split.
  const scheduleError: MessageKey | null = count !== null && price !== null && price < count ? 'errors.installments.tooSmall' : null;
  return {
    count, countError, options, first: options ? options[draft.placement] : null, totalMinor, interestMinor, totalError, preview, scheduleError,
    closedCount: preview ? preview.schedule.filter(row => input.todayISO >= row.billingDateISO).length : 0,
    ready: preview !== null,
    blocked: count === null || scheduleError !== null || (draft.financed && (totalMinor === null || totalError !== null)),
  };
}

/** The plan a «Guardar en cuotas» writes: built once per submission (the form freezes it, so a retry resends the same
 * object and storage treats a committed one as done), from the same inputs the preview used. Errors are catalogue keys or
 * domain sentences, thrown before anything is sent. The interest, when there is any, is its own expense in the Intereses
 * category's stored spelling (`interestCategory`, never a translated label); fee and tax stay zero from this flow. */
export function buildPurchasePlan(input: PurchaseInput & {
  id: string; createdAt: string; card: CreditCardProfile; cardAccount: Account; merchant: string; category: string; interestCategory: string;
}): InstallmentPlan {
  const state = purchaseState(input);
  if (state.count === null) throw new Error('entryForm.plan.countInvalid');
  if (input.principalMinor === null || input.principalMinor <= 0) throw new Error('errors.installments.principal');
  if (input.draft.financed) {
    if (state.totalError) throw new Error(state.totalError);
    if (state.interestMinor === null) throw new Error('entryForm.plan.totalMissing');
  }
  if (state.scheduleError) throw new Error(state.scheduleError);
  const interestMinor = state.interestMinor ?? 0;
  return newInstallmentPlan({
    id: input.id, card: input.card, cardAccount: input.cardAccount, merchant: input.merchant, category: input.category,
    purchaseDateISO: input.purchaseDateISO, principalMinor: input.principalMinor, count: state.count, placement: input.draft.placement,
    interestMinor, interestCategory: interestMinor > 0 ? input.interestCategory : '', createdAt: input.createdAt, cycleDates: input.cycleDates,
  });
}
