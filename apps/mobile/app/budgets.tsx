import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { currentMonthISO, formatMinorUnits, shiftMonthISO, summarizeMonthlyBudgets, type BudgetProgress, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, CategoryBadge, Choices, EmptyState, IconButton, Money, PressFeedback, Screen, SectionTitle, Stat, Surface } from '../src/ui/components';
import { availableCurrencies } from '../src/ui/presentation';
import { space, useCurrentDay, usePalette, useReduceMotion } from '../src/ui/theme';

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split('-').map(Number);
  return new Date(year, month - 1, 1, 12).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

/** Budgets answer four things per category: the limit, what was spent, what is
 * left and whether it is near or over. Dense rows with one thin bar each. */
export default function BudgetsScreen() {
  const params = useLocalSearchParams<{ currency?: string; month?: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  const initialCurrency: Currency = params.currency === 'USD' ? 'USD' : 'ARS';
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency);
  const [monthISO, setMonthISO] = useState(() => params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthISO(day));
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? initialCurrency;
  const budgets = archive?.budgets ?? [];
  const summary = useMemo(() => snapshot ? summarizeMonthlyBudgets(snapshot, budgets, currency, monthISO) : null,
    [snapshot, budgets, currency, monthISO]);
  const activeCount = summary?.rows.length ?? 0;
  const money = (minor: number) => (currency === 'USD' ? 'US$ ' : '$ ') + formatMinorUnits(minor);

  if (!snapshot || !archive || !summary) return null;
  if (!snapshot.accounts.length) return <Screen><EmptyState title="Primero, una cuenta"
    detail="Los presupuestos se comparan con gastos registrados en una moneda concreta."
    action={<ActionButton label="Agregar cuenta" onPress={() => router.push('/new-account')} />} /></Screen>;
  const exceeded = summary.rows.filter(row => row.exceeded).length;
  const near = summary.rows.filter(row => !row.exceeded && row.ratio >= 0.85).length;
  const isCurrent = monthISO === currentMonthISO(day);

  return <Screen gap={space.xxl}>
    <Stack.Screen options={{ title: 'Presupuestos',
      headerRight: () => <IconButton name="add" label="Agregar presupuesto"
        onPress={() => router.push({ pathname: '/new-budget', params: { currency, month: monthISO } })} /> }} />

    <View style={{ gap: space.m }}>
      {currencies.length > 1 && <Choices value={currency} onChange={setSelectedCurrency}
        options={currencies.map(value => ({ value, label: value === 'ARS' ? 'Pesos · ARS' : 'Dólares · USD' }))} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton name="chevron-back" label="Mes anterior" onPress={() => setMonthISO(value => shiftMonthISO(value, -1))} />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <AppText accessibilityRole="header" variant="title3" style={{ textTransform: 'capitalize', textAlign: 'center' }}>{monthLabel(monthISO)}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppText secondary variant="caption">{isCurrent ? 'Mes en curso' : monthISO > currentMonthISO(day) ? 'Mes futuro · podés prepararlo' : 'Mes cerrado'}</AppText>
            {!isCurrent && <PressFeedback accessibilityRole="button" accessibilityLabel="Volver al mes actual" onPress={() => setMonthISO(currentMonthISO(day))} style={{ minHeight: 28 }}>
              <AppText variant="caption" style={{ fontWeight: '600', color: p.tint }}>Este mes</AppText>
            </PressFeedback>}
          </View>
        </View>
        <IconButton name="chevron-forward" label="Mes siguiente" onPress={() => setMonthISO(value => shiftMonthISO(value, 1))} />
      </View>
    </View>

    {activeCount ? <>
      <View style={{ gap: 8 }}>
        <AppText secondary variant="eyebrow">{summary.remainingMinor < 0 ? 'Excedido · presupuesto del mes' : 'Te queda · presupuesto del mes'}</AppText>
        <Money minor={Math.abs(summary.remainingMinor)} currency={currency} large color={summary.remainingMinor < 0 ? p.expense : undefined} />
        <TotalBar spent={summary.spentBudgetedMinor} total={summary.budgetedMinor} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Stat label="Gastado"><Money minor={summary.spentBudgetedMinor} currency={currency} size={17} /></Stat>
          <Stat label="Límite total" align="right"><Money minor={summary.budgetedMinor} currency={currency} size={17} /></Stat>
        </View>
        <AppText variant="footnote" style={{ color: exceeded ? p.expense : near ? p.warning : p.secondary }}>
          {activeCount} {activeCount === 1 ? 'categoría' : 'categorías'}{exceeded ? ` · ${exceeded} ${exceeded === 1 ? 'excedida' : 'excedidas'}` : ''}{near ? ` · ${near} cerca del límite` : ''}{!exceeded && !near ? ' · todas en orden' : ''}
        </AppText>
        {summary.unbudgetedSpentMinor > 0 && <AppText secondary variant="footnote">
          Además gastaste {money(summary.unbudgetedSpentMinor)} en categorías sin presupuesto.
        </AppText>}
      </View>

      <View>
        <SectionTitle action="Agregar" onAction={() => router.push({ pathname: '/new-budget', params: { currency, month: monthISO } })}>Categorías</SectionTitle>
        <Surface grouped>
          {summary.rows.map((row, index) => <BudgetRow key={row.budget.id} row={row} money={money} last={index === summary.rows.length - 1} />)}
        </Surface>
      </View>
    </> : <EmptyState title="Dale un límite a tu mes"
      detail="Creá presupuestos por categoría. FinanzApp compara el límite con tus gastos reales sin contar transferencias ni ingresos."
      icon="speedometer-outline"
      action={<ActionButton label="Crear presupuesto" icon="add-outline" onPress={() => router.push({ pathname: '/new-budget', params: { currency, month: monthISO } })} />} />}

    <AppText tertiary variant="footnote" style={{ textAlign: 'center' }}>
      Cada presupuesto pertenece a un mes y una moneda. Las compras con tarjeta cuentan; los pagos de tarjeta y las transferencias no.
    </AppText>
  </Screen>;
}

function BudgetRow({ row, money, last }: { row: BudgetProgress; money: (minor: number) => string; last: boolean }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const ratio = Math.min(1, row.ratio);
  const progress = useSharedValue(ratio);
  useEffect(() => { progress.value = withTiming(ratio, { duration: reduced ? 0 : 360 }); }, [ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const tone = row.exceeded ? p.expense : row.ratio >= 0.85 ? p.warning : p.text;
  const percent = Math.round(row.ratio * 100);
  const status = row.exceeded ? `Excedido por ${money(-row.remainingMinor)}` : row.remainingMinor === 0 ? 'Límite alcanzado' : `Quedan ${money(row.remainingMinor)}`;
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`Presupuesto ${row.budget.category}: ${money(row.spentMinor)} de ${money(row.budget.amountMinor)}, ${percent} por ciento. ${status}`}
    onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })}
    style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <CategoryBadge category={row.budget.category} tone={row.exceeded ? 'expense' : row.ratio >= 0.85 ? 'warning' : 'neutral'} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '500' }}>{row.budget.category}</AppText>
        <AppText variant="footnote" style={{ color: row.exceeded ? p.expense : row.ratio >= 0.85 ? p.warning : p.secondary }}>{status}</AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <AppText style={{ fontWeight: '600', fontVariant: ['tabular-nums'], color: tone }}>{percent} %</AppText>
        <AppText secondary variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{money(row.spentMinor)} de {money(row.budget.amountMinor)}</AppText>
      </View>
    </View>
    <View accessible={false} style={{ height: 4, borderRadius: 2, backgroundColor: p.inset, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: tone }, bar]} />
    </View>
  </PressFeedback>;
}

function TotalBar({ spent, total }: { spent: number; total: number }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const ratio = total > 0 ? Math.min(1, spent / total) : 0;
  const progress = useSharedValue(ratio);
  useEffect(() => { progress.value = withTiming(ratio, { duration: reduced ? 0 : 420 }); }, [ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  return <View accessible={false} style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: p.inset }}>
    <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: spent > total ? p.expense : ratio >= 0.85 ? p.warning : p.text }, bar]} />
  </View>;
}
