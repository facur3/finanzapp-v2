/** Currency and territory names per language, generated from CLDR
 * (scripts/currency/generate.mjs). A language added to LANGUAGES must add its
 * generated module here: the record type makes a missing one a compile error. */
import type { LanguageCode } from '../locale.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import type { CurrencyNames } from './types.ts';

export const CURRENCY_NAMES: Readonly<Record<LanguageCode, CurrencyNames>> = { es, en };
