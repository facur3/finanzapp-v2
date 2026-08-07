// Pure credit-card helpers. Keeping statement math outside the UI prevents
// visual screens, automations and imports from calculating installments in
// subtly different ways.

const amount = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function cardStatementTotal(card) {
  const installments = Array.isArray(card?.cuotas) ? card.cuotas : [];
  const purchases = Array.isArray(card?.compras) ? card.compras : [];
  return installments.reduce((sum, item) => sum + amount(item.monto), 0)
    + purchases.reduce((sum, item) => sum + amount(item.monto), 0);
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
  const next = {
    ...card,
    saldo: amount(card?.saldo) + total,
    compras: Array.isArray(card?.compras) ? [...card.compras] : [],
    cuotas: Array.isArray(card?.cuotas) ? [...card.cuotas] : [],
  };

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
    });
  } else {
    next.compras.unshift({ name: merchant, monto: total, date, dateISO });
  }
  return next;
}
