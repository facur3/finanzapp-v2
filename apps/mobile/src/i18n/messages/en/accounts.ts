import type { Messages } from '../../messages.ts';

/** Cuentas: the list, the account detail, new and edit account. */
export const accounts: Pick<Messages, 'accounts'> = {
  accounts: {
    list: {
      emptyTitle: 'Start with an account',
      emptyDetail: 'Choose an account to group your transactions. Entering an opening balance is optional.',
    },
    detail: {
      notFoundTitle: 'We couldn’t find this account',
      notFoundDetail: 'Go back to your accounts to choose one saved on this device.',
      edit: 'Edit account',
      recordedBalance: 'Recorded balance',
      monthExpenses: 'Spent this month',
      monthIncome: 'Income this month',
      recurring: 'Recurring',
      activeRecurring: { one: '{count} active', other: '{count} active' },
      schedule: 'Schedule',
      openingBalance: 'Opening balance',
      movements: 'Transactions',
      empty: 'No transactions in this account yet.',
    },
    form: {
      name: 'Account name',
      namePlaceholder: 'e.g. Bank, Cash, Brokerage',
      openingBalance: 'Opening balance',
      openingHelp: 'You can leave it empty and start from zero. The recorded balance is the result of your transactions; '
        + 'it is not your bank balance. If you enter an opening balance, it is the starting point and does not count as income.',
      openingNote: 'Optional. Doesn’t count as income.',
      retryNote: 'Retry the same submission to avoid duplicates. To change it, close and check your accounts first.',
      save: 'Save account',
      saveFailed: 'Couldn’t save. We kept what you entered so you can try again.',
    },
    edit: {
      notFoundDetail: 'Go back to your accounts to review your saved data.',
      recordedBalance: 'Recorded balance',
      balanceHelp: 'The icon and color only change how the account looks. Use a balance correction only if the balance was entered wrong: '
        + 'it leaves a correction record, not income or an expense. If you received, spent or moved money, record that transaction instead.',
      balanceNote: 'Only to fix a balance entered by mistake.',
      currencyHelp: 'The currency can’t be changed, so earlier transactions keep their meaning. Add an account in another currency separately.',
      currencyNote: 'An account’s currency can’t be changed.',
      retryNote: 'Retry this same change. To edit it, close and check the saved balance first.',
      saveUnverified: 'We couldn’t confirm the save. Retry the same change.',
      invalid: 'Check the name and the balance.',
      correctTitle: 'Correct the balance?',
      correctMessage: '{name}: from {from} to {to} {currency}. The opening balance will be adjusted; your transactions don’t change. This is not income or a transfer.',
      correctConfirm: 'Correct balance',
    },
  },
};
