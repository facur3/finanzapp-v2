import type { Messages } from '../../messages.ts';

/** Categorías: the list, the category form and the icon/color picker. */
export const categoryManager: Pick<Messages, 'categoryManager'> = {
  categoryManager: {
    list: {
      intro: 'Tap a category to change its name, icon or color, or to archive it. Past transactions never change.',
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
      rowLabelArchived: '{name}, {usage}, archived',
      rowHint: 'Edits the name, icon and color',
    },
    notFound: {
      title: 'We couldn’t find this category',
      detail: 'Go back to Categories to choose one from the list.',
    },
    form: {
      name: 'Name',
      namePlaceholder: 'e.g. Snacks',
      archivedNote: 'Archived: not offered when recording; your past transactions keep it.',
      editNote: 'Changing the name, icon or color doesn’t modify any transaction, budget or recurring item.',
      renamedNote: 'Transactions are still recorded as “{stored}” and shown as “{shown}”.',
      availableExpense: 'It will be available right away when recording expenses.',
      availableIncome: 'It will be available right away when recording income.',
      retryNote: 'Retry the same save. To change it, close and check the list first.',
      create: 'Create category',
      archive: 'Archive category',
      unarchive: 'Unarchive category',
      nameTaken: 'A category with that name already exists. Edit it from the list or choose another name.',
      checkName: 'Check the name.',
      saveUnverified: 'We couldn’t confirm the save. Retry the same change.',
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
      food: 'Food', groceries: 'Groceries', restaurant: 'Restaurants', cafe: 'Coffee', drinks: 'Drinks', transport: 'Transport',
      fuel: 'Fuel', plane: 'Travel', home: 'Home', rent: 'Rent', utilities: 'Utilities', internet: 'Internet', phone: 'Phone',
      subscriptions: 'Subscriptions', health: 'Health', pharmacy: 'Pharmacy', fitness: 'Sports', beauty: 'Beauty', education: 'Education',
      clothing: 'Clothing', tech: 'Technology', leisure: 'Leisure', music: 'Music', games: 'Games', pets: 'Pets', gifts: 'Gifts',
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
