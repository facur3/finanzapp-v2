/** Producto 25A-03, «Para revisar»: the tray of pending proposals, a proposal's detail, its editor and the badge. */
export const review = {
  review: {
    /** The tray's explanation, over the list. */
    header: 'Propuestas que esperan tu confirmación. Nada se registra hasta que confirmes.',
    emptyTitle: 'Nada para revisar',
    emptyDetail: 'Cuando el Asistente proponga un movimiento, aparece acá para que lo confirmes, lo edites o lo descartes.',
    /** Rows of the review file that cannot be read: set apart, never a proposal. */
    unreadable: {
      one: '{count} propuesta no se puede leer. No se registrará nada con ella.',
      other: '{count} propuestas no se pueden leer. No se registrará nada con ellas.',
    },
    unavailable: 'No pudimos abrir las propuestas. Tus movimientos no cambiaron.',
    readOnly: 'Estas propuestas vienen de una versión más nueva de FinanzApp: se pueden ver, no modificar.',
    /** The dock's Más tab, read by VoiceOver after its name when something waits. */
    badge: { one: '{count} para revisar', other: '{count} para revisar' },
    /** What a row and the detail say first. */
    state: {
      ready: 'Lista para confirmar',
      incomplete: { one: 'Falta {count} dato', other: 'Faltan {count} datos' },
      stale: 'Revisala de nuevo',
      interrupted: 'Registro sin verificar',
      conflict: 'Ya existe otro registro',
    },
    kind: { expense: 'Gasto', income: 'Ingreso', unknown: 'Gasto o ingreso' },
    /** A fact the proposal does not have yet: shown as missing, never invented. */
    missing: 'Falta completar',
    noMerchant: 'Sin comercio',
    noAmount: 'Sin monto',
    source: { assistant: 'Asistente', wallet: 'Apple Pay', inbox: 'Bandeja', fixture: 'Prueba de desarrollo' },
    purchase: {
      once: 'Una vez',
      installments: 'En {count} cuotas',
      installmentsOpen: 'En cuotas, sin cantidad elegida',
    },
    fields: {
      kind: 'Tipo',
      amount: 'Monto',
      merchant: 'Comercio o concepto',
      category: 'Categoría',
      destination: 'Dónde se registra',
      card: 'Tarjeta',
      account: 'Cuenta',
      date: 'Fecha',
      purchase: 'Pago',
      source: 'Origen',
      captured: 'Capturada',
    },
    /** Each gap the domain names, as the step that removes it. */
    gaps: {
      kind: 'Elegí si es un gasto o un ingreso.',
      amount: 'Falta el monto.',
      currency: 'La moneda falta o no es la de la cuenta elegida.',
      destination: 'Elegí una cuenta o tarjeta disponible.',
      purchase: 'Elegí cómo se paga con la tarjeta: una vez o en cuotas.',
      installmentCount: 'Elegí la cantidad de cuotas.',
      merchant: 'Falta el comercio o concepto.',
      category: 'Elegí una categoría que ya uses.',
      date: 'Elegí una fecha de hoy o anterior.',
    },
    detail: {
      notFoundTitle: 'Esta propuesta ya no está pendiente',
      notFoundDetail: 'Se confirmó, se descartó o no se puede leer.',
      /** What Confirmar writes, said before it is pressed. */
      willExpense: 'Al confirmar se registra un gasto.',
      willCardOnce: 'Al confirmar se registra un gasto en la tarjeta.',
      willIncome: 'Al confirmar se registra un ingreso.',
      willPlan: 'Al confirmar se registra una compra en {count} cuotas: cada cuota se suma al cerrar su resumen, no hoy.',
      missingTitle: 'Para confirmar falta',
      staleNote: 'La cuenta, la tarjeta o la categoría cambió desde la propuesta. Abrí Editar y revisala antes de confirmar.',
      interruptedNote: 'Un intento anterior de registrarla no se pudo verificar. Confirmar lo busca en tus datos y lo completa una sola vez.',
      conflictNote: 'Tus datos ya tienen otro registro con el identificador de esta propuesta. Para no duplicar nada, no se puede confirmar ni editar; tus movimientos no cambian.',
      confirm: 'Confirmar',
      retryConfirm: 'Reintentar confirmación',
      edit: 'Editar',
      dismiss: 'Descartar',
      dismissQuestion: '¿Descartar esta propuesta?',
      dismissDetail: 'No se registra nada y no vuelve a aparecer. Tus movimientos no cambian.',
      recordedLater: 'Registrado. La propuesta se marcará como confirmada la próxima vez que se abra la app.',
    },
    edit: {
      noDestination: 'No tenés una cuenta o tarjeta disponible en {currency} para este movimiento.',
      amountNeedsDestination: 'Elegí dónde se registra para cargar el monto en su moneda.',
      countLabel: 'Cantidad de cuotas',
      placement: 'Primera cuota en el resumen',
      placementCurrent: 'Este resumen',
      placementNext: 'El siguiente',
      noInterest: 'Sin interés. Una compra financiada se registra desde el formulario de compra.',
      categoryNote: 'Solo una categoría que ya uses: una nueva se crea desde el formulario de gasto o ingreso.',
    },
  },
} as const;
