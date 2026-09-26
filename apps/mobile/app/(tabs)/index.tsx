import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, hiddenLiabilityAccountIds, spendingOverview, spendingWindow, summarizeMonthlyBudgets } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, EntryRow, Money, Screen, SectionTitle, useStacked } from '../../src/ui/components';
import { DisplayCurrencyButton } from '../../src/ui/currency-switch';
import { useDisplayCurrency } from '../../src/ui/display-currency-provider';
import { useFinanceView } from '../../src/fx/rates-provider';
import { availableFigure, inView, spendingFigure } from '../../src/fx/finance-view';
import { figureInfo, shortfallDetail } from '../../src/fx/fx-copy';
import { useI18n } from '../../src/i18n/provider';
import { BudgetHomeCard, CategoryRanking, CurrencyParts, MetricHelp, UpcomingRecurringRow } from '../../src/ui/home-modules';
import { budgetScope } from '../../src/ui/budget-presentation';
import { withCurrencyCode } from '../../src/i18n/format';
import { Reflow, ValueTransition } from '../../src/ui/motion';
import { availableCurrencies, homeNamesCategory, selectEntries, sharedGlyphs, visibleNamesAccount } from '../../src/ui/presentation';
import { useCategoryLookOf } from '../../src/ui/category-hues';
import { AssistantEntry, QuickActions } from '../../src/ui/quick-actions';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

type HomeMetric = 'spending' | 'available';

const capitalized = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
/** Inicio's number (24UX3): 48 pt, a step above the 44 pt hero of the other screens, because on Inicio it is the
 * one figure the screen exists for. `Money` still fits a long amount to the width and caps Dynamic Type. */
const HERO_SIZE = 48;

/** Home answers one question at a time: how much did I spend this month, or
 * how much recorded money do I have. One number, its month, and nothing else
 * competing with it. Periods and analysis live in Reportes; cards in Tarjetas.
 *
 * Hierarchy (24UX3), top to bottom: a quiet header (compact segments, the
 * currency chip), the number with room around it, three compact movement
 * pills, the Assistant as the one wide control, then the one card (the
 * categories, a compact summary) followed by two open lists on the ground that
 * differ by density: the commitments as a tight agenda (the due day under the
 * amount), the latest transactions as a full-height ledger (signed amounts, the
 * date as the caption); both draw the same 40 pt mark (24UX5). One heavy block,
 * then lighter content, never card → list → card. Section links are quiet (the
 * slate `link` ink and a chevron, 24UX5), so cobalt is left to the Assistant and
 * the active tab.
 *
 * 24C1: the number is, by default, a consolidated total: every account's spending (or liquid money) in the display
 * currency, each movement converted with its own day's reference rate, each balance with today's. The currency chip
 * opens the display sheet (consolidated, one currency only, the currency); nothing else was added to the screen. A
 * converted figure carries an info button with the rates' source and date; when a rate is missing the figure is each
 * currency's own subtotal with one line saying why, never a partial sum. Rows keep their original amounts. */
