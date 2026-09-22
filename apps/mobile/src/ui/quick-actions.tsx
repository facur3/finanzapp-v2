import { StyleSheet, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { AppText, PressFeedback, toneColors, type IconName, type Tone } from './components';
import { ControlSurface, useMaterial } from './material';
import { space, usePalette, type Palette } from './theme';

type ActionKind = 'assistant' | 'expense' | 'income' | 'transfer';
type Action = { kind: ActionKind; label: string; accessibilityLabel: string; icon: IconName; tone: Tone | 'primary'; onPress: () => void };

/** Diameter of the round action. Four of them plus gaps fit a 320 pt content width. */
export const QUICK_ACTION_SIZE = 54;

/** The opaque material of a round action, the designed state for every
 * device without Liquid Glass (older iOS, Android, Reduce Transparency).
 * Light: white with a hairline edge and the soft card shadow. Dark: a surface
 * step with a faint light edge on top, the way a control catches light. The
 * Assistant is the same object in the brand tint: a cobalt wash and a thin
 * cobalt ring, so it reads as the first of a family, not as a different kind
 * of button. On iOS 26 the same geometry is drawn as native glass (see
 * `glassTint`): regular glass for the three movements, a cobalt wash for the
 * Assistant, no ring, because the material itself carries the edge. */
export function quickActionMaterial(p: Palette, assistant: boolean): ViewStyle {
  if (assistant) return { backgroundColor: p.primarySoft, borderWidth: 1, borderColor: p.primary + (p.isDark ? '66' : '40'),
    ...(p.isDark ? {} : { shadowColor: p.primary, shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }) };
  if (p.isDark) return { backgroundColor: p.inset, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)' };
  return { backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(10,10,12,0.08)',
    shadowColor: '#0A0A0C', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } };
}

/** The wash a glass action carries: cobalt at a quarter for the Assistant, none for the movements. */
export function glassTint(p: Palette, assistant: boolean): string | undefined {
  return assistant ? p.primary + (p.isDark ? '4D' : '40') : undefined;
}

/** The ways to act on money from Home, as equal-width round actions: the
 * Assistant first (typing, and later speaking, about your money), then the
 * three movements. Each column flexes, so four fit a small iPhone and the
 * captions may wrap under large text instead of the row overflowing. Colour
 * lives in the glyph (expense coral, income green, transfer azure) on a
 * neutral material; only the Assistant carries the brand tint. Account
 * detail keeps the three movements. The whole column (circle and caption,
 * about 80 × 84 pt) is the touch target; columns never overlap. The Assistant
 * here is a discoverability shortcut: the persistent, thumb-reachable entry
 * is the centre tab, and both go to the same conversation. */
export function QuickActions({ currency, accountId, assistant = false }: { currency?: Currency; accountId?: string; assistant?: boolean }) {
  const params = { ...(accountId ? { accountId } : {}), ...(currency ? { currency } : {}) };
  const actions: Action[] = [
    ...(assistant ? [{ kind: 'assistant' as const, label: 'Asistente', accessibilityLabel: 'Abrir el Asistente', icon: 'sparkles' as const, tone: 'primary' as const,
      onPress: () => router.navigate({ pathname: '/assistant', params: currency ? { currency } : {} }) }] : []),
    { kind: 'expense', label: 'Gasto', accessibilityLabel: 'Registrar gasto', icon: 'remove', tone: 'expense', onPress: () => router.push({ pathname: '/new-entry', params: { kind: 'expense', ...params } }) },
    { kind: 'income', label: 'Ingreso', accessibilityLabel: 'Registrar ingreso', icon: 'add', tone: 'income', onPress: () => router.push({ pathname: '/new-entry', params: { kind: 'income', ...params } }) },
    { kind: 'transfer', label: 'Transferir', accessibilityLabel: 'Transferir entre cuentas', icon: 'swap-horizontal', tone: 'transfer', onPress: () => router.push({ pathname: '/new-transfer', params: accountId ? { accountId } : {} }) },
  ];
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s, marginHorizontal: -space.xs }}>
    {actions.map(action => <QuickAction key={action.kind} {...action} />)}
  </View>;
}

function QuickAction({ label, accessibilityLabel, icon, tone, onPress }: Action) {
  const p = usePalette();
  const material = useMaterial();
  const assistant = tone === 'primary';
  const color = assistant ? p.primary : toneColors(p, tone).color;
  return <PressFeedback accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} containerStyle={{ flex: 1, minWidth: 0 }}
    style={{ alignItems: 'center', gap: 8, paddingVertical: 2 }}>
    <ControlSurface material={material} tint={glassTint(p, assistant)} opaque={quickActionMaterial(p, assistant)}
      style={{ width: QUICK_ACTION_SIZE, height: QUICK_ACTION_SIZE, borderRadius: QUICK_ACTION_SIZE / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={assistant ? 22 : 24} color={color} accessible={false} />
    </ControlSurface>
    <AppText variant="caption" numberOfLines={2} style={{ fontWeight: '500', color: p.secondary, textAlign: 'center' }}>{label}</AppText>
  </PressFeedback>;
}
