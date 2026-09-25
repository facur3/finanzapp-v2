/** Presentation formats per locale: dates, counts, percentages and the way an
 * amount is written for a reader. The locale's two halves play different
 * parts: the **language** gives the words (month and weekday names, relative
 * days, the phrasing of a long date, spoken amounts, currency names, the space
 * before "%"); the **region** gives the conventions (decimal and thousands
 * separators, the order of a numeric date, 24 h or AM/PM, which currency a
 * bare "$" means). English with Argentine conventions reads "Sep 22" and
 * "1.234,56"; Spanish with US conventions reads "22 sep" and "1,234.56". Everything is pure and deterministic: the
 * month and weekday names are tables, not the device's ICU data, so a label
 * reads the same on every iPhone and in Node, and the domain's integer
 * amounts are formatted by string transforms only. No floating-point value
 * ever stands for money here.
 *
 * Since Producto 24A an amount with its currency is written from the
 * domain's digits (`splitMinor`) with that currency's own decimals (ISO 4217
 * minor unit, shown down to CLDR's display digits), so JPY has none and KWD
 * three; ARS and USD keep exactly their two decimals and every string they had
 * (tests/currency-presentation.node.ts compares them with the pre-24A code).
 * `formatAmount` and `spokenNumber` (no currency) stay the ledger's two-decimal
 * notation: since Producto 24B3 no screen calls them (they are not bound in
 * `bind.ts`, and a test bans them in `app/` and `src/ui/`); they remain here as
 * the pinned exponent-2 path their goldens compare against. The screens never
 * call the domain formatter directly: every visible amount goes through
 * `formatMoneyAmount`/`moneyText` (the region's separators, the currency's
 * decimals) and every VoiceOver amount through the `spoken*` functions (the
 * language's own decimal separator and no grouping, see `spokenMinor`). Storage
 * and parsing are untouched; the amount field reads and writes the region's
 * separators through `ui/money-input.ts` with the `amountFormat` below. */
import { currencyRecord, displayDigits, formatMinorUnits, splitMinor, type IsoCurrencyCode } from '@finanzapp/domain';
import { CURRENCY_NAMES } from './currencies/index.ts';
import type { CurrencyNameForms } from './currencies/types.ts';
import { DEFAULT_LOCALE, SPEECH_REGIONS, completeConventions, composeLocale, conventionsOf, languageOf, registryRegionOf, type AppLocale, type LanguageCode, type RegionConventions } from './locale.ts';

/** The conventions a formatter writes in: the ones passed explicitly (a catalogue region under test or, from
 * 24R2, the resolved region), otherwise the released region of the locale. Every optional field filled. */
function conventions(locale: AppLocale, explicit?: RegionConventions): Required<RegionConventions> {
  return completeConventions(explicit ?? conventionsOf(locale));
}

/** A numeric date in the region's order, separator and padding. With `withYear` false the year is left
 * out. The released regions keep their 23.1 strings (unpadded, "/"). */
function numericDate(date: { year: number; month: number; day: number }, c: Required<RegionConventions>, withYear: boolean): string {
  const pad = (value: number) => c.paddedDate ? String(value).padStart(2, '0') : String(value);
  const day = pad(date.day), month = pad(date.month), year = String(date.year);
  const parts = c.dateOrder === 'mdy' ? [month, day, year] : c.dateOrder === 'ymd' ? [year, month, day] : [day, month, year];
  return (withYear ? parts : parts.filter(part => part !== year)).join(c.dateSeparator);
}

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

/** A month as a title: only the first letter is raised, the rest stays as the language writes it ("Septiembre de
 * 2026", never "Septiembre De 2026" as a style-level capitalize draws it; "September 2026"). 24UX5 review. */
