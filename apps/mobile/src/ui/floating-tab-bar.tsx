import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useI18n } from '../i18n/provider';
import { CaptureAction } from './capture-hub';
import { PressFeedback } from './components';
import { DOCK, dockSide, tabBarBottomGap } from './dock-geometry';
import { ControlSurface, useMaterial } from './material';
import { usePalette, type Palette } from './theme';

export { DOCK, tabBarBottomGap } from './dock-geometry';

/** The dock (Producto 24UX6A, decision 005): the four sections on a graphite pill (pine until 25VIS1) and, beside it, the «+» that opens the
 * capture hub. The destinations, their order and their meaning are the navigator's (Inicio, Movimientos, Reportes,
 * Más); the «+» is an action, not a fifth tab.
 *
 * 25UX1 (owner, 2026-10-02): the dock is the control and nothing else. It floats over the tab roots, pinned to the window's
 * bottom with no ground of its own: no band, no strip of canvas, only the pill and the «+» (the space around and between
 * them lets touches through to the content). The roots run to the window's bottom and keep their last row clear of the
 * dock through one shared clearance (`useDockInset`: bottom padding, since 25OPS1), so scrolling, the keyboard, safe areas and the last
 * row's clearance behave as before; its geometry is unchanged (the capture hub still draws its «×» where the «+» is), and
 * the tab roots stay the mounted, unanimated scenes of the black-screen mitigation (nothing in the navigator changed). The pill is drawn with the app's one control material, tinted graphite:
 * Liquid Glass where the running iOS draws it and Reduce Transparency is off, else the solid graphite pill with a hairline.
 *
 * The tabs are icon-only to the eye (the owner's decision), never to assistive technology: each is a 48 pt-plus target
 * (48 pt tall and a quarter of the pill's inner width, about 65 pt at 375 pt) that VoiceOver hears as the stock bar reads it, on iOS a button
 * named «Inicio, pestaña, 1 de 4» (React Native's `tab` role gives iOS no trait), elsewhere the `tab` role with its name;
 * «Seleccionado» for the current one. A long press shows the tab's name large in iOS's Large Content Viewer, as the
 * system bar does. The selected tab is marked twice, never by colour alone: its glyph turns filled and it sits on a
 * lighter capsule. Switching stays instant (no cross-fade until a device proves one safe), with the selection tick the
 * layout plays. */

/** The pill's solid material: the graphite fill, a hairline edge, and a soft lift on the light ground (none on black). */
export function dockMaterial(p: Palette): ViewStyle {
  return { backgroundColor: p.dock, borderWidth: StyleSheet.hairlineWidth, borderColor: p.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.10)',
    ...(p.isDark ? {} : { shadowColor: p.text, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }) };
}

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const p = usePalette();
  const material = useMaterial();
  // Pinned to the window's bottom, out of the layout, with no background: what shows around the pill and the «+» is the
  // content scrolling under them. `box-none`: the empty margins never swallow a touch meant for the content.
  return <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: DOCK.top,
    paddingBottom: tabBarBottomGap(insets.bottom), paddingHorizontal: dockSide(insets), flexDirection: 'row', alignItems: 'center', gap: DOCK.gap }}>
    <ControlSurface material={material} tint={p.dock} opaque={dockMaterial(p)} style={styles.pill}>
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
            icon={options.tabBarIcon?.({ focused, color: focused ? p.dockActiveInk : p.dockInk, size: 24 })} />;
        })}
      </View>
    </ControlSurface>
    {/* The «+»: outside the tab list, never selected, never counted as a tab. */}
    <CaptureAction />
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
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.capsule, focused ? { backgroundColor: p.dockActive } : null]}>{icon}</View>
  </PressFeedback>;
}

const styles = StyleSheet.create({
  pill: { flex: 1, minWidth: 0, minHeight: DOCK.height, borderRadius: DOCK.height / 2, paddingHorizontal: 6, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  itemContainer: { flex: 1, minWidth: 0 },
  item: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  // The selected capsule: a lighter graphite step behind the filled glyph, inside the item's full target.
  capsule: { minWidth: 56, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
