/** Words shared by every area: buttons, selectors, the amount field, movement and account kinds, counts. */
export const common = {
  common: {
    cancel: 'Cancelar',
    done: 'Listo',
    close: 'Cerrar',
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
  },
  count: {
    movements: { one: '{count} movimiento', other: '{count} movimientos' },
    expenses: { one: '{count} gasto', other: '{count} gastos' },
  },
} as const;
