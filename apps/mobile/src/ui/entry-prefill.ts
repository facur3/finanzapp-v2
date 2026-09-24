import { isStorableCurrency } from '@finanzapp/domain';
import { draftFromMinor } from './money-input.ts';

/** Seed values for a new posting (an Assistant draft handed to the form). `amountMinor` is integer minor units of
 * `currency` (digits only, the 24B2 hand-off); `amount` is the older draft string (two decimals), still read for old links. */
export type EntryPrefill = { amountMinor?: string; currency?: string; amount?: string; merchant?: string; category?: string; dateISO?: string };

/** The draft a prefill seeds the field with: minor units written in their currency's own decimals, never reinterpreted. */
export function prefillDraft(prefill: EntryPrefill | undefined): string {
  if (!prefill) return '';
  if (prefill.amountMinor !== undefined && /^\d{1,15}$/.test(prefill.amountMinor) && isStorableCurrency(prefill.currency)) {
    return draftFromMinor(Number(prefill.amountMinor), prefill.currency);
  }
  return prefill.amount ?? '';
}

