/** Copia de seguridad: export, import and review. */
export const backup = {
  backup: {
    export: {
      /** Section title and button label. */
      share: 'Compartir copia',
      intro: 'Guardá tus cuentas, tarjetas, deudas, movimientos, presupuestos y recurrentes en un lugar privado antes de borrar la app o cambiar de teléfono.',
      note: 'Incluye el estado actual y los movimientos deshechos. El archivo no está cifrado: guardalo en un lugar privado.',
      importTitle: 'Importar copia',
      importSubtitle: 'Revisar el archivo antes de agregar',
      footer: 'Una copia es una foto de tus datos, no una sincronización entre dispositivos. Importar solo agrega lo que falta y nunca reemplaza registros existentes.',
      /** Title of the system share sheet (shown by Android; iOS ignores it). */
      dialogTitle: 'Guardar copia de FinanzApp',
      sharingUnavailable: 'No está disponible el menú para compartir en este dispositivo.',
      tooLarge: 'La copia supera el límite de 5 MB de este piloto. No borres la app; conservá tus datos mientras ampliamos la recuperación.',
      prepareFailed: 'No se pudo preparar la copia. Tus datos siguen en el dispositivo.',
    },
    import: {
      tooLarge: 'La copia supera 5 MB. Conservá el archivo; no se importó nada.',
      readFailed: 'No pudimos leer la copia. Tus datos y el archivo siguen intactos.',
      reviewFailed: 'No pudimos revisar la copia.',
      verifyFailed: 'No pudimos verificar la importación. Reintentá con la misma copia para comprobarla sin duplicar datos.',
      confirmTitle: '¿Importar esta copia?',
      confirmMessage: 'Se agregarán únicamente los registros que faltan. No se reemplazan tus datos actuales.',
      /** Alert button. */
      confirmButton: 'Importar',
      doneTitle: 'Copia incorporada',
      doneDetail: 'Tus cuentas, tarjetas, deudas, movimientos, presupuestos y recurrentes ya están guardados en este dispositivo. No se duplicaron registros existentes.',
      chooseAnother: 'Elegir otra copia',
      emptyTitle: 'Recuperá tus registros',
      emptyDetail: 'Elegí una copia del piloto nativo. Podrás revisar los cambios antes de guardarlos. No se envía el archivo a ningún servidor.',
      choose: 'Elegir copia',
      reviewTitle: 'Revisar copia',
      /** Review rows: what the backup would add; the value is a count. */
      rows: {
        accounts: 'Cuentas nuevas',
        cards: 'Tarjetas nuevas',
        debts: 'Deudas nuevas',
        movements: 'Movimientos nuevos',
        transfers: 'Transferencias nuevas',
        recurring: 'Recurrentes nuevos',
        budgets: 'Presupuestos nuevos',
        voided: 'Deshechos a conservar',
        present: 'Registros ya presentes',
      },
      /** Both Spanish forms keep the plural wording the screen has always shown. */
      conflicts: {
        one: 'Hay {count} registro con cambios diferentes. No se importará nada. Esta copia no puede reemplazar correcciones locales ni reactivar movimientos deshechos.',
        other: 'Hay {count} registros con cambios diferentes. No se importará nada. Esta copia no puede reemplazar correcciones locales ni reactivar movimientos deshechos.',
      },
      availableAfter: 'Disponible después',
      availableCaption: 'Solo cuentas de dinero. Tarjetas y deudas no se suman.',
      /** Label above the current balance, under the balance after import. */
      now: 'Ahora',
      noAccounts: 'No contiene cuentas.',
      onlyMissing: 'Solo se agrega lo que falta. No se reemplaza ni se borra nada.',
      nothingNew: 'Esta copia ya está incorporada. No hay nada nuevo para agregar.',
      reviewAgain: 'Volver a revisar',
      confirmImport: 'Confirmar importación',
      formats: 'Copias nativas v1 a v8 · JSON de hasta 5 MB. La importación de la app web e inversiones llegará en otra etapa.',
    },
  },
} as const;
