import { View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { AppText, PressFeedback, surfaceShadow, toneColors, type IconName, type Tone } from './components';
import { space, usePalette } from './theme';

type Action = { kind: 'expense' | 'income' | 'transfer'; label: string; icon: IconName; tone: Tone; onPress: () => void };

/** The three ways money moves, as native round actions: a neutral circle (a
 * surface step in dark, white with a soft shadow in light) carrying only the
 * glyph in its semantic colour, and a caption. Colour lives in the stroke of
 * the glyph, not in a filled tile, so Home does not read as three coloured
 * buttons. Transferir is one tap away instead of hidden behind a switch. */
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
    <View style={[{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: p.isDark ? p.inset : p.surface }, surfaceShadow(p)]}>
      <Ionicons name={icon} size={24} color={colors.color} accessible={false} />
    </View>
    <AppText variant="caption" style={{ fontWeight: '500', color: p.secondary }}>{label}</AppText>
  </PressFeedback>;
}
