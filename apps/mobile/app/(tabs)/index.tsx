import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, hiddenLiabilityAccountIds, isLiveAccount, spendingOverview, spendingWindow, summarizeMonthlyBudgets } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, IconButton, Money, Screen, SectionTitle, useStacked } from '../../src/ui/components';
import { DisplayCurrencyButton } from '../../src/ui/currency-switch';
import { useDisplayCurrency } from '../../src/ui/display-currency-provider';
import { useFinanceView } from '../../src/fx/rates-provider';
import { availableFigure, inView, spendingFigure } from '../../src/fx/finance-view';
import { figureInfo, shortfallDetail } from '../../src/fx/fx-copy';
import { useI18n } from '../../src/i18n/provider';
import { CurrencyParts, HomeInsightRow, MetricHelp, UpcomingRecurringRow } from '../../src/ui/home-modules';
import { budgetScope } from '../../src/ui/budget-presentation';
import { CaptureButton } from '../../src/ui/home-capture';
import { homeCommitments, homeInsight } from '../../src/ui/home-focus';
import { Reflow, ValueTransition } from '../../src/ui/motion';
import { availableCurrencies, historyCurrencies, homeNamesCategory, sharedGlyphs, visibleNamesAccount } from '../../src/ui/presentation';
import { useCategoryLookOf } from '../../src/ui/category-hues';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

type HomeMetric = 'spending' | 'available';

const capitalized = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
/** Inicio's number (24UX3): 48 pt, a step above the 44 pt hero of the other screens, because on Inicio it is the
 * one figure the screen exists for. `Money` still fits a long amount to the width and caps Dynamic Type. */
const HERO_SIZE = 48;

/** Inicio answers three questions and stops (Producto 24UX6A): how am I (one number), what needs my attention (the
 * commitments due this week, and at most one computed line about the month), and how do I record something (one
 * button). It is not an index of FinanzApp: every movement is in Movimientos, the analysis in Reportes, the budgets in
 * Presupuestos, and each keeps its own tab or row.
 *
 * Top to bottom: the controls of the number (Gastos | Disponible, and the accounts shortcut at the right, where the
 * root title used to be: the selected tab already names the screen); the number with its month (or «Saldo
 * registrado»), and under it what it covers (the currency chip, only with more than one currency held; the number of
 * accounts in Disponible); «＋ Registrar», the one filled control; then, only when there is something to say, the
 * commitments due in the next seven days (two at most, «Ver todos» for the rest) and one line, the most urgent of: a
 * budget exceeded, a budget nearly spent, or one category concentrating the month's spending. Nothing is drawn to
 * fill space: a quiet month is the number and the button.
 *
 * 24C1 stands: the number is, by default, a consolidated total in the display currency (each movement at its own day's
 * reference rate, each balance at today's), with an info button naming the rates; without a rate it is each currency's
 * own subtotal with one line saying why, never a partial sum. A budget keeps its own currency, measured on the real
 * ledger. Rows keep their original amounts. */
