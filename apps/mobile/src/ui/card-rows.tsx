import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { useI18n } from '../i18n/provider';
import { cardFaceTone } from './card-faces';
import { AppText, GlyphTile, MerchantBadge, Money, PressFeedback, useStacked, type IconName } from './components';
import { planProgress, type PlanProgress, type PlanScheduleRow, type PlanSummary, type ScheduleRowState } from './installment-presentation';
import type { CardSummary } from './liability-presentation';
import { radius, useCurrentDay, usePalette, type Palette } from './theme';

/** Producto 24T2: the rows of the card surfaces (Tarjetas, a card's detail, a plan's detail). Each row is one VoiceOver
 * element whose sentence is built with the spoken formatters; the screen shows the region's formats. */

/** «Cuotas futuras» under a card's actions: the principal of its plans not recognised yet, and in how many plans; the
 * interest those instalments still carry is named beside it («+ interés $ …»), never added in. A figure whose sum left
 * the exact range (null) reads «Total fuera de rango», never a rounded amount. It opens the card's detail, where the plans
 * are listed. */
export function FutureInstallmentsRow({ committedMinor, financingMinor = 0, financingKind = 'interest', planCount, currency, onPress }: {
  committedMinor: number | null; financingMinor?: number | null; financingKind?: 'interest' | 'financing'; planCount: number; currency: Currency; onPress: () => void;
}) {
  const p = usePalette();
  const { t, moneyText, spokenMoney } = useI18n();
  const outOfRange = committedMinor === null || financingMinor === null;
  const stacked = useStacked({ minor: committedMinor ?? 0, currency });
  const title = t('cards.panel.future'), plans = t('cards.panel.futurePlans', { count: planCount });
  const extra = (format: (minor: number) => string) => !outOfRange && financingMinor! > 0
    ? t(financingKind === 'financing' ? 'cards.panel.futureFinancing' : 'cards.panel.futureInterest', { amount: format(financingMinor!) }) : null;
  const detail = [plans, extra(minor => moneyText(minor, currency))].filter(Boolean).join(' · ');
  const figure = outOfRange ? t('cards.panel.futureOutOfRange') : spokenMoney(committedMinor, currency);
  return <PressFeedback feedback="highlight" accessibilityRole="button"
    accessibilityLabel={[title, figure, plans, extra(minor => spokenMoney(minor, currency))].filter(Boolean).join(', ')}
    accessibilityHint={t('cards.list.openHint')} onPress={onPress} style={styles.row}>
    <GlyphTile icon="calendar-outline" />
    <View style={[styles.body, stacked ? styles.stacked : null]}>
      <View style={[styles.text, stacked ? null : { flex: 1 }]}>
        <AppText style={{ fontWeight: '600' }}>{title}</AppText>
        <AppText secondary variant="footnote">{detail}</AppText>
      </View>
      {outOfRange ? <AppText secondary variant="subhead">{t('cards.panel.futureOutOfRange')}</AppText> : <Money minor={committedMinor} currency={currency} />}
    </View>
    <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** An archived card at the end of Tarjetas: a small swatch of its face, its name and its balance. */
export function ArchivedCardRow({ summary, color, onPress, last = false }: { summary: CardSummary; color: string | null; onPress: () => void; last?: boolean }) {
  const p = usePalette();
  const { t, moneyText, spokenMoney } = useI18n();
  const { card, account, debtMinor } = summary;
  const line = debtMinor > 0 ? t('cards.archived.debt', { amount: moneyText(debtMinor, account.currency) }) : t('cards.archived.clear');
  const spoken = debtMinor > 0 ? t('cards.archived.debt', { amount: spokenMoney(debtMinor, account.currency) }) : t('cards.archived.clear');
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={account.name + ', ' + spoken} accessibilityHint={t('cards.list.openHint')}
    onPress={onPress} style={[styles.row, separator(p, last)]}>
    <View style={[styles.swatch, { backgroundColor: cardFaceTone(card.id, color).base }]} />
    <View style={styles.text}>
      <AppText numberOfLines={2} style={{ fontWeight: '600' }}>{account.name}</AppText>
      <AppText secondary variant="footnote">{line}</AppText>
    </View>
    <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** One plan in a card's detail: the merchant, «12 cuotas · 3/12 registradas», the principal still to come
 * («$ 900.000,00 restantes»; «principal restante» when the plan carries interest, which its detail lists apart) and the
 * next instalment's statement, or the plan's end state. Never «pagadas». */
export function PlanRow({ summary, onPress, last = false }: { summary: PlanSummary; onPress: () => void; last?: boolean }) {
  const p = usePalette();
  const day = useCurrentDay();
  const { t, spokenMoney, relativeDate, formatDate } = useI18n();
  const { plan, figures, status, next } = summary;
  const live = status === 'active';
  const stacked = useStacked({ minor: figures.remainingMinor, currency: plan.currency });
  const count = t('installments.row.count', { count: plan.count });
  const financed = plan.interestMinor + plan.feeMinor + plan.taxMinor > 0;
  const recorded = t('installments.row.recorded', { count: figures.recognisedCount, total: plan.count });
  const state = status === 'completed' ? t('installments.row.completed') : status === 'cancelled' ? t('installments.row.cancelled')
    : next ? t('installments.row.next', { date: relativeDate(next.billingDateISO, day) }) : null;
  const spokenState = status === 'completed' ? t('installments.row.completed') : status === 'cancelled' ? t('installments.row.cancelled')
    : next ? t('installments.row.nextSpoken', { date: formatDate(next.billingDateISO, 'long') }) : null;
  const label = [plan.merchant, count, t('installments.row.recordedSpoken', { count: figures.recognisedCount, total: plan.count }),
    live ? t(financed ? 'installments.row.remainingPrincipal' : 'installments.row.remaining', { amount: spokenMoney(figures.remainingMinor, plan.currency) }) : null,
    spokenState].filter(Boolean).join(', ');
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('installments.row.openHint')}
    onPress={onPress} style={[styles.row, separator(p, last)]}>
    <MerchantBadge merchant={plan.merchant} category={plan.category} />
    <View style={[styles.body, stacked ? styles.stacked : null]}>
      <View style={[styles.text, stacked ? null : { flex: 1 }]}>
        <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{plan.merchant}</AppText>
        <AppText secondary variant="footnote">{count + ' · ' + recorded}</AppText>
        {!!state && <AppText variant="footnote" style={{ color: live ? p.secondary : p.tertiary, fontWeight: live ? '400' : '600' }}>{state}</AppText>}
      </View>
      {live && <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', maxWidth: stacked ? '100%' : '56%' }}>
        <Money minor={figures.remainingMinor} currency={plan.currency} />
        <AppText secondary variant="caption">{t(financed ? 'installments.row.remainingPrincipalCaption' : 'installments.row.remainingCaption')}</AppText>
      </View>}
    </View>
    <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />
  </PressFeedback>;
}

/** 24UX6D: the plan detail's progress, flat on the canvas under the hero: a bar of its schedule, «3 de 12 registradas»
 * (the domain's recognised count, never «pagadas»: a card payment is not assigned to an instalment), the next instalment's
 * statement and, while the plan is live, the principal still to come («restantes»; «principal restante» with interest),
 * as PlanRow names them. The amount moves under the count when it would not fit beside it (never smaller, never cut).
 * One VoiceOver element: the count, the spoken amount and the date written out; the bar is drawing only. */
export function PlanProgressSummary({ summary, rows }: { summary: PlanSummary; rows: readonly PlanScheduleRow[] }) {
  const p = usePalette();
  const day = useCurrentDay();
  const { t, spokenMoney, relativeDate, formatDate, speechLanguage } = useI18n();
  const { plan, figures, status, next } = summary;
  const progress = planProgress(summary, rows);
  const live = status === 'active';
  const financed = plan.interestMinor + plan.feeMinor + plan.taxMinor > 0;
  const stacked = useStacked({ minor: figures.remainingMinor, currency: plan.currency });
  const count = t('installments.detail.progress', { count: progress.recognisedCount, total: progress.total });
  const nextLine = live && next ? t('installments.row.next', { date: relativeDate(next.billingDateISO, day) }) : null;
  const label = [count, live ? t(financed ? 'installments.row.remainingPrincipal' : 'installments.row.remaining', { amount: spokenMoney(figures.remainingMinor, plan.currency) }) : null,
    live && next ? t('installments.row.nextSpoken', { date: formatDate(next.billingDateISO, 'long') }) : null].filter(Boolean).join(', ');
  return <View accessible accessibilityLabel={label} accessibilityLanguage={speechLanguage} style={{ gap: 12 }}>
    <PlanBar progress={progress} />
    <View style={[styles.body, { alignItems: 'flex-start' }, stacked ? styles.stacked : null]}>
      <View style={[styles.text, stacked ? null : { flex: 1 }]}>
        <AppText style={{ fontWeight: '600' }}>{count}</AppText>
        {!!nextLine && <AppText secondary variant="footnote">{nextLine}</AppText>}
      </View>
      {live && <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', maxWidth: stacked ? '100%' : '56%' }}>
        <Money minor={figures.remainingMinor} currency={plan.currency} />
        <AppText secondary variant="caption">{t(financed ? 'installments.row.remainingPrincipalCaption' : 'installments.row.remainingCaption')}</AppText>
      </View>}
    </View>
  </View>;
}

/** The fill of one instalment's segment: ink for a recognised one, amber for a partly undone one, an amber outline for
 * an undone one, a solid tertiary outline (empty) for one still to come and a dashed one for a cancelled one. Outlines
 * use the tertiary ink, which stands out from the canvas in both themes (24UX6D review: the line colour did not), and
 * filled versus outlined tells recorded from still to come without colour. Meaning is in the words; the drawing only
 * follows the Calendario's states. */
function segmentStyle(p: Palette, state: ScheduleRowState) {
  return state === 'recognised' ? { backgroundColor: p.text } : state === 'partial' ? { backgroundColor: p.warning }
    : state === 'undone' ? { backgroundColor: p.warningSoft, borderWidth: 1.5, borderColor: p.warning }
    : state === 'cancelled' ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: p.tertiary, borderStyle: 'dashed' as const }
    : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: p.tertiary };
}

