import { useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { recurringNeedsReview } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountBadge, ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, IconButton, LifecycleNote, MerchantBadge, Money, Screen, Surface } from '../../src/ui/components';
import { presentedAmount } from '../../src/ui/movement-amount';
import { useRecurringManagement } from '../../src/ui/commitment-actions';
import { useCategoryLook } from '../../src/ui/category-hues';
import { RecurringHistory } from '../../src/ui/recurring-history';
import { withCurrencyCode } from '../../src/i18n/format';
import { useI18n } from '../../src/i18n/provider';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

/** A recurring rule as a financial object (25B3), read before it is edited, like a movement, an account, a card
 * or a debt: who is paid and how much (the hero), its state (Activo, Pausado, Revisar), then only facts the rule
 * stores (the next date, the frequency, the category, the account or card it posts to), what it actually recorded
 * («Registrados», 24UX2) and its lifecycle (24UX4: Pausar/Reanudar and Eliminar, the same rules and confirmations
 * as the row's swipe). Editar, in the header, opens the form. A scheduled date is an estimate, never a payment.
 * 24UX6E: why a rule is paused, closed or under review sits right under the hero (the shared lifecycle note, as a
 * card's), not below its history; in review, «Continuar desde hoy» follows the note, so the problem and its fix
 * share the first screenful. A rule on a deleted account or card says «Cuenta eliminada» / «Tarjeta eliminada». */
