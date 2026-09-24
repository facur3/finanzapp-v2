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
      archived: 'Archivada',
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
      pesos: 'Pesos · ARS',
      dollars: 'Dólares · USD',
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
      retry: 'Reintentar',
      archive: 'Archivar deuda',
      reactivate: 'Reactivar deuda',
      archiveTitle: '¿Archivar esta deuda?',
      archiveDetail: 'Los pagos o cobros anteriores siguen guardados. Solo deja de aparecer como pendiente.',
      archiveConfirm: 'Archivar',
      amountPositive: 'Ingresá un monto mayor que cero.',
      saveFailed: 'No pudimos guardar la deuda. Reintentá el mismo envío.',
      archiveFailed: 'No pudimos archivar la deuda. Reintentá el mismo cambio.',
    },
  },
} as const;
