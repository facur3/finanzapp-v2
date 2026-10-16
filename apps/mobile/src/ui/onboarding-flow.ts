/** The first opening (Producto 25B, redesigned in 25O1): its steps, when it is shown at all, and what it suggests and
 * draws. Pure: no React, no Expo, so Node tests every rule; `app/onboarding.tsx` draws it.
 *
 * Rules:
 *   - It is shown once, to a **new** installation only: no accounts, and no language, region or
 *     display-currency preference ever chosen. Anyone else (a ledger with accounts, a preference
 *     saved by an earlier build) is an existing person: the flow is marked done silently and
 *     nothing of theirs is read again, written or changed. An unreadable store counts as existing:
 *     never show a setup to someone the app cannot judge. The route checks this itself too, so a
 *     link or a restored navigation into it never reaches an existing person's preferences.
 *   - 25O1: four steps on one route. A three-page story (recording, commitments, what is left) told
 *     with illustrations of fixed sample figures, drawn and never stored; where the person keeps
 *     their money (cash, a bank, a digital wallet: each a preset of the first account), with the
 *     language and region as two pills that open the Más choosers and a way to restore a copy; that
 *     account's opening balance; and the close, with the account created. Omitir skips the **rest**
 *     of the setup and keeps every choice already saved; nothing is ever undone silently. The close
 *     has no way back: its account exists.
 *   - The region suggests the first account's currency (its legal tender, when this build offers
 *     it) and the person decides; the account created seeds the display currency of the totals
 *     (docs/currency.md §2.9). Language, region, an account's currency and the display currency
 *     stay four independent preferences. */
import { minorUnitExponent, shiftMonthISO, type AccountIconId, type Currency } from '@finanzapp/domain';
import type { PreferenceStore } from '../i18n/preference.ts';
import type { MessageKey } from '../i18n/messages.ts';
import { DISPLAY_CURRENCY_KEY } from './display-currency.ts';
import { LANGUAGE_PREFERENCE_KEY, REGION_PREFERENCE_KEY } from '../i18n/preference.ts';

/** The region's suggestion lives with the other currency defaults since 25B2 (`currency-defaults.ts`, rule 4). */
export { suggestedCurrency } from './currency-defaults.ts';

export const ONBOARDING_KEY = 'finanzapp.onboarding';
export const ONBOARDING_DONE = 'done';

export type OnboardingStep = 'story' | 'start' | 'account' | 'done';
export const ONBOARDING_STEPS: readonly OnboardingStep[] = ['story', 'start', 'account', 'done'];
/** The story's pages: recording, commitments, what is left. */
export const STORY_PAGES = 3;

/** The step after `step`, or null at the end. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index >= 0 && index + 1 < ONBOARDING_STEPS.length ? ONBOARDING_STEPS[index + 1] : null;
}
/** The step before `step`, or null at the start and at the close (25O1: its account exists, there is nothing to go back to). */
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return step !== 'done' && index > 0 ? ONBOARDING_STEPS[index - 1] : null;
}

export type AccountPreset = 'cash' | 'bank' | 'digital';
/** 25O1: where the person keeps their money, each a preset of the first account: its icon (`ACCOUNT_ICONS` in the domain,
 * the default colour beside it) and its catalogue keys: the account's name, the row's title and detail, and the question
 * over its opening balance. The name stays editable; the look is changed later in Cuentas like any other. */
export const ACCOUNT_PRESETS: { readonly [Preset in AccountPreset]: { icon: AccountIconId; name: MessageKey; title: MessageKey; detail: MessageKey; question: MessageKey } } = {
  cash: { icon: 'cash', name: 'onboarding.presets.cash.name', title: 'onboarding.presets.cash.title', detail: 'onboarding.presets.cash.detail',
    question: 'onboarding.presets.cash.question' },
  bank: { icon: 'bank', name: 'onboarding.presets.bank.name', title: 'onboarding.presets.bank.title', detail: 'onboarding.presets.bank.detail',
    question: 'onboarding.presets.bank.question' },
  digital: { icon: 'digital', name: 'onboarding.presets.digital.name', title: 'onboarding.presets.digital.title', detail: 'onboarding.presets.digital.detail',
    question: 'onboarding.presets.digital.question' },
};

