/** Deudas y cobros: the list, the debt detail and the debt form. */
export const debts = {
  debts: {
    /** How a debt's hidden account is named wherever it appears as one side of a transfer ("Caja → Debo · Juan"). The name is the person's own text. */
    accountName: {
      owedByMe: 'Debo · {name}',
      owedToMe: 'Me deben · {name}',
    },
    list: {
      title: 'Deudas y cobros',
      add: 'Agregar deuda',
      emptyTitle: 'Lo que debés y lo que te deben',
      emptyDetail: 'Registrá un préstamo, una deuda con alguien o un monto que te deben. Cada pago o cobro parcial baja el saldo pendiente sin crear gastos ni ingresos falsos.',
      /** Section and total label: what I owe. */
      owed: 'Debo',
      /** Section and total label: what others owe me. */
      receivable: 'Me deben',
      /** Shown instead of one currency's totals when their sum leaves the exact range (never rounded or hidden). */
      outOfRange: 'Total fuera de rango',
      /** 24UX4: debts closed by the person (settled, forgiven or no longer followed); they can be reopened or deleted. */
      closed: 'Cerradas',
      closedCaption: 'No cuentan como pendientes',
    },
    /** A debt's state in a row and in its detail. */
    status: {
      settled: 'Saldada',
      /** "Vencida · 1 oct". */
      overdue: 'Vencida · {date}',
      /** "Vence 1 oct", "Vence hoy": `{date}` is the day inside the sentence (lower-case hoy). */
      due: 'Vence {date}',
      noDate: 'Sin fecha',
      noDue: 'Sin vencimiento',
      /** 24UX4: a closed debt (was «Archivada»). */
      closed: 'Cerrada',
    },
    row: {
      /** VoiceOver: "Debo a Juan, 300,00 ARS, Vence 1 oct". */
      owedLabel: 'Debo a {name}, {amount} {currency}, {status}',
      receivableLabel: 'Me debe {name}, {amount} {currency}, {status}',
    },
    detail: {
      edit: 'Editar deuda',
      notFoundTitle: 'No encontramos esta deuda',
      notFoundDetail: 'Volvé a Deudas para elegir una obligación guardada en este dispositivo.',
      /** Over the outstanding amount: "Debo a Juan". */
      owedTo: 'Debo a {name}',
      owedBy: 'Me debe {name}',
      recordPayment: 'Registrar pago',
      recordCollection: 'Registrar cobro',
      type: 'Tipo',
      typeOwed: 'Yo debo',
      typeReceivable: 'Me deben',
      due: 'Vencimiento',
      state: 'Estado',
      note: 'Nota',
      explain: 'Saldar la obligación mueve saldo entre registros. No crea un gasto ni un ingreso.',
      payments: 'Pagos registrados',
      collections: 'Cobros registrados',
      noPayments: 'Todavía no registraste pagos para esta obligación.',
      noCollections: 'Todavía no registraste cobros para esta obligación.',
    },
    /** The transfer form when it pays a debt or collects a receivable. */
    payment: {
      title: 'Registrar pago',
      /** Default note (user-editable, stored): "Pago a Juan". */
      note: 'Pago a {name}',
    },
    collection: {
      title: 'Registrar cobro',
      /** Default note (user-editable, stored): "Cobro de Ana". */
      note: 'Cobro de {name}',
    },
    form: {
      owedTo: 'Debo a',
      owedBy: 'Me debe',
      currency: 'Moneda',
      owed: 'Debo',
      receivable: 'Me deben',
      amountOwed: 'Monto que debés',
      amountReceivable: 'Monto que te deben',
      counterpartyOwed: 'Persona o entidad',
      counterpartyReceivable: 'Persona o cliente',
      counterpartyPlaceholder: 'Nombre o concepto',
      due: 'Vencimiento',
      noDate: 'Sin fecha',
      dated: 'Con fecha',
      dueDate: 'Fecha límite',
      note: 'Nota (opcional)',
      explainOwed: 'Cada pago que registres sale de una cuenta y baja este saldo. No se crean gastos ni ingresos al saldar una deuda.',
      explainReceivable: 'Cada cobro que registres entra a una cuenta y baja este saldo. No se crean gastos ni ingresos al saldar una deuda.',
      frozenNote: 'El envío quedó congelado para que Reintentar no cree otra obligación ni aplique cambios dos veces.',
      create: 'Crear deuda',
      amountPositive: 'Ingresá un monto mayor que cero.',
      saveFailed: 'No pudimos guardar la deuda. Reintentá el mismo envío.',
    },
    /** 24UX4: the trailing swipe actions of a debt (short) and the same actions in its detail (named). */
    manage: {
      /** Opens the payment (or collection) of everything outstanding, prefilled; the transfer form records it. */
      settle: 'Saldar',
      close: 'Cerrar',
      reopen: 'Reabrir',
      delete: 'Eliminar',
      closeDebt: 'Cerrar deuda',
      reopenDebt: 'Reabrir deuda',
      deleteDebt: 'Eliminar deuda',
      closeTitleOwed: '¿Cerrar la deuda con {name}?',
      closeTitleReceivable: '¿Cerrar lo que te debe {name}?',
      /** `{amount}` is the outstanding balance, formatted. */
      closeDetail: 'Todavía quedan {amount} pendientes. Cerrarla la saca de pendientes sin registrar un pago; podés reabrirla.',
      closeConfirm: 'Cerrar',
      deleteTitleOwed: '¿Eliminar la deuda con {name}?',
      deleteTitleReceivable: '¿Eliminar lo que te debe {name}?',
      deleteDetailPayments: {
        one: 'Deja de seguirse. El pago registrado sigue en Movimientos.',
        other: 'Deja de seguirse. Los {count} pagos registrados siguen en Movimientos.',
      },
      deleteDetailCollections: {
        one: 'Deja de seguirse. El cobro registrado sigue en Movimientos.',
        other: 'Deja de seguirse. Los {count} cobros registrados siguen en Movimientos.',
      },
      deleteDetailEmpty: 'Deja de seguirse. No borra ningún movimiento.',
      deleteConfirm: 'Eliminar',
      failed: 'No pudimos cambiar la deuda. Sigue como estaba; probá nuevamente.',
      deleteFailed: 'No pudimos eliminar la deuda. Sigue como estaba; probá nuevamente.',
    },
  },
} as const;
