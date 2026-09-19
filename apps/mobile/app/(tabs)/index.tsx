import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { spendingOverview, spendingWindow, type Currency, type SpendingWindow } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, EntryActions, EntryRow, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { availableCurrencies, selectEntries } from '../../src/ui/presentation';
import { CategorySpendingRow } from '../../src/ui/spending-chart';
import { SpendingTimeline, periodLabel } from '../../src/ui/spending-timeline';
import { useCurrentDay } from '../../src/ui/theme';

export default function HomeScreen() {
  const { snapshot } = useLedger();
  const day = useCurrentDay();
  const [selectedCurrency, setCurrency] = useState<Currency>('ARS');
  const [window, setWindow] = useState<SpendingWindow>('month');
  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? 'ARS';
  const period = useMemo(() => spendingWindow(currency, window, day), [currency, window, day]);
  const summary = useMemo(() => snapshot ? spendingOverview(snapshot, period) : null, [snapshot, period]);
  const recent = useMemo(() => snapshot ? selectEntries(snapshot.entries.filter(entry =>
    snapshot.accounts.some(a => a.id === entry.accountId && a.currency === currency)
      && entry.dateISO >= period.startISO && entry.dateISO <= period.endISO), snapshot.accounts).slice(0, 3) : [], [snapshot, currency, period]);
  if (!snapshot || !summary) return null;
  const openReport = () => router.push({ pathname: '/reports', params: { currency } });
  return <Screen>
    {!snapshot.accounts.length ? <EmptyState title="Entendé tus gastos."
      detail="Elegí una cuenta para agrupar tus movimientos. Podés empezar sin cargar tu saldo bancario."
      icon="receipt-outline" action={<ActionButton label="Empezar" icon="add-outline" onPress={() => router.push('/new-account')} />} /> : <>
      <View style={{ gap: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <AppText secondary style={{ fontSize: 14 }}>{periodLabel(period)}</AppText>
          {currencies.length > 1 && <Choices value={currency} onChange={setCurrency}
            options={currencies.map(value => ({ value, label: value }))} />}
        </View>
        <View style={{ gap: 10 }}>
          <AppText style={{ fontSize: 19, fontWeight: '500' }}>{window === 'month' ? 'Gastado este mes' : 'Gastado esta semana'}</AppText>
          {summary.status === 'ready' ? <>
            <Money minor={summary.expenseMinor} currency={currency} large size={48} />
            <AppText secondary style={{ fontSize: 14 }}>{summary.expenseCount} {summary.expenseCount === 1 ? 'gasto registrado' : 'gastos registrados'} · {currency}</AppText>
          </> : <AppText secondary>El total supera el rango que podemos mostrar con precisión. Tus movimientos siguen guardados.</AppText>}
        </View>
        <Choices value={window} onChange={setWindow} options={[{ value: 'week', label: 'Esta semana' }, { value: 'month', label: 'Este mes' }]} />
        {summary.status === 'ready' && summary.expenseCount > 0 && <SpendingTimeline buckets={summary.buckets} currency={currency} />}
      </View>
      <EntryActions currency={currency} />
      {summary.status === 'ready' && summary.incomeMinor > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
        <AppText secondary style={{ fontSize: 14 }}>Ingresos del período</AppText>
        <Money minor={summary.incomeMinor} currency={currency} size={16} />
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
