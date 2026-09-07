// Pure credit-card helpers. Keeping statement math outside the UI prevents
// visual screens, automations and imports from calculating installments in
// subtly different ways.

const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function cardStatementGross(card) {
  const installments = Array.isArray(card?.cuotas) ? card.cuotas : [];
  const purchases = Array.isArray(card?.compras) ? card.compras : [];
  const itemized = installments.reduce((sum, item) => sum + amount(item.monto), 0)
    + purchases.reduce((sum, item) => sum + amount(item.monto), 0);
  // A reconciliation adjustment lets the user match a real bank statement
  // without fabricating a purchase. It may be negative for refunds/credits and
  // belongs only to the currently open cycle.
  return Math.max(0, itemized + amount(card?.statementAdjustment));
}

export function cardStatementTotal(card) {
  // Payments made before the statement is fully settled remain attached to the
  // open cycle. Without this credit, a partial payment reduced total debt but
  // the UI continued showing the original statement as fully due.
  return Math.max(0, cardStatementGross(card) - Math.max(0, amount(card?.statementPaid)));
}

export function cardPendingTotal(card) {
  const pending = Array.isArray(card?.pendientes) ? card.pendientes : [];
  const itemized = pending.reduce((sum, item) => sum + amount(item?.monto ?? item?.amount), 0);
  // Banks often show pending activity separately from posted movements. A
  // reconciliation adjustment represents that bank total without inventing
  // merchant rows, just like `statementAdjustment` does for the statement.
  return Math.max(0, itemized + amount(card?.pendingAdjustment));
}

export function cardInstallmentsRemaining(card) {
  const installments = Array.isArray(card?.cuotas) ? card.cuotas : [];
  return installments.reduce((sum, item) => {
    const current = Math.max(1, Number(item.cur) || 1);
    const total = Math.max(current, Number(item.tot) || current);
    return sum + amount(item.monto) * (total - current + 1);
  }, 0);
}

export function addCardPurchase(card, purchase) {
  const total = Math.max(0, amount(purchase?.amount));
  const installments = Math.max(1, Math.round(amount(purchase?.installments) || 1));
  const merchant = String(purchase?.merchant || 'Compra').trim() || 'Compra';
  const dateISO = String(purchase?.dateISO || '');
  const date = String(purchase?.date || '');
  const txnId = purchase?.txnId == null ? null : purchase.txnId;
  const pending = purchase?.status === 'pending';
  const next = {
    ...card,
    saldo: amount(card?.saldo) + total,
    compras: Array.isArray(card?.compras) ? [...card.compras] : [],
    cuotas: Array.isArray(card?.cuotas) ? [...card.cuotas] : [],
    pendientes: Array.isArray(card?.pendientes) ? [...card.pendientes] : [],
    statementPaid: Math.max(0, amount(card?.statementPaid)),
    statementAdjustment: amount(card?.statementAdjustment),
    pendingAdjustment: amount(card?.pendingAdjustment),
  };

  if (pending) {
    next.pendientes.unshift({
      name: merchant,
      monto: total,
      installments,
      date,
      dateISO,
      txnId,
    });
    return next;
  }

  if (installments > 1) {
    // An installment purchase contributes only its current installment to the
    // statement. `saldo` still stores the complete outstanding card debt.
    next.cuotas.unshift({
      name: merchant,
      cur: 1,
      tot: installments,
      monto: total / installments,
      date,
      dateISO,
      txnId,
    });
  } else {
    next.compras.unshift({ name: merchant, monto: total, date, dateISO, txnId });
  }
  return next;
}

export function postPendingCardPurchase(card, transactionId) {
  if (!card) return { card, posted: false };
  const pending = Array.isArray(card.pendientes) ? [...card.pendientes] : [];
  const index = pending.findIndex(row => row && row.txnId != null && String(row.txnId) === String(transactionId));
  if (index < 0) return { card, posted: false };
  const [row] = pending.splice(index, 1);
  const installments = Math.max(1, Math.round(amount(row.installments) || 1));
  const base = {
    ...card,
    pendientes: pending,
    compras: Array.isArray(card.compras) ? [...card.compras] : [],
    cuotas: Array.isArray(card.cuotas) ? [...card.cuotas] : [],
  };
  const postedRow = {
    name: String(row.name || 'Compra'),
    date: String(row.date || ''),
    dateISO: String(row.dateISO || ''),
    txnId: row.txnId,
  };
  if (installments > 1) {
    base.cuotas.unshift({ ...postedRow, cur: 1, tot: installments, monto: amount(row.monto) / installments });
  } else {
    base.compras.unshift({ ...postedRow, monto: amount(row.monto) });
  }
  // `saldo` already included the purchase while it was pending. Posting only
  // changes its bank status and must never add the debt a second time.
  return { card: base, posted: true };
}

export function removeCardPurchase(card, transaction) {
  if (!card || !transaction) return { card, removed: false };
  const txnId = transaction.id;
  const merchant = String(transaction.merchant || '').replace(/\s*·\s*cuota\s+\d+\/\d+\s*$/i, '').trim();
  const dateISO = String(transaction.dateISO || '');
  const removeOne = rows => {
    const list = Array.isArray(rows) ? [...rows] : [];
    let index = list.findIndex(row => row && row.txnId != null && String(row.txnId) === String(txnId));
    if (index < 0) index = list.findIndex(row => row && String(row.name || '').trim() === merchant && (!dateISO || !row.dateISO || row.dateISO === dateISO));
    if (index < 0) return { list, removed: false };
    list.splice(index, 1);
    return { list, removed: true };
  };
  const purchases = removeOne(card.compras);
  const installments = purchases.removed ? { list: Array.isArray(card.cuotas) ? [...card.cuotas] : [], removed: false } : removeOne(card.cuotas);
  const pending = purchases.removed || installments.removed
    ? { list: Array.isArray(card.pendientes) ? [...card.pendientes] : [], removed: false }
    : removeOne(card.pendientes);
  const removed = purchases.removed || installments.removed || pending.removed;
  if (!removed) return { card, removed: false };
  return {
    removed: true,
    card: {
      ...card,
      saldo: Math.max(0, amount(card.saldo) - Math.abs(amount(transaction.val || transaction.amount))),
      compras: purchases.list,
      cuotas: installments.list,
      pendientes: pending.list,
      statementPaid: Math.max(0, amount(card.statementPaid)),
      statementAdjustment: amount(card.statementAdjustment),
      pendingAdjustment: amount(card.pendingAdjustment),
    },
  };
}
