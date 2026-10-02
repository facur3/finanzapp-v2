import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { debtOutstandingMinor, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, GlyphTile, IconButton, LifecycleNote, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { useDebtManagement } from '../../src/ui/commitment-actions';
import { withCurrencyCode } from '../../src/i18n/format';
import { useI18n } from '../../src/i18n/provider';
import { EntryList } from '../../src/ui/entry-list';
import { debtDueState, spokenDueDay } from '../../src/ui/liability-presentation';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const { t, relativeDate, locale } = useI18n();
  const debt = archive?.debts?.find(item => item.id === id);
  const account = snapshot?.accounts.find(item => item.id === debt?.accountId);
  const activity = useMemo(() => snapshot && account ? liabilityActivity(account.id, snapshot) : { entries: [], transfers: [] }, [snapshot, account]);
  const manage = useDebtManagement();
  // A deleted tracker (24UX4) opens as not found; one this screen has ever shown live (the ledger may hydrate after
  // the screen mounts) stays drawn, without actions, while the screen closes after its own deletion. Keyed by id; set
  // during render, React's pattern for information from previous renders.
  const [seenLiveId, setSeenLiveId] = useState<string | null>(null);
  if (debt && !debt.deleted && seenLiveId !== debt.id) setSeenLiveId(debt.id);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/debts'); };

  if (!snapshot || !archive || !debt || !account || (debt.deleted && seenLiveId !== debt.id)) return <Screen>
    <EmptyState title={t('debts.detail.notFoundTitle')} detail={t('debts.detail.notFoundDetail')} icon="people-outline" />
  </Screen>;

  const outstanding = debtOutstandingMinor(debt, snapshot);
  const owed = debt.direction === 'owed_by_me';
  // 24UX6E: the row's rule (`debtDueState`). A closed debt has no state line (its note says it), so a closed, dated
  // debt is never drawn as overdue; overdue takes the alert tone, due within three days (a debt I owe) amber.
  const state = debtDueState(debt, outstanding, day);
  // The Vencimiento row and "Vencida · Ayer" show the day on its own; "Vence hoy" places it inside the sentence.
  const statusWith = (date: (iso: string, inline: boolean) => string) => state === 'settled' ? t('debts.status.settled')
    : state === 'none' ? t('debts.status.noDue') : state === 'overdue' ? t('debts.status.overdue', { date: date(debt.dueDateISO!, false) })
      : t('debts.status.due', { date: date(debt.dueDateISO!, true) });
  const status = statusWith((iso, inline) => relativeDate(iso, day, inline));
  const spokenStatus = statusWith((iso, inline) => spokenDueDay(iso, day, locale, inline));
  const stateColor = state === 'overdue' ? p.expense : state === 'soon' ? p.warning : null;
  // 24UX6E: only what the hero, the state line and the note do not already say. The direction is the eyebrow's; the
  // date is the state line's while the debt is due, so the Vencimiento row appears only once the line no longer carries
  // it (settled or closed). VoiceOver hears the day written out.
  const showDue = !!debt.dueDateISO && (state === 'settled' || state === 'closed');
  // The transfer form names the payment or collection and writes its default note itself, in the current language.
  const transferParams = owed
    ? { toAccountId: account.id, maxAmountMinor: String(outstanding) }
    : { fromAccountId: account.id, maxAmountMinor: String(outstanding) };

  return <>
    <Stack.Screen options={{ title: debt.counterparty,
      headerRight: () => debt.deleted ? null : <IconButton name="create-outline" label={t('debts.detail.edit')}
        onPress={() => router.push({ pathname: '/edit-debt/[id]', params: { id: debt.id } })} /> }} />
    <EntryList entries={activity.entries} transfers={activity.transfers} accountId={account.id} accounts={snapshot.accounts} context="debt"
      header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
        <View style={{ gap: space.m }}>
          <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
            {/* 24UX6E: a neutral tile; the arrow and the eyebrow say the direction, colour is kept for the due state. */}
            <GlyphTile icon={owed ? 'arrow-up-outline' : 'arrow-down-outline'} large />
            <AppText secondary variant="footnote" style={{ fontWeight: '500', textAlign: 'center' }}>{withCurrencyCode(t(owed ? 'debts.detail.owedTo' : 'debts.detail.owedBy', { name: debt.counterparty }), account.currency)}</AppText>
            <Money minor={outstanding} currency={account.currency} large size={40} align="center" />
            {state !== 'closed' && <AppText variant="subhead" accessibilityLabel={spokenStatus}
              style={{ color: stateColor ?? p.secondary, fontWeight: stateColor ? '600' : '400' }}>{status}</AppText>}
          </View>
          {/* 24UX6E: a closed debt says so right under its hero, calmly; it keeps its balance and history and can be reopened. */}
          {state === 'closed' && !debt.deleted && <LifecycleNote icon="archive-outline" title={t('debts.detail.closedTitle')}
            detail={t(owed ? 'debts.detail.closedDetailOwed' : 'debts.detail.closedDetailReceivable')} />}
        </View>
        <ActionButton label={t(owed ? 'debts.detail.recordPayment' : 'debts.detail.recordCollection')} icon={owed ? 'arrow-forward-outline' : 'arrow-down-outline'}
          disabled={outstanding === 0 || !debt.active} onPress={() => router.push({ pathname: '/new-transfer', params: transferParams })} />
        {(showDue || !!debt.note) && <Surface grouped>
          {showDue && <DetailRow label={t('debts.detail.due')} value={relativeDate(debt.dueDateISO!, day)} spokenValue={spokenDueDay(debt.dueDateISO!, day, locale)}
            icon="calendar-outline" last={!debt.note} />}
          {!!debt.note && <DetailRow label={t('debts.detail.note')} value={debt.note} last />}
        </Surface>}
        <SectionTitle caption={t('debts.detail.explain')}>
          {t(owed ? 'debts.detail.payments' : 'debts.detail.collections')}
        </SectionTitle>
      </View>}
      empty={<AppText secondary variant="subhead">{t(owed ? 'debts.detail.noPayments' : 'debts.detail.noCollections')}</AppText>}
      // 24UX4: the swipe's actions, named. Closing keeps this screen (24UX6E: the note under the hero says it); deleting goes back.
      footer={debt.deleted ? null : <View style={{ gap: space.m }}>
        <ErrorMessage message={manage.error} />
        <ActionButton secondary label={t(debt.active ? 'debts.manage.closeDebt' : 'debts.manage.reopenDebt')} icon={debt.active ? 'checkmark-outline' : 'arrow-undo-outline'}
          busy={manage.busyId === debt.id} onPress={() => { if (debt.active) manage.close(debt); else void manage.reopen(debt); }} />
        <ActionButton secondary tone="expense" label={t('debts.manage.deleteDebt')} icon="trash-outline" disabled={manage.busyId === debt.id}
          onPress={() => manage.remove(debt, back)} />
      </View>} />
  </>;
}
