import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cardAvailableLimitMinor, cardDebtMinor, nextDayOfMonthISO, todayKey, type CreditCardProfile, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, IconButton, Money, PressFeedback, Screen, SectionTitle, Surface } from '../src/ui/components';
import { usePalette, useReduceMotion } from '../src/ui/theme';

export default function CardsScreen() {
  const { archive, snapshot } = useLedger();
  const cards = useMemo(() => (archive?.cards ?? []).filter(card => card.active), [archive?.cards]);
  if (!archive || !snapshot) return null;
  const sections = (['ARS', 'USD'] as Currency[]).map(currency => ({
    currency,
    data: cards.filter(card => snapshot.accounts.find(account => account.id === card.accountId)?.currency === currency),
  })).filter(section => section.data.length);

  return <Screen>
    <Stack.Screen options={{ title: 'Tarjetas',
      headerRight: () => <IconButton name="add" label="Agregar tarjeta" onPress={() => router.push('/new-card')} /> }} />
    <View style={{ gap: 4 }}>
      <AppText accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 }}>Tarjetas de crédito</AppText>
      <AppText secondary style={{ fontSize: 15 }}>Compras, deuda registrada, límite y próximos vencimientos. Sin conexión bancaria.</AppText>
    </View>

    {!cards.length ? <EmptyState title="Agregá tu primera tarjeta"
      detail="Podés registrar compras y pagos sin contar dos veces el gasto."
      icon="card-outline" action={<ActionButton label="Agregar tarjeta" icon="add" onPress={() => router.push('/new-card')} />} />
      : sections.map(section => <View key={section.currency} style={{ gap: 10 }}>
        <SectionTitle>{section.currency === 'ARS' ? 'Pesos argentinos' : 'Dólares estadounidenses'}</SectionTitle>
        <Surface grouped>
          {section.data.map((card, index) => <CardRow key={card.id} card={card}
            last={index === section.data.length - 1} />)}
        </Surface>
      </View>)}

    <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      El pago de tarjeta se registra como movimiento entre cuentas. La compra original es la que aparece en gastos y presupuestos.
    </AppText>
  </Screen>;
}

function CardRow({ card, last }: { card: CreditCardProfile; last: boolean }) {
  const { snapshot } = useLedger();
  const p = usePalette();
  const reduced = useReduceMotion();
  const account = snapshot?.accounts.find(item => item.id === card.accountId);
  const debt = snapshot ? cardDebtMinor(card, snapshot) : 0;
  const available = snapshot ? cardAvailableLimitMinor(card, snapshot) : null;
  const ratio = card.creditLimitMinor ? Math.min(1, debt / card.creditLimitMinor) : 0;
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withTiming(ratio, { duration: reduced ? 0 : 440 }); }, [ratio, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(2, progress.value * 100)}%` as `${number}%` }));
  const due = nextDayOfMonthISO(todayKey(), card.dueDay);

  if (!account) return null;
  return <PressFeedback accessibilityRole="button"
    accessibilityLabel={`${account.name}, deuda registrada ${debt} ${account.currency}, vence ${due}`}
    onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
    style={{ padding: 16, gap: 12, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: p.line }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="card-outline" size={22} color={p.accent} accessible={false} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '600' }}>{account.name}</AppText>
        <AppText secondary style={{ fontSize: 13 }}>
          {card.last4 ? '•••• ' + card.last4 + ' · ' : ''}Vence día {card.dueDay}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <AppText secondary style={{ fontSize: 12 }}>Deuda</AppText>
        <Money minor={debt} currency={account.currency} size={17} />
      </View>
    </View>
    {card.creditLimitMinor !== null && <View style={{ gap: 6 }}>
      <View style={{ height: 6, borderRadius: 999, overflow: 'hidden', backgroundColor: p.inset }}>
        <Animated.View style={[{ height: 6, borderRadius: 999, backgroundColor: debt > card.creditLimitMinor ? p.negative : p.accent }, bar]} />
      </View>
      <AppText secondary style={{ fontSize: 12 }}>
        {available !== null && available >= 0 ? 'Límite disponible' : 'Sobre el límite'}
      </AppText>
    </View>}
  </PressFeedback>;
}