/** One segment per instalment up to `PLAN_SEGMENT_MAX` (4 pt apart up to 12, 2 pt beyond), else one continuous bar on a
 * tertiary outline; 8 pt tall. Static: the plan detail opens on its values (no fill animation to sit through). */
function PlanBar({ progress }: { progress: PlanProgress }) {
  const p = usePalette();
  const { segments, fraction } = progress;
  if (!segments) return <View style={[styles.bar, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: p.tertiary }]}>
    <View style={{ height: '100%', width: `${fraction * 100}%`, borderRadius: 4, backgroundColor: p.text }} />
  </View>;
  return <View style={{ flexDirection: 'row', gap: segments.length > 12 ? 2 : 4 }}>
    {segments.map((state, index) => <View key={index} style={[styles.segment, segmentStyle(p, state)]} />)}
  </View>;
}

const STATE_GLYPH: Record<ScheduleRowState, IconName> = {
  recognised: 'checkmark-circle', partial: 'checkmark-circle-outline', next: 'radio-button-on', future: 'ellipse-outline', undone: 'arrow-undo-circle-outline',
  cancelled: 'remove-circle-outline',
};
function stateColor(p: Palette, state: ScheduleRowState): string {
  return state === 'next' ? p.text : state === 'recognised' ? p.secondary : state === 'undone' || state === 'partial' ? p.warning : p.tertiary;
}

