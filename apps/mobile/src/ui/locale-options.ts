/** What the Idioma and Región choosers list, and what Más says about each.
 * Only released values are listed (Español and English, Argentina and the
 * United States since Producto 23.1C2): a catalogue still being translated is
 * never offered, not even greyed out. "Follow the device" is always first and
 * names what the device gives right now. Pure, so Node tests every combination. */
import { formatMoneyAmount, formatNumericDate } from '../i18n/format.ts';
import { LANGUAGES, composeLocale, type LanguageCode, type LanguagePreference, type RegionCode, type RegionPreference } from '../i18n/locale.ts';
import type { Translate } from '../i18n/messages.ts';
import { activeLanguageChoice, activeRegionChoice, type LocaleState } from '../i18n/store.ts';

export type LocalePreferenceKind = 'language' | 'region';
export interface PreferenceOption<T extends string> {
  value: T; title: string; subtitle?: string;
  /** A language row's own language: its title is an autonym ("English",
   * "Español") that VoiceOver speaks in that language, as iOS Settings does. */
  language?: LanguageCode;
}

export const languageName = (language: LanguageCode) => LANGUAGES[language].name;
export const regionName = (region: RegionCode, t: Translate) => t(`preferences.regionNames.${region}`);

/** A fixed illustration of a region's conventions (not ledger data): "22/9/2026 · 1.234,56". The sample is a two-decimal
 * number written the region's way; it names no currency and the peso is only the two-decimal shape it borrows. */
export function regionSample(region: RegionCode, state: LocaleState, t: Translate): string {
  const locale = composeLocale(state.language, region);
  return t('preferences.regionSample', { date: formatNumericDate('2026-09-22', locale), amount: formatMoneyAmount(123456, 'ARS', locale) });
}

export function languageOptions(state: LocaleState, t: Translate): PreferenceOption<LanguagePreference>[] {
  return [
    { value: 'system', title: t('preferences.followDevice'), subtitle: t('preferences.followDeviceNow', { value: languageName(state.device.language) }) },
    ...state.released.languages.map(language => ({ value: language, title: languageName(language), language })),
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
 * or the device default. Language: always (there is always a released
 * language, and "follow the device" is itself a choice). Region: only when
 * more than one region is released, which is every build since Producto
 * 23.1C2 (Argentina and the United States); a build with a single released
 * region hides the Más row. */
export function showsPreference(kind: LocalePreferenceKind, state: LocaleState): boolean {
  return kind === 'language' ? state.released.languages.length > 0 : state.released.regions.length > 1;
}
