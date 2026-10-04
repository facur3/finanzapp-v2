import { useEffect } from 'react';
import { Alert, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Account, type Currency, type RecurringRule } from '@finanzapp/domain';
import type { BudgetAttention } from './home-focus';
import { percentUsed } from './budget-presentation';
import { AppText, MerchantBadge, Money, PressFeedback, useStacked, type IconName } from './components';
import { useCategoryLabel, useCategoryLook } from './category-hues';
import { labelAmountStacks } from './geometry';
import { timing } from './motion';
import { dueWhen } from './presentation';
import { usePalette, useReduceMotion } from './theme';
import { useI18n } from '../i18n/provider';

/** Contextual help for a metric: one native alert with the definition, so the
 * screen itself carries no disclaimer copy. Its button is named from the
 * catalogue, so it follows the interface language instead of the iPhone's (see InfoButton).
 * The glyph is a control, so it is drawn in secondary, not tertiary: it sits on the
 * background beside the hero's label and must read as something to tap (24UX1). */
export function MetricHelp({ title, detail, color }: { title: string; detail: string; color?: string }) {
  const p = usePalette();
  const { t } = useI18n();
  // 24UX6A: a 44 pt target (the glyph is 18 pt; the slop makes up the rest), drawn in the field's secondary ink on Inicio.
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('common.whatIs', { title })} hitSlop={10}
    onPress={() => Alert.alert(title, detail, [{ text: t('common.ok'), style: 'cancel' }])} style={{ minHeight: 24, paddingHorizontal: 4 }}>
    <Ionicons name="information-circle-outline" size={18} color={color ?? p.secondary} accessible={false} />
  </PressFeedback>;
}

/** A compact circular control on Inicio's financial field (24UX6A): the accounts shortcut. 44 pt, the field's control
 * fill, the glyph in the field's ink. */
export function FieldButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const p = usePalette();
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ width: 44, height: 44, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: p.heroControl }}>
    <Ionicons name={icon} size={22} color={p.heroInk} accessible={false} />
  </PressFeedback>;
}

/** Each currency's own figure when a consolidated total cannot be given (24C1): a rate is missing, stale, not
 * fetched yet, or the phone is offline. The subtotals stand where the total would, one per line, a step below the
 * hero's size, followed by one quiet line and the info button with the reason. Never a partial sum, never a zero. */
export function CurrencyParts({ parts, line, detail, onField = false }: {
  parts: readonly { currency: Currency; minor: number }[]; line: string; detail: string;
  /** On Inicio's field (24UX6A): the field's ink and secondary ink instead of the canvas's. */
  onField?: boolean;
}) {
  const p = usePalette();
  const { t } = useI18n();
  return <View style={{ gap: 4 }}>
    {parts.map(part => <Money key={part.currency} minor={part.minor} currency={part.currency} size={28} weight="700" color={onField ? p.heroInk : undefined} />)}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <AppText secondary variant="footnote" style={[{ flexShrink: 1 }, onField ? { color: p.heroSecondary } : null]}>{line}</AppText>
      <MetricHelp title={t('fx.infoTitle')} detail={detail} color={onField ? p.heroSecondary : undefined} />
    </View>
  </View>;
}

/** One scheduled commitment on Inicio (24UX2): who is paid (the merchant as typed, with its mark), and on the right
 * the amount with when it falls due. A scheduled date is an estimate, not a payment: nothing here is registered, and
 * the date appears once (the caption under the amount).
 *
 * 24UX3: the commitments are a light agenda. Since 24UX6A (Forest) Inicio draws them in one grouped surface, the hairline
 * starting under the text; the press answer stays a dim.
 * 24UX5: the mark is 40 pt, the same container as the ledger rows elsewhere; the agenda stays
 * tighter (56 pt rows, 8 pt of padding) and its caption under the name appears only when it adds something: the
 * category when the name and the glyph do not already say it (`showCategory`, see `homeNamesCategory`), the account
 * when another could be meant. The day stays under the amount, amber only today and tomorrow. VoiceOver always hears
 * merchant, category, amount and the estimated day. */
