import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { cardCreditMinor, cardStatementActivity, formatMinorUnits, labelFromISO, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Money, Screen, SectionTitle, Stat, Surface } from '../../src/ui/components';
import { CardFace } from '../../src/ui/card-visual';
import { EntryList } from '../../src/ui/entry-list';
import { statementCaption, summarizeCard, usageTone } from '../../src/ui/liability-presentation';
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
        {/* Identity (the card) → state (the debt) → three facts → primary → secondary → activity. Issuer and currency already live on the card face. */}
        <View style={{ gap: 6 }}>
          <AppText secondary variant="subhead" style={{ fontWeight: '500' }}>{card.active ? 'Deuda registrada' : 'Tarjeta archivada · deuda registrada'}</AppText>
          <Money minor={debtMinor} currency={account.currency} large />
          {credit > 0 && <AppText variant="subhead" style={{ color: p.income, fontWeight: '600' }}>Saldo a favor · {money(credit)}</AppText>}
        </View>

        <Surface style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Stat label="Disponible">
              {availableMinor !== null ? <Money minor={availableMinor} currency={account.currency} size={17} color={tone === 'neutral' ? undefined : tone === 'warning' ? p.warning : p.expense} />
                : <AppText secondary variant="subhead">Sin límite</AppText>}
              {card.creditLimitMinor !== null && <AppText tertiary variant="caption">de {money(card.creditLimitMinor)}</AppText>}
            </Stat>
            <Stat label="Cierre" align="right"><AppText style={{ fontWeight: '600' }}>{relative(closingISO)}</AppText></Stat>
            <Stat label="Vencimiento" align="right">
              <AppText style={{ fontWeight: '600', color: tone !== 'neutral' && debtMinor > 0 ? p.warning : p.text }}>{relative(dueISO)}</AppText>
            </Stat>
          </View>
        </Surface>

        <View style={{ gap: 10 }}>
          <ActionButton label="Registrar compra" icon="cart-outline" disabled={!card.active}
            onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
          <ActionButton label="Pagar tarjeta" icon="arrow-forward-outline" secondary tone="transfer" disabled={debtMinor === 0}
            onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, title: 'Pagar tarjeta', note: 'Pago ' + account.name, maxAmountMinor: String(debtMinor) } })} />
        </View>

        <SectionTitle caption={statementCaption(statement, relative) + (statement.refundsMinor > 0 ? ` · devoluciones ${money(statement.refundsMinor)}` : '')}>Movimientos</SectionTitle>
      </View>}
      empty={<AppText secondary variant="subhead">Todavía no registraste compras ni pagos en esta tarjeta.</AppText>} />
  </>;
}
