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
/** Height of the Assistant entry: the one wide control under the hero, taller than a pill and shorter than a row. */
export const ASSISTANT_ENTRY_HEIGHT = 52;

/** The opaque material of a movement pill, the designed state for every device without Liquid Glass (older iOS,
 * Android, Reduce Transparency): the surface step with a hairline edge, no shadow. Three quiet capsules read as tools
 * under the number, not as buttons competing with it. On iOS 26 the same geometry is regular glass. */
export function actionPillMaterial(p: Palette): ViewStyle {
  return { backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,12,0.10)' };
}

/** The Assistant entry's opaque material: the surface barely cooled by the brand (`primaryWash`) and a hairline cobalt
 * edge. It belongs to the screen's surfaces, not to a banner; the cobalt lives in the glyph. */
export function assistantEntryMaterial(p: Palette): ViewStyle {
  return { backgroundColor: p.primaryWash, borderWidth: StyleSheet.hairlineWidth, borderColor: p.primary + (p.isDark ? '4D' : '40') };
}

/** The wash a glass control carries: cobalt at 15 % for the Assistant, none for the movements. */
export function glassTint(p: Palette, assistant: boolean): string | undefined {
  return assistant ? p.primary + '26' : undefined;
}

/** The three ways to record money, as one row of compact pills (24UX3; they were four round actions with the
 * Assistant first). Equal widths, glyph in its semantic colour (expense coral, income green, transfer azure) and the
 * label in ink, so colour carries meaning and the row stays lighter than the hero. On a narrow iPhone the label
 * shrinks a little rather than wrapping; with accessibility text sizes the pills stack at full width and the label
 * wraps. Inicio and account detail share this row; the Assistant has its own entry below it on Inicio. */
export function QuickActions({ currency, accountId }: { currency?: Currency; accountId?: string }) {
  const { t } = useI18n();
  const stacked = useStacked();
  const params = { ...(accountId ? { accountId } : {}), ...(currency ? { currency } : {}) };
  const actions: Action[] = [
    { kind: 'expense', label: t('quickActions.expense'), accessibilityLabel: t('quickActions.recordExpense'), icon: 'remove', tone: 'expense', onPress: () => router.push({ pathname: '/new-entry', params: { kind: 'expense', ...params } }) },
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

/** The Assistant on Inicio (24UX3): one wide capsule under the movements, the nearest control to the thumb in the top
 * half of the screen. It is a button, not a text field (no placeholder grey, no caret, no microphone), so it never
 * reads as search: its glyph on a small cobalt disc, one line in ink, a chevron. It navigates to the centre tab (the
 * same conversation, never a stacked copy) and carries the currency Inicio shows. */
export function AssistantEntry({ currency }: { currency?: Currency }) {
  const p = usePalette();
  const material = useMaterial();
  const { t } = useI18n();
  return <PressFeedback accessibilityRole="button" accessibilityLabel={t('quickActions.askAssistant')} accessibilityHint={t('quickActions.askAssistantHint')}
    onPress={() => router.navigate({ pathname: '/assistant', params: currency ? { currency } : {} })}>
    <ControlSurface material={material} tint={glassTint(p, true)} opaque={assistantEntryMaterial(p)}
      style={{ minHeight: ASSISTANT_ENTRY_HEIGHT, borderRadius: ASSISTANT_ENTRY_HEIGHT / 2, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingLeft: 10, paddingRight: space.l, paddingVertical: 8 }}>
      <View accessible={false} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="sparkles" size={16} color={p.primary} accessible={false} />
      </View>
      <AppText variant="subhead" style={{ flex: 1, minWidth: 0, fontWeight: '600' }}>{t('quickActions.askAssistant')}</AppText>
      <Ionicons name="chevron-forward" size={15} color={p.tertiary} accessible={false} />
    </ControlSurface>
  </PressFeedback>;
}
