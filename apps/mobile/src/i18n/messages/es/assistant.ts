/** Asistente: the conversation, the composer, drafts, clarifications and evidence.
 * Only the app's own copy lives here. The model's answers (streamed from the
 * server) and the development fixtures are content, never catalogue entries. */
export const assistant = {
  assistant: {
    /** Header title of the Assistant screen (a screen of the root stack opened from the capture hub, not a tab). */
    title: 'Asistente',
    /** VoiceOver name of the header button that starts an empty conversation. */
    newChat: 'Nuevo chat',
    /** Banner of the development-only scripted replies. */
    fixtureBanner: 'Vista de prueba: respuestas de ejemplo, nada se guarda.',
    /** Heading of the empty conversation, above the suggestions. */
    emptyTitle: '¿En qué te ayudo?',
    /** Prompt chips of an empty conversation. Tapping one sends its text, in the interface language, as the user's message. */
    suggestions: {
      whySpentMore: '¿Por qué gasté más este mes?',
      foodSpending: '¿Cuánto gasté en comida?',
      recordExpense: 'Registrar un gasto',
      budgetProgress: '¿Cómo voy con mi presupuesto?',
    },
    /** One calm line in the thread for a state the Assistant cannot get past. */
    reasons: {
      unavailable: 'El Asistente todavía no está conectado en esta versión. Tu mensaje quedó escrito para cuando lo esté.',
      session: 'Iniciá sesión para usar el Asistente. Tu mensaje sigue en el cuadro.',
      offline: 'Sin conexión. Tus movimientos no cambiaron; podés reintentar.',
      limit: 'Llegaste al límite de consultas de hoy. Podés registrar manualmente.',
      failed: 'No se pudo completar la consulta. Tus movimientos no cambiaron.',
    },
    composer: {
      placeholder: 'Preguntá o registrá algo…',
      /** VoiceOver name of the message field. */
      label: 'Mensaje para el Asistente',
      hint: 'Escribí una pregunta sobre tu dinero o un gasto para registrar',
      stop: 'Detener respuesta',
      send: 'Enviar',
    },
    message: {
      /** VoiceOver reading of the user's own message: "Vos: Gasté 500". */
      user: 'Vos: {text}',
      /** VoiceOver reading of an Assistant answer. */
      assistant: 'Asistente: {text}',
      thinkingLabel: 'Asistente: pensando',
      thinking: 'Pensando…',
      /** Under an answer the user stopped mid-stream. */
      stopped: 'Respuesta interrumpida.',
      retry: 'Reintentar',
    },
    /** Questions the app itself asks when a parsed draft has a gap (never the model's words). */
    clarify: {
      kind: '¿Fue un gasto o un ingreso?',
      amount: '¿De cuánto fue? Escribilo con el importe.',
      paidWith: '¿Con qué lo pagaste?',
      receivedIn: '¿En qué cuenta ingresó?',
      category: '¿En qué categoría lo anoto?',
      /** After the last clarification, above the completed draft card. */
      reviewDraft: 'Revisala en Para revisar antes de registrarla.',
    },
    /** Rows of the numbers an answer rests on, named from the local evidence. */
    evidence: {
      expenses: 'Gastos registrados',
      income: 'Ingresos registrados',
      /** 24T3: the period's devoluciones (never income). */
      refunds: 'Devoluciones',
      /** A row cited only for the previous period: "Restaurantes (mes anterior)". */
      previousMonth: '{label} (mes anterior)',
      /** VoiceOver for a difference that grew against the previous month (the screen shows "+$ 42.500,00"): "42500,00 pesos más". */
      spokenIncrease: '{amount} más',
    },
    /** Text buttons under an answer that open the screens holding the records. */
    links: {
      movements: 'Ver movimientos',
      category: 'Ver categoría',
      budget: 'Ver presupuesto',
    },
    /** 25A-04: a financial proposal of the Assistant, captured into «Para revisar» and reviewed only there. */
    proposal: {
      /** Eyebrow of the card: "Para revisar · Gasto". */
      eyebrow: '{status} · {kind}',
      status: { preview: 'Vista de prueba', capturing: 'Propuesta', failed: 'Propuesta', pending: 'Para revisar', unknown: 'Para revisar', confirmed: 'Registrado' },
      merchant: 'Comercio',
      source: 'Origen',
      destination: 'Dónde se registra',
      payment: 'Pago',
      /** VoiceOver reading of one card row: "Comercio: Carrefour". */
      row: '{label}: {value}',
      missing: 'Falta completar',
      noAmount: 'Sin monto',
      preview: 'Vista de prueba: esta propuesta no se guarda ni se puede registrar.',
      capturing: 'Guardando en Para revisar…',
      failed: 'No se pudo guardar en Para revisar. No se registró nada.',
      retry: 'Reintentar',
      ready: 'Lista para confirmar en Para revisar.',
      incomplete: { one: 'Falta {count} dato: completalo en Para revisar.', other: 'Faltan {count} datos: completalos en Para revisar.' },
      unknown: 'Guardada en Para revisar.',
      review: 'Revisar',
      confirmed: 'Registrado desde Para revisar.',
      viewEntry: 'Ver movimiento',
      viewPlan: 'Ver plan',
      dismissed: 'Propuesta descartada. No se registró nada.',
      gone: 'Esta propuesta ya no está pendiente.',
    },
    /** Errors of the server integration client (Assistant and capture). */
    integration: {
      httpsOrigin: 'Usá el origen HTTPS del servidor.',
      signIn: 'Iniciá sesión para usar la integración. El registro manual sigue disponible.',
      limit: 'Llegaste al límite de uso. Podés registrar manualmente.',
      unavailable: 'La integración todavía no está disponible.',
      failed: 'No se pudo completar la solicitud. Tus movimientos no cambiaron.',
      captureUnverified: 'No pudimos verificar la captura.',
    },
  },
} as const;
