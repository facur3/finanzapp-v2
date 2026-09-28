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
      /** The card detail's section with its instalment plans; the caption is the future principal. */
      plans: 'Cuotas',
      plansCaption: 'Cuotas futuras {amount}',
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
    /** One line of open-cycle facts under the activity title («Este ciclo»): what the ledger holds, never a statement amount. */
    statement: {
      /** `{date}` is the day inside the sentence: "desde ayer", "desde 29 ago". */
      openSince: 'Ciclo abierto desde {date}',
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
      closingDay: 'Día de cierre',
      dueDay: 'Día de vencimiento',
      daysNote: 'Están en tu resumen. Con ellos FinanzApp calcula el próximo cierre y vencimiento; no consulta al banco.',
      frozenNote: 'El envío quedó congelado para que Reintentar no cree otra tarjeta ni aplique cambios dos veces.',
      create: 'Crear tarjeta',
      retry: 'Reintentar',
      archive: 'Archivar tarjeta',
      reactivate: 'Reactivar tarjeta',
      archiveTitle: '¿Archivar esta tarjeta?',
      archiveDetail: 'Las compras y pagos anteriores siguen en tus registros y reportes. La tarjeta deja de aparecer en Tarjetas.',
      archiveConfirm: 'Archivar',
      closingDayInvalid: 'Ingresá el día de cierre entre 1 y 31.',
      dueDayInvalid: 'Ingresá el día de vencimiento entre 1 y 31.',
      negativeDebt: 'El saldo pendiente no puede ser negativo. Si la tarjeta tiene saldo a favor, registralo después como devolución.',
      saveFailed: 'No pudimos guardar la tarjeta. Reintentá el mismo envío.',
      archiveFailed: 'No pudimos archivar la tarjeta. Reintentá el mismo cambio.',
      /** Producto 25B2: deleting a card keeps its purchases, payments and internal account; only the card leaves. */
      delete: 'Eliminar tarjeta',
      deleteTitle: '¿Eliminar esta tarjeta?',
      deleteDetail: 'Deja de aparecer en Tarjetas y de aceptar compras y pagos. Las compras y los pagos anteriores siguen en tus registros y reportes; ningún saldo cambia.',
      /** 25B2 review: a card with a balance due is paid or archived, never deleted (a deleted card takes no payment). */
      blockedTitle: 'Todavía no se puede eliminar',
      blockedDetail: 'Esta tarjeta tiene un saldo pendiente de {amount}. Pagalo primero, o archivala: deja de aparecer y conserva el saldo para pagarlo cuando quieras.',
      blockedPay: 'Pagar',
      /** 24T1: a card with a pending instalment plan (the same rule storage enforces). Archiving keeps every instalment payable. */
      blockedPlanDetail: 'Esta tarjeta tiene cuotas pendientes. Archivala: deja de aparecer y sus cuotas siguen registrándose y pagándose cuando corresponde.',
      blockedArchive: 'Archivar',
      deleteConfirm: 'Eliminar',
      deleteFailed: 'No pudimos eliminar la tarjeta. Sigue como estaba; probá nuevamente.',
    },
  },
} as const;