export default function HomeScreen() {
  const { snapshot, archive, gate } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const stacked = useStacked();
  const { t, formatDate, formatNumericDate, currencyName } = useI18n();
  const expenseLook = useCategoryLookOf('expense'), incomeLook = useCategoryLookOf('income');
  const [metric, setMetric] = useState<HomeMetric>('spending');
  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  // The display mode and currency Inicio shares with Reportes (24B6, 24C1): a stored preference; in `consolidated` mode
  // the ledger is read converted into the currency (for this view only), in `single` mode filtered to it.
  const { setCurrency, setMode } = useDisplayCurrency(currencies);
  const month = currentMonthISO(day);
  const months = useMemo(() => [month], [month]);
  const view = useFinanceView(months);
  const currency = view?.currency ?? 'ARS', mode = view?.mode ?? 'single';
  const period = useMemo(() => spendingWindow(currency, 'month', day), [currency, day]);
  const complete = view ? view.complete(period.startISO, period.endISO, 'expense') : true;
  // A stored currency is always a storable code (read acceptance), so this only guards a
  // programming error; Home must degrade to its empty state rather than crash the tab.
  const summary = useMemo(() => { try { return view ? spendingOverview(view.snapshot, period) : null; } catch { return null; } }, [view?.snapshot, period]);
  const spendingHero = useMemo(() => snapshot && view ? spendingFigure(snapshot, view, period, view.activity, view.loaded) : null,
    [snapshot, view, period]);
  // Disponible is recorded liquid money: cards, debts and receivables are never netted into it.
  const availableHero = useMemo(() => snapshot && view ? availableFigure(snapshot, view, view.book, day, view.activity, view.loaded, archive?.cards, archive?.debts) : null,
    [snapshot, view, day, archive?.cards, archive?.debts]);
  // A budget keeps its currency whatever the display shows (24C1 review): it is measured on the real ledger against the
  // accounts in its own currency, never against a converted total. Consolidated, the card shows the display currency's
  // budget when there is one, else the first held currency's, named in the section title.
  const scope = budgetScope(archive?.budgets ?? [], currencies, mode, currency, month);
  const monthBudget = useMemo(() => {
    if (!snapshot || !scope) return null;
    try { return summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], scope.currency, month); }
    catch { return null; }
  }, [snapshot, archive?.budgets, scope?.currency, month]);
  // The lists keep each movement's and rule's own amount and currency; consolidated mode lists every account.
  const recent = useMemo(() => snapshot && view ? selectEntries(snapshot.entries.filter(entry =>
    snapshot.accounts.some(a => a.id === entry.accountId && inView(view, a))
      && entry.dateISO >= period.startISO && entry.dateISO <= period.endISO), snapshot.accounts).slice(0, 4) : [], [snapshot, view?.mode, currency, period]);
  const upcoming = useMemo(() => (archive?.recurring ?? [])
    .filter(rule => rule.active && rule.kind === 'expense' && rule.nextDateISO >= day
      && snapshot?.accounts.some(account => account.id === rule.accountId && inView({ mode, currency }, account)))
    .sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant))
    .slice(0, 3), [archive?.recurring, snapshot?.accounts, mode, currency, day]);

  if (!snapshot || !summary || !view || !spendingHero || !availableHero) return null;
  const hidden = hiddenLiabilityAccountIds(archive?.cards, archive?.debts);
  const accountCount = snapshot.accounts.filter(account => inView(view, account) && !hidden.has(account.id)).length;
  const openReport = () => router.navigate({ pathname: '/reports', params: { currency } });
  const spending = metric === 'spending';
  // 24UX5 review: each list names accounts only when its visible rows come from more than one (two owned accounts with
  // every visible row in one of them printed «· a ·» on each row). VoiceOver still says the account on every row.
  const recentAccount = visibleNamesAccount(recent), upcomingAccount = visibleNamesAccount(upcoming);
  // A month with nothing recorded in this currency says so once, under Últimos movimientos, instead of two
  // near-identical sentences 24 pt apart (24UX1 finding 5). Categories return with the first expense.
  const quietMonth = complete && summary.status === 'ready' && !summary.categories.length && !recent.length;
  // 24UX5: a Home row names its category only when the name and the glyph do not already say it, or when another
  // category on this screen draws the same glyph (the two lists are read together).
  const lookOf = (kind: 'expense' | 'income', category: string) => (kind === 'income' ? incomeLook : expenseLook)(category);
  const shared = sharedGlyphs([...upcoming, ...recent].map(row => { const look = lookOf(row.kind, row.category); return { category: look.label, glyph: look.glyph }; }));
  const namesCategory = (row: { kind: 'expense' | 'income'; category: string; merchant: string }) => {
    const look = lookOf(row.kind, row.category);
    return homeNamesCategory(row.merchant, look.label, shared.has(look.glyph));
  };
  // Keyed by the choice, not the dates: a day boundary must not animate the hero on its own.
  const heroId = `${metric}|${mode}|${currency}`;
  const hero = spending ? spendingHero : availableHero;
  const words = { t, date: formatNumericDate, currencyName };
  const info = figureInfo(hero, spending ? 'spending' : 'available', words);
  // The quick actions preselect an account in the shown currency only when one exists (a consolidated total may be in a
  // currency no account holds). The Assistant receives the shown currency exactly as before 24C1 (it is not changed here).
  const actionCurrency = currencies.includes(currency) ? currency : undefined;

  return <Screen gap={space.xxxl}>
    {!snapshot.accounts.length ? <EmptyState title={t('home.emptyTitle')}
      detail={t('home.emptyDetail')}
      icon="receipt-outline" action={<ActionButton label={t('home.start')} icon="add-outline" onPress={() => router.push('/new-account')} />} /> : <>
      <View style={{ gap: 28 }}>
        <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: stacked ? undefined : 1, maxWidth: stacked ? undefined : 208 }}>
            <Choices compact value={metric} onChange={setMetric}
              options={[{ value: 'spending', label: t('home.spending') }, { value: 'available', label: t('home.available') }]} />
          </View>
          <DisplayCurrencyButton compact mode={mode} currency={currency} held={currencies} gate={gate} onMode={setMode} onCurrency={setCurrency} />
        </View>

        <ValueTransition id={heroId} style={{ gap: 4, paddingBottom: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <AppText secondary variant="subhead" style={{ fontWeight: '500' }}>{spending ? capitalized(formatDate(day, 'month')) : t('home.recordedBalance')}</AppText>
            {info ? <MetricHelp title={t('fx.infoTitle')} detail={info} />
              : !spending && <MetricHelp title={t('home.available')} detail={t('home.availableHelp')} />}
          </View>
          {hero.status === 'ready'
            ? <Money minor={hero.minor} currency={currency} large size={HERO_SIZE} color={!spending && hero.minor < 0 ? p.expense : undefined} />
            : hero.status === 'unavailable'
              ? <CurrencyParts parts={hero.parts} line={hero.reason === 'fetching' ? t('fx.fetching') : t('fx.unavailable', { currency })} detail={shortfallDetail(hero, words)} />
              : <AppText secondary variant="subhead">{t(spending ? 'home.spendingOutOfRange' : 'home.balanceOutOfRange')}</AppText>}
          {!spending && <AppText secondary variant="footnote">{t('home.accounts', { count: accountCount })}</AppText>}
        </ValueTransition>
      </View>

      <View style={{ gap: space.m }}>
        <QuickActions currency={actionCurrency} />
        <AssistantEntry currency={currency} />
      </View>

      {monthBudget !== null && scope && (monthBudget.total !== null || monthBudget.rows.length > 0) && <Reflow fade>
        <SectionTitle quiet action={t('common.see')} onAction={() => router.push({ pathname: '/budgets', params: { currency: scope.currency } })}>
          {scope.labelsCurrency ? withCurrencyCode(t('home.monthBudget'), scope.currency) : t('home.monthBudget')}</SectionTitle>
        <BudgetHomeCard summary={monthBudget} />
      </Reflow>}

      {!quietMonth && <Reflow fade>
        <SectionTitle quiet action={t('home.reports')} onAction={openReport}>{t('home.whereSpent')}</SectionTitle>
        <ValueTransition id={currency} variant="fade">
          {complete && summary.categories.length && summary.status === 'ready' ? <CategoryRanking categories={summary.categories} totalMinor={summary.expenseMinor} currency={currency}
            onPressCategory={category => router.push({ pathname: '/spending-detail', params: { ...period, category: category.key } })} />
            : <AppText secondary variant="subhead">
              {complete && summary.status === 'ready' ? t('home.categoriesEmpty') : t('home.categoriesInActivity')}
            </AppText>}
        </ValueTransition>
      </Reflow>}

      {upcoming.length > 0 && <Reflow fade>
        <SectionTitle quiet action={t('common.seeAll')} onAction={() => router.push('/recurring')}>{t('home.upcoming')}</SectionTitle>
        <View>{upcoming.map((rule, index) => <UpcomingRecurringRow key={rule.id} rule={rule} showAccount={upcomingAccount} showCategory={namesCategory(rule)}
          account={snapshot.accounts.find(account => account.id === rule.accountId)!} day={day} last={index === upcoming.length - 1} />)}</View>
      </Reflow>}

      <Reflow>
        <SectionTitle quiet action={t('common.seeAll')} onAction={() => router.navigate('/activity')}>{t('home.recent')}</SectionTitle>
        <ValueTransition id={currency} variant="fade">
          {recent.length ? <View>{recent.map((entry, index) => <EntryRow key={entry.id} entry={entry} showAccount={recentAccount} variant="home" showCategory={namesCategory(entry)}
            account={snapshot.accounts.find(a => a.id === entry.accountId)!} last={index === recent.length - 1} />)}</View>
            : <AppText secondary variant="subhead">{mode === 'single' && currencies.length > 1 ? t('home.recentEmptyIn', { currency }) : t('home.recentEmpty')}</AppText>}
        </ValueTransition>
      </Reflow>
    </>}
  </Screen>;
}
