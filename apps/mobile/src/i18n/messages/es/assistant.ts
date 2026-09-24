/** Asistente: the conversation, the composer, drafts, clarifications and evidence.
 * Only the app's own copy lives here. The model's answers (streamed from the
 * server) and the development fixtures are content, never catalogue entries. */
export const assistant = {
  assistant: {
    /** Header title of the Assistant tab. */
    title: 'Asistente',
    /** VoiceOver name of the header button that starts an empty conversation. */
    newChat: 'Nuevo chat',
    /** Caption under the composer while this build has no server connection. */
    disconnectedNote: 'No conectado en esta versión. Lo que escribas queda en tu iPhone.',
    /** Banner of the development-only scripted replies. */
    fixtureBanner: 'Vista de prueba: respuestas de ejemplo, nada se guarda.',
    /** Note after Confirmar on a scripted (development) draft. */
    fixtureConfirmRefused: 'Vista de prueba: este borrador es de ejemplo y no se guarda.',
    /** Note when a confirmed draft could not be written; the draft stays pending. */
    saveFailed: 'No pudimos guardar el movimiento. El borrador sigue acá para reintentar.',
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
      /** VoiceOver name of the microphone button. */
      dictate: 'Dictar',
      dictateHint: 'Todavía no disponible en esta versión',
      stop: 'Detener respuesta',
      send: 'Enviar',
      /** Shown when the microphone is tapped: speech input is not in this build. */
      dictationNote: 'El dictado llega con la versión instalable: la transcripción de voz necesita el development build, no Expo Go.',
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
      reviewDraft: 'Revisá el borrador antes de guardarlo.',
    },
    /** Rows of the numbers an answer rests on, named from the local evidence. */
    evidence: {
      expenses: 'Gastos registrados',
      income: 'Ingresos registrados',
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
    draft: {
      /** Eyebrow of the card: "Borrador · Gasto", "Guardado · Ingreso". */
      eyebrow: '{status} · {kind}',
      pending: 'Borrador',
      saved: 'Guardado',
      merchant: 'Comercio',
      source: 'Origen',
      /** VoiceOver reading of one card row: "Comercio: Carrefour". */
      row: '{label}: {value}',
      missingText: 'Falta completar',
      missingChoice: 'Falta elegir',
      /** Why Confirmar is disabled; count is the number of missing fields. */
      gaps: { one: 'Completá el dato que falta con Editar antes de confirmar.', other: 'Completá los datos que faltan con Editar antes de confirmar.' },
      confirm: 'Confirmar',
      edit: 'Editar',
      discard: 'Descartar',
      discardLabel: 'Descartar borrador',
      viewEntry: 'Ver movimiento',
      cancelledLabel: 'Borrador descartado',
      cancelled: 'Borrador descartado. No se registró nada.',
      editedLabel: 'Borrador abierto en el formulario',
      edited: 'Seguiste en el formulario. Guardá desde ahí.',
      accountRequired: 'Elegí con qué cuenta se pagó antes de confirmar.',
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
