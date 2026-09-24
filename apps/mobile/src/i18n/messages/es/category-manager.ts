/** Categorías: the list, the category form and the icon/colour picker. */
export const categoryManager = {
  categoryManager: {
    list: {
      intro: 'Tocá una categoría para cambiar su nombre, ícono o color, o para archivarla. Los movimientos anteriores nunca cambian.',
      expenses: 'Gastos',
      incomes: 'Ingresos',
      archived: 'Archivadas',
      archivedCaption: 'No se ofrecen al registrar; los movimientos que las usan siguen igual.',
      /** Where a category comes from, under its name. */
      source: {
        preset: 'Predeterminada',
        presetEdited: 'Predeterminada · editada',
        custom: 'Propia',
        historical: 'Histórica',
      },
      /** VoiceOver name of a row: "Comida, 3 movimientos · Predeterminada". */
      rowLabel: '{name}, {usage}',
      rowLabelArchived: '{name}, {usage}, archivada',
      rowHint: 'Edita el nombre, el ícono y el color',
    },
    notFound: {
      title: 'No encontramos esta categoría',
      detail: 'Volvé a Categorías para elegir una de la lista.',
    },
    form: {
      name: 'Nombre',
      namePlaceholder: 'Ej. Kiosco',
      archivedNote: 'Archivada: no se ofrece al registrar; tus movimientos anteriores la conservan.',
      editNote: 'Cambiar el nombre, el ícono o el color no modifica ningún movimiento, presupuesto ni recurrente.',
      /** `stored` is the spelling movements carry; `shown` the new display name. */
      renamedNote: 'Los movimientos se siguen registrando como «{stored}» y se muestran como «{shown}».',
      availableExpense: 'Quedará disponible enseguida al registrar gastos.',
      availableIncome: 'Quedará disponible enseguida al registrar ingresos.',
      retryNote: 'Reintentá el mismo guardado. Para cambiarlo, cerrá y revisá primero la lista.',
      create: 'Crear categoría',
      archive: 'Archivar categoría',
      unarchive: 'Desarchivar categoría',
      nameTaken: 'Ya existe una categoría con ese nombre. Editala desde la lista o elegí otro nombre.',
      checkName: 'Revisá el nombre.',
      saveUnverified: 'No pudimos verificar el guardado. Reintentá el mismo cambio.',
      archiveTitle: '¿Archivar categoría?',
      unarchiveTitle: '¿Desarchivar categoría?',
      archiveMessage: '«{name}» dejará de ofrecerse al registrar. Tus movimientos, presupuestos y recurrentes anteriores la conservan tal cual.',
      unarchiveMessage: '«{name}» volverá a ofrecerse al registrar movimientos.',
      /** Alert buttons. */
      archiveConfirm: 'Archivar',
      unarchiveConfirm: 'Desarchivar',
    },
    picker: {
      /** VoiceOver name of the preview tile: "Vista previa: Banco en Celeste". */
      preview: 'Vista previa: {icon} en {color}',
      unnamed: 'Sin nombre',
      icon: 'Icono',
      color: 'Color',
    },
    /** Names of the category icons, by icon id (not by category). */
    icons: {
      food: 'Comida', groceries: 'Supermercado', restaurant: 'Restaurantes', cafe: 'Café', drinks: 'Bebidas', transport: 'Transporte',
      fuel: 'Combustible', plane: 'Viajes', home: 'Hogar', rent: 'Alquiler', utilities: 'Servicios', internet: 'Internet', phone: 'Celular',
      subscriptions: 'Suscripciones', health: 'Salud', pharmacy: 'Farmacia', fitness: 'Deporte', beauty: 'Belleza', education: 'Educación',
      clothing: 'Ropa', tech: 'Tecnología', leisure: 'Ocio', music: 'Música', games: 'Juegos', pets: 'Mascotas', gifts: 'Regalos',
      family: 'Familia', taxes: 'Impuestos', insurance: 'Seguros', bank: 'Banco', work: 'Trabajo', sales: 'Ventas', investment: 'Inversiones',
      refund: 'Reembolsos', loan: 'Préstamos', repairs: 'Reparaciones', other: 'Otros',
    },
    /** Names of the account icons, by icon id. */
    accountIcons: {
      wallet: 'Billetera', cash: 'Efectivo', bank: 'Banco', digital: 'Billetera virtual', card: 'Tarjeta prepaga', savings: 'Ahorro',
      investment: 'Inversión', business: 'Negocio', safe: 'Caja fuerte', foreign: 'Exterior', home: 'Hogar', shared: 'Compartida',
    },
    /** Names of the palette colours, by colour id. */
    colors: {
      cobalt: 'Cobalto', azure: 'Celeste', teal: 'Verde azulado', green: 'Verde', olive: 'Oliva', ochre: 'Ocre', terracotta: 'Terracota',
      rose: 'Rosa', indigo: 'Índigo', slate: 'Pizarra', graphite: 'Grafito',
    },
  },
} as const;
