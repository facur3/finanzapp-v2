import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText, GlyphTile, PressFeedback } from './components';
import { appearanceHex, appearanceName, type ColorChoice, type IconChoice } from './appearance';
import { tintOf } from './category-color';
import { duration, selectionHaptic } from './motion';
import { space, usePalette, useReduceMotion, type Palette } from './theme';

/** The one picker for a look, shared by accounts and categories: a preview
 * tile with the name, then Icono as a grid of round tiles and Color as a row
 * of dots. Selection is obvious (the chosen tile fills with the chosen colour
 * and gets a ring; the chosen dot gets a ring and a check), ticks one selection
 * haptic, animates only a colour change (nothing under Reduce Motion) and
 * reads to VoiceOver as radio buttons with real names: "Banco", "Celeste". */
export function IconColorPicker({ icons, colors, icon, color, onIconChange, onColorChange, disabled = false, previewLabel }: {
  icons: readonly IconChoice[]; colors: readonly ColorChoice[]; icon: string; color: string;
  onIconChange: (id: string) => void; onColorChange: (id: string) => void; disabled?: boolean;
  /** The object's name, shown beside the preview tile. */
  previewLabel?: string;
}) {
  const p = usePalette();
  const hex = appearanceHex(color, p);
  const current = icons.find(item => item.id === icon) ?? icons[0];
  return <View style={{ gap: space.l }}>
    <View accessible accessibilityLabel={`Vista previa: ${current.name} en ${appearanceName(color)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: p.surface }}>
      <GlyphTile icon={current.glyph} color={hex} size={52} large />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText numberOfLines={2} style={{ fontWeight: '600' }}>{previewLabel?.trim() || 'Sin nombre'}</AppText>
        <AppText secondary variant="footnote">{current.name} · {appearanceName(color)}</AppText>
      </View>
    </View>
    <View style={{ gap: 10 }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>Icono</AppText>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {icons.map(item => <IconOption key={item.id} item={item} selected={item.id === icon} hex={hex} disabled={disabled} p={p}
          onPress={() => { if (item.id !== icon) { selectionHaptic(); onIconChange(item.id); } }} />)}
      </View>
    </View>
    <View style={{ gap: 10 }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>Color</AppText>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {colors.map(item => <ColorOption key={item.id} item={item} selected={item.id === color} disabled={disabled} p={p}
          onPress={() => { if (item.id !== color) { selectionHaptic(); onColorChange(item.id); } }} />)}
      </View>
    </View>
  </View>;
}

function IconOption({ item, selected, hex, disabled, onPress, p }: { item: IconChoice; selected: boolean; hex: string; disabled: boolean; onPress: () => void; p: Palette }) {
  const reduced = useReduceMotion();
  return <PressFeedback accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{ selected, checked: selected, disabled }}
    disabled={disabled} onPress={onPress} hitSlop={2} style={styles.option}>
    <Animated.View style={[styles.iconTile, { backgroundColor: selected ? tintOf(hex, p) : p.inset, borderColor: selected ? hex : 'transparent',
      transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: reduced ? 0 : duration.state }]}>
      <Ionicons name={item.glyph} size={20} color={selected ? hex : p.secondary} accessible={false} />
    </Animated.View>
  </PressFeedback>;
}

function ColorOption({ item, selected, disabled, onPress, p }: { item: ColorChoice; selected: boolean; disabled: boolean; onPress: () => void; p: Palette }) {
  const reduced = useReduceMotion();
  const hex = appearanceHex(item.id, p);
  return <PressFeedback accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{ selected, checked: selected, disabled }}
    disabled={disabled} onPress={onPress} hitSlop={2} style={styles.option}>
    <Animated.View style={[styles.ring, { borderColor: selected ? hex : 'transparent', transitionProperty: 'borderColor', transitionDuration: reduced ? 0 : duration.state }]}>
      <View style={[styles.dot, { backgroundColor: hex }]}>
        {selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" accessible={false} />}
      </View>
    </Animated.View>
  </PressFeedback>;
}

/** Six columns of 44 pt targets fit a 393 pt screen with the page gutters. */
export const PICKER_COLUMNS = 6;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  iconTile: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  ring: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
