import { useEffect, useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { advanceRecurringDate, labelFromISO, recurringOccurrencesThrough, todayKey,
  type Currency, type RecurringFrequency, type RecurringRule } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, CategoryBadge, EmptyState, ErrorMessage, IconButton, Money, PressFeedback, Screen, SectionTitle, Surface } from '../src/ui/components';
import { usePalette, useReduceMotion } from '../src/ui/theme';

const FREQUENCY: Record<RecurringFrequency, string> = { weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' };

export default function RecurringScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  const { archive, snapshot, saveRecurring } = useLedger();
  const p = usePalette();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const accounts = snapshot?.accounts ?? [];
  const allRules = archive?.recurring ?? [];
  const rules = useMemo(() => allRules
    .filter(rule => !accountId || rule.accountId === accountId)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.nextDateISO.localeCompare(b.nextDateISO) || a.merchant.localeCompare(b.merchant)),
  [allRules, accountId]);
  const account = accounts.find(item => item.id === accountId);
  const active = rules.filter(rule => rule.active);
  const paused = rules.filter(rule => !rule.active);
  const forecast = useMemo(() => buildForecast(active, accounts), [active, accounts]);

  async function toggle(rule: RecurringRule) {
    if (busyId) return;
    setBusyId(rule.id);
    setToggleError(null);
    try {
      const now = new Date().toISOString();
      let nextDateISO = rule.nextDateISO;
      if (!rule.active) {
        const today = todayKey();
        while (nextDateISO < today) nextDateISO = advanceRecurringDate(nextDateISO, rule.frequency, rule.anchorDateISO);
      }
      const next = { ...rule, active: !rule.active, nextDateISO, revision: rule.revision + 1, updatedAt: now };
      await saveRecurring(next);
      void Haptics.selectionAsync().catch(() => {});
    } catch (cause) {
      setToggleError(cause instanceof Error ? cause.message : 'No pudimos cambiar el estado del recurrente. Probá nuevamente.');
    } finally {
      setBusyId(null);
    }
  }

  if (!snapshot || !archive) return null;
  return <Screen>
    <Stack.Screen options={{
      title: account ? account.name : 'Recurrentes',
      headerRight: () => <IconButton name="add" label="Agregar recurrente"
        onPress={() => router.push({ pathname: '/new-recurring', params: accountId ? { accountId } : {} })} />,
    }} />
    <View style={{ gap: 4 }}>
      <AppText accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 }}>
        {account ? 'Compromisos de esta cuenta' : 'Tus compromisos'}
      </AppText>
      <AppText secondary style={{ fontSize: 15 }}>
        Se registran al vencer. Podés pausarlos sin borrar el historial ya creado.
      </AppText>
    </View>

    <ErrorMessage message={toggleError} />
    {!rules.length ? <EmptyState title="Nada recurrente todavía"
      detail={account ? 'Creá un pago o ingreso recurrente para esta cuenta.' : 'Suscripciones, alquiler, sueldo o cualquier movimiento que se repita.'}
      icon="repeat-outline"
      action={<ActionButton label="Crear recurrente" icon="add" onPress={() => router.push({ pathname: '/new-recurring', params: accountId ? { accountId } : {} })} />} />
      : <>
        {!!forecast.length && <Surface>
          <SectionTitle>Próximos 30 días</SectionTitle>
          <AppText secondary style={{ fontSize: 13 }}>Proyección por moneda. No mezclamos ARS y USD.</AppText>
          <View style={{ gap: 18, paddingTop: 4 }}>
            {forecast.map(item => <ForecastCard key={item.currency} {...item} />)}
          </View>
        </Surface>}

        {!!active.length && <View style={{ gap: 10 }}>
          <SectionTitle>Activos</SectionTitle>
          <Surface grouped>{active.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts}
            last={index === active.length - 1} busy={busyId === rule.id} onToggle={() => toggle(rule)} />)}</Surface>
        </View>}

        {!!paused.length && <View style={{ gap: 10 }}>
          <SectionTitle>Pausados</SectionTitle>
          <Surface grouped>{paused.map((rule, index) => <RecurringRow key={rule.id} rule={rule} accounts={accounts}
            last={index === paused.length - 1} busy={busyId === rule.id} onToggle={() => toggle(rule)} />)}</Surface>
        </View>}
      </>}
    <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      Si la app estuvo cerrada, FinanzApp recupera los vencimientos pendientes la próxima vez que la abras. Cada fecha tiene un identificador único para evitar duplicados.
    </AppText>
  </Screen>;
}

