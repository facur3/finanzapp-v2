/** Exchange rates and consolidated views (Producto 24C1, docs/currency.md §8).
 *
 * The ledger never converts: every account keeps its own currency and every stored amount
 * stays in it. This module only builds *views*: a total in one chosen currency, computed from
 * the recorded amounts with dated reference rates, exactly.
 *
 * Rules:
 *   - A rate is exact decimal text ("1508.19"), read into a rational of BigInts; no floating
 *     point touches an amount. `1 base = rate quote`; the base is always USD, the pivot the
 *     provider publishes every currency against (FX_PIVOT).
 *   - A conversion from A to B uses both legs of the same day: minor_B = minor_A × (r_B / r_A)
 *     × 10^(e_B − e_A), rounded half away from zero **once**, on the converted figure.
 *   - Each movement is converted with the rate of its own date (the latest publication on or
 *     before it, at most RATE_MAX_AGE_DAYS old: weekends and holidays have no publication),
 *     never with today's rate. A balance is converted with the rate of the day asked for.
 *   - Aggregates are integer sums of converted movements, so categories, merchants, days and
 *     budgets add up to the total exactly.
 *   - No usable rate is **unknown**: the movement stays out of the converted view and is
 *     listed, so a screen can tell a complete total from a partial one. A partial sum is
 *     never presented as a total; zero is never substituted. */
import { assertStorableCurrency, minorUnitExponent, sortCurrencies, type IsoCurrencyCode } from './currency.ts';
import { validDateISO, type Account, type Currency, type Entry, type LedgerSnapshot } from './ledger.ts';

/** The currency every stored rate is quoted against. */
export const FX_PIVOT: IsoCurrencyCode = 'USD';
/** How old a rate may be for a given day (a long weekend and a holiday fit; a month-old figure does not). */
export const RATE_MAX_AGE_DAYS = 7;
/** Longest rate text: ≤ 18 significant digits and ≤ 12 decimals (docs/currency.md §8.1). */
export const MAX_RATE_DIGITS = 18;
export const MAX_RATE_DECIMALS = 12;

export interface ExchangeRate {
  /** Always FX_PIVOT today; kept on the record so a stored row says what it means. */
  base: IsoCurrencyCode;
  quote: IsoCurrencyCode;
  /** Exact decimal text: 1 base = rate quote. */
  rate: string;
  /** YYYY-MM-DD: the publication day the provider gives the rate (not the day it was fetched). */
  effectiveDate: string;
  /** Who published it, as named to the person ("Frankfurter"). */
  source: string;
  /** ISO timestamp of the download. */
  fetchedAt: string;
}

export interface Rational { num: bigint; den: bigint }

const RATE_TEXT = /^(\d+)(?:\.(\d+))?$/;

/** Reads rate text into an exact positive rational, or throws. "1508.19" → 150819/100. */
export function parseRate(text: string): Rational {
  const match = typeof text === 'string' ? RATE_TEXT.exec(text) : null;
  if (!match) throw new Error('Cotización inválida.');
  const whole = match[1], fraction = match[2] ?? '';
  const digits = (whole + fraction).replace(/^0+/, '');
  if (fraction.length > MAX_RATE_DECIMALS || digits.length > MAX_RATE_DIGITS || !digits.length) throw new Error('Cotización inválida.');
  return { num: BigInt(whole + fraction), den: 10n ** BigInt(fraction.length) };
}

export function isRateText(text: unknown): text is string {
  try { parseRate(text as string); return true; } catch { return false; }
}

