/** The words around a consolidated figure (Producto 24C1): the info button's text and the reason a
 * total is not shown. Pure: the caller passes its bound translator and date formatter. */
import { FX_PIVOT, type Currency, type Provenance } from '@finanzapp/domain';
import type { Translate } from '../i18n/messages.ts';
import { FRANKFURTER_SOURCE } from './frankfurter.ts';
import type { HeroFigure } from './finance-view.ts';

type Words = { t: Translate; date: (dateISO: string) => string; currencyName: (currency: Currency) => string };

const source = (provenance: Provenance | null) => provenance?.sources.join(', ') || FRANKFURTER_SOURCE;

/** The info button of a converted figure on Inicio: which rates, from whom, of which day. Null when nothing was converted. */
export function figureInfo(figure: HeroFigure, metric: 'spending' | 'available', { t, date, currencyName }: Words): string | null {
  if (figure.status !== 'ready' || !figure.converted || !figure.provenance?.newest) return null;
  return t(metric === 'spending' ? 'fx.spendingInfo' : 'fx.availableInfo',
    { currency: currencyName(figure.currency), source: source(figure.provenance), date: date(figure.provenance.newest) });
}

/** Reportes' method note for a consolidated month: the range of rate days used. */
export function reportInfo(currency: Currency, provenance: Provenance | null, { t, date, currencyName }: Words): string | null {
  if (!provenance?.oldest || !provenance.newest) return null;
  return t('fx.reportInfo', { currency: currencyName(currency), source: source(provenance), oldest: date(provenance.oldest), newest: date(provenance.newest) });
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
