/** The entry form and the transfer form (plain transfers, card payments, debt payments and collections). */
export const forms = {
  entryForm: {
    editTitle: 'Editar movimiento',
    cardPurchaseTitle: 'Compra con tarjeta',
    expenseTitle: 'Registrar gasto',
    incomeTitle: 'Registrar ingreso',
    noAccountTitle: 'Primero, una cuenta',
    noAccountDetail: 'Cada movimiento necesita una cuenta para actualizar su saldo.',
    /** 24B6: the ledger has accounts, but none an income may use (cards only). */
    noCashAccountDetail: 'Un ingreso se registra en una cuenta normal, no en una tarjeta. Agregá una para continuar.',
    paidWith: 'Pagado con',
    receivedIn: 'Ingresa en',
    merchantExpense: 'Comercio o concepto',
    merchantIncome: 'Origen o concepto',
    merchantExpensePlaceholder: 'Ej. Supermercado',
    merchantIncomePlaceholder: 'Ej. Sueldo',
    /** A card's balance due is «saldo pendiente», never «deuda» (the Deudas y cobros section); a cash account shows its recorded balance. */
    cardDebt: 'Tarjeta de crédito · saldo pendiente {amount}',
    cardCredit: 'Tarjeta de crédito · a favor {amount}',
    cardClear: 'Tarjeta de crédito · sin saldo pendiente',
    recordedBalance: 'Saldo registrado {amount}',
    /** Second line of an option in the account sheet, as the selected card describes it: a card owes, is in credit or owes nothing; cash shows its signed balance. */
    optionDebt: 'saldo pendiente {amount}',
    optionCredit: 'a favor {amount}',
    optionClear: 'sin saldo pendiente',
    optionBalance: 'saldo {amount}',
    budgetExceeded: 'Presupuesto excedido por {amount}',
    budgetUsed: '{spent} de {total} este mes',
    /** 24T3 (A24): devoluciones net the category below zero this month: its whole limit is left, never a negative amount. */
    budgetRefunds: 'Quedan {total} este mes · las devoluciones superan lo gastado',
    cardNote: 'Cuenta como gasto una sola vez y suma al saldo pendiente de la tarjeta. El pago del resumen se registra desde Tarjetas.',
    correctionNote: 'Corregís el movimiento original. No se registra otro gasto o ingreso.',
    retryNote: 'Conservamos el envío para reintentar sin duplicarlo. Para cambiar los datos, cerrá y revisá primero Movimientos.',
    saveExpense: 'Guardar gasto',
    saveIncome: 'Guardar ingreso',
    futureDate: 'Elegí hoy o una fecha anterior. Los movimientos programados llegan en otra etapa.',
    saveUnverified: 'No pudimos verificar el guardado. Reintentá con este mismo movimiento.',
    notEditableTitle: 'Este movimiento no se puede editar',
    notEditableDetail: 'Volvé al detalle. Si está deshecho, primero podés recuperarlo.',
    /** Producto 24T2: the «Pago» section of a new purchase on an active credit card. «Una vez» is a purchase as before
     * (one expense); «En cuotas» saves one instalment plan and no expense: each instalment counts when its statement
     * closes. An instalment is «registrada», never «pagada»: a card payment is not assigned to any instalment. */
    plan: {
      payment: 'Pago',
      once: 'Una vez',
      installments: 'En cuotas',
      count: 'Cuotas',
      /** The last segment after 3, 6, 12 and 18: reveals the field for any other count. */
      countOther: 'Otra',
      countField: 'Cantidad de cuotas',
      countPlaceholder: 'De 2 a 120',
      countInvalid: 'Elegí entre 2 y 120 cuotas. Para un solo pago, elegí «Una vez».',
      /** What each instalment charges, from the exact schedule the plan is saved with: "12 cuotas de $ 100.000,00". */
      perInstallment: { one: '{count} cuota de {amount}', other: '{count} cuotas de {amount}' },
      /** A remainder makes the first instalments a few minor units larger: the largest one, said as approximate. */
      perInstallmentApprox: { one: '{count} cuota de aprox. {amount}', other: '{count} cuotas de aprox. {amount}' },
      /** The same line as VoiceOver reads it, with the word written out. */
      perInstallmentApproxSpoken: { one: '{count} cuota de aproximadamente {amount}', other: '{count} cuotas de aproximadamente {amount}' },
      /** Above two segments named by their closing dates: the statement the purchase belongs to, or the next one. */
      first: 'Primera cuota',
      /** The chosen statement: "Cierra el 28 oct y vence el 5 nov." (VoiceOver hears the dates written out). */
      statement: 'Cierra el {closing} y vence el {due}.',
      /** A purchase recorded on or after its statement's closing day: those instalments are recorded at once. «Llegó a su
       * cierre», not «cerró»: on its closing day a statement is still open, and a purchase that day belongs to it. */
      closed: { one: 'Ese resumen ya llegó a su cierre: la primera cuota se registra al guardar.', other: 'Esos resúmenes ya llegaron a su cierre: las primeras {count} cuotas se registran al guardar.' },
      /** Off is «Sin interés», with no financing field at all; on shows «Total financiado». */
      withInterest: 'Con interés',
      totalFinanced: 'Total financiado',
      /** Read only, under the field: the total financed minus the price. */
      interestTotal: 'Interés total: {amount}',
      totalMissing: 'Ingresá el total financiado o apagá «Con interés».',
      /** Replaces cardNote while «En cuotas» is chosen. */
      note: 'La compra no cuenta toda hoy: cada cuota cuenta como gasto cuando cierra su resumen y suma al saldo pendiente. Las cuotas futuras se ven en Tarjetas.',
      save: 'Guardar en cuotas',
      /** After a failed «Guardar en cuotas»: a plan records no movement until a statement closes, so Movimientos cannot show
       * whether it was saved; the card's Cuotas can, and Reintentar never saves it twice. */
      retryNote: 'Conservamos el envío: Reintentar nunca guarda la compra dos veces. Para cambiarla, cerrá y revisá primero las cuotas de la tarjeta en Tarjetas.',
    },
    /** Producto 24T2: the movement of an instalment is corrected in its merchant and category only; the plan owns the
     * amount, the date and the card. */
    installmentEdit: {
      title: 'Editar cuota',
      amount: 'Importe de la cuota',
      /** An instalment recorded as two movements (its principal and its interest): the part this movement holds. */
      amountShare: {
        principal: 'Principal de la cuota',
        interest: 'Interés de la cuota',
        fee: 'Comisión de la cuota',
        tax: 'Impuesto de la cuota',
      },
      note: 'El importe, la fecha y la tarjeta los define el plan de cuotas. Podés corregir el comercio y la categoría.',
    },
  },
  transferForm: {
    title: 'Entre mis cuentas',
    editTitle: 'Editar transferencia',
    overCardDebt: 'El pago supera el saldo pendiente de la tarjeta. Si pagaste de más, registrá primero el resumen real.',
    overObligation: 'El monto supera el saldo pendiente de esta obligación.',
    futureDate: 'Elegí hoy o una fecha anterior.',
    saveUnverified: 'No pudimos verificar el guardado. Reintentá este mismo envío.',
    /** An obligation's recorded figure with its currency code ("Saldo pendiente ARS 1.234,56" for a card, "Pendiente" for a debt); a cash account shows the code and the amount alone. */
    balanceDebt: 'Saldo pendiente {currency} {amount}',
    balanceCredit: 'A favor {currency} {amount}',
    balancePending: 'Pendiente {currency} {amount}',
    /** A card paid down to exactly zero, as the entry form and the card detail say it. */
    balanceClear: 'Sin saldo pendiente',
    recordPayment: 'Registrar pago',
    recordCollection: 'Registrar cobro',
    recordTransfer: 'Registrar transferencia',
    payTotal: 'Pagar total',
    settleTotal: 'Saldar total',
    collectTotal: 'Cobrar total',
    useAll: 'Usar todo',
    figureCredit: 'A favor',
    figureDebt: 'Saldo pendiente',
    figurePending: 'Pendiente',
    figureBalance: 'Saldo registrado',
    /** Caption of the amount shortcut: "Saldo registrado: ARS 1.234,56". */
    figure: '{label}: {currency} {amount}',
    needAccountOut: 'Necesitás una cuenta en {currency} desde donde sale el dinero.',
    needAccountIn: 'Necesitás una cuenta en {currency} donde entra el dinero.',
    needAccounts: 'Agregá las cuentas entre las que movés tu dinero.',
    payment: 'Pago',
    collection: 'Cobro',
    transfer: 'Transferencia',
    from: 'Desde',
    to: 'Hacia',
    missingTitle: 'Falta otra cuenta en esta moneda',
    missingDetail: 'Las transferencias son entre cuentas de la misma moneda, sin conversión.',
    note: 'Nota (opcional)',
    after: '{name} después',
    negativeWarning: 'Una cuenta quedará con saldo negativo. Revisá el importe y tus movimientos; podés registrarlo si refleja lo que realmente ocurrió.',
    explainCard: 'El pago baja el saldo pendiente de la tarjeta y el saldo de la cuenta. La compra original ya contó como gasto; esto no lo duplica.',
    explainDebt: 'Mueve saldo entre tu cuenta y la obligación. No es un gasto ni un ingreso.',
    explainTransfer: 'Solo registra un movimiento entre tus cuentas. No envía dinero al banco ni cuenta como gasto o ingreso.',
    retryNote: 'El envío quedó fijo para reintentar sin duplicarlo. Antes de cambiarlo, cerrá y revisá Movimientos.',
    notEditableTitle: 'No se puede editar',
    notEditableDetail: 'Esta transferencia no existe o fue deshecha. Volvé a su detalle para revisarla.',
  },
} as const;
