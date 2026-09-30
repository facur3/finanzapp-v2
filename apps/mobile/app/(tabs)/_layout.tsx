import { router, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePalette } from '../../src/ui/theme';
import { IconButton } from '../../src/ui/components';
import { FloatingTabBar } from '../../src/ui/floating-tab-bar';
import { selectionHaptic } from '../../src/ui/motion';
import { tabHostOptions, tabScreenOptions } from '../../src/ui/navigation';
import { useI18n } from '../../src/i18n/provider';

// Five sections, each with one meaning: Inicio (what matters now), Movimientos
// (everything recorded), Asistente (talking about your money, in the centre so
// either thumb reaches it from anywhere), Reportes (where the money went) and
// Más, the secondary hub for everything else (accounts, cards, budgets,
// recurring, personal debts, categories, data). The Assistant is a
// product-defining interaction mode, so it holds the most reachable slot;
// Tarjetas is a first-class Finanzas row under Más. Nothing else becomes a tab.
export default function TabsLayout() {
  const p = usePalette();
  // Tab labels and headers come from the catalogue: a language change re-labels the mounted tabs in place.
  const { t } = useI18n();
  // These lightweight roots stay mounted. Their visibility must not depend on
  // an interrupted opacity animation or a native detach/reattach.
  // Stack pushes and modal gestures still use the native navigator above us.
  // Sections switch instantly (no slide, no fade: the mounted-tab mitigation); a selection tick confirms the change without delaying it.
  // 24UX6A: the bar is a floating capsule (`FloatingTabBar`: the app's glass or opaque material, a cobalt selected tab over
  // a neutral lens, labels always shown); the five destinations and their order are unchanged.
  return <Tabs {...tabHostOptions} tabBar={props => <FloatingTabBar {...props} />}
    screenListeners={({ navigation }) => ({ tabPress: () => { if (!navigation.isFocused()) selectionHaptic(); } })}
    screenOptions={{ ...tabScreenOptions,
    headerStyle: { backgroundColor: p.background },
    headerTitleStyle: { color: p.text, fontWeight: '600' }, headerShadowVisible: false,
    sceneStyle: { backgroundColor: p.background } }}>
    {/* 24UX6A: Inicio has no root title (the selected tab already names it; the number is the screen's title) and draws its
        accounts shortcut beside its own controls. Its capture button also reaches the Assistant; this tab is its home. */}
    <Tabs.Screen name="index" options={{ title: t('nav.tabs.home'), headerShown: false,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="activity" options={{ title: t('nav.tabs.activity'),
      headerRight: () => <IconButton name="add" label={t('nav.recordMovement')} onPress={() => router.push('/new-entry')} />,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="assistant" options={{ title: t('nav.tabs.assistant'),
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="reports" options={{ title: t('nav.tabs.reports'),
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: t('nav.tabs.more'), tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'} size={size} color={color} /> }} />
  </Tabs>;
}
