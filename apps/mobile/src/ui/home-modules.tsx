import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Account, type Currency, type RecurringRule } from '@finanzapp/domain';
import { AppText, MerchantBadge, Money, PressFeedback, useStacked, type IconName } from './components';
import { useCategoryLook } from './category-hues';
import { dueWhen } from './presentation';
import { usePalette } from './theme';
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
  /** On Inicio's pine field (24UX6A): the field's ink and secondary ink instead of the canvas's. */
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
