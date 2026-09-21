import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { AppText, PressFeedback, toneColors, type IconName, type Tone } from './components';
import { space, usePalette } from './theme';

type Action = { kind: 'expense' | 'income' | 'transfer'; label: string; icon: IconName; tone: Tone; onPress: () => void };

/** The three ways money moves, as Wallet-style round actions: a soft semantic
 * tile with a glyph and a caption. Lighter than a row of filled buttons, and
 * Transferir is one tap away instead of hidden behind a switch. */
export function QuickActions({ currency, accountId }: { currency?: Currency; accountId?: string }) {
  const params = { ...(accountId ? { accountId } : {}), ...(currency ? { currency } : {}) };
  const actions: Action[] = [
    { kind: 'expense', label: 'Gasto', icon: 'remove', tone: 'expense', onPress: () => router.push({ pathname: '/new-entry', params: { kind: 'expense', ...params } }) },
    { kind: 'income', label: 'Ingreso', icon: 'add', tone: 'income', onPress: () => router.push({ pathname: '/new-entry', params: { kind: 'income', ...params } }) },
    { kind: 'transfer', label: 'Transferir', icon: 'swap-horizontal', tone: 'transfer', onPress: () => router.push({ pathname: '/new-transfer', params: accountId ? { accountId } : {} }) },
  ];
  return <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xxxl }}>
    {actions.map(action => <QuickAction key={action.kind} {...action} />)}
  </View>;
}

function QuickAction({ label, icon, tone, onPress }: Action) {
  const p = usePalette();
  const colors = toneColors(p, tone);
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label === 'Transferir' ? 'Transferir entre cuentas' : 'Registrar ' + label.toLowerCase()}
    onPress={onPress} style={{ alignItems: 'center', gap: 8, minWidth: 64 }}>
    <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft }}>
      <Ionicons name={icon} size={26} color={colors.color} accessible={false} />
    </View>
    <AppText variant="caption" style={{ fontWeight: '500', color: p.secondary }}>{label}</AppText>
  </PressFeedback>;
}
