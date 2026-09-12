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
      <Stack.Screen name="new-account" options={{ title: 'Nueva cuenta', presentation: 'modal' }} />
      <Stack.Screen name="new-entry" options={{ title: 'Nuevo movimiento', presentation: 'modal' }} />
    </Stack>
  </View></ThemeProvider>;
}
