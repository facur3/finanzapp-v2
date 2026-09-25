/** How Inicio and Reportes show money (Producto 24C1): the display sheet and the exchange-rate notes. */
export const display = {
  display: {
    title: 'Mostrar totales',
    consolidated: 'Total consolidado',
    consolidatedDetail: 'Todas tus cuentas, convertidas a una moneda.',
    single: 'Ver solamente una moneda',
    singleDetail: 'Solo las cuentas de esa moneda, sin conversiones.',
    currency: 'Moneda de visualización',
    note: 'Cambiar cómo se muestran los totales no convierte ni modifica tus cuentas, saldos ni movimientos.',
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
    availableInfo: 'Dinero registrado en todas tus cuentas, en {currency}, con la cotización de referencia del {date} ({source}, bancos centrales). '
      + 'No incluye tarjetas ni deudas, y no es un saldo bancario ni tu patrimonio. Tus cuentas conservan su moneda original.',
    reportInfo: 'Gastos de todas tus cuentas en {currency}. Cada gasto se convierte con la cotización de referencia de su fecha ({source}, '
      + 'bancos centrales): se usaron cotizaciones del {oldest} al {newest}, nunca la de hoy para un mes pasado. Los movimientos conservan su '
      + 'importe original. No incluye saldos iniciales, transferencias ni pagos de tarjeta.',
    /** The one line under the per-currency subtotals when there is no total. */
    unavailable: 'Sin cotización para sumarlo en {currency}',
    comparisonFooter: 'Gastos de todas tus cuentas en {currency}, cada uno con la cotización de su fecha; sin transferencias ni saldos iniciales. Las diferencias describen tus registros, no los motivos de tus gastos ni un ahorro confirmado.',
    fetching: 'Obteniendo cotizaciones',
    reason: {
      fetching: 'Estamos obteniendo las cotizaciones de referencia. Mientras tanto mostramos cada moneda por separado.',
      offline: 'Sin conexión: no pudimos obtener la cotización {pair} del {date}. Mostramos cada moneda por separado; el total aparecerá cuando haya conexión.',
      provider: 'El proveedor de cotizaciones ({source}) no respondió para {pair} del {date}. Mostramos cada moneda por separado; lo intentaremos de nuevo.',
      missing: 'No hay una cotización {pair} para el {date}. Mostramos cada moneda por separado en vez de un total incompleto.',
      stale: 'La última cotización {pair} disponible es del {latest}, demasiado antigua para el {date}. Mostramos cada moneda por separado en vez de un total incompleto.',
    },
  },
} as const;
