import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { currentMonthISO, labelFromISO, spendingOverview, spendingWindow, summarizeMonthlyBudgets, totalsByCurrency,
  type Account, type Currency, type RecurringRule, type SpendingWindow } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, CategoryBadge, Choices, EmptyState, EntryActions, EntryRow, Money, PressFeedback, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { availableCurrencies, selectEntries } from '../../src/ui/presentation';
import { CategorySpendingRow } from '../../src/ui/spending-chart';
import { SpendingTimeline, periodLabel } from '../../src/ui/spending-timeline';
import { useCurrentDay, usePalette, useReduceMotion } from '../../src/ui/theme';

type HomeMetric = 'spending' | 'available';

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
  const available = useMemo(() => snapshot ? totalsByCurrency(snapshot)[currency] ?? 0 : 0, [snapshot, currency]);
  const monthBudget = useMemo(() => snapshot
    ? summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], currency, currentMonthISO(day)) : null,
  [snapshot, archive?.budgets, currency, day]);
  const recent = useMemo(() => snapshot ? selectEntries(snapshot.entries.filter(entry =>
    snapshot.accounts.some(a => a.id === entry.accountId && a.currency === currency)
      && entry.dateISO >= period.startISO && entry.dateISO <= period.endISO), snapshot.accounts).slice(0, 3) : [], [snapshot, currency, period]);
  const upcoming = useMemo(() => (archive?.recurring ?? [])
    .filter(rule => rule.active && rule.kind === 'expense' && rule.nextDateISO >= day
      && snapshot?.accounts.some(account => account.id === rule.accountId && account.currency === currency))
    .sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant))
    .slice(0, 3), [archive?.recurring, snapshot?.accounts, currency, day]);

  if (!snapshot || !summary || !monthBudget) return null;
  const accountCount = snapshot.accounts.filter(account => account.currency === currency).length;
  const openReport = () => router.push({ pathname: '/reports', params: { currency } });

  return <Screen>
    {!snapshot.accounts.length ? <EmptyState title="Entendé tus gastos."
      detail="Elegí una cuenta para agrupar tus movimientos. Podés empezar sin cargar tu saldo bancario."
      icon="receipt-outline" action={<ActionButton label="Empezar" icon="add-outline" onPress={() => router.push('/new-account')} />} /> : <>
      <View style={{ gap: 18, paddingTop: 8 }}>
        <Choices value={metric} onChange={setMetric}
          options={[{ value: 'spending', label: 'Gastos' }, { value: 'available', label: 'Disponible' }]} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <AppText secondary style={{ fontSize: 14 }}>
            {metric === 'spending' ? periodLabel(period) : 'Saldo registrado'}
          </AppText>
          {currencies.length > 1 && <Choices value={currency} onChange={setCurrency}
            options={currencies.map(value => ({ value, label: value }))} />}
        </View>
        <View style={{ gap: 9 }}>
          <AppText style={{ fontSize: 19, fontWeight: '500' }}>
            {metric === 'spending' ? (window === 'month' ? 'Gastado este mes' : 'Gastado esta semana') : 'Disponible en tus cuentas'}
          </AppText>
          {metric === 'spending' ? summary.status === 'ready' ? <>
            <Money minor={summary.expenseMinor} currency={currency} large size={50} />
            <AppText secondary style={{ fontSize: 14 }}>{summary.expenseCount} {summary.expenseCount === 1 ? 'gasto registrado' : 'gastos registrados'} · {currency}</AppText>
          </> : <AppText secondary>El total supera el rango que podemos mostrar con precisión. Tus movimientos siguen guardados.</AppText>
            : <>
              <Money minor={available} currency={currency} large size={50} color={available < 0 ? p.negative : p.text} />
              <AppText secondary style={{ fontSize: 14 }}>
                {accountCount} {accountCount === 1 ? 'cuenta registrada' : 'cuentas registradas'} · no es sincronización bancaria
              </AppText>
            </>}
        </View>
        <View style={{ gap: 8 }}>
          <AppText secondary style={{ fontSize: 13 }}>Período de análisis</AppText>
          <Choices value={window} onChange={setWindow} options={[{ value: 'week', label: 'Esta semana' }, { value: 'month', label: 'Este mes' }]} />
        </View>
        {summary.status === 'ready' && summary.expenseCount > 0 && <SpendingTimeline buckets={summary.buckets} currency={currency} />}
      </View>

      <EntryActions currency={currency} />

      {!!monthBudget.rows.length ? <View>
        <SectionTitle action="Ver" onAction={() => router.push({ pathname: '/budgets', params: { currency } })}>Presupuesto del mes</SectionTitle>
        <BudgetHomeCard currency={currency} spent={monthBudget.spentBudgetedMinor} total={monthBudget.budgetedMinor}
          remaining={monthBudget.remainingMinor} />
      </View> : <Surface style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText style={{ fontWeight: '600' }}>Presupuesto del mes</AppText>
            <AppText secondary style={{ fontSize: 14 }}>Poné límites por categoría y seguí cuánto te queda.</AppText>
          </View>
          <PressFeedback accessibilityRole="button" accessibilityLabel="Configurar presupuesto"
            onPress={() => router.push({ pathname: '/budgets', params: { currency } })}
            style={{ paddingHorizontal: 8 }}>
            <AppText style={{ color: p.accent, fontWeight: '600' }}>Configurar</AppText>
          </PressFeedback>
        </View>
      </Surface>}

      {summary.status === 'ready' && summary.incomeMinor > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
        <AppText secondary style={{ fontSize: 14 }}>Ingresos del período</AppText>
        <Money minor={summary.incomeMinor} currency={currency} size={16} />
      </View>}

      {!!upcoming.length && <View>
        <SectionTitle action="Ver todos" onAction={() => router.push('/recurring')}>Próximos compromisos</SectionTitle>
        <AppText secondary style={{ fontSize: 13, marginBottom: 12 }}>Pagos recurrentes programados · {currency}</AppText>
        <Surface grouped>{upcoming.map((rule, index) => <UpcomingRecurringRow key={rule.id} rule={rule}
          account={snapshot.accounts.find(account => account.id === rule.accountId)!} day={day} last={index === upcoming.length - 1} />)}</Surface>
      </View>}

      <View>
        <SectionTitle action="Reporte mensual" onAction={openReport}>En qué gastaste</SectionTitle>
        <Surface grouped>
          {summary.categories.slice(0, 3).map((category, index) => <CategorySpendingRow key={category.key} category={category}
            totalMinor={summary.status === 'ready' ? summary.expenseMinor : 0} currency={currency} compact periodName="período"
            last={index === Math.min(summary.categories.length, 3) - 1}
            onPress={() => router.push({ pathname: '/spending-detail', params: { ...period, category: category.key } })} />)}
          {!summary.categories.length && <AppText secondary style={{ padding: 20, fontSize: 15 }}>
            {summary.status === 'ready' ? 'Tus categorías aparecerán cuando registres un gasto en este período.' : 'El desglose está disponible en tus movimientos.'}
          </AppText>}
          {summary.categories.length > 3 && <AppText secondary style={{ padding: 16, fontSize: 13 }}>Las 3 principales de {summary.categories.length} categorías.</AppText>}
        </Surface>
      </View>

      <View>
        <SectionTitle action="Ver todos" onAction={() => router.navigate('/activity')}>Últimos movimientos</SectionTitle>
        <AppText secondary style={{ fontSize: 13, marginBottom: 12 }}>Del período seleccionado · {currency}</AppText>
        {recent.length ? <Surface grouped>{recent.map((entry, index) => <EntryRow key={entry.id} entry={entry}
          account={snapshot.accounts.find(a => a.id === entry.accountId)!} last={index === recent.length - 1} />)}</Surface>
          : <AppText secondary>Todavía no hay movimientos registrados en este período.</AppText>}
      </View>
    </>}
  </Screen>;
}

