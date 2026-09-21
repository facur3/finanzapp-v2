import { router, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePalette } from '../../src/ui/theme';
import { IconButton } from '../../src/ui/components';
import { selectionHaptic } from '../../src/ui/motion';
import { tabHostOptions, tabScreenOptions } from '../../src/ui/navigation';

// Five sections, each with one meaning: Inicio (what matters now), Movimientos
// (everything recorded), Reportes (where the money went), Tarjetas (credit cards
// only) and Más, the secondary hub for everything else (accounts, budgets,
// recurring, personal debts, categories, the Assistant preview, data). Reports
// and cards are tabs, not links buried in Home; nothing else becomes a tab.
export default function TabsLayout() {
  const p = usePalette();
  // These lightweight roots stay mounted. Their visibility must not depend on
  // an interrupted opacity animation or a native detach/reattach.
  // Stack pushes and modal gestures still use the native navigator above us.
  // Sections switch instantly (no slide, no fade: the mounted-tab mitigation); a selection tick confirms the change without delaying it.
  return <Tabs {...tabHostOptions} screenListeners={({ navigation }) => ({ tabPress: () => { if (!navigation.isFocused()) selectionHaptic(); } })}
    screenOptions={{ ...tabScreenOptions,
    headerStyle: { backgroundColor: p.background },
    headerTitleStyle: { color: p.text, fontWeight: '600' }, headerShadowVisible: false,
    // The selected tab is the brand primary; the rest stay neutral. Switching is still instant.
    tabBarActiveTintColor: p.primary, tabBarInactiveTintColor: p.tertiary,
    tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
    sceneStyle: { backgroundColor: p.background } }}>
    {/* The Assistant is the first Home quick action, not a header button; Más keeps its permanent row. */}
    <Tabs.Screen name="index" options={{ title: 'Inicio',
      headerRight: () => <IconButton name="wallet-outline" label="Ver mis cuentas" onPress={() => router.push('/accounts')} />, tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="activity" options={{ title: 'Movimientos',
      headerRight: () => <IconButton name="add" label="Registrar movimiento" onPress={() => router.push('/new-entry')} />,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="reports" options={{ title: 'Reportes',
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="cards" options={{ title: 'Tarjetas',
      headerRight: () => <IconButton name="add" label="Agregar tarjeta" onPress={() => router.push('/new-card')} />,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'card' : 'card-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Más', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={size} color={color} /> }} />
  </Tabs>;
}
