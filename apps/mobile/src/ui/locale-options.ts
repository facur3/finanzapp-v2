/** What the Idioma and Región choosers list, and what Más says about each.
 * Only released values are listed: an unfinished translation or a region whose
 * formats the amount field cannot type yet is never offered, not even greyed
 * out. "Follow the device" is always first and names what the device gives
 * right now. Pure, so Node tests every combination. */
import { formatAmount, formatNumericDate } from '../i18n/format.ts';
import { LANGUAGES, composeLocale, type LanguageCode, type LanguagePreference, type RegionCode, type RegionPreference } from '../i18n/locale.ts';
import type { Translate } from '../i18n/messages.ts';
import { activeLanguageChoice, activeRegionChoice, type LocaleState } from '../i18n/store.ts';

export type LocalePreferenceKind = 'language' | 'region';
export interface PreferenceOption<T extends string> { value: T; title: string; subtitle?: string }

export const languageName = (language: LanguageCode) => LANGUAGES[language].name;
export const regionName = (region: RegionCode, t: Translate) => t(`preferences.regionNames.${region}`);

/** A fixed illustration of a region's conventions (not ledger data): "22/9/2026 · 1.234,56". */
export function regionSample(region: RegionCode, state: LocaleState, t: Translate): string {
  const locale = composeLocale(state.language, region);
  return t('preferences.regionSample', { date: formatNumericDate('2026-09-22', locale), amount: formatAmount(123456, locale) });
}

export function languageOptions(state: LocaleState, t: Translate): PreferenceOption<LanguagePreference>[] {
  return [
    { value: 'system', title: t('preferences.followDevice'), subtitle: t('preferences.followDeviceNow', { value: languageName(state.device.language) }) },
    ...state.released.languages.map(language => ({ value: language, title: languageName(language) })),
  ];
}

export function regionOptions(state: LocaleState, t: Translate): PreferenceOption<RegionPreference>[] {
  return [
    { value: 'system', title: t('preferences.followDevice'), subtitle: t('preferences.followDeviceNow', { value: regionName(state.device.region, t) }) },
    ...state.released.regions.map(region => ({ value: region, title: regionName(region, t), subtitle: regionSample(region, state, t) })),
  ];
}

/** The chooser's list for a kind, with the option that carries the checkmark. */
export function preferenceChoices(kind: LocalePreferenceKind, state: LocaleState, t: Translate) {
  return kind === 'language'
    ? { options: languageOptions(state, t) as PreferenceOption<string>[], selected: activeLanguageChoice(state) as string }
    : { options: regionOptions(state, t) as PreferenceOption<string>[], selected: activeRegionChoice(state) as string };
}

/** Más row subtitle: the value in use, and whether it follows the device. */
export function preferenceSummary(kind: LocalePreferenceKind, state: LocaleState, t: Translate): string {
  const following = (kind === 'language' ? activeLanguageChoice(state) : activeRegionChoice(state)) === 'system';
  const value = kind === 'language' ? languageName(state.language) : regionName(state.region, t);
  return following ? t('preferences.followingDevice', { value }) : value;
}

/** A chooser is shown only when it offers a real choice between released values
 * or the device default. Language: always (Spanish is released; "follow the
 * device" is a stored choice that will matter the day English is released).
 * Region: only when more than one region is released, which is Producto 23.1C:
 * until the amount field types US separators, a US region would write amounts
 * one way and let the person type them another. */
export function showsPreference(kind: LocalePreferenceKind, state: LocaleState): boolean {
  return kind === 'language' ? state.released.languages.length > 0 : state.released.regions.length > 1;
}
