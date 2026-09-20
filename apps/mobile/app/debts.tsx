import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { debtOutstandingMinor, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Money, Screen, SectionTitle, Surface } from '../src/ui/components';
import { DebtRow } from '../src/ui/liability-rows';
import { usePalette } from '../src/ui/theme';

export default function DebtsScreen() {
  const { archive, snapshot } = useLedger();
  const p = usePalette();
  const debts = useMemo(() => (archive?.debts ?? []).filter(debt => debt.active), [archive?.debts]);
  const totals = useMemo(() => {
    if (!snapshot) return [];
    const map = new Map<Currency, { owed: number; receivable: number }>();
    for (const debt of debts) {
      const account = snapshot.accounts.find(item => item.id === debt.accountId);
      if (!account) continue;
      const current = map.get(account.currency) ?? { owed: 0, receivable: 0 };
      current[debt.direction === 'owed_by_me' ? 'owed' : 'receivable'] += debtOutstandingMinor(debt, snapshot);
      map.set(account.currency, current);
    }
    return [...map.entries()];
  }, [debts, snapshot]);
  if (!archive || !snapshot) return null;
  const owedByMe = debts.filter(debt => debt.direction === 'owed_by_me');
  const owedToMe = debts.filter(debt => debt.direction === 'owed_to_me');

  return <Screen>
    <Stack.Screen options={{ title: 'Deudas y cobros',
      headerRight: () => <IconButton name="add" label="Agregar deuda" onPress={() => router.push('/new-debt')} /> }} />
    {!debts.length ? <EmptyState title="Lo que debés y lo que te deben" icon="people-outline"
      detail="Registrá un préstamo, una deuda con alguien o un monto que te deben. Cada pago o cobro parcial baja el saldo pendiente sin crear gastos ni ingresos falsos."
      action={<ActionButton label="Agregar deuda" icon="add-outline" onPress={() => router.push('/new-debt')} />} /> : <>
      {totals.map(([currency, value]) => <Surface key={currency} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 3 }}>
          <AppText secondary variant="caption" style={{ fontWeight: '500' }}>Debo · {currency}</AppText>
          <Money minor={value.owed} currency={currency} size={22} weight="700" color={value.owed ? p.warning : undefined} />
        </View>
        <View style={{ gap: 3, alignItems: 'flex-end' }}>
          <AppText secondary variant="caption" style={{ fontWeight: '500' }}>Me deben · {currency}</AppText>
          <Money minor={value.receivable} currency={currency} size={22} weight="700" tone={value.receivable ? 'income' : 'neutral'} />
        </View>
      </Surface>)}
      {!!owedByMe.length && <View>
        <SectionTitle>Debo</SectionTitle>
        <Surface grouped>{owedByMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedByMe.length - 1} />)}</Surface>
      </View>}
      {!!owedToMe.length && <View>
        <SectionTitle>Me deben</SectionTitle>
        <Surface grouped>{owedToMe.map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === owedToMe.length - 1} />)}</Surface>
      </View>}
    </>}
    <AppText tertiary variant="footnote" style={{ textAlign: 'center' }}>
      Los totales no mezclan ARS y USD ni se suman al saldo disponible de tus cuentas.
    </AppText>
  </Screen>;
}