export function UpcomingRecurringRow({ rule, account, day, last, showAccount = false, showCategory = true }: {
  rule: RecurringRule; account: Account; day: string; last: boolean; showAccount?: boolean; showCategory?: boolean;
}) {
  const p = usePalette();
  const { t, relativeDate, spokenAmount } = useI18n();
  const stacked = useStacked({ minor: rule.amountMinor, currency: account.currency });
  const category = useCategoryLook(rule.category, rule.kind).label;
  const due = dueWhen(rule.nextDateISO, day);
  const when = due.kind === 'today' || due.kind === 'due' ? t('home.upcomingRow.today') : due.kind === 'tomorrow' ? t('home.upcomingRow.tomorrow')
    : due.kind === 'soon' ? t('home.upcomingRow.inDays', { count: due.days }) : relativeDate(rule.nextDateISO, day);
  const urgent = due.kind === 'today' || due.kind === 'tomorrow' || due.kind === 'due';
  const detail = [showCategory ? category : null, showAccount ? account.name : null].filter(Boolean).join(' · ');
  // VoiceOver hears merchant, category, amount, the estimated day and the account in one sentence, whatever the
  // caption shows (24UX5 review: the account used to be spoken only when it was drawn). 25B3: the row opens the
  // rule's detail (read first, Editar from there), and its hint says so.
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityHint={t('recurring.row.hint')}
    accessibilityLabel={t('home.upcomingRow.label', { merchant: rule.merchant, category, amount: spokenAmount(rule.amountMinor, account.currency), date: relativeDate(rule.nextDateISO, day, true) })
      + ', ' + account.name}
    onPress={() => router.push({ pathname: '/recurring/[id]', params: { id: rule.id } })}
    style={styles.agendaRow}>
    <MerchantBadge merchant={rule.merchant} category={rule.category} kind={rule.kind} />
    <View style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', paddingVertical: 8, gap: 8, flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center',
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{rule.merchant}</AppText>
        {!!detail && <AppText secondary variant="footnote" numberOfLines={stacked ? undefined : 2}>{detail}</AppText>}
      </View>
      <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', gap: 2, maxWidth: stacked ? '100%' : '56%' }}>
        <Money minor={rule.amountMinor} currency={account.currency} />
        <AppText variant="caption" style={{ color: urgent ? p.warning : p.secondary, fontWeight: urgent ? '600' : '400' }}>{when}</AppText>
      </View>
    </View>
  </PressFeedback>;
}

const styles = StyleSheet.create({
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
});

/** Points the budget row spends around its first line on a phone (24UX6D): screen padding (20 + 20), row padding (16 + 16),
 * the chevron (13) and its gap (10), and the alert glyph beside the percent (15) with its gap (4): 114, rounded up. */
const BUDGET_ROW_CHROME = 116;
/** The bar's thickness and corner (24UX6D): a 6 pt capsule, Presupuestos' general bar. */
const METER = { height: 6, radius: 3 } as const;

/** A month's budget that needs attention (24UX6C2; category budgets since the 24UX6D refinement): one compact row
 * between the financial field and the commitments, at most two of them in one grouped surface, never a card or a
 * dashboard. Amounts are the budget's own currency, measured on the real ledger (24C1); `homeBudgets` chose which budgets
 * and whether a row must name its currency. Tapping opens Presupuestos. The general budget is «Presupuesto»; a category
 * budget is named by its category («Supermercado»), in ink like the general one: the state (amber or the alert tone)
 * stays the only colour, so a category's hue never competes with it.
 *
 * 24UX6D, a Forest progress row instead of the sentence: the name («Presupuesto», «Presupuesto · USD» when the budget is
 * not in the currency Inicio shows) with the whole percent Presupuestos and Reportes show (`percentUsed`, «91 %», past
 * 100 % when exceeded: «120 %»); under them a 6 pt bar of spent over limit, visually clamped at the full track; then one
 * quiet line: «Quedan $ 89.000,00», «Límite alcanzado» at exactly 100 %, «$ 120.000,00 por encima» once over (coded
 * amounts when the currency is named). Warning (85 % through 100 %) is amber; exceeded is the alert tone AND an alert glyph
 * beside the percent AND the words «por encima», so the two states differ by more than colour. The name and the percent
 * share a line only when both fit (`labelAmountStacks`, so always stacked above 1.2× text); the detail wraps, never
 * truncated. VoiceOver hears one button: the state, the spoken percent and the spoken amount, never a visible string. */
