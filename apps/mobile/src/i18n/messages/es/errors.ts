/** Messages thrown by the domain and the storage layer, recognised by their exact Spanish text. */
export const errors = {
  /** Messages the ledger, the domain and the storage layer raise, in the
   * exact Spanish they are thrown with: `localizeError` recognises a thrown
   * message by this text and shows the reader's language. The test suite
   * checks that each one is still thrown verbatim somewhere, so a reworded
   * source message fails instead of silently staying in Spanish. */
  errors: {
    domain: {
      invalidAmount: 'Monto inválido.',
      enterAmount: 'Ingresá un monto válido.',
      twoDecimals: 'Usá números con hasta dos decimales.',
      amountTooLarge: 'El monto es demasiado grande.',
      invalidId: 'Identificador inválido.',
      existingAccount: 'Elegí una cuenta existente.',
      expenseOrIncome: 'Elegí gasto o ingreso.',
      positiveAmount: 'El monto debe ser mayor que cero y tener hasta dos decimales.',
      merchant: 'Ingresá un comercio o concepto de hasta 120 caracteres.',
      category: 'Ingresá una categoría de hasta 60 caracteres.',
      validDate: 'Elegí una fecha válida.',
      twoAccounts: 'Elegí dos cuentas distintas.',
      sameCurrency: 'Las dos cuentas deben tener la misma moneda.',
      transferAmount: 'Ingresá un monto mayor que cero y con hasta dos decimales.',
      note: 'Usá una nota de hasta 120 caracteres.',
      balanceRange: 'El saldo supera el rango seguro.',
      totalRange: 'El total supera el rango seguro.',
      transferVersion: 'Versión de transferencia inválida.',
      transferChanged: 'La transferencia cambió. Volvé a abrirla.',
      transferCurrency: 'Conservá la moneda original de la transferencia.',
    },
    storage: {
      newerVersion: 'Estos datos requieren una versión más nueva de FinanzApp. No se modificaron.',
      entryState: 'Estado de movimiento inválido.',
      transferState: 'Estado de transferencia inválido.',
      operationExistsForm: 'Esta operación ya existe con otros datos. Volvé a abrir el formulario.',
      operationExistsMovements: 'Esta operación ya existe con otros datos. Revisá tus movimientos.',
      operationExistsEntry: 'Esta operación ya existe con otros datos. Volvé a abrir el movimiento.',
      operationExists: 'Esta operación ya existe con otros datos.',
      entryChanged: 'El movimiento cambió desde que lo abriste. Cerrá este formulario y revisá la versión actual.',
      transferExists: 'Esta transferencia ya existe con otros datos.',
      transferChanged: 'La transferencia cambió. Cerrá el formulario y volvé a abrirla.',
      openFailed: 'No pudimos abrir tus datos. No se borró ni reemplazó nada. Probá nuevamente o conservá la app para recuperar la base.',
      verifyFailed: 'No pudimos verificar tus datos locales ni los vencimientos recurrentes. No se modificó nada fuera de una transacción completa.',
      stillOpening: 'Todavía estamos abriendo tus datos.',
      refreshFailed: 'El guardado terminó, pero no pudimos actualizar la vista. Verificá de nuevo antes de registrar otro movimiento; no lo cargues otra vez.',
    },
  },
} as const;
