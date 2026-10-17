import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePalette } from '../../src/ui/theme';
import { FloatingTabBar } from '../../src/ui/floating-tab-bar';
import { selectionHaptic } from '../../src/ui/motion';
import { tabHostOptions, tabScreenOptions } from '../../src/ui/navigation';
import { ScreenFailure } from '../../src/ui/screen-failure';
import { useI18n } from '../../src/i18n/provider';
import { useLedger } from '../../src/storage/LedgerProvider';

// Four sections, each with one meaning (decision 005, Producto 24UX6A): Inicio (the current month, what is due and
// what was recorded), Movimientos (everything recorded), Reportes (where the money went) and Finanzas (25N1, before it
// Más: accounts, cards, budgets, recurring, personal debts and categories; Ajustes is behind the gear of its bar).
// Recording is not a section: the dock's «+», beside the four tabs and never one of them, opens the capture hub
// (Asistente, Gasto, Ingreso, Transferencia), and the Assistant is a screen of the root stack reached from there.
// Tarjetas stays a row of Finanzas. Nothing else becomes a tab.
export default function TabsLayout() {
  const p = usePalette();
  // Tab labels and headers come from the catalogue: a language change re-labels the mounted tabs in place.
  const { t } = useI18n();
  // 25A-03: Finanzas (Más before 25N1) carries the number of proposals waiting in «Para revisar» (readable pending items only), none at zero.
  const { review } = useLedger();
  const pendingReview = review && review !== 'unavailable' ? review.items.length : 0;
  // These lightweight roots stay mounted. Their visibility must not depend on
  // an interrupted opacity animation or a native detach/reattach.
  // Stack pushes and modal gestures still use the native navigator above us.
  // Sections switch instantly (no slide, no fade: the mounted-tab mitigation); a selection tick confirms the change
  // without delaying it. The dock (`FloatingTabBar`) draws the four tabs icon-only on a graphite pill and the «+» beside it;
  // since 25UX1 it floats over the roots, which keep their last row clear of it (`useDockClearance`).
  // 25Q3 (Codex, PR #116): the tabs hand ScreenFailure to their own screens too, so a tab that fails to draw is replaced
  // inside this layout and the dock beside it stays, without relying on the root stack's context reaching this far.
  return <Tabs unstable_screenErrorBoundary={ScreenFailure} {...tabHostOptions} tabBar={props => <FloatingTabBar {...props} />}
    screenListeners={({ navigation }) => ({ tabPress: () => { if (!navigation.isFocused()) selectionHaptic(); } })}
    screenOptions={{ ...tabScreenOptions,
    headerStyle: { backgroundColor: p.background },
    headerTitleStyle: { color: p.text, fontWeight: '600' }, headerShadowVisible: false,
    sceneStyle: { backgroundColor: p.background } }}>
    {/* Inicio has no root title (the selected tab already names it; its month and number are the screen's title) and
        draws its accounts shortcut in its own financial field. */}
    <Tabs.Screen name="index" options={{ title: t('nav.tabs.home'), headerShown: false,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
    {/* 24UX6C: no «+» in Movimientos' header: the dock's «+» records from every tab. 25N1: the screen sets its own
        Movimientos deshechos button while something is undone (app/(tabs)/activity.tsx). */}
    <Tabs.Screen name="activity" options={{ title: t('nav.tabs.activity'),
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="reports" options={{ title: t('nav.tabs.reports'),
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={size} color={color} /> }} />
    {/* 25N1: Finanzas, with the wallet glyph; its gear to Ajustes is set by the screen itself (app/(tabs)/settings.tsx). */}
    <Tabs.Screen name="settings" options={{ title: t('nav.tabs.finances'), tabBarBadge: pendingReview || undefined, tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={color} /> }} />
  </Tabs>;
}
