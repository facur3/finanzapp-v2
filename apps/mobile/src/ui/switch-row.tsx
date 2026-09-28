import { StyleSheet, Switch, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useI18n } from '../i18n/provider';
import { AppText, type IconName } from './components';
import { selectionHaptic } from './motion';
import { usePalette } from './theme';

/** Producto 24T2: one iOS switch row inside a grouped surface, for a secondary choice that reveals fields (the purchase
 * form's «Con interés», the card form's «Usar estos días todos los meses»). The native switch is the one control VoiceOver
 * focuses (its label is the row's text, its hint the optional detail), with a selection haptic on each change; the text
 * scales and wraps at every size, and the row keeps the 54 pt height of a DetailRow. */
export function SwitchRow({ label, value, onValueChange, detail, icon, disabled = false, last = false }: {
  label: string; value: boolean; onValueChange: (value: boolean) => void; detail?: string; icon?: IconName; disabled?: boolean; last?: boolean;
}) {
  const p = usePalette();
  const { speechLanguage } = useI18n();
  return <View style={[styles.row, { borderBottomColor: p.line, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
    {icon && <Ionicons name={icon} size={20} color={p.secondary} accessible={false} />}
    <View style={{ flex: 1, minWidth: 0, gap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AppText>{label}</AppText>
      {detail ? <AppText secondary variant="footnote">{detail}</AppText> : null}
    </View>
    <Switch value={value} disabled={disabled} accessibilityLabel={label} accessibilityHint={detail} accessibilityLanguage={speechLanguage}
      trackColor={{ false: p.inset, true: p.primaryFill }}
      onValueChange={next => { selectionHaptic(); onValueChange(next); }} />
  </View>;
}

const styles = StyleSheet.create({
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
});
