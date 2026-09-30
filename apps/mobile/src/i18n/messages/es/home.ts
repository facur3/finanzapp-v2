/** Inicio: the number, its controls, the capture sheet, the commitments due this week and the one contextual line. */
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
    /** 24UX6A: only the commitments due in the next seven days. */
    upcoming: 'Próximos compromisos',
    upcomingRow: {
      today: 'Hoy',
      tomorrow: 'Mañana',
      inDays: { one: 'En {count} día', other: 'En {count} días' },
      label: '{merchant}, {category}, {amount}, próximo pago {date}',
    },
    /** 24UX6A: the one way to record on Inicio: a capsule that opens the four choices in a compact sheet. */
    capture: {
      button: 'Registrar',
      label: 'Registrar un movimiento',
      hint: 'Abre las formas de registrar: un gasto, un ingreso, una transferencia o el Asistente',
      title: 'Registrar',
      expense: 'Registrar gasto',
      income: 'Registrar ingreso',
      transfer: 'Transferir entre cuentas',
      assistant: 'Hablar con el Asistente',
      /** The Assistant proposes; the person confirms (never an automatic write). */
      assistantDetail: 'Contale qué pasó: te propone el movimiento y vos lo confirmás',
    },
    /** 24UX6A: the one computed line under the commitments; facts only, never a cause or advice. */
    insight: {
      /** {amount} is what the spending went over the limit, as money: «por $ 12.000,00». */
      budgetExceededTotal: 'Superaste tu presupuesto del mes por {amount}.',
      budgetExceededCategory: 'Superaste tu presupuesto de {name} por {amount}.',
      budgetLowTotal: 'Te queda {percent} de tu presupuesto del mes.',
      budgetLowCategory: 'Te queda {percent} de tu presupuesto de {name}.',
      /** {name} is a category label and {percent} its share of the month: «Comida concentra 46 % de tus gastos de este mes». */
      concentration: '{name} concentra {percent} de tus gastos de este mes.',
      budgetsHint: 'Abre Presupuestos',
      reportsHint: 'Abre Reportes',
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
