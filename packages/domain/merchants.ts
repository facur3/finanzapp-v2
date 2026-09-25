/** Merchant identity: who was paid, kept apart from the category (what it was
 * for). "Netflix" is the merchant; "Ocio" or "Suscripciones" is the category;
 * "mensual" is the recurring rule. None of them replaces another.
 *
 * - The name the person typed (`Entry.merchant`, `RecurringRule.merchant`) is
 *   never rewritten: a screen always shows it verbatim. Recognition only adds
 *   an optional brand behind it (a logo when one is available and licensed).
 * - Recognition is an exact lookup of the normalized name in a small curated
 *   catalogue of aliases. There is no substring, prefix, fuzzy or edit-distance
 *   match: "Netflix y Spotify", "Pago Netflix" or "Netflixx" stay unrecognized.
 *   A miss is harmless (the category glyph is shown); a wrong brand is not.
 * - An alias is in the catalogue only when it names one brand and is not an
 *   ordinary word ("Personal", "Claro", "Día", "Max", "Shell" are left out).
 * - The catalogue carries no category: categorisation stays the person's
 *   choice (local categorisation rules are a separate, later delivery).
 * - Nothing here reaches the network. `domain` is the key a future logo
 *   provider would be asked for, never a link the app opens. */

export interface MerchantBrand {
  /** Stable identity, lowercase kebab-case. Never shown. */
  id: string;
  /** The brand's own spelling, for attribution and development tooling; the row keeps the person's text. */
  name: string;
  /** Normalized spellings (`merchantKey`) that name this brand and nothing else. */
  aliases: readonly string[];
  /** The brand's primary web domain, the lookup key for a logo provider. */
  domain: string;
}

const brand = (id: string, name: string, domain: string, aliases: string[]): MerchantBrand => ({ id, name, domain, aliases });

/** The curated catalogue (Producto 24UX2). Small on purpose: subscriptions and
 * services common in Argentina and the United States whose names are
 * unambiguous. Each entry is checked by `validateMerchantCatalog`. */
export const MERCHANT_CATALOG: readonly MerchantBrand[] = [
  brand('netflix', 'Netflix', 'netflix.com', ['netflix', 'netflix com']),
  brand('spotify', 'Spotify', 'spotify.com', ['spotify', 'spotify premium', 'spotify com']),
  brand('disney-plus', 'Disney+', 'disneyplus.com', ['disney plus', 'disneyplus', 'disneyplus com']),
  brand('youtube-premium', 'YouTube Premium', 'youtube.com', ['youtube premium', 'youtube music']),
  brand('prime-video', 'Prime Video', 'primevideo.com', ['prime video', 'amazon prime video', 'amazon prime']),
  brand('hbo-max', 'HBO Max', 'hbomax.com', ['hbo max', 'hbomax']),
  brand('apple', 'Apple', 'apple.com', ['apple com', 'icloud', 'apple music', 'apple tv', 'app store']),
  brand('google-one', 'Google One', 'one.google.com', ['google one']),
  brand('microsoft-365', 'Microsoft 365', 'microsoft.com', ['microsoft 365', 'office 365']),
  brand('chatgpt', 'ChatGPT', 'openai.com', ['chatgpt', 'chatgpt plus', 'openai']),
  brand('adobe', 'Adobe', 'adobe.com', ['adobe com', 'adobe creative cloud']),
  brand('dropbox', 'Dropbox', 'dropbox.com', ['dropbox']),
  brand('duolingo', 'Duolingo', 'duolingo.com', ['duolingo', 'duolingo plus', 'super duolingo']),
  brand('steam', 'Steam', 'steampowered.com', ['steampowered', 'steampowered com', 'steam games']),
  brand('playstation', 'PlayStation', 'playstation.com', ['playstation', 'playstation plus', 'playstation store', 'ps plus']),
  brand('xbox', 'Xbox', 'xbox.com', ['xbox', 'xbox game pass', 'game pass']),
  brand('mercado-libre', 'Mercado Libre', 'mercadolibre.com.ar', ['mercado libre', 'mercadolibre']),
  brand('mercado-pago', 'Mercado Pago', 'mercadopago.com.ar', ['mercado pago', 'mercadopago']),
  brand('uber', 'Uber', 'uber.com', ['uber']),
  brand('uber-eats', 'Uber Eats', 'ubereats.com', ['uber eats', 'ubereats']),
  brand('cabify', 'Cabify', 'cabify.com', ['cabify']),
  brand('rappi', 'Rappi', 'rappi.com', ['rappi', 'rappi prime']),
  brand('pedidosya', 'PedidosYa', 'pedidosya.com', ['pedidosya', 'pedidos ya']),
  brand('ypf', 'YPF', 'ypf.com', ['ypf']),
  brand('axion', 'AXION energy', 'axionenergy.com', ['axion', 'axion energy']),
  brand('edenor', 'Edenor', 'edenor.com', ['edenor']),
  brand('edesur', 'Edesur', 'edesur.com.ar', ['edesur']),
  brand('metrogas', 'Metrogas', 'metrogas.com.ar', ['metrogas']),
  brand('aysa', 'AySA', 'aysa.com.ar', ['aysa']),
  brand('movistar', 'Movistar', 'movistar.com.ar', ['movistar']),
  brand('starbucks', 'Starbucks', 'starbucks.com', ['starbucks']),
  brand('mcdonalds', "McDonald's", 'mcdonalds.com', ['mcdonalds', 'mc donalds']),
  brand('carrefour', 'Carrefour', 'carrefour.com.ar', ['carrefour']),
  brand('farmacity', 'Farmacity', 'farmacity.com', ['farmacity']),
  brand('despegar', 'Despegar', 'despegar.com', ['despegar com']),
];

