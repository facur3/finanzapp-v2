/** Tarjetas: the list, the card detail and the card form. */
export const cards = {
  cards: {
    list: {
      add: 'Agregar tarjeta',
      emptyTitle: 'Tus tarjetas, como en la billetera',
      emptyDetail: 'Registrá cada compra una sola vez como gasto. Cuando pagás el resumen, el dinero sale de tu cuenta y baja la deuda de la tarjeta, sin volver a contar el consumo.',
      /** VoiceOver hint of a card face in the carousel. */
      openHint: 'Abre el detalle de la tarjeta',
    },
    panel: {
      recordedDebt: 'Deuda registrada',
      archivedDebt: 'Tarjeta archivada · deuda registrada',
      noDebt: 'Sin deuda registrada en esta tarjeta.',
      /** Card balance in the user's favour: "Saldo a favor · $ 1.000,00". */
      credit: 'Saldo a favor · {amount}',
      available: 'Disponible',
      noLimitLoaded: 'Sin límite cargado',
      noLimit: 'Sin límite',
      /** Caption under Disponible: "de $ 5.000,00" (of the credit limit). */
      ofLimit: 'de {amount}',
      closing: 'Cierre',
      due: 'Vencimiento',
      /** Under the usage bar: "12 % del límite de $ 5.000,00". */
      usage: '{percent} % del límite de {limit}',
      recordPurchase: 'Registrar compra',
      pay: 'Pagar tarjeta',
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
    /** One line of statement facts under the activity title. */
    statement: {
      /** `{date}` is the day inside the sentence: "desde ayer", "desde 29 ago". */
      openSince: 'Resumen abierto desde {date}',
      purchases: { one: '{count} compra', other: '{count} compras' },
      payments: { one: '{count} pago', other: '{count} pagos' },
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
      pesos: 'pesos',
      dollars: 'dólares',
      /** VoiceOver name of the carousel page dots: "Tarjeta 1 de 3". */
      position: 'Tarjeta {index} de {count}',
    },
    form: {
      card: 'Tarjeta',
      currency: 'Moneda',
      name: 'Nombre de la tarjeta',
      /** An example name without a bank: the issuer has its own field, and a bank of one country reads oddly in another region. */
      namePlaceholder: 'Ej. Visa Gold',
      pesos: 'Pesos · ARS',
      dollars: 'Dólares · USD',
      openingDebt: 'Deuda actual (opcional)',
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
      negativeDebt: 'La deuda inicial no puede ser negativa. Si la tarjeta tiene saldo a favor, registralo después como devolución.',
      saveFailed: 'No pudimos guardar la tarjeta. Reintentá el mismo envío.',
      archiveFailed: 'No pudimos archivar la tarjeta. Reintentá el mismo cambio.',
    },
  },
} as const;
