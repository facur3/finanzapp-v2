import type { Messages } from '../../messages.ts';

/** Más: the hub rows, the footer and its diagnostics. */
export const settings: Pick<Messages, 'settings'> = {
  settings: {
    sections: {
      finance: 'Finances',
      appData: 'App and data',
    },
    rows: {
      accounts: 'Accounts',
      accountsSubtitle: 'Balances and transactions',
      cards: 'Cards',
      cardsSubtitle: 'Purchases and statements',
      cardsCount: { one: '{count} credit card', other: '{count} credit cards' },
      budgets: 'Budgets',
      budgetsSubtitle: 'Monthly plan',
      budgetsCount: { one: '{count} this month', other: '{count} this month' },
      recurring: 'Recurring',
      recurringSubtitle: 'Bills and income',
      recurringCount: { one: '{count} active', other: '{count} active' },
      debts: 'Debts and IOUs',
      debtsSubtitle: 'I owe · owed to me',
      debtsCount: { one: '{count} pending', other: '{count} pending' },
      categories: 'Categories',
      categoriesSubtitle: 'Expenses and income',
      categoriesCount: { one: '{count} customized', other: '{count} customized' },
      backup: 'Backup',
      backupSubtitle: 'Share and import',
      undone: 'Undone transactions',
      undoneNone: 'None',
      undoneCount: { one: '{count} recoverable', other: '{count} recoverable' },
    },
    localNote: 'Your records stay on this device and you can record offline. Sync is not turned on yet.',
    footer: 'FinanzApp · Native pilot {version} · Producto {release} · {material} · {source}',
    material: {
      disabled: 'Opaque material (turned off)',
      expoGo: 'Opaque material (Expo Go)',
      platform: 'Opaque material',
      notRegistered: 'Opaque material (no native module)',
      unavailable: 'Opaque material (iOS without Liquid Glass)',
      api: 'Opaque material (API unavailable)',
      reduceTransparency: 'Opaque material (Reduce Transparency)',
      glass: 'Liquid Glass',
    },
    localeSource: {
      native: 'Language: native module',
      intl: 'Language: Intl (no native module)',
      none: 'Language: default',
    },
  },
};
