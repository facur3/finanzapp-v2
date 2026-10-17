/** How Inicio and Reportes show money (Producto 24C1): the display sheet and the exchange-rate notes. */
export const display = {
  display: {
    title: 'Mostrar totales',
    consolidated: 'Total consolidado',
    consolidatedDetail: 'Todas tus cuentas, convertidas a una moneda.',
    single: 'Ver solamente una moneda',
    singleDetail: 'Solo las cuentas de esa moneda, sin conversiones.',
    currency: 'Moneda de visualización',
    /** The chip in consolidated mode: "Total · USD", every account converted to that currency. */
    total: 'Total · {code}',
    /** The chip in single mode: "Solo USD". */
    only: 'Solo {code}',
    chipConsolidated: 'Total consolidado en {name}',
    chipSingle: 'Solo {name}',
    chipHint: 'Abre las opciones de visualización',
  },
  fx: {
    infoTitle: 'Cotizaciones',
    spendingInfo: 'Gastos de todas tus cuentas en {currency}. Cada gasto se convierte con la cotización de referencia de su fecha ({source}, '
      + 'bancos centrales); la más reciente que se usó es del {date}. Tus cuentas y movimientos conservan su moneda original.',
    spendingInfoRange: 'Gastos de todas tus cuentas en {currency}. Cada gasto se convierte con la cotización de referencia de su fecha ({source}, '
      + 'bancos centrales): se usaron cotizaciones del {oldest} al {newest}. Tus cuentas y movimientos conservan su moneda original.',
    availableInfo: 'Dinero registrado en todas tus cuentas, en {currency}, con la cotización de referencia del {date} ({source}, bancos centrales). '
      + 'No incluye tarjetas ni deudas, y no es un saldo bancario ni tu patrimonio. Tus cuentas conservan su moneda original.',
    /** The same with rates of more than one day: each currency converts with its own latest publication, which can differ. */
    availableInfoRange: 'Dinero registrado en todas tus cuentas, en {currency}, con la última cotización de referencia de cada moneda ({source}, '
      + 'bancos centrales), del {oldest} al {newest}. No incluye tarjetas ni deudas, y no es un saldo bancario ni tu patrimonio. Tus cuentas conservan su moneda original.',
    reportInfo: 'Gastos de todas tus cuentas en {currency}. Cada gasto se convierte con la cotización de referencia de su fecha ({source}, '
      + 'bancos centrales): se usaron cotizaciones del {oldest} al {newest}, nunca la de hoy para un mes pasado. Los movimientos conservan su '
      + 'importe original. No incluye saldos iniciales, transferencias ni pagos de tarjeta. '
      + 'Las devoluciones se convierten con la cotización de su propia fecha y restan en su mes y su categoría.',
    /** The one line under the per-currency subtotals when there is no total. */
    unavailable: 'Sin cotización para sumarlo en {currency}',
    comparisonFooter: 'Gastos de todas tus cuentas en {currency}, cada uno con la cotización de su fecha; sin transferencias ni saldos iniciales. Las diferencias describen tus registros, no los motivos de tus gastos ni un ahorro confirmado.',
    fetching: 'Obteniendo cotizaciones',
    reason: {
      fetching: 'Se están obteniendo las cotizaciones de referencia. Mientras tanto cada moneda se muestra por separado.',
      offline: 'Sin conexión: no se pudo obtener la cotización {pair} del {date}. Cada moneda se muestra por separado; el total aparece cuando haya conexión.',
      provider: 'El proveedor de cotizaciones ({source}) no respondió para {pair} del {date}. Cada moneda se muestra por separado; se vuelve a intentar más tarde.',
      missing: 'No hay una cotización {pair} para el {date}. Cada moneda se muestra por separado en vez de un total incompleto.',
      stale: 'La última cotización {pair} disponible es del {latest}, demasiado antigua para el {date}. Cada moneda se muestra por separado en vez de un total incompleto.',
    },
  },
} as const;