export function BudgetAttentionRow({ attention, currency, labelsCurrency, onPress, last = true }: {
  attention: BudgetAttention; currency: Currency; labelsCurrency: boolean; onPress: () => void; last?: boolean;
}) {
  const p = usePalette();
  const { t, moneyText, codedAmount, spokenMoney, formatPercent, spokenPercent } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const { state, progress } = attention;
  const budget = progress.budget;
  const category = useCategoryLabel(budget.scope === 'category' ? budget.category : '');
  const exceeded = state === 'exceeded';
  const reached = !exceeded && progress.remainingMinor === 0;
  const tone = exceeded ? p.expense : p.warning;
  const money = (minor: number) => labelsCurrency ? codedAmount(minor, currency) : moneyText(minor, currency);
  // The whole percent Presupuestos shows (`percentUsed`: Math.round), as a fraction for the formatters, so the row and the
  // screen it opens agree; formatPercent rounds on the decimal value, so the product's binary tail never shows.
  const shown = percentUsed(progress) * 0.01;
  const percent = formatPercent(shown);
  const general = budget.scope === 'total';
  const title = general ? (labelsCurrency ? t('home.budget.titleIn', { code: currency }) : t('home.budget.title'))
    : labelsCurrency ? t('home.budget.categoryIn', { category, code: currency }) : category;
  const detail = exceeded ? t('home.budget.over', { amount: money(-progress.remainingMinor) })
    : reached ? t('home.budget.reached') : t('home.budget.left', { amount: money(progress.remainingMinor) });
  const name = general ? (labelsCurrency ? t('home.budget.spokenNameIn', { code: currency }) : t('home.budget.spokenName'))
    : t(labelsCurrency ? 'home.budget.spokenCategoryIn' : 'home.budget.spokenCategory', { category, code: currency });
  const label = exceeded ? t('home.budget.exceededLabel', { name, percent: spokenPercent(shown), amount: spokenMoney(-progress.remainingMinor, currency) })
    : reached ? t('home.budget.reachedLabel', { name, percent: spokenPercent(shown) })
    : t('home.budget.warningLabel', { name, percent: spokenPercent(shown), amount: spokenMoney(progress.remainingMinor, currency) });
  const stacked = labelAmountStacks(width, fontScale, title, percent, BUDGET_ROW_CHROME);
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={t('home.budget.hint')} onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: p.line }}>
    <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
      <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center', justifyContent: 'space-between', gap: stacked ? 2 : 8 }}>
        <AppText accessible={false} style={{ flexShrink: 1, fontWeight: '600' }}>{title}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {exceeded && <Ionicons name="alert-circle" size={15} color={p.expense} accessible={false} />}
          <AppText accessible={false} style={{ fontWeight: '600', fontVariant: ['tabular-nums'], color: tone }}>{percent}</AppText>
        </View>
      </View>
      <BudgetMeter fraction={Math.min(1, Math.max(0, progress.ratio || 0))} color={tone} />
      <AppText accessible={false} secondary variant="footnote">{detail}</AppText>
    </View>
    <Ionicons name="chevron-forward" size={13} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** The budget row's bar (24UX6D): the share of the limit already spent, on the inset track, filled in the row's tone. It
 * starts at its value (nothing plays when Inicio mounts or a tab returns) and moves only when the value changes, with the
 * data timing (260 ms ease-out, interruptible; instant under Reduce Motion). Hidden from VoiceOver: the row says it. */
function BudgetMeter({ fraction, color }: { fraction: number; color: string }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(fraction);
  useEffect(() => { progress.value = withTiming(fraction, timing('data', reduced)); }, [fraction, reduced, progress]);
  // A sliver stays visible however small the share (never at 85 % or more here, but the meter does not assume it).
  const fill = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  return <View accessible={false} importantForAccessibility="no-hide-descendants"
    style={{ height: METER.height, borderRadius: METER.radius, overflow: 'hidden', backgroundColor: p.inset }}>
    <Animated.View style={[{ height: METER.height, borderRadius: METER.radius, backgroundColor: color }, fill]} />
  </View>;
}
