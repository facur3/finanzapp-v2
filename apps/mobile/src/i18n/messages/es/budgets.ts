/** Presupuestos: the month, the budget form. */
export const budgets = {
  budgets: {
    /** Segmented control between the two ledger currencies. */
    currency: {
      ARS: 'Pesos · ARS',
      USD: 'Dólares · USD',
    },
    screen: {
      noAccountTitle: 'Primero, una cuenta',
      noAccountDetail: 'Los presupuestos se comparan con gastos registrados en una moneda concreta.',
      add: 'Agregar presupuesto',
      previousMonth: 'Mes anterior',
      nextMonth: 'Mes siguiente',
      currentMonth: 'Mes en curso',
      futureMonth: 'Mes futuro · podés prepararlo',
      closedMonth: 'Mes cerrado',
      /** VoiceOver name of the "Este mes" link under a past or future month. */
      backToCurrent: 'Volver al mes actual',
      thisMonth: 'Este mes',
      emptyTitle: 'Dale un límite a tu mes',
      emptyDetail: 'Un presupuesto general es el techo de todos tus gastos del mes; los límites por categoría son sublímites dentro de él. FinanzApp los compara con tus gastos reales sin contar transferencias ni ingresos.',
      create: 'Crear presupuesto',
      general: 'Presupuesto general',
      /** Section action beside "Presupuesto general". */
      edit: 'Editar',
      addGeneral: 'Agregar presupuesto general',
      /** Section action beside "Por categoría". */
      addCategory: 'Agregar',
      byCategory: 'Por categoría',
      noSublimits: 'Sin límites por categoría este mes. Son sublímites dentro del general y no se suman entre sí.',
      unbudgeted: 'Además gastaste {amount} en categorías sin límite propio.',
    },
    /** Caption of "Por categoría", parts joined with " · ": "3 categorías · 1 excedida · 1 cerca del límite". */
    caption: {
      categories: { one: '{count} categoría', other: '{count} categorías' },
      exceeded: { one: '{count} excedida', other: '{count} excedidas' },
      near: '{count} cerca del límite',
      allInOrder: 'todas en orden',
    },
    total: {
      /** VoiceOver summary of the general budget; {status} is one of the three phrases below. */
      label: 'Presupuesto general: {spent} de {limit}, {percent} por ciento usado. {status}',
      exceededBy: 'Excedido por {amount}',
      reached: 'Límite alcanzado',
      availableAmount: 'Disponible {amount}',
      exceeded: 'Excedido',
      available: 'Disponible',
      spent: 'Gastado',
      limit: 'Límite',
      used: '{percent} % utilizado',
      /** Suffixes after "{percent} % utilizado", joined with " · ". */
      stateExceeded: 'excedido',
      stateReached: 'límite alcanzado',
      stateNear: 'cerca del límite',
    },
    row: {
      /** VoiceOver label of a category limit; {name} is the category, {status} one of the phrases below. */
      label: 'Presupuesto {name}: {spent} de {limit}, {percent} por ciento. {status}',
      exceededBy: 'Excedido por {amount}',
      reached: 'Límite alcanzado',
      left: 'Quedan {amount}',
      of: '{spent} de {limit}',
      percent: '{percent} %',
    },
    form: {
      general: 'Presupuesto general',
      perCategory: 'Límite por categoría',
      scopeGeneral: 'General',
      scopeCategory: 'Por categoría',
      amount: 'Presupuesto',
      generalNote: 'Es el techo de todos los gastos registrados del mes en esta moneda. No cuenta ingresos, transferencias ni pagos de tarjeta; una compra con tarjeta cuenta una sola vez.',
      categoryNote: 'Se compara con los gastos registrados en esta categoría durante ese mes. Es un sublímite: no se suma al presupuesto general.',
      retryNote: 'El envío quedó congelado para que Reintentar no cree otro presupuesto.',
      create: 'Crear presupuesto',
      delete: 'Eliminar presupuesto',
      retryDelete: 'Reintentar eliminación',
      deleteTitle: '¿Eliminar este presupuesto?',
      deleteMessage: 'Se deja de usar para este mes. Tus gastos y movimientos no se modifican.',
      deleteConfirm: 'Eliminar',
      saveFailed: 'No pudimos guardar el presupuesto. Reintentá con el mismo envío.',
      deleteFailed: 'No pudimos eliminar el presupuesto. Reintentá el mismo cambio.',
    },
    edit: {
      notFoundTitle: 'No encontramos este presupuesto',
      notFoundDetail: 'Volvé a Presupuestos para elegir uno activo guardado en este dispositivo.',
    },
  },
} as const;
