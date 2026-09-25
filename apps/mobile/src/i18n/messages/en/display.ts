/** How Home and Reports show money (Producto 24C1): the display sheet and the exchange-rate notes. */
export const display = {
  display: {
    title: 'Show totals',
    consolidated: 'Consolidated total',
    consolidatedDetail: 'All your accounts, converted to one currency.',
    single: 'One currency only',
    singleDetail: 'Only the accounts in that currency, nothing converted.',
    currency: 'Display currency',
    note: 'Changing how totals are shown never converts or changes your accounts, balances or transactions.',
    only: '{code} only',
    chipConsolidated: 'Consolidated total in {name}',
    chipSingle: '{name} only',
    chipHint: 'Opens the display options',
  },
  fx: {
    infoTitle: 'Exchange rates',
    spendingInfo: 'Spending across all your accounts in {currency}. Each expense is converted at the reference rate of its own date ({source}, '
      + 'central banks); the most recent one used is from {date}. Your accounts and transactions keep their original currency.',
    availableInfo: 'Money recorded in all your accounts, in {currency}, at the reference rate of {date} ({source}, central banks). '
      + 'It excludes cards and debts, and it is not a bank balance or your net worth. Your accounts keep their original currency.',
    reportInfo: 'Spending across all your accounts in {currency}. Each expense is converted at the reference rate of its own date ({source}, '
      + 'central banks): rates from {oldest} to {newest} were used, never today\'s rate for a past month. Transactions keep their original '
      + 'amount. Opening balances, transfers and card payments are not included.',
    unavailable: 'No rate to add it up in {currency}',
    comparisonFooter: 'Spending across all your accounts in {currency}, each at the rate of its own date; no transfers or opening balances. The differences describe your records, not the reasons for your spending or a confirmed saving.',
    fetching: 'Getting exchange rates',
    reason: {
      fetching: 'We are getting the reference rates. Meanwhile each currency is shown on its own.',
      offline: 'No connection: we could not get the {pair} rate for {date}. Each currency is shown on its own; the total will appear once you are online.',
      provider: 'The exchange-rate provider ({source}) did not answer for {pair} on {date}. Each currency is shown on its own; we will try again.',
      missing: 'There is no {pair} rate for {date}. Each currency is shown on its own instead of an incomplete total.',
      stale: 'The latest {pair} rate available is from {latest}, too old for {date}. Each currency is shown on its own instead of an incomplete total.',
    },
  },
} as const;
