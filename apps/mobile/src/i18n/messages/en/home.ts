import type { Messages } from '../../messages.ts';

/** Inicio: the number, its controls, the capture sheet, the commitments due this week and the one contextual line. */
export const home: Pick<Messages, 'home' | 'quickActions'> = {
  home: {
    emptyTitle: 'Understand your spending.',
    emptyDetail: 'Choose an account to group your transactions. You can start without entering your bank balance.',
    start: 'Get started',
    spending: 'Spending',
    available: 'Available',
    recordedBalance: 'Recorded balance',
    availableHelp: 'The money recorded in your accounts in this currency: opening balance plus income, minus expenses and transfers. '
      + 'It excludes cards and debts, and it is not a bank balance or your net worth.',
    spendingOutOfRange: 'The total is beyond the range we can show precisely. Your transactions are still saved.',
    balanceOutOfRange: 'The total balance is beyond the range we can show precisely. Your accounts are still saved.',
    accounts: { one: '{count} account', other: '{count} accounts' },
    upcoming: 'Coming up',
    upcomingRow: {
      today: 'Today',
      tomorrow: 'Tomorrow',
      inDays: { one: 'In {count} day', other: 'In {count} days' },
      label: '{merchant}, {category}, {amount}, next payment {date}',
    },
    capture: {
      button: 'Record',
      label: 'Record a transaction',
      hint: 'Opens the ways to record: an expense, income, a transfer or the Assistant',
      title: 'Record',
      expense: 'Record an expense',
      income: 'Record income',
      transfer: 'Transfer between accounts',
      assistant: 'Talk to the Assistant',
      assistantDetail: 'Tell it what happened: it proposes the transaction and you confirm it',
    },
    insight: {
      budgetExceededTotal: 'You’re {amount} over this month’s budget.',
      budgetExceededCategory: 'You’re {amount} over your {name} budget.',
      budgetLowTotal: '{percent} of this month’s budget is left.',
      budgetLowCategory: '{percent} of your {name} budget is left.',
      concentration: '{name} is {percent} of your spending this month.',
      budgetsHint: 'Opens Budgets',
      reportsHint: 'Opens Reports',
    },
  },
  quickActions: {
    expense: 'Expense',
    recordExpense: 'Record an expense',
    income: 'Income',
    recordIncome: 'Record income',
    transfer: 'Transfer',
    transferBetween: 'Transfer between accounts',
  },
};
