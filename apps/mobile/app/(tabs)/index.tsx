import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, hiddenLiabilityAccountIds, liquidTotalsByCurrency, spendingOverview, spendingWindow,
  summarizeMonthlyBudgets } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, EntryRow, Money, Screen, SectionTitle, Surface, useStacked } from '../../src/ui/components';
import { CurrencySwitch } from '../../src/ui/currency-switch';
import { useDisplayCurrency } from '../../src/ui/display-currency-provider';
import { useI18n } from '../../src/i18n/provider';
import { BudgetHomeCard, CategoryRanking, MetricHelp, UpcomingRecurringRow } from '../../src/ui/home-modules';
import { Reflow, ValueTransition } from '../../src/ui/motion';
import { availableCurrencies, namesAccount, selectEntries } from '../../src/ui/presentation';
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
 * pills, the Assistant as the one wide control, then three sections that each
 * have their own shape: the categories as a compact summary card, the
 * commitments as an open agenda on the ground, the latest transactions as the
 * grouped ledger. Section links are quiet (secondary ink and a chevron), so
 * cobalt is left to the Assistant and the active tab. */
export default function HomeScreen() {
  const { snapshot, archive } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const stacked = useStacked();
  const { t, formatDate } = useI18n();
  const [metric, setMetric] = useState<HomeMetric>('spending');
  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  // The display currency Inicio shares with Reportes (24B6): a stored preference resolved against the currencies held.
  const { currency, setCurrency } = useDisplayCurrency(currencies);
  const period = useMemo(() => spendingWindow(currency, 'month', day), [currency, day]);
  // A stored currency is always a storable code (read acceptance), so this only guards a
  // programming error; Home must degrade to its empty state rather than crash the tab.
  const summary = useMemo(() => { try { return snapshot ? spendingOverview(snapshot, period) : null; } catch { return null; } }, [snapshot, period]);
  // Disponible is recorded liquid money: cards, debts and receivables are never netted into it.
  const available = useMemo(() => {
    if (!snapshot) return { status: 'ready' as const, minor: 0 };
    try { return { status: 'ready' as const, minor: liquidTotalsByCurrency(snapshot, archive?.cards, archive?.debts)[currency] ?? 0 }; }
    catch { return { status: 'out-of-range' as const }; }
  }, [snapshot, archive?.cards, archive?.debts, currency]);
  const monthBudget = useMemo(() => {
    if (!snapshot) return null;
    try { return summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], currency, currentMonthISO(day)); }
    catch { return null; }
  }, [snapshot, archive?.budgets, currency, day]);
  const recent = useMemo(() => snapshot ? selectEntries(snapshot.entries.filter(entry =>
    snapshot.accounts.some(a => a.id === entry.accountId && a.currency === currency)
      && entry.dateISO >= period.startISO && entry.dateISO <= period.endISO), snapshot.accounts).slice(0, 4) : [], [snapshot, currency, period]);
  const upcoming = useMemo(() => (archive?.recurring ?? [])
    .filter(rule => rule.active && rule.kind === 'expense' && rule.nextDateISO >= day
      && snapshot?.accounts.some(account => account.id === rule.accountId && account.currency === currency))
    .sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant))
    .slice(0, 3), [archive?.recurring, snapshot?.accounts, currency, day]);

  if (!snapshot || !summary) return null;
  const hidden = hiddenLiabilityAccountIds(archive?.cards, archive?.debts);
  const accountCount = snapshot.accounts.filter(account => account.currency === currency && !hidden.has(account.id)).length;
  const openReport = () => router.navigate({ pathname: '/reports', params: { currency } });
  const spending = metric === 'spending';
  // A row names its account only when another account of this currency could be meant (24UX2).
  const showAccount = namesAccount(snapshot.accounts, currency, new Set((archive?.debts ?? []).map(debt => debt.accountId)));
  // A month with nothing recorded in this currency says so once, under Últimos movimientos, instead of two
  // near-identical sentences 24 pt apart (24UX1 finding 5). Categories return with the first expense.
  const quietMonth = summary.status === 'ready' && !summary.categories.length && !recent.length;
  // Keyed by the choice, not the dates: a day boundary must not animate the hero on its own.
  const heroId = `${metric}|${currency}`;

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
          {currencies.length > 1 && <CurrencySwitch compact value={currency} currencies={currencies} onChange={setCurrency} labels="code" />}
        </View>

        <ValueTransition id={heroId} style={{ gap: 4, paddingBottom: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <AppText secondary variant="subhead" style={{ fontWeight: '500' }}>{spending ? capitalized(formatDate(day, 'month')) : t('home.recordedBalance')}</AppText>
            {!spending && <MetricHelp title={t('home.available')} detail={t('home.availableHelp')} />}
          </View>
          {spending ? summary.status === 'ready'
            ? <Money minor={summary.expenseMinor} currency={currency} large size={HERO_SIZE} />
            : <AppText secondary variant="subhead">{t('home.spendingOutOfRange')}</AppText>
            : available.status === 'ready'
              ? <Money minor={available.minor} currency={currency} large size={HERO_SIZE} color={available.minor < 0 ? p.expense : undefined} />
              : <AppText secondary variant="subhead">{t('home.balanceOutOfRange')}</AppText>}
          {!spending && <AppText secondary variant="footnote">{t('home.accounts', { count: accountCount })}</AppText>}
        </ValueTransition>
      </View>

      <View style={{ gap: space.m }}>
        <QuickActions currency={currency} />
        <AssistantEntry currency={currency} />
      </View>

      {monthBudget !== null && (monthBudget.total !== null || monthBudget.rows.length > 0) && <Reflow fade>
        <SectionTitle quiet action={t('common.see')} onAction={() => router.push({ pathname: '/budgets', params: { currency } })}>{t('home.monthBudget')}</SectionTitle>
        <BudgetHomeCard summary={monthBudget} />
      </Reflow>}

      {!quietMonth && <Reflow fade>
        <SectionTitle quiet action={t('home.reports')} onAction={openReport}>{t('home.whereSpent')}</SectionTitle>
        <ValueTransition id={currency} variant="fade">
          {summary.categories.length && summary.status === 'ready' ? <CategoryRanking categories={summary.categories} totalMinor={summary.expenseMinor} currency={currency}
            onPressCategory={category => router.push({ pathname: '/spending-detail', params: { ...period, category: category.key } })} />
            : <AppText secondary variant="subhead">
              {summary.status === 'ready' ? t('home.categoriesEmpty') : t('home.categoriesInActivity')}
            </AppText>}
        </ValueTransition>
      </Reflow>}

      {upcoming.length > 0 && <Reflow fade>
        <SectionTitle quiet action={t('common.seeAll')} onAction={() => router.push('/recurring')}>{t('home.upcoming')}</SectionTitle>
        <View>{upcoming.map((rule, index) => <UpcomingRecurringRow key={rule.id} rule={rule} showAccount={showAccount}
          account={snapshot.accounts.find(account => account.id === rule.accountId)!} day={day} last={index === upcoming.length - 1} />)}</View>
      </Reflow>}

      <Reflow>
        <SectionTitle quiet action={t('common.seeAll')} onAction={() => router.navigate('/activity')}>{t('home.recent')}</SectionTitle>
        <ValueTransition id={currency} variant="fade">
          {recent.length ? <Surface grouped>{recent.map((entry, index) => <EntryRow key={entry.id} entry={entry} showAccount={showAccount}
            account={snapshot.accounts.find(a => a.id === entry.accountId)!} last={index === recent.length - 1} />)}</Surface>
            : <AppText secondary variant="subhead">{currencies.length > 1 ? t('home.recentEmptyIn', { currency }) : t('home.recentEmpty')}</AppText>}
        </ValueTransition>
      </Reflow>
    </>}
  </Screen>;
}
