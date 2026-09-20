import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { debtOutstandingMinor, labelFromISO, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, GlyphTile, IconButton, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const debt = archive?.debts?.find(item => item.id === id);
  const account = snapshot?.accounts.find(item => item.id === debt?.accountId);
  const activity = useMemo(() => snapshot && account ? liabilityActivity(account.id, snapshot) : { entries: [], transfers: [] }, [snapshot, account]);

  if (!snapshot || !archive || !debt || !account) return <Screen>
    <EmptyState title="No encontramos esta deuda" detail="Volvé a Deudas para elegir una obligación guardada en este dispositivo." icon="people-outline" />
  </Screen>;

  const outstanding = debtOutstandingMinor(debt, snapshot);
  const owed = debt.direction === 'owed_by_me';
  const overdue = !!debt.dueDateISO && debt.dueDateISO < day && outstanding > 0;
  const dueLabel = debt.dueDateISO ? labelFromISO(debt.dueDateISO, new Date(day + 'T12:00:00')) : 'Sin fecha';
  const status = outstanding === 0 ? 'Saldada' : overdue ? 'Vencida · ' + dueLabel : debt.dueDateISO ? 'Vence ' + dueLabel : 'Sin vencimiento';
  const transferParams = owed
    ? { toAccountId: account.id, title: 'Registrar pago', note: 'Pago a ' + debt.counterparty, maxAmountMinor: String(outstanding) }
    : { fromAccountId: account.id, title: 'Registrar cobro', note: 'Cobro de ' + debt.counterparty, maxAmountMinor: String(outstanding) };

  return <>
    <Stack.Screen options={{ title: debt.counterparty,
      headerRight: () => <IconButton name="create-outline" label="Editar deuda"
        onPress={() => router.push({ pathname: '/edit-debt/[id]', params: { id: debt.id } })} /> }} />
    <EntryList entries={activity.entries} transfers={activity.transfers} accountId={account.id} accounts={snapshot.accounts} context="debt"
      header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
        <View style={{ gap: 12, alignItems: 'center', paddingTop: 8 }}>
          <GlyphTile icon={owed ? 'arrow-up-outline' : 'arrow-down-outline'} tone={owed ? 'warning' : 'income'} large />
          <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{owed ? 'Debo a' : 'Me debe'} {debt.counterparty} · {account.currency}</AppText>
          <Money minor={outstanding} currency={account.currency} large size={40} />
          <AppText variant="subhead" style={{ color: overdue ? p.expense : p.secondary, fontWeight: overdue ? '600' : '400' }}>{status}</AppText>
        </View>
        <ActionButton label={owed ? 'Registrar pago' : 'Registrar cobro'} icon={owed ? 'arrow-forward-outline' : 'arrow-down-outline'}
          disabled={outstanding === 0 || !debt.active} onPress={() => router.push({ pathname: '/new-transfer', params: transferParams })} />
        <Surface grouped>
          <DetailRow label="Tipo" value={owed ? 'Yo debo' : 'Me deben'} />
          <DetailRow label="Vencimiento" value={dueLabel} icon="calendar-outline" />
          <DetailRow label="Estado" value={debt.active ? status : 'Archivada'} last={!debt.note} />
          {!!debt.note && <DetailRow label="Nota" value={debt.note} last />}
        </Surface>
        <SectionTitle caption="Saldar la obligación mueve saldo entre registros. No crea un gasto ni un ingreso.">
          {owed ? 'Pagos registrados' : 'Cobros registrados'}
        </SectionTitle>
      </View>}
      empty={<AppText secondary variant="subhead">Todavía no registraste {owed ? 'pagos' : 'cobros'} para esta obligación.</AppText>} />
  </>;
}
