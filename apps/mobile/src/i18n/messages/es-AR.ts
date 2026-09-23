/** The reference catalogue: every key exists here first, in the product's
 * Argentine Spanish. Values may carry `{name}` placeholders; a plural entry
 * is `{ one, other }` and receives `{count}`. Keys name the place and the
 * meaning, never the wording, so a copy change never renames a key. */
export const es = {
  common: {
    cancel: 'Cancelar',
    done: 'Listo',
    closeAmountKeyboard: 'Cerrar teclado del monto',
    moreInfoAbout: 'Más información sobre {title}',
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
