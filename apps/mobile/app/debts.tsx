import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { debtOutstandingMinor, labelFromISO, todayKey, type PersonalDebtProfile } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Money, PressFeedback, Screen, SectionTitle, Surface } from '../src/ui/components';
import { usePalette } from '../src/ui/theme';

export default function DebtsScreen() {
  const { archive, snapshot } = useLedger();
  const debts = useMemo(() => (archive?.debts ?? []).filter(debt => debt.active), [archive?.debts]);
  if (!archive || !snapshot) return null;
  const owedByMe = debts.filter(debt => debt.direction === 'owed_by_me');
  const owedToMe = debts.filter(debt => debt.direction === 'owed_to_me');

  return <Screen>
    <Stack.Screen options={{ title: 'Deudas',
      headerRight: () => <IconButton name="add" label="Agregar deuda" onPress={() => router.push('/new-debt')} /> }} />
    <View style={{ gap: 4 }}>
      <AppText accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 }}>Deudas y cobros</AppText>
      <AppText secondary style={{ fontSize: 15 }}>Seguimiento de lo que debés y lo que te deben, sin convertir pagos en gasto dos veces.</AppText>
    </View>

    {!debts.length ? <EmptyState title="No hay obligaciones activas"
      detail="Registrá una deuda personal, un préstamo o un monto que alguien te debe."
      icon="people-outline" action={<ActionButton label="Agregar deuda" icon="add" onPress={() => router.push('/new-debt')} />} /> : <>
      {!!owedByMe.length && <View style={{ gap: 10 }}>
        <SectionTitle>Debo</SectionTitle>
        <Surface grouped>{owedByMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedByMe.length - 1} />)}</Surface>
      </View>}
      {!!owedToMe.length && <View style={{ gap: 10 }}>
        <SectionTitle>Me deben</SectionTitle>
        <Surface grouped>{owedToMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedToMe.length - 1} />)}</Surface>
      </View>}
    </>}

    <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      Los pagos y cobros reducen la obligación mediante transferencias internas. No se mezclan ARS y USD.
    </AppText>
  </Screen>;
}

function DebtRow({ debt, last }: { debt: PersonalDebtProfile; last: boolean }) {
  const { snapshot } = useLedger();
  const p = usePalette();
  const account = snapshot?.accounts.find(item => item.id === debt.accountId);
  const outstanding = snapshot ? debtOutstandingMinor(debt, snapshot) : 0;
  if (!account) return null;
  const due = debt.dueDateISO ? labelFromISO(debt.dueDateISO, new Date(todayKey() + 'T12:00:00')) : 'Sin fecha';

  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`${debt.counterparty}, pendiente ${outstanding} ${account.currency}, ${due}`}
    onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={debt.direction === 'owed_by_me' ? 'arrow-up-outline' : 'arrow-down-outline'} size={22} color={p.accent} accessible={false} />
    </View>
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <AppText numberOfLines={1} style={{ fontWeight: '600' }}>{debt.counterparty}</AppText>
      <AppText secondary style={{ fontSize: 13 }}>{due} · {account.currency}</AppText>
    </View>
    <View style={{ alignItems: 'flex-end', gap: 3 }}>
      <AppText secondary style={{ fontSize: 12 }}>{outstanding ? 'Pendiente' : 'Saldada'}</AppText>
      <Money minor={outstanding} currency={account.currency} size={17}
        color={debt.direction === 'owed_to_me' ? p.positive : p.text} />
    </View>
  </PressFeedback>;
}
