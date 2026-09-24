import 'react-native-gesture-handler';
import { useEffect, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { currenciesPresent } from '@finanzapp/domain';
import { LedgerProvider, useLedger } from '../src/storage/LedgerProvider';
import { CategoryHuesProvider } from '../src/ui/category-hues';
import { ActionButton, AppText, ErrorMessage } from '../src/ui/components';
import { UIProvider, usePalette, useReduceMotion } from '../src/ui/theme';
import { HeldCurrenciesProvider, I18nProvider, useI18n } from '../src/i18n/provider';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const p = usePalette();
  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.background }}>
    <SafeAreaProvider><UIProvider><I18nProvider><LedgerProvider><LedgerCurrencies><CategoryHuesProvider><Navigation /></CategoryHuesProvider></LedgerCurrencies></LedgerProvider></I18nProvider></UIProvider></SafeAreaProvider>
  </GestureHandlerRootView>;
}

/** Tells the locale which currencies the ledger holds (ARS, USD, then by code), so a spoken
 * unit that another held currency shares is read with its full name (docs/currency.md §6). */
function LedgerCurrencies({ children }: { children: ReactNode }) {
  const { snapshot } = useLedger();
  const currencies = useMemo(() => currenciesPresent(snapshot?.accounts ?? []), [snapshot?.accounts]);
  return <HeldCurrenciesProvider currencies={currencies}>{children}</HeldCurrenciesProvider>;
}

function Navigation() {
  const { snapshot, error, retry } = useLedger();
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  const p = usePalette();
  const reduced = useReduceMotion();
  // Headers read the catalogue here, so a language change re-titles every screen in place without touching the stack.
  const { t, speechLanguage } = useI18n();
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
        <AppText variant="title1">{t('boot.openFailed')}</AppText>
        <ErrorMessage message={error ?? t('boot.resourcesFailed')} />
        {!fontError && <ActionButton label={t('boot.retry')} onPress={retry} />}
      </> : <ActivityIndicator accessibilityLabel={t('boot.opening')} accessibilityLanguage={speechLanguage} color={p.secondary} />}
    </View>
  </SafeAreaView>;

  const theme = { ...(p.isDark ? DarkTheme : DefaultTheme), colors: {
    ...(p.isDark ? DarkTheme : DefaultTheme).colors,
    primary: p.primary, background: p.background, card: p.background, text: p.text, border: p.line,
  } };
  return <ThemeProvider value={theme}><View style={{ flex: 1, backgroundColor: p.background }}>
    <StatusBar style={p.isDark ? 'light' : 'dark'} />
    {error && <SafeAreaView edges={['top']} style={{ padding: 16, backgroundColor: p.surface }}>
      <ErrorMessage message={error} /><ActionButton label={t('boot.verifyAgain')} onPress={retry} secondary />
    </SafeAreaView>}
    <Stack screenOptions={{ headerStyle: { backgroundColor: p.background }, headerTintColor: p.text,
      headerTitleStyle: { color: p.text }, headerShadowVisible: false,
      contentStyle: { backgroundColor: p.background }, animation: reduced ? 'fade' : 'default',
      headerBackButtonDisplayMode: 'minimal', gestureEnabled: true }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="account/[id]" options={{ title: t('nav.titles.account') }} />
      <Stack.Screen name="accounts" options={{ title: t('nav.titles.accounts') }} />
      <Stack.Screen name="entry/[id]" options={{ title: t('nav.titles.entry') }} />
      <Stack.Screen name="undone-entries" options={{ title: t('nav.titles.undoneEntries') }} />
      <Stack.Screen name="language" options={{ title: t('nav.titles.language') }} />
      <Stack.Screen name="region" options={{ title: t('nav.titles.region') }} />
      <Stack.Screen name="backup" options={{ title: t('nav.titles.backup') }} />
      <Stack.Screen name="backup-import" options={{ title: t('nav.titles.backupImport') }} />
      <Stack.Screen name="categories" options={{ title: t('nav.titles.categories') }} />
      <Stack.Screen name="new-category" options={{ title: t('nav.titles.newCategory'), presentation: 'modal' }} />
      <Stack.Screen name="edit-category" options={{ title: t('nav.titles.editCategory'), presentation: 'modal' }} />
      <Stack.Screen name="spending-detail" options={{ title: t('nav.titles.spendingDetail') }} />
      <Stack.Screen name="report-category" options={{ title: t('nav.titles.reportCategory') }} />
      <Stack.Screen name="report-day" options={{ title: t('nav.titles.reportDay') }} />
      <Stack.Screen name="report-comparison" options={{ title: t('nav.titles.reportComparison') }} />
      <Stack.Screen name="recurring" options={{ title: t('nav.titles.recurring') }} />
      <Stack.Screen name="budgets" options={{ title: t('nav.titles.budgets') }} />
      <Stack.Screen name="card/[id]" options={{ title: t('nav.titles.card') }} />
      <Stack.Screen name="debts" options={{ title: t('nav.titles.debts') }} />
      <Stack.Screen name="debt/[id]" options={{ title: t('nav.titles.debt') }} />
      <Stack.Screen name="cards" options={{ title: t('nav.titles.cards') }} />
      <Stack.Screen name="new-account" options={{ title: t('nav.titles.newAccount'), presentation: 'modal' }} />
      <Stack.Screen name="new-entry" options={{ title: t('nav.titles.newEntry'), presentation: 'modal' }} />
      <Stack.Screen name="edit-entry/[id]" options={{ title: t('nav.titles.editEntry'), presentation: 'modal' }} />
      <Stack.Screen name="edit-account/[id]" options={{ title: t('nav.titles.editAccount'), presentation: 'modal' }} />
      <Stack.Screen name="new-transfer" options={{ title: t('nav.titles.newTransfer'), presentation: 'modal' }} />
      <Stack.Screen name="new-recurring" options={{ title: t('nav.titles.newRecurring'), presentation: 'modal' }} />
      <Stack.Screen name="edit-recurring/[id]" options={{ title: t('nav.titles.editRecurring'), presentation: 'modal' }} />
      <Stack.Screen name="new-budget" options={{ title: t('nav.titles.newBudget'), presentation: 'modal' }} />
      <Stack.Screen name="edit-budget/[id]" options={{ title: t('nav.titles.editBudget'), presentation: 'modal' }} />
      <Stack.Screen name="new-card" options={{ title: t('nav.titles.newCard'), presentation: 'modal' }} />
      <Stack.Screen name="edit-card/[id]" options={{ title: t('nav.titles.editCard'), presentation: 'modal' }} />
      <Stack.Screen name="new-debt" options={{ title: t('nav.titles.newDebt'), presentation: 'modal' }} />
      <Stack.Screen name="edit-debt/[id]" options={{ title: t('nav.titles.editDebt'), presentation: 'modal' }} />
      <Stack.Screen name="edit-transfer/[id]" options={{ title: t('nav.titles.editTransfer'), presentation: 'modal' }} />
      <Stack.Screen name="transfer/[id]" options={{ title: t('nav.titles.transfer') }} />
    </Stack>
  </View></ThemeProvider>;
}
