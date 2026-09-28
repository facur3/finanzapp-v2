/** The first opening (Producto 25B): two stages, when it is shown at all, and what it suggests. Pure:
 * no React, no Expo, so Node tests every rule; `app/onboarding.tsx` draws it.
 *
 * Rules:
 *   - It is shown once, to a **new** installation only: no accounts, and no language, region or
 *     display-currency preference ever chosen. Anyone else (a ledger with accounts, a preference
 *     saved by an earlier build) is an existing person: the flow is marked done silently and
 *     nothing of theirs is read again, written or changed. An unreadable store counts as existing:
 *     never show a setup to someone the app cannot judge. The route checks this itself too, so a
 *     link or a restored navigation into it never reaches an existing person's preferences.
 *   - Two stages: the welcome (language and region detected from the device, a secondary way to
 *     change them through the Más choosers) and an optional first account (name, a currency the
 *     region suggests, an optional opening balance). Omitir skips the **rest** of the setup and
 *     keeps every choice already saved; nothing is ever undone silently.
 *   - The region suggests the first account's currency (its legal tender, when this build offers
 *     it) and the person decides; the account created seeds the display currency of the totals
 *     (docs/currency.md §2.9). Language, region, an account's currency and the display currency
 *     stay four independent preferences. */
import type { PreferenceStore } from '../i18n/preference.ts';
import { DISPLAY_CURRENCY_KEY } from './display-currency.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY } from '../i18n/preference.ts';

/** The region's suggestion lives with the other currency defaults since 25B2 (`currency-defaults.ts`, rule 4). */
export { suggestedCurrency } from './currency-defaults.ts';

export const ONBOARDING_KEY = 'finanzapp.onboarding';
export const ONBOARDING_DONE = 'done';

export type OnboardingStep = 'welcome' | 'account';
export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['welcome', 'account'];

/** The step after `step`, or null at the end. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index >= 0 && index + 1 < ONBOARDING_STEPS.length ? ONBOARDING_STEPS[index + 1] : null;
}
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}

export type OnboardingDecision = 'new' | 'existing' | 'done';

/** Whether this launch shows the first opening. */
export function onboardingDecision(store: () => PreferenceStore, hasAccounts: boolean): OnboardingDecision {
  let stored: string | null, chose: boolean;
  try {
    const kv = store();
    stored = kv.getItemSync(ONBOARDING_KEY);
    chose = [LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY, DISPLAY_CURRENCY_KEY].some(key => kv.getItemSync(key) !== null);
  } catch { return 'existing'; }
  if (stored === ONBOARDING_DONE) return 'done';
  return hasAccounts || chose ? 'existing' : 'new';
}

/** Records that the first opening is over (finished or skipped, or an existing person's silent mark). False when the
 * store could not be written: the app goes on regardless, and the next launch decides again. */
export function markOnboardingDone(store: () => PreferenceStore): boolean {
  try { store().setItemSync(ONBOARDING_KEY, ONBOARDING_DONE); return true; } catch { return false; }
}
