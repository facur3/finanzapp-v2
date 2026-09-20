import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, formatMinorUnits, hiddenLiabilityAccountIds, liquidTotalsByCurrency, spendingOverview, spendingWindow,
  summarizeMonthlyBudgets, type Currency, type SpendingWindow } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, EntryActions, EntryRow, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { BudgetHomeCard, CategoryHomeRow, UpcomingRecurringRow } from '../../src/ui/home-modules';
import { availableCurrencies, selectEntries } from '../../src/ui/presentation';
import { periodLabel } from '../../src/ui/spending-timeline';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

type HomeMetric = 'spending' | 'available';

/** Home answers one question at a time: how much did I spend this period, or
 * how much recorded money do I have. Analysis lives in Reportes; cards in Tarjetas. */
export default function HomeScreen() {
  const { snapshot, archive } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const [selectedCurrency, setCurrency] = useState<Currency>('ARS');
  const [window, setWindow] = useState<SpendingWindow>('month');
  const [metric, setMetric] = useState<HomeMetric>('spending');
  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? 'ARS';
  const period = useMemo(() => spendingWindow(currency, window, day), [currency, window, day]);
  const summary = useMemo(() => snapshot ? spendingOverview(snapshot, period) : null, [snapshot, period]);
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
  const topCategories = summary.categories.slice(0, 3);

  return <Screen gap={space.xxl}>
    {!snapshot.accounts.length ? <EmptyState title="Entendé tus gastos."
      detail="Elegí una cuenta para agrupar tus movimientos. Podés empezar sin cargar tu saldo bancario."
      icon="receipt-outline" action={<ActionButton label="Empezar" icon="add-outline" onPress={() => router.push('/new-account')} />} /> : <>
      <View style={{ gap: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, maxWidth: 232 }}>
            <Choices value={metric} onChange={setMetric}
              options={[{ value: 'spending', label: 'Gastos' }, { value: 'available', label: 'Disponible' }]} />
          </View>
          {currencies.length > 1 && <Choices value={currency} onChange={setCurrency}
            options={currencies.map(value => ({ value, label: value }))} />}
        </View>

        <View style={{ gap: 8 }}>
          <AppText secondary variant="eyebrow">
            {spending ? `Gastado · ${periodLabel(period)}` : 'Disponible · saldo registrado'}
          </AppText>
          {spending ? summary.status === 'ready'
            ? <Money minor={summary.expenseMinor} currency={currency} large />
            : <AppText secondary variant="subhead">El total supera el rango que podemos mostrar con precisión. Tus movimientos siguen guardados.</AppText>
            : available.status === 'ready'
              ? <Money minor={available.minor} currency={currency} large color={available.minor < 0 ? p.expense : undefined} />
              : <AppText secondary variant="subhead">El saldo total supera el rango que podemos mostrar con precisión. Tus cuentas siguen guardadas.</AppText>}
          <AppText secondary variant="subhead">
            {spending
              ? summary.status === 'ready'
                ? `${summary.expenseCount} ${summary.expenseCount === 1 ? 'gasto registrado' : 'gastos registrados'}${summary.incomeMinor > 0 ? ` · ingresos ${currency === 'USD' ? 'US$ ' : '$ '}${formatMinorUnits(summary.incomeMinor)}` : ''}`
                : currency
              : `${accountCount} ${accountCount === 1 ? 'cuenta' : 'cuentas'} · no es saldo bancario ni patrimonio`}
          </AppText>
        </View>

        {spending && <View style={{ maxWidth: 232 }}>
          <Choices value={window} onChange={setWindow} options={[{ value: 'week', label: 'Esta semana' }, { value: 'month', label: 'Este mes' }]} />
        </View>}
      </View>

      <EntryActions currency={currency} />

      {monthBudget !== null && monthBudget.rows.length > 0 && <View>
        <SectionTitle action="Ver" onAction={() => router.push({ pathname: '/budgets', params: { currency } })}>Presupuesto del mes</SectionTitle>
        <BudgetHomeCard summary={monthBudget} />
      </View>}

      <View>
        <SectionTitle action="Reportes" onAction={openReport}>En qué gastaste</SectionTitle>
        {topCategories.length ? <Surface grouped>
          {topCategories.map((category, index) => <CategoryHomeRow key={category.key} category={category}
            totalMinor={summary.status === 'ready' ? summary.expenseMinor : 0} currency={currency}
            last={index === topCategories.length - 1}
            onPress={() => router.push({ pathname: '/spending-detail', params: { ...period, category: category.key } })} />)}
        </Surface> : <AppText secondary variant="subhead">
          {summary.status === 'ready' ? 'Tus categorías aparecerán cuando registres un gasto en este período.' : 'El desglose está disponible en tus movimientos.'}
        </AppText>}
        {summary.categories.length > 3 && <AppText tertiary variant="caption" style={{ paddingTop: 8, paddingHorizontal: 4 }}>
          Las 3 principales de {summary.categories.length} categorías · el resto está en Reportes.
        </AppText>}
      </View>

      <View>
        <SectionTitle action={upcoming.length ? 'Ver todos' : 'Programar'} onAction={() => router.push(upcoming.length ? '/recurring' : '/new-recurring')}>Próximos compromisos</SectionTitle>
        {upcoming.length ? <Surface grouped>{upcoming.map((rule, index) => <UpcomingRecurringRow key={rule.id} rule={rule}
          account={snapshot.accounts.find(account => account.id === rule.accountId)!} day={day} last={index === upcoming.length - 1} />)}</Surface>
          : <AppText secondary variant="subhead">Alquiler, suscripciones o un sueldo: programalos una vez y FinanzApp los registra al vencer.</AppText>}
      </View>

      <View>
        <SectionTitle action="Ver todos" onAction={() => router.navigate('/activity')}>Últimos movimientos</SectionTitle>
        {recent.length ? <Surface grouped>{recent.map((entry, index) => <EntryRow key={entry.id} entry={entry}
          account={snapshot.accounts.find(a => a.id === entry.accountId)!} last={index === recent.length - 1} />)}</Surface>
          : <AppText secondary variant="subhead">Todavía no hay movimientos registrados en este período.</AppText>}
      </View>
    </>}
  </Screen>;
}
