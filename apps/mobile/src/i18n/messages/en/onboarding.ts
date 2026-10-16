/** The first opening (Producto 25B, redesigned in 25O1): the story, where the money is, its opening balance and the close.
 * Skip keeps every choice already saved. */
export const onboarding = {
  onboarding: {
    skip: 'Skip',
    skipLabel: 'Skip the rest of the setup',
    skipHint: 'Keeps what you already chose and opens the app',
    back: 'Back',
    next: 'Next',
    continue: 'Continue',
    page: 'Page {current} of {total}',
    story: {
      record: { lead: 'Log a purchase', emphasis: 'in seconds.' },
      commitments: { lead: 'Cards and installments,', emphasis: 'month by month.' },
      available: { lead: 'Know', emphasis: 'what you have left.' },
    },
    art: {
      coffee: 'Coffee',
      groceries: 'Groceries',
      transport: 'Transport',
      plan: 'Fridge · {total} installments',
      perMonth: 'a month',
      instalment: 'Installment {current} of {total}',
      due: 'due {date}',
      spentIn: 'Spent in {month}',
    },
    start: {
      title: 'Where do you keep your money?',
      detail: 'Your records stay on your iPhone. No sign-up or bank connection needed.',
      regionLabel: 'Region: {name}',
      regionHint: 'Opens the list of regions',
      languageLabel: 'Language: {name}',
      languageHint: 'Opens the list of languages',
      restoreQuestion: 'Coming from another phone?',
      restore: 'Restore a backup',
      restoreHint: 'Brings in your data from a saved copy',
    },
    presets: {
      cash: { name: 'Cash', title: 'Cash', detail: 'What you carry', question: 'How much cash do you have?' },
      bank: { name: 'Bank', title: 'Bank account', detail: 'Salary, savings or debit', question: 'How much is in the bank?' },
      digital: { name: 'Digital wallet', title: 'Digital wallet', detail: 'The app you pay with', question: 'How much is in the wallet?' },
    },
    account: {
      zero: 'Not sure? Leave it at zero.',
      name: 'Name',
      create: 'Create account',
    },
    done: {
      title: 'You’re all set.',
      detail: 'You can log your first purchase now.',
      start: 'Get started',
      card: '{name}, balance {amount}',
    },
  },
} as const;