/** num/den rounded half away from zero (den > 0). */
export function roundHalfAwayFromZero(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error('Denominador inválido.');
  const negative = num < 0n;
  const absolute = negative ? -num : num;
  const quotient = absolute / den, remainder = absolute % den;
  const rounded = remainder * 2n >= den ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** minor units of `from` → minor units of `to`, given `1 from = rate to`. Exact, rounded once;
 * null when the result would leave the safe integer range (never a rounded or clamped figure). */
export function convertMinor(minor: number, from: IsoCurrencyCode, to: IsoCurrencyCode, rate: Rational): number | null {
  if (!Number.isSafeInteger(minor)) throw new Error('Monto inválido.');
  if (rate.num <= 0n || rate.den <= 0n) throw new Error('Cotización inválida.');
  const shift = minorUnitExponent(to) - minorUnitExponent(from);
  const num = BigInt(minor) * rate.num * (shift > 0 ? 10n ** BigInt(shift) : 1n);
  const den = rate.den * (shift < 0 ? 10n ** BigInt(-shift) : 1n);
  const result = roundHalfAwayFromZero(num, den);
  if (result > SAFE || result < -SAFE) return null;
  return result === 0n ? 0 : Number(result);
}

/** `1 from = ? to` through the pivot: r_to / r_from, both `1 USD = r` (the pivot's own rate is 1). */
export function crossRate(fromPerPivot: Rational | null, toPerPivot: Rational | null): Rational {
  const a = fromPerPivot ?? { num: 1n, den: 1n }, b = toPerPivot ?? { num: 1n, den: 1n };
  return { num: b.num * a.den, den: b.den * a.num };
}

function daysBetween(earlier: string, later: string): number {
  return Math.round((Date.parse(later + 'T12:00:00Z') - Date.parse(earlier + 'T12:00:00Z')) / 86400000);
}

/** One leg the conversion used: its record, and how it was applied. */
export interface RateLeg { quote: IsoCurrencyCode; rate: string; effectiveDate: string; source: string }

export type RateLookup =
  | { status: 'ok'; leg: RateLeg; rational: Rational }
  | { status: 'missing'; quote: IsoCurrencyCode; date: string; latest?: string };

/** The rates the app holds, indexed for "the latest publication on or before a day". Built once
 * per set of rows; rows for another base, malformed text or a bad date are ignored, and for one
 * (quote, day) the most recently fetched row wins. */
export interface RateBook {
  lookup(quote: IsoCurrencyCode, date: string): RateLookup;
  /** Every quote the book holds a rate for. */
  quotes(): IsoCurrencyCode[];
  size: number;
}

export function rateBook(rows: readonly ExchangeRate[]): RateBook {
  const byQuote = new Map<IsoCurrencyCode, ExchangeRate[]>();
  for (const row of rows) {
    if (row.base !== FX_PIVOT || row.quote === FX_PIVOT || !validDateISO(row.effectiveDate) || !isRateText(row.rate)) continue;
    const list = byQuote.get(row.quote) ?? [];
    const index = list.findIndex(item => item.effectiveDate === row.effectiveDate);
    if (index < 0) list.push(row);
    else if (row.fetchedAt > list[index].fetchedAt) list[index] = row;
    byQuote.set(row.quote, list);
  }
  for (const list of byQuote.values()) list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const parsed = new Map<ExchangeRate, Rational>();
  let size = 0;
  for (const list of byQuote.values()) size += list.length;
  return {
    size,
    quotes: () => sortCurrencies(byQuote.keys()),
    lookup(quote, date) {
      const list = byQuote.get(quote) ?? [];
      // Binary search for the last row on or before `date`.
      let low = 0, high = list.length - 1, found = -1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (list[middle].effectiveDate <= date) { found = middle; low = middle + 1; } else high = middle - 1;
      }
      const row = found >= 0 ? list[found] : null;
      if (!row || daysBetween(row.effectiveDate, date) > RATE_MAX_AGE_DAYS) {
        const latest = row?.effectiveDate ?? (list.length ? list[list.length - 1].effectiveDate : undefined);
        return latest ? { status: 'missing', quote, date, latest } : { status: 'missing', quote, date };
      }
      let rational = parsed.get(row);
      if (!rational) { rational = parseRate(row.rate); parsed.set(row, rational); }
      return { status: 'ok', rational, leg: { quote, rate: row.rate, effectiveDate: row.effectiveDate, source: row.source } };
    },
  };
}