function RecurringRow({ rule, accounts, last, busy, onToggle }: {
  rule: RecurringRule; accounts: { id: string; name: string; currency: Currency }[]; last: boolean; busy: boolean; onToggle: () => void;
}) {
  const p = usePalette();
  const account = accounts.find(item => item.id === rule.accountId);
  const date = labelFromISO(rule.nextDateISO, new Date(todayKey() + 'T12:00:00'));
  const amount = rule.kind === 'income' ? rule.amountMinor : -rule.amountMinor;
  return <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomColor: p.line, borderBottomWidth: last ? 0 : 0.5 }}>
    <PressFeedback accessibilityRole="button" accessibilityLabel={'Editar recurrente ' + rule.merchant}
      onPress={() => router.push({ pathname: '/edit-recurring/[id]', params: { id: rule.id } })}
      containerStyle={{ flex: 1 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingLeft: 16 }}>
      <CategoryBadge category={rule.category} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <AppText numberOfLines={1} style={{ flex: 1, fontWeight: '600' }}>{rule.merchant}</AppText>
          {account && <Money minor={amount} currency={account.currency} signed color={rule.kind === 'income' ? p.positive : p.text} />}
        </View>
        <AppText secondary numberOfLines={2} style={{ fontSize: 13 }}>
          {FREQUENCY[rule.frequency]} · {date}{account ? ' · ' + account.name : ''}
        </AppText>
      </View>
    </PressFeedback>
    <View style={{ paddingHorizontal: 12 }}>
      <Switch value={rule.active} disabled={busy} onValueChange={onToggle}
        accessibilityLabel={(rule.active ? 'Pausar ' : 'Activar ') + rule.merchant}
        trackColor={{ false: p.line, true: p.income }} />
    </View>
  </View>;
}

function buildForecast(rules: RecurringRule[], accounts: { id: string; currency: Currency }[]) {
  const start = new Date(todayKey() + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const through = todayKey(end);
  const map = new Map<Currency, { expense: number; income: number }>();
  for (const rule of rules) {
    const account = accounts.find(item => item.id === rule.accountId);
    if (!account) continue;
    const occurrences = recurringOccurrencesThrough(rule, through).length;
    if (!occurrences) continue;
    const current = map.get(account.currency) ?? { expense: 0, income: 0 };
    current[rule.kind] += rule.amountMinor * occurrences;
    map.set(account.currency, current);
  }
  return [...map.entries()].map(([currency, value]) => ({ currency, ...value }));
}

function ForecastCard({ currency, expense, income }: { currency: Currency; expense: number; income: number }) {
  const p = usePalette();
  const max = Math.max(expense, income, 1);
  return <View style={{ gap: 9 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <AppText style={{ fontWeight: '700', flex: 1 }}>{currency}</AppText>
      <Ionicons name="calendar-outline" color={p.secondary} size={17} accessible={false} />
    </View>
    <ForecastLine label="Gastos" amount={expense} max={max} currency={currency} color={p.negative} />
    <ForecastLine label="Ingresos" amount={income} max={max} currency={currency} color={p.positive} />
  </View>;
}

function ForecastLine({ label, amount, max, currency, color }: {
  label: string; amount: number; max: number; currency: Currency; color: string;
}) {
  const p = usePalette();
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(amount / max, { duration: reduced ? 0 : 520 });
  }, [amount, max, reduced, progress]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(2, progress.value * 100)}%` as `${number}%` }));
  return <View style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <AppText secondary style={{ fontSize: 13, flex: 1 }}>{label}</AppText>
      <Money minor={amount} currency={currency} size={14} color={amount ? color : p.secondary} />
    </View>
    <View style={{ height: 6, backgroundColor: p.inset, borderRadius: 999, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 6, borderRadius: 999, backgroundColor: color }, style]} />
    </View>
  </View>;
}
