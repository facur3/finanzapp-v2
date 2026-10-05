import { useRef, useState, type MutableRefObject } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { todayKey, type ReviewArchive } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import type { ReviewItem } from '../../src/storage/review-database';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, LifecycleNote, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { useAccountNameOf, useCategoryLabel } from '../../src/ui/category-hues';
import { reviewFacts, stateTone, type ReviewFacts } from '../../src/ui/review-presentation';
import { space, usePalette } from '../../src/ui/theme';
import { useI18n } from '../../src/i18n/provider';

/** Producto 25A-03: one pending proposal, the authoritative review surface. What Confirmar would record, where and when,
 * on which card or account and how a card pays, each missing fact named, and a stale or conflicting state said before any
 * action. Confirmar is offered only when the domain finds no gap and a current basis (or an interrupted write waits) and
 * calls the store's one confirmation path (25A-02: the frozen write, then the ledger's own create); this screen builds no
 * write. A confirmed, dismissed or unreadable item is not here: the screen says it is no longer pending. */
export default function ReviewItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { review } = useLedger();
  const { t } = useI18n();
  const item = review && review !== 'unavailable' ? review.items.find(row => row.id === id) : undefined;
  // A proposal this screen just confirmed or dismissed leaves the tray before the screen pops: it is drawn as it was (its
  // actions held) while it leaves, never as «no longer pending». Any other disappearance says so.
  const seen = useRef<ReviewItem | undefined>(undefined);
  const leaving = useRef(false);
  if (item) seen.current = item;
  const shown = item ?? (leaving.current ? seen.current : undefined);
  if (!shown) return <Screen><EmptyState icon="file-tray-outline" title={t('review.detail.notFoundTitle')} detail={t('review.detail.notFoundDetail')} /></Screen>;
  return <ReviewDetail item={shown} leaving={leaving} />;
}

/** The shape of a store call `run` takes (an async step). */
const idle = async () => {};

