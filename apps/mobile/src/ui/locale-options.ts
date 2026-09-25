/** What the Idioma and Región choosers list, and what Más says about each.
 * Only released values are listed (Español and English, Argentina and the
 * United States since Producto 23.1C2; every catalogue region in a development
 * preview, 24R2A): a catalogue still being translated or a region still waiting
 * for its device QA is never offered, not even greyed out. The one exception is
 * a region the person already chose in a preview: it stays saved and is shown,
 * marked, with the formats that stand in for it. "Follow the device" is always
 * pinned first and names what the device gives right now. Pure, so Node tests
 * every combination; `ChoiceScreen` draws the result. */
import { formatMoneyAmount, formatNumericDate } from '../i18n/format.ts';
import { LANGUAGES, RELEASED_REGIONS, composeLocale, isLanguageCode, isRegionCode, type LanguageCode, type LanguagePreference, type RegionCode,
  type RegionPreference } from '../i18n/locale.ts';
import type { Translate } from '../i18n/messages.ts';
import { foldText } from '../i18n/intl-support.ts';
import { activeLanguageChoice, activeRegionChoice, pendingRegionChoice, type LocaleState } from '../i18n/store.ts';
import { regionChoices, regionDisplayName, regionStatus } from '../i18n/regions.ts';
import type { ChoiceOption } from './choice-list.ts';

export type LocalePreferenceKind = 'language' | 'region';

/** One chooser, ready for `ChoiceScreen`: the pinned "follow the device" row, the options, the checkmark,
 * which values its recents may hold, and the footnote. */
export interface LocaleChooser<T extends string> {
  pinned: ChoiceOption<T>;
  options: ChoiceOption<T>[];
  selected: T;
  acceptRecent: (value: unknown) => value is Exclude<T, 'system'>; // i18n-ignore: a preference value, not copy
  note: string;
}

export const languageName = (language: LanguageCode) => LANGUAGES[language].name;
/** A region's name in the interface language, from CLDR ("Japón", "Japan"). */
export const regionName = (region: RegionCode, language: LanguageCode) => regionDisplayName(region, language);

/** A fixed illustration of a region's conventions (not ledger data): "22/9/2026 · 1.234,56". The sample is a two-decimal
 * number written the region's way; it names no currency and the peso is only the two-decimal shape it borrows. */
export function regionSample(region: RegionCode, state: LocaleState, t: Translate): string {
  const locale = composeLocale(state.language, region);
  return t('preferences.regionSample', { date: formatNumericDate('2026-09-22', locale), amount: formatMoneyAmount(123456, 'ARS', locale) });
}

/** What "Según el dispositivo" gives for the region right now. A device Region the catalogue knows but this
 * build does not honour yet is named, with the region whose conventions stand in (24R1): "Ahora: Japón
 * (formatos de Argentina)", never "Ahora: Argentina" as if the iPhone were set there. */
export function deviceRegionSummary(state: LocaleState, t: Translate): string {
  const detected = state.device.detectedRegion;
  if (detected && regionStatus(detected, state.released.regions) === 'catalogue') {
    return t('preferences.followDeviceNowFallback', { value: regionName(detected, state.language), fallback: regionName(state.device.region, state.language) });
  }
  return t('preferences.followDeviceNow', { value: regionName(state.device.region, state.language) });
}

export function languageChooser(state: LocaleState, t: Translate): LocaleChooser<LanguagePreference> {
  return {
    pinned: { value: 'system', title: t('preferences.followDevice'), subtitle: t('preferences.followDeviceNow', { value: languageName(state.device.language) }) },
    // Autonyms, each spoken in its own language; searched by name and by code ("en", "english").
    options: state.released.languages.map(language => ({ value: language, title: languageName(language), language, searchText: foldText(languageName(language) + ' ' + language) })),
    selected: activeLanguageChoice(state),
    acceptRecent: (value): value is LanguageCode => isLanguageCode(value) && state.released.languages.includes(value),
    note: t('preferences.dataUntouched'),
  };
}

export function regionChooser(state: LocaleState, t: Translate): LocaleChooser<RegionPreference> {
  const pending = pendingRegionChoice(state);
  const codes = pending ? [...state.released.regions, pending] : state.released.regions;
  const options = regionChoices(state.language, codes).map(choice => ({
    value: choice.code, title: choice.name, searchText: choice.searchText,
    subtitle: choice.code === pending
      ? t('preferences.pendingRegion', { fallback: regionName(state.region, state.language) })
      : regionSample(choice.code, state, t),
  }));
  // A development preview lists regions whose device QA is still pending (24R2B): the footnote says so.
  const preview = state.released.regions.some(region => !RELEASED_REGIONS.includes(region));
  return {
    pinned: { value: 'system', title: t('preferences.followDevice'), subtitle: deviceRegionSummary(state, t) },
    options,
    selected: pending ?? activeRegionChoice(state),
    acceptRecent: (value): value is RegionCode => isRegionCode(value) && state.released.regions.includes(value),
    note: [t('preferences.regionNote'), t('preferences.dataUntouched'), preview ? t('preferences.previewNote') : ''].filter(Boolean).join(' '),
  };
}

/** The chooser of a kind: what `LocaleChooser` hands to `ChoiceScreen`. */
export function localeChooser(kind: LocalePreferenceKind, state: LocaleState, t: Translate): LocaleChooser<string> {
  return kind === 'language' ? languageChooser(state, t) : regionChooser(state, t);
}

/** Más row subtitle: the value in use, whether it follows the device, and for a region chosen in a preview and
 * not released here, the formats in use ("Japón · formatos de Argentina"). */
export function preferenceSummary(kind: LocalePreferenceKind, state: LocaleState, t: Translate): string {
  if (kind === 'region') {
    const pending = pendingRegionChoice(state);
    if (pending) return t('preferences.pendingSummary', { value: regionName(pending, state.language), fallback: regionName(state.region, state.language) });
  }
  const following = (kind === 'language' ? activeLanguageChoice(state) : activeRegionChoice(state)) === 'system';
  const value = kind === 'language' ? languageName(state.language) : regionName(state.region, state.language);
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
