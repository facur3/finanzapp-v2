/** Idioma and Región. */
export const preferences = {
  preferences: {
    language: 'Idioma',
    region: 'Región',
    followDevice: 'Según el dispositivo',
    /** Subtitle of "Según el dispositivo": what the device resolves to right now. */
    followDeviceNow: 'Ahora: {value}',
    /** The device Region is one the catalogue names but this build does not honour yet: which region's formats stand in (24R1). */
    followDeviceNowFallback: 'Ahora: {value} (formatos de {fallback})',
    /** The searchable choosers (24R1): the field, the recent section and the empty result. */
    search: 'Buscar',
    recent: 'Recientes',
    noMatches: 'Sin coincidencias',
    /** Más row subtitle when the value follows the device: "Español · según el dispositivo". */
    followingDevice: '{value} · según el dispositivo',
    /** 25O1: the one fact of each chooser, not a disclaimer. Región: what it changes and what it never touches. */
    regionNote: 'Cambia cómo se escriben fechas y números. Tus importes y monedas no cambian.',
    /** Idioma: under each language, the variety its copy is written in (the flag beside it is that region's), in the row's own language. */
    languageVariety: 'Variante: {region}',
    /** Idioma (iOS only): iOS draws its own text (Copiar, Pegar, compartir) in the language set for the app in Settings. */
    languageNote: 'Para que iOS también use este idioma en sus menús, elegilo en Configuración.',
    /** The text button under that note: opens FinanzApp's page in iOS Settings. 25O1 review: «Configuración», the name
     * Latin American iPhones give Settings (Spain's is «Ajustes»). */
    openSettings: 'Abrir Configuración',
    saveFailed: 'No se pudo guardar la preferencia. Tu elección anterior sigue activa; probá de nuevo.',
    /** A region chosen in a development preview that this build does not publish: kept, marked, and the formats that stand in for it (24R2A).
     * 25O1: short enough for two lines beside the flag tile on a 375 pt iPhone. */
    pendingRegion: 'Aún no disponible · formatos de {fallback}',
    /** Más row subtitle for that region: "Japón · formatos de Argentina". */
    pendingSummary: '{value} · formatos de {fallback}',
    /** Footnote of the Región chooser in a development preview only (EXPO_PUBLIC_LOCALE_PREVIEW=1), never in a release. */
    previewNote: 'Vista previa de desarrollo: incluye regiones que todavía no se verificaron en un iPhone.',
    /** Example of the region's conventions under its name. */
    regionSample: '{date} · {amount}',
    /** Producto 24UX6A: Más → Apariencia. Sistema follows the device; Claro and Oscuro fix the scheme on this device. */
    appearance: 'Apariencia',
    appearanceSystem: 'Sistema',
    appearanceLight: 'Claro',
    appearanceDark: 'Oscuro',
    /** Subtitle of Sistema: what the device draws right now (only while Sistema is the choice). */
    appearanceSystemNowLight: 'Según el dispositivo · ahora claro',
    appearanceSystemNowDark: 'Según el dispositivo · ahora oscuro',
    appearanceSystemDetail: 'Según el dispositivo',
  },
} as const;
