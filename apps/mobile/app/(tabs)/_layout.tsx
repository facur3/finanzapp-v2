import { router, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePalette } from '../../src/ui/theme';
import { IconButton } from '../../src/ui/components';
import { tabHostOptions, tabScreenOptions } from '../../src/ui/navigation';

export default function TabsLayout() {
  const p = usePalette();
  // These three lightweight roots stay mounted. Their visibility must not
  // depend on an interrupted opacity animation or a native detach/reattach.
  // Stack pushes and modal gestures still use the native navigator above us.
  return <Tabs {...tabHostOptions} screenOptions={{ ...tabScreenOptions,
    headerStyle: { backgroundColor: p.background },
    headerTitleStyle: { color: p.text, fontWeight: '600' }, headerShadowVisible: false,
    tabBarActiveTintColor: p.accent, tabBarInactiveTintColor: p.secondary,
    tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line },
    sceneStyle: { backgroundColor: p.background } }}>
    <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="activity" options={{ title: 'Movimientos',
      headerRight: () => <IconButton name="add" label="Registrar movimiento" onPress={() => router.push('/new-entry')} />,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'options' : 'options-outline'} size={size} color={color} /> }} />
  </Tabs>;
}
