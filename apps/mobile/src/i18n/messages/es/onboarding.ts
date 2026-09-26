/** The first opening (Producto 25B): five short screens, every one skippable. Microcopy only; the money rules live in
 * their own screens' help. */
export const onboarding = {
  onboarding: {
    /** "Paso 2 de 4". */
    step: 'Paso {index} de {count}',
    skipAll: 'Omitir',
    skipAllLabel: 'Omitir la configuración inicial',
    continue: 'Continuar',
    back: 'Atrás',
    welcome: {
      title: 'Tus gastos, claros.',
      detail: 'Registrá lo que gastás y entendé a dónde va tu plata. Todo queda en tu iPhone; no hace falta cuenta, conexión ni banco.',
      start: 'Empezar',
    },
    language: {
      title: 'Idioma',
      detail: 'Lo detectamos del dispositivo. Podés cambiarlo cuando quieras en Más.',
    },
    region: {
      title: 'Región',
      detail: 'Define cómo se escriben fechas y números. No cambia tu moneda.',
    },
    currency: {
      title: 'Moneda de los totales',
      detail: 'Verás tu dinero y tus gastos sumados en esta moneda. Cada cuenta conserva la suya.',
      /** The pinned suggestion's subtitle: "Sugerida por tu región". */
      suggested: 'Sugerida por tu región',
    },
    account: {
      title: 'Tu primera cuenta',
      detail: 'Una cuenta agrupa movimientos: efectivo, un banco, una billetera. Elegí su moneda al crearla. Podés empezar sin ninguna.',
      create: 'Crear una cuenta',
      later: 'Ahora no',
    },
  },
} as const;
