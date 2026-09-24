import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { debtOutstandingMinor, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, GlyphTile, IconButton, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { withCurrencyCode } from '../../src/i18n/format';
import { useI18n } from '../../src/i18n/provider';
import { EntryList } from '../../src/ui/entry-list';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const { t, relativeDate } = useI18n();
  const debt = archive?.debts?.find(item => item.id === id);
  const account = snapshot?.accounts.find(item => item.id === debt?.accountId);
  const activity = useMemo(() => snapshot && account ? liabilityActivity(account.id, snapshot) : { entries: [], transfers: [] }, [snapshot, account]);

  if (!snapshot || !archive || !debt || !account) return <Screen>
    <EmptyState title={t('debts.detail.notFoundTitle')} detail={t('debts.detail.notFoundDetail')} icon="people-outline" />
  </Screen>;

  const outstanding = debtOutstandingMinor(debt, snapshot);
  const owed = debt.direction === 'owed_by_me';
  const overdue = !!debt.dueDateISO && debt.dueDateISO < day && outstanding > 0;
  const dueLabel = debt.dueDateISO ? relativeDate(debt.dueDateISO, day) : t('debts.status.noDate');
  const status = outstanding === 0 ? t('debts.status.settled') : overdue ? t('debts.status.overdue', { date: dueLabel })
    : debt.dueDateISO ? t('debts.status.due', { date: dueLabel }) : t('debts.status.noDue');
  // The transfer form names the payment or collection and writes its default note itself, in the current language.
  const transferParams = owed
    ? { toAccountId: account.id, maxAmountMinor: String(outstanding) }
    : { fromAccountId: account.id, maxAmountMinor: String(outstanding) };

  return <>
    <Stack.Screen options={{ title: debt.counterparty,
      headerRight: () => <IconButton name="create-outline" label={t('debts.detail.edit')}
        onPress={() => router.push({ pathname: '/edit-debt/[id]', params: { id: debt.id } })} /> }} />
    <EntryList entries={activity.entries} transfers={activity.transfers} accountId={account.id} accounts={snapshot.accounts} context="debt"
      header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
        <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
          <GlyphTile icon={owed ? 'arrow-up-outline' : 'arrow-down-outline'} tone={owed ? 'warning' : 'income'} large />
          <AppText secondary variant="footnote" style={{ fontWeight: '500', textAlign: 'center' }}>{withCurrencyCode(t(owed ? 'debts.detail.owedTo' : 'debts.detail.owedBy', { name: debt.counterparty }), account.currency)}</AppText>
          <Money minor={outstanding} currency={account.currency} large size={40} align="center" />
          <AppText variant="subhead" style={{ color: overdue ? p.expense : p.secondary, fontWeight: overdue ? '600' : '400' }}>{status}</AppText>
        </View>
        <ActionButton label={t(owed ? 'debts.detail.recordPayment' : 'debts.detail.recordCollection')} icon={owed ? 'arrow-forward-outline' : 'arrow-down-outline'}
          disabled={outstanding === 0 || !debt.active} onPress={() => router.push({ pathname: '/new-transfer', params: transferParams })} />
        <Surface grouped>
          <DetailRow label={t('debts.detail.type')} value={t(owed ? 'debts.detail.typeOwed' : 'debts.detail.typeReceivable')} />
          <DetailRow label={t('debts.detail.due')} value={dueLabel} icon="calendar-outline" />
          <DetailRow label={t('debts.detail.state')} value={debt.active ? status : t('debts.status.archived')} last={!debt.note} />
          {!!debt.note && <DetailRow label={t('debts.detail.note')} value={debt.note} last />}
        </Surface>
        <SectionTitle caption={t('debts.detail.explain')}>
          {t(owed ? 'debts.detail.payments' : 'debts.detail.collections')}
        </SectionTitle>
      </View>}
      empty={<AppText secondary variant="subhead">{t(owed ? 'debts.detail.noPayments' : 'debts.detail.noCollections')}</AppText>} />
  </>;
}
