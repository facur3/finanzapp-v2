import { router, Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePalette, useReduceMotion } from '../../src/ui/theme';
import { IconButton } from '../../src/ui/components';

export default function TabsLayout() {
  const p = usePalette();
  const reduced = useReduceMotion();
  return <Tabs screenOptions={{ headerStyle: { backgroundColor: p.background },
    headerTitleStyle: { color: p.text, fontWeight: '600' }, headerShadowVisible: false,
    tabBarActiveTintColor: p.accent, tabBarInactiveTintColor: p.secondary,
    tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.line },
    sceneStyle: { backgroundColor: p.background }, animation: reduced ? 'none' : 'fade' }}>
    <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="activity" options={{ title: 'Movimientos',
      headerRight: () => <IconButton name="add" label="Registrar movimiento" onPress={() => router.push('/new-entry')} />,
      tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'options' : 'options-outline'} size={size} color={color} /> }} />
  </Tabs>;
}