export function formatMonthTitle(monthISO: string, locale: AppLocale = DEFAULT_LOCALE, style: 'month' | 'monthYear' = 'monthYear'): string {
  const text = formatMonth(monthISO, locale, style);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
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

/** A row's date: Hoy, Ayer, Anteayer (Today, Yesterday), otherwise the short
 * date, with the year when it is not the current one. In Spanish this is the
 * domain's `labelFromISO` byte for byte; a future date is never relative.
 * `inline` is for a day placed inside a sentence ("Vence hoy", "open since
 * yesterday"): the relative names start in lower case. The short dates are
 * the same either way; an English one starts with its month ("Due Oct 1"). */
export function relativeDate(dateISO: string, todayISO: string, locale: AppLocale = DEFAULT_LOCALE, inline = false): string {
  const date = dateFromISO(dateISO), today = dateFromISO(todayISO);
  if (!date || !today) return String(dateISO ?? '');
  const days = daysAgo(dateISO, todayISO);
  const en = languageOf(locale) === 'en';
  const name = days === 0 ? (en ? 'Today' : 'Hoy') : days === 1 ? (en ? 'Yesterday' : 'Ayer') : days === 2 && !en ? 'Anteayer' : null;
  if (name) return inline ? name.toLowerCase() : name;
  return formatDate(dateISO, date.year === today.year ? 'day' : 'dayYear', locale);
}

/** A stored date as numbers in the region's order: "22/9/2026" (Argentina), "9/22/2026" (United States),
 * "2026/09/22" (a catalogue region such as Japan, through explicit conventions). */
export function formatNumericDate(dateISO: string, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  const date = dateFromISO(dateISO);
  if (!date) return String(dateISO ?? '');
  return numericDate(date, conventions(locale, explicit), true);
}

/** A day of the current period as numbers without the year, in the region's
 * order: "5/09" in Argentina (as the domain's reports write it) and "9/5" in
 * the United States, where "5/09" would read as May 9. A catalogue region
 * writes its own order, separator and padding ("09/22" in Japan, "5/9" in
 * India: both numbers unpadded). */
export function formatDayMonth(dateISO: string, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  const date = dateFromISO(dateISO);
  if (!date) return String(dateISO ?? '');
  const c = conventions(locale, explicit);
  // The registry keeps the ledger's own writing (the month padded, the day not) whichever object carries its
  // conventions: the locale, `REGIONS`, `catalogueConventions` or `conventionsForRegion` write the same "5/09"
  // (review of PR #53). A catalogue region's own conventions follow their padding.
  if (registryRegionOf(c)) return c.dateOrder === 'mdy' ? `${date.month}/${date.day}` : `${date.day}/${String(date.month).padStart(2, '0')}`;
  return numericDate(date, c, false);
}

/** An ISO timestamp as a short local date and time, minutes precision. */
export function formatDateTime(iso: string, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return String(iso ?? '');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const c = conventions(locale, explicit);
  // The region orders the numbers and picks the clock; the language names the day period.
  const date = numericDate({ year: time.getFullYear(), month: time.getMonth() + 1, day: time.getDate() }, c, true);
  if (c.hour12) {
    const hours = time.getHours() % 12 || 12, morning = time.getHours() < 12;
    const period = languageOf(locale) === 'en' ? (morning ? 'AM' : 'PM') : (morning ? 'a.\u00A0m.' : 'p.\u00A0m.');
    return `${date}, ${hours}:${minutes}${NBSP}${period}`;
  }
  return `${date}, ${String(time.getHours()).padStart(2, '0')}:${minutes}`;
}

/** Groups the digits of a non-negative integer string with the region's separator: the last group of
 * three, then groups of `secondaryGrouping` (3 almost everywhere, 2 for lakh and crore: "12,34,567"),
 * and no separator at all below `minimumGroupingDigits` whole digits before the first one. */
function groupDigits(digits: string, locale: AppLocale, explicit?: RegionConventions): string {
  const c = conventions(locale, explicit);
  if (digits.length < 3 + c.minimumGroupingDigits) return digits;
  const groups: string[] = [];
  let rest = digits;
  groups.unshift(rest.slice(-3)); rest = rest.slice(0, -3);
  const size = Math.max(1, c.secondaryGrouping);
  while (rest.length > size) { groups.unshift(rest.slice(-size)); rest = rest.slice(0, -size); }
  if (rest) groups.unshift(rest);
  return groups.join(c.group);
}

/** A count (of movements, of days) with thousands grouping. Not for money. */
export function formatCount(value: number, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  if (!Number.isSafeInteger(value)) return String(value);
  return (value < 0 ? '-' : '') + groupDigits(String(Math.abs(value)), locale, explicit);
}

/** A ratio as a percentage: 0.3 → "30 %" (Spanish) / "30%" (English), at most one
 * decimal, rounded half up on the decimal value ("12,35" → "12,4"). A
 * positive share below a tenth of a percent reads "<0,1 %" rather than "0 %",
 * so a real expense never looks like nothing. Display only: the ratio itself
 * was computed by the caller from integer amounts. */
export function formatPercent(fraction: number, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  const suffix = languageOf(locale) === 'en' ? '%' : NBSP + '%';
  const decimal = conventions(locale, explicit).decimal;
  if (!Number.isFinite(fraction)) return '—';
  const value = Math.abs(fraction) * 100;
  if (value > 0 && value < 0.1) return '<0' + decimal + '1' + suffix;
  // Round on the shortest decimal representation, as a person would, not on the binary double.
  const tenths = Math.round(Number(value.toFixed(10)) * 10);
  const whole = Math.floor(tenths / 10), tenth = tenths % 10;
  const digits = groupDigits(String(whole), locale, explicit) + (tenth ? decimal + tenth : '');
  return (fraction < 0 ? '−' : '') + digits + suffix;
}

/** The currency's short sign where the reader is. A region decides what a bare
 * "$" means, and FinanzApp only ever writes a bare "$" for the peso in Argentina:
 * elsewhere the peso is "AR$" (FinanzApp's convention, CLDR has no peso symbol),
 * and every other currency takes CLDR's language-neutral symbol, which names one
 * currency only ("US$", "CA$", "€", "JP¥"), or its ISO code ("KWD"). So the dollar
 * reads "US$" in both regions, as it always has. The language plays no part. */
export function currencySymbol(currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  if (currency === 'ARS') return conventions(locale, explicit).dollarSignCurrency === 'ARS' ? '$' : 'AR$';
  return currencyRecord(currency).symbol;
}

/** The fraction digits an amount shows: the currency's decimals, with trailing zeros
 * dropped only down to its display digits, so a recorded fraction is never hidden. */
function shownFraction(fraction: string, currency: IsoCurrencyCode): string {
  const keep = displayDigits(currency);
  let end = fraction.length;
  while (end > keep && fraction[end - 1] === '0') end--;
  return fraction.slice(0, end);
}

/** An amount of a currency in the region's separators, with that currency's decimals:
 * "1.234,56" (ARS, USD), "1.500" (JPY), "1.234,567" (KWD), "1.500" and "1.500,5" (IQD,
 * three ISO decimals shown down to CLDR's none). For ARS and USD it is `formatAmount`. */
export function formatMoneyAmount(minor: number, currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  const { negative, whole, fraction } = splitMinor(minor, currency);
  const shown = shownFraction(fraction, currency);
  return (negative ? '-' : '') + groupDigits(whole, locale, explicit) + (shown ? conventions(locale, explicit).decimal + shown : '');
}

/** An amount rounded to whole units of its currency, grouped, for a chart's scale
 * caption ("escala de 0 a $ 1.234.568"): half a unit and above rounds up, exactly,
 * on the integer digits (never a float). A currency without decimals is the amount
 * itself. Display only: no ledger figure is ever rounded. */
export function formatWholeUnits(minor: number, currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  const { negative, whole, fraction } = splitMinor(minor, currency);
  const units = BigInt(whole) + (fraction && fraction.charCodeAt(0) >= 53 /* '5' */ ? 1n : 0n);
  return (negative && units > 0n ? '-' : '') + groupDigits(units.toString(), locale, explicit);
}

/** The domain's formatted amount in the region's separators. Argentine output
 * is the domain string itself; another region only replaces the separators.
 * The digits, the sign and the two decimals never change. Not bound for screens
 * since 24B3 (see the header): `formatMoneyAmount` with the currency is. */
export function formatAmount(minor: number, locale: AppLocale = DEFAULT_LOCALE): string {
  const text = formatMinorUnits(minor);
  const { decimal, group } = conventionsOf(locale);
  if (decimal === ',' && group === '.') return text;
  return text.replace(/[.,]/g, char => char === '.' ? group : decimal);
}

/** The separators the amount field types in: the region's. */
export function amountFormat(locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): { decimal: string; group: string } {
  const { decimal, group } = conventions(locale, explicit);
  return { decimal, group };
}

/** An amount for prose and detail rows: sign, symbol, a non-breaking space
 * and the number, so "US$ 1.234,56" never splits at a line end. `absolute`
 * drops the sign for callers that word it ("deuda", "a favor"); `signed`
 * adds "+" to a positive amount (income). */
export function moneyText(minor: number, currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE, absolute = false, signed = false, explicit?: RegionConventions): string {
  const value = absolute ? Math.abs(minor) : minor;
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  return sign + currencySymbol(currency, locale, explicit) + NBSP + formatMoneyAmount(Math.abs(value), currency, locale, explicit);
}

/** "ARS 1.234,56": the ISO code before the amount, joined so the code can never sit alone on a line. */
export function codedAmount(minor: number, currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE, explicit?: RegionConventions): string {
  return currency + NBSP + formatMoneyAmount(minor, currency, locale, explicit);
}

/** "Deuda registrada · ARS": a label with its currency code, joined so the
 * code stays with the last word when the line wraps. */
export function withCurrencyCode(label: string, currency: IsoCurrencyCode): string {
  return label + NBSP + '·' + NBSP + currency;
}

/** The locale a VoiceOver string is written in: the interface language with
 * the decimal separator of that language's own speech (`SPEECH_REGIONS`). The
 * words of a VoiceOver label are in the interface language, so the voice
 * reading them expects that language's decimal mark: an English voice reads
 * "1234,56" as "one two three four, fifty-six". The screen keeps the region's
 * separators; only what is spoken changes. */
export function speechLocale(locale: AppLocale = DEFAULT_LOCALE): AppLocale {
  const language = languageOf(locale);
  return composeLocale(language, SPEECH_REGIONS[language]);
}

/** A number of minor units for VoiceOver: the language's decimal separator and
 * no thousands grouping, "1234,56" in Spanish and "1234.56" in English (23.1C2).
 * A group separator is the one mark a voice can misread by a factor of a
 * thousand: a Spanish voice of a variety that writes 1,234.56 (Mexico), or a
 * device Region that does, may read "1.234" as "uno punto dos tres cuatro".
 * Plain digits are the same number for every voice, and a separator before two
 * digits can only be a decimal. The screen keeps the region's grouping. Not
 * bound for screens since 24B3: `spokenMinor` with the currency is. */
export function spokenNumber(minor: number, locale: AppLocale = DEFAULT_LOCALE): string {
  return formatMinorUnits(minor).replace(/\./g, '').replace(',', conventionsOf(speechLocale(locale)).decimal);
}

/** An amount of a currency for VoiceOver: its own decimals (shown as on screen), the
 * language's decimal separator and no grouping. "1234,56" for ARS and USD in Spanish, as
 * `spokenNumber`; "1500" for JPY; "1234.567" for KWD in English. */
export function spokenMinor(minor: number, currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE): string {
  const { negative, whole, fraction } = splitMinor(minor, currency);
  const shown = shownFraction(fraction, currency);
  return (negative ? '-' : '') + whole + (shown ? conventionsOf(speechLocale(locale)).decimal + shown : '');
}

/** An amount with its ISO code for a VoiceOver sentence ("1234,56 ARS"). */
export function spokenAmount(minor: number, currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE): string {
  return spokenMinor(minor, currency, locale) + ' ' + currency;
}

/** A percentage for a VoiceOver sentence: the language's decimal separator, no grouping ("1234,5 %"). */
export function spokenPercent(fraction: number, locale: AppLocale = DEFAULT_LOCALE): string {
  const speech = speechLocale(locale);
  return formatPercent(fraction, speech).split(conventionsOf(speech).group).join('');
}

/** FinanzApp's spoken units for its first two currencies, older than the catalogue and
 * kept word for word: "pesos", "dólares" / "dollars". Every other currency is read with
 * CLDR's name for a count (below). */
const SPOKEN_UNITS: { readonly [Code in IsoCurrencyCode]?: { readonly [Language in LanguageCode]?: string } } = {
  ARS: { es: 'pesos', en: 'pesos' },
  USD: { es: 'dólares', en: 'dollars' },
};

/** The currencies a ledger holds, as the presentation learns them (`HeldCurrenciesProvider`):
 * the one input that can make a short unit word ambiguous. Empty means "nothing else is held". */
export type HeldCurrencies = readonly IsoCurrencyCode[];

/** Whether a short unit word ("pesos", "dólares", "dollars") could also name another
 * currency the ledger holds: another held code whose CLDR plural name in the language
 * contains that word ("pesos chilenos" beside ARS, "Canadian dollars" beside USD). The
 * comparison is on whole words, so "US dollars" is not shared with "Canadian dollars"
 * and "dólares" is not found inside "solares". The currency itself never counts. */
export function unitWordShared(word: string, currency: IsoCurrencyCode, language: LanguageCode, held: HeldCurrencies): boolean {
  const needle = ' ' + word.trim().toLowerCase() + ' ';
  if (needle.trim() === '') return false;
  for (const other of held) {
    if (other === currency) continue;
    const forms = currencyNameForms(other, language);
    if (!forms) continue;
    for (const name of [forms.other, forms.one, forms.name]) if ((' ' + name.toLowerCase() + ' ').includes(needle)) return true;
  }
  return false;
}

/** A currency as a unit in words, for a sentence VoiceOver reads or a label that names it:
 * `word` (a catalogued legacy word such as "pesos" or "dólares") when no other held currency
 * shares it, otherwise CLDR's plural name in the language ("pesos argentinos" beside CLP,
 * "dólares estadounidenses" beside CAD); without a `word`, CLDR's plural name; the ISO code
 * when the language has no name (never a name in another language). `count` selects the
 * singular for exactly one whole unit of a currency without decimals ("1 yen japonés"). */
export function currencyUnit(currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE, held: HeldCurrencies = [], word?: string, count?: string): string {
  const language = languageOf(locale);
  const forms = currencyNameForms(currency, language);
  if (word !== undefined && !unitWordShared(word, currency, language, held)) return word;
  if (!forms) return currency;
  return count === '1' ? forms.one : forms.other;
}

/** What VoiceOver reads for an amount: the number, then the currency in words. ARS and USD
 * keep "pesos" and "dólares"/"dollars" unless another held currency shares the word (24B3;
 * then "pesos argentinos", "US dollars"). Other currencies use CLDR's plural name ("1500
 * yenes japoneses", "1234.567 Kuwaiti dinars"), the singular only when the number read is
 * exactly "1" (one yen; one Iraqi dinar, whose three ISO decimals are shown down to none),
 * never for "1,00"; a currency the language has no name for is read by its code, never in
 * another language. */
export function spokenMoney(minor: number, currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE, held: HeldCurrencies = []): string {
  const language = languageOf(locale), en = language === 'en';
  const number = spokenMinor(Math.abs(minor), currency, locale);
  const unit = currencyUnit(currency, locale, held, SPOKEN_UNITS[currency]?.[language], number);
  return (minor < 0 ? (en ? 'Minus ' : 'Menos ') : '') + number + ' ' + unit;
}

/** The locale identifier iOS's date wheel takes: the interface language with
 * its home region (`SPEECH_REGIONS`), "es_AR" or "en_US", whatever region the
 * app writes numbers in. The wheel spells the month out, so it is a worded
 * date and follows the language like the row it opens from
 * (`formatDate(…, 'dayYear')`): Spanish day · month · year, English month ·
 * day · year. The mixed pairs are never passed: iOS's own data for them
 * disagrees with the app (Apple's en_AR is day-first) and changed between iOS
 * 26 releases (es_US), see docs/i18n.md §9. */
export function pickerLocale(locale: AppLocale = DEFAULT_LOCALE): string {
  const language = languageOf(locale);
  return `${language}_${SPEECH_REGIONS[language]}`;
}

/** CLDR's names of a currency in a language (display, one, other), or null when CLDR
 * has none in that language (its catalogue status is then `incomplete`). */
export function currencyNameForms(currency: IsoCurrencyCode, language: LanguageCode): CurrencyNameForms | null {
  return CURRENCY_NAMES[language].currencies[currency] ?? null;
}

/** The full name of a currency for a chooser or a detail row: CLDR's plural name in the
 * interface language with a capital first letter ("Pesos argentinos", "US dollars",
 * "Yenes japoneses"); the ISO code when the language has no name for it. */
export function currencyName(currency: IsoCurrencyCode, locale: AppLocale = DEFAULT_LOCALE): string {
  const other = currencyNameForms(currency, languageOf(locale))?.other;
  return other ? other.charAt(0).toUpperCase() + other.slice(1) : currency;
}
