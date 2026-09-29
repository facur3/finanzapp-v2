/** Tarjetas: the list, the card detail and the card form. */
export const cards = {
  cards: {
    list: {
      add: 'Agregar tarjeta',
      emptyTitle: 'Tus tarjetas, como en la billetera',
      /** 24T2: a purchase without instalments counts once; in instalments, each instalment counts when its statement closes. */
      emptyDetail: 'Una compra sin cuotas cuenta como gasto una sola vez; en cuotas, cada cuota cuenta cuando cierra su resumen. Cuando pagás la tarjeta, el dinero sale de tu cuenta y baja el saldo pendiente, sin volver a contar el consumo.',
      /** VoiceOver hint of the card in front of the deck (and of a row that opens a card). */
      openHint: 'Abre el detalle de la tarjeta',
      /** VoiceOver hint of a card stacked in the deck: tapping it brings it to the front. */
      selectHint: 'Selecciona esta tarjeta',
      /** Only archived cards: shown in place of the deck, above the Archivadas section. */
      noActiveTitle: 'Ninguna tarjeta activa',
      noActiveDetail: 'Tus tarjetas archivadas están abajo. Agregá una tarjeta para registrar compras nuevas.',
    },
    panel: {
      /** The card's balance due (purchases minus payments). Always «saldo pendiente», never «deuda»: that word is the Deudas y cobros section. */
      recordedDebt: 'Saldo pendiente',
      /** The state line under an archived card's face in its detail. */
      archivedTitle: 'Tarjeta archivada',
      deletedTitle: 'Tarjeta eliminada',
      deletedDetail: 'Sus compras y pagos siguen en Movimientos y en sus reportes. No se edita ni acepta movimientos nuevos.',
      noDebt: 'Sin saldo pendiente en esta tarjeta.',
      /** Card balance in the user's favour: "Saldo a favor · $ 1.000,00". */
      credit: 'Saldo a favor · {amount}',
      available: 'Disponible',
      noLimitLoaded: 'Sin límite cargado',
      /** 24T2: a card with pending instalments. How an issuer reserves credit for them is not assumed: never zero, never a guess. */
      availableUnknown: 'No calculado con cuotas',
      availableInfoTitle: 'Disponible con cuotas',
      availableInfoDetail: 'Cada emisor reserva el límite de las compras en cuotas a su manera: algunos descuentan el total de la compra y otros solo las cuotas ya facturadas. FinanzApp no lo supone: mientras la tarjeta tenga cuotas pendientes, no calcula su disponible.',
      /** Caption under Disponible: "de $ 5.000,00" (of the credit limit). */
      ofLimit: 'de {amount}',
      /** 24T2: the next closing and the next due date, two separate facts (the due may belong to the statement that already closed). */
      closing: 'Cierra',
      due: 'Vence',
      /** Under the usage bar: "12 % del límite de $ 5.000,00". */
      usage: '{percent} % del límite de {limit}',
      recordPurchase: 'Registrar compra',
      pay: 'Pagar tarjeta',
      /** 24T2: the principal of the card's plans not recognised yet, beside the balance and never inside it. */
      future: 'Cuotas futuras',
      futurePlans: { one: 'en {count} plan', other: 'en {count} planes' },
      /** Beside «Cuotas futuras» when those plans carry interest (or, in an older plan, fees or taxes): "+ interés $ 60.000,00".
       * Named apart and never added into the principal, so the figure never disagrees with the instalments a plan lists. */
      futureInterest: '+ interés {amount}',
      futureFinancing: '+ financiación {amount}',
      /** In place of that figure when the plans' sum leaves the exact range (never rounded, never hidden). */
      futureOutOfRange: 'Total fuera de rango',
      /** The card detail's section with its instalment plans; the caption is the future principal. */
      plans: 'Cuotas',
      plansCaption: 'Cuotas futuras {amount}',
      plansCaptionOutOfRange: 'Cuotas futuras: total fuera de rango',
      seeAll: 'Ver todo',
      recent: 'Recientes',
      movements: 'Movimientos',
      noActivity: 'Todavía no registraste compras ni pagos en esta tarjeta.',
      /** Appended to the statement caption: " · devoluciones $ 1.000,00". */
      refunds: ' · devoluciones {amount}',
      editCard: 'Editar tarjeta',
      notFoundTitle: 'No encontramos esta tarjeta',
      notFoundDetail: 'Volvé a Tarjetas para elegir una tarjeta guardada en este dispositivo.',
    },
    /** 24T2: the open cycle's activity («Este ciclo», the brief's word), one caption line under Recientes and Movimientos:
     * what the ledger holds since the previous closing, never a statement amount. */
    statement: {
      /** `{date}` is the day inside the sentence: "desde ayer", "desde 29 ago". */
      openSince: 'Este ciclo, desde {date}',
      purchases: { one: '{count} compra', other: '{count} compras' },
      payments: { one: '{count} pago', other: '{count} pagos' },
    },
    /** 24T2: archived cards (not deleted) stay reachable at the end of Tarjetas. */
    archived: {
      title: 'Archivadas',
      caption: 'Siguen recibiendo pagos y registrando sus cuotas.',
      /** A row's line: "Saldo pendiente $ 131,00". */
      debt: 'Saldo pendiente {amount}',
      clear: 'Sin saldo pendiente',
    },
    /** The transfer form when it pays a card. */
    payment: {
      title: 'Pagar tarjeta',
      /** Default note of a card payment (user-editable, stored): "Pago Visa Gold". */
      note: 'Pago {name}',
    },
    face: {
      /** VoiceOver: "Tarjeta Visa Gold, Galicia, termina en 4009, pesos". */
      label: 'Tarjeta {details}',
      endsIn: 'termina en {last4}',
      /** The legacy words for a card in ARS or USD (unless another held currency shares the word); any other currency is read by CLDR's plural name. */
      pesos: 'pesos',
      dollars: 'dólares',
      /** VoiceOver: a card's place in the deck, after its sentence: "Tarjeta 1 de 3". */
      position: 'Tarjeta {index} de {count}',
    },
    form: {
      card: 'Tarjeta',
      currency: 'Moneda',
      name: 'Nombre de la tarjeta',
      /** An example name without a bank: the issuer has its own field, and a bank of one country reads oddly in another region. */
      namePlaceholder: 'Ej. Visa Gold',
      openingDebt: 'Saldo pendiente hoy (opcional)',
      openingDebtNote: 'Lo que ya debés hoy en esta tarjeta. No cuenta como gasto: las compras anteriores no se vuelven a registrar.',
      issuer: 'Emisor (opcional)',
      issuerPlaceholder: 'Banco o billetera',
      last4: 'Últimos 4 dígitos (opcional)',
      limit: 'Límite de crédito (opcional)',
      /** Producto 24T2: the statement dates, chosen on a full calendar (day, month and year). A new card asks its next
       * closing and the due date of that closing; an existing card shows its open statement. */
      nextClosing: 'Próximo cierre',
      /** The due date of that same closing (it may fall in the next month); always after the closing. */
      due: 'Vencimiento',
      /** The statement that already closed and is still to pay: only its due date can be corrected ("Vence el resumen del 28 sep"). */
      toPayDue: 'Vence el resumen del {date}',
      datesNote: 'Están en tu resumen. FinanzApp no consulta al banco.',
      /** An edit whose dates correct this statement only («Usar estos días todos los meses» off): the usual days stay. */
      oneOff: 'Estas fechas corrigen solo este resumen.',
      /** The usual days after the save: "Los meses siguientes: cierre el día 28 y vencimiento el día 5." */
      usualDays: 'Los meses siguientes: cierre el día {closing} y vencimiento el día {due}.',
      /** Off: the dates correct this statement only. On: their days become the card's usual days. */
      everyMonth: 'Usar estos días todos los meses',
      frozenNote: 'El envío quedó congelado para que Reintentar no cree otra tarjeta ni aplique cambios dos veces.',
      create: 'Crear tarjeta',
      retry: 'Reintentar',
      archive: 'Archivar tarjeta',
      reactivate: 'Reactivar tarjeta',
      archiveTitle: '¿Archivar esta tarjeta?',
      /** 24T2: an archived card stays reachable under «Archivadas» in Tarjetas, where it takes payments and is reactivated. */
      archiveDetail: 'Las compras y pagos anteriores siguen en tus registros y reportes. La tarjeta pasa a Archivadas en Tarjetas: podés pagarla y reactivarla.',
      archiveConfirm: 'Archivar',
      negativeDebt: 'El saldo pendiente no puede ser negativo. Si la tarjeta tiene saldo a favor, registralo después como devolución.',
      saveFailed: 'No pudimos guardar la tarjeta. Reintentá el mismo envío.',
      archiveFailed: 'No pudimos archivar la tarjeta. Reintentá el mismo cambio.',
      /** Producto 25B2: deleting a card keeps its purchases, payments and internal account; only the card leaves. */
      delete: 'Eliminar tarjeta',
      deleteTitle: '¿Eliminar esta tarjeta?',
      deleteDetail: 'Deja de aparecer en Tarjetas y de aceptar compras y pagos. Las compras y los pagos anteriores siguen en tus registros y reportes; ningún saldo cambia.',
      /** 25B2 review: a card with a balance due is paid or archived, never deleted (a deleted card takes no payment). */
      blockedTitle: 'Todavía no se puede eliminar',
      blockedDetail: 'Esta tarjeta tiene un saldo pendiente de {amount}. Pagalo primero, o archivala: pasa a Archivadas en Tarjetas, donde podés pagarla cuando quieras.',
      blockedPay: 'Pagar',
      /** 24T1: a card with a pending instalment plan (the same rule storage enforces). Archiving keeps every instalment
       * recorded as its statement closes (24T2: under «Archivadas», where the card takes payments and is reactivated). */
      blockedPlanDetail: 'Esta tarjeta tiene cuotas pendientes. Archivala: pasa a Archivadas en Tarjetas, sus cuotas se siguen registrando y podés pagarla y reactivarla.',
      blockedArchive: 'Archivar',
      deleteConfirm: 'Eliminar',
      deleteFailed: 'No pudimos eliminar la tarjeta. Sigue como estaba; probá nuevamente.',
    },
  },
} as const;
