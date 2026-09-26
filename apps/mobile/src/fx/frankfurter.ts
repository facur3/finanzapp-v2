/** The exchange-rate provider (Producto 24C1, docs/currency.md §8.2): Frankfurter v2
 * (https://frankfurter.dev), reference rates blended from central banks and official sources,
 * free for commercial use, no API key, no quota (rate-limited against abuse). Nothing secret
 * travels and nothing personal: a request names a date range and the currencies to quote, never
 * an amount, an account or a person. One request per calendar month and set of currencies
 * (`rates-store.ts` decides when one is needed); every rate is quoted against USD.
 *
 * The provider sends rates as JSON numbers. A JSON number with at most 15 significant digits is
 * printed back by `String()` exactly as it was written, so the text is recovered digit for digit
 * and then only ever read as a decimal (never used as a float); a rate with more digits than
 * that, or any malformed row, is dropped instead of being rounded. Pure: no React. */
import { FX_PIVOT, isRateText, isStorableCurrency, validDateISO, type Currency, type ExchangeRate } from '@finanzapp/domain';

export const FRANKFURTER_ORIGIN = 'https://api.frankfurter.dev';
export const FRANKFURTER_SOURCE = 'Frankfurter';
export const FETCH_TIMEOUT_MS = 10000;

export interface RateRequest { from: string; to: string; quotes: readonly Currency[] }
export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function frankfurterUrl(request: RateRequest): string {
  return `${FRANKFURTER_ORIGIN}/v2/rates?from=${request.from}&to=${request.to}&base=${FX_PIVOT}&quotes=${[...request.quotes].sort().join(',')}`;
}

/** A JSON number back to its exact decimal text, or null (not finite, not positive, more than 15 significant digits). */
export function rateText(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  let text = String(value);
  const exponent = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(text);
  if (exponent) {
    const digits = exponent[1] + (exponent[2] ?? ''), shift = Number(exponent[3]);
    const point = 1 + shift;
    text = point <= 0 ? '0.' + '0'.repeat(-point) + digits
      : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point);
  }
  const significant = text.replace('.', '').replace(/^0+/, '');
  if (significant.length > 15) return null;
  return isRateText(text) ? text : null;
}

/** Reads a provider response strictly: rows for another base, another quote than asked, a date outside the window or an unreadable rate are dropped. */
export function parseRates(body: unknown, request: RateRequest, fetchedAt: string): ExchangeRate[] {
  if (!Array.isArray(body)) throw new Error('Respuesta de cotizaciones inválida.');
  const asked = new Set(request.quotes);
  const rows: ExchangeRate[] = [];
  for (const item of body) {
    if (!item || typeof item !== 'object') continue;
    const { date, base, quote, rate } = item as Record<string, unknown>;
    if (base !== FX_PIVOT || !isStorableCurrency(quote) || !asked.has(quote) || typeof date !== 'string' || !validDateISO(date)
      || date < request.from || date > request.to) continue;
    const text = rateText(rate);
    if (text) rows.push({ base: FX_PIVOT, quote, rate: text, effectiveDate: date, source: FRANKFURTER_SOURCE, fetchedAt });
  }
  return rows;
}

export type FetchFailure = 'offline' | 'provider';
export class RateFetchError extends Error {
  readonly kind: FetchFailure;
  constructor(kind: FetchFailure) { super(kind === 'offline' ? 'Sin conexión.' : 'El proveedor de cotizaciones no respondió.'); this.kind = kind; }
}

/** Fetches one window of rates. A network failure or a timeout is `offline`; an HTTP error or an unreadable body is `provider`. */
export async function fetchFrankfurter(request: RateRequest, fetchImpl: FetchLike, now: () => Date = () => new Date()): Promise<ExchangeRate[]> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(frankfurterUrl(request), { headers: { Accept: 'application/json' }, ...(controller ? { signal: controller.signal } : {}) });
  } catch { throw new RateFetchError('offline'); }
  finally { if (timer) clearTimeout(timer); }
  if (!response.ok) throw new RateFetchError('provider');
  let body: unknown;
  try { body = await response.json(); } catch { throw new RateFetchError('provider'); }
  try { return parseRates(body, request, now().toISOString()); } catch { throw new RateFetchError('provider'); }
}
