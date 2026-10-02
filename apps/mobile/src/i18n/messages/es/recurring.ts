/** Recurrentes: the list, the rule's detail (25B3) and the recurring form. */
export const recurring = {
  recurring: {
    /** Frequency as a label (segmented control, row caption, detail row). */
    frequency: {
      weekly: 'Semanal',
      monthly: 'Mensual',
      yearly: 'Anual',
    },
    /** Frequency inside a VoiceOver sentence: "Alquiler, mensual, …". */
    frequencySpoken: {
      weekly: 'semanal',
      monthly: 'mensual',
      yearly: 'anual',
    },
    list: {
      add: 'Agregar recurrente',
      emptyTitle: 'Nada recurrente todavía',
      emptyDetailAccount: 'Creá un gasto o ingreso recurrente para esta cuenta.',
      emptyDetail: 'Alquiler, suscripciones, sueldo o cualquier movimiento que se repita. FinanzApp lo anota en tus movimientos cuando vence, una sola vez. No paga ni cobra nada.',
      create: 'Crear recurrente',
      next30: 'Próximos 30 días',
      /** 24UX6E: the 30-day projection of expenses (it was «Pagos»: FinanzApp never pays anything). */
      payments: 'Gastos',
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
      /** VoiceOver label of a rule: merchant (user data), frequency, amount, currency code and next date (inside the sentence:
       * "próximo hoy"). 25B3: the row opens the rule's detail, so it names the rule itself, never an action («Editar»). */
      label: '{merchant}, {kind}, {frequency}, {category}, {amount} {currency}, próximo {date}',
      /** 24UX2: a paused rule never announces a next date. */
      labelPaused: '{merchant}, {kind}, {frequency}, {category}, {amount} {currency}, pausado',
      /** 25B3: the VoiceOver hint of a rule's row, in Recurrentes and in Inicio's Próximos compromisos. */
      hint: 'Abre el detalle del recurrente',
      paused: 'Pausado',
      /** 24UX5: an active rule FinanzApp could not bring up to date (its next date is already past). */
      review: 'Revisar',
      labelReview: '{merchant}, {kind}, {frequency}, {category}, {amount} {currency}, para revisar: sin registrar desde {date}',
      /** 24UX6E: a rule whose account or card was deleted (25B2), on its row and as its detail's state, instead of «Pausado». */
      closed: 'Cuenta eliminada',
      closedCard: 'Tarjeta eliminada',
      /** 24UX6E: its VoiceOver label; `{state}` is the row's own word (closed or closedCard), so the voice names what the eye reads. */
      labelClosed: '{merchant}, {kind}, {frequency}, {category}, {amount} {currency}, pausado: {state}',
    },
    /** 25B3: the rule's own screen (read first; Editar in the header opens the form). Its rows reuse the form's
     * labels (Próxima fecha, Frecuencia) and the shared ones (Categoría, Cuenta, Tarjeta). */
    detail: {
      edit: 'Editar recurrente',
      /** The state under the amount, beside «Pausado» and «Revisar» (row.paused, row.review). */
      active: 'Activo',
    },
    /** 24UX4: the trailing swipe actions of a rule (short) and the same actions in its detail (named). */
    manage: {
      pause: 'Pausar',
      resume: 'Reanudar',
      delete: 'Eliminar',
      pauseRule: 'Pausar recurrente',
      resumeRule: 'Reanudar recurrente',
      deleteRule: 'Eliminar recurrente',
      /** Under the detail's hero of a paused rule (24UX6E: the state word «Pausado» is right above, so the note does not repeat it). */
      pausedNote: 'No registra nada hasta que lo reanudes. Lo que venza mientras tanto no se registra.',
      /** 25B2/25B3: under the detail's hero (24UX6E) of a rule whose account or card was deleted: paused by the deletion, it records nothing
       * and cannot be resumed while it points at the closed row; Editar may move it to a live account or card of the same currency
       * (the recovery path), after which Reanudar comes back; Eliminar is the other way out. */
      closedNote: 'Su cuenta o tarjeta fue eliminada, así que no vuelve a registrarse. Podés elegir otra compatible desde Editar y después reanudarlo, o eliminar este recurrente.',
      /** 24UX5: under the detail's hero (24UX6E), over «Continuar desde hoy», of an active rule the catch-up could not record (a real failure; a long backlog is recorded on its own, in batches). */
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
    /** 24UX2: the movements a rule already recorded, in its detail (25B3: the detail screen, not the form). A scheduled date is not one of them. */
    history: {
      title: 'Registrados',
      caption: 'Movimientos que FinanzApp anotó por esta regla; no confirman un pago del banco. La próxima fecha es una estimación.',
      empty: 'Todavía no registró ningún movimiento.',
      older: { one: 'Y {count} registro anterior en Movimientos.', other: 'Y {count} registros anteriores en Movimientos.' },
    },
    /** The not-found state of the rule's detail and of its form (the same sentence). */
    edit: {
      notFoundTitle: 'No encontramos este recurrente',
      notFoundDetail: 'Volvé a Recurrentes para elegir una regla guardada en este dispositivo.',
    },
  },
} as const;
