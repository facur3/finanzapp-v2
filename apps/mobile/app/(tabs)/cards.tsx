import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cardStatementActivity, formatMinorUnits, labelFromISO, liabilityActivity } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, GlyphTile, Money, MovementRow, Screen, SectionTitle, Stat, Surface, toneColors } from '../../src/ui/components';
import { CardCarousel, CardFace } from '../../src/ui/card-visual';
import { DebtRow } from '../../src/ui/liability-rows';
import { activeCards, daysUntil, usageTone, type CardSummary } from '../../src/ui/liability-presentation';
import { mergeActivity } from '../../src/ui/presentation';
import { space, useCurrentDay, usePalette, useReduceMotion } from '../../src/ui/theme';

export default function CardsScreen() {
  const { archive, snapshot } = useLedger();
  const day = useCurrentDay();
  const p = usePalette();
  const cards = useMemo(() => snapshot ? activeCards(archive?.cards, snapshot, day) : [], [archive?.cards, snapshot, day]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = cards[Math.min(selectedIndex, Math.max(0, cards.length - 1))];
  const debts = useMemo(() => (archive?.debts ?? []).filter(debt => debt.active), [archive?.debts]);
  if (!snapshot || !archive) return null;

  return <Screen gap={space.xxl}>
    {!cards.length ? <EmptyState title="Tus tarjetas, como en la billetera" icon="card-outline"
      detail="Registrá cada compra una sola vez como gasto. Cuando pagás el resumen, el dinero sale de tu cuenta y baja la deuda de la tarjeta, sin volver a contar el consumo."
      action={<ActionButton label="Agregar tarjeta" icon="add-outline" onPress={() => router.push('/new-card')} />} />
      : <>
        <View style={{ marginHorizontal: -space.xl }}>
          <CardCarousel items={cards} selectedIndex={selectedIndex} onSelect={setSelectedIndex}
            render={(item, width) => <CardFace id={item.card.id} name={item.account.name} issuer={item.card.issuer} last4={item.card.last4}
              currency={item.account.currency} width={width} accessibilityHint="Abre el detalle de la tarjeta"
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: item.card.id } })} />} />
        </View>
        {selected && <CardPanel key={selected.card.id} summary={selected} day={day} />}
      </>}

    <View>
      <SectionTitle action={debts.length ? 'Ver todas' : 'Agregar'} onAction={() => router.push(debts.length ? '/debts' : '/new-debt')}>Deudas y cobros</SectionTitle>
      {debts.length ? <Surface grouped>
        {debts.slice(0, 3).map((debt, index) => <DebtRow key={debt.id} debt={debt} last={index === Math.min(debts.length, 3) - 1} />)}
      </Surface> : <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <GlyphTile icon="people-outline" />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: '500' }}>Lo que debés y lo que te deben</AppText>
          <AppText secondary variant="footnote">Pagos y cobros parciales reducen el saldo. No se cuentan como gasto ni ingreso.</AppText>
        </View>
      </Surface>}
    </View>
    <AppText tertiary variant="footnote" style={{ textAlign: 'center', color: p.tertiary }}>
      Cierres y vencimientos se calculan con los días que cargaste. No hay conexión bancaria.
    </AppText>
  </Screen>;
}

