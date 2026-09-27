/** The first opening (Producto 25B): two short stages. Skip keeps every choice already saved. */
export const onboarding = {
  onboarding: {
    skip: 'Skip',
    skipLabel: 'Skip the rest of the setup',
    skipHint: 'Keeps what you already chose and opens the app',
    continue: 'Continue',
    welcome: {
      title: 'Your spending, clear.',
      detail: 'Record what you spend and see where your money goes. Everything stays on your iPhone; no account, connection or bank needed.',
      detected: 'Detected from your device. Change them now or later, in More.',
    },
    account: {
      title: 'Your first account',
      detail: 'An account groups transactions: cash, a bank, a wallet. It is optional: you can start without one.',
      suggested: 'Suggested by your region: {name}. Each account keeps its own currency.',
      ownCurrency: 'Each account keeps its own currency.',
      opening: 'Opening balance (optional)',
      create: 'Create account',
      later: 'Not now',
    },
  },
} as const;
