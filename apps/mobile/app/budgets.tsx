import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { currentMonthISO, formatMinorUnits, shiftMonthISO, summarizeMonthlyBudgets, type BudgetProgress, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, CategoryBadge, Choices, EmptyState, IconButton, Money, PressFeedback, Screen, SectionTitle, Surface } from '../src/ui/components';
import { availableCurrencies } from '../src/ui/presentation';
import { useCurrentDay, usePalette, useReduceMotion } from '../src/ui/theme';

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split('-').map(Number);
  return new Date(year, month - 1, 1, 12).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

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

  if (!snapshot || !archive || !summary) return null;
  if (!snapshot.accounts.length) return <Screen><EmptyState title="Primero, una cuenta"
    detail="Los presupuestos se comparan con gastos registrados en una moneda concreta."
    action={<ActionButton label="Agregar cuenta" onPress={() => router.push('/new-account')} />} /></Screen>;

  return <Screen>
    <Stack.Screen options={{ title: 'Presupuestos',
      headerRight: () => <IconButton name="add" label="Agregar presupuesto"
        onPress={() => router.push({ pathname: '/new-budget', params: { currency, month: monthISO } })} /> }} />

    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton name="chevron-back" label="Mes anterior" onPress={() => setMonthISO(value => shiftMonthISO(value, -1))} />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <AppText secondary style={{ fontSize: 13 }}>Plan mensual</AppText>
          <AppText style={{ fontSize: 22, fontWeight: '700', textTransform: 'capitalize', letterSpacing: -0.4 }}>{monthLabel(monthISO)}</AppText>
        </View>
        <IconButton name="chevron-forward" label="Mes siguiente" onPress={() => setMonthISO(value => shiftMonthISO(value, 1))} />
      </View>
      {currencies.length > 1 && <Choices value={currency} onChange={setSelectedCurrency}
        options={currencies.map(value => ({ value, label: value }))} />}
    </View>

    {activeCount ? <>
      <Surface>
        <AppText secondary style={{ fontSize: 14 }}>Disponible en presupuesto · {currency}</AppText>
        <Money minor={summary.remainingMinor} currency={currency} large size={42}
          color={summary.remainingMinor < 0 ? p.negative : p.text} />
        <BudgetTotalBar spent={summary.spentBudgetedMinor} total={summary.budgetedMinor} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
            <AppText secondary style={{ fontSize: 12 }}>Gastado presupuestado</AppText>
            <Money minor={summary.spentBudgetedMinor} currency={currency} size={16} />
          </View>
          <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
            <AppText secondary style={{ fontSize: 12 }}>Límite total</AppText>
            <Money minor={summary.budgetedMinor} currency={currency} size={16} />
          </View>
        </View>
        {summary.unbudgetedSpentMinor > 0 && <AppText secondary style={{ fontSize: 13 }}>
          Además gastaste <MoneyInline minor={summary.unbudgetedSpentMinor} currency={currency} /> en categorías sin presupuesto.
        </AppText>}
      </Surface>

      <View style={{ gap: 8 }}>
        <SectionTitle action="Agregar" onAction={() => router.push({ pathname: '/new-budget', params: { currency, month: monthISO } })}>
          Categorías
        </SectionTitle>
        <Surface grouped>
          {summary.rows.map((row, index) => <BudgetRow key={row.budget.id} row={row}
            last={index === summary.rows.length - 1} />)}
        </Surface>
      </View>
    </> : <EmptyState title="Dale un límite a tu mes"
      detail="Creá presupuestos por categoría. FinanzApp compara el límite con tus gastos reales sin contar transferencias ni ingresos."
      icon="speedometer-outline"
      action={<ActionButton label="Crear presupuesto" icon="add" onPress={() => router.push({ pathname: '/new-budget', params: { currency, month: monthISO } })} />} />}

    <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      Cada presupuesto pertenece a un mes y una moneda. Podés preparar meses futuros sin modificar tus movimientos.
    </AppText>
  </Screen>;
}

function BudgetRow({ row, last }: { row: BudgetProgress; last: boolean }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.min(1, row.ratio), { duration: reduced ? 0 : 420 });
  }, [row.ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(2, progress.value * 100)}%` as `${number}%` }));
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`Presupuesto ${row.budget.category}, gastado ${row.spentMinor}, límite ${row.budget.amountMinor}`}
    onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })}
    style={{ padding: 16, gap: 10, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <CategoryBadge category={row.budget.category} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText style={{ fontWeight: '600' }}>{row.budget.category}</AppText>
        <AppText secondary style={{ fontSize: 13 }}>
          {row.exceeded ? 'Excedido' : row.remainingMinor === 0 ? 'Límite alcanzado' : 'Disponible'}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Money minor={row.spentMinor} currency={row.budget.currency} size={16} color={row.exceeded ? p.negative : p.text} />
        <AppText secondary style={{ fontSize: 12 }}>de {row.budget.currency === 'USD' ? 'US$ ' : '$ '}{formatMinorUnits(row.budget.amountMinor)}</AppText>
      </View>
    </View>
    <View style={{ height: 7, borderRadius: 999, backgroundColor: p.inset, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 7, borderRadius: 999, backgroundColor: row.exceeded ? p.negative : p.accent }, bar]} />
    </View>
  </PressFeedback>;
}

function BudgetTotalBar({ spent, total }: { spent: number; total: number }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(total > 0 ? Math.min(1, spent / total) : 0, { duration: reduced ? 0 : 520 });
  }, [spent, total, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(2, progress.value * 100)}%` as `${number}%` }));
  return <View style={{ height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: p.inset }}>
    <Animated.View style={[{ height: 8, borderRadius: 999, backgroundColor: spent > total ? p.negative : p.accent }, bar]} />
  </View>;
}

function MoneyInline({ minor, currency }: { minor: number; currency: Currency }) {
  const p = usePalette();
  return <AppText style={{ fontSize: 13, color: p.text, fontWeight: '600' }}>
    {currency === 'USD' ? 'US$ ' : '$ '}{formatMinorUnits(minor)}
  </AppText>;
}