function CardPanel({ summary, day }: { summary: CardSummary; day: string }) {
  const { snapshot } = useLedger();
  const p = usePalette();
  const { card, account, debtMinor, availableMinor, usage, closingISO, dueISO } = summary;
  const statement = useMemo(() => snapshot ? cardStatementActivity(card, snapshot, day) : null, [card, snapshot, day]);
  const recent = useMemo(() => {
    if (!snapshot) return [];
    const activity = liabilityActivity(account.id, snapshot);
    return mergeActivity(activity.entries, activity.transfers).slice(0, 4);
  }, [snapshot, account.id]);
  if (!snapshot) return null;
  const tone = usageTone(usage);
  const dueIn = daysUntil(dueISO, day);
  const relative = (iso: string) => labelFromISO(iso, new Date(day + 'T12:00:00'));
  return <View style={{ gap: space.xl }}>
    <View style={{ gap: 6 }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>Deuda registrada · {account.currency}</AppText>
      <Money minor={debtMinor} currency={account.currency} large size={40} />
      {debtMinor === 0 && <AppText secondary variant="footnote">Sin deuda registrada en esta tarjeta.</AppText>}
    </View>

    <Surface style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Stat label="Disponible">
          {availableMinor !== null ? <Money minor={availableMinor} currency={account.currency} size={17} color={availableMinor < 0 ? p.expense : undefined} />
            : <AppText secondary variant="subhead">Sin límite cargado</AppText>}
        </Stat>
        <Stat label="Cierre" align="right"><AppText style={{ fontWeight: '600' }}>{relative(closingISO)}</AppText></Stat>
        <Stat label="Vencimiento" align="right">
          <AppText style={{ fontWeight: '600', color: dueIn <= 3 && debtMinor > 0 ? p.warning : p.text }}>{relative(dueISO)}</AppText>
        </Stat>
      </View>
      {usage !== null && card.creditLimitMinor !== null && <UsageBar usage={usage} tone={tone}
        label={`${Math.round(Math.min(usage, 9.99) * 100)} % del límite de ${account.currency === 'USD' ? 'US$ ' : '$ '}${formatMinorUnits(card.creditLimitMinor)}`} />}
    </Surface>

    <View style={{ flexDirection: 'row', gap: 10 }}>
      <ActionButton label="Registrar compra" icon="cart-outline" containerStyle={{ flex: 1 }}
        onPress={() => router.push({ pathname: '/new-entry', params: { accountId: account.id, kind: 'expense' } })} />
      <ActionButton label="Pagar tarjeta" icon="arrow-forward-outline" secondary containerStyle={{ flex: 1 }} disabled={debtMinor === 0}
        onPress={() => router.push({ pathname: '/new-transfer', params: { toAccountId: account.id, title: 'Pagar tarjeta', note: 'Pago ' + account.name, maxAmountMinor: String(debtMinor) } })} />
    </View>

    {statement && <View style={{ flexDirection: 'row', gap: 10 }}>
      <Surface style={{ flex: 1, gap: 4 }}>
        <AppText secondary variant="caption" style={{ fontWeight: '500' }}>Compras del resumen</AppText>
        <Money minor={statement.purchasesMinor} currency={account.currency} size={17} />
        <AppText tertiary variant="caption">{statement.purchaseCount === 1 ? '1 compra' : statement.purchaseCount + ' compras'} · desde {relative(statement.startISO)}</AppText>
      </Surface>
      <Surface style={{ flex: 1, gap: 4 }}>
        <AppText secondary variant="caption" style={{ fontWeight: '500' }}>Pagos del resumen</AppText>
        <Money minor={statement.paymentsMinor} currency={account.currency} size={17} tone="transfer" color={statement.paymentsMinor ? undefined : p.text} />
        <AppText tertiary variant="caption">{statement.paymentCount === 1 ? '1 pago' : statement.paymentCount + ' pagos'}</AppText>
      </Surface>
    </View>}

    <View>
      <SectionTitle action="Ver todo" onAction={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}>Recientes</SectionTitle>
      {recent.length ? <Surface grouped>
        {recent.map((item, index) => <MovementRow key={item.key} item={item} accounts={snapshot.accounts} accountId={account.id} context="card" last={index === recent.length - 1} />)}
      </Surface> : <AppText secondary variant="subhead">Todavía no registraste compras ni pagos en esta tarjeta.</AppText>}
    </View>
  </View>;
}

function UsageBar({ usage, tone, label }: { usage: number; tone: 'neutral' | 'warning' | 'expense'; label: string }) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(Math.min(1, usage));
  useEffect(() => { progress.value = withTiming(Math.min(1, usage), { duration: reduced ? 0 : 360 }); }, [usage, reduced, progress]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.value === 0 ? 0 : Math.max(1.5, progress.value * 100)}%` as `${number}%` }));
  const fill = tone === 'neutral' ? p.text : toneColors(p, tone).color;
  return <View style={{ gap: 6 }}>
    <View accessible={false} style={{ height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: p.inset }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: fill }, bar]} />
    </View>
    <AppText secondary variant="caption" style={tone !== 'neutral' ? { color: toneColors(p, tone).color, fontWeight: '500' } : undefined}>{label}</AppText>
  </View>;
}
