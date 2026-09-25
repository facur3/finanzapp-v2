/** What Inicio, Reportes and their drill-downs read (Producto 24C1): the ledger as the display
 * mode shows it. Pure: no React.
 *
 *   - `single`: the real ledger, filtered by the screens to one currency as before (24B6);
 *     nothing converted, every period complete.
 *   - `consolidated`: the domain's `consolidatedLedger` in the chosen currency (every account
 *     carries it, every movement converted with its own day's rate); a period is complete only
 *     when every movement in it had a rate. A screen shows a total only for a complete period;
 *     otherwise it shows each currency's own subtotal and says why (`HeroFigure`).
 *
 * Nothing here writes: the stored amounts, balances and movements are what they were. */
import { consolidatedLedger, convertTotals, sortCurrencies, liquidTotalsByCurrency, quotesNeeded, spendingOverview, type ConsolidatedLedger, type CreditCardProfile,
  type Currency, type Entry, type LedgerSnapshot, type PersonalDebtProfile, type Provenance, type RateBook, type ReportPeriod, type Unconverted } from '@finanzapp/domain';
import type { DisplayMode } from '../ui/display-currency.ts';
import type { RatesActivity } from './rates-store.ts';

export interface FinanceView {
  mode: DisplayMode;
  currency: Currency;
  /** What the report functions read: the consolidated ledger, or the real one. */
  snapshot: LedgerSnapshot;
  consolidated: ConsolidatedLedger | null;
  /** The pivot quotes this view needs from the provider (none in `single` mode or when nothing differs from the target). */
  quotes: Currency[];
  complete(startISO: string, endISO: string, kind?: Entry['kind']): boolean;
  provenance(startISO?: string, endISO?: string, kind?: Entry['kind']): Provenance | null;
  missingIn(startISO: string, endISO: string, kind?: Entry['kind']): Unconverted[];
}

export function financeView(snapshot: LedgerSnapshot, mode: DisplayMode, currency: Currency, book: RateBook): FinanceView {
  if (mode === 'single') {
    return { mode, currency, snapshot, consolidated: null, quotes: [], complete: () => true, provenance: () => null, missingIn: () => [] };
  }
  const consolidated = consolidatedLedger(snapshot, currency, book);
  const held = [...new Set(snapshot.accounts.map(account => account.currency))];
  return {
    mode, currency, snapshot: consolidated.snapshot, consolidated, quotes: quotesNeeded(held, currency),
    complete: (start, end, kind) => consolidated.complete(start, end, kind),
    provenance: (start, end, kind) => consolidated.provenance(start, end, kind),
    missingIn: (start, end, kind) => consolidated.missingIn(start, end, kind),
  };
}

/** Why a consolidated figure could not be given as a total. */
export type Shortfall = 'fetching' | 'offline' | 'provider' | 'missing' | 'stale';

/** The one figure a screen leads with. `converted` says whether any part was converted (the
 * info button then names the rates); `parts` are each currency's own subtotal, shown instead of a
 * total when a rate is missing. */
export type HeroFigure =
  | { status: 'ready'; currency: Currency; minor: number; converted: boolean; provenance: Provenance | null }
  | { status: 'out-of-range'; currency: Currency }
  | { status: 'unavailable'; currency: Currency; parts: { currency: Currency; minor: number }[]; reason: Shortfall;
      /** The currency whose rate is missing, the day asked for, and the last publication held (if any). */
      missing: { currency: Currency; date: string; latest?: string } | null };

function shortfall(activity: RatesActivity, loaded: boolean, stale: boolean): Shortfall {
  if (activity === 'fetching' || activity === 'loading' || !loaded) return 'fetching';
  if (activity === 'offline' || activity === 'provider') return activity;
  return stale ? 'stale' : 'missing';
}

