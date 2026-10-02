import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePalette } from '../../src/ui/theme';
import { FloatingTabBar } from '../../src/ui/floating-tab-bar';
import { selectionHaptic } from '../../src/ui/motion';
import { tabHostOptions, tabScreenOptions } from '../../src/ui/navigation';
import { useI18n } from '../../src/i18n/provider';

// Four sections, each with one meaning (decision 005, Producto 24UX6A): Inicio (the current month, what is due and
// what was recorded), Movimientos (everything recorded), Reportes (where the money went) and Más, the secondary hub
// (accounts, cards, budgets, recurring, personal debts, categories, preferences and data). Recording is not a section:
// the dock's «+», beside the four tabs and never one of them, opens the capture hub (Asistente, Gasto, Ingreso,
// Transferencia), and the Assistant is a screen of the root stack reached from there. Tarjetas stays a row of Más.
// Nothing else becomes a tab.
export default function TabsLayout() {
  const p = usePalette();
  // Tab labels and headers come from the catalogue: a language change re-labels the mounted tabs in place.
  const { t } = useI18n();
  // These lightweight roots stay mounted. Their visibility must not depend on
  // an interrupted opacity animation or a native detach/reattach.
  // Stack pushes and modal gestures still use the native navigator above us.
  // Sections switch instantly (no slide, no fade: the mounted-tab mitigation); a selection tick confirms the change
  // without delaying it. The dock (`FloatingTabBar`) draws the four tabs icon-only on a pine pill and the «+» beside it;
  // since 25UX1 it floats over the roots, which keep their last row clear of it (`useDockClearance`).
  return <Tabs {...tabHostOptions} tabBar={props => <FloatingTabBar {...props} />}
    screenListeners={({ navigation }) => ({ tabPress: () => { if (!navigation.isFocused()) selectionHaptic(); } })}
    screenOptions={{ ...tabScreenOptions,
    headerStyle: { backgroundColor: p.background },
    headerTitleStyle: { color: p.text, fontWeight: '600' }, headerShadowVisible: false,
    sceneStyle: { backgroundColor: p.background } }}>
    {/* Inicio has no root title (the selected tab already names it; its month and number are the screen's title) and
        draws its accounts shortcut in its own financial field. */}
    <Tabs.Screen name="index" options={{ title: t('nav.tabs.home'), headerShown: false,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
    {/* 24UX6C: no «+» in Movimientos' header: the dock's «+» records from every tab. */}
    <Tabs.Screen name="activity" options={{ title: t('nav.tabs.activity'),
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="reports" options={{ title: t('nav.tabs.reports'),
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: t('nav.tabs.more'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={size} color={color} /> }} />
  </Tabs>;
}