/** One instalment of a plan's Calendario: «Cuota 3 de 12», the statement it belongs to (its closing) and that
 * statement's due date, what it charges and its state (Registrada, Registrada en parte, Próxima, Futura, Deshecha,
 * Cancelada). Each share has its own movement: when the person undid only one of them, the row says what still counts.
 * A row whose movement exists (recorded, partial or undone) opens that movement. `financing` names the extra share:
 * interest only, or a mix. */
export function ScheduleRow({ row, count, currency, financing, onPress, last = false }: {
  row: PlanScheduleRow; count: number; currency: Currency; financing: 'interest' | 'financing'; onPress?: () => void; last?: boolean;
}) {
  const p = usePalette();
  const day = useCurrentDay();
  const { t, moneyText, spokenMoney, relativeDate, formatDate, speechLanguage } = useI18n();
  const stacked = useStacked({ minor: row.totalMinor, currency });
  const title = t('installments.schedule.number', { number: row.number, count });
  const state = t(`installments.schedule.${row.state}`);
  const dates = t('installments.schedule.dates', { closing: relativeDate(row.billingDateISO, day, true), due: relativeDate(row.dueDateISO, day, true) });
  const spokenDates = t('installments.schedule.datesSpoken', { closing: formatDate(row.billingDateISO, 'long'), due: formatDate(row.dueDateISO, 'long') });
  const extraKey = financing === 'interest' ? 'installments.schedule.interest' : 'installments.schedule.financing';
  const extra = row.financingMinor > 0 ? t(extraKey, { amount: moneyText(row.financingMinor, currency) }) : null;
  const spokenExtra = row.financingMinor > 0 ? t(extraKey, { amount: spokenMoney(row.financingMinor, currency) }) : null;
  const partial = row.state === 'partial' ? t('installments.schedule.partialDetail', { counted: moneyText(row.recognisedMinor, currency), undone: moneyText(row.undoneMinor, currency) }) : null;
  const spokenPartial = row.state === 'partial' ? t('installments.schedule.partialDetail', { counted: spokenMoney(row.recognisedMinor, currency), undone: spokenMoney(row.undoneMinor, currency) }) : null;
  const label = [title, spokenMoney(row.totalMinor, currency), state, spokenPartial, spokenDates, spokenExtra].filter(Boolean).join(', ');
  const faded = row.state === 'undone' || row.state === 'cancelled';
  const content = <>
    <View style={styles.glyph}><Ionicons name={STATE_GLYPH[row.state]} size={20} color={stateColor(p, row.state)} accessible={false} /></View>
    <View style={[styles.body, stacked ? styles.stacked : null]}>
      <View style={[styles.text, stacked ? null : { flex: 1 }]}>
        <AppText style={{ fontWeight: '500' }}>{title}</AppText>
        <AppText secondary variant="footnote">{dates}</AppText>
        {!!extra && <AppText tertiary variant="footnote">{extra}</AppText>}
        {!!partial && <AppText variant="footnote" style={{ color: p.warning }}>{partial}</AppText>}
      </View>
      <View style={{ alignItems: stacked ? 'flex-start' : 'flex-end', maxWidth: stacked ? '100%' : '56%' }}>
        <Money minor={row.totalMinor} currency={currency} color={faded ? p.tertiary : undefined} />
        <AppText variant="caption" style={{ color: stateColor(p, row.state), fontWeight: row.state === 'next' ? '600' : '500' }}>{state}</AppText>
      </View>
    </View>
    {onPress && <Ionicons name="chevron-forward" size={16} color={p.tertiary} accessible={false} />}
  </>;
  return onPress ? <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('installments.schedule.openHint')}
    onPress={onPress} style={[styles.row, separator(p, last)]}>{content}</PressFeedback>
    : <View accessible accessibilityLabel={label} accessibilityLanguage={speechLanguage} style={[styles.row, separator(p, last)]}>{content}</View>;
}

function separator(p: Palette, last: boolean) {
  return { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  body: { flex: 1, minWidth: 0, gap: 8, flexDirection: 'row', alignItems: 'center' },
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  text: { minWidth: 0, gap: 3 },
  glyph: { width: 28, alignItems: 'center' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  segment: { flex: 1, height: 8, borderRadius: 3 },
  swatch: { width: 40, height: 26, borderRadius: radius.tile / 2, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
});
