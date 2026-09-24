import type { Messages } from '../../messages.ts';

/** Display names of the built-in categories, keyed by kind and identity key. */
export const categories: Pick<Messages, 'categories'> = {
  categories: {
    expense: {
      comida: 'Food',
      supermercado: 'Groceries',
      restaurantes: 'Restaurants',
      transporte: 'Transportation',
      combustible: 'Fuel',
      hogar: 'Home',
      alquiler: 'Rent',
      servicios: 'Utilities',
      suscripciones: 'Subscriptions',
      salud: 'Health',
      farmacia: 'Pharmacy',
      educacion: 'Education',
      ropa: 'Clothing',
      tecnologia: 'Technology',
      ocio: 'Entertainment',
      viajes: 'Travel',
      mascotas: 'Pets',
      regalos: 'Gifts',
      impuestos: 'Taxes',
      seguros: 'Insurance',
      otros: 'Other',
    },
    income: {
      sueldo: 'Salary',
      trabajo: 'Work',
      ventas: 'Sales',
      inversiones: 'Investments',
      regalos: 'Gifts',
      reembolsos: 'Refunds',
      prestamos: 'Loans',
      otros: 'Other',
    },
  },
};