export type Conversion =
  | { status: 'converted'; minor: number; legs: RateLeg[] }
  /** `quote`: the pivot leg that had no usable rate (the currency whose publication is missing). */
  | { status: 'missing'; from: IsoCurrencyCode; to: IsoCurrencyCode; quote: IsoCurrencyCode; date: string; latest?: string }
  | { status: 'out-of-range' };

/** An amount recorded in `from` on `date`, expressed in `to` with that day's rates. Same currency: unchanged, no rate. */
export function convertOn(book: RateBook, minor: number, from: IsoCurrencyCode, to: IsoCurrencyCode, date: string): Conversion {
  assertStorableCurrency(from); assertStorableCurrency(to);
  if (from === to) return { status: 'converted', minor, legs: [] };
  if (from !== FX_PIVOT && to !== FX_PIVOT) {
    // A cross rate uses both legs of one publication day: the latest day on or before `date` (within the age
    // limit) on which both quotes were published. Mixing Friday's leg with Monday's would not be that day's rate.
    let day = date;
    for (let step = 0; step <= RATE_MAX_AGE_DAYS + 1; step++) {
      const a = book.lookup(from, day), b = book.lookup(to, day);
      if (step === 0 && a.status !== 'ok') return missingFor(book, from, from, to, date);
      if (step === 0 && b.status !== 'ok') return missingFor(book, to, from, to, date);
      if (a.status !== 'ok' || b.status !== 'ok') break;
      if (daysBetween(a.leg.effectiveDate, date) > RATE_MAX_AGE_DAYS || daysBetween(b.leg.effectiveDate, date) > RATE_MAX_AGE_DAYS) break;
      if (a.leg.effectiveDate === b.leg.effectiveDate) {
        const converted = convertMinor(minor, from, to, crossRate(a.rational, b.rational));
        return converted === null ? { status: 'out-of-range' } : { status: 'converted', minor: converted, legs: [a.leg, b.leg] };
      }
      day = a.leg.effectiveDate < b.leg.effectiveDate ? a.leg.effectiveDate : b.leg.effectiveDate;
    }
    // No common publication day within the limit: unknown, never a mix of two days.
    const latestFrom = book.lookup(from, date), latestTo = book.lookup(to, date);
    const older = latestFrom.status === 'ok' && latestTo.status === 'ok' && latestFrom.leg.effectiveDate < latestTo.leg.effectiveDate ? from : to;
    const found = book.lookup(older, date);
    const latest = found.status === 'ok' ? found.leg.effectiveDate : found.latest;
    return latest ? { status: 'missing', from, to, quote: older, date, latest } : { status: 'missing', from, to, quote: older, date };
  }
  const quote = from === FX_PIVOT ? to : from;
  const found = book.lookup(quote, date);
  if (found.status !== 'ok') return missingFor(book, quote, from, to, date);
  const converted = convertMinor(minor, from, to, from === FX_PIVOT ? crossRate(null, found.rational) : crossRate(found.rational, null));
  return converted === null ? { status: 'out-of-range' } : { status: 'converted', minor: converted, legs: [found.leg] };
}

function missingFor(book: RateBook, quote: IsoCurrencyCode, from: IsoCurrencyCode, to: IsoCurrencyCode, date: string): Conversion {
  const found = book.lookup(quote, date);
  const latest = found.status === 'missing' ? found.latest : undefined;
  return latest ? { status: 'missing', from, to, quote, date, latest } : { status: 'missing', from, to, quote, date };
}

/** A movement the converted view could not include, and why. */
export interface Unconverted { entryId: string; kind: Entry['kind']; currency: IsoCurrencyCode; dateISO: string;
  /** The rate that was missing (a pivot quote: the movement's currency or the target). */
  quote?: IsoCurrencyCode; latest?: string; reason: 'missing' | 'out-of-range' }

