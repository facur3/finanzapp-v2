import { View } from 'react-native';
import { router } from 'expo-router';
import { todayKey, type ReviewArchive } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import type { ReviewItem } from '../src/storage/review-database';
import { AppText, EmptyState, GlyphTile, LifecycleNote, Money, PressFeedback, Screen, Surface } from '../src/ui/components';
import { useAccountNameOf, useCategoryLabel } from '../src/ui/category-hues';
import { reviewFacts, stateTone, type ReviewContext, type ReviewFacts } from '../src/ui/review-presentation';
import { space, usePalette } from '../src/ui/theme';
import { useI18n } from '../src/i18n/provider';

/** Producto 25A-03, «Para revisar»: the pending proposals of the review store (25A-02), oldest first (the store's order),
 * each row saying what it would record and what it still lacks. A row opens the proposal's detail, where it is confirmed,
 * edited or discarded; nothing on this screen writes. An unreadable row is never listed as a proposal: one quiet line
 * counts them. Reached from Más (and the dock's Más badge); never a tab, never on Inicio. */
export default function ReviewScreen() {
  const { review, archive } = useLedger();
  const { t } = useI18n();
  if (!archive || review === null) return <Screen>{null}</Screen>;
  if (review === 'unavailable') return <Screen><EmptyState icon="file-tray-outline" title={t('nav.titles.review')} detail={t('review.unavailable')} /></Screen>;
  const context: ReviewContext = { todayISO: todayKey(), writable: review.writable, conflicts: review.conflicts };
  return <Screen gap={space.l}>
    {review.items.length > 0 && <AppText secondary variant="subhead">{t('review.header')}</AppText>}
    {!review.writable && <LifecycleNote icon="lock-closed-outline" detail={t('review.readOnly')} />}
    {review.items.length ? <Surface grouped>
      {review.items.map((item, index) => <ReviewRow key={item.id} item={item} facts={reviewFacts(item, archive as ReviewArchive, context)}
        last={index === review.items.length - 1} />)}
    </Surface> : <EmptyState icon="file-tray-outline" title={t('review.emptyTitle')} detail={t('review.emptyDetail')} />}
    {review.unreadable.length > 0 && <AppText secondary variant="footnote">{t('review.unreadable', { count: review.unreadable.length })}</AppText>}
  </Screen>;
}

/** One proposal: the kind's glyph, the merchant (or that it is missing), the amount in its currency (or that it is missing),
 * then category, where it is recorded, the day, the purchase mode on a card, and what the proposal needs. VoiceOver reads
 * the row as one sentence, every amount and date in its spoken form. */
function ReviewRow({ item, facts, last }: { item: ReviewItem; facts: ReviewFacts; last: boolean }) {
  const p = usePalette();
  const { t, formatDate, spokenMoney, speechLanguage } = useI18n();
  const categoryLabel = useCategoryLabel(facts.category ?? '', facts.kind ?? 'expense');
  const nameOf = useAccountNameOf();
  const missing = t('review.missing');
  const kind = t(facts.kind === null ? 'review.kind.unknown' : `review.kind.${facts.kind}`);
  const purchase = facts.purchase === null ? null : facts.purchase.mode === 'once' ? t('review.purchase.once')
    : facts.purchase.count === null ? t('review.purchase.installmentsOpen') : t('review.purchase.installments', { count: facts.purchase.count });
  const destination = facts.destination ? nameOf(facts.destination) : missing;
  const state = facts.state === 'incomplete' ? t('review.state.incomplete', { count: facts.gaps.length }) : t(`review.state.${facts.state}`);
  const tone = stateTone(facts.state);
  const stateColor = tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.secondary;
  const facts1 = [kind, facts.category ? categoryLabel : missing, destination].join(' · ');
  const facts2 = [facts.dateISO ? formatDate(facts.dateISO, 'day') : missing, purchase, t(`review.source.${item.source}`)].filter(Boolean).join(' · ');
  const spoken = [kind, facts.amount ? spokenMoney(facts.amount.minor, facts.amount.currency) : t('review.noAmount'), facts.merchant ?? t('review.noMerchant'),
    facts.category ? categoryLabel : t('review.fields.category') + ': ' + missing, t('review.fields.destination') + ': ' + destination,
    facts.dateISO ? formatDate(facts.dateISO, 'long') : t('review.fields.date') + ': ' + missing, purchase, t(`review.source.${item.source}`), state].filter(Boolean).join(', ');
  return <PressFeedback feedback="highlight" accessibilityRole="button" accessibilityLabel={spoken} accessibilityLanguage={speechLanguage}
    onPress={() => router.push({ pathname: '/review/[id]', params: { id: item.id } })}
    style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, minHeight: 64, borderBottomColor: p.line, borderBottomWidth: last ? 0 : 0.5 }}>
    <GlyphTile icon={facts.kind === 'income' ? 'arrow-down' : facts.kind === 'expense' ? 'arrow-up' : 'help'} tone={facts.kind === 'income' ? 'income' : 'neutral'} />
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText numberOfLines={1} style={{ flex: 1, fontWeight: '600', color: facts.merchant ? p.text : p.secondary }}>{facts.merchant ?? t('review.noMerchant')}</AppText>
        {facts.amount ? <Money minor={facts.amount.minor} currency={facts.amount.currency} signed={facts.kind === 'income'} tone={facts.kind === 'income' ? 'income' : 'neutral'} />
          : <AppText secondary variant="subhead">{t('review.noAmount')}</AppText>}
      </View>
      <AppText secondary variant="footnote" numberOfLines={2}>{facts1}</AppText>
      <AppText secondary variant="footnote" numberOfLines={2}>{facts2}</AppText>
      <AppText variant="footnote" style={{ color: stateColor, fontWeight: '600' }}>{state}</AppText>
    </View>
  </PressFeedback>;
}
