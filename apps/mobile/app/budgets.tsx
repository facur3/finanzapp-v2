import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { currentMonthISO, shiftMonthISO, summarizeMonthlyBudgets, type BudgetProgress, type CategoryMonthlyBudget, type Currency,
  type TotalMonthlyBudget } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { budgetCategoriesCaption, budgetTone, percentUsed } from '../src/ui/budget-presentation';
import { useCategoryLabel } from '../src/ui/category-hues';
import { ActionButton, AppText, CategoryBadge, EmptyState, IconButton, Money, PressFeedback, Screen, SectionTitle, Stat, StatRow, Surface } from '../src/ui/components';
import { CurrencySwitch } from '../src/ui/currency-switch';
import { useI18n } from '../src/i18n/provider';
import { availableCurrencies } from '../src/ui/presentation';
import { heldCurrency } from '../src/ui/report-presentation';
import { timing } from '../src/ui/motion';
import { space, useCurrentDay, usePalette, useReduceMotion } from '../src/ui/theme';

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
  const { t, formatMonth, moneyText, spokenMoney } = useI18n();
  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  // The route's currency is honoured when an account holds it; an unknown code is never coerced (ARS is the empty-ledger fallback, decision 7.6.4).
  const initialCurrency: Currency = heldCurrency(snapshot?.accounts ?? [], params.currency) ?? 'ARS';
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency);
  const [monthISO, setMonthISO] = useState(() => params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthISO(day));
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? initialCurrency;
  const budgets = archive?.budgets ?? [];
  const summary = useMemo(() => snapshot ? summarizeMonthlyBudgets(snapshot, budgets, currency, monthISO) : null,
    [snapshot, budgets, currency, monthISO]);
  const activeCount = summary?.rows.length ?? 0;
  const money = (minor: number) => moneyText(minor, currency);
  const spoken = (minor: number) => spokenMoney(minor, currency);

  if (!snapshot || !archive || !summary) return null;
  if (!snapshot.accounts.length) return <Screen><EmptyState title={t('budgets.screen.noAccountTitle')}
    detail={t('budgets.screen.noAccountDetail')}
    action={<ActionButton label={t('common.addAccount')} onPress={() => router.push('/new-account')} />} /></Screen>;
  const exceeded = summary.rows.filter(row => budgetTone(row) === 'expense').length;
  const near = summary.rows.filter(row => budgetTone(row) === 'warning').length;
  const isCurrent = monthISO === currentMonthISO(day);
  const total = summary.total;
  const newBudget = (scope: 'total' | 'category') => router.push({ pathname: '/new-budget', params: { currency, month: monthISO, scope } });

  return <Screen gap={space.xxl}>
    <Stack.Screen options={{ title: t('nav.titles.budgets'),
      headerRight: () => <IconButton name="add" label={t('budgets.screen.add')}
        onPress={() => router.push({ pathname: '/new-budget', params: { currency, month: monthISO } })} /> }} />

    <View style={{ gap: space.m }}>
      {currencies.length > 1 && <CurrencySwitch value={currency} currencies={currencies} onChange={setSelectedCurrency} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconButton name="chevron-back" label={t('budgets.screen.previousMonth')} onPress={() => setMonthISO(value => shiftMonthISO(value, -1))} />
        <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
          <AppText accessibilityRole="header" variant="title3" style={{ textTransform: 'capitalize', textAlign: 'center' }}>{formatMonth(monthISO)}</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppText secondary variant="caption">{t(isCurrent ? 'budgets.screen.currentMonth' : monthISO > currentMonthISO(day) ? 'budgets.screen.futureMonth' : 'budgets.screen.closedMonth')}</AppText>
            {!isCurrent && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('budgets.screen.backToCurrent')} onPress={() => setMonthISO(currentMonthISO(day))} style={{ minHeight: 28 }}>
              <AppText variant="caption" style={{ fontWeight: '600', color: p.primary }}>{t('budgets.screen.thisMonth')}</AppText>
            </PressFeedback>}
          </View>
        </View>
        <IconButton name="chevron-forward" label={t('budgets.screen.nextMonth')} onPress={() => setMonthISO(value => shiftMonthISO(value, 1))} />
      </View>
    </View>

    {!total && !activeCount ? <EmptyState title={t('budgets.screen.emptyTitle')}
      detail={t('budgets.screen.emptyDetail')}
      icon="speedometer-outline"
      action={<ActionButton label={t('budgets.screen.create')} icon="add-outline" onPress={() => newBudget('total')} />} /> : <>
      {total ? <View>
        <SectionTitle action={t('budgets.screen.edit')} onAction={() => router.push({ pathname: '/edit-budget/[id]', params: { id: total.budget.id } })}>{t('budgets.screen.general')}</SectionTitle>
        <TotalPanel total={total} currency={currency} spoken={spoken} />
      </View> : <ActionButton label={t('budgets.screen.addGeneral')} icon="add-outline" secondary compact onPress={() => newBudget('total')} />}

      <View>
        <SectionTitle action={t('budgets.screen.addCategory')} onAction={() => newBudget('category')}
          caption={budgetCategoriesCaption(activeCount, exceeded, near, t)}>
          {t('budgets.screen.byCategory')}
        </SectionTitle>
        {activeCount ? <Surface grouped>
          {summary.rows.map((row, index) => <BudgetRow key={row.budget.id} row={row} money={money} spoken={spoken} last={index === summary.rows.length - 1} />)}
        </Surface> : <AppText secondary variant="subhead">{t('budgets.screen.noSublimits')}</AppText>}
        {activeCount > 0 && summary.unbudgetedSpentMinor > 0 && <AppText secondary variant="footnote" style={{ marginTop: 8 }}>
          {t('budgets.screen.unbudgeted', { amount: money(summary.unbudgetedSpentMinor) })}
        </AppText>}
      </View>
    </>}

  </Screen>;
}

