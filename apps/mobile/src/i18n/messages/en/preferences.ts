import type { Messages } from '../../messages.ts';

/** Idioma and Región. */
export const preferences: Pick<Messages, 'preferences'> = {
  preferences: {
    language: 'Language',
    region: 'Region',
    followDevice: 'Same as device',
    followDeviceNow: 'Now: {value}',
    followDeviceNowFallback: 'Now: {value} ({fallback} formats)',
    search: 'Search',
    recent: 'Recent',
    noMatches: 'No matches',
    followingDevice: '{value} · same as device',
    regionNote: 'Changes how dates and numbers are written. Your amounts and currencies stay the same.',
    languageVariety: 'Variant: {region}',
    languageNote: 'To have iOS use this language in its menus too, choose it in Settings.',
    openSettings: 'Open Settings',
    saveFailed: 'The preference could not be saved. Your previous choice is still active; please try again.',
    pendingRegion: 'Not available yet · {fallback} formats',
    pendingSummary: '{value} · {fallback} formats',
    previewNote: 'Development preview: includes regions not yet verified on an iPhone.',
    regionSample: '{date} · {amount}',
    appearance: 'Appearance',
    appearanceSystem: 'System',
    appearanceLight: 'Light',
    appearanceDark: 'Dark',
    appearanceSystemNowLight: 'Follows the device · now light',
    appearanceSystemNowDark: 'Follows the device · now dark',
    appearanceSystemDetail: 'Follows the device',
  },
};