export default function RecurringDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const { t, relativeDate, formatDate } = useI18n();
  const manage = useRecurringManagement();
  const rule = archive?.recurring?.find(item => item.id === id);
  const account = snapshot?.accounts.find(item => item.id === rule?.accountId);
  const category = useCategoryLook(rule?.category ?? '', rule?.kind ?? 'expense').label;
  // A deleted rule opens as not found; one this screen has ever shown live (the ledger may hydrate after the screen
  // mounts) stays drawn, without Editar or actions, while the screen closes after its own deletion. Keyed by id; set
  // during render, React's pattern for information from previous renders.
  const [seenLiveId, setSeenLiveId] = useState<string | null>(null);
  if (rule && !rule.deleted && seenLiveId !== rule.id) setSeenLiveId(rule.id);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/recurring'); };

  if (!snapshot || !archive || !rule || !account || (rule.deleted && seenLiveId !== rule.id)) return <Screen>
    <EmptyState title={t('recurring.edit.notFoundTitle')} detail={t('recurring.edit.notFoundDetail')} icon="repeat-outline" />
  </Screen>;

  const income = rule.kind === 'income';
  // 25B2: a rule whose account or card was deleted is paused and never resumed onto the closed row; its lifecycle here offers
  // Eliminar only. Editar stays: the form offers a live account or card of the same currency (the recovery path); once the
  // rule sits on one it is no longer closed, still paused, and Reanudar comes back (resume never records the backlog).
  const closed = manage.closed(rule);
  const review = !closed && recurringNeedsReview(rule, day);
  const card = archive.cards?.find(item => item.accountId === account.id);
  const busy = manage.busyId === rule.id;
  // 24UX6E: the row's words: a closed rule names what was deleted, calm (secondary, 400), never «Pausado».
  const state = closed ? t(card ? 'recurring.row.closedCard' : 'recurring.row.closed') : !rule.active ? t('recurring.row.paused')
    : review ? t('recurring.row.review') : t('recurring.detail.active');
  // VoiceOver reads the next date written out ("1 de octubre de 2026"); a relative word (Hoy) stays as it is (card-panel's rule).
  const nextShown = relativeDate(rule.nextDateISO, day);
  const nextSpoken = nextShown === formatDate(rule.nextDateISO, 'day') || nextShown === formatDate(rule.nextDateISO, 'dayYear') ? formatDate(rule.nextDateISO, 'long') : nextShown;
  // 24UX6E: why, right under the state it explains. Closed wins over paused (an old or imported rule may be closed yet
  // still active); review only for a live rule. No title (the state word is right above) and no live region (the state is one).
  const note = rule.deleted ? null
    : closed ? <LifecycleNote icon="unlink-outline" detail={t('recurring.manage.closedNote')} />
    : !rule.active ? <LifecycleNote icon="pause-circle-outline" detail={t('recurring.manage.pausedNote')} />
    : review ? <LifecycleNote icon="alert-circle-outline" tone="warning" detail={t('recurring.manage.reviewNote', { date: formatDate(rule.nextDateISO, 'long') })} />
    : null;
  const recover = review && !rule.deleted;

  return <Screen gap={space.xl}>
    {/* A durable write in flight (pause, resume, the confirmed deletion) holds the screen, as the movement detail does: no
        native back, no back swipe, Editar disabled; success or failure gives navigation back. A deletion pops exactly once. */}
    <Stack.Screen options={{ title: rule.merchant, gestureEnabled: !busy, headerBackVisible: !busy,
      headerRight: rule.deleted ? undefined : () => <IconButton name="create-outline" label={t('recurring.detail.edit')} disabled={busy}
        onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })} /> }} />
    <View style={{ gap: space.l }}>
      {/* Identity (the mark) → the amount, shown like its row (24UX6C: «+» on an income, no sign on an expense) → the state. The merchant is the header's title. */}
      <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
        <MerchantBadge merchant={rule.merchant} category={rule.category} kind={rule.kind} large tone={income ? 'income' : 'neutral'} />
        <AppText secondary variant="footnote" style={{ fontWeight: '500', textAlign: 'center' }}>{withCurrencyCode(t(income ? 'recurring.form.incomeAmount' : 'recurring.form.expenseAmount'), account.currency)}</AppText>
        <Money minor={rule.amountMinor} currency={account.currency} large size={40} align="center" signed={presentedAmount(rule.kind, rule.amountMinor).signed} tone={rule.kind} />
        <AppText accessibilityLiveRegion="polite" variant="subhead" style={{ color: review ? p.warning : p.secondary, fontWeight: review ? '600' : '400', textAlign: 'center' }}>{state}</AppText>
      </View>
      {note}
      {/* 24UX5: a rule the catch-up set aside. Continuing is resume from today: the backlog is never recorded. 24UX6E: right
          under its explanation; while it is here, the one error line is under it too (a failed Pausar says so here as well). */}
      {recover && <ActionButton label={t('recurring.manage.continueFromToday')} icon="play-forward-outline" busy={busy} onPress={() => { void manage.resume(rule); }} />}
      {recover && <ErrorMessage message={manage.error} />}
    </View>
    <Surface grouped>
      {/* 24UX2: a paused rule never announces a next date; resuming recomputes it from today. */}
      {/* 24UX6E: a closed rule never records again, so it announces no next date either (24UX2's paused rule). */}
      {rule.active && !closed && <DetailRow label={t('recurring.form.nextDate')} value={nextShown} spokenValue={nextSpoken} icon="calendar-outline" tone={review ? 'warning' : 'neutral'} />}
      <DetailRow label={t('recurring.form.frequency')} value={t(`recurring.frequency.${rule.frequency}`)} icon="repeat-outline" />
      <DetailRow label={t('selection.category')} value={category} icon="pricetag-outline" />
      <DetailRow label={t(card ? 'entryDetail.card' : 'selection.account')} value={account.name} icon={card ? 'card-outline' : 'wallet-outline'}
        leading={card ? undefined : <AccountBadge accountId={account.id} size={28} />} last disabled={busy}
        onPress={() => router.push(card ? { pathname: '/card/[id]', params: { id: card.id } } : { pathname: '/account/[id]', params: { id: account.id } })} />
    </Surface>
    <RecurringHistory ruleId={rule.id} ruleAccountId={rule.accountId} />
    {/* 24UX4: the same actions as the row's swipe, named. Pausing or resuming keeps this screen (the state above
        says so); deleting asks first and goes back. A rule already deleted (this screen is closing) offers nothing. */}
    {!rule.deleted && <View style={{ gap: space.m }}>
      {!recover && <ErrorMessage message={manage.error} />}
      {!closed && <ActionButton secondary label={t(rule.active ? 'recurring.manage.pauseRule' : 'recurring.manage.resumeRule')}
        icon={rule.active ? 'pause-outline' : 'play-outline'} busy={busy} onPress={() => { void (rule.active ? manage.pause : manage.resume)(rule); }} />}
      <ActionButton secondary tone="expense" label={t('recurring.manage.deleteRule')} icon="trash-outline" disabled={busy}
        onPress={() => manage.remove(rule, back)} />
    </View>}
  </Screen>;
}
