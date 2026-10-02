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
      /** 24T3 (A28): a stopped plan is «sin seguimiento» («cancelar» a debt, in Argentina, reads as paying it). */
      cancelled: 'Sin seguimiento',
      /** 24T3: a completed plan whose remaining instalments an adelanto brought forward (never «pagado»). */
      broughtForward: 'Adelantado',
      /** 24T3: a completed plan whose whole price devoluciones returned. */
      refunded: 'Devuelto',
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
      cancelled: 'Sin seguimiento',
      broughtForward: 'Adelantado',
      refunded: 'Devuelto',
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
      /** What a plan without tracking no longer records (its instalments after the stop). */
      cancelledAmount: 'No se registra',
      /** 24T3: the principal an adelanto brought forward (part of what is recorded, «Ya registrado»). */
      settled: 'Cuotas adelantadas',
      settledPrincipal: 'Principal adelantado',
      /** 24T3: the financing an adelanto recorded as not charged by the issuer. */
      waivedInterest: 'Interés no cobrado',
      waivedFinancing: 'Financiación no cobrada',
      /** 24T3: devoluciones, two figures never merged: the credit that reversed recorded principal, and the future
       * instalments they lowered (never recorded, so never spending). */
      refundCredit: 'Devuelto a la tarjeta',
      refundFuture: 'Cuotas reducidas por devolución',
      /** 24T3 (A26): every devolución and adelanto of the plan, live or undone, one row each opening its detail (newest
       * first). A devolución made only of reductions has no line in Movimientos: this list is where it is reached. The row
       * names the kind and its date (written out, so VoiceOver reads it as shown); the value is the amount. */
      operations: 'Devoluciones y adelantos',
      operationRefund: 'Devolución · {date}',
      operationPayoff: 'Adelanto de cuotas · {date}',
      operationRefundUndone: 'Devolución deshecha · {date}',
      operationPayoffUndone: 'Adelanto deshecho · {date}',
      /** 24T3: under the hero of a plan without tracking (the hero's state word already says «Sin seguimiento»). */
      stoppedDetail: 'Las cuotas que faltaban no se registran. Las ya registradas siguen en Movimientos y en tus reportes.',
      schedule: 'Calendario',
      scheduleCaption: 'Cada cuota cuenta como gasto cuando cierra su resumen.',
      /** 24T3: the plan's actions, offered only when storage would accept them. Each one records, never acts: a devolución
       * and an adelanto open their own reviewed form. */
      refund: 'Registrar devolución',
      payoff: 'Registrar adelanto de cuotas',
      /** «Dejar de seguir»: the domain state stays `cancelled`; it is neither a devolución nor a payment. */
      stop: 'Dejar de seguir el plan',
      stopTitle: '¿Dejar de seguir este plan?',
      stopDetail: 'Las cuotas que faltan ({amount}) dejan de registrarse. Las ya registradas siguen en Movimientos. No es una devolución ni un pago: si devolviste la compra, usá Registrar devolución; si adelantaste las cuotas, Registrar adelanto de cuotas.',
      /** Before the stop, storage records the instalments whose statement already closed (24T3, M3); the alert names them. */
      stopCatchUp: { one: 'Antes se registra la cuota {numbers}, que ya cerró ({amount}).', other: 'Antes se registran las cuotas {numbers}, que ya cerraron ({amount}).' },
      stopConfirm: 'Dejar de seguir',
      stopFailed: 'No pudimos dejar de seguir el plan. Sigue como estaba; reintentá.',
      reactivate: 'Reactivar plan',
      reactivateTitle: '¿Reactivar este plan?',
      reactivateDetail: 'Sus cuotas vuelven a registrarse cuando cierra cada resumen.',
      /** The instalments whose statement closed while the plan was not tracked: recorded now, on their own closing dates. */
      reactivateCatchUp: { one: 'La cuota {numbers} cerró mientras no se seguía: se registra ahora por {amount}, con la fecha de su cierre ({dates}).',
        other: 'Las cuotas {numbers} cerraron mientras no se seguía: se registran ahora por {amount}, con la fecha de sus cierres ({dates}).' },
      reactivateConfirm: 'Reactivar',
      reactivateFailed: 'No pudimos reactivar el plan. Sigue como estaba; reintentá.',
      /** A span of closing dates: «28 oct 2026 a 28 dic 2026». Instalment numbers are written as runs («7–9», `numberRanges`). */
      datesRange: '{from} a {to}',
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
      /** 24T3 (A28): an instalment of a plan without tracking. */
      cancelled: 'No se registra',
      /** 24T3: an adelanto brought it forward (it counts, on the adelanto's date); never «pagada». */
      settled: 'Adelantada',
      /** 24T3: its remaining financing an adelanto recorded as not charged. */
      waived: 'No se cobró',
      /** 24T3: devoluciones lowered its principal to zero before it was recorded. */
      refunded: 'Devuelta',
      /** Under a row whose principal a devolución lowered (the row shows what it charges now). */
      reduced: 'Reducida por devolución: {amount}',
      /** Under a brought-forward row whose financing was not charged. */
      waivedInterest: 'Interés no cobrado {amount}',
      waivedFinancing: 'Financiación no cobrada {amount}',
      openHint: 'Abre el movimiento de la cuota',
      openPayoffHint: 'Abre el adelanto de cuotas',
      openRefundHint: 'Abre la devolución',
    },
    /** 24T3: «Registrar adelanto de cuotas», the reviewed sheet over a plan. The remaining instalments are recognised once,
     * on the adelanto's date, in the card's outstanding balance; the payment to the card stays a separate transfer. */
    payoff: {
      /** Above the hero amount: "Cuotas que faltaban · ARS". */
      eyebrow: 'Cuotas que faltaban',
      covered: 'Lo que se adelanta',
      numbers: { one: 'Cuota', other: 'Cuotas' },
      /** One row per component brought forward; «Importe» when the plan has no financing. */
      amount: 'Importe',
      principal: 'Principal de las cuotas',
      interest: 'Interés',
      fee: 'Comisiones',
      tax: 'Impuestos de financiación',
      financingTitle: 'Intereses y cargos futuros',
      financingCaption: 'Elegí qué pasó con ellos. Un cargo por adelantar se registra aparte, como un gasto de la tarjeta.',
      recognise: 'Los registro ahora',
      recogniseDetail: 'Se suman al adelanto, con la misma fecha.',
      waive: 'El emisor no los cobró',
      waiveDetail: 'No se registran; el plan los muestra como no cobrados.',
      date: 'Fecha del adelanto',
      /** What Save records, said before it (A29: the payment is never inferred). */
      sentence: 'FinanzApp registra con fecha {date} las cuotas que faltaban ({amount}) en el saldo pendiente de la tarjeta. El pago a la tarjeta se registra aparte, con Pagar tarjeta.',
      undone: { one: 'La cuota {numbers} está deshecha: no se adelanta y sigue pendiente en el plan.',
        other: 'Las cuotas {numbers} están deshechas: no se adelantan y siguen pendientes en el plan.' },
      save: 'Registrar adelanto',
      retryNote: 'Conservamos el envío: Reintentar nunca registra el adelanto dos veces. Para cambiarlo, cerrá y revisá primero el plan.',
      saveFailed: 'No pudimos confirmar el adelanto. Reintentá; nunca se registra dos veces.',
      unavailableTitle: 'No hay cuotas para adelantar',
      doneTitle: 'Adelanto registrado',
      doneDetail: 'Las cuotas que faltaban ya están en el saldo pendiente de {card}. Cuando pagues la tarjeta, registralo con Pagar tarjeta.',
    },
  },
} as const;
