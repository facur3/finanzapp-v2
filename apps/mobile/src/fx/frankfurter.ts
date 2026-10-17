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

/** The longest wait a provider's Retry-After can impose on the store (a larger or unreadable value is capped here). */
export const RETRY_AFTER_CAP_MS = 6 * 60 * 60 * 1000;

export interface RateRequest { from: string; to: string; quotes: readonly Currency[] }
/** `credentials: 'omit'`: the request carries no cookie and stores none, so nothing set by the provider or a CDN in front
 * of it can become an identifier across requests. */
export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string>; credentials?: 'omit' }) =>
  Promise<{ ok: boolean; status: number; headers?: { get(name: string): string | null }; json(): Promise<unknown> }>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The request's URL. Only a calendar date travels as `from` and `to`: anything else is refused before a request is made. */
export function frankfurterUrl(request: RateRequest): string {
  if (!DAY.test(request.from) || !DAY.test(request.to) || !validDateISO(request.from) || !validDateISO(request.to)) throw new Error('Período de cotizaciones inválido.');
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
  /** A 4xx other than 408 and 429: the request itself was refused (a code the provider does not know), not a passing failure. */
  readonly rejected: boolean;
  /** The wait the provider asked for (Retry-After), when it sent one. */
  readonly retryAfterMs: number | null;
  constructor(kind: FetchFailure, { rejected = false, retryAfterMs = null }: { rejected?: boolean; retryAfterMs?: number | null } = {}) {
    super(kind === 'offline' ? 'Sin conexión.' : 'El proveedor de cotizaciones no respondió.');
    this.kind = kind; this.rejected = rejected; this.retryAfterMs = retryAfterMs;
  }
}

/** Retry-After as seconds or as an HTTP date, in milliseconds from `now`; null when absent, unreadable or not in the future. */
export function retryAfterMs(value: string | null | undefined, now: Date): number | null {
  const text = value?.trim();
  if (!text) return null;
  const ms = /^\d+$/.test(text) ? Number(text) * 1000 : Date.parse(text) - now.getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, RETRY_AFTER_CAP_MS) : null;
}

/** Fetches one window of rates. A network failure or a timeout is `offline`; an HTTP error or an unreadable body is `provider`:
 * transient for 408, 429 and 5xx (with the provider's Retry-After), `rejected` for any other 4xx. A body of rows none of which
 * can be read (a change of shape) is a provider failure too, never an empty success that would seal a month without rates. */
export async function fetchFrankfurter(request: RateRequest, fetchImpl: FetchLike, now: () => Date = () => new Date()): Promise<ExchangeRate[]> {
  const url = frankfurterUrl(request);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' }, credentials: 'omit', ...(controller ? { signal: controller.signal } : {}) });
  } catch { throw new RateFetchError('offline'); }
  finally { if (timer) clearTimeout(timer); }
  if (!response.ok) {
    const { status } = response;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) throw new RateFetchError('provider', { rejected: true });
    throw new RateFetchError('provider', { retryAfterMs: retryAfterMs(response.headers?.get('Retry-After'), now()) });
  }
  let body: unknown;
  try { body = await response.json(); } catch { throw new RateFetchError('provider'); }
  let rows: ExchangeRate[];
  try { rows = parseRates(body, request, now().toISOString()); } catch { throw new RateFetchError('provider'); }
  if (Array.isArray(body) && body.length > 0 && rows.length === 0) throw new RateFetchError('provider');
  return rows;
}
