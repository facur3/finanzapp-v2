import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { currentMonthISO, formatMinorUnits, shiftMonthISO, summarizeMonthlyBudgets, type BudgetProgress, type CategoryMonthlyBudget, type Currency,
  type TotalMonthlyBudget } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { budgetTone, percentUsed } from '../src/ui/budget-presentation';
import { useCategoryLabel } from '../src/ui/category-hues';
import { ActionButton, AppText, CategoryBadge, Choices, EmptyState, IconButton, Money, PressFeedback, Screen, SectionTitle, Stat, Surface } from '../src/ui/components';
import { availableCurrencies } from '../src/ui/presentation';
import { timing } from '../src/ui/motion';
import { space, useCurrentDay, usePalette, useReduceMotion } from '../src/ui/theme';

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split('-').map(Number);
  return new Date(year, month - 1, 1, 12).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

/** Hierarchy: the general budget (the month's ceiling over every recorded
 * expense) is the primary summary when it exists; category sublimits sit
 * under it as dense rows with one thin bar each. Without a general budget
 * there is a compact action to add one, never a giant empty card, and the
 * sublimits stay useful on their own. Sublimits are never summed into a
 * monthly figure. */
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
  const exceeded = summary.rows.filter(row => budgetTone(row) === 'expense').length;
  const near = summary.rows.filter(row => budgetTone(row) === 'warning').length;
  const isCurrent = monthISO === currentMonthISO(day);
  const total = summary.total;
  const newBudget = (scope: 'total' | 'category') => router.push({ pathname: '/new-budget', params: { currency, month: monthISO, scope } });

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
            {!isCurrent && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel="Volver al mes actual" onPress={() => setMonthISO(currentMonthISO(day))} style={{ minHeight: 28 }}>
              <AppText variant="caption" style={{ fontWeight: '600', color: p.primary }}>Este mes</AppText>
            </PressFeedback>}
          </View>
        </View>
        <IconButton name="chevron-forward" label="Mes siguiente" onPress={() => setMonthISO(value => shiftMonthISO(value, 1))} />
      </View>
    </View>

    {!total && !activeCount ? <EmptyState title="Dale un límite a tu mes"
      detail="Un presupuesto general es el techo de todos tus gastos del mes; los límites por categoría son sublímites dentro de él. FinanzApp los compara con tus gastos reales sin contar transferencias ni ingresos."
      icon="speedometer-outline"
      action={<ActionButton label="Crear presupuesto" icon="add-outline" onPress={() => newBudget('total')} />} /> : <>
      {total ? <View>
        <SectionTitle action="Editar" onAction={() => router.push({ pathname: '/edit-budget/[id]', params: { id: total.budget.id } })}>Presupuesto general</SectionTitle>
        <TotalPanel total={total} currency={currency} money={money} />
      </View> : <ActionButton label="Agregar presupuesto general" icon="add-outline" secondary compact onPress={() => newBudget('total')} />}

      <View>
        <SectionTitle action="Agregar" onAction={() => newBudget('category')}
          caption={activeCount ? `${activeCount} ${activeCount === 1 ? 'categoría' : 'categorías'}${exceeded ? ` · ${exceeded} ${exceeded === 1 ? 'excedida' : 'excedidas'}` : ''}${near ? ` · ${near} cerca del límite` : ''}${!exceeded && !near ? ' · todas en orden' : ''}` : undefined}>
          Por categoría
        </SectionTitle>
        {activeCount ? <Surface grouped>
          {summary.rows.map((row, index) => <BudgetRow key={row.budget.id} row={row} money={money} last={index === summary.rows.length - 1} />)}
        </Surface> : <AppText secondary variant="subhead">Sin límites por categoría este mes. Son sublímites dentro del general y no se suman entre sí.</AppText>}
        {activeCount > 0 && summary.unbudgetedSpentMinor > 0 && <AppText secondary variant="footnote" style={{ marginTop: 8 }}>
          Además gastaste {money(summary.unbudgetedSpentMinor)} en categorías sin límite propio.
        </AppText>}
      </View>
    </>}

  </Screen>;
}

/** The month's ceiling: what is left of it (or by how much it was passed), the
 * share used, and spent versus limit. Measured against every recorded expense
 * of the month in this currency; sublimits do not change it. */
function TotalPanel({ total, currency, money }: { total: BudgetProgress<TotalMonthlyBudget>; currency: Currency; money: (minor: number) => string }) {
  const p = usePalette();
  const tone = budgetTone(total);
  const color = tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.secondary;
  const percent = percentUsed(total);
  const remaining = total.remainingMinor;
  return <View accessible accessibilityLabel={`Presupuesto general: ${money(total.spentMinor)} de ${money(total.budget.amountMinor)}, ${percent} por ciento usado. ${remaining < 0 ? 'Excedido por ' + money(-remaining) : remaining === 0 ? 'Límite alcanzado' : 'Disponible ' + money(remaining)}`}><Surface style={{ gap: 12 }}>
    <View style={{ gap: 2 }}>
      <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{remaining < 0 ? 'Excedido' : 'Disponible'}</AppText>
      <Money minor={Math.abs(remaining)} currency={currency} large color={tone === 'neutral' ? undefined : tone === 'expense' ? p.expense : p.warning} />
    </View>
    <TotalBar spent={total.spentMinor} total={total.budget.amountMinor} progress={total} />
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Stat label="Gastado"><Money minor={total.spentMinor} currency={currency} size={17} /></Stat>
      <Stat label="Límite" align="right"><Money minor={total.budget.amountMinor} currency={currency} size={17} /></Stat>
    </View>
    <AppText variant="footnote" style={{ color, fontWeight: tone === 'neutral' ? '400' : '600' }}>
      {percent} % utilizado{tone === 'expense' ? ' · excedido' : tone === 'warning' ? (remaining === 0 ? ' · límite alcanzado' : ' · cerca del límite') : ''}
    </AppText>
  </Surface></View>;
}

function BudgetRow({ row, money, last }: { row: BudgetProgress<CategoryMonthlyBudget>; money: (minor: number) => string; last: boolean }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const ratio = Math.min(1, row.ratio);
  const progress = useSharedValue(ratio);
  useEffect(() => { progress.value = withTiming(ratio, timing('data', reduced)); }, [ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const state = budgetTone(row);
  const tone = state === 'expense' ? p.expense : state === 'warning' ? p.warning : p.text;
  const percent = percentUsed(row);
  const status = row.exceeded ? `Excedido por ${money(-row.remainingMinor)}` : row.remainingMinor === 0 ? 'Límite alcanzado' : `Quedan ${money(row.remainingMinor)}`;
  const name = useCategoryLabel(row.budget.category);
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={`Presupuesto ${name}: ${money(row.spentMinor)} de ${money(row.budget.amountMinor)}, ${percent} por ciento. ${status}`}
    onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })}
    style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <CategoryBadge category={row.budget.category} tone={state} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '500' }}>{name}</AppText>
        <AppText variant="footnote" style={{ color: state === 'neutral' ? p.secondary : tone }}>{status}</AppText>
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

function TotalBar({ spent, total, progress: state }: { spent: number; total: number; progress: { ratio: number; exceeded: boolean } }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const ratio = total > 0 ? Math.min(1, spent / total) : 0;
  const progress = useSharedValue(ratio);
  useEffect(() => { progress.value = withTiming(ratio, timing('data', reduced)); }, [ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const tone = budgetTone(state);
  return <View accessible={false} style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: p.inset }}>
    <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.text }, bar]} />
  </View>;
}
