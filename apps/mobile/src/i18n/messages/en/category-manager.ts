import type { Messages } from '../../messages.ts';

/** Categorías: the list, the category form and the icon/color picker. */
export const categoryManager: Pick<Messages, 'categoryManager'> = {
  categoryManager: {
    list: {
      expenses: 'Expenses',
      incomes: 'Income',
      archived: 'Archived',
      archivedCaption: 'Not offered when recording; transactions that use them stay the same.',
      source: {
        preset: 'Built-in',
        presetEdited: 'Built-in · edited',
        custom: 'Custom',
        historical: 'From history',
      },
      rowLabel: '{name}, {usage}',
      rowLabelArchived: '{name}, {kind}, {usage}, archived',
      rowHint: 'Edits the name, icon and color',
      rowHintArchived: 'Edits the name, icon and color, or unarchives it',
    },
    notFound: {
      title: 'Category not found',
      detail: 'Go back to Categories to choose one from the list.',
    },
    form: {
      name: 'Name',
      namePlaceholder: 'e.g. Snacks',
      archivedTitle: 'Archived',
      archivedDetail: 'Not offered when recording. Your transactions, budgets and recurring items keep it; unarchive it to offer it again.',
      renamedNote: 'Transactions are still recorded as “{stored}” and shown as “{shown}”.',
      availableExpense: 'It will be available right away when recording expenses.',
      availableIncome: 'It will be available right away when recording income.',
      create: 'Save category',
      archive: 'Archive category',
      unarchive: 'Unarchive category',
      nameTaken: 'A category with that name already exists. Edit it from the list or choose another name.',
      checkName: 'Check the name.',
      saveUnverified: 'Couldn’t confirm the save.',
      archiveTitle: 'Archive category?',
      unarchiveTitle: 'Unarchive category?',
      archiveMessage: '“{name}” will no longer be offered when recording. Your past transactions, budgets and recurring items keep it as is.',
      unarchiveMessage: '“{name}” will be offered again when recording transactions.',
      archiveConfirm: 'Archive',
      unarchiveConfirm: 'Unarchive',
    },
    picker: {
      preview: 'Preview: {icon} in {color}',
      unnamed: 'No name',
      icon: 'Icon',
      color: 'Color',
    },
    icons: {
      food: 'Food', groceries: 'Groceries', restaurant: 'Restaurants', cafe: 'Coffee', drinks: 'Drinks', transport: 'Transportation',
      fuel: 'Fuel', plane: 'Travel', home: 'Home', rent: 'Rent', utilities: 'Utilities', internet: 'Internet', phone: 'Phone',
      subscriptions: 'Subscriptions', health: 'Health', pharmacy: 'Pharmacy', fitness: 'Sports', beauty: 'Beauty', education: 'Education',
      clothing: 'Clothing', tech: 'Technology', leisure: 'Entertainment', music: 'Music', games: 'Games', pets: 'Pets', gifts: 'Gifts',
      family: 'Family', taxes: 'Taxes', insurance: 'Insurance', bank: 'Bank', work: 'Work', sales: 'Sales', investment: 'Investments',
      refund: 'Refunds', loan: 'Loans', repairs: 'Repairs', other: 'Other',
    },
    accountIcons: {
      wallet: 'Wallet', cash: 'Cash', bank: 'Bank', digital: 'Digital wallet', card: 'Prepaid card', savings: 'Savings',
      investment: 'Investment', business: 'Business', safe: 'Safe', foreign: 'Abroad', home: 'Home', shared: 'Shared',
    },
    colors: {
      cobalt: 'Cobalt', azure: 'Sky blue', teal: 'Teal', green: 'Green', olive: 'Olive', ochre: 'Ochre', terracotta: 'Terracotta',
      rose: 'Rose', indigo: 'Indigo', slate: 'Slate', graphite: 'Graphite',
    },
  },
};
