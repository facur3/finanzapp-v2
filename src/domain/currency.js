export function normalizeCurrency(value) {
  return String(value || '').toUpperCase() === 'USD' ? 'USD' : 'ARS';
}

export function convertCurrency(amount, from, to, usdRate) {
  const value = Number(amount) || 0;
  const source = normalizeCurrency(from);
  const target = normalizeCurrency(to);
  if (source === target) return value;
  const rate = Number(usdRate) || 0;
  // Preserve the visible value until the first quote arrives instead of hiding
  // a whole account. Once a rate is available all totals are canonical ARS.
  if (rate <= 0) return value;
  return source === 'USD' ? value * rate : value / rate;
}

export function accountBalanceARS(accountId, balances, accounts, usdRate, assets = {}) {
  const account = (accounts || {})[accountId] || {};
  const balance = Number((balances || {})[accountId]) || 0;
  // Asset prices and FCI VCP values are stored in ARS, regardless of the display
  // currency selected when an investment account was created.
  if (account.kind === 'invest' && Array.isArray((assets || {})[accountId]) && assets[accountId].length) return balance;
  return convertCurrency(balance, account.currency, 'ARS', usdRate);
}

export function sumAccountsARS(ids, balances, accounts, usdRate, assets = {}) {
  return (ids || []).reduce((total, id) => total + accountBalanceARS(id, balances, accounts, usdRate, assets), 0);
}

export function transactionCurrency(transaction, accounts) {
  if (transaction && transaction.currency) return normalizeCurrency(transaction.currency);
  const accountId = transaction && (transaction.account || transaction.from);
  return normalizeCurrency(accountId && accounts && accounts[accountId] && accounts[accountId].currency);
}

export function transactionAmountARS(transaction, accounts, usdRate) {
  return convertCurrency(transaction && transaction.amount, transactionCurrency(transaction, accounts), 'ARS', usdRate);
}
