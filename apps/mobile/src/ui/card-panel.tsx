import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { withCurrencyCode } from '../i18n/format';
import { useI18n } from '../i18n/provider';
import { AppText, Money, PressFeedback, Stat, StatRow, toneColors } from './components';
import { daysUntil, usageTone, type CardSummary } from './liability-presentation';
import { Reflow, timing, ValueTransition } from './motion';
import { usePalette, useReduceMotion } from './theme';

/** Producto 24T2: what Tarjetas' snapshot and a card's detail both show, in the same words and the same order. */

/** «Saldo pendiente · ARS» and the whole recorded card liability as the hero; a balance in the person's favour, or the
 * line that says nothing is owed. Never «Deuda», never a statement amount. */
export function CardBalance({ summary }: { summary: CardSummary }) {
  const p = usePalette();
  const { t, moneyText, spokenMoney } = useI18n();
  const { account, debtMinor, creditMinor } = summary;
  return <View style={{ gap: 6 }}>
    <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{withCurrencyCode(t('cards.panel.recordedDebt'), account.currency)}</AppText>
    <Money minor={debtMinor} currency={account.currency} large size={40} />
    {creditMinor > 0 ? <AppText variant="footnote" style={{ color: p.income, fontWeight: '600' }}
      accessibilityLabel={t('cards.panel.credit', { amount: spokenMoney(creditMinor, account.currency) })}>
      {t('cards.panel.credit', { amount: moneyText(creditMinor, account.currency) })}</AppText>
      : debtMinor === 0 && <AppText secondary variant="footnote">{t('cards.panel.noDebt')}</AppText>}
  </View>;
}

/** Three facts, never merged: «Vence» (the next due date, which may belong to the statement that already closed; amber
 * when it is three days away or less and something is owed), «Cierra» (the next closing) and «Disponible» (the figure
 * when it is known; «Sin límite cargado»; or «No calculado con cuotas» while a plan is pending, with the reason one tap
 * away). The usage bar only with a known figure. `limitCaption` adds «de $ límite» under Disponible (the card detail).
 *
 * 24UX6D: the two dates share a row and Disponible has the full width under them, with its bar. In three equal columns
 * an available credit of seven digits (an everyday ARS limit) did not fit its third at 375 pt and was drawn smaller to
 * fit; on its own row an exact amount keeps the row size, and «No calculado con cuotas» reads on one line. The dates
 * still stack at large text (`StatRow`). Flat on the canvas with the balance, as one calm block: no surface of its own. */
export function CardFacts({ summary, day, limitCaption = false }: { summary: CardSummary; day: string; limitCaption?: boolean }) {
  const p = usePalette();
  const { t, relativeDate, formatDate, moneyText, spokenMoney } = useI18n();
  const { card, account, debtMinor, availableMinor, availability, usage, closingISO, nextDueISO } = summary;
  const dueSoon = debtMinor > 0 && daysUntil(nextDueISO, day) <= 3;
  const shown = (iso: string) => relativeDate(iso, day);
  // VoiceOver reads a date written out ("5 de octubre de 2026"); a relative word (Hoy) stays as it is.
  const spoken = (iso: string) => { const text = relativeDate(iso, day); return text === formatDate(iso, 'day') || text === formatDate(iso, 'dayYear') ? formatDate(iso, 'long') : text; };
  const tone = usageTone(usage);
  const percent = Math.round(Math.min(usage ?? 0, 9.99) * 100);
  return <View style={{ gap: 14 }}>
    <StatRow>
      <Stat label={t('cards.panel.due')}>
        <AppText accessibilityLabel={spoken(nextDueISO)} style={{ fontWeight: '600', color: dueSoon ? p.warning : p.text }}>{shown(nextDueISO)}</AppText>
      </Stat>
      <Stat label={t('cards.panel.closing')}>
        <AppText accessibilityLabel={spoken(closingISO)} style={{ fontWeight: '600' }}>{shown(closingISO)}</AppText>
      </Stat>
    </StatRow>
    <View style={{ gap: 8 }}>
      <Stat label={t('cards.panel.available')}>
        {availability === 'known' && availableMinor !== null
          ? <Money minor={availableMinor} currency={account.currency} size={17} color={availableMinor < 0 ? p.expense : tone === 'warning' ? p.warning : undefined} />
          : availability === 'unknownWithPlans' ? <UnknownAvailable />
          : <AppText secondary variant="subhead">{t('cards.panel.noLimitLoaded')}</AppText>}
        {limitCaption && card.creditLimitMinor !== null && <AppText tertiary variant="caption"
          accessibilityLabel={t('cards.panel.ofLimit', { amount: spokenMoney(card.creditLimitMinor, account.currency) })}>
          {t('cards.panel.ofLimit', { amount: moneyText(card.creditLimitMinor, account.currency) })}</AppText>}
      </Stat>
      {availability === 'known' && usage !== null && card.creditLimitMinor !== null && <UsageBar usage={usage} tone={tone}
        label={t('cards.panel.usage', { percent, limit: moneyText(card.creditLimitMinor, account.currency) })}
        spokenLabel={t('cards.panel.usage', { percent, limit: spokenMoney(card.creditLimitMinor, account.currency) })} />}
    </View>
  </View>;
}

