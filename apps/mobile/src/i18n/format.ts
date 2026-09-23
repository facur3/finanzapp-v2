/** Presentation formats per locale: dates, counts, percentages and the way an
 * amount is written for a reader. Everything is pure and deterministic: the
 * month and weekday names are tables, not the device's ICU data, so a label
 * reads the same on every iPhone and in Node, and the domain's integer
 * amounts are formatted by string transforms only. No floating-point value
 * ever stands for money here.
 *
 * `formatMinorUnits` (the domain) remains the one money formatter and its
 * Argentine output is unchanged; en-US only swaps the separators of that
 * output. Storage, parsing and the amount field are untouched. */
import { formatMinorUnits, type Currency } from '@finanzapp/domain';
import { DEFAULT_LOCALE, languageOf, type AppLocale } from './locale.ts';

const NBSP = '\u00A0';

const MONTHS = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
} as const;
// Same abbreviations the ledger's own labels use ("13 jul"), independent of the device's CLDR ("sept").
const MONTHS_SHORT = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
} as const;
const WEEKDAYS = {
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;

/** A calendar date from "YYYY-MM-DD" (local, at noon so no zone shift changes the day); null when malformed or impossible. */
export function dateFromISO(dateISO: string): { year: number; month: number; day: number; weekday: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO ?? ''));
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month, day, weekday: date.getDay() };
}

export type DateStyle =
  /** 22 sep · Sep 22 */ 'day'
  /** 22 sep 2026 · Sep 22, 2026 */ | 'dayYear'
  /** 22 de septiembre de 2026 · September 22, 2026 */ | 'long'
  /** martes, 22 de septiembre de 2026 · Tuesday, September 22, 2026 */ | 'weekdayLong'
  /** septiembre · September */ | 'month'
  /** septiembre de 2026 · September 2026 */ | 'monthYear';

/** A stored date the way the locale writes it. A malformed date comes back as
 * given rather than as a fabricated one. */
export function formatDate(dateISO: string, style: DateStyle, locale: AppLocale = DEFAULT_LOCALE): string {
  const date = dateFromISO(dateISO);
  if (!date) return String(dateISO ?? '');
  const language = languageOf(locale);
  const month = MONTHS[language][date.month - 1], short = MONTHS_SHORT[language][date.month - 1], weekday = WEEKDAYS[language][date.weekday];
  if (language === 'en') {
    switch (style) {
      case 'day': return `${short} ${date.day}`;
      case 'dayYear': return `${short} ${date.day}, ${date.year}`;
      case 'long': return `${month} ${date.day}, ${date.year}`;
      case 'weekdayLong': return `${weekday}, ${month} ${date.day}, ${date.year}`;
      case 'month': return month;
      case 'monthYear': return `${month} ${date.year}`;
    }
  }
  switch (style) {
    case 'day': return `${date.day} ${short}`;
    case 'dayYear': return `${date.day} ${short} ${date.year}`;
    case 'long': return `${date.day} de ${month} de ${date.year}`;
    case 'weekdayLong': return `${weekday}, ${date.day} de ${month} de ${date.year}`;
    case 'month': return month;
    case 'monthYear': return `${month} de ${date.year}`;
  }
}

/** "YYYY-MM" the way the locale names a month. */
export function formatMonth(monthISO: string, locale: AppLocale = DEFAULT_LOCALE, style: 'month' | 'monthYear' = 'monthYear'): string {
  const text = /^\d{4}-\d{2}$/.test(monthISO) && dateFromISO(monthISO + '-01') ? formatDate(monthISO + '-01', style, locale) : null;
  return text ?? String(monthISO ?? '');
}

/** Whole days from `dateISO` to `todayISO` (positive when the date is in the past); null when either is malformed. */
export function daysAgo(dateISO: string, todayISO: string): number | null {
  if (!dateFromISO(dateISO) || !dateFromISO(todayISO)) return null;
  return Math.round((Date.parse(todayISO + 'T12:00:00Z') - Date.parse(dateISO + 'T12:00:00Z')) / 86400000);
}

/** The relative name of a day when it has one: Hoy, Ayer, Anteayer, a weekday
 * within the last week; otherwise null (the caller shows the plain date). */
export function relativeDayName(dateISO: string, todayISO: string, locale: AppLocale = DEFAULT_LOCALE): string | null {
  const days = daysAgo(dateISO, todayISO);
  const date = dateFromISO(dateISO);
  if (days === null || !date) return null;
  const language = languageOf(locale);
  if (days === 0) return language === 'en' ? 'Today' : 'Hoy';
  if (days === 1) return language === 'en' ? 'Yesterday' : 'Ayer';
  if (days === 2 && language === 'es') return 'Anteayer';
  if (days > 1 && days < 7) return WEEKDAYS[language][date.weekday];
  return null;
}

