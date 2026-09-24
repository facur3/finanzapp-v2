/** Words shared by every area: buttons, selectors, the amount field, movement and account kinds, counts. */
export const common = {
  common: {
    cancel: 'Cancelar',
    done: 'Listo',
    close: 'Cerrar',
    /** The button that closes an information alert (the ⓘ glyphs). Written by the app so it follows the interface language, not iOS's. */
    ok: 'OK',
    see: 'Ver',
    seeAll: 'Ver todos',
    addAccount: 'Agregar cuenta',
    retrySave: 'Reintentar guardado',
    retryChange: 'Reintentar cambio',
    saveChanges: 'Guardar cambios',
    closeAmountKeyboard: 'Cerrar teclado del monto',
    moreInfoAbout: 'Más información sobre {title}',
    /** VoiceOver name of a metric's help glyph: "Qué significa Disponible". */
    whatIs: 'Qué significa {title}',
  },
  /** The kinds of movement, as a word in a sentence and as a switch label. */
  movement: {
    expense: 'Gasto',
    income: 'Ingreso',
    transfer: 'Transferencia',
    expenseWord: 'gasto',
    incomeWord: 'ingreso',
  },
  accountKinds: {
    account: 'Cuenta',
    creditCard: 'Tarjeta de crédito',
    card: 'Tarjeta',
    debt: 'Deuda',
  },
  selection: {
    account: 'Cuenta',
    chooseAccount: 'Elegir cuenta',
    category: 'Categoría',
    chooseCategory: 'Elegir categoría',
    categories: 'Categorías',
    date: 'Fecha',
    chooseDate: 'Elegir fecha',
    currency: 'Moneda',
    chooseCurrency: 'Elegir moneda',
    currencyNote: 'Por ahora las cuentas se registran en pesos o en dólares, sin convertir entre sí. Otras monedas llegan con su cotización.',
    searchOrCreateCategory: 'Buscar o crear categoría',
    categoryNamePlaceholder: 'Nombre de la categoría',
    useCategory: 'Usar categoría {name}',
    /** The visible button that records a new name: "Usar «Kiosco»". */
    useNewCategory: 'Usar «{name}»',
    archivedStillValid: 'Archivada · sigue válida en este movimiento',
    archived: 'archivada',
  },
  amount: {
    label: 'Monto',
    /** VoiceOver name of the amount field: "Gasto en pesos argentinos". */
    accessibility: '{label} en {currency}',
    inPesos: 'pesos argentinos',
    inDollars: 'dólares',
    /** Under the amount field when a pasted text was not used; the field keeps its previous value. {text} is what was pasted. */
    paste: {
      /** "1,000" in Argentina: a thousand in one convention, one with three decimals in the other. {decimal} is the region's decimal separator. */
      ambiguous: 'No se pegó «{text}»: puede leerse de dos maneras. Escribí los decimales con «{decimal}».',
      precision: 'No se pegó «{text}»: tiene más de dos decimales.',
      /** The same refusal for a currency with another number of decimals (KWD: 3) or none (JPY). */
      precisionDigits: 'No se pegó «{text}»: tiene más de {digits} decimales.',
      precisionNone: 'No se pegó «{text}»: esta moneda no lleva decimales.',
      invalid: 'No se pegó «{text}»: no es un monto válido.',
      currencyMismatch: 'No se pegó «{text}»: indica otra moneda. La cuenta está en {currency}; no se hizo ninguna conversión.',
      tooLong: 'No se pegó «{text}»: supera el monto máximo.',
    },
    /** Under the field when the account or currency changed and the typed amount cannot be kept exactly in the new
     * currency: the digits stay, nothing is rounded, and the form does not save until the person corrects them. */
    kept: {
      decimals: 'El importe tiene más decimales de los que admite {currency} ({digits}). Corregilo antes de guardar; no se redondea.',
      noDecimals: '{currency} no lleva decimales. Quitá los decimales antes de guardar; no se redondea.',
      tooLong: 'El importe supera el máximo de {currency}. Corregilo antes de guardar.',
    },
  },
  count: {
    movements: { one: '{count} movimiento', other: '{count} movimientos' },
    expenses: { one: '{count} gasto', other: '{count} gastos' },
  },
} as const;
