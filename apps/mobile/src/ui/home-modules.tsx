import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Account, type Currency, type RecurringRule } from '@finanzapp/domain';
import { AppText, MerchantBadge, Money, PressFeedback, Surface, useStacked, type IconName } from './components';
import { washOf } from './category-color';
import { useCategoryLook } from './category-hues';
import type { HomeInsight } from './home-focus';
import { dueWhen } from './presentation';
import { usePalette } from './theme';
import { useI18n } from '../i18n/provider';

/** Contextual help for a metric: one native alert with the definition, so the
 * screen itself carries no disclaimer copy. Its button is named from the
 * catalogue, so it follows the interface language instead of the iPhone's (see InfoButton).
 * The glyph is a control, so it is drawn in secondary, not tertiary: it sits on the
 * background beside the hero's label and must read as something to tap (24UX1). */
export function MetricHelp({ title, detail }: { title: string; detail: string }) {
  const p = usePalette();
  const { t } = useI18n();
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('common.whatIs', { title })} hitSlop={8}
    onPress={() => Alert.alert(title, detail, [{ text: t('common.ok'), style: 'cancel' }])} style={{ minHeight: 24, paddingHorizontal: 4 }}>
    <Ionicons name="information-circle-outline" size={18} color={p.secondary} accessible={false} />
  </PressFeedback>;
}

/** Each currency's own figure when a consolidated total cannot be given (24C1): a rate is missing, stale, not
 * fetched yet, or the phone is offline. The subtotals stand where the total would, one per line, a step below the
 * hero's size, followed by one quiet line and the info button with the reason. Never a partial sum, never a zero. */
export function CurrencyParts({ parts, line, detail }: { parts: readonly { currency: Currency; minor: number }[]; line: string; detail: string }) {
  const { t } = useI18n();
  return <View style={{ gap: 4 }}>
    {parts.map(part => <Money key={part.currency} minor={part.minor} currency={part.currency} size={28} weight="700" />)}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <AppText secondary variant="footnote" style={{ flexShrink: 1 }}>{line}</AppText>
      <MetricHelp title={t('fx.infoTitle')} detail={detail} />
    </View>
  </View>;
}

/** Inicio's one contextual line (24UX6A, `homeInsight`): a budget exceeded or nearly spent, or one category
 * concentrating the month's spending. Computed facts only, one sentence, never a cause or advice. A single quiet card
 * (the only one on Inicio): a glyph in the fact's tone (amber near a limit, coral over it, the category's hue for a
 * concentration), the sentence, a chevron; tapping opens Presupuestos or Reportes. VoiceOver hears the same sentence
 * with the amount and the share in words. `labelsCurrency` writes the amount with its code when the budget is in
 * another currency than the one Inicio shows. */
export function HomeInsightRow({ insight, labelsCurrency = false, onPress }: { insight: NonNullable<HomeInsight>; labelsCurrency?: boolean; onPress: () => void }) {
  const p = usePalette();
  const { t, moneyText, codedAmount, spokenAmount, formatPercent, spokenPercent } = useI18n();
  const look = useCategoryLook(insight.kind === 'concentration' ? insight.category : insight.category ?? '');
  const amount = (minor: number, currency: Currency) => labelsCurrency ? codedAmount(minor, currency) : moneyText(minor, currency);
  let text: string, spoken: string, icon: IconName, color: string, soft: string;
  if (insight.kind === 'budgetExceeded') {
    const key = insight.scope === 'total' ? 'home.insight.budgetExceededTotal' : 'home.insight.budgetExceededCategory';
    text = t(key, { name: look.label, amount: amount(insight.overMinor, insight.currency) });
    spoken = t(key, { name: look.label, amount: spokenAmount(insight.overMinor, insight.currency) });
    icon = 'speedometer-outline'; color = p.expense; soft = p.expenseSoft;
  } else if (insight.kind === 'budgetLow') {
    const key = insight.scope === 'total' ? 'home.insight.budgetLowTotal' : 'home.insight.budgetLowCategory';
    text = t(key, { name: look.label, percent: formatPercent(insight.leftShare) });
    spoken = t(key, { name: look.label, percent: spokenPercent(insight.leftShare) });
    icon = 'speedometer-outline'; color = p.warning; soft = p.warningSoft;
  } else {
    text = t('home.insight.concentration', { name: look.label, percent: formatPercent(insight.share) });
    spoken = t('home.insight.concentration', { name: look.label, percent: spokenPercent(insight.share) });
    icon = look.glyph; color = look.hex; soft = washOf(look.hex, p);
  }
  return <PressFeedback accessibilityRole="button" accessibilityLabel={spoken}
    accessibilityHint={t(insight.kind === 'concentration' ? 'home.insight.reportsHint' : 'home.insight.budgetsHint')} onPress={onPress}>
    <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
      <View accessible={false} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={color} accessible={false} />
      </View>
      <AppText accessible={false} variant="subhead" style={{ flex: 1, minWidth: 0, fontWeight: '500' }}>{text}</AppText>
      <Ionicons name="chevron-forward" size={15} color={p.tertiary} accessible={false} />
    </Surface>
  </PressFeedback>;
}

/** One scheduled commitment on Inicio (24UX2): who is paid (the merchant as typed, with its mark), and on the right
 * the amount with when it falls due. A scheduled date is an estimate, not a payment: nothing here is registered, and
 * the date appears once (the caption under the amount).
 *
 * 24UX3: the commitments are a light agenda, not a third card. Rows sit on the screen's ground with no surface and a
 * hairline that starts under the text, like a plain list; the press answer is a dim, since there is no cell to tint.
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