/** Recorded spending of a period (expenses; transfers and card payments are never spending). */
export function spendingFigure(real: LedgerSnapshot, view: FinanceView, period: { startISO: string; endISO: string }, activity: RatesActivity, loaded: boolean): HeroFigure {
  const { currency } = view;
  if (view.complete(period.startISO, period.endISO, 'expense')) {
    let overview;
    try { overview = spendingOverview(view.snapshot, { startISO: period.startISO, endISO: period.endISO, currency }); } catch { return { status: 'out-of-range', currency }; }
    if (overview.status !== 'ready') return { status: 'out-of-range', currency };
    const provenance = view.provenance(period.startISO, period.endISO, 'expense');
    return { status: 'ready', currency, minor: overview.expenseMinor, converted: !!provenance?.converted, provenance };
  }
  const missing = view.missingIn(period.startISO, period.endISO, 'expense');
  const parts: { currency: Currency; minor: number }[] = [];
  for (const held of sortCurrencies(new Set(real.accounts.map(account => account.currency)))) {
    try {
      const overview = spendingOverview(real, { startISO: period.startISO, endISO: period.endISO, currency: held } as ReportPeriod);
      if (overview.status === 'ready' && overview.expenseCount > 0) parts.push({ currency: held, minor: overview.expenseMinor });
    } catch { /* an unsafe subtotal is left out of the explanation, never shown as zero */ }
  }
  const first = missing[0];
  return { status: 'unavailable', currency, parts, reason: shortfall(activity, loaded, !!first?.latest),
    missing: first ? { currency: first.quote ?? first.currency, date: first.dateISO, ...(first.latest ? { latest: first.latest } : {}) } : null };
}

/** Disponible: recorded liquid money as of `today` (cards, debts and receivables never netted in),
 * each currency's balance converted with today's rate in `consolidated` mode. */
export function availableFigure(real: LedgerSnapshot, view: FinanceView, book: RateBook, today: string, activity: RatesActivity, loaded: boolean,
  cards: CreditCardProfile[] = [], debts: PersonalDebtProfile[] = []): HeroFigure {
  const { currency } = view;
  let totals: Partial<Record<Currency, number>>;
  try { totals = liquidTotalsByCurrency(real, cards, debts); } catch { return { status: 'out-of-range', currency }; }
  if (view.mode === 'single') return { status: 'ready', currency, minor: totals[currency] ?? 0, converted: false, provenance: null };
  const total = convertTotals(totals, currency, book, today);
  if (total.status === 'single') return { status: 'ready', currency, minor: total.minor, converted: false, provenance: null };
  if (total.status === 'converted') return { status: 'ready', currency, minor: total.minor, converted: true, provenance: total.provenance };
  if (total.status === 'out-of-range') return { status: 'out-of-range', currency };
  const quote = total.missing[0].quote;
  const latest = book.lookup(quote, today);
  return { status: 'unavailable', currency, parts: total.parts.map(part => ({ currency: part.currency, minor: part.minor })),
    reason: shortfall(activity, loaded, latest.status === 'missing' && !!latest.latest),
    missing: { currency: quote, date: today, ...(latest.status === 'missing' && latest.latest ? { latest: latest.latest } : {}) } };
}

/** The accounts that count in a view: every account when consolidated, the currency's otherwise. */
export function inView(view: Pick<FinanceView, 'mode' | 'currency'>, account: { currency: Currency }): boolean {
  return view.mode === 'consolidated' || account.currency === view.currency;
}

/** What a drill-down lists: the real movements with their original amounts, scoped like the view (every account in
 * consolidated mode, whose accounts carry the target so the domain's filters select them; the real ledger otherwise).
 * The rows are drawn with the real accounts, so each keeps its own currency. */
export function listingSnapshot(real: LedgerSnapshot, view: Pick<FinanceView, 'mode' | 'currency'>): LedgerSnapshot {
  return view.mode === 'single' ? real : { ...real, accounts: real.accounts.map(account => ({ ...account, currency: view.currency })) };
}
