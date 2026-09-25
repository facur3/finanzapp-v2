/** Recurrentes: the list and the recurring form. */
export const recurring = {
  recurring: {
    /** Frequency as a label (segmented control, row caption). */
    frequency: {
      weekly: 'Semanal',
      monthly: 'Mensual',
      yearly: 'Anual',
    },
    /** Frequency inside a VoiceOver sentence: "Editar recurrente Alquiler, mensual, …". */
    frequencySpoken: {
      weekly: 'semanal',
      monthly: 'mensual',
      yearly: 'anual',
    },
    list: {
      add: 'Agregar recurrente',
      emptyTitle: 'Nada recurrente todavía',
      emptyDetailAccount: 'Creá un pago o ingreso recurrente para esta cuenta.',
      emptyDetail: 'Alquiler, suscripciones, sueldo o cualquier movimiento que se repita. FinanzApp lo anota en tus movimientos cuando vence, una sola vez. No paga ni cobra nada.',
      create: 'Crear recurrente',
      next30: 'Próximos 30 días',
      payments: 'Pagos',
      /** Stat label: how many occurrences fall due in the next 30 days. */
      dueCount: 'Vencimientos',
      income: 'Ingresos',
      /** Shown instead of the 30-day totals of one currency when their sum leaves the exact range (never rounded or hidden). */
      outOfRange: 'Total fuera de rango',
      active: 'Activos',
      paused: 'Pausados',
      pausedCaption: 'No se registran hasta que los reanudes',
    },
    row: {
      /** VoiceOver label of a rule: merchant (user data), frequency, amount, currency code and next date (inside the sentence: "próximo hoy"). */
      label: 'Editar recurrente {merchant}, {frequency}, {category}, {amount} {currency}, próximo {date}',
      /** 24UX2: a paused rule never announces a next date. */
      labelPaused: 'Editar recurrente {merchant}, {frequency}, {category}, {amount} {currency}, pausado',
      paused: 'Pausado',
      /** 24UX5: an active rule FinanzApp could not bring up to date (its next date is already past). */
      review: 'Revisar',
      labelReview: 'Editar recurrente {merchant}, {frequency}, {category}, {amount} {currency}, para revisar: sin registrar desde {date}',
    },
    /** 24UX4: the trailing swipe actions of a rule (short) and the same actions in its detail (named). */
    manage: {
      pause: 'Pausar',
      resume: 'Reanudar',
      delete: 'Eliminar',
      pauseRule: 'Pausar recurrente',
      resumeRule: 'Reanudar recurrente',
      deleteRule: 'Eliminar recurrente',
      /** Over the detail's actions of a paused rule. */
      pausedNote: 'Pausado: no registra nada hasta que lo reanudes. Lo que venza mientras tanto no se registra.',
      /** 24UX5: over the detail's actions of an active rule the catch-up could not record (a real failure; a long backlog is recorded on its own, in batches). */
      reviewNote: 'FinanzApp no pudo registrar este recurrente desde el {date}. Continuá desde hoy para retomarlo sin registrar los anteriores, o pausalo.',
      continueFromToday: 'Continuar desde hoy',
      /** The confirmation. `{merchant}` is the person's own text. */
      deleteTitle: '¿Eliminar «{merchant}»?',
      deleteDetail: {
        one: 'Deja de registrarse. El movimiento que ya registró sigue en Movimientos.',
        other: 'Deja de registrarse. Los {count} movimientos que ya registró siguen en Movimientos.',
      },
      deleteDetailEmpty: 'Deja de registrarse. No borra ningún movimiento.',
      deleteConfirm: 'Eliminar',
      failed: 'No pudimos cambiar el recurrente. Sigue como estaba; probá nuevamente.',
      deleteFailed: 'No pudimos eliminar el recurrente. Sigue como estaba; probá nuevamente.',
    },
    form: {
      noAccountTitle: 'Primero, una cuenta',
      noAccountDetail: 'Los recurrentes necesitan una cuenta para registrar cada vencimiento en la moneda correcta.',
      /** 24B6: the ledger has accounts, but none a recurring income may use (cards only). */
      noCashAccountDetail: 'Un ingreso recurrente se registra en una cuenta normal, no en una tarjeta. Agregá una para continuar.',
      expenseAmount: 'Gasto recurrente',
      incomeAmount: 'Ingreso recurrente',
      merchantExpensePlaceholder: 'Ej. Alquiler',
      merchantIncomePlaceholder: 'Ej. Sueldo',
      frequency: 'Frecuencia',
      nextDate: 'Próxima fecha',
      todayNote: 'Si la próxima fecha es hoy, FinanzApp anota ese movimiento al guardar. Después lo anota en cada vencimiento, al abrir la app, sin duplicarlo.',
      retryNote: 'El envío quedó congelado para que Reintentar no cree otra regla.',
      create: 'Crear recurrente',
      pastDate: 'La próxima fecha debe ser hoy o una fecha futura.',
      saveFailed: 'No se pudo guardar el recurrente. Conservamos el mismo envío para reintentar sin duplicarlo.',
    },
    /** 24UX2: the movements a rule already recorded, in its detail. A scheduled date is not one of them. */
    history: {
      title: 'Registrados',
      caption: 'Movimientos que FinanzApp anotó por esta regla; no confirman un pago del banco. La próxima fecha es una estimación.',
      empty: 'Todavía no registró ningún movimiento.',
      older: { one: 'Y {count} registro anterior en Movimientos.', other: 'Y {count} registros anteriores en Movimientos.' },
    },
    edit: {
      notFoundTitle: 'No encontramos este recurrente',
      notFoundDetail: 'Volvé a Recurrentes para elegir una regla guardada en este dispositivo.',
    },
  },
} as const;