function BudgetHomeCard({ currency, spent, total, remaining }: {
  currency: Currency; spent: number; total: number; remaining: number;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(total > 0 ? Math.min(1, spent / total) : 0, { duration: reduced ? 0 : 480 });
  }, [spent, total, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${Math.max(2, progress.value * 100)}%` as `${number}%` }));
  return <PressFeedback accessibilityRole="button" accessibilityLabel="Abrir presupuestos"
    onPress={() => router.push({ pathname: '/budgets', params: { currency } })}>
    <Surface>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 160, gap: 3 }}>
          <AppText secondary style={{ fontSize: 13 }}>Disponible</AppText>
          <Money minor={remaining} currency={currency} size={28} color={remaining < 0 ? p.negative : p.text} />
        </View>
        <View style={{ alignItems: 'flex-end', gap: 3 }}>
          <AppText secondary style={{ fontSize: 12 }}>Gastado</AppText>
          <Money minor={spent} currency={currency} size={15} />
        </View>
      </View>
      <View style={{ height: 7, borderRadius: 999, overflow: 'hidden', backgroundColor: p.inset }}>
        <Animated.View style={[{ height: 7, borderRadius: 999, backgroundColor: spent > total ? p.negative : p.accent }, bar]} />
      </View>
      <AppText secondary style={{ fontSize: 12 }}>Límite total · {currency === 'USD' ? 'US$ ' : '$ '}{formatMinor(total)}</AppText>
    </Surface>
  </PressFeedback>;
}

function UpcomingRecurringRow({ rule, account, day, last }: {
  rule: RecurringRule; account: Account; day: string; last: boolean;
}) {
  const p = usePalette();
  const date = labelFromISO(rule.nextDateISO, new Date(day + 'T12:00:00'));
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`${rule.merchant}, próximo pago ${date}, ${account.currency}`}
    onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <CategoryBadge category={rule.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <AppText numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{rule.merchant}</AppText>
        <Money minor={rule.amountMinor} currency={account.currency} />
      </View>
      <AppText secondary numberOfLines={1} style={{ fontSize: 13 }}>{date} · {rule.category}</AppText>
    </View>
  </PressFeedback>;
}

function formatMinor(minor: number) {
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return whole + ',' + String(absolute % 100).padStart(2, '0');
}
