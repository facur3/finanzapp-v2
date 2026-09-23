import type { Messages } from '../messages.ts';

/** US English. Typed against the reference catalogue, so a missing or extra
 * key is a compile error, and the catalogue test checks the placeholders. */
export const en: Messages = {
  common: {
    cancel: 'Cancel',
    done: 'Done',
    closeAmountKeyboard: 'Close the amount keyboard',
    moreInfoAbout: 'More about {title}',
  },
  selection: {
    account: 'Account',
    chooseAccount: 'Choose account',
    category: 'Category',
    chooseCategory: 'Choose category',
    categories: 'Categories',
    date: 'Date',
    chooseDate: 'Choose date',
    currency: 'Currency',
    chooseCurrency: 'Choose currency',
    currencyNote: 'For now accounts are kept in pesos or in dollars, never converted between them. Other currencies arrive with their exchange rate.',
    searchOrCreateCategory: 'Search or create a category',
    categoryNamePlaceholder: 'Category name',
    useCategory: 'Use category {name}',
    archivedStillValid: 'Archived · still valid for this movement',
    archived: 'archived',
  },
  amount: {
    label: 'Amount',
    accessibility: '{label} in {currency}',
    inPesos: 'Argentine pesos',
    inDollars: 'US dollars',
  },
  preferences: {
    language: 'Language',
    region: 'Region',
    followDevice: 'Same as device',
    followDeviceNow: 'Now: {value}',
    followingDevice: '{value} · same as device',
    languageNote: 'FinanzApp is available in Spanish for now. Other languages arrive once the whole app is translated.',
    regionNote: 'The region sets how dates, numbers and amounts are written. It does not change the currency of your accounts.',
    dataUntouched: 'Changing the language or the region does not modify your movements, your accounts or your backups.',
    saveFailed: 'The preference could not be saved. Your previous choice is still active; please try again.',
    regionNames: { AR: 'Argentina', US: 'United States' },
    regionSample: '{date} · {amount}',
  },
  count: {
    movements: { one: '{count} movement', other: '{count} movements' },
    expenses: { one: '{count} expense', other: '{count} expenses' },
  },
};
