/** Movimientos: the list, the rows, and the movement, transfer and spending-period details. */
export const activity = {
  activity: {
    search: 'Buscar movimientos',
    searchPlaceholder: 'Comercio, categoría o cuenta',
    all: 'Todos',
    expenses: 'Gastos',
    incomes: 'Ingresos',
    transfers: 'Transf.',
    noMatchesTitle: 'Sin coincidencias',
    noMatchesDetail: 'Probá con otro concepto, categoría o cuenta.',
    clearFilters: 'Limpiar filtros',
    emptyTitle: 'Tu actividad, en un lugar',
    emptyDetail: 'Tus gastos, ingresos y transferencias se ordenan acá por fecha.',
    /** VoiceOver for a day's net beside its header: "Neto del día 1.234,56 ARS". */
    dayNet: 'Neto del día {amount}',
    dayNetNegative: 'Neto del día menos {amount}',
    undoneHeader: 'Estos movimientos no cuentan en tus saldos ni reportes. Abrí uno para recuperarlo.',
    undoneEmptyTitle: 'Nada para recuperar',
    undoneEmptyDetail: 'Los movimientos que deshagas quedarán acá. No se eliminan definitivamente.',
  },
  rows: {
    accountLabel: 'Ver cuenta {name}, saldo {amount}',
    cardPayment: 'Pago de tarjeta',
    transfer: 'Transferencia',
    payment: 'Pago',
    collection: 'Cobro',
    fromAccount: 'desde {name}',
    toAccount: 'hacia {name}',
    transferLabel: '{title}, de {from} a {to}, {amount}, {date}',
  },
  entryDetail: {
    notFoundTitle: 'No encontramos este movimiento',
    notFoundDetail: 'Volvé a Movimientos para consultar lo que guardaste en este dispositivo.',
    changeUnverified: 'No pudimos verificar el cambio. Podés reintentarlo sin duplicar su efecto.',
    restoreQuestion: '¿Recuperar movimiento?',
    voidQuestion: '¿Deshacer movimiento?',
    willAdd: 'Se sumarán {amount} a {account}.',
    willSubtract: 'Se descontarán {amount} de {account}.',
    /** 25Q4: how a card reads after an undo or a restore, in the card's words (never «deuda»); the transfer detail uses them too. */
    cardAfterDebt: '{account} quedará con un saldo pendiente de {amount}.',
    cardAfterCredit: '{account} quedará con {amount} a favor.',
    cardAfterClear: '{account} quedará sin saldo pendiente.',
    /** 25Q4 review: these name the movement, so after a card's sentence they never read as the card stopping or coming back. */
    restoreEffect: 'Este movimiento volverá a contar en tus saldos y reportes.',
    voidEffect: 'Este movimiento dejará de contar en tus saldos y reportes. Podés recuperarlo después desde Movimientos deshechos, en Más.',
    restore: 'Recuperar',
    void: 'Deshacer',
    statusVoided: 'Deshecho · no cuenta en saldos ni reportes',
    statusCorrected: 'Registrado · corregido',
    statusRecorded: 'Registrado',
    /** 24UX2: the row that opens the recurring rule that recorded this movement. */
    recurring: 'Recurrente',
    voidedTitle: 'Movimiento deshecho',
    card: 'Tarjeta',
    budget: 'Presupuesto',
    budgetExceeded: 'Excedido por {amount}',
    budgetUsed: '{percent} % usado · quedan {amount}',
    /** 24T3 (A24): devoluciones net the category below zero: what is left is the whole limit, never more. */
    budgetRefunds: 'Quedan {amount} · las devoluciones superan lo gastado',
    edit: 'Editar movimiento',
    restoreAction: 'Recuperar movimiento',
    voidAction: 'Deshacer movimiento',
    /** 24T3 (A13): an undo the domain refuses (a devolución or an adelanto uses this instalment), said before any confirmation with the reason. */
    voidBlockedTitle: 'No se puede deshacer ahora',
    viewRefund: 'Ver devolución',
    viewPayoff: 'Ver adelanto',
    /** 24T2: a movement an instalment plan recorded: its title, and the row that opens its plan ("3 de 12"). */
    installmentTitle: 'Cuota de tarjeta',
    installment: 'Cuota',
    installmentOf: '{number} de {count}',
    /** A financing share of the instalment, recorded as its own movement in its own category. */
    installmentShare: {
      interest: '{number} de {count} · interés',
      fee: '{number} de {count} · comisión',
      tax: '{number} de {count} · impuesto',
    },
    /** The title of a financing share's movement (its principal is «Cuota de tarjeta»). */
    installmentShareTitle: {
      interest: 'Interés de cuota',
      fee: 'Comisión de cuota',
      tax: 'Impuesto de cuota',
    },
    /** Appended to the undo confirmation of an instalment. */
    installmentVoidNote: 'La cuota queda deshecha: no se vuelve a registrar sola y sigue pendiente en su plan.',
    /** The same, for one share of an instalment that has another (its principal, or its interest): the other stays as it is. */
    installmentShareVoidNote: 'Solo esta parte de la cuota queda deshecha: no se vuelve a registrar sola y sigue pendiente en su plan. La otra parte de la cuota no cambia.',
  },
  transferDetail: {
    notFoundTitle: 'No encontramos esta transferencia',
    notFoundDetail: 'Volvé a Movimientos para consultar tus registros.',
    cardPayment: 'Pago de tarjeta',
    debtPayment: 'Pago de deuda',
    collection: 'Cobro',
    transfer: 'Transferencia',
    changeUnverified: 'No pudimos verificar el cambio. Reintentá sin duplicarlo.',
    restoreQuestion: '¿Recuperar transferencia?',
    voidQuestion: '¿Deshacer transferencia?',
    /** A transfer between two cash accounts (or an older shape between two obligations); a payment or a collection says each side in its own words. */
    effect: '{amount}: se descontarán de {from} y se sumarán a {to}.',
    /** 25Q4: how a debt reads after an undo or a restore. «Deuda» is only what the person owes (25Q4 review: a receivable is «lo que te debe»). */
    debtAfterOwed: 'Le vas a deber {amount} a {name}.',
    debtAfterReceivable: '{name} te va a deber {amount}.',
    debtAfterSettled: 'La deuda con {name} quedará saldada.',
    debtAfterReceivableSettled: 'Lo que te debe {name} quedará saldado.',
    /** Ends every transfer undo or restore. */
    recordOnly: 'Solo cambia el registro en esta app, no mueve dinero en el banco.',
    /** An undo only. 25Q4 review: it names the transfer, so it never reads as the card or debt named before it. */
    voidRecovery: 'Podés recuperar la transferencia después desde Movimientos deshechos, en Más.',
    /** 25Q4: a restored debt payment or collection may settle at most what is pending now; said before any confirmation, in
     * the debt screens' words. */
    restoreBlockedTitle: 'No se puede recuperar ahora',
    restoreOverPayment: 'Este pago es mayor que lo que todavía le debés a {name} ({amount}). Recuperarlo pagaría de más.',
    restoreOverCollection: 'Este cobro es mayor que lo que {name} todavía te debe ({amount}). Recuperarlo cobraría de más.',
    viewDebt: 'Ver deuda',
    statusVoided: 'Deshecha · no afecta los saldos',
    statusBetween: 'Entre tus cuentas · no es gasto ni ingreso',
    /** Status of a card payment, a debt payment and a collection: the balance moves either way (a collection brings it into the account). */
    statusObligation: 'Mueve saldo entre tu cuenta y la obligación · no es gasto ni ingreso',
    voidedTitle: 'Transferencia deshecha',
    note: 'Nota',
    edit: 'Editar transferencia',
    restoreAction: 'Recuperar transferencia',
    voidAction: 'Deshacer transferencia',
  },
  spendingDetail: {
    invalidTitle: 'Período no válido',
    invalidDetail: 'El enlace no indica un período que se pueda mostrar. Abrí Reportes para ver tus gastos por mes.',
    allExpenses: 'Gastos registrados',
    totalUnavailable: 'No podemos mostrar este total con precisión.',
    count: { one: '{count} gasto registrado', other: '{count} gastos registrados' },
    movements: 'Movimientos',
    none: 'No hay gastos registrados para estas fechas y moneda.',
  },
} as const;
