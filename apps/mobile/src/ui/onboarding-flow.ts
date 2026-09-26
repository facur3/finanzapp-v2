/** The first opening (Producto 25B): what it asks, in which order, when it is shown at all, and
 * what it suggests. Pure: no React, no Expo, so Node tests every rule; `app/onboarding.tsx` draws it.
 *
 * Rules:
 *   - It is shown once, to a **new** installation only: no accounts, and no language, region or
 *     display-currency preference ever chosen. Anyone else (a ledger with accounts, a preference
 *     saved by an earlier build) is an existing person: the flow is marked done silently and
 *     nothing of theirs is read again, written or changed. An unreadable store counts as existing:
 *     never show a setup to someone the app cannot judge.
 *   - Every step can be skipped; skipping writes nothing. Continuing a step writes only that
 *     step's choice (the language and region choosers save on a tap, as Más does; the display
 *     currency is saved on Continuar; the first account is the normal form, optional).
 *   - The region suggests a **display** currency (the region's legal tender, when this build
 *     offers it) and the person decides; an account's currency is chosen in its own form and
 *     never follows the region (docs/currency.md §1). */
import { LEDGER_CURRENCIES, type Currency, type CurrencyGate } from '@finanzapp/domain';
import type { PreferenceStore } from '../i18n/preference.ts';
import { DISPLAY_CURRENCY_KEY } from './display-currency.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY } from '../i18n/preference.ts';
import { regionRecord, type CatalogueRegionCode } from '../i18n/regions.ts';
import { currencyChoices } from './currencies.ts';
import type { AppLocale } from '../i18n/locale.ts';
import type { ChoiceOption } from './choice-list.ts';

export const ONBOARDING_KEY = 'finanzapp.onboarding';
export const ONBOARDING_DONE = 'done';

export type OnboardingStep = 'welcome' | 'language' | 'region' | 'currency' | 'account';
export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['welcome', 'language', 'region', 'currency', 'account'];

/** The steps this build asks: the region only when it offers a real choice (`showsPreference`). */
export function onboardingSteps(showsRegion: boolean): OnboardingStep[] {
  return ONBOARDING_STEPS.filter(step => step !== 'region' || showsRegion);
}

/** The step after `step`, or null at the end. */
export function nextStep(step: OnboardingStep, steps: readonly OnboardingStep[] = ONBOARDING_STEPS): OnboardingStep | null {
  const index = steps.indexOf(step);
  return index >= 0 && index + 1 < steps.length ? steps[index + 1] : null;
}
export function previousStep(step: OnboardingStep, steps: readonly OnboardingStep[] = ONBOARDING_STEPS): OnboardingStep | null {
  const index = steps.indexOf(step);
  return index > 0 ? steps[index - 1] : null;
}

/** "Paso 2 de 4": the welcome is not counted. */
export function stepPosition(step: OnboardingStep, steps: readonly OnboardingStep[] = ONBOARDING_STEPS): { index: number; count: number } | null {
  const counted: OnboardingStep[] = steps.filter(item => item !== 'welcome');
  const index = counted.indexOf(step);
  return index >= 0 ? { index: index + 1, count: counted.length } : null;
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

/** The display currency the region suggests: its legal tender when the build offers it (the first one CLDR lists
 * that the gate holds), else the app's default. Only a suggestion, for the totals; never an account's currency. */
export function suggestedDisplayCurrency(region: CatalogueRegionCode | null, gate: CurrencyGate = LEDGER_CURRENCIES): Currency {
  const tender = region ? regionRecord(region).currencies : [];
  return (tender as readonly string[]).find((code): code is Currency => (gate as readonly string[]).includes(code)) ?? 'ARS';
}

/** The rows of the currency step for `ChoiceScreen`: every currency the build offers, the suggestion pinned first. */
export function currencyStepOptions(suggested: Currency, gate: CurrencyGate, locale: AppLocale, suggestedSubtitle: string):
  { pinned: ChoiceOption<Currency>; options: ChoiceOption<Currency>[] } {
  const rows = currencyChoices([suggested, ...gate.filter(code => code !== suggested)], locale)
    .map(choice => ({ value: choice.code, title: choice.name, subtitle: choice.code + ' · ' + choice.symbol, searchText: choice.searchText }));
  const [first, ...rest] = rows;
  return { pinned: { ...first, subtitle: suggestedSubtitle + ' · ' + first.subtitle }, options: rest };
}
