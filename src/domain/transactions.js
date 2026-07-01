// Core money mutations: applying / reversing a transaction against the running
// balances (b), category totals (ct), monthIncome (mi) and monthExpense (me).
// Extracted verbatim from index.html `_apply` / `_rev`. Pure & immutable in b/ct
// (returns fresh copies); mi/me are plain numbers. Behaviour MUST stay identical.
//
// Transaction shape (relevant fields): { type, account, from, to, cat, amount, val }
//  - type 'gasto'   : expense  (amount negative, val = |amount|)
//  - type 'ingreso' : income
//  - anything else  : transfer/investment (moves from -> to, no cat/mi/me impact)

export function reverseTxn(t, b, ct, mi, me) {
  b = { ...b };
  ct = { ...ct };
  if (t.type === 'gasto') {
    if (t.account) b[t.account] = (b[t.account] || 0) - t.amount;
    ct[t.cat] = Math.max(0, (ct[t.cat] || 0) - t.val);
    me -= t.val;
  } else if (t.type === 'ingreso') {
    if (t.account) b[t.account] = (b[t.account] || 0) - t.amount;
    mi -= t.val;
  } else {
    if (t.from) b[t.from] = (b[t.from] || 0) + t.val;
    if (t.to) b[t.to] = (b[t.to] || 0) - t.val;
  }
  return { b, ct, mi, me };
}

export function applyTxn(t, b, ct, mi, me) {
  b = { ...b };
  ct = { ...ct };
  if (t.type === 'gasto') {
    if (t.account) b[t.account] = (b[t.account] || 0) + t.amount;
    ct[t.cat] = (ct[t.cat] || 0) + t.val;
    me += t.val;
  } else if (t.type === 'ingreso') {
    if (t.account) b[t.account] = (b[t.account] || 0) + t.amount;
    mi += t.val;
  } else {
    if (t.from) b[t.from] = (b[t.from] || 0) - t.val;
    if (t.to) b[t.to] = (b[t.to] || 0) + t.val;
  }
  return { b, ct, mi, me };
}
