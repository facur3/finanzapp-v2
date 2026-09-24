/** Idioma and Región. */
export const preferences = {
  preferences: {
    language: 'Idioma',
    region: 'Región',
    followDevice: 'Según el dispositivo',
    /** Subtitle of "Según el dispositivo": what the device resolves to right now. */
    followDeviceNow: 'Ahora: {value}',
    /** Más row subtitle when the value follows the device: "Español · según el dispositivo". */
    followingDevice: '{value} · según el dispositivo',
    regionNote: 'La región define cómo se escriben las fechas, los números y los importes. No cambia la moneda de tus cuentas.',
    dataUntouched: 'Cambiar el idioma o la región no modifica tus movimientos, tus cuentas ni tus copias de seguridad.',
    saveFailed: 'No se pudo guardar la preferencia. Tu elección anterior sigue activa; probá de nuevo.',
    /** Region names in the interface language; languages are listed by their own names. */
    regionNames: { AR: 'Argentina', US: 'Estados Unidos' },
    /** Example of the region's conventions under its name. */
    regionSample: '{date} · {amount}',
  },
} as const;
