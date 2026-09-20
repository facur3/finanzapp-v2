import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { debtOutstandingMinor, labelFromISO, todayKey } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, IconButton, Money, SectionTitle, Surface } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { selectTransfers } from '../../src/ui/presentation';
import { usePalette } from '../../src/ui/theme';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const p = usePalette();
  const debt = archive?.debts?.find(item => item.id === id && item.active);
  const account = snapshot?.accounts.find(item => item.id === debt?.accountId);
  const transfers = useMemo(() => snapshot && account
    ? selectTransfers(snapshot.transfers ?? [], snapshot.accounts, '', account.id) : [], [snapshot, account?.id]);

  if (!snapshot || !archive || !debt || !account) return <EntryList entries={[]} accounts={snapshot?.accounts ?? []}
    header={<EmptyState title="No encontramos esta deuda" detail="Volvé a Deudas para elegir una obligación activa." icon="people-outline" />} />;

  const outstanding = debtOutstandingMinor(debt, snapshot);
  const today = todayKey();
  const overdue = !!debt.dueDateISO && debt.dueDateISO < today && outstanding > 0;
  const dueLabel = debt.dueDateISO
    ? labelFromISO(debt.dueDateISO, new Date(today + 'T12:00:00'))
    : 'Sin fecha';

  const transferParams = debt.direction === 'owed_by_me'
    ? { toAccountId: account.id, title: 'Registrar pago', note: 'Pago a ' + debt.counterparty, maxAmountMinor: String(outstanding) }
    : { fromAccountId: account.id, title: 'Registrar cobro', note: 'Cobro de ' + debt.counterparty, maxAmountMinor: String(outstanding) };

  return <>
    <Stack.Screen options={{ title: debt.counterparty,
      headerRight: () => <IconButton name="create-outline" label="Editar deuda"
        onPress={() => router.push({ pathname: '/edit-debt/[id]', params: { id: debt.id } })} /> }} />
    <EntryList entries={[]} transfers={transfers} accountId={account.id} accounts={snapshot.accounts}
      header={<View style={{ gap: 22, paddingBottom: 4 }}>
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <AppText secondary>{debt.direction === 'owed_by_me' ? 'Debo' : 'Me deben'} · {account.currency}</AppText>
          <AppText secondary style={{ fontSize: 13 }}>Saldo pendiente</AppText>
          <Money minor={outstanding} currency={account.currency} large size={44}
            color={debt.direction === 'owed_to_me' ? p.positive : p.text} />
          <AppText secondary style={{ fontSize: 13, color: overdue ? p.negative : p.secondary }}>
            {outstanding === 0 ? 'Saldada' : overdue ? 'Vencida · ' + dueLabel : debt.dueDateISO ? 'Vence ' + dueLabel : 'Sin vencimiento'}
          </AppText>
        </View>

        <ActionButton label={debt.direction === 'owed_by_me' ? 'Registrar pago' : 'Registrar cobro'}
          icon={debt.direction === 'owed_by_me' ? 'arrow-up-outline' : 'arrow-down-outline'}
          onPress={() => router.push({ pathname: '/new-transfer', params: transferParams })}
          disabled={outstanding === 0} />

        <Surface grouped>
          <DetailRow label="Tipo" value={debt.direction === 'owed_by_me' ? 'Yo debo' : 'Me deben'} />
          <DetailRow label="Vencimiento" value={dueLabel} />
          <DetailRow label="Nota" value={debt.note || 'Sin nota'} last />
        </Surface>

        <View style={{ gap: 8 }}>
          <SectionTitle>{debt.direction === 'owed_by_me' ? 'Pagos registrados' : 'Cobros registrados'}</SectionTitle>
          <AppText secondary style={{ fontSize: 13 }}>
            Saldar la obligación mueve saldo entre registros. No crea un gasto o ingreso nuevo.
          </AppText>
        </View>
      </View>}
      empty={<AppText secondary>Todavía no registraste movimientos para esta obligación.</AppText>} />
  </>;
}
