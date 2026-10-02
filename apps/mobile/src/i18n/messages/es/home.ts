/** Inicio (the current month's financial field, the month's budgets that need attention (general and category, at most
 * two rows), the commitments due in the next 30 days, the month's latest movements) and the capture hub the dock's «+»
 * opens (Producto 24UX6A, decision 005). */
export const home = {
  home: {
    emptyTitle: 'Entendé tus gastos.',
    emptyDetail: 'Elegí una cuenta para agrupar tus movimientos. Podés empezar sin cargar tu saldo bancario.',
    start: 'Empezar',
    spending: 'Gastado',
    available: 'Disponible',
    availableHelp: 'Es el dinero registrado en tus cuentas de esta moneda: saldo inicial más ingresos, menos gastos y transferencias. '
      + 'No incluye tarjetas ni deudas, y no es un saldo bancario ni tu patrimonio.',
    spendingOutOfRange: 'El total supera el rango que podemos mostrar con precisión. Tus movimientos siguen guardados.',
    balanceOutOfRange: 'El saldo total supera el rango que podemos mostrar con precisión. Tus cuentas siguen guardadas.',
    /** 24T3 (A24): one quiet line under Gastado only while the month's net spending is below zero (devoluciones of earlier
     * purchases); the number itself stays the exact net. */
    refundsExceed: 'Las devoluciones superan lo gastado',
    /** The month's latest expenses and incomes. */
    recent: 'Actividad reciente',
    /** With accounts but nothing due and nothing recorded this month: the actions are the dock's «+» and the Assistant. */
    quietTitle: 'Todavía no hay movimientos este mes',
    /** The same, when one currency of several is shown alone («Solo USD»): the month may have movements in another. */
    quietTitleIn: 'Todavía no hay movimientos en {currency} este mes',
    /** Names the dock's «+» by what VoiceOver calls it (Registrar), with the glyph for sighted readers. */
    quietDetail: 'Registrá un gasto con el botón Registrar (+) o contáselo al Asistente.',
    /** 24UX6C2: only the commitments due from today through today + 30 days, both ends inclusive. */
    upcoming: 'Próximos compromisos',
    upcomingRow: {
      today: 'Hoy',
      tomorrow: 'Mañana',
      inDays: { one: 'En {count} día', other: 'En {count} días' },
      label: '{merchant}, {category}, {amount}, próximo pago {date}',
    },
    /** 24UX6C2: the month's general budget when it needs attention (85 % or more, `budgetState`); one compact row. 24UX6D:
     * a progress row: the name and the whole percent, a bar, one quiet line with what is left or by how much it is over;
     * since the 24UX6D refinement category budgets too, at most two rows in all. */
    budget: {
      /** The row's name: Inicio is already the month, so one word. */
      title: 'Presupuesto',
      /** When the budget's currency is not the one Inicio shows: «Presupuesto · USD». */
      titleIn: 'Presupuesto · {code}',
      /** A category budget's row is named by its category; with the currency named: «Supermercado · USD». */
      categoryIn: '{category} · {code}',
      /** «Quedan $ 89.000,00». */
      left: 'Quedan {amount}',
      /** Exactly at the limit (100 %): nothing left, not yet over. */
      reached: 'Límite alcanzado',
      /** «$ 120.000,00 por encima». */
      over: '{amount} por encima',
      /** VoiceOver's name for the row; the currency is named when the row codes it. */
      spokenName: 'Presupuesto del mes',
      spokenNameIn: 'Presupuesto del mes en {code}',
      /** VoiceOver's name for a category budget: «Presupuesto de Supermercado». */
      spokenCategory: 'Presupuesto de {category}',
      spokenCategoryIn: 'Presupuesto de {category} en {code}',
      /** VoiceOver, one sentence per state: «Presupuesto del mes, cerca del límite, 91 % usado, quedan 89000,00 pesos». */
      warningLabel: '{name}, cerca del límite, {percent} usado, quedan {amount}',
      reachedLabel: '{name}, límite alcanzado, {percent} usado',
      exceededLabel: '{name} superado, {percent} usado, {amount} por encima',
      hint: 'Abre Presupuestos',
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
