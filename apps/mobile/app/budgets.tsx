import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { currentMonthISO, shiftMonthISO, summarizeMonthlyBudgets, validMonthISO, type BudgetProgress, type CategoryMonthlyBudget, type Currency,
  type MonthlyBudgetSummary, type TotalMonthlyBudget } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { budgetCategoriesCaption, budgetTone, percentUsed } from '../src/ui/budget-presentation';
import { useCategoryLabel } from '../src/ui/category-hues';
import { ActionButton, AppText, CategoryBadge, EmptyState, IconButton, Money, PressFeedback, Screen, SectionTitle, Stat, StatRow, Surface } from '../src/ui/components';
import { CurrencySwitch } from '../src/ui/currency-switch';
import { labelAmountStacks } from '../src/ui/geometry';
import { useDefaultCurrency } from '../src/ui/use-default-currency';
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
  const { t, formatMonthTitle, moneyText, spokenMoney } = useI18n();
  const currencies = availableCurrencies(snapshot?.accounts ?? []);
  // The route's currency is honoured when an account holds it; otherwise the one default rule (25B2): the currency held,
  // the display currency among several, the region's tender, ARS last. An unknown code is never coerced.
  const suggested = useDefaultCurrency();
  const initialCurrency: Currency = heldCurrency(snapshot?.accounts ?? [], params.currency) ?? suggested;
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(initialCurrency);
  // 24UX6E: a month the domain accepts (the shape alone let «2026-13» through, and the summary below threw during render).
  const [monthISO, setMonthISO] = useState(() => params.month && validMonthISO(params.month) ? params.month : currentMonthISO(day));
  const currency = currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0] ?? initialCurrency;
  const budgets = archive?.budgets ?? [];
  // 24UX6E: the summary refuses a month whose recorded spending leaves the safe range (as Inicio and Reportes already
  // catch): the screen says it could not calculate that month instead of failing, and the month stepper stays usable.
  const summary = useMemo((): MonthlyBudgetSummary | null => {
    if (!snapshot) return null;
    try { return summarizeMonthlyBudgets(snapshot, budgets, currency, monthISO); } catch { return null; }
  }, [snapshot, budgets, currency, monthISO]);
  const activeCount = summary?.rows.length ?? 0;
  const money = (minor: number) => moneyText(minor, currency);
  const spoken = (minor: number) => spokenMoney(minor, currency);

  if (!snapshot || !archive) return null;
  if (!snapshot.accounts.length) return <Screen><EmptyState title={t('budgets.screen.noAccountTitle')}
    detail={t('budgets.screen.noAccountDetail')}
    action={<ActionButton label={t('common.addAccount')} onPress={() => router.push('/new-account')} />} /></Screen>;
  const exceeded = summary ? summary.rows.filter(row => budgetTone(row) === 'expense').length : 0;
  const near = summary ? summary.rows.filter(row => budgetTone(row) === 'warning').length : 0;
  const isCurrent = monthISO === currentMonthISO(day);
  const total = summary?.total ?? null;
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
          <AppText accessibilityRole="header" variant="title3" style={{ textAlign: 'center' }}>{formatMonthTitle(monthISO)}</AppText>
          {/* 24UX6E: the state and «Este mes» wrap onto two centred lines at large text instead of overflowing the
              column; the link keeps its 28 pt line and reaches 44 pt with its slop. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 10, rowGap: 2 }}>
            <AppText secondary variant="caption" style={{ textAlign: 'center' }}>{t(isCurrent ? 'budgets.screen.currentMonth' : monthISO > currentMonthISO(day) ? 'budgets.screen.futureMonth' : 'budgets.screen.closedMonth')}</AppText>
            {!isCurrent && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('budgets.screen.backToCurrent')} onPress={() => setMonthISO(currentMonthISO(day))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ minHeight: 28, justifyContent: 'center' }}>
              <AppText variant="caption" style={{ fontWeight: '600', color: p.link }}>{t('budgets.screen.thisMonth')}</AppText>
            </PressFeedback>}
          </View>
        </View>
        <IconButton name="chevron-forward" label={t('budgets.screen.nextMonth')} onPress={() => setMonthISO(value => shiftMonthISO(value, 1))} />
      </View>
    </View>

    {!summary ? <EmptyState title={t('budgets.screen.unavailableTitle')} detail={t('budgets.screen.unavailableDetail')} icon="speedometer-outline" />
      : !total && !activeCount ? <EmptyState title={t('budgets.screen.emptyTitle')}
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
        {activeCount > 0 && summary.unbudgetedSpentMinor > 0 && <AppText secondary variant="footnote" style={{ marginTop: space.s }}
          accessibilityLabel={t('budgets.screen.unbudgeted', { amount: spoken(summary.unbudgetedSpentMinor) })}>
          {t('budgets.screen.unbudgeted', { amount: money(summary.unbudgetedSpentMinor) })}
        </AppText>}
      </View>
    </>}

  </Screen>;
}

/** Points a sublimit row spends around its first line on a phone (24UX6E): screen padding (20 + 20), row padding
 * (16 + 16), the category tile (40) and its gap (12), and the alert glyph beside the percent (15) with its gap (4): 143,
 * rounded up. No chevron: the row opens the budget's form as a modal (the Categorías rows' rule). */
const SUBLIMIT_ROW_CHROME = 144;

/** The month's ceiling: what is left of it (or by how much it was passed), the
 * share used, and spent versus limit. Measured against every recorded expense
 * of the month in this currency; sublimits do not change it.
 *
 * 24UX6E: flat on the canvas, the CardStatusBlock rhythm (no padded card beside the grouped list, one weight per level):
 * «Disponible» / «Excedido» over the 40 pt hero, then the 6 pt bar with the share used right under it, then Gastado ·
 * Límite. The hero stays ink up to and including the limit (amber rides on the bar and the status line); only an
 * exceeded budget paints it, beside the word «Excedido», with the alert glyph before the status line. The bar is the
 * domain's ratio, drawn full past 100 %. VoiceOver hears the one summary sentence, never a visible string. */
function TotalPanel({ total, currency, spoken }: { total: BudgetProgress<TotalMonthlyBudget>; currency: Currency; spoken: (minor: number) => string }) {
  const p = usePalette();
  const { t, speechLanguage, formatPercent } = useI18n();
  const tone = budgetTone(total);
  const color = tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.secondary;
  const percent = percentUsed(total);
  const remaining = total.remainingMinor;
  return <View accessible accessibilityLabel={t('budgets.total.label', { spent: spoken(total.spentMinor), limit: spoken(total.budget.amountMinor), percent,
    status: remaining < 0 ? t('budgets.total.exceededBy', { amount: spoken(-remaining) }) : remaining === 0 ? t('budgets.total.reached') : t('budgets.total.availableAmount', { amount: spoken(remaining) }) })}
    accessibilityLanguage={speechLanguage} style={{ gap: 20 }}>
    <View style={{ gap: 6 }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{t(remaining < 0 ? 'budgets.total.exceeded' : 'budgets.total.available')}</AppText>
      <Money minor={Math.abs(remaining)} currency={currency} large size={40} color={tone === 'expense' ? p.expense : undefined} />
    </View>
    <View style={{ gap: 8 }}>
      <ProgressBar fraction={Math.min(1, Math.max(0, total.ratio || 0))} color={tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.text} height={6} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {tone === 'expense' && <Ionicons name="alert-circle" size={15} color={p.expense} accessible={false} />}
        <AppText variant="footnote" style={{ flexShrink: 1, color, fontWeight: tone === 'neutral' ? '400' : '600' }}>
          {t('budgets.total.used', { percent: formatPercent(percent * 0.01) }) + (tone === 'expense' ? ' · ' + t('budgets.total.stateExceeded')
            : tone === 'warning' ? ' · ' + t(remaining === 0 ? 'budgets.total.stateReached' : 'budgets.total.stateNear') : '')}
        </AppText>
      </View>
    </View>
    <StatRow>
      <Stat label={t('budgets.total.spent')}><Money minor={total.spentMinor} currency={currency} size={17} /></Stat>
      <Stat label={t('budgets.total.limit')}><Money minor={total.budget.amountMinor} currency={currency} size={17} /></Stat>
    </StatRow>
  </View>;
}

/** One category sublimit (24UX6E, the anatomy of Inicio's budget row one level quieter): the category's own tile
 * (identity only: its hue never carries the state), the name at the ledger weight beside the percent Inicio shows
 * (`formatPercent` of `percentUsed`, in the state colour, with the alert glyph once exceeded), a 4 pt bar of the domain's
 * ratio, and one quiet uncoloured line: «Quedan $ X de $ Y», «Límite alcanzado · $ Y» or «$ X por encima de $ Y». The
 * name and the percent share a line only when both fit (`labelAmountStacks`, always stacked above 1.2× text), and a
 * stacked name is never truncated. No chevron: the row opens the budget's form as a modal; the hint says so. */
function BudgetRow({ row, money, spoken, last }: { row: BudgetProgress<CategoryMonthlyBudget>; money: (minor: number) => string; spoken: (minor: number) => string; last: boolean }) {
  const p = usePalette();
  const { t, formatPercent } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const state = budgetTone(row);
  const tone = state === 'expense' ? p.expense : state === 'warning' ? p.warning : p.text;
  const percent = percentUsed(row);
  const percentText = formatPercent(percent * 0.01);
  const statusOf = (amount: (minor: number) => string) => row.exceeded ? t('budgets.row.exceededBy', { amount: amount(-row.remainingMinor) })
    : row.remainingMinor === 0 ? t('budgets.row.reached') : t('budgets.row.left', { amount: amount(row.remainingMinor) });
  const limit = money(row.budget.amountMinor);
  const detail = row.exceeded ? t('budgets.row.overOf', { amount: money(-row.remainingMinor), limit })
    : row.remainingMinor === 0 ? t('budgets.row.reachedOf', { limit }) : t('budgets.row.leftOf', { amount: money(row.remainingMinor), limit });
  const name = useCategoryLabel(row.budget.category);
  const stacked = labelAmountStacks(width, fontScale, name, percentText, SUBLIMIT_ROW_CHROME);
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={t('budgets.row.label', { name, spent: spoken(row.spentMinor), limit: spoken(row.budget.amountMinor), percent, status: statusOf(spoken) })}
    accessibilityHint={t('budgets.row.hint')}
    onPress={() => router.push({ pathname: '/edit-budget/[id]', params: { id: row.budget.id } })}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <CategoryBadge category={row.budget.category} />
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center', justifyContent: 'space-between', gap: stacked ? 2 : 8 }}>
        <AppText accessible={false} numberOfLines={stacked ? undefined : 2} style={{ flexShrink: 1, fontWeight: '500' }}>{name}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {row.exceeded && <Ionicons name="alert-circle" size={15} color={p.expense} accessible={false} />}
          <AppText accessible={false} style={{ fontWeight: '600', fontVariant: ['tabular-nums'], color: tone }}>{percentText}</AppText>
        </View>
      </View>
      <ProgressBar fraction={Math.min(1, Math.max(0, row.ratio || 0))} color={tone} height={4} />
      <AppText accessible={false} secondary variant="footnote">{detail}</AppText>
    </View>
  </PressFeedback>;
}

/** A budget's bar: the share of the limit spent, clamped to the full track, on the inset track and filled in the state's
 * colour (ink when calm). The general budget's is 6 pt, a sublimit's 4 pt, the hierarchy between them. It starts at its
 * value and moves only when the value changes (the data timing; instant under Reduce Motion). Hidden from VoiceOver: the
 * block or row it belongs to says it. */
function ProgressBar({ fraction, color, height }: { fraction: number; color: string; height: number }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(fraction);
  useEffect(() => { progress.value = withTiming(fraction, timing('data', reduced)); }, [fraction, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: p.inset }}>
    <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, bar]} />
  </View>;
}
