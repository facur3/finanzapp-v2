/** Reportes: periods, charts, comparisons, the category and day screens. */
export const reports = {
  reports: {
    /** The currency switch at the top of Reportes (segmented control). */
    currencyARS: 'Pesos · ARS',
    currencyUSD: 'Dólares · USD',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    backToCurrentMonth: 'Volver al mes actual',
    /** Short link beside the period that jumps back to the current month. */
    thisMonth: 'Este mes',
    /** Eyebrow over the month's total, followed by the currency code. */
    spent: 'Gastado',
    noRecords: 'Sin registros',
    /** "$ 1.234,56 por día": the daily average. */
    perDay: '{amount} por día',
    /** Change against the previous month: "12 % más que el mes anterior". */
    delta: {
      same: 'igual que {reference}',
      more: '{percent} más que {reference}',
      less: '{percent} menos que {reference}',
      matchingDays: 'los mismos días del mes anterior',
      previousMonth: 'el mes anterior',
    },
    lastSixMonths: 'Últimos seis meses',
    /** Segmented control: category breakdown or day-by-day list. */
    viewCategories: 'Categorías',
    viewDays: 'Día a día',
    /** Caption in the middle of the donut, above the total. */
    periodTotal: 'Total del período',
    /** Name of the donut slice that groups the smaller categories. */
    others: 'Otras',
    othersNote: 'Las cinco mayores con nombre propio; el resto se agrupa como Otras.',
    daysNote: 'Solo días con gastos registrados. Tocá uno para ver los movimientos.',
    outOfRangeTitle: 'El total supera el rango disponible',
    outOfRangeDetail: 'Tus movimientos siguen guardados. No mostramos un total ni un gráfico redondeado que pueda ser incorrecto.',
    /** A day row: "Hoy · 22 sep · 3 gastos". */
    dayRow: '{date} · {count}',
    emptyTitle: 'Sin gastos en este período',
    emptyDetail: 'Los gastos registrados en esta moneda aparecerán acá, agrupados por categoría. Podés recorrer los meses con movimientos usando las flechas.',
    budgets: {
      title: 'Presupuestos',
      manage: 'Administrar',
      general: 'Presupuesto general',
      /** "$ 500,00 de $ 1.000,00": spent of the limit. */
      progress: '{spent} de {limit}',
      percent: '{percent} %',
      label: '{category}: {spent} de {limit}, {percent} por ciento',
      labelExceeded: '{category}: {spent} de {limit}, {percent} por ciento, excedido',
    },
    merchants: {
      title: 'Dónde más gastaste',
      caption: 'Por importe registrado en el período',
      purchases: { one: '{count} compra', other: '{count} compras' },
    },
    insights: {
      title: 'Para tener en cuenta',
      caption: 'Hechos de tus registros, no consejos',
      overTotal: 'Superaste tu presupuesto general',
      nearTotal: 'Estás cerca de tu presupuesto general',
      overCategory: '{category} superó su presupuesto',
      nearCategory: '{category} está cerca del límite',
      /** "$ 200,00 por encima de $ 1.000,00": how far over the limit. */
      overDetail: '{amount} por encima de {limit}',
      nearDetail: 'Quedan {amount} de {limit}',
      largest: 'Tu mayor gasto fue {merchant}',
      /** Amount · category · date; `{day}`/`{month}` are the numbers of the date ("5/09"). */
      largestDetail: '{amount} · {category} · {day}/{month}',
      growth: '{category} subió {amount}',
      growthMatchingDays: 'Frente a los mismos días del mes anterior',
      growthFullMonth: 'Frente al mes anterior completo',
    },
    incomeRecorded: 'Ingresos registrados',
    netFlow: 'Flujo neto',
    compare: 'Comparar con el mes anterior',
    compareSubtitle: 'Diferencias por categoría',
    footer: 'Solo movimientos registrados en {currency}. Los saldos iniciales, las transferencias y los pagos de tarjeta no cuentan como ingresos ni gastos. Un mes sin registros no significa que no hayas gastado.',
    /** Under the month name: which days the report covers. */
    period: {
      untilToday: 'Hasta hoy',
      fullMonth: 'Mes completo',
      /** A month cut at a day: "Del 1 al 12". */
      untilDay: 'Del 1 al {day}',
      /** "1–12 de agosto de 2026": a comparison period. */
      range: '1–{day} de {month} de {year}',
    },
    chart: {
      /** VoiceOver for the donut: "Total del período: Comida 40 %, Salud 60 %". */
      donutLabel: '{caption}: {slices}',
      slice: '{label} {percent} %',
      /** VoiceOver for one month bar: "sep 2026, 1.234,56 pesos". */
      bar: '{month} {year}, {amount}',
      barPartial: '{month} {year}, {amount}, mes en curso',
      partialMonth: 'Mes en curso hasta hoy',
      /** Under the bars: "Mes completo · escala de 0 a $ 1.234". */
      scale: '{status} · escala de 0 a {max}',
      /** VoiceOver for a category row: "Comida, 1.234,56 ARS, 30 % del gasto del mes, 3 gastos". */
      categoryLabel: '{name}, {amount} {currency}, {share} del gasto del mes, {count}',
      categoryHint: 'Abre los movimientos de esta categoría en el mes seleccionado',
      timelineMax: 'Gasto registrado · máximo {currency} {amount}',
      timelineBar: '{period}, {amount} {currency}, {count}',
      timelineHint: 'Abre los gastos de estas fechas',
      timelineFooter: 'Días del período · tocá una barra para ver el detalle',
    },
    /** "3 gastos registrados". */
    recordedExpenses: { one: '{count} gasto registrado', other: '{count} gastos registrados' },
    category: {
      invalidTitle: 'Período no válido',
      invalidDetail: 'Volvé al reporte para elegir las fechas.',
      emptyTitle: 'No hay gastos de esta categoría',
      emptyDetail: 'Volvé al reporte para elegir una categoría con movimientos en esta moneda y período.',
      totalUnavailable: 'No podemos mostrar este total con precisión. Los movimientos están disponibles abajo.',
      movements: 'Movimientos',
    },
    day: {
      invalidTitle: 'Día no válido',
      invalidDetail: 'Volvé al reporte para elegir un día.',
      totalUnavailable: 'No podemos mostrar el total con precisión.',
      emptyTitle: 'Sin gastos registrados',
      emptyDetail: 'No hay gastos para este día y moneda.',
    },
    comparison: {
      matchingDays: 'La misma cantidad de días de cada mes',
      fullMonths: 'Meses completos · pueden tener distinta cantidad de días',
      capped: 'Esta comparación llega hasta el día {day} en ambos meses porque el anterior fue más corto. El reporte mensual conserva todos los días.',
      outOfRangeDetail: 'Tus movimientos siguen guardados. No mostramos una comparación imprecisa.',
      same: 'El mismo gasto registrado',
      more: '{percent} más registrado',
      less: '{percent} menos registrado',
      difference: 'Diferencia respecto del período anterior',
      insufficientTitle: 'Todavía no hay suficiente información',
      insufficientDetail: 'La comparación necesita gastos registrados en ambos períodos. Que no haya registros no significa que no hayas gastado.',
      changedTitle: 'Qué categorías cambiaron',
      noChange: 'Sin cambio',
      /** A category's change: "$ 100,00 más". */
      amountMore: '{amount} más',
      amountLess: '{amount} menos',
      thisPeriod: 'Este período',
      previous: 'Anterior',
      footer: 'Solo gastos registrados en {currency}, sin transferencias ni saldos iniciales. Las diferencias describen tus registros, no los motivos de tus gastos ni un ahorro confirmado.',
    },
  },
} as const;
