/** Más: the hub rows, the footer and its diagnostics. */
export const settings = {
  settings: {
    sections: {
      finance: 'Finanzas',
      appData: 'App y datos',
    },
    /** Hub rows: a title, and a subtitle that is a live count or a placeholder when there is nothing to count. */
    rows: {
      accounts: 'Cuentas',
      accountsSubtitle: 'Saldos y movimientos',
      cards: 'Tarjetas',
      cardsSubtitle: 'Compras y resúmenes',
      cardsCount: { one: '{count} tarjeta de crédito', other: '{count} tarjetas de crédito' },
      budgets: 'Presupuestos',
      budgetsSubtitle: 'Plan mensual',
      /** Budgets set for the current month. */
      budgetsCount: { one: '{count} este mes', other: '{count} este mes' },
      recurring: 'Recurrentes',
      recurringSubtitle: 'Pagos e ingresos',
      recurringCount: { one: '{count} activo', other: '{count} activos' },
      debts: 'Deudas y cobros',
      /** Placeholder: "I owe · they owe me". */
      debtsSubtitle: 'Debo · me deben',
      debtsCount: { one: '{count} pendiente', other: '{count} pendientes' },
      categories: 'Categorías',
      categoriesSubtitle: 'Gastos e ingresos',
      /** Category definitions the person created or edited. */
      categoriesCount: { one: '{count} personalizada', other: '{count} personalizadas' },
      backup: 'Copia de seguridad',
      backupSubtitle: 'Compartir e importar',
      undone: 'Movimientos deshechos',
      undoneNone: 'Ninguno',
      undoneCount: { one: '{count} recuperable', other: '{count} recuperables' },
    },
    localNote: 'Tus registros quedan en este dispositivo y podés registrar sin conexión. La sincronización todavía no está activada.',
    /** Diagnostic footer; `release` is the internal release name ("23.1B2") and is not translated. */
    footer: 'FinanzApp · Piloto nativo {version} · Producto {release} · {material} · {source}',
    /** Which control material this session draws, for a tester. */
    material: {
      disabled: 'Material opaco (desactivado)',
      expoGo: 'Material opaco (Expo Go)',
      platform: 'Material opaco',
      notRegistered: 'Material opaco (sin módulo nativo)',
      unavailable: 'Material opaco (iOS sin Liquid Glass)',
      api: 'Material opaco (API no disponible)',
      reduceTransparency: 'Material opaco (Reducir transparencia)',
      glass: 'Liquid Glass',
    },
    /** Where this launch read the device languages; "módulo nativo" proves the build links expo-localization. */
    localeSource: {
      native: 'Idioma: módulo nativo',
      intl: 'Idioma: Intl (sin módulo nativo)',
      none: 'Idioma: predeterminado',
    },
  },
} as const;