/** 24UX6D: the balance and the three facts as one calm block on the canvas, the order every card surface reads in:
 * «Saldo pendiente» (the hero), then Vence · Cierra, then Disponible. `animated` keys the block by the card (Tarjetas: the
 * values crossfade when another card comes forward, and the facts slide when their height changes). */
export function CardStatusBlock({ summary, day, limitCaption = false, animated = false }: { summary: CardSummary; day: string; limitCaption?: boolean; animated?: boolean }) {
  const facts = <CardFacts summary={summary} day={day} limitCaption={limitCaption} />;
  return <View style={{ gap: 20 }}>
    {/* 25UX1: when another card is selected, its figures replace the old ones at once and fade or rise in; another card's
        balance, dates or available amount are never on screen beside them. */}
    {animated ? <ValueTransition id={summary.card.id} exit={false}><CardBalance summary={summary} /></ValueTransition> : <CardBalance summary={summary} />}
    {animated ? <Reflow><ValueTransition id={summary.card.id} variant="fade" exit={false}>{facts}</ValueTransition></Reflow> : facts}
  </View>;
}

/** 24UX6D: an archived or deleted card says so right under its face, legible and calm (no alarm colour): a glyph, the
 * state and what it still does. Archived: it still takes payments and records its instalments, and Editar tarjeta
 * reactivates it. Deleted: it only reads. An active card shows nothing. */
export function CardLifecycleNote({ state }: { state: 'archived' | 'deleted' }) {
  const p = usePalette();
  const { t } = useI18n();
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
    <Ionicons name={state === 'deleted' ? 'trash-outline' : 'archive-outline'} size={18} color={p.secondary} accessible={false} style={{ marginTop: 1 }} />
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <AppText variant="subhead" style={{ fontWeight: '600' }}>{t(state === 'deleted' ? 'cards.panel.deletedTitle' : 'cards.panel.archivedTitle')}</AppText>
      <AppText secondary variant="footnote">{t(state === 'deleted' ? 'cards.panel.deletedDetail' : 'cards.panel.archivedDetail')}</AppText>
    </View>
  </View>;
}

/** «No calculado con cuotas» with its information glyph inline, so the words wrap as one line of text in a narrow
 * column; tapping it explains why (the same alert an information button opens). */
function UnknownAvailable() {
  const p = usePalette();
  const { t } = useI18n();
  const title = t('cards.panel.availableInfoTitle');
  return <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('cards.panel.availableUnknown')}
    accessibilityHint={t('common.moreInfoAbout', { title: title.toLowerCase() })}
    onPress={() => Alert.alert(title, t('cards.panel.availableInfoDetail'), [{ text: t('common.ok'), style: 'cancel' }])} style={{ minHeight: 44, justifyContent: 'flex-start' }}>
    <AppText secondary variant="subhead">{t('cards.panel.availableUnknown')}{' '}
      <Ionicons name="information-circle-outline" size={15} color={p.tertiary} accessible={false} /></AppText>
  </PressFeedback>;
}

/** The share of the limit used, as a bar and a caption. VoiceOver reads the caption as `spokenLabel`: the limit with the
 * language's decimal mark and its currency in words. The bar moves between real values (260 ms; none with Reduce Motion). */
export function UsageBar({ usage, tone, label, spokenLabel }: { usage: number; tone: 'neutral' | 'warning' | 'expense'; label: string; spokenLabel: string }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(Math.min(1, usage));
  useEffect(() => { progress.value = withTiming(Math.min(1, usage), timing('data', reduced)); }, [usage, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const fill = tone === 'neutral' ? p.text : toneColors(p, tone).color;
  return <View style={{ gap: 6 }}>
    <View accessible={false} style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: p.inset }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: fill }, bar]} />
    </View>
    <AppText secondary variant="caption" accessibilityLabel={spokenLabel} style={tone !== 'neutral' ? { color: toneColors(p, tone).color, fontWeight: '500' } : undefined}>{label}</AppText>
  </View>;
}
