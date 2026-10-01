/** Producto 24T2: a purchase in instalments, as the card detail lists it and as its own plan detail shows it. An
 * instalment is «registrada» when its movement is in the ledger (it counts once, when its statement closes); never
 * «pagada»: a card payment is never assigned to an instalment (decision 003, rule 7). */
export const installments = {
  installments: {
    /** One plan in the card detail's Cuotas section. */
    row: {
      count: { one: '{count} cuota', other: '{count} cuotas' },
      /** `{count}` instalments recorded of `{total}`: "3/12 registradas". */
      recorded: { one: '{count}/{total} registrada', other: '{count}/{total} registradas' },
      /** VoiceOver: "3 de 12 registradas". */
      recordedSpoken: { one: '{count} de {total} registrada', other: '{count} de {total} registradas' },
      /** VoiceOver: the principal not recognised yet, "900000,00 pesos restantes". */
      remaining: '{amount} restantes',
      /** Under the amount on screen: "$ 900.000,00" over "restantes". */
      remainingCaption: 'restantes',
      /** A plan with interest: the figure is its principal still to come (the future interest is in the plan's detail). */
      remainingPrincipal: '{amount} de principal restante',
      remainingPrincipalCaption: 'principal restante',
      next: 'Próxima cuota · {date}',
      /** VoiceOver: "próxima cuota el 28 de octubre de 2026". */
      nextSpoken: 'próxima cuota el {date}',
      completed: 'Completo',
      cancelled: 'Cancelado',
      openHint: 'Abre el plan de cuotas',
    },
    detail: {
      /** Above the price: "Compra en cuotas · ARS". */
      eyebrow: 'Compra en cuotas',
      /** 24UX6D: one phrase under the price, «12 cuotas sin interés». */
      noInterest: { one: '{count} cuota sin interés', other: '{count} cuotas sin interés' },
      withInterest: { one: '{count} cuota con interés', other: '{count} cuotas con interés' },
      /** The plan's state, one word (el plan). */
      active: 'Activo',
      completed: 'Completo',
      cancelled: 'Cancelado',
      card: 'Tarjeta',
      purchaseDate: 'Fecha de compra',
      price: 'Precio',
      totalFinanced: 'Total financiado',
      interest: 'Interés total',
      fees: 'Comisiones',
      taxes: 'Impuestos de financiación',
      /** 24UX6D: the progress under the hero, by the instalments the ledger recognised (never «pagadas»): "3 de 12 registradas". */
      progress: { one: '{count} de {total} registrada', other: '{count} de {total} registradas' },
      /** The principal already recognised. */
      recorded: 'Ya registrado',
      /** The principal still to come. */
      future: 'Cuotas futuras',
      /** The principal not recognised (future, undone or stopped). */
      remaining: 'Restante',
      undone: 'Deshecho',
      /** A plan with interest: the same figures named as principal, since each instalment also carries its interest, and
       * the interest still to come on its own row. Never added together. */
      recordedPrincipal: 'Principal registrado',
      futurePrincipal: 'Principal futuro',
      remainingPrincipal: 'Principal restante',
      undonePrincipal: 'Principal deshecho',
      futureInterest: 'Interés futuro',
      futureFinancing: 'Financiación futura',
      cancelledAmount: 'Cancelado',
      schedule: 'Calendario',
      scheduleCaption: 'Cada cuota cuenta como gasto cuando cierra su resumen.',
      /** The one lifecycle action of 24T2: a plan that recorded nothing yet (created by mistake). */
      delete: 'Eliminar plan',
      deleteTitle: '¿Eliminar este plan de cuotas?',
      deleteDetail: 'Todavía no registró ninguna cuota. Se elimina el plan y ningún saldo cambia.',
      deleteConfirm: 'Eliminar',
      deleteFailed: 'No pudimos eliminar el plan. Sigue como estaba; reintentá.',
      notFoundTitle: 'No encontramos este plan de cuotas',
      notFoundDetail: 'Volvé a la tarjeta para ver sus planes guardados en este dispositivo.',
    },
    /** One instalment of the plan detail's Calendario. */
    schedule: {
      number: 'Cuota {number} de {count}',
      /** The statement it belongs to (its closing) and that statement's due date. */
      dates: 'Cierra {closing} · vence {due}',
      /** VoiceOver: the same two dates written out. */
      datesSpoken: 'cierra {closing}, vence {due}',
      interest: 'Incluye interés {amount}',
      financing: 'Incluye financiación {amount}',
      /** The instalment's state, one word (la cuota). */
      recognised: 'Registrada',
      /** Some shares of the instalment count and the person undid another (its principal or its interest). */
      partial: 'Registrada en parte',
      /** Under a partial row: what still counts and what was undone. */
      partialDetail: 'Cuenta {counted} · deshecho {undone}',
      next: 'Próxima',
      future: 'Futura',
      undone: 'Deshecha',
      cancelled: 'Cancelada',
      openHint: 'Abre el movimiento de la cuota',
    },
  },
} as const;