/** 25O1: the figures the story's illustrations draw, in minor units of the suggested currency. Drawn, never stored. */
export type SampleFigures = { coffee: number; groceries: number; transport: number; instalment: number; available: number; spent: number };
const FIGURES: readonly (keyof SampleFigures)[] = ['coffee', 'groceries', 'transport', 'instalment', 'available', 'spent'];
/** Currencies with round figures of their own, in whole units: pesos. */
const OWN_FIGURES: Partial<Record<string, readonly number[]>> = { ARS: [2_500, 18_940, 1_200, 18_400, 482_300, 96_400] };
/** Every other currency, in hundredths of a dollar-like unit: 4.50, 38.90, 2.75, 184, 3 240, 964. */
const HUNDREDTHS = [450, 3_890, 275, 18_400, 324_000, 96_400];
/** How many units of these currencies make a dollar-like figure look real (a coffee is about 680 yen). A presentation
 * factor for an illustration, never an exchange rate. */
const LARGE_UNITS: Partial<Record<string, number>> = { JPY: 150, KRW: 1_500, CLP: 1_000, COP: 4_000, PYG: 7_000, IDR: 15_000, VND: 25_000, HUF: 400, ISK: 150 };

/** Two significant digits, half up: 41 250 → 41 000, 67 500 → 68 000. */
const twoSignificant = (value: number) => {
  const step = 10 ** Math.max(0, String(Math.round(value)).length - 2);
  return Math.round(value / step) * step;
};
/** Hundredths of a unit as minor units of a currency with `exponent` decimals (half up when it has fewer than two). */
const minorOfHundredths = (hundredths: number, exponent: number) =>
  exponent >= 2 ? hundredths * 10 ** (exponent - 2) : Math.round(hundredths / 10 ** (2 - exponent));

export function sampleFigures(currency: Currency): SampleFigures {
  const exponent = minorUnitExponent(currency);
  const own = OWN_FIGURES[currency], factor = LARGE_UNITS[currency];
  const values = own ? own.map(units => units * 10 ** exponent)
    : HUNDREDTHS.map(hundredths => minorOfHundredths(factor ? twoSignificant(hundredths * factor) : hundredths, exponent));
  return Object.fromEntries(FIGURES.map((name, index) => [name, values[index]])) as SampleFigures;
}

/** 25O1: the keystrokes that type `draft` (a form draft in the ledger's notation, "2.500" or "4,50"): one more digit, or the
 * decimal mark, each time; never a group separator, which the amount field adds by itself. */
export function typingFrames(draft: string): string[] {
  const keys = draft.replace(/\./g, '');
  return Array.from(keys, (_, index) => keys.slice(0, index + 1));
}

/** 25O1: a figure counting up to `target` at `progress` (0 → 1) of its run, in whole units of its currency (no flickering
 * cents); exactly `target` at the end. */
export function countUp(target: number, progress: number, exponent: number): number {
  if (!(progress < 1)) return target;
  const unit = 10 ** exponent;
  return Math.round((target * Math.max(0, progress)) / unit) * unit;
}

/** Below this much height an illustration is not drawn at all (the largest text sizes on a compact iPhone): shrunk past
 * it, a picture reads as a smudge, and the headline needs the room. */
export const ART_MIN_HEIGHT = 160;
/** 25O1: how much an illustration drawn at `size` is scaled to fit `room`: down, never up; 0 (not drawn) when the room is
 * shorter than `ART_MIN_HEIGHT` or not measured yet. */
export function artScale(room: { width: number; height: number }, size: { width: number; height: number }): number {
  if (!(room.height >= ART_MIN_HEIGHT) || !(room.width > 0)) return 0;
  return Math.min(1, room.width / size.width, room.height / size.height);
}

/** 25O1: the commitments page's calendar: the six months from three before today's to two after ("YYYY-MM"), the current
 * one at index 3 (the instalment due now, «Cuota 4 de 6»), and its due day, the 12th of this month. */
export function storyCalendar(todayISO: string): { months: string[]; current: number; due: string } {
  const month = todayISO.slice(0, 7);
  return { months: [-3, -2, -1, 0, 1, 2].map(offset => shiftMonthISO(month, offset)), current: 3, due: month + '-12' };
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
