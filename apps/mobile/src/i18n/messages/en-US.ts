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
  count: {
    movements: { one: '{count} movement', other: '{count} movements' },
    expenses: { one: '{count} expense', other: '{count} expenses' },
  },
};
