/** The live locale state: the two stored preferences, the device's languages
 * and region, and what they resolve to. Pure (no React, no Expo), so Node tests
 * it directly and the provider only subscribes to it.
 *
 * Rules:
 *   - a choice is saved before it is applied: when the key-value store rejects
 *     the write, nothing changes and the setter returns false, so the screen
 *     keeps showing the previous choice and says why;
 *   - a value outside the release gate is refused, whatever asks for it;
 *   - the state object is replaced only when something a reader can see
 *     changed, so re-reading an unchanged device or re-saving the same choice
 *     re-renders nothing;
 *   - nothing here touches the ledger, a backup or a stored amount. */
import { primaryLanguageOf, type LocaleSource } from './device.ts';
import { RELEASED, SYSTEM_PREFERENCES, resolveLocale, type DeviceLocale, type LanguagePreference, type LocalePreferences,
  type RegionPreference, type ReleasedSets, type ResolvedLocale } from './locale.ts';
import { readLocalePreferences, writeLanguagePreference, writeRegionPreference, type PreferenceStore } from './preference.ts';
import { deviceRegion, type CatalogueRegionCode } from './regions.ts';

export interface DeviceReading { source: LocaleSource; locales: DeviceLocale[] }

export interface LocaleState extends ResolvedLocale {
  preferences: LocalePreferences;
  /** What "follow the device" gives right now, shown beside that option, the
   * device's first language as read (possibly one without a catalogue), and its
   * Region setting as a catalogue code (24R1; possibly one not released yet, so
   * the chooser can name it and say which conventions stand in). */
  device: ResolvedLocale & { source: LocaleSource; primaryLanguage: string | null; detectedRegion: CatalogueRegionCode | null };
  released: ReleasedSets;
}

export interface LocaleEnvironment {
  /** The device's languages and region; may throw only for a real fault of a registered module. */
  devices: () => DeviceReading;
  /** The key-value store holding the two preferences. */
  store: () => PreferenceStore;
  /** Which languages and regions may be shown; tests widen it, the app uses the release gate. */
  released?: ReleasedSets;
}

export interface LocaleStore {
  getState: () => LocaleState;
  subscribe: (listener: () => void) => () => void;
  /** Saves and applies a language choice. False when refused or not saved; the state is then unchanged. */
  setLanguage: (preference: LanguagePreference) => boolean;
  setRegion: (preference: RegionPreference) => boolean;
  /** Re-reads the device (the app came back to the foreground, or iOS said its
   * locale changed): "follow the device" follows it live. A failed read keeps
   * the last good reading; it never throws and never resets a choice. */
  refreshDevice: () => void;
}

function deviceKey(reading: DeviceReading): string {
  return reading.source + '|' + reading.locales.map(locale => [locale.languageTag, locale.languageCode ?? '', locale.regionCode ?? ''].join('/')).join(',');
}

function compute(preferences: LocalePreferences, reading: DeviceReading, released: ReleasedSets): LocaleState {
  const resolved = resolveLocale(reading.locales, preferences, released);
  const device = resolveLocale(reading.locales, SYSTEM_PREFERENCES, released);
  return { ...resolved, preferences, device: { ...device, source: reading.source, primaryLanguage: primaryLanguageOf(reading.locales), detectedRegion: deviceRegion(reading.locales) }, released };
}

function sameState(a: LocaleState, b: LocaleState): boolean {
  return a.locale === b.locale && a.preferences.language === b.preferences.language && a.preferences.region === b.preferences.region
    && a.device.locale === b.device.locale && a.device.source === b.device.source && a.device.primaryLanguage === b.device.primaryLanguage
    && a.device.detectedRegion === b.device.detectedRegion;
}

export function createLocaleStore(environment: LocaleEnvironment): LocaleStore {
  const released = environment.released ?? RELEASED;
  let reading = environment.devices();
  let lastDeviceKey = deviceKey(reading);
  let state = compute(readLocalePreferences(environment.store), reading, released);
  const listeners = new Set<() => void>();

  const commit = (next: LocaleState) => {
    if (sameState(state, next)) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setLanguage: preference => {
      if (preference !== 'system' && !released.languages.includes(preference)) return false;
      if (!writeLanguagePreference(preference, environment.store)) return false;
      commit(compute({ ...state.preferences, language: preference }, reading, released));
      return true;
    },
    setRegion: preference => {
      if (preference !== 'system' && !released.regions.includes(preference)) return false;
      if (!writeRegionPreference(preference, environment.store)) return false;
      commit(compute({ ...state.preferences, region: preference }, reading, released));
      return true;
    },
    refreshDevice: () => {
      let next: DeviceReading;
      // Called from AppState and native event listeners, with a form possibly
      // open: a fault of the device reader keeps what is on screen.
      try { next = environment.devices(); } catch { return; }
      const key = deviceKey(next);
      if (key === lastDeviceKey) return;
      reading = next;
      lastDeviceKey = key;
      commit(compute(state.preferences, reading, released));
    },
  };
}

/** The option a chooser marks: a stored value outside the release gate (a
 * language not released in this build) is not applied, so the list marks "follow the device". */
export function activeLanguageChoice(state: LocaleState): LanguagePreference {
  const preference = state.preferences.language;
  return preference === 'system' || state.released.languages.includes(preference) ? preference : 'system';
}
export function activeRegionChoice(state: LocaleState): RegionPreference {
  const preference = state.preferences.region;
  return preference === 'system' || state.released.regions.includes(preference) ? preference : 'system';
}
