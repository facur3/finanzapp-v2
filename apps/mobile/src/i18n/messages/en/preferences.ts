import type { Messages } from '../../messages.ts';

/** Idioma and Región. */
export const preferences: Pick<Messages, 'preferences'> = {
  preferences: {
    language: 'Language',
    region: 'Region',
    followDevice: 'Same as device',
    followDeviceNow: 'Now: {value}',
    followingDevice: '{value} · same as device',
    regionNote: 'The region sets how dates, numbers and amounts are written. It does not change the currency of your accounts.',
    dataUntouched: 'Changing the language or the region does not modify your transactions, accounts or backups.',
    saveFailed: 'The preference could not be saved. Your previous choice is still active; please try again.',
    regionNames: { AR: 'Argentina', US: 'United States' },
    regionSample: '{date} · {amount}',
  },
};
