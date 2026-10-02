/** Producto 24T3: the purchase operations as the person meets them: a **devolución** (a purchase returned, in whole or in
 * part; never «reembolso», which is the income preset, and never an income) and an **adelanto de cuotas** (the remaining
 * instalments of a plan brought forward; never «pagada»: the card payment is its own transfer). The refund form, the
 * operation's own detail, the rows that list them, and what the movement detail and the movement form say about a
 * purchase with devoluciones. */
export const operations = {
  operations: {
    /** Header titles of the routes (`app/_layout.tsx`); each form also sets its own. */
    titles: {
      refund: 'Registrar devolución',
      payoff: 'Registrar adelanto de cuotas',
      operation: 'Devolución',
    },
    /** One line in Movimientos, a card, an account, Inicio or a report. */
    row: {
      refundWord: 'Devolución',
      payoffWord: 'Adelanto de cuotas',
      refund: 'Devolución · {merchant}',
      payoff: 'Adelanto de cuotas · {merchant}',
      /** A financing share brought forward with the principal: its component word. */
      payoffShare: {
        interest: 'Adelanto de cuotas · interés · {merchant}',
        fee: 'Adelanto de cuotas · comisión · {merchant}',
        tax: 'Adelanto de cuotas · impuesto · {merchant}',
      },
      /** VoiceOver for a financing share: the kind word first, then the component. */
      payoffShareSpoken: {
        interest: 'interés',
        fee: 'comisión',
        tax: 'impuesto',
      },
    },
    /** The modal form «Registrar devolución» (an ordinary purchase or an instalment plan). */
    refund: {
      title: 'Registrar devolución',
      /** Above the purchase's price: "Compra · ARS" / "Compra en cuotas · ARS". */
      purchase: 'Compra',
      planPurchase: 'Compra en cuotas',
      /** The one-line note under the purchase: what a devolución de compra is. A bank reintegro / cashback / promoción is
       * not one; the help (its InfoButton) says it is an income in the account that received it. */
      note: 'Devolución de compra: el comercio te devuelve toda o parte de esta compra.',
      helpTitle: 'Devolución de compra',
      helpDetail: 'Usá esta opción cuando un comercio te devuelve total o parcialmente una compra. Si recibiste un reintegro, cashback o promoción bancaria en una cuenta, registralo como ingreso en esa cuenta.',
      amount: 'Devolución',
      /** The shortcut that fills what can still be returned. */
      available: 'Total disponible',
      availableCaption: 'Disponible para devolver: {currency} {amount}',
      /** A plan returns its price only (A17). */
      availablePlanCaption: 'Hasta {currency} {amount}: el precio; el interés no se devuelve desde acá',
      account: 'Cuenta',
      card: 'Tarjeta',
      purchaseDate: 'Fecha de compra',
      refunded: 'Ya devuelto',
      date: 'Fecha de la devolución',
      /** The live preview: exactly what Save records. */
      previewTitle: 'Qué se registra',
      previewEntry: 'Se acreditan {amount} en {account} con fecha {date} y se restan de {category} en {month}. No es un ingreso.',
      previewCredit: '{amount} vuelven a {card} con fecha {date} y se restan de {category} en {month}. No es un ingreso.',
      previewTailOne: 'La cuota {from} baja {amount} y no se registra por esa parte.',
      previewTailMany: 'Las cuotas {from} a {to} bajan {amount} en total y no se registran por esa parte.',
      previewInterest: 'El interés de esas cuotas sigue como estaba.',
      /** A17: the price is all returned and financing is still scheduled. */
      previewFinancingStays: 'No queda precio por registrar, pero el interés y los cargos siguen. Si el emisor no los cobra, dejá de seguir el plan desde su detalle.',
      save: 'Registrar devolución',
      retryNote: 'Reintentá: se envía la misma devolución y no se registra dos veces.',
      saveUnverified: 'No pudimos verificar la devolución. Reintentá: no se registra dos veces.',
      nothingTitle: 'No queda nada por devolver',
      nothingEntry: 'Esta compra ya se devolvió entera. Sus devoluciones están en su detalle.',
      nothingPlan: 'El precio de este plan ya se devolvió o no tiene cuotas registradas ni por registrar.',
      blockedTitle: 'No se puede registrar una devolución',
      notFoundTitle: 'No encontramos esta compra',
      notFoundDetail: 'Volvé a Movimientos para ver lo que guardaste en este dispositivo.',
    },
    /** The read-only detail of a devolución or an adelanto (`/operation/[id]`). */
    detail: {
      refundTitle: 'Devolución',
      payoffTitle: 'Adelanto de cuotas',
      statusRefund: 'Registrada · resta del gasto, no es un ingreso',
      statusPayoff: 'Registrado · las cuotas restantes cuentan con esta fecha',
      statusVoidedRefund: 'Deshecha · no cuenta en saldos ni reportes',
      statusVoidedPayoff: 'Deshecho · no cuenta en saldos ni reportes',
      purchase: 'Compra',
      plan: 'Plan de cuotas',
      account: 'Cuenta',
      card: 'Tarjeta',
      category: 'Categoría',
      date: 'Fecha',
      effects: 'Qué registra',
      effectEntry: 'Acredita {amount} en {account} y resta del gasto de {category} en {month}. No es un ingreso.',
      effectCredit: 'Devuelve {amount} a {card} y los resta del gasto de {category} en {month}. No es un ingreso.',
      /** One reduced instalment. */
      reduction: 'Cuota {number}',
      reductionValue: 'Baja {amount}',
      effectReductions: 'Esas cuotas se registran por lo que queda; su interés no cambia.',
      /** An adelanto: what it brought forward, by component. */
      settledPrincipal: 'Precio adelantado',
      settledShare: {
        interest: 'Interés adelantado',
        fee: 'Comisiones adelantadas',
        tax: 'Impuestos adelantados',
      },
      waivedShare: {
        interest: 'Interés',
        fee: 'Comisiones',
        tax: 'Impuestos',
      },
      waivedValue: 'No se cobró',
      covered: 'Cuotas',
      coveredValue: { one: 'Cuota {range}', other: 'Cuotas {range}' },
      payoffNote: 'Cuentan como gasto de la tarjeta con esta fecha, una sola vez. El pago a la tarjeta se registra aparte con Pagar tarjeta.',
      undoRefund: 'Deshacer devolución',
      undoPayoff: 'Deshacer adelanto',
      restoreRefund: 'Restaurar devolución',
      restorePayoff: 'Restaurar adelanto',
      /** Why the action is not offered (the domain's reason follows). */
      blockedTitle: 'No se puede deshacer ahora',
      blockedRestoreTitle: 'No se puede restaurar ahora',
      notFoundTitle: 'No encontramos esta operación',
      notFoundDetail: 'Volvé a Movimientos para ver lo que guardaste en este dispositivo.',
    },
    /** The confirmation of an undo or a restore (named from the dry run's outcome). */
    change: {
      voidRefundQuestion: '¿Deshacer devolución?',
      voidPayoffQuestion: '¿Deshacer adelanto?',
      restoreRefundQuestion: '¿Restaurar devolución?',
      restorePayoffQuestion: '¿Restaurar adelanto?',
      /** The purchase's last live devolución: nothing stays returned. */
      voidEntryRefund: 'Deja de acreditar {amount} en {account} y la compra vuelve a contar entera en {category}.',
      /** Other live devoluciones of the purchase stay: only this one's amount counts again ({count} = the others). */
      voidEntryRefundOthers: {
        one: 'Deja de acreditar {amount} en {account} y la compra vuelve a contar {amount} más en {category}. Su otra devolución sigue.',
        other: 'Deja de acreditar {amount} en {account} y la compra vuelve a contar {amount} más en {category}. Sus otras {count} devoluciones siguen.',
      },
      voidPlanCredit: 'Deja de acreditar {amount} en la tarjeta.',
      voidPlanReductions: { one: 'La cuota {range} vuelve a su importe.', other: 'Las cuotas {range} vuelven a su importe.' },
      voidPayoff: 'Las cuotas adelantadas ({amount} de precio) vuelven a quedar pendientes y dejan de contar con esta fecha.',
      /** The catch-up of the same commit (A8): instalments whose statement already closed are recorded on their own closings. */
      recordsShares: { one: 'Se registra la cuota {range} en su cierre ({amount}).', other: 'Se registran las cuotas {range} en sus cierres ({amount}).' },
      payoffNotRestorable: 'Este adelanto no podrá restaurarse.',
      restoreEntryRefund: 'Vuelve a acreditar {amount} en {account} con fecha {date}.',
      restorePlanRefund: 'Vuelve a devolver {amount} del precio con fecha {date}, como cuando se registró.',
      restorePayoff: 'Las cuotas vuelven a contar con fecha {date} ({amount} de precio).',
      voidEffect: 'Podés restaurarla después desde Movimientos deshechos.',
      voidPayoffEffect: 'Podés restaurarlo después desde Movimientos deshechos mientras ninguna cuota se registre.',
      void: 'Deshacer',
      restore: 'Restaurar',
      failed: 'No pudimos verificar el cambio. Reintentá: no se aplica dos veces.',
    },
    /** The movement detail of an ordinary purchase. */
    entry: {
      refund: 'Registrar devolución',
      refunds: 'Devoluciones',
      /** Under the section title: "Devuelto $ 300,00 de $ 1.200,00". */
      refunded: 'Devuelto {amount} de {total}',
      /** Undo of a purchase with live devoluciones: checked before the confirmation (A26). */
      blockedTitle: 'Esta compra tiene devoluciones',
      blockedDetail: { one: 'Para deshacerla, primero deshacé su devolución.', other: 'Para deshacerla, primero deshacé sus {count} devoluciones; están en su detalle.' },
      viewRefunds: 'Ver devoluciones',
    },
    /** Movimientos deshechos: undone devoluciones and adelantos. */
    undone: {
      section: 'Devoluciones y adelantos',
      restore: 'Restaurar',
    },
    /** The movement form while it edits a purchase with live devoluciones (A26 pre-validation). */
    edit: {
      refundedNote: 'Esta compra tiene devoluciones por {amount}: su monto no baja de eso, su fecha no pasa de la primera devolución y sigue siendo un gasto en la misma cuenta.',
      belowRefunded: 'El monto no puede ser menor que lo ya devuelto de esta compra.',
      afterRefund: 'La fecha no puede ser posterior a la primera devolución de esta compra.',
      kindLocked: 'Una compra con devoluciones sigue siendo un gasto.',
      accountLocked: 'Una compra con devoluciones queda en su cuenta.',
    },
    /** The income preset «Reembolsos», when chosen: a purchase returned is not an income (A28); a bank reintegro, cashback
     * or promoción that reached an account is, so it stays here. */
    refundHint: '¿Un comercio te devolvió una compra? Registrala desde la compra con «Registrar devolución»: no es un ingreso. Un reintegro, cashback o promoción del banco sí se registra acá, como ingreso.',
  },
} as const;
