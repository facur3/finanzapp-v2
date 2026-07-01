// Account classification, balance sums and net-worth. Extracted verbatim from
// index.html. Pure: every function takes explicit state/balances (no `this`).
// Net worth = disponible (liquid) + invertido (invest) − deudas (cards + debt accounts).
//
// `state` shape used here: { order:[id], accounts:{id:{liquid,kind}}, archived:{id:bool},
//                            balances:{id:number}, cards:[{saldo}] }

export function liquidIds(state) {
  return state.order.filter((k) => state.accounts[k] && state.accounts[k].liquid && !state.archived[k]);
}

export function investIds(state) {
  return state.order.filter((k) => state.accounts[k] && state.accounts[k].kind === 'invest' && !state.archived[k]);
}

export function debtIds(state) {
  return state.order.filter((k) => state.accounts[k] && state.accounts[k].kind === 'debt' && !state.archived[k]);
}

export function sumIds(balances, ids) {
  return ids.reduce((a, k) => a + (balances[k] || 0), 0);
}

export function cardDebt(state) {
  return (state.cards || []).reduce((a, c) => a + c.saldo, 0);
}

export function netWorth(state) {
  const disp = sumIds(state.balances, liquidIds(state));
  const inv = sumIds(state.balances, investIds(state));
  const debt = cardDebt(state) + sumIds(state.balances, debtIds(state));
  return { disp: Math.round(disp), inv: Math.round(inv), pat: Math.round(disp + inv - debt) };
}
