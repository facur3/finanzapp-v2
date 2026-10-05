import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { todayKey, type ReviewArchive } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import type { ReviewItem } from '../../src/storage/review-database';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, IconButton, LifecycleNote, Money, PressFeedback, Surface } from '../../src/ui/components';
import { reviewSheetScrolls } from '../../src/ui/geometry';
import { useAccountNameOf, useCategoryLabel } from '../../src/ui/category-hues';
import { reviewFacts } from '../../src/ui/review-presentation';
import { useReviewActions } from '../../src/ui/review-actions';
import { useReviewItem } from '../../src/ui/use-review-item';
import { space, usePalette } from '../../src/ui/theme';
import { useI18n } from '../../src/i18n/provider';

/** Producto 25A-04: the review sheet, the immediate confirmation surface over one pending review item. The Assistant
 * presents it right after a proposal is durably captured (the item exists before the sheet does), and any later
 * producer can present the same route for its item (25A2's Wallet capture, a future review queue).
 *
 * A native iOS form sheet (`app/_layout.tsx`: `formSheet`, fitted to its content, with a grabber; the large detent, with a
 * scrolling body, at large text sizes or on a short screen: `reviewSheetScrolls`). While Confirmar or Descartar is in
 * flight the sheet holds (no swipe, no close), and a result that arrives after it was closed closes nothing else. It reads the live item (the tray's, or the store's own when the
 * tray is stale) and shows what Confirmar records, compactly: kind and amount, merchant, category, account or card, the
 * card's purchase mode, the date, and every missing fact by name.
 *
 * - Confirmar (the one lime action) is enabled only when the domain finds no gap and a current basis, and calls the same
 *   dispatcher as «Para revisar» (`useReviewActions` → `confirmReview` → the store's frozen write): one write at most.
 * - Editar opens the «Para revisar» editor over the sheet; saving returns here, to the edited item.
 * - Descartar asks first, then pending → dismissed; the ledger is never touched.
 * - Closing (the close button «Ahora no», a swipe down, back) only dismisses the sheet: the item stays pending in «Para
 *   revisar», with the Assistant's card to reopen it. Nothing here runs on dismissal. */
export default function ReviewSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { item, resolving, refreshing, reload } = useReviewItem(id);
  // Held while Confirmar or Descartar is in flight (no swipe), owned here so it is reset whatever the content becomes.
  const [held, setHeld] = useState(false);
  // An item this sheet just confirmed or dismissed leaves the tray before the sheet is gone: it is drawn as it was, its
  // actions held, while it leaves.
  const seen = useRef<ReviewItem | undefined>(undefined);
  const leaving = useRef(false);
  // Whether this sheet is still the screen in front: a Confirmar or Descartar that finishes after the sheet was already
  // closed never closes anything else (the Assistant under it).
  // A result that lands while something covers the sheet closes it when it is in front again; once the sheet is gone,
  // nothing.
  const front = useRef(false);
  const pendingLeave = useRef(false);
  useFocusEffect(useCallback(() => {
    front.current = true;
    if (pendingLeave.current) { pendingLeave.current = false; close(); }
    return () => { front.current = false; };
  }, []));
  const leave = () => { if (front.current) close(); else pendingLeave.current = true; };
  // Only the content can hold; an empty or «not found» sheet can always be swiped away.
  const gesture = (holding: boolean) => <Stack.Screen options={{ gestureEnabled: !holding }} />;
  if (item) seen.current = item;
  const shown = item ?? (leaving.current ? seen.current : undefined);
  if (!shown && resolving) return <SheetBody>{gesture(false)}</SheetBody>;
  if (!shown) return <SheetBody>
    {gesture(false)}
    <SheetHeader title={t('review.detail.notFoundTitle')} />
    <EmptyState icon="file-tray-outline" title={t('review.detail.notFoundTitle')} detail={t('review.detail.notFoundDetail')} />
  </SheetBody>;
  return <>
    {gesture(held)}
    <ReviewSheet item={shown} leaving={leaving} reload={reload} leave={leave} refreshing={refreshing} onHeld={setHeld} />
  </>;
}

/** Closing the sheet: back to whatever presented it (the Assistant); with nothing under it, the tray. */
function close() {
  if (router.canGoBack()) router.back(); else router.replace('/review');
}

/** The sheet's content box: fitted to its content; scrolling, in the large detent, at large text sizes or on a short
 * screen (`reviewSheetScrolls`, the rule the route's registration reads too). */
function SheetBody({ children }: { children: ReactNode }) {
  const { fontScale, height } = useWindowDimensions();
  const style = { paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.xl, gap: space.l };
  return reviewSheetScrolls(fontScale, height)
    ? <ScrollView contentContainerStyle={style} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={style}>{children}</View>;
}

/** The sheet's title and its close button («Ahora no»: the item stays pending). Held while a store call is in flight. */
function SheetHeader({ title, disabled = false }: { title: string; disabled?: boolean }) {
  const { t } = useI18n();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
    <AppText accessibilityRole="header" variant="title3" style={{ flex: 1, fontWeight: '700' }}>{title}</AppText>
    <IconButton name="close" label={t('review.sheet.close')} onPress={close} disabled={disabled} />
  </View>;
}

