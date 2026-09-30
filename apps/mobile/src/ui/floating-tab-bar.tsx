import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useI18n } from '../i18n/provider';
import { AppText, PressFeedback } from './components';
import { ControlSurface, useMaterial } from './material';
import { usePalette, type Palette } from './theme';

/** Producto 24UX6A: the five sections on one floating capsule instead of a full-width footer. The destinations, their
 * order and their meaning are the navigator's (Inicio, Movimientos, Asistente, Reportes, Más); only the shell changes.
 *
 * The capsule floats on the screen's own ground, inset from the edges and lifted above the home indicator, but the bar
 * stays in the layout (never absolutely positioned over the content): every screen still ends above it, so scrolling,
 * keyboard avoidance and the Assistant composer (which measures what lies below it) keep working as they did. It is
 * drawn with the app's one control material: Liquid Glass where the running iOS draws it and Reduce Transparency is
 * off, else the opaque surface with a hairline edge (and a soft shadow in light mode), the designed state everywhere
 * else. The selected section is a cobalt glyph and label over a neutral lens, the others stay in the secondary ink;
 * cobalt is left to interaction. Labels stay visible (a tab is never an icon to guess), capped at 1.3× the text size
 * like the other compact controls, with iOS's Large Content Viewer (a long press shows the label large, as the system
 * tab bar does), and every tab is a 48 pt target. VoiceOver hears each tab as the stock bar reads it: on iOS a button
 * named «Inicio, pestaña, 1 de 5» (React Native's `tab` role gives iOS no trait), elsewhere the `tab` role; «Seleccionado»
 * for the current one. Switching stays instant, with the selection tick the layout already plays. */

/** The capsule's geometry: its height, its distance from the screen's sides and the air above it. */
export const TAB_BAR = { height: 62, side: 16, top: 6 } as const;

/** The air under the capsule: it rests in the upper part of the home indicator's safe area (clear of the indicator),
 * and keeps a margin on an iPhone without one. */
export function tabBarBottomGap(bottomInset: number): number {
  return bottomInset > 0 ? Math.max(bottomInset - 14, 10) : 10;
}

/** The capsule's opaque material: the surface step, a hairline edge, a soft shadow on the light ground (none on black,
 * where the edge separates it). */
export function tabBarMaterial(p: Palette): ViewStyle {
  return { backgroundColor: p.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,12,0.08)',
    ...(p.isDark ? {} : { shadowColor: '#0A0A0C', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }) };
}

/** The neutral lens behind the selected tab: a state, not a colour. */
export function tabLensColor(p: Palette): string {
  return p.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,12,0.06)';
}

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const p = usePalette();
  const material = useMaterial();
  return <View style={{ backgroundColor: p.background, paddingTop: TAB_BAR.top, paddingBottom: tabBarBottomGap(insets.bottom),
    paddingHorizontal: TAB_BAR.side + Math.max(insets.left, insets.right) }}>
    <ControlSurface material={material} opaque={tabBarMaterial(p)} style={styles.capsule}>
      <View accessibilityRole="tablist" style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = index === state.index;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
          const press = () => {
            // The same events the stock bar sends, so the layout's listeners (the selection tick) keep working.
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return <TabItem key={route.key} label={label} index={index} count={state.routes.length} focused={focused} onPress={press}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            icon={options.tabBarIcon?.({ focused, color: focused ? p.primary : p.secondary, size: 24 })} />;
        })}
      </View>
    </ControlSurface>
  </View>;
}

function TabItem({ label, index, count, focused, icon, onPress, onLongPress }: {
  label: string; index: number; count: number; focused: boolean; icon: ReactNode; onPress: () => void; onLongPress: () => void;
}) {
  const p = usePalette();
  const { t, speechLanguage } = useI18n();
  const ios = Platform.OS === 'ios';
  return <PressFeedback accessibilityRole={ios ? 'button' : 'tab'} accessibilityLabel={ios ? t('nav.tabPosition', { name: label, index: index + 1, count }) : label}
    accessibilityState={{ selected: focused }} accessibilityLanguage={speechLanguage} accessibilityShowsLargeContentViewer accessibilityLargeContentTitle={label}
    onPress={onPress} onLongPress={onLongPress} containerStyle={styles.itemContainer} style={styles.item}>
    <View style={[styles.lens, focused ? { backgroundColor: tabLensColor(p) } : null]}>
      <View accessible={false} importantForAccessibility="no-hide-descendants">{icon}</View>
      <AppText accessible={false} numberOfLines={1} maxFontSizeMultiplier={1.3}
        style={{ fontSize: 11, lineHeight: 13, fontWeight: focused ? '600' : '500', color: focused ? p.primary : p.secondary }}>{label}</AppText>
    </View>
  </PressFeedback>;
}

const styles = StyleSheet.create({
  capsule: { minHeight: TAB_BAR.height, borderRadius: TAB_BAR.height / 2, paddingHorizontal: 6, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  itemContainer: { flex: 1, minWidth: 0 },
  item: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  lens: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 22, minWidth: 56 },
});
