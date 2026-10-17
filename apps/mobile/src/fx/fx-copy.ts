/** The words around a consolidated figure (Producto 24C1): the info button's text and the reason a
 * total is not shown. Pure: the caller passes its bound translator and date formatter. */
import { FX_PIVOT, type Currency, type Provenance } from '@finanzapp/domain';
import type { Translate } from '../i18n/messages.ts';
import { FRANKFURTER_SOURCE } from './frankfurter.ts';
import type { HeroFigure } from './finance-view.ts';

type Words = { t: Translate; date: (dateISO: string) => string; currencyName: (currency: Currency) => string };

const source = (provenance: Provenance | null) => provenance?.sources.join(', ') || FRANKFURTER_SOURCE;

/** The info button of a converted figure on Inicio: which rates, from whom, of which day. Null when nothing was converted.
 * Rates of more than one day (each currency at its own latest publication, or each expense at its date) are named as the
 * range they span, as Reportes does, never as the newest day alone. */
export function figureInfo(figure: HeroFigure, metric: 'spending' | 'available', { t, date, currencyName }: Words): string | null {
  if (figure.status !== 'ready' || !figure.converted || !figure.provenance?.newest) return null;
  const { oldest, newest } = figure.provenance;
  const params = { currency: currencyName(figure.currency), source: source(figure.provenance) };
  if (oldest && oldest !== newest) return t(metric === 'spending' ? 'fx.spendingInfoRange' : 'fx.availableInfoRange', { ...params, oldest: date(oldest), newest: date(newest) });
  return t(metric === 'spending' ? 'fx.spendingInfo' : 'fx.availableInfo', { ...params, date: date(newest) });
}

/** Reportes' method note for a consolidated month: the range of rate days used. */
export function reportInfo(currency: Currency, provenance: Provenance | null, { t, date, currencyName }: Words): string | null {
  if (!provenance?.oldest || !provenance.newest) return null;
  return t('fx.reportInfo', { currency: currencyName(currency), source: source(provenance), oldest: date(provenance.oldest), newest: date(provenance.newest) });
}

/** A drill-down's line where a consolidated total cannot be given (a rate is missing or still arriving), and its info
 * button's reason: the Reportes root's words, never the sentence about a total too large to show precisely. */
export function shortfallLine(figure: HeroFigure, words: Words): { line: string; detail: string } | null {
  if (figure.status !== 'unavailable') return null;
  return { line: figure.reason === 'fetching' ? words.t('fx.fetching') : words.t('fx.unavailable', { currency: figure.currency }), detail: shortfallDetail(figure, words) };
}

/** Why a total is not shown, as the info button explains it. */
export function shortfallDetail(figure: Extract<HeroFigure, { status: 'unavailable' }>, { t, date }: Words): string {
  const missing = figure.missing;
  const pair = missing ? `${FX_PIVOT} → ${missing.currency}` : `${FX_PIVOT} → ${figure.currency}`;
  const day = missing ? date(missing.date) : '';
  switch (figure.reason) {
    case 'fetching': return t('fx.reason.fetching');
    case 'offline': return t('fx.reason.offline', { pair, date: day });
    case 'provider': return t('fx.reason.provider', { pair, date: day, source: FRANKFURTER_SOURCE });
    case 'stale': return t('fx.reason.stale', { pair, date: day, latest: missing?.latest ? date(missing.latest) : '' });
    default: return t('fx.reason.missing', { pair, date: day });
  }
}