function ReviewSheet({ item, leaving, reload, leave, refreshing, onHeld }: {
  item: ReviewItem; leaving: MutableRefObject<boolean>; reload: () => void; leave: () => void;
  /** The item is being read again (after a refusal or a change): drawn as it was, no action until the store answers. */
  refreshing: boolean;
  onHeld: (held: boolean) => void;
}) {
  const { archive, review } = useLedger();
  const p = usePalette();
  const { t, formatDate, moneyText, spokenMoney } = useI18n();
  const nameOf = useAccountNameOf();
  const categoryLabel = useCategoryLabel(item.draft.category ?? '', item.draft.kind ?? 'expense');
  const { busy, error, confirm, dismiss } = useReviewActions(item, { leaving, reload, leave });
  useEffect(() => { onHeld(busy); }, [busy]);
  useEffect(() => () => onHeld(false), []);
  const idle = busy || refreshing;
  const tray = review && review !== 'unavailable' ? review : null;
  if (!archive || !tray) return <SheetBody>{null}</SheetBody>;
  const facts = reviewFacts(item, archive as ReviewArchive, { todayISO: todayKey(), writable: tray.writable, conflicts: tray.conflicts });
  const missing = t('review.missing');
  const conflict = facts.state === 'conflict';
  const title = t(facts.kind === 'income' ? 'review.sheet.titleIncome' : facts.kind === 'expense' ? 'review.sheet.titleExpense' : 'review.sheet.titleUnknown');
  const purchase = !facts.card || facts.kind === 'income' ? null : facts.purchase === null ? missing : facts.purchase.mode === 'once' ? t('review.purchase.once')
    : facts.purchase.count === null ? t('review.purchase.installmentsOpen') : t('review.purchase.installments', { count: facts.purchase.count });
  const confirmLabel = facts.state === 'interrupted' ? t('review.detail.retryConfirm') : t('review.detail.confirm');
  const confirmText = facts.amount && facts.state !== 'interrupted' ? { text: confirmLabel + ' · ' + moneyText(facts.amount.minor, facts.amount.currency),
    spoken: confirmLabel + ', ' + spokenMoney(facts.amount.minor, facts.amount.currency) } : { text: confirmLabel };
  return <SheetBody>
    {/* While Confirmar or Descartar is in flight the sheet holds: no swipe (the screen above owns that option), no close. */}
    <SheetHeader title={title} disabled={busy} />
    <View style={{ gap: 4 }}>
      {facts.amount ? <Money minor={facts.amount.minor} currency={facts.amount.currency} size={40} weight="700" signed={facts.kind === 'income'}
        tone={facts.kind === 'income' ? 'income' : 'neutral'} />
        : <AppText variant="title2" style={{ color: p.secondary }}>{t('review.noAmount')}</AppText>}
      <AppText variant="headline" style={{ color: facts.merchant ? p.text : p.secondary }}>{facts.merchant ?? t('review.noMerchant')}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label={t('review.fields.category')} value={facts.category ? categoryLabel : missing} icon="pricetag-outline" layout="inline" />
      <DetailRow label={t(facts.card ? 'review.fields.card' : facts.destination ? 'review.fields.account' : 'review.fields.destination')}
        value={facts.destination ? nameOf(facts.destination) : missing} icon={facts.card ? 'card-outline' : 'wallet-outline'} layout="inline" />
      {purchase !== null && <DetailRow label={t('review.fields.purchase')} value={purchase} icon="layers-outline" layout="inline" />}
      <DetailRow label={t('review.fields.date')} icon="calendar-outline" value={facts.dateISO ? formatDate(facts.dateISO, 'dayYear') : missing}
        spokenValue={facts.dateISO ? formatDate(facts.dateISO, 'long') : undefined} layout="inline" last />
    </Surface>
    {/* What still blocks Confirmar, named; neutral, never an error. Editar completes it. */}
    {facts.gaps.length > 0 && <View style={{ gap: 8 }}>
      {facts.gaps.map(gap => <LifecycleNote key={gap} icon="ellipse-outline" detail={t(`review.gaps.${gap}`)} />)}
    </View>}
    {conflict && <LifecycleNote icon="alert-circle-outline" tone="warning" detail={t('review.detail.conflictNote')} />}
    {facts.state === 'interrupted' && <LifecycleNote icon="time-outline" tone="warning" detail={t('review.detail.interruptedNote')} />}
    {facts.stale && !conflict && <LifecycleNote icon="refresh-outline" tone="warning" detail={t('review.detail.staleNote')} />}
    {!tray.writable && <LifecycleNote icon="lock-closed-outline" detail={t('review.readOnly')} />}
    <ErrorMessage message={error} />
    {tray.writable && <View style={{ gap: space.s }}>
      {!conflict && <ActionButton label={confirmText.text} spokenLabel={confirmText.spoken} icon="checkmark" onPress={confirm} busy={busy} disabled={!facts.canConfirm || refreshing} />}
      {!conflict && <ActionButton label={t('review.detail.edit')} icon="create-outline" secondary disabled={idle}
        onPress={() => router.push({ pathname: '/edit-review/[id]', params: { id: item.id } })} />}
      {/* Descartar is explicit and asks first; closing the sheet is not discarding. A conflict with a frozen write cannot be
          dismissed (the store refuses it). */}
      {(!conflict || item.attempt === null) && <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('review.sheet.discard')}
        accessibilityState={{ disabled: idle }} disabled={idle} onPress={dismiss} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.m }}>
        <AppText variant="subhead" style={{ color: p.expense, fontWeight: '500' }}>{t('review.sheet.discard')}</AppText>
      </PressFeedback>}
    </View>}
    <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>{t('review.sheet.later')}</AppText>
  </SheetBody>;
}
