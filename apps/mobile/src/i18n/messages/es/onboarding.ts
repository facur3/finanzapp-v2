/** The first opening (Producto 25B): two short stages. Microcopy only; the money rules live in their own screens' help.
 * Omitir skips the rest of the setup and keeps every choice already saved: the label and its hint say so. */
export const onboarding = {
  onboarding: {
    skip: 'Omitir',
    skipLabel: 'Omitir el resto de la configuración',
    skipHint: 'Conserva lo que ya elegiste y abre la app',
    continue: 'Continuar',
    welcome: {
      title: 'Tus gastos, claros.',
      detail: 'Registrá lo que gastás y entendé a dónde va tu plata. Todo queda en tu iPhone; no hace falta cuenta, conexión ni banco.',
      /** Under the language and region rows. */
      detected: 'Detectados de tu dispositivo. Podés cambiarlos ahora o después, en Más.',
    },
    account: {
      title: 'Tu primera cuenta',
      detail: 'Una cuenta agrupa movimientos: efectivo, un banco, una billetera. Es opcional: podés empezar sin ninguna.',
      /** The currency row's note while the suggestion stands: "Sugerida por tu región: pesos argentinos". */
      suggested: 'Sugerida por tu región: {name}. Cada cuenta conserva su moneda.',
      ownCurrency: 'Cada cuenta conserva su moneda.',
      opening: 'Saldo inicial (opcional)',
      create: 'Crear cuenta',
      later: 'Ahora no',
    },
  },
} as const;
