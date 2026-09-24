import type { Messages } from '../../messages.ts';

/** Recurrentes: the list and the recurring form. */
export const recurring: Pick<Messages, 'recurring'> = {
  recurring: {
    frequency: {
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
    },
    frequencySpoken: {
      weekly: 'weekly',
      monthly: 'monthly',
      yearly: 'yearly',
    },
    list: {
      add: 'Add recurring',
      emptyTitle: 'Nothing recurring yet',
      emptyDetailAccount: 'Create a recurring payment or income for this account.',
      emptyDetail: 'Rent, subscriptions, salary or any transaction that repeats. FinanzApp records it once, when it comes due.',
      create: 'Create recurring',
      next30: 'Next 30 days',
      payments: 'Payments',
      dueCount: 'Due',
      income: 'Income',
      active: 'Active',
      paused: 'Paused',
      pausedCaption: 'Not recorded until you turn them back on',
      toggleFailed: 'We couldn’t change this recurring item. Please try again.',
    },
    row: {
      label: 'Edit recurring {merchant}, {frequency}, {amount} {currency}, next {date}',
      paused: 'Paused',
      pause: 'Pause {merchant}',
      activate: 'Turn on {merchant}',
    },
    form: {
      noAccountTitle: 'First, an account',
      noAccountDetail: 'Recurring items need an account to record each due date in the right currency.',
      expenseAmount: 'Recurring expense',
      incomeAmount: 'Recurring income',
      merchantExpensePlaceholder: 'e.g. Rent',
      merchantIncomePlaceholder: 'e.g. Salary',
      frequency: 'Frequency',
      nextDate: 'Next date',
      todayNote: 'If the next date is today, FinanzApp records that transaction when you save. Then it moves the date forward automatically without duplicating it.',
      retryNote: 'The submission is locked so Retry doesn’t create another rule.',
      create: 'Create recurring',
      pastDate: 'The next date must be today or a future date.',
      saveFailed: 'The recurring item couldn’t be saved. We kept the same submission so you can retry without duplicating it.',
    },
    edit: {
      notFoundTitle: 'We couldn’t find this recurring item',
      notFoundDetail: 'Go back to Recurring to choose a rule saved on this device.',
    },
  },
};
