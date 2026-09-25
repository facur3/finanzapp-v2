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
      emptyDetail: 'Alquiler, suscripciones, sueldo o cualquier movimiento que se repita. FinanzApp lo registra al vencer, una sola vez.',
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
      pausedCaption: 'No se registran hasta que los reactives',
      toggleFailed: 'No pudimos cambiar el estado del recurrente. Probá nuevamente.',
    },
    row: {
      /** VoiceOver label of a rule: merchant (user data), frequency, amount, currency code and next date (inside the sentence: "próximo hoy"). */
      label: 'Editar recurrente {merchant}, {frequency}, {amount} {currency}, próximo {date}',
      paused: 'Pausado',
      pause: 'Pausar {merchant}',
      activate: 'Activar {merchant}',
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
      todayNote: 'Si la próxima fecha es hoy, FinanzApp registra ese movimiento al guardar. Luego avanza la fecha automáticamente sin duplicarlo.',
      retryNote: 'El envío quedó congelado para que Reintentar no cree otra regla.',
      create: 'Crear recurrente',
      pastDate: 'La próxima fecha debe ser hoy o una fecha futura.',
      saveFailed: 'No se pudo guardar el recurrente. Conservamos el mismo envío para reintentar sin duplicarlo.',
    },
    edit: {
      notFoundTitle: 'No encontramos este recurrente',
      notFoundDetail: 'Volvé a Recurrentes para elegir una regla guardada en este dispositivo.',
    },
  },
} as const;
