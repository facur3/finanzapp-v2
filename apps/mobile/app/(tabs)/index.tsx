import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentMonthISO, hiddenLiabilityAccountIds, spendingWindow } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, EntryRow, Money, SectionTitle, Surface, TransferRow } from '../../src/ui/components';
import { DisplayCurrencyButton } from '../../src/ui/currency-switch';
import { useDisplayCurrency } from '../../src/ui/display-currency-provider';
import { useFinanceView } from '../../src/fx/rates-provider';
import { availableFigure, inView, spendingFigure } from '../../src/fx/finance-view';
import { figureInfo, shortfallDetail } from '../../src/fx/fx-copy';
import { useI18n } from '../../src/i18n/provider';
import { BudgetAttentionRow, CurrencyParts, FieldButton, MetricHelp, UpcomingRecurringRow } from '../../src/ui/home-modules';
import { homeBudgets, homeCommitments, homeRecent, recentRowLimit } from '../../src/ui/home-focus';
import { Reflow, ValueTransition } from '../../src/ui/motion';
import { historyCurrencies, homeNamesCategory, sharedGlyphs, visibleNamesAccount } from '../../src/ui/presentation';
import { useCategoryLookOf } from '../../src/ui/category-hues';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';
import { useDockInset } from '../../src/ui/dock-clearance';

type HomeMetric = 'spending' | 'available';

const capitalized = (label: string) => label.charAt(0).toUpperCase() + label.slice(1);
/** Inicio's number (Forest): 46 pt bold, the screen's one large element. `Money` fits a long amount to the width
 * (nine digits shrink, never truncate) and caps Dynamic Type. */
const HERO_SIZE = 46;
/** The field's bottom corners and the air between the field and the first section. */
const FIELD_RADIUS = 32;

/** Inicio, the current month's dashboard (Producto 24UX6A, decision 005). It answers what the month looks like now and
 * stops: the financial field, then what is due soon, then what was recorded this month. Every other list and every
 * analysis keeps its own place (Movimientos, Reportes, Presupuestos, Más); recording is the dock's «+».
 *
 * The financial field is one pine object that meets the top edge (B of the Forest handoff, owner-refined):
 *   1. the current month on the left, a label (not a control: it opens nothing; past months are Reportes'), and the
 *      accounts shortcut on the right;
 *   2. only when the ledger holds more than one currency (the 25B2 rule), the display scope chip («Total · ARS» / «Solo
 *      USD») and its explanation; with one currency the row is absent and leaves no gap;
 *   3. the number, the screen's one large element, with its explanation (ⓘ) beside it when there is no scope row
 *      (24UX6C: no line under it; the daily average and the account count live in Reportes and Cuentas);
 *   4. Gastado | Disponible, which switches the number only.
 * Under it: the month's budgets that need attention, only while one is in warning (85 % to 100 %) or exceeded: the
 * general budget and category budgets, at most two compact rows in one grouped surface (`homeBudgets`: exceeded first,
 * the general before a category, then the higher ratio; never a permanent card or dashboard); then the commitments due from today through today
 * + 30 days, both ends inclusive (`COMMITMENT_WINDOW_DAYS`; two at most, the section absent without one), then the month's
 * latest activity, expenses, incomes and transfers (24UX6C2), each record once (four under commitments, six without;
 * «Ver todos» selects Movimientos). With neither, one quiet
 * line points at «+» and the Assistant. Nothing is drawn to fill space: no rankings, charts, permanent budget card, insight
 * lines, Registrar button or Assistant banner.
 *
 * The figures are the repository's, unchanged: Gastado is `spendingFigure` over the calendar month to today (expenses
 * only; transfers and card payments are never spending; an instalment counts in the month its statement closes),
 * Disponible is `availableFigure` (recorded liquid money; cards, debts and receivables excluded; not income minus
 * spending, not a budget). 24C1 stands: by default a consolidated total in the display currency, each movement at its
 * own day's reference rate, each balance at today's, with an info button naming the rates; without a rate, each
 * currency's own subtotal with one line saying why, never a partial sum. Rows keep their original amounts.
 *
 * The status bar is light while the field is under it (both themes), and returns to the scheme's own when the field has
 * scrolled away or another screen is in front. */
