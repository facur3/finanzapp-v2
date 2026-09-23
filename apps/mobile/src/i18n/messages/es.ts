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
  preferences: {
    language: 'Idioma',
    region: 'Región',
    followDevice: 'Según el dispositivo',
    /** Subtitle of "Según el dispositivo": what the device resolves to right now. */
    followDeviceNow: 'Ahora: {value}',
    /** Más row subtitle when the value follows the device: "Español · según el dispositivo". */
    followingDevice: '{value} · según el dispositivo',
    languageNote: 'Por ahora FinanzApp está disponible en español. Otros idiomas se suman cuando toda la app esté traducida.',
    regionNote: 'La región define cómo se escriben las fechas, los números y los importes. No cambia la moneda de tus cuentas.',
    dataUntouched: 'Cambiar el idioma o la región no modifica tus movimientos, tus cuentas ni tus copias de seguridad.',
    saveFailed: 'No se pudo guardar la preferencia. Tu elección anterior sigue activa; probá de nuevo.',
    /** Region names in the interface language; languages are listed by their own names. */
    regionNames: { AR: 'Argentina', US: 'Estados Unidos' },
    /** Example of the region's conventions under its name. */
    regionSample: '{date} · {amount}',
  },
  count: {
    movements: { one: '{count} movimiento', other: '{count} movimientos' },
    expenses: { one: '{count} gasto', other: '{count} gastos' },
  },
} as const;
