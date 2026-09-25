/** Inicio: the hero, the budget card, upcoming commitments, the category ranking and the quick actions. */
export const home = {
  home: {
    emptyTitle: 'Entendé tus gastos.',
    emptyDetail: 'Elegí una cuenta para agrupar tus movimientos. Podés empezar sin cargar tu saldo bancario.',
    start: 'Empezar',
    spending: 'Gastos',
    available: 'Disponible',
    recordedBalance: 'Saldo registrado',
    availableHelp: 'Es el dinero registrado en tus cuentas de esta moneda: saldo inicial más ingresos, menos gastos y transferencias. '
      + 'No incluye tarjetas ni deudas, y no es un saldo bancario ni tu patrimonio.',
    spendingOutOfRange: 'El total supera el rango que podemos mostrar con precisión. Tus movimientos siguen guardados.',
    balanceOutOfRange: 'El saldo total supera el rango que podemos mostrar con precisión. Tus cuentas siguen guardadas.',
    accounts: { one: '{count} cuenta', other: '{count} cuentas' },
    monthBudget: 'Presupuesto del mes',
    whereSpent: 'En qué gastaste',
    reports: 'Reportes',
    categoriesEmpty: 'Tus categorías aparecerán cuando registres un gasto este mes.',
    categoriesInActivity: 'El desglose está disponible en tus movimientos.',
    upcoming: 'Próximos compromisos',
    recent: 'Últimos movimientos',
    recentEmpty: 'Todavía no hay movimientos este mes.',
    /** 24UX2: the one empty sentence of a month when more than one currency is held: "Todavía no hay movimientos en USD este mes." */
    recentEmptyIn: 'Todavía no hay movimientos en {currency} este mes.',
    /** A category row of "En qué gastaste": "Comida, 1.234,56 ARS, 30 % del gasto del mes". */
    rankingLabel: '{name}, {amount}, {share} del gasto del mes',
    rankingHint: 'Abre los movimientos de esta categoría este mes',
    budget: {
      general: 'Presupuesto general',
      exceeded: 'excedido',
      left: 'te queda',
      /** "de $ 100.000,00 · 42 %": the ceiling and the share used. */
      of: 'de {amount} · {percent} %',
      categories: { one: '{count} categoría', other: '{count} categorías' },
      exceededCount: { one: '{count} excedida', other: '{count} excedidas' },
      perCategory: 'Límite por categoría',
      labelLeft: '{title}: quedan {amount} de {total}, {percent} por ciento usado.',
      labelExceeded: '{title}: excedido en {amount} de {total}, {percent} por ciento usado.',
    },
    upcomingRow: {
      today: 'Hoy',
      tomorrow: 'Mañana',
      inDays: { one: 'En {count} día', other: 'En {count} días' },
      label: '{merchant}, {category}, {amount}, próximo pago {date}',
    },
  },
  /** Budget sentences shared by Inicio and Presupuestos. */
  budgetStatus: {
    inOrder: { one: '{count} categoría en orden', other: '{count} categorías en orden' },
    exceeded: { one: '{count} categoría excedida', other: '{count} categorías excedidas' },
  },
  quickActions: {
    /** Inicio's wide Assistant entry under the three movements (24UX3): a button, never a placeholder. */
    askAssistant: 'Contale al Asistente',
    askAssistantHint: 'Abre el Asistente para registrar un movimiento o preguntar por tus gastos',
    expense: 'Gasto',
    recordExpense: 'Registrar gasto',
    income: 'Ingreso',
    recordIncome: 'Registrar ingreso',
    transfer: 'Transferir',
    transferBetween: 'Transferir entre cuentas',
  },
} as const;
