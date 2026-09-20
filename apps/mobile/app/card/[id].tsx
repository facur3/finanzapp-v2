import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { cardCreditMinor, cardStatementActivity, formatMinorUnits, labelFromISO, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, IconButton, Money, Screen, SectionTitle, Stat, Surface } from '../../src/ui/components';
import { CardFace } from '../../src/ui/card-visual';
import { EntryList } from '../../src/ui/entry-list';
import { summarizeCard, usageTone } from '../../src/ui/liability-presentation';
import { space, useCurrentDay, usePalette } from '../../src/ui/theme';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const { width } = useWindowDimensions();
  const card = archive?.cards?.find(item => item.id === id);
  const summary = useMemo(() => card && snapshot ? summarizeCard(card, snapshot, day) : null, [card, snapshot, day]);
  const statement = useMemo(() => card && snapshot ? cardStatementActivity(card, snapshot, day) : null, [card, snapshot, day]);
  const activity = useMemo(() => summary && snapshot ? liabilityActivity(summary.account.id, snapshot) : { entries: [], transfers: [] }, [summary, snapshot]);

  if (!snapshot || !archive || !card || !summary || !statement) return <Screen>
    <EmptyState title="No encontramos esta tarjeta" detail="Volvé a Tarjetas para elegir una tarjeta guardada en este dispositivo." icon="card-outline" />
  </Screen>;
  const { account, debtMinor, availableMinor, usage, closingISO, dueISO } = summary;
  const credit = cardCreditMinor(card, snapshot);
  const relative = (iso: string) => labelFromISO(iso, new Date(day + 'T12:00:00'));
  const money = (minor: number) => (account.currency === 'USD' ? 'US$ ' : '$ ') + formatMinorUnits(minor);
  const tone = usageTone(usage);

  return <>
    <Stack.Screen options={{ title: account.name,
      headerRight: () => <IconButton name="create-outline" label="Editar tarjeta"
        onPress={() => router.push({ pathname: '/edit-card/[id]', params: { id: card.id } })} /> }} />
    <EntryList entries={activity.entries} transfers={activity.transfers} accountId={account.id} accounts={snapshot.accounts} context="card"
      header={<View style={{ gap: space.xl, paddingBottom: 4 }}>
        <CardFace id={card.id} name={account.name} issuer={card.issuer} last4={card.last4} currency={account.currency} width={Math.min(width - space.xl * 2, 420)} />
        <View style={{ gap: 6 }}>
          <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>{card.active ? 'Deuda registrada' : 'Tarjeta archivada · deuda registrada'} · {account.currency}</AppText>
          <Money minor={debtMinor} currency={account.currency} large size={40} />
          {credit > 0 && <AppText variant="subhead" style={{ color: p.income, fontWeight: '600' }}>Saldo a favor · {money(credit)}</AppText>}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ActionButton label="Registrar compra" icon="cart-outline" containerStyle={{ flex: 1 }} disabled={!card.active}
            onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
          <ActionButton label="Pagar tarjeta" icon="arrow-forward-outline" secondary containerStyle={{ flex: 1 }} disabled={debtMinor === 0}
            onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, title: 'Pagar tarjeta', note: 'Pago ' + account.name, maxAmountMinor: String(debtMinor) } })} />
        </View>

        <Surface grouped>
          {card.creditLimitMinor !== null && <DetailRow label="Límite" value={money(card.creditLimitMinor)} />}
          {availableMinor !== null && <DetailRow label="Disponible del límite" value={money(availableMinor)} tone={tone === 'neutral' ? 'neutral' : tone} />}
          <DetailRow label="Próximo cierre" value={relative(closingISO)} icon="calendar-outline" />
          <DetailRow label="Próximo vencimiento" value={relative(dueISO)} icon="calendar-outline" />
          {!!card.issuer && <DetailRow label="Emisor" value={card.issuer} />}
          <DetailRow label="Moneda" value={account.currency === 'USD' ? 'Dólares estadounidenses' : 'Pesos argentinos'} last />
        </Surface>

        <Surface style={{ gap: 12 }}>
          <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>Resumen abierto · {relative(statement.startISO)} a {relative(statement.closingISO)}</AppText>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Stat label="Compras"><Money minor={statement.purchasesMinor} currency={account.currency} size={17} /></Stat>
            {statement.refundsMinor > 0 && <Stat label="Devoluciones"><Money minor={statement.refundsMinor} currency={account.currency} size={17} tone="income" signed /></Stat>}
            <Stat label="Pagos" align="right"><Money minor={statement.paymentsMinor} currency={account.currency} size={17} tone="transfer" color={statement.paymentsMinor ? undefined : p.text} /></Stat>
          </View>
        </Surface>

        <SectionTitle caption="Las compras cuentan como gasto una vez. Los pagos mueven saldo y no duplican el consumo.">Movimientos</SectionTitle>
      </View>}
      empty={<AppText secondary variant="subhead">Todavía no registraste compras ni pagos en esta tarjeta.</AppText>} />
  </>;
}