/** What a converted figure rests on: the rate days used, oldest and newest, and the sources. */
export interface Provenance { converted: number; oldest: string | null; newest: string | null; sources: string[] }

function emptyProvenance(): Provenance { return { converted: 0, oldest: null, newest: null, sources: [] }; }
function note(provenance: Provenance, legs: readonly RateLeg[]): void {
  if (!legs.length) return;
  provenance.converted++;
  for (const leg of legs) {
    if (provenance.oldest === null || leg.effectiveDate < provenance.oldest) provenance.oldest = leg.effectiveDate;
    if (provenance.newest === null || leg.effectiveDate > provenance.newest) provenance.newest = leg.effectiveDate;
    if (!provenance.sources.includes(leg.source)) provenance.sources.push(leg.source);
  }
}

/** The ledger's movements expressed in `target`, for views only (reports, summaries, budgets).
 *
 * `snapshot` is a LedgerSnapshot in which every account carries `target` and every expense and
 * income carries its amount converted with the rates of its own date, so every report function
 * of the domain (they scope by the account's currency) reads a consolidated ledger unchanged.
 * Transfers are left out: they are never spending or income, and their two legs are one currency.
 * Opening balances are not converted here (balances use `consolidatedBalance`). Movements whose
 * rate is unknown are absent from `snapshot` and listed in `unconverted`; `complete` tells a
 * screen whether a period may be shown as a total. Never written anywhere. */
export interface ConsolidatedLedger {
  target: IsoCurrencyCode;
  snapshot: LedgerSnapshot;
  unconverted: Unconverted[];
  /** Currencies of the movements (not of the target) this view had to convert. */
  foreign: IsoCurrencyCode[];
  /** The rates behind the converted movements of a period (all of them when no period is given). */
  provenance(startISO?: string, endISO?: string, kind?: Entry['kind']): Provenance;
  /** True when every movement in [startISO, endISO] (of `kind`, when given) is in `snapshot`. */
  complete(startISO: string, endISO: string, kind?: Entry['kind']): boolean;
  /** The unconverted movements of a period, for the screen's explanation. */
  missingIn(startISO: string, endISO: string, kind?: Entry['kind']): Unconverted[];
}

export function consolidatedLedger(snapshot: LedgerSnapshot, target: IsoCurrencyCode, book: RateBook): ConsolidatedLedger {
  assertStorableCurrency(target);
  const currencyOf = new Map<string, Currency>(snapshot.accounts.map(account => [account.id, account.currency]));
  const accounts: Account[] = snapshot.accounts.map(account => ({ ...account, currency: target }));
  const entries: Entry[] = [];
  const unconverted: Unconverted[] = [];
  const legsOf = new Map<string, RateLeg[]>();
  const foreign = new Set<IsoCurrencyCode>();
  for (const entry of snapshot.entries) {
    const currency = currencyOf.get(entry.accountId);
    if (!currency) continue;
    if (currency !== target) foreign.add(currency);
    const conversion = convertOn(book, entry.amountMinor, currency, target, entry.dateISO);
    if (conversion.status === 'converted') {
      entries.push(conversion.minor === entry.amountMinor ? entry : { ...entry, amountMinor: conversion.minor });
      if (conversion.legs.length) legsOf.set(entry.id, conversion.legs);
    } else {
      unconverted.push({ entryId: entry.id, kind: entry.kind, currency, dateISO: entry.dateISO, reason: conversion.status,
        ...(conversion.status === 'missing' ? { quote: conversion.quote } : {}),
        ...(conversion.status === 'missing' && conversion.latest ? { latest: conversion.latest } : {}) });
    }
  }
  const inPeriod = (dateISO: string, kind: Entry['kind'], start?: string, end?: string, only?: Entry['kind']) =>
    (start === undefined || dateISO >= start) && (end === undefined || dateISO <= end) && (only === undefined || kind === only);
  return {
    target,
    snapshot: { accounts, entries, transfers: [] },
    unconverted,
    foreign: sortCurrencies(foreign),
    provenance(start, end, kind) {
      const result = emptyProvenance();
      for (const entry of entries) if (inPeriod(entry.dateISO, entry.kind, start, end, kind)) note(result, legsOf.get(entry.id) ?? []);
      return result;
    },
    complete: (start, end, kind) => !unconverted.some(item => inPeriod(item.dateISO, item.kind, start, end, kind)),
    missingIn: (start, end, kind) => unconverted.filter(item => inPeriod(item.dateISO, item.kind, start, end, kind)),
  };
}

