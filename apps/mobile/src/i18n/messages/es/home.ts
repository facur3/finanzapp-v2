/** Inicio (the current month's financial field, the commitments due this week, the month's latest movements) and the
 * capture hub the dock's «+» opens (Producto 24UX6A, decision 005). */
export const home = {
  home: {
    emptyTitle: 'Entendé tus gastos.',
    emptyDetail: 'Elegí una cuenta para agrupar tus movimientos. Podés empezar sin cargar tu saldo bancario.',
    start: 'Empezar',
    spending: 'Gastado',
    available: 'Disponible',
    recordedBalance: 'Saldo registrado',
    availableHelp: 'Es el dinero registrado en tus cuentas de esta moneda: saldo inicial más ingresos, menos gastos y transferencias. '
      + 'No incluye tarjetas ni deudas, y no es un saldo bancario ni tu patrimonio.',
    spendingOutOfRange: 'El total supera el rango que podemos mostrar con precisión. Tus movimientos siguen guardados.',
    balanceOutOfRange: 'El saldo total supera el rango que podemos mostrar con precisión. Tus cuentas siguen guardadas.',
    accounts: { one: '{count} cuenta', other: '{count} cuentas' },
    /** Under Gastado: the month so far and its daily average (the same figure as Reportes). */
    perDay: 'Hasta hoy · {amount} por día',
    /** Under Gastado when nothing was spent this month yet. */
    noSpending: 'Sin gastos este mes',
    /** Under Disponible: what the number is and how many accounts it covers («Saldo registrado · 2 cuentas»). Never a per-day figure. */
    availableLine: '{label} · {accounts}',
    /** The month's latest expenses and incomes. */
    recent: 'Actividad reciente',
    /** With accounts but nothing due and nothing recorded this month: the actions are the dock's «+» and the Assistant. */
    quietTitle: 'Todavía no hay movimientos este mes',
    /** The same, when one currency of several is shown alone («Solo USD»): the month may have movements in another. */
    quietTitleIn: 'Todavía no hay movimientos en {currency} este mes',
    /** Names the dock's «+» by what VoiceOver calls it (Registrar), with the glyph for sighted readers. */
    quietDetail: 'Registrá un gasto con el botón Registrar (+) o contáselo al Asistente.',
    /** 24UX6A: only the commitments due in the next seven days. */
    upcoming: 'Próximos compromisos',
    upcomingRow: {
      today: 'Hoy',
      tomorrow: 'Mañana',
      inDays: { one: 'En {count} día', other: 'En {count} días' },
      label: '{merchant}, {category}, {amount}, próximo pago {date}',
    },
    /** 24UX6A (decision 005): the dock's «+» and the capture hub it opens. The Assistant proposes; the person confirms. */
    capture: {
      /** The «+» for VoiceOver: an action, never a tab. */
      label: 'Registrar',
      hint: 'Abre las opciones para registrar',
      /** The hub's small caps title. */
      title: 'Registrar',
      close: 'Cerrar',
      assistant: 'Asistente',
      assistantDetail: 'Decilo con tus palabras o preguntá lo que quieras',
      /** Only when this app session already has a conversation: the person's last words, as they wrote them. */
      continue: 'Continuar: «{text}»',
      expense: 'Gasto',
      expenseDetail: 'Una compra o un pago',
      income: 'Ingreso',
      incomeDetail: 'Sueldo, cobro u otro ingreso',
      transfer: 'Transferencia',
      transferDetail: 'Entre cuentas o pago de tarjeta',
    },
  },
  quickActions: {
    expense: 'Gasto',
    recordExpense: 'Registrar gasto',
    income: 'Ingreso',
    recordIncome: 'Registrar ingreso',
    transfer: 'Transferir',
    transferBetween: 'Transferir entre cuentas',
  },
} as const;
