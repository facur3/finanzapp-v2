import type { Messages } from '../../messages.ts';

/** Inicio (the current month's financial field, the commitments due this week, the month's latest movements) and the
 * capture hub the dock's «+» opens (Producto 24UX6A, decision 005). */
export const home: Pick<Messages, 'home' | 'quickActions'> = {
  home: {
    emptyTitle: 'Understand your spending.',
    emptyDetail: 'Choose an account to group your transactions. You can start without entering your bank balance.',
    start: 'Get started',
    spending: 'Spent',
    available: 'Available',
    recordedBalance: 'Recorded balance',
    availableHelp: 'The money recorded in your accounts in this currency: opening balance plus income, minus expenses and transfers. '
      + 'It excludes cards and debts, and it is not a bank balance or your net worth.',
    spendingOutOfRange: 'The total is beyond the range we can show precisely. Your transactions are still saved.',
    balanceOutOfRange: 'The total balance is beyond the range we can show precisely. Your accounts are still saved.',
    accounts: { one: '{count} account', other: '{count} accounts' },
    perDay: 'So far · {amount} a day',
    noSpending: 'No spending this month',
    availableLine: '{label} · {accounts}',
    recent: 'Recent activity',
    quietTitle: 'No transactions this month yet',
    quietTitleIn: 'No transactions in {currency} this month yet',
    quietDetail: 'Record an expense with the Record (+) button, or tell the Assistant.',
    upcoming: 'Coming up',
    upcomingRow: {
      today: 'Today',
      tomorrow: 'Tomorrow',
      inDays: { one: 'In {count} day', other: 'In {count} days' },
      label: '{merchant}, {category}, {amount}, next payment {date}',
    },
    capture: {
      label: 'Record',
      hint: 'Shows the ways to record',
      title: 'Record',
      close: 'Close',
      assistant: 'Assistant',
      assistantDetail: 'Say it in your own words or ask anything',
      continue: 'Continue: “{text}”',
      expense: 'Expense',
      expenseDetail: 'A purchase or a payment',
      income: 'Income',
      incomeDetail: 'Salary, a payment received or other income',
      transfer: 'Transfer',
      transferDetail: 'Between accounts or a card payment',
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
