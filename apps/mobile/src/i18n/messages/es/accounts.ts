/** Cuentas: the list, the account detail, new and edit account. */
export const accounts = {
  accounts: {
    list: {
      emptyTitle: 'Empezá por una cuenta',
      emptyDetail: 'Elegí una cuenta para agrupar movimientos. Cargar el saldo inicial es opcional.',
    },
    detail: {
      notFoundTitle: 'No encontramos esta cuenta',
      notFoundDetail: 'Volvé a tus cuentas para elegir una guardada en este dispositivo.',
      edit: 'Editar cuenta',
      recordedBalance: 'Saldo registrado',
      monthExpenses: 'Gastos este mes',
      monthIncome: 'Ingresos este mes',
      recurring: 'Recurrentes',
      /** Value of the Recurrentes row: how many active rules post to this account. */
      activeRecurring: { one: '{count} activo', other: '{count} activos' },
      /** Value of the Recurrentes row when the account has none: an invitation to schedule one. */
      schedule: 'Programar',
      openingBalance: 'Saldo inicial',
      movements: 'Movimientos',
      empty: 'Todavía no hay movimientos en esta cuenta.',
    },
    form: {
      name: 'Nombre de la cuenta',
      namePlaceholder: 'Ej. Banco, Efectivo, Inversiones',
      openingBalance: 'Saldo inicial',
      openingHelp: 'Podés dejarlo vacío para registrar desde cero. El saldo registrado será el resultado de tus movimientos; '
        + 'no representa tu saldo bancario. Si cargás un saldo inicial, es el punto de partida y no cuenta como ingreso.',
      openingNote: 'Opcional. No cuenta como ingreso.',
      retryNote: 'Reintentá el mismo envío para evitar duplicados. Para cambiarlo, cerrá y revisá primero tus cuentas.',
      save: 'Guardar cuenta',
      saveFailed: 'No se pudo guardar. Conservamos lo que escribiste para que puedas reintentar.',
    },
    /** Producto 25B2: the lifecycle of a normal account. Deleting keeps every movement and transfer; the row only
     * leaves the lists, the totals and the forms. */
    manage: {
      delete: 'Eliminar',
      deleteAccount: 'Eliminar cuenta',
      deleteTitle: '¿Eliminar {name}?',
      deleteDetail: 'Deja de aparecer en tus cuentas, en Disponible y en los formularios. No borra nada: {movements} y {transfers} siguen en Movimientos con su nombre y su moneda.',
      deleteDetailEmpty: 'Deja de aparecer en tus cuentas y en los formularios. No tiene movimientos.',
      movements: { one: '{count} movimiento', other: '{count} movimientos' },
      transfers: { one: '{count} transferencia', other: '{count} transferencias' },
      /** Appended when active recurring rules post to the account. */
      deleteRecurring: { one: ' Su {count} recurrente activo se detendrá; lo ya registrado no cambia.', other: ' Sus {count} recurrentes activos se detendrán; lo ya registrado no cambia.' },
      deleteConfirm: 'Eliminar',
      deleteFailed: 'No pudimos eliminar la cuenta. Sigue como estaba; probá nuevamente.',
      /** The detail of a deleted account: its history stays readable. */
      deletedTitle: 'Cuenta eliminada',
      deletedNote: 'Sus movimientos y transferencias siguen aquí y en tus reportes. No acepta nuevos.',
    },
    edit: {
      notFoundDetail: 'Volvé a tus cuentas para revisar los datos guardados.',
      recordedBalance: 'Saldo registrado',
      balanceHelp: 'El ícono y el color solo cambian cómo se ve la cuenta. Usá la corrección de saldo únicamente si está mal cargado: '
        + 'queda un recibo de corrección, no un ingreso ni un gasto. Si recibiste, gastaste o moviste dinero, registrá el movimiento correspondiente.',
      balanceNote: 'Solo para corregir un saldo mal cargado.',
      currencyHelp: 'La moneda no se cambia para no reinterpretar los movimientos anteriores. Una cuenta en otra moneda se agrega por separado.',
      currencyNote: 'La moneda de una cuenta no se cambia.',
      retryNote: 'Reintentá este mismo cambio. Para editarlo, cerrá y verificá primero el saldo guardado.',
      saveUnverified: 'No pudimos verificar el guardado. Reintentá el mismo cambio.',
      invalid: 'Revisá el nombre y el saldo.',
      correctTitle: '¿Corregir el saldo?',
      /** Balance correction confirmation: "Banco: de 1.000,00 a 500,00 ARS. …". {name} is the user's account name. */
      correctMessage: '{name}: de {from} a {to} {currency}. Se ajustará el saldo inicial; tus movimientos no cambian. No es un ingreso ni una transferencia.',
      correctConfirm: 'Corregir saldo',
    },
  },
} as const;