/** A total in one currency made of per-currency parts. `single`: nothing needed converting.
 * `converted`: every part had a rate; `minor` is the exact sum of the parts, each rounded once.
 * `unknown`: at least one part had no usable rate; there is no total, only the parts. */
export type ConvertedTotal =
  | { status: 'single'; currency: IsoCurrencyCode; minor: number; parts: ConvertedPart[] }
  | { status: 'converted'; currency: IsoCurrencyCode; minor: number; parts: ConvertedPart[]; provenance: Provenance }
  | { status: 'unknown'; currency: IsoCurrencyCode; parts: ConvertedPart[]; missing: { from: IsoCurrencyCode; to: IsoCurrencyCode; quote: IsoCurrencyCode; date: string; latest?: string }[] }
  | { status: 'out-of-range'; currency: IsoCurrencyCode; parts: ConvertedPart[] };

export interface ConvertedPart { currency: IsoCurrencyCode; minor: number; converted?: { minor: number; legs: RateLeg[] } }

/** Per-currency amounts as of one day (balances) expressed in `target`: each part converted once
 * with that day's rate, then added exactly. A part without a usable rate makes the total unknown. */
export function convertTotals(totals: Partial<Record<IsoCurrencyCode, number>>, target: IsoCurrencyCode, book: RateBook, date: string): ConvertedTotal {
  assertStorableCurrency(target);
  if (!validDateISO(date)) throw new Error('Fecha inválida.');
  const parts: ConvertedPart[] = [];
  const missing: { from: IsoCurrencyCode; to: IsoCurrencyCode; quote: IsoCurrencyCode; date: string; latest?: string }[] = [];
  const provenance = emptyProvenance();
  let sum = 0n, outOfRange = false;
  for (const currency of sortCurrencies(Object.keys(totals) as IsoCurrencyCode[])) {
    const minor = totals[currency]!;
    const conversion = convertOn(book, minor, currency, target, date);
    if (conversion.status === 'converted') {
      parts.push(conversion.legs.length ? { currency, minor, converted: { minor: conversion.minor, legs: conversion.legs } } : { currency, minor });
      note(provenance, conversion.legs);
      sum += BigInt(conversion.minor);
    } else {
      parts.push({ currency, minor });
      if (conversion.status === 'missing') missing.push({ from: conversion.from, to: conversion.to, quote: conversion.quote, date: conversion.date, ...(conversion.latest ? { latest: conversion.latest } : {}) });
      else outOfRange = true;
    }
  }
  if (missing.length) return { status: 'unknown', currency: target, parts, missing };
  if (outOfRange || sum > SAFE || sum < -SAFE) return { status: 'out-of-range', currency: target, parts };
  const minor = sum === 0n ? 0 : Number(sum);
  return provenance.converted ? { status: 'converted', currency: target, minor, parts, provenance } : { status: 'single', currency: target, minor, parts };
}

/** The pivot quotes a set of currencies needs to be expressed in `target` (never the pivot itself; nothing when all are the target). */
export function quotesNeeded(currencies: Iterable<IsoCurrencyCode>, target: IsoCurrencyCode): IsoCurrencyCode[] {
  const set = new Set<IsoCurrencyCode>();
  let foreign = false;
  for (const currency of currencies) if (currency !== target) { foreign = true; if (currency !== FX_PIVOT) set.add(currency); }
  if (foreign && target !== FX_PIVOT) set.add(target);
  return sortCurrencies(set);
}
