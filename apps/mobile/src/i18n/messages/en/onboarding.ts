/** The first opening (Producto 25B): five short screens, every one skippable. */
export const onboarding = {
  onboarding: {
    step: 'Step {index} of {count}',
    skipAll: 'Skip',
    skipAllLabel: 'Skip the initial setup',
    continue: 'Continue',
    back: 'Back',
    welcome: {
      title: 'Your spending, clear.',
      detail: 'Record what you spend and see where your money goes. Everything stays on your iPhone; no account, connection or bank needed.',
      start: 'Get started',
    },
    language: {
      title: 'Language',
      detail: 'Detected from your device. You can change it any time in More.',
    },
    region: {
      title: 'Region',
      detail: 'Sets how dates and numbers are written. It does not change your currency.',
    },
    currency: {
      title: 'Currency for totals',
      detail: 'Your money and spending are added up in this currency. Each account keeps its own.',
      suggested: 'Suggested by your region',
    },
    account: {
      title: 'Your first account',
      detail: 'An account groups transactions: cash, a bank, a wallet. Pick its currency when you create it. You can start without one.',
      create: 'Create an account',
      later: 'Not now',
    },
  },
} as const;
