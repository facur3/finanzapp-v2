import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LedgerProvider, useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, ErrorMessage } from '../src/ui/components';
import { UIProvider, usePalette, useReduceMotion } from '../src/ui/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const p = usePalette();
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.background }}>
    <SafeAreaProvider><UIProvider><LedgerProvider><Navigation /></LedgerProvider></UIProvider></SafeAreaProvider>
  </GestureHandlerRootView>;
}

function Navigation() {
  const { snapshot, error, retry } = useLedger();
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  const p = usePalette();
  const reduced = useReduceMotion();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(p.background).catch(() => {});
  }, [p.background]);
  useEffect(() => {
    // Show a recoverable error as well as the successful app; never hold the
    // native splash forever when font or database initialization fails.
    if (error || fontError || (fontsLoaded && snapshot)) void SplashScreen.hideAsync().catch(() => {});
  }, [error, fontError, fontsLoaded, snapshot !== null]);

  if (fontError || !snapshot || !fontsLoaded) return <SafeAreaView style={{ flex: 1, backgroundColor: p.background }}>
    <View style={{ flex: 1, padding: 28, justifyContent: 'center', gap: 20 }}>
      {error || fontError ? <>
        <AppText style={{ fontSize: 25, fontWeight: '700' }}>No pudimos abrir FinanzApp</AppText>
        <ErrorMessage message={error ?? 'No se pudieron cargar los recursos. Cerrá y abrí la app. Tus datos siguen guardados.'} />
        {!fontError && <ActionButton label="Volver a intentar" onPress={retry} />}
      </> : <ActivityIndicator accessibilityLabel="Abriendo tus datos" color={p.accent} />}
    </View>
  </SafeAreaView>;

  const theme = { ...(p.isDark ? DarkTheme : DefaultTheme), colors: {
    ...(p.isDark ? DarkTheme : DefaultTheme).colors,
    primary: p.accent, background: p.background, card: p.background, text: p.text, border: p.line,
  } };
  return <ThemeProvider value={theme}><View style={{ flex: 1, backgroundColor: p.background }}>
    <StatusBar style={p.isDark ? 'light' : 'dark'} />
    {error && <SafeAreaView edges={['top']} style={{ padding: 16, backgroundColor: p.surface }}>
      <ErrorMessage message={error} /><ActionButton label="Verificar de nuevo" onPress={retry} secondary />
    </SafeAreaView>}
    <Stack screenOptions={{ headerStyle: { backgroundColor: p.background }, headerTintColor: p.accent,
      headerTitleStyle: { color: p.text }, headerShadowVisible: false,
      contentStyle: { backgroundColor: p.background }, animation: reduced ? 'none' : 'default',
      headerBackButtonDisplayMode: 'minimal', gestureEnabled: true }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="account/[id]" options={{ title: 'Cuenta' }} />
      <Stack.Screen name="accounts" options={{ title: 'Cuentas' }} />
      <Stack.Screen name="entry/[id]" options={{ title: 'Movimiento' }} />
      <Stack.Screen name="undone-entries" options={{ title: 'Movimientos deshechos' }} />
      <Stack.Screen name="backup-import" options={{ title: 'Importar copia' }} />
      <Stack.Screen name="spending-detail" options={{ title: 'Gastos del período' }} />
      <Stack.Screen name="reports" options={{ title: 'Reporte mensual' }} />
      <Stack.Screen name="report-category" options={{ title: 'Categoría' }} />
      <Stack.Screen name="report-day" options={{ title: 'Gastos del día' }} />
      <Stack.Screen name="report-comparison" options={{ title: 'Comparar gastos' }} />
      <Stack.Screen name="recurring" options={{ title: 'Recurrentes' }} />
      <Stack.Screen name="budgets" options={{ title: 'Presupuestos' }} />
      <Stack.Screen name="cards" options={{ title: 'Tarjetas' }} />
      <Stack.Screen name="card/[id]" options={{ title: 'Tarjeta' }} />
      <Stack.Screen name="debts" options={{ title: 'Deudas' }} />
      <Stack.Screen name="debt/[id]" options={{ title: 'Deuda' }} />
      <Stack.Screen name="assistant-preview" options={{ title: 'Asistente', presentation: 'modal' }} />
      <Stack.Screen name="new-account" options={{ title: 'Nueva cuenta', presentation: 'modal' }} />
      <Stack.Screen name="new-entry" options={{ title: 'Nuevo movimiento', presentation: 'modal' }} />
      <Stack.Screen name="edit-entry/[id]" options={{ title: 'Editar movimiento', presentation: 'modal' }} />
      <Stack.Screen name="edit-account/[id]" options={{ title: 'Editar cuenta', presentation: 'modal' }} />
      <Stack.Screen name="new-transfer" options={{ title: 'Entre mis cuentas', presentation: 'modal' }} />
      <Stack.Screen name="new-recurring" options={{ title: 'Nuevo recurrente', presentation: 'modal' }} />
      <Stack.Screen name="edit-recurring/[id]" options={{ title: 'Editar recurrente', presentation: 'modal' }} />
      <Stack.Screen name="new-budget" options={{ title: 'Nuevo presupuesto', presentation: 'modal' }} />
      <Stack.Screen name="edit-budget/[id]" options={{ title: 'Editar presupuesto', presentation: 'modal' }} />
      <Stack.Screen name="new-card" options={{ title: 'Nueva tarjeta', presentation: 'modal' }} />
      <Stack.Screen name="edit-card/[id]" options={{ title: 'Editar tarjeta', presentation: 'modal' }} />
      <Stack.Screen name="new-debt" options={{ title: 'Nueva deuda', presentation: 'modal' }} />
      <Stack.Screen name="edit-debt/[id]" options={{ title: 'Editar deuda', presentation: 'modal' }} />
      <Stack.Screen name="edit-transfer/[id]" options={{ title: 'Editar transferencia', presentation: 'modal' }} />
      <Stack.Screen name="transfer/[id]" options={{ title: 'Transferencia' }} />
    </Stack>
  </View></ThemeProvider>;
}