function ReviewDetail({ item, leaving }: { item: ReviewItem; leaving: MutableRefObject<boolean> }) {
  const { archive, review, confirmReview, dismissReview } = useLedger();
  const p = usePalette();
  const { t, formatDate, spokenMoney, moneyText } = useI18n();
  const nameOf = useAccountNameOf();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const tray = review && review !== 'unavailable' ? review : null;
  const facts: ReviewFacts | null = archive && tray ? reviewFacts(item, archive as ReviewArchive, { todayISO: todayKey(), writable: tray.writable, conflicts: tray.conflicts }) : null;
  const categoryLabel = useCategoryLabel(item.draft.category ?? '', item.draft.kind ?? 'expense');
  if (!facts || !tray) return <Screen>{null}</Screen>;
  const missing = t('review.missing');
  const conflict = facts.state === 'conflict';

  /** One store call at a time; the revision is the one on screen, so a proposal that changed since is refused, never overwritten. */
  async function run(work: typeof idle) {
    if (working.current) return;
    working.current = true;
    leaving.current = true;
    setBusy(true);
    setError(null);
    try { await work(); } catch (cause) {
      leaving.current = false;
      setError(cause instanceof Error ? cause.message : 'review.unavailable');
    } finally {
      // Done: the screen is popping and its actions stay held. Refused: everything is offered again.
      if (!leaving.current) { working.current = false; setBusy(false); }
    }
  }
  // Opened from a link with nothing under it, the tray replaces it instead.
  const leave = () => { if (router.canGoBack()) router.back(); else router.replace('/review'); };
  const confirm = () => run(async () => {
    await confirmReview(item.id, item.revision);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    leave();
  });
  const dismiss = () => {
    if (working.current) return;
    Alert.alert(t('review.detail.dismissQuestion'), t('review.detail.dismissDetail'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('review.detail.dismiss'), style: 'destructive', onPress: () => void run(async () => {
        await dismissReview(item.id, item.revision);
        leave();
      }) },
    ], { cancelable: true });
  };

  const kindTitle = t(facts.kind === null ? 'review.kind.unknown' : `review.kind.${facts.kind}`);
  const plan = facts.purchase?.mode === 'installments' ? facts.purchase : null;
  // What Confirmar writes, said before it is pressed: a movement, or (cuotas) one plan and nothing on the purchase date.
  const will = facts.kind === null ? null : facts.kind === 'income' ? t('review.detail.willIncome')
    : plan && plan.count !== null ? t('review.detail.willPlan', { count: plan.count }) : facts.card ? t('review.detail.willCardOnce') : t('review.detail.willExpense');
  const purchase = !facts.card || facts.kind === 'income' ? null : facts.purchase === null ? missing : facts.purchase.mode === 'once' ? t('review.purchase.once')
    : facts.purchase.count === null ? t('review.purchase.installmentsOpen') : t('review.purchase.installments', { count: facts.purchase.count });
  const state = facts.state === 'incomplete' ? t('review.state.incomplete', { count: facts.gaps.length }) : t(`review.state.${facts.state}`);
  const tone = stateTone(facts.state);
  const confirmLabel = facts.state === 'interrupted' ? t('review.detail.retryConfirm') : t('review.detail.confirm');
  const confirmText = facts.amount && facts.state !== 'interrupted' ? { text: confirmLabel + ' · ' + moneyText(facts.amount.minor, facts.amount.currency),
    spoken: confirmLabel + ', ' + spokenMoney(facts.amount.minor, facts.amount.currency) } : { text: confirmLabel };

  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: kindTitle, gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: 6, alignItems: 'center', paddingVertical: 8 }}>
      {facts.amount ? <Money minor={facts.amount.minor} currency={facts.amount.currency} large align="center" signed={facts.kind === 'income'}
        tone={facts.kind === 'income' ? 'income' : 'neutral'} />
        : <AppText variant="title2" secondary style={{ textAlign: 'center' }}>{t('review.noAmount')}</AppText>}
      <AppText variant="title3" style={{ textAlign: 'center', color: facts.merchant ? p.text : p.secondary }}>{facts.merchant ?? t('review.noMerchant')}</AppText>
      <AppText accessibilityLiveRegion="polite" variant="caption" style={{ textAlign: 'center', fontWeight: '600',
        color: tone === 'expense' ? p.expense : tone === 'warning' ? p.warning : p.secondary }}>{state}</AppText>
    </View>
    {will && <AppText variant="subhead">{will}</AppText>}
    <Surface grouped>
      <DetailRow label={t('review.fields.kind')} value={facts.kind === null ? missing : kindTitle} icon="swap-vertical-outline" />
      <DetailRow label={t('review.fields.amount')} icon="cash-outline"
        value={facts.amount ? moneyText(facts.amount.minor, facts.amount.currency) : missing}
        spokenValue={facts.amount ? spokenMoney(facts.amount.minor, facts.amount.currency) : undefined} />
      <DetailRow label={t('review.fields.merchant')} value={facts.merchant ?? missing} icon="storefront-outline" />
      <DetailRow label={t('review.fields.category')} value={facts.category ? categoryLabel : missing} icon="pricetag-outline" />
      <DetailRow label={t(facts.card ? 'review.fields.card' : facts.destination ? 'review.fields.account' : 'review.fields.destination')}
        value={facts.destination ? nameOf(facts.destination) : missing} icon={facts.card ? 'card-outline' : 'wallet-outline'} />
      {purchase !== null && <DetailRow label={t('review.fields.purchase')} value={purchase} icon="layers-outline" />}
      <DetailRow label={t('review.fields.date')} icon="calendar-outline" value={facts.dateISO ? formatDate(facts.dateISO, 'dayYear') : missing}
        spokenValue={facts.dateISO ? formatDate(facts.dateISO, 'long') : undefined} />
      <DetailRow label={t('review.fields.source')} value={t(`review.source.${item.source}`)} icon="sparkles-outline" last />
    </Surface>
    {facts.gaps.length > 0 && <View>
      <SectionTitle>{t('review.detail.missingTitle')}</SectionTitle>
      {/* Neutral, never an error: a draft that lacks a fact is waiting for the person, not failing. */}
      <View style={{ gap: 10, paddingTop: 4 }}>
        {facts.gaps.map(gap => <LifecycleNote key={gap} icon="ellipse-outline" detail={t(`review.gaps.${gap}`)} />)}
      </View>
    </View>}
    {facts.state === 'conflict' && <LifecycleNote icon="alert-circle-outline" tone="warning" detail={t('review.detail.conflictNote')} />}
    {facts.state === 'interrupted' && <LifecycleNote icon="time-outline" tone="warning" detail={t('review.detail.interruptedNote')} />}
    {facts.stale && facts.state !== 'conflict' && <LifecycleNote icon="refresh-outline" tone="warning" detail={t('review.detail.staleNote')} />}
    {!tray.writable && <LifecycleNote icon="lock-closed-outline" detail={t('review.readOnly')} />}
    <ErrorMessage message={error} />
    {/* A conflict cannot be confirmed or edited (the store refuses both); it can be dismissed while no write is frozen on it. */}
    {tray.writable && <View style={{ gap: 10 }}>
      {!conflict && <ActionButton label={confirmText.text} spokenLabel={confirmText.spoken} icon="checkmark" onPress={confirm} busy={busy} disabled={!facts.canConfirm} />}
      {!conflict && <ActionButton label={t('review.detail.edit')} icon="create-outline" secondary disabled={busy}
        onPress={() => router.push({ pathname: '/edit-review/[id]', params: { id: item.id } })} />}
      {(!conflict || item.attempt === null) && <ActionButton label={t('review.detail.dismiss')} icon="close" secondary disabled={busy} onPress={dismiss} />}
    </View>}
  </Screen>;
}