/** Ordinary words and ambiguous short names that must never be an alias,
 * even when a brand uses them: a person who writes "Personal" or "Día" may
 * mean anything, and the merchant field also takes a free description, so
 * "Apple" may be fruit, "Steam" a sauna, "Adobe" a building material and
 * "Despegar" a verb. Their brands stay reachable through qualified aliases
 * ("apple.com", "App Store", "Steam games"). `validateMerchantCatalog`
 * refuses them. */
export const AMBIGUOUS_MERCHANT_WORDS: readonly string[] = [
  'personal', 'claro', 'dia', 'coto', 'max', 'shell', 'jumbo', 'disco', 'vea', 'google', 'amazon', 'microsoft',
  'apple', 'steam', 'adobe', 'despegar',
  'prime', 'plus', 'premium', 'pago', 'pagos', 'app', 'music', 'tv', 'store', 'online', 'suscripcion', 'subscription',
];

/** The normalized form of a merchant name: compatibility-decomposed, accents
 * removed, lowercase, "+" read as "plus", apostrophes dropped, every other
 * run of non-alphanumeric characters one space, trimmed. "Disney+" and
 * "Disney Plus" meet at "disney plus"; "McDonald's" is "mcdonalds";
 * "Netflix.com" is "netflix com". The stored name is never changed. */
export function merchantKey(name: string): string {
  if (typeof name !== 'string') return '';
  return name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type MerchantIdentity =
  | { status: 'recognized'; key: string; brand: MerchantBrand }
  | { status: 'unrecognized'; key: string };

/** Check a catalogue: ids, names and domains well formed; every alias already
 * normalized, not an ambiguous word, and owned by exactly one brand. */
export function validateMerchantCatalog(catalog: readonly MerchantBrand[]): void {
  const ids = new Set<string>();
  const owners = new Map<string, string>();
  for (const item of catalog) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.id)) throw new Error(`Invalid merchant id: ${item.id}`);
    if (ids.has(item.id)) throw new Error(`Repeated merchant id: ${item.id}`);
    ids.add(item.id);
    if (!item.name.trim()) throw new Error(`Merchant without a name: ${item.id}`);
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(item.domain)) throw new Error(`Invalid merchant domain: ${item.domain}`);
    if (!item.aliases.length) throw new Error(`Merchant without aliases: ${item.id}`);
    for (const alias of item.aliases) {
      if (!alias || merchantKey(alias) !== alias) throw new Error(`Alias not normalized: ${alias}`);
      if (AMBIGUOUS_MERCHANT_WORDS.includes(alias)) throw new Error(`Ambiguous alias: ${alias}`);
      const owner = owners.get(alias);
      if (owner) throw new Error(`Alias "${alias}" names both ${owner} and ${item.id}`);
      owners.set(alias, item.id);
    }
  }
}

/** A lookup table from alias to brand, built once per catalogue. */
export function merchantIndex(catalog: readonly MerchantBrand[] = MERCHANT_CATALOG): ReadonlyMap<string, MerchantBrand> {
  validateMerchantCatalog(catalog);
  const index = new Map<string, MerchantBrand>();
  for (const item of catalog) for (const alias of item.aliases) index.set(alias, item);
  return index;
}

const DEFAULT_INDEX = merchantIndex();

/** Recognize the brand behind a typed name, or say it is not recognized. Pure
 * lookup: only an exact alias match counts. */
export function resolveMerchant(name: string, index: ReadonlyMap<string, MerchantBrand> = DEFAULT_INDEX): MerchantIdentity {
  const key = merchantKey(name);
  const found = key ? index.get(key) : undefined;
  return found ? { status: 'recognized', key, brand: found } : { status: 'unrecognized', key };
}
