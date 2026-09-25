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
    regionNote: 'La región define cómo se escriben las fechas, los números y los importes. No cambia la moneda de tus cuentas.',
    dataUntouched: 'Cambiar el idioma o la región no modifica tus movimientos, tus cuentas ni tus copias de seguridad.',
    saveFailed: 'No se pudo guardar la preferencia. Tu elección anterior sigue activa; probá de nuevo.',
    /** A region chosen in a development preview that this build does not publish: kept, marked, and the formats that stand in for it (24R2A). */
    pendingRegion: 'Todavía no disponible en esta versión · formatos de {fallback}',
    /** Más row subtitle for that region: "Japón · formatos de Argentina". */
    pendingSummary: '{value} · formatos de {fallback}',
    /** Footnote of the Región chooser in a development preview only (EXPO_PUBLIC_LOCALE_PREVIEW=1), never in a release. */
    previewNote: 'Vista previa de desarrollo: incluye regiones que todavía no se verificaron en un iPhone.',
    /** Example of the region's conventions under its name. */
    regionSample: '{date} · {amount}',
  },
} as const;
