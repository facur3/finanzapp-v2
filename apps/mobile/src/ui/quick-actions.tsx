import { StyleSheet, View, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Currency } from '@finanzapp/domain';
import { AppText, PressFeedback, toneColors, useStacked, type IconName, type Tone } from './components';
import { ControlSurface, useMaterial } from './material';
import { space, usePalette, type Palette } from './theme';
import { useI18n } from '../i18n/provider';

type ActionKind = 'expense' | 'income' | 'transfer';
type Action = { kind: ActionKind; label: string; accessibilityLabel: string; icon: IconName; tone: Tone; onPress: () => void };

/** Height of a movement pill (24UX3). The pressable around it is 44 pt, so the visible capsule stays compact
 * while the target does not shrink. */
export const ACTION_PILL_HEIGHT = 40;

/** The opaque material of a movement pill, the designed state for every device without Liquid Glass (older iOS,
 * Android, Reduce Transparency): the surface step with a hairline edge, no shadow. Three quiet capsules read as tools
 * under the number, not as buttons competing with it. On iOS 26 the same geometry is regular glass. */
export function actionPillMaterial(p: Palette): ViewStyle {
  return { backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,12,0.10)' };
}

/** The three ways to record money, as one row of compact pills (24UX3; they were four round actions with the
 * Assistant first). Equal widths, the label in ink and the glyph in its meaning's colour where one exists (income
 * positive green); an expense is ink and a transfer the neutral secondary ink (decision 005: red never means "spent"),
 * so the glyph and the word carry the kind, never colour alone. On a narrow iPhone the label
 * shrinks a little rather than wrapping; with accessibility text sizes the pills stack at full width and the label
 * wraps. The account detail draws this row (24UX6A: everywhere else, recording is the dock's «+» and its capture hub). */
export function QuickActions({ currency, accountId }: { currency?: Currency; accountId?: string }) {
  const { t } = useI18n();
  const stacked = useStacked();
  const params = { ...(accountId ? { accountId } : {}), ...(currency ? { currency } : {}) };
  const actions: Action[] = [
    { kind: 'expense', label: t('quickActions.expense'), accessibilityLabel: t('quickActions.recordExpense'), icon: 'remove', tone: 'neutral', onPress: () => router.push({ pathname: '/new-entry', params: { kind: 'expense', ...params } }) },
    { kind: 'income', label: t('quickActions.income'), accessibilityLabel: t('quickActions.recordIncome'), icon: 'add', tone: 'income', onPress: () => router.push({ pathname: '/new-entry', params: { kind: 'income', ...params } }) },
    { kind: 'transfer', label: t('quickActions.transfer'), accessibilityLabel: t('quickActions.transferBetween'), icon: 'swap-horizontal', tone: 'transfer', onPress: () => router.push({ pathname: '/new-transfer', params: accountId ? { accountId } : {} }) },
  ];
  return <View style={{ flexDirection: stacked ? 'column' : 'row', gap: space.s }}>
    {actions.map(action => <ActionPill key={action.kind} {...action} stacked={stacked} />)}
  </View>;
}

function ActionPill({ label, accessibilityLabel, icon, tone, onPress, stacked }: Action & { stacked: boolean }) {
  const p = usePalette();
  const material = useMaterial();
  return <PressFeedback accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} containerStyle={stacked ? undefined : { flex: 1, minWidth: 0 }}>
    <ControlSurface material={material} opaque={actionPillMaterial(p)}
      style={{ minHeight: ACTION_PILL_HEIGHT, borderRadius: ACTION_PILL_HEIGHT / 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: stacked ? 8 : 0 }}>
      <Ionicons name={icon} size={17} color={toneColors(p, tone).color} accessible={false} />
      <AppText variant="subhead" numberOfLines={stacked ? undefined : 1} adjustsFontSizeToFit={!stacked} minimumFontScale={0.8}
        style={{ fontWeight: '600', flexShrink: 1 }}>{label}</AppText>
    </ControlSurface>
  </PressFeedback>;
}
