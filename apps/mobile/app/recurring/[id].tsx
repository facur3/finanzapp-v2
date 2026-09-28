import { useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { recurringNeedsReview } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AccountBadge, ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, IconButton, MerchantBadge, Money, Screen, Surface } from '../../src/ui/components';
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
 * as the row's swipe). Editar, in the header, opens the form. A scheduled date is an estimate, never a payment. */
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
  const review = recurringNeedsReview(rule, day);
  // 25B2: a rule whose account or card was deleted is paused for good; it can only be deleted (never resumed onto a closed row).
  const closed = manage.closed(rule);
  const card = archive.cards?.find(item => item.accountId === account.id);
  const busy = manage.busyId === rule.id;
  const state = !rule.active ? t('recurring.row.paused') : review ? t('recurring.row.review') : t('recurring.detail.active');

  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: rule.merchant,
      headerRight: rule.deleted ? undefined : () => <IconButton name="create-outline" label={t('recurring.detail.edit')} disabled={busy}
        onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })} /> }} />
    {/* Identity (the mark) → the amount, signed like its row → the state. The merchant is the header's title. */}
    <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
      <MerchantBadge merchant={rule.merchant} category={rule.category} kind={rule.kind} large tone={income ? 'income' : 'neutral'} />
      <AppText secondary variant="footnote" style={{ fontWeight: '500', textAlign: 'center' }}>{withCurrencyCode(t(income ? 'recurring.form.incomeAmount' : 'recurring.form.expenseAmount'), account.currency)}</AppText>
      <Money minor={income ? rule.amountMinor : -rule.amountMinor} currency={account.currency} large size={40} align="center" signed tone={income ? 'income' : 'expense'} />
      <AppText accessibilityLiveRegion="polite" variant="subhead" style={{ color: review ? p.warning : p.secondary, fontWeight: review ? '600' : '400', textAlign: 'center' }}>{state}</AppText>
    </View>
    <Surface grouped>
      {/* 24UX2: a paused rule never announces a next date; resuming recomputes it from today. */}
      {rule.active && <DetailRow label={t('recurring.form.nextDate')} value={relativeDate(rule.nextDateISO, day)} icon="calendar-outline" tone={review ? 'warning' : 'neutral'} />}
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
      <ErrorMessage message={manage.error} />
      {!rule.active && <AppText secondary variant="footnote">{t(closed ? 'recurring.manage.closedNote' : 'recurring.manage.pausedNote')}</AppText>}
      {/* 24UX5: a rule the catch-up set aside. Continuing is resume from today: the backlog is never recorded. */}
      {review && !closed && <>
        <AppText variant="footnote" style={{ color: p.warning, fontWeight: '500' }}>{t('recurring.manage.reviewNote', { date: formatDate(rule.nextDateISO, 'long') })}</AppText>
        <ActionButton label={t('recurring.manage.continueFromToday')} icon="play-forward-outline" busy={busy} onPress={() => { void manage.resume(rule); }} />
      </>}
      {!closed && <ActionButton secondary label={t(rule.active ? 'recurring.manage.pauseRule' : 'recurring.manage.resumeRule')}
        icon={rule.active ? 'pause-outline' : 'play-outline'} busy={busy} onPress={() => { void (rule.active ? manage.pause : manage.resume)(rule); }} />}
      <ActionButton secondary tone="expense" label={t('recurring.manage.deleteRule')} icon="trash-outline" disabled={busy}
        onPress={() => manage.remove(rule, back)} />
    </View>}
  </Screen>;
}
