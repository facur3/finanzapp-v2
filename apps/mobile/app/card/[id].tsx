import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { cardAvailableLimitMinor, cardCreditMinor, cardDebtMinor, labelFromISO, nextDayOfMonthISO, todayKey } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, IconButton, Money, SectionTitle, Surface } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries, selectTransfers } from '../../src/ui/presentation';
import { usePalette } from '../../src/ui/theme';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const p = usePalette();
  const card = archive?.cards?.find(item => item.id === id && item.active);
  const account = snapshot?.accounts.find(item => item.id === card?.accountId);
  const entries = useMemo(() => snapshot && account
    ? selectEntries(snapshot.entries, snapshot.accounts, 'all', '', account.id) : [], [snapshot, account?.id]);
  const transfers = useMemo(() => snapshot && account
    ? selectTransfers(snapshot.transfers ?? [], snapshot.accounts, '', account.id) : [], [snapshot, account?.id]);

  if (!snapshot || !archive || !card || !account) return <EntryList entries={[]} accounts={snapshot?.accounts ?? []}
    header={<EmptyState title="No encontramos esta tarjeta" detail="Volvé a Tarjetas para elegir una tarjeta activa." icon="card-outline" />} />;

  const debt = cardDebtMinor(card, snapshot);
  const credit = cardCreditMinor(card, snapshot);
  const availableLimit = cardAvailableLimitMinor(card, snapshot);
  const today = todayKey();
  const closing = nextDayOfMonthISO(today, card.closingDay);
  const due = nextDayOfMonthISO(today, card.dueDay);

  return <>
    <Stack.Screen options={{ title: account.name,
      headerRight: () => <IconButton name="create-outline" label="Editar tarjeta"
        onPress={() => router.push({ pathname: '/edit-card/[id]', params: { id: card.id } })} /> }} />
    <EntryList entries={entries} transfers={transfers} accountId={account.id} accounts={snapshot.accounts}
      header={<View style={{ gap: 22, paddingBottom: 4 }}>
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <AppText secondary>{card.last4 ? '•••• ' + card.last4 + ' · ' : ''}{account.currency}</AppText>
          <AppText secondary style={{ fontSize: 13 }}>Deuda registrada</AppText>
          <Money minor={debt} currency={account.currency} large size={44} />
          {credit > 0 && <AppText style={{ color: p.positive, fontWeight: '600' }}>
            Crédito a favor · {account.currency === 'USD' ? 'US$ ' : '$ '}{credit / 100}
          </AppText>}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ActionButton label="Registrar compra" icon="cart-outline" containerStyle={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
          <ActionButton label="Pagar tarjeta" icon="arrow-forward-outline" secondary containerStyle={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/new-transfer', params: {
              toAccountId: account.id, title: 'Pagar tarjeta', note: 'Pago ' + account.name,
            } })} />
        </View>

        <Surface grouped>
          {card.creditLimitMinor !== null && <DetailRow label="Límite" value={(account.currency === 'USD' ? 'US$ ' : '$ ') + (card.creditLimitMinor / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })} />}
          {availableLimit !== null && <DetailRow label="Límite disponible" value={(account.currency === 'USD' ? 'US$ ' : '$ ') + (availableLimit / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })} />}
          <DetailRow label="Próximo cierre" value={labelFromISO(closing, new Date(today + 'T12:00:00'))} />
          <DetailRow label="Próximo vencimiento" value={labelFromISO(due, new Date(today + 'T12:00:00'))} last />
        </Surface>

        <View style={{ gap: 8 }}>
          <SectionTitle>Actividad de la tarjeta</SectionTitle>
          <AppText secondary style={{ fontSize: 13 }}>
            Las compras cuentan como gasto. Los pagos aparecen como transferencias y no duplican el consumo.
          </AppText>
        </View>
      </View>}
      empty={<AppText secondary>Todavía no registraste compras o pagos en esta tarjeta.</AppText>} />
  </>;
}
