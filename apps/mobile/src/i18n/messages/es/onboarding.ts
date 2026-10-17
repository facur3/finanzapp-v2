/** The first opening (Producto 25B, redesigned in 25O1): a three-page story, where the person keeps their money (each
 * answer a preset of the first account), its opening balance and the close. Microcopy only: headlines of five words at
 * most and one line under a title at most; the money rules live in their own screens' help. Omitir skips the rest of the
 * setup and keeps every choice already saved: the label and its hint say so. */
export const onboarding = {
  onboarding: {
    skip: 'Omitir',
    skipLabel: 'Omitir el resto de la configuración',
    skipHint: 'Conserva lo que ya elegiste y abre la app',
    back: 'Volver',
    next: 'Siguiente',
    continue: 'Continuar',
    /** The story's progress, one VoiceOver element. */
    page: 'Página {current} de {total}',
    /** Each page's headline: `lead` in ink, then `emphasis` in the brand colour, joined by one space. */
    story: {
      record: { lead: 'Anotá un gasto', emphasis: 'en segundos.' },
      commitments: { lead: 'Tarjetas y cuotas,', emphasis: 'mes a mes.' },
      available: { lead: 'Sabé', emphasis: 'cuánto te queda.' },
    },
    /** Words drawn inside the illustrations (VoiceOver skips them); their figures are fixed samples, never stored. */
    art: {
      coffee: 'Café',
      groceries: 'Supermercado',
      transport: 'Transporte',
      /** A purchase in instalments: "Heladera · 6 cuotas". */
      plan: 'Heladera · {total} cuotas',
      perMonth: 'por mes',
      instalment: 'Cuota {current} de {total}',
      due: 'vence el {date}',
      spentIn: 'Gastado en {month}',
    },
    start: {
      title: '¿Dónde tenés tu plata?',
      /** True as written: what the person records never leaves the iPhone (an exchange-rate download carries no record). Says
       * «registrarte», never «cuenta», which on this screen is the account being created. */
      detail: 'Tus movimientos quedan en tu iPhone. Sin registrarte ni conectar un banco.',
      regionLabel: 'Región: {name}',
      regionHint: 'Abre la lista de regiones',
      languageLabel: 'Idioma: {name}',
      languageHint: 'Abre la lista de idiomas',
      restoreQuestion: '¿Venís de otro teléfono?',
      restore: 'Restaurar una copia',
      restoreHint: 'Trae tus datos desde una copia guardada',
    },
    /** Where the money is, each a preset of the first account: its name, the row's title and detail, the amount's question. */
    presets: {
      cash: { name: 'Efectivo', title: 'Efectivo', detail: 'Lo que llevás encima', question: '¿Cuánto tenés en efectivo?' },
      bank: { name: 'Banco', title: 'Cuenta bancaria', detail: 'Sueldo, ahorros o débito', question: '¿Cuánto tenés en el banco?' },
      digital: { name: 'Billetera virtual', title: 'Billetera virtual', detail: 'La app con la que pagás', question: '¿Cuánto tenés en la billetera?' },
    },
    account: {
      zero: 'Si no lo sabés, dejalo en cero.',
      name: 'Nombre',
      create: 'Crear cuenta',
    },
    done: {
      title: 'Todo listo.',
      detail: 'Ya podés anotar tu primer gasto.',
      start: 'Empezar',
      /** The created account's card as one VoiceOver element: "Efectivo, saldo 50000 pesos". */
      card: '{name}, saldo {amount}',
    },
  },
} as const;