export default function HomeScreen() {
  const { snapshot, archive, gate } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const dock = useDockInset();
  const insets = useSafeAreaInsets();
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
  const spendingHero = useMemo(() => snapshot && view ? spendingFigure(snapshot, view, period, view.activity, view.loaded) : null,
    [snapshot, view, period]);
  // Disponible is recorded liquid money: cards, debts and receivables are never netted into it.
  const availableHero = useMemo(() => snapshot && view ? availableFigure(snapshot, view, view.book, day, view.activity, view.loaded, archive?.cards, archive?.debts) : null,
    [snapshot, view, day, archive?.cards, archive?.debts]);
  // The commitments due from today through today + 30 days (inclusive) in the accounts the display shows; each keeps its
  // own amount and currency.
  const upcoming = useMemo(() => homeCommitments(archive?.recurring, day,
    accountId => !!snapshot?.accounts.some(account => account.id === accountId && inView({ mode, currency }, account))), [archive?.recurring, snapshot?.accounts, mode, currency, day]);
  // The month's budgets that need attention (24UX6C2; category budgets and two rows since the 24UX6D refinement). A budget
  // keeps its own currency (24C1): it is measured on the real ledger against that currency's accounts, never a converted
  // total; `homeBudgets` picks which (at most two) and whether a row must name its currency.
  const budgets = useMemo(() => snapshot ? homeBudgets(snapshot, archive?.budgets ?? [], currencies, mode, currency, month) : [],
    [snapshot, archive?.budgets, currencies.join(), mode, currency, month]);
  // The month's latest activity (24UX6C2): expenses, incomes and transfers, each once, newest first, then the limit.
  const recent = useMemo(() => snapshot ? homeRecent(snapshot.entries, snapshot.transfers ?? [], snapshot.accounts, period,
    account => inView({ mode, currency }, account), recentRowLimit(upcoming.length > 0)) : [], [snapshot, period, mode, currency, upcoming.length]);

  // The status bar over the field: light while the field is under it, the scheme's own otherwise.
  const fieldHeight = useRef(0);
  const scrolled = useRef(false);
  const focused = useRef(false);
  const barStyle = useCallback(() => setStatusBarStyle(focused.current && !scrolled.current ? 'light' : p.isDark ? 'light' : 'dark', true), [p.isDark]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    barStyle();
    return () => { focused.current = false; barStyle(); };
  }, [barStyle]));
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = event.nativeEvent.contentOffset.y > Math.max(fieldHeight.current - insets.top, 0);
    if (past !== scrolled.current) { scrolled.current = past; barStyle(); }
  };

  if (!snapshot || !view || !spendingHero || !availableHero) return null;
  const spending = metric === 'spending';
  // 24UX5: a row names its account only when the visible rows come from more than one; VoiceOver always says it.
  const upcomingAccount = visibleNamesAccount(upcoming);
  // A transfer counts by its side that is a real account: a card payment by the paying account, a debt's collection by
  // the account that received it (a hidden card or debt account is never "another account" for this rule).
  const hiddenAccounts = hiddenLiabilityAccountIds(archive?.cards, archive?.debts);
  const recentAccount = visibleNamesAccount(recent.map(item => ({ accountId: item.type === 'entry' ? item.value.accountId
    : hiddenAccounts.has(item.value.fromAccountId) ? item.value.toAccountId : item.value.fromAccountId })));
  // 24UX5: a commitment names its category only when the name and the glyph do not already say it, or when another row draws the same glyph.
  const shared = sharedGlyphs(upcoming.map(row => { const look = expenseLook(row.category); return { category: look.label, glyph: look.glyph }; }));
  const namesCategory = (row: { category: string; merchant: string }) => {
    const look = expenseLook(row.category);
    return homeNamesCategory(row.merchant, look.label, shared.has(look.glyph));
  };
  // Keyed by the choice, not the dates: a day boundary must not animate the number on its own.
  const heroId = `${metric}|${mode}|${currency}`;
  const hero = spending ? spendingHero : availableHero;
  const words = { t, date: formatNumericDate, currencyName };
  const info = figureInfo(hero, spending ? 'spending' : 'available', words);
  const help = info ? <MetricHelp title={t('fx.infoTitle')} detail={info} color={p.heroSecondary} />
    : !spending ? <MetricHelp title={t('home.available')} detail={t('home.availableHelp')} color={p.heroSecondary} /> : null;
  const quiet = hero.status === 'ready' && hero.minor === 0;
  const scope = currencies.length > 1;

  return <ScrollView style={{ flex: 1, backgroundColor: p.background }} contentInsetAdjustmentBehavior="never" onScroll={onScroll} scrollEventThrottle={32}
    contentContainerStyle={{ paddingBottom: 48 + dock.extraPadding, flexGrow: 1 }} contentInset={dock.inset} scrollIndicatorInsets={dock.inset}>
    {/* The field's colour under the top overscroll, so a pull never shows the canvas above it. */}
    <View pointerEvents="none" style={{ position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: p.hero }} />
    <View onLayout={event => { fieldHeight.current = event.nativeEvent.layout.height; }}
      style={{ backgroundColor: p.hero, paddingTop: insets.top + space.m, paddingBottom: space.xxl, paddingHorizontal: space.xl,
        borderBottomLeftRadius: FIELD_RADIUS, borderBottomRightRadius: FIELD_RADIUS, gap: space.l }}>
      {/* 1. The current month (not a control) and the accounts behind the number. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
        <AppText accessibilityRole="header" variant="title2" style={{ flex: 1, color: p.heroInk }}>{capitalized(formatDate(day, 'month'))}</AppText>
        <FieldButton icon="wallet-outline" label={t('nav.seeAccounts')} onPress={() => router.push('/accounts')} />
      </View>
      {/* 2. The scope, only when there is more than one currency to choose (25B2). Outside the keyed crossfade: the chip's
          sheet changes the key, and must never remount the chip that shows it. */}
      {scope && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s }}>
        <DisplayCurrencyButton onField mode={mode} currency={currency} held={currencies} gate={gate} onMode={setMode} onCurrency={setCurrency} />
        {help}
      </View>}
      {/* 3. The number (24UX6C: no line under it; the daily average lives in Reportes). With one currency its explanation
          sits beside it; with more, in the scope row above. */}
      <ValueTransition id={heroId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {hero.status === 'ready'
            ? <Money minor={hero.minor} currency={currency} large size={HERO_SIZE} color={quiet ? p.heroSecondary : p.heroInk} />
            : hero.status === 'unavailable'
              ? <CurrencyParts onField parts={hero.parts} line={hero.reason === 'fetching' ? t('fx.fetching') : t('fx.unavailable', { currency })} detail={shortfallDetail(hero, words)} />
              : <AppText variant="subhead" style={{ color: p.heroSecondary }}>{t(spending ? 'home.spendingOutOfRange' : 'home.balanceOutOfRange')}</AppText>}
        </View>
        {!scope && help}
      </ValueTransition>
      {/* 24T3 (A24): the one exception to «no line under the number» (24UX6C). Gastado is the month's exact net, and
          devoluciones of earlier purchases can leave it below zero; one quiet line says why, only then. */}
      {spending && hero.status === 'ready' && hero.minor < 0 && <AppText variant="footnote" style={{ color: p.heroSecondary }}>{t('home.refundsExceed')}</AppText>}
      {/* 5. What the number counts: it switches the number only. */}
      <Choices onField value={metric} onChange={setMetric}
        options={[{ value: 'spending', label: t('home.spending') }, { value: 'available', label: t('home.available') }]} />
    </View>

    <View style={{ paddingHorizontal: space.xl, paddingTop: 28, gap: 28 }}>
      {!snapshot.accounts.length
        ? <EmptyState title={t('home.emptyTitle')} detail={t('home.emptyDetail')} icon="receipt-outline"
          action={<ActionButton label={t('home.start')} icon="add-outline" onPress={() => router.push('/new-account')} />} />
        : <>
          {/* Actionable context first: the budgets that need attention (two at most, one grouped surface), then what is due soon. */}
          {budgets.length > 0 && <Reflow fade>
            <Surface grouped>{budgets.map((budget, index) => <BudgetAttentionRow key={budget.currency + '|' + budget.progress.budget.id} attention={budget}
              currency={budget.currency} labelsCurrency={budget.labelsCurrency} last={index === budgets.length - 1}
              onPress={() => router.push({ pathname: '/budgets', params: { currency: budget.currency, month } })} />)}</Surface>
          </Reflow>}
          {upcoming.length > 0 && <Reflow fade>
            <SectionTitle quiet action={t('common.seeAll')} onAction={() => router.push('/recurring')}>{t('home.upcoming')}</SectionTitle>
            <Surface grouped style={{ paddingHorizontal: space.l }}>{upcoming.map((rule, index) => <UpcomingRecurringRow key={rule.id} rule={rule} showAccount={upcomingAccount}
              showCategory={namesCategory(rule)} account={snapshot.accounts.find(account => account.id === rule.accountId)!} day={day} last={index === upcoming.length - 1} />)}</Surface>
          </Reflow>}
          {recent.length > 0 && <Reflow fade>
            <SectionTitle quiet action={t('common.seeAll')} onAction={() => router.navigate('/activity')}>{t('home.recent')}</SectionTitle>
            {/* A transfer is its own row (origin → destination, its own tone, «Transferencia» for VoiceOver) and opens its
                detail; it is never spending or income. */}
            <Surface grouped>{recent.map((item, index) => item.type === 'entry'
              ? <EntryRow key={item.key} entry={item.value} showAccount={recentAccount}
                account={snapshot.accounts.find(account => account.id === item.value.accountId)!} last={index === recent.length - 1} />
              : <TransferRow key={item.key} transfer={item.value} accounts={snapshot.accounts} last={index === recent.length - 1} />)}</Surface>
          </Reflow>}
          {/* One currency of several shown alone: the month may have movements in another, so the line names the currency (24UX2). */}
          {!upcoming.length && !recent.length && <EmptyState title={mode === 'single' && scope ? t('home.quietTitleIn', { currency }) : t('home.quietTitle')}
            detail={t('home.quietDetail')} icon="receipt-outline" />}
        </>}
    </View>
  </ScrollView>;
}
