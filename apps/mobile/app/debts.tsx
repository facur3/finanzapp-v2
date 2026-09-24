import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { debtTotalsByCurrency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Money, Screen, SectionTitle, Stat, StatRow, Surface } from '../src/ui/components';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { DebtRow } from '../src/ui/liability-rows';
import { usePalette } from '../src/ui/theme';

export default function DebtsScreen() {
  const { archive, snapshot } = useLedger();
  const p = usePalette();
  const { t } = useI18n();
  const debts = useMemo(() => (archive?.debts ?? []).filter(debt => debt.active), [archive?.debts]);
  // Exact per-currency sums from the domain: every currency present, ARS and USD first, never added together.
  const totals = useMemo(() => snapshot ? debtTotalsByCurrency(debts, snapshot) : [], [debts, snapshot]);
  if (!archive || !snapshot) return null;
  const owedByMe = debts.filter(debt => debt.direction === 'owed_by_me');
  const owedToMe = debts.filter(debt => debt.direction === 'owed_to_me');

  return <Screen>
    <Stack.Screen options={{ title: t('debts.list.title'),
      headerRight: () => <IconButton name="add" label={t('debts.list.add')} onPress={() => router.push('/new-debt')} /> }} />
    {!debts.length ? <EmptyState title={t('debts.list.emptyTitle')} icon="people-outline"
      detail={t('debts.list.emptyDetail')}
      action={<ActionButton label={t('debts.list.add')} icon="add-outline" onPress={() => router.push('/new-debt')} />} /> : <>
      {totals.map(item => item.status === 'ready' ? <Surface key={item.currency}><StatRow>
        <Stat label={withCurrencyCode(t('debts.list.owed'), item.currency)}><Money minor={item.owedMinor} currency={item.currency} size={22} weight="700" color={item.owedMinor ? p.warning : undefined} /></Stat>
        <Stat label={withCurrencyCode(t('debts.list.receivable'), item.currency)}><Money minor={item.receivableMinor} currency={item.currency} size={22} weight="700" tone={item.receivableMinor ? 'income' : 'neutral'} /></Stat>
      </StatRow></Surface>
        // A sum beyond the safe range is said for that currency, never rounded, dropped or shown as zero.
        : <Surface key={item.currency}><AppText secondary>{withCurrencyCode(t('debts.list.outOfRange'), item.currency)}</AppText></Surface>)}
      {!!owedByMe.length && <View>
        <SectionTitle>{t('debts.list.owed')}</SectionTitle>
        <Surface grouped>{owedByMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedByMe.length - 1} />)}</Surface>
      </View>}
      {!!owedToMe.length && <View>
        <SectionTitle>{t('debts.list.receivable')}</SectionTitle>
        <Surface grouped>{owedToMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedToMe.length - 1} />)}</Surface>
      </View>}
    </>}
  </Screen>;
}