export default function HomeScreen() {
  const { snapshot, archive, gate } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const stacked = useStacked();
  const { t, formatDate, formatNumericDate, currencyName } = useI18n();
  const expenseLook = useCategoryLookOf('expense');
  const [metric, setMetric] = useState<HomeMetric>('spending');
  // Every currency the ledger ever held (25B2 review): a deleted account's history keeps its currency in the view and the chip.
  const currencies = historyCurrencies(snapshot?.accounts ?? []);
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
  // accounts in its own currency, never against a converted total. Consolidated, the display currency's budget is read
  // when there is one, else the first held currency's, whose amounts then carry their code.
  const scope = budgetScope(archive?.budgets ?? [], currencies, mode, currency, month);
  const monthBudget = useMemo(() => {
    if (!snapshot || !scope) return null;
    try { return summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], scope.currency, month); }
    catch { return null; }
  }, [snapshot, archive?.budgets, scope?.currency, month]);
  // The commitments due this week in the accounts the display shows; each keeps its own amount and currency.
  const upcoming = useMemo(() => homeCommitments(archive?.recurring, day,
    accountId => !!snapshot?.accounts.some(account => account.id === accountId && inView({ mode, currency }, account))), [archive?.recurring, snapshot?.accounts, mode, currency, day]);
  // One line at most, from the month's facts: the category figures only when the month's spending is complete and exact.
  const insight = useMemo(() => homeInsight(monthBudget,
    complete && summary?.status === 'ready' ? summary.categories : null, summary?.status === 'ready' ? summary.expenseMinor : 0, currency),
  [monthBudget, complete, summary, currency]);

  if (!snapshot || !summary || !view || !spendingHero || !availableHero) return null;
  const hidden = hiddenLiabilityAccountIds(archive?.cards, archive?.debts);
  const accountCount = snapshot.accounts.filter(account => inView(view, account) && !hidden.has(account.id) && isLiveAccount(account)).length;
  const spending = metric === 'spending';
  // 24UX5 review: a row names its account only when the visible rows come from more than one; VoiceOver always says it.
  const upcomingAccount = visibleNamesAccount(upcoming);
  // 24UX5: a row names its category only when the name and the glyph do not already say it, or when another row draws the same glyph.
  const shared = sharedGlyphs(upcoming.map(row => { const look = expenseLook(row.category); return { category: look.label, glyph: look.glyph }; }));
  const namesCategory = (row: { category: string; merchant: string }) => {
    const look = expenseLook(row.category);
    return homeNamesCategory(row.merchant, look.label, shared.has(look.glyph));
  };
  // Keyed by the choice, not the dates: a day boundary must not animate the hero on its own.
  const heroId = `${metric}|${mode}|${currency}`;
  const hero = spending ? spendingHero : availableHero;
  const words = { t, date: formatNumericDate, currencyName };
  const info = figureInfo(hero, spending ? 'spending' : 'available', words);
  // A new movement is preselected in the shown currency only while a live account holds it (a consolidated total may be
  // in a currency no account holds); the Assistant receives the shown currency as before 24C1.
  const actionCurrency = availableCurrencies(snapshot.accounts).includes(currency) ? currency : undefined;
  const accounts = <IconButton name="wallet-outline" label={t('nav.seeAccounts')} onPress={() => router.push('/accounts')} />;

  if (!snapshot.accounts.length) return <Screen gap={space.xxxl}>
    <View style={{ alignItems: 'flex-end' }}>{accounts}</View>
    <EmptyState title={t('home.emptyTitle')} detail={t('home.emptyDetail')} icon="receipt-outline"
      action={<ActionButton label={t('home.start')} icon="add-outline" onPress={() => router.push('/new-account')} />} />
  </Screen>;

  return <Screen gap={space.xxxl}>
    <View style={{ gap: space.xxl }}>
      {/* The number's controls: what it counts, and the accounts behind it. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <View style={{ flex: 1, maxWidth: stacked ? undefined : 208 }}>
          <Choices compact value={metric} onChange={setMetric}
            options={[{ value: 'spending', label: t('home.spending') }, { value: 'available', label: t('home.available') }]} />
        </View>
        {!stacked && <View style={{ flex: 1 }} />}
        {accounts}
      </View>

      <ValueTransition id={heroId} style={{ gap: 6 }}>
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
        {/* What the number covers: the currency (25B2: only when there is more than one to choose), the accounts in Disponible. */}
        {(currencies.length > 1 || !spending) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s, paddingTop: 2 }}>
          {currencies.length > 1 && <DisplayCurrencyButton compact mode={mode} currency={currency} held={currencies} gate={gate} onMode={setMode} onCurrency={setCurrency} />}
          {!spending && <AppText secondary variant="footnote">{t('home.accounts', { count: accountCount })}</AppText>}
        </View>}
      </ValueTransition>

      <CaptureButton movementCurrency={actionCurrency} assistantCurrency={currency} />
    </View>

    {upcoming.length > 0 && <Reflow fade>
      <SectionTitle quiet action={t('common.seeAll')} onAction={() => router.push('/recurring')}>{t('home.upcoming')}</SectionTitle>
      <View>{upcoming.map((rule, index) => <UpcomingRecurringRow key={rule.id} rule={rule} showAccount={upcomingAccount} showCategory={namesCategory(rule)}
        account={snapshot.accounts.find(account => account.id === rule.accountId)!} day={day} last={index === upcoming.length - 1} />)}</View>
    </Reflow>}

    {insight && <Reflow fade>
      <HomeInsightRow insight={insight} labelsCurrency={!!scope?.labelsCurrency && insight.kind !== 'concentration'}
        onPress={() => insight.kind === 'concentration' ? router.navigate({ pathname: '/reports', params: { currency } })
          : router.push({ pathname: '/budgets', params: { currency: insight.currency } })} />
    </Reflow>}
  </Screen>;
}