/** An ISO timestamp as a short local date and time, minutes precision. */
export function formatDateTime(iso: string, locale: AppLocale = DEFAULT_LOCALE): string {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return String(iso ?? '');
  const day = time.getDate(), month = time.getMonth() + 1, year = time.getFullYear();
  const minutes = String(time.getMinutes()).padStart(2, '0');
  if (languageOf(locale) === 'en') {
    const hours = time.getHours() % 12 || 12;
    return `${month}/${day}/${year}, ${hours}:${minutes} ${time.getHours() < 12 ? 'AM' : 'PM'}`;
  }
  return `${day}/${month}/${year}, ${String(time.getHours()).padStart(2, '0')}:${minutes}`;
}

/** Groups the digits of a non-negative integer string with the locale's thousands separator. */
function groupDigits(digits: string, locale: AppLocale): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, languageOf(locale) === 'en' ? ',' : '.');
}

/** A count (of movements, of days) with thousands grouping. Not for money. */
export function formatCount(value: number, locale: AppLocale = DEFAULT_LOCALE): string {
  if (!Number.isSafeInteger(value)) return String(value);
  return (value < 0 ? '-' : '') + groupDigits(String(Math.abs(value)), locale);
}

/** A ratio as a percentage: 0.3 → "30 %" (es) / "30%" (en), at most one
 * decimal, rounded half up on the decimal value ("12,35" → "12,4"). A
 * positive share below a tenth of a percent reads "<0,1 %" rather than "0 %",
 * so a real expense never looks like nothing. Display only: the ratio itself
 * was computed by the caller from integer amounts. */
export function formatPercent(fraction: number, locale: AppLocale = DEFAULT_LOCALE): string {
  const en = languageOf(locale) === 'en';
  const suffix = en ? '%' : NBSP + '%';
  if (!Number.isFinite(fraction)) return '—';
  const value = Math.abs(fraction) * 100;
  if (value > 0 && value < 0.1) return '<' + (en ? '0.1' : '0,1') + suffix;
  // Round on the shortest decimal representation, as a person would, not on the binary double.
  const tenths = Math.round(Number(value.toFixed(10)) * 10);
  const whole = Math.floor(tenths / 10), tenth = tenths % 10;
  const digits = groupDigits(String(whole), locale) + (tenth ? (en ? '.' : ',') + tenth : '');
  return (fraction < 0 ? '−' : '') + digits + suffix;
}

/** The currency's short sign for the locale. In Argentine Spanish "$" is the
 * peso and the dollar carries its prefix; in US English "$" would read as
 * the dollar, so both are prefixed and neither is ambiguous. */
export function currencySymbol(currency: Currency, locale: AppLocale = DEFAULT_LOCALE): string {
  if (languageOf(locale) === 'en') return currency === 'USD' ? 'US$' : 'AR$';
  return currency === 'USD' ? 'US$' : '$';
}

/** The domain's formatted amount in the locale's separators. Argentine
 * output is the domain string itself; US English swaps "." and ",". The
 * digits, the sign and the two decimals never change. */
export function formatAmount(minor: number, locale: AppLocale = DEFAULT_LOCALE): string {
  const text = formatMinorUnits(minor);
  return languageOf(locale) === 'en' ? text.replace(/[.,]/g, char => char === '.' ? ',' : '.') : text;
}

/** An amount for prose and detail rows: sign, symbol, a non-breaking space
 * and the number, so "US$ 1.234,56" never splits at a line end. `absolute`
 * drops the sign for callers that word it ("deuda", "a favor"). */
export function moneyText(minor: number, currency: Currency, locale: AppLocale = DEFAULT_LOCALE, absolute = false): string {
  const value = absolute ? Math.abs(minor) : minor;
  return (value < 0 ? '−' : '') + currencySymbol(currency, locale) + NBSP + formatAmount(Math.abs(value), locale);
}

/** "ARS 1.234,56": the ISO code before the amount, joined so the code can never sit alone on a line. */
export function codedAmount(minor: number, currency: Currency, locale: AppLocale = DEFAULT_LOCALE): string {
  return currency + NBSP + formatAmount(minor, locale);
}

/** "Deuda registrada · ARS": a label with its currency code, joined so the
 * code stays with the last word when the line wraps. */
export function withCurrencyCode(label: string, currency: Currency): string {
  return label + NBSP + '·' + NBSP + currency;
}

/** What VoiceOver reads for an amount: the number, then the currency in words. */
export function spokenMoney(minor: number, currency: Currency, locale: AppLocale = DEFAULT_LOCALE): string {
  const en = languageOf(locale) === 'en';
  const unit = currency === 'USD' ? (en ? 'dollars' : 'dólares') : 'pesos';
  return (minor < 0 ? (en ? 'Minus ' : 'Menos ') : '') + formatAmount(Math.abs(minor), locale) + ' ' + unit;
}

/** The full name of a currency for a chooser or a detail row. */
export function currencyName(currency: Currency, locale: AppLocale = DEFAULT_LOCALE): string {
  const en = languageOf(locale) === 'en';
  return currency === 'USD' ? (en ? 'US dollars' : 'Dólares estadounidenses') : (en ? 'Argentine pesos' : 'Pesos argentinos');
}
