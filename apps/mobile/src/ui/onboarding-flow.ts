/** The first opening (Producto 25B, redesigned in 25O1): its steps, when it is shown at all, and what it suggests and
 * draws. Pure: no React, no Expo, so Node tests every rule; `app/onboarding.tsx` draws it.
 *
 * Rules:
 *   - It is shown once, to a **new** installation only: no accounts, and no language, region or
 *     display-currency preference ever chosen, unless it was chosen during a first opening left
 *     half-way (25O1 review: the started mark). Anyone else (a ledger with accounts, a preference
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
/** 25O1 review: written by the layout as it sends a new installation to the first opening, so a preference saved during it
 * (a language chosen from its pill, then iOS relaunching the app from Settings) stays the new person's own. */
export const ONBOARDING_STARTED = 'started';

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
 * factor for an illustration, rough and rounded, never an exchange rate. Every currency of the gate without decimals is
 * here, so none draws a five-franc coffee; so is every two-decimal one whose unit is worth about a fifth of a dollar or
 * less, so a naira or rupee coffee never reads «4,50». */
const LARGE_UNITS: Partial<Record<string, number>> = { JPY: 150, KRW: 1_500, CLP: 1_000, COP: 4_000, PYG: 7_000, IDR: 15_000, VND: 25_000, HUF: 400, ISK: 150,
  BIF: 2_900, DJF: 180, GNF: 8_600, KMF: 450, RWF: 1_400, UGX: 3_700, VUV: 120, XAF: 600, XOF: 600, XPF: 110,
  AFN: 70, ALL: 92, AMD: 390, AOA: 900, BDT: 120, BOB: 7, BRL: 5, BTN: 85, BWP: 14, CDF: 2_800, CNY: 7, CRC: 510, CUP: 24, CVE: 100, CZK: 23,
  DKK: 7, DOP: 60, DZD: 135, EGP: 48, ERN: 15, ETB: 120, GHS: 15, GMD: 70, GTQ: 8, GYD: 210, HKD: 8, HNL: 25, HTG: 130, INR: 85, IRR: 42_000,
  JMD: 155, KES: 130, KGS: 87, KHR: 4_000, KPW: 900, KZT: 480, LAK: 21_000, LBP: 89_000, LKR: 300, LRD: 190, LSL: 18, MAD: 10, MDL: 18,
  MGA: 4_500, MKD: 57, MMK: 2_100, MNT: 3_400, MOP: 8, MRU: 40, MUR: 46, MVR: 15, MWK: 1_700, MXN: 18, MZN: 64, NAD: 18, NGN: 1_500,
  NIO: 37, NOK: 11, NPR: 135, PHP: 57, PKR: 280, RSD: 107, RUB: 90, SCR: 14, SDG: 600, SEK: 11, SLE: 23, SOS: 570, SRD: 35, SSP: 1_000,
  STN: 23, SYP: 13_000, SZL: 18, THB: 35, TJS: 11, TRY: 34, TTD: 7, TWD: 32, TZS: 2_600, UAH: 41, UYU: 40, UZS: 12_700, VES: 40, YER: 250,
  ZAR: 18, ZMW: 26, ZWG: 27 };

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
 * one at index 3 («Cuota 4 de 6»), and its due day. 25O1 review: the next 12th, this month's until the 12th and next
 * month's after it, never a day already past. */
export function storyCalendar(todayISO: string): { months: string[]; current: number; due: string } {
  const month = todayISO.slice(0, 7);
  const due = (Number(todayISO.slice(8, 10)) <= 12 ? month : shiftMonthISO(month, 1)) + '-12';
  return { months: [-3, -2, -1, 0, 1, 2].map(offset => shiftMonthISO(month, offset)), current: 3, due };
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
  // 25O1 review: a first opening left half-way goes on while the ledger is empty; the preferences saved in it are its own.
  if (stored === ONBOARDING_STARTED) return hasAccounts ? 'existing' : 'new';
  return hasAccounts || chose ? 'existing' : 'new';
}

/** Records that the first opening is over (finished or skipped, or an existing person's silent mark). False when the
 * store could not be written: the app goes on regardless, and the next launch decides again. */
export function markOnboardingDone(store: () => PreferenceStore): boolean {
  try { store().setItemSync(ONBOARDING_KEY, ONBOARDING_DONE); return true; } catch { return false; }
}

/** 25O1 review: records that a new installation was sent to the first opening (best effort, like the done mark); Omitir
 * and Empezar overwrite it with done. */
export function markOnboardingStarted(store: () => PreferenceStore): boolean {
  try { store().setItemSync(ONBOARDING_KEY, ONBOARDING_STARTED); return true; } catch { return false; }
}
