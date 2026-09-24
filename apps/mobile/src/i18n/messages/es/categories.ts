/** Display names of the built-in categories, keyed by kind and identity key. */
export const categories = {
  /** Display names of the built-in categories, by kind and identity key. The
   * key is the stored identity (`categoryKey` of the Spanish preset label) and
   * never changes; only the name shown follows the language. A category the
   * person renamed or created keeps its own name in every language. */
  categories: {
    expense: {
      comida: 'Comida',
      supermercado: 'Supermercado',
      restaurantes: 'Restaurantes',
      transporte: 'Transporte',
      combustible: 'Combustible',
      hogar: 'Hogar',
      alquiler: 'Alquiler',
      servicios: 'Servicios',
      suscripciones: 'Suscripciones',
      salud: 'Salud',
      farmacia: 'Farmacia',
      educacion: 'Educación',
      ropa: 'Ropa',
      tecnologia: 'Tecnología',
      ocio: 'Ocio',
      viajes: 'Viajes',
      mascotas: 'Mascotas',
      regalos: 'Regalos',
      impuestos: 'Impuestos',
      seguros: 'Seguros',
      otros: 'Otros',
    },
    income: {
      sueldo: 'Sueldo',
      trabajo: 'Trabajo',
      ventas: 'Ventas',
      inversiones: 'Inversiones',
      regalos: 'Regalos',
      reembolsos: 'Reembolsos',
      prestamos: 'Préstamos',
      otros: 'Otros',
    },
  },
} as const;
