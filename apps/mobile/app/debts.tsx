import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, Stack } from 'expo-router';
import { debtTotalsByCurrency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, ErrorMessage, IconButton, Money, Screen, SectionTitle, Stat, StatRow, Surface } from '../src/ui/components';
import { useDebtManagement } from '../src/ui/commitment-actions';
import { withCurrencyCode } from '../src/i18n/format';
import { useI18n } from '../src/i18n/provider';
import { DebtRow } from '../src/ui/liability-rows';
import { debtsByUrgency } from '../src/ui/liability-presentation';
import { useCurrentDay } from '../src/ui/theme';
import { Reflow } from '../src/ui/motion';
import { pairStacks } from '../src/ui/geometry';

/** Open debts and receivables with their totals, then the closed ones (24UX4). Each row settles, closes, reopens
 * or deletes with a trailing swipe; a deleted tracker leaves the screen while its payments stay in Movimientos. */
export default function DebtsScreen() {
  const { archive, snapshot } = useLedger();
  const { t, moneyText } = useI18n();
  const { width, fontScale } = useWindowDimensions();
  const manage = useDebtManagement();
  const day = useCurrentDay();
  const debts = useMemo(() => (archive?.debts ?? []).filter(debt => debt.active), [archive?.debts]);
  const closed = useMemo(() => (archive?.debts ?? []).filter(debt => !debt.active && !debt.deleted), [archive?.debts]);
  // Exact per-currency sums from the domain: every currency present, ARS and USD first, never added together.
  const totals = useMemo(() => snapshot ? debtTotalsByCurrency(debts, snapshot) : [], [debts, snapshot]);
  if (!archive || !snapshot) return null;
  // 25N1: each open section asks for action first: overdue, due soon, then by due date, undated last.
  const open = debtsByUrgency(debts, snapshot, day);
  const owedByMe = open.filter(debt => debt.direction === 'owed_by_me');
  const owedToMe = open.filter(debt => debt.direction === 'owed_to_me');

  return <Screen>
    <Stack.Screen options={{ title: t('debts.list.title'),
      headerRight: () => <IconButton name="add" label={t('debts.list.add')} onPress={() => router.push('/new-debt')} /> }} />
    <ErrorMessage message={manage.error} />
    {!debts.length && !closed.length ? <EmptyState title={t('debts.list.emptyTitle')} icon="people-outline"
      detail={t('debts.list.emptyDetail')}
      action={<ActionButton label={t('debts.list.add')} icon="add-outline" onPress={() => router.push('/new-debt')} />} /> : <>
      {/* 24UX6E: the totals as one calm block on the canvas (no padded card per currency), in ink: what I owe is not
          a warning and what I am owed is not income; colour is kept for a row's due state. */}
      {!!totals.length && <View style={{ gap: 14 }}>
        {/* 25T: both totals keep their 22 pt; a pair too wide for half the row each goes one under the other, never shrunk. */}
        {totals.map(item => item.status === 'ready' ? <StatRow key={item.currency}
          stacked={pairStacks(width, fontScale, [moneyText(item.owedMinor, item.currency), moneyText(item.receivableMinor, item.currency)], 22)}>
          <Stat label={withCurrencyCode(t('debts.list.owed'), item.currency)}><Money minor={item.owedMinor} currency={item.currency} size={22} weight="700" /></Stat>
          <Stat label={withCurrencyCode(t('debts.list.receivable'), item.currency)}><Money minor={item.receivableMinor} currency={item.currency} size={22} weight="700" /></Stat>
        </StatRow>
          // A sum beyond the safe range is said for that currency, never rounded, dropped or shown as zero.
          : <AppText key={item.currency} secondary variant="subhead">{withCurrencyCode(t('debts.list.outOfRange'), item.currency)}</AppText>)}
      </View>}
      {/* 25T: closing, reopening or deleting moves a row between these blocks: each slides to its new size and a block that
          appears or empties fades (Reflow, as Tarjetas does); Reduce Motion keeps only the fade. */}
      {!!owedByMe.length && <Reflow fade>
        <SectionTitle>{t('debts.list.owed')}</SectionTitle>
        <Surface grouped>{owedByMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedByMe.length - 1} actions={manage.actions(debt)} />)}</Surface>
      </Reflow>}
      {!!owedToMe.length && <Reflow fade>
        <SectionTitle>{t('debts.list.receivable')}</SectionTitle>
        <Surface grouped>{owedToMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedToMe.length - 1} actions={manage.actions(debt)} />)}</Surface>
      </Reflow>}
      {!!closed.length && <Reflow fade>
        <SectionTitle caption={t('debts.list.closedCaption')}>{t('debts.list.closed')}</SectionTitle>
        <Surface grouped>{closed.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === closed.length - 1} actions={manage.actions(debt)} />)}</Surface>
      </Reflow>}
    </>}
  </Screen>;
}