/** The month's ceiling: what is left of it (or by how much it was passed), the
 * share used, and spent versus limit. Measured against every recorded expense
 * of the month in this currency; sublimits do not change it. */
function TotalPanel({ total, currency, spoken }: { total: BudgetProgress<TotalMonthlyBudget>; currency: Currency; spoken: (minor: number) => string }) {
  const p = usePalette();
  const { t, speechLanguage } = useI18n();
  const tone = budgetTone(total);
  const color = tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.secondary;
  const percent = percentUsed(total);
  const remaining = total.remainingMinor;
  return <View accessible accessibilityLabel={t('budgets.total.label', { spent: spoken(total.spentMinor), limit: spoken(total.budget.amountMinor), percent,
    status: remaining < 0 ? t('budgets.total.exceededBy', { amount: spoken(-remaining) }) : remaining === 0 ? t('budgets.total.reached') : t('budgets.total.availableAmount', { amount: spoken(remaining) }) })}
    accessibilityLanguage={speechLanguage}><Surface style={{ gap: 12 }}>
    <View style={{ gap: 2 }}>
      <AppText secondary variant="caption" style={{ fontWeight: '500' }}>{t(remaining < 0 ? 'budgets.total.exceeded' : 'budgets.total.available')}</AppText>
      <Money minor={Math.abs(remaining)} currency={currency} large color={tone === 'neutral' ? undefined : tone === 'expense' ? p.expense : p.warning} />
    </View>
    <TotalBar spent={total.spentMinor} total={total.budget.amountMinor} progress={total} />
    <StatRow>
      <Stat label={t('budgets.total.spent')}><Money minor={total.spentMinor} currency={currency} size={17} /></Stat>
      <Stat label={t('budgets.total.limit')}><Money minor={total.budget.amountMinor} currency={currency} size={17} /></Stat>
    </StatRow>
    <AppText variant="footnote" style={{ color, fontWeight: tone === 'neutral' ? '400' : '600' }}>
      {t('budgets.total.used', { percent }) + (tone === 'expense' ? ' · ' + t('budgets.total.stateExceeded')
        : tone === 'warning' ? ' · ' + t(remaining === 0 ? 'budgets.total.stateReached' : 'budgets.total.stateNear') : '')}
    </AppText>
  </Surface></View>;
}

function BudgetRow({ row, money, spoken, last }: { row: BudgetProgress<CategoryMonthlyBudget>; money: (minor: number) => string; spoken: (minor: number) => string; last: boolean }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const { t } = useI18n();
  const ratio = Math.min(1, row.ratio);
  const progress = useSharedValue(ratio);
  useEffect(() => { progress.value = withTiming(ratio, timing('data', reduced)); }, [ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const state = budgetTone(row);
  const tone = state === 'expense' ? p.expense : state === 'warning' ? p.warning : p.text;
  const percent = percentUsed(row);
  const statusOf = (amount: (minor: number) => string) => row.exceeded ? t('budgets.row.exceededBy', { amount: amount(-row.remainingMinor) })
    : row.remainingMinor === 0 ? t('budgets.row.reached') : t('budgets.row.left', { amount: amount(row.remainingMinor) });
  const status = statusOf(money);
  const name = useCategoryLabel(row.budget.category);
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={t('budgets.row.label', { name, spent: spoken(row.spentMinor), limit: spoken(row.budget.amountMinor), percent, status: statusOf(spoken) })}
    onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })}
    style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <CategoryBadge category={row.budget.category} tone={state} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={2} style={{ fontWeight: '500' }}>{name}</AppText>
        <AppText variant="footnote" style={{ color: state === 'neutral' ? p.secondary : tone }}>{status}</AppText>
        <AppText secondary variant="caption" style={{ fontVariant: ['tabular-nums'] }}>{t('budgets.row.of', { spent: money(row.spentMinor), limit: money(row.budget.amountMinor) })}</AppText>
      </View>
      <AppText style={{ fontWeight: '600', fontVariant: ['tabular-nums'], color: tone }}>{t('budgets.row.percent', { percent })}</AppText>
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
