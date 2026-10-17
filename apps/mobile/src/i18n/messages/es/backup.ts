/** Copia de seguridad: export, import and review. */
export const backup = {
  backup: {
    export: {
      /** Section title and button label. */
      share: 'Compartir copia',
      /** 25Q2: the uninstall consequence first (production-plan.md §1.3), then what to do; nothing claimed about iCloud (unverified). */
      intro: 'Si borrás la app, tus registros se borran con ella. Guardá una copia antes de borrarla o de cambiar de teléfono.',
      note: 'El archivo no está cifrado: guardalo en un lugar privado.',
      importTitle: 'Importar copia',
      importSubtitle: 'Revisar el archivo antes de agregar',
      /** Title of the system share sheet (shown by Android; iOS ignores it). */
      dialogTitle: 'Guardar copia de FinanzApp',
      sharingUnavailable: 'No está disponible el menú para compartir en este dispositivo.',
      tooLarge: 'La copia supera el límite de 5 MB. No borres la app: tus datos siguen guardados en este dispositivo.',
      prepareFailed: 'No se pudo preparar la copia. Tus datos siguen en el dispositivo.',
    },
    import: {
      tooLarge: 'La copia supera 5 MB. Conservá el archivo; no se importó nada.',
      readFailed: 'No se pudo leer la copia. Tus datos y el archivo siguen intactos.',
      reviewFailed: 'No se pudo revisar la copia.',
      verifyFailed: 'No se pudo verificar la importación. Reintentá con la misma copia para comprobarla sin duplicar datos.',
      /** 25Q4: {date} is the export date and time from the file's header, as «Copia del {date}» shows it. */
      confirmTitle: '¿Importar la copia del {date}?',
      /** 25Q4: what is added, and the one consequence the review cannot show: there is no undo of the whole import. */
      confirmMessage: 'Se agregan solo los registros que faltan; no se reemplaza nada. Lo importado no se puede quitar de una sola vez: se deshace o se elimina de a uno.',
      /** Alert button. */
      confirmButton: 'Importar',
      doneTitle: 'Copia importada',
      doneDetail: 'Tus cuentas, tarjetas, deudas, movimientos, presupuestos y recurrentes ya están guardados en este dispositivo. No se duplicaron registros existentes.',
      chooseAnother: 'Elegir otra copia',
      emptyTitle: 'Recuperá tus registros',
      emptyDetail: 'Elegí una copia de FinanzApp. Vas a revisar los cambios antes de guardarlos. El archivo no se envía a ningún servidor.',
      choose: 'Elegir copia',
      reviewTitle: 'Revisar copia',
      /** 25Q4: under the file name. {date}: the export date and time from the file's header. */
      exportedAt: 'Copia del {date}',
      /** 25Q4: {date}: the newest live movement or transfer inside the copy; omitted when it has none. */
      latestMovement: 'Último movimiento: {date}',
      /** Review rows: what the backup would add; the value is a count. */
      rows: {
        accounts: 'Cuentas nuevas',
        cards: 'Tarjetas nuevas',
        debts: 'Deudas nuevas',
        movements: 'Movimientos nuevos',
        transfers: 'Transferencias nuevas',
        recurring: 'Recurrentes nuevos',
        budgets: 'Presupuestos nuevos',
        /** 24T2: purchases in instalments the copy adds (each with its schedule). */
        plans: 'Planes de cuotas nuevos',
        /** 24T3: devoluciones and adelantos de cuotas the copy adds (live ones; undone ones count in «Deshechos a conservar»). */
        operations: 'Devoluciones y adelantos nuevos',
        voided: 'Deshechos a conservar',
        present: 'Registros ya presentes',
      },
      /** Records whose content differs from this device; nothing is imported. `one` is singular ("Hay 1 registro…"), `other` plural. */
      conflicts: {
        one: 'Hay {count} registro con cambios diferentes. No se importará nada. Esta copia no puede reemplazar correcciones locales ni reactivar movimientos deshechos.',
        other: 'Hay {count} registros con cambios diferentes. No se importará nada. Esta copia no puede reemplazar correcciones locales ni reactivar movimientos deshechos.',
      },
      availableAfter: 'Disponible después',
      availableCaption: 'Solo cuentas de dinero. Tarjetas y deudas no se suman.',
      /** Label above the current balance, under the balance after import. */
      now: 'Ahora',
      /** 25Q4: the movements the restore's catch-up also records for the copy's rules and plans (what fell due since the copy
       * was made); they are not in «Disponible después». `one` is singular, `other` plural. 25Q4 review: it counts movements,
       * never due dates (a financed instalment records one per part). */
      catchUp: {
        one: 'Al importar también se registra {count} movimiento de un recurrente o una cuota que venció después de la copia, así que tus saldos pueden diferir de esta revisión.',
        other: 'Al importar también se registran {count} movimientos de recurrentes o cuotas que vencieron después de la copia, así que tus saldos pueden diferir de esta revisión.',
      },
      noAccounts: 'No contiene cuentas.',
      onlyMissing: 'Solo se agrega lo que falta. No se reemplaza ni se borra nada.',
      nothingNew: 'Esta copia ya está importada. No hay nada nuevo para agregar.',
      reviewAgain: 'Volver a revisar',
      confirmImport: 'Confirmar importación',
      /** Review row: the currency scales a v9 copy pins that this device has not pinned yet. */
      units: 'Monedas nuevas',
      /** Shown instead of the import button when the copy pins a currency at another number of decimals than this device. {codes} lists them. */
      scaleConflict: 'La copia registra otra cantidad de decimales para {codes}. No se importará nada: los importes nunca se reinterpretan. Conservá el archivo.',
    },
  },
} as const;
