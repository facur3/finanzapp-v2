import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Platform, ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { LEDGER_CURRENCIES, draftFitsCurrency, makeAccountAppearance, minorFromLedgerDraft, validateAccount, validateAccountAppearance,
  type Account, type AccountAppearance, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { DEFAULT_LOOK } from '../src/ui/appearance';
import { ActionButton, AmountField, AppText, ErrorMessage, Field, FieldNote, NavigationRow, PressFeedback, Surface } from '../src/ui/components';
import { CurrencyField } from '../src/ui/form-controls';
import { preferenceSummary, showsPreference } from '../src/ui/locale-options';
import { useDisplayCurrency } from '../src/ui/display-currency-provider';
import { ValueTransition } from '../src/ui/motion';
import { markOnboardingDone, nextStep, onboardingDecision, previousStep, suggestedCurrency, type OnboardingStep } from '../src/ui/onboarding-flow';
import { space, usePalette } from '../src/ui/theme';
import { defaultPreferenceStore } from '../src/i18n/preference';
import { useI18n, useLocalePreferences } from '../src/i18n/provider';

/** The first opening (Producto 25B): two stages on one route, no header and no back swipe.
 *
 *   1. Welcome: the title, one sentence, and the language and region the device gave, each a quiet row that opens the
 *      Más chooser (the same screens, pushed over this one; a choice there is saved as in Más and this screen re-titles
 *      itself in the new language when it comes back). Continuar goes on; Omitir, at the top of both stages, skips the
 *      rest of the setup and keeps whatever was already saved.
 *   2. First account, optional: a name, the currency the region suggests (the searchable sheet of every form, so any
 *      of the 146 can be chosen), an optional opening balance. Crear cuenta saves through the same domain rules as the
 *      New account form and seeds the display currency of the totals with the account's currency; Ahora no ends the
 *      setup with empty data.
 *
 * Shown to a new installation only: `onboardingDecision` decides in `_layout.tsx` before the splash lifts, and again
 * here, so a link into `/onboarding` or a restored navigation on a device with data goes straight to the app and never
 * reaches an existing person's preferences. Both stages scroll (the largest Dynamic Type on a compact iPhone must still
 * reach the buttons); the step change is the same fade as Inicio's number (a plain fade under Reduce Motion). Android's
 * hardware back steps back, never out (`BackHandler`, a no-op on iOS). */
export default function OnboardingScreen() {
  const { snapshot, gate = LEDGER_CURRENCIES, addAccount } = useLedger();
  const { t, currencyName } = useI18n();
  const preferences = useLocalePreferences();
  const p = usePalette();
  const display = useDisplayCurrency([]);
  // The guard: decided once, when this screen mounts, from the same rule as the layout.
  const [eligible] = useState(() => onboardingDecision(defaultPreferenceStore, (snapshot?.accounts.length ?? 0) > 0) === 'new');
  useEffect(() => { if (!eligible) router.replace('/'); }, [eligible]);
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const region = preferences?.state.region ?? null;
  const suggested = suggestedCurrency(region, gate);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ account: Account; appearance: AccountAppearance } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const chosen = currency ?? suggested;
  const finish = () => { markOnboardingDone(defaultPreferenceStore); router.replace('/'); };
  const advance = () => { const next = nextStep(step); if (next) setStep(next); else finish(); };
  // Android: the hardware back goes to the previous stage, never out of the setup (iOS has no such button; a no-op there).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { const back = previousStep(step); if (back) setStep(back); return true; });
    return () => subscription.remove();
  }, [step]);

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      // The same validation and the same retry rule as the New account form: a failed write keeps the draft and its
      // operation id, so retrying can never create the account twice.
      let submission = pending;
      if (!submission) {
        const account: Account = { ...operation, name: name.trim(), currency: chosen, openingMinor: minorFromLedgerDraft(opening.trim() || '0', chosen) };
        validateAccount(account);
        const appearance = makeAccountAppearance(account.id, DEFAULT_LOOK.icon, DEFAULT_LOOK.color, operation.createdAt);
        validateAccountAppearance(appearance, [account]);
        submission = { account, appearance };
        setPending(submission);
      }
      await addAccount(submission.account, submission.appearance);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // The first account's currency is the first suggestion for the totals: the display currency, consolidated
      // (docs/currency.md §2.9); the person changes it later from the chip. Language and region are untouched.
      display.setCurrency(submission.account.currency);
      display.setMode('consolidated');
      saving.current = false;
      finish();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'accounts.form.saveFailed');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!eligible) return null;
  const locked = busy || !!pending;
  const showsRegion = !!preferences && showsPreference('region', preferences.state);
  const stage = (children: ReactNode, footer: ReactNode) => <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: space.xl, paddingTop: space.m, gap: space.xl }}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">
    <View style={{ flex: 1, gap: space.xl }}>{children}</View>
    <View style={{ gap: space.s, paddingTop: space.m }}>{footer}</View>
  </ScrollView>;

  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.background }}>
    <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.xl, minHeight: 44, alignItems: 'center' }}>
      <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('onboarding.skipLabel')} accessibilityHint={t('onboarding.skipHint')} hitSlop={8}
        disabled={busy} onPress={finish} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
        <AppText variant="subhead" style={{ color: p.primary, fontWeight: '600' }}>{t('onboarding.skip')}</AppText>
      </PressFeedback>
    </View>
    <ValueTransition id={step} variant="fade" style={{ flex: 1 }}>
      {step === 'welcome' && stage(<>
        <View style={{ gap: 10, paddingTop: space.xxl }}>
          <AppText accessibilityRole="header" variant="largeTitle">{t('onboarding.welcome.title')}</AppText>
          <AppText secondary style={{ maxWidth: 360 }}>{t('onboarding.welcome.detail')}</AppText>
        </View>
        {preferences && <View style={{ gap: space.s }}>
          <Surface grouped>
            <NavigationRow title={t('preferences.language')} subtitle={preferenceSummary('language', preferences.state, t)} icon="language-outline" last={!showsRegion}
              onPress={() => router.push('/language')} />
            {showsRegion && <NavigationRow title={t('preferences.region')} subtitle={preferenceSummary('region', preferences.state, t)} icon="globe-outline" last
              onPress={() => router.push('/region')} />}
          </Surface>
          <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>{t('onboarding.welcome.detected')}</AppText>
        </View>}
      </>, <ActionButton label={t('onboarding.continue')} onPress={advance} />)}
      {step === 'account' && stage(<>
        <View style={{ gap: 6 }}>
          <AppText accessibilityRole="header" variant="title1">{t('onboarding.account.title')}</AppText>
          <AppText secondary variant="subhead">{t('onboarding.account.detail')}</AppText>
        </View>
        <Field label={t('accounts.form.name')} value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" editable={!locked}
          placeholder={t('accounts.form.namePlaceholder')} />
        <CurrencyField value={chosen} onChange={setCurrency} disabled={locked} currencies={gate} />
        <FieldNote>{currency === null || currency === suggested ? t('onboarding.account.suggested', { name: currencyName(suggested) }) : t('onboarding.account.ownCurrency')}</FieldNote>
        <AmountField label={t('onboarding.account.opening')} currency={chosen} value={opening} onChangeText={value => { setOpening(value); setError(null); }}
          keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!locked} />
        <FieldNote help={{ title: t('accounts.form.openingBalance'), detail: t('accounts.form.openingHelp') }}>{t('accounts.form.openingNote')}</FieldNote>
        <ErrorMessage message={error} />
        {pending && error && <AppText secondary style={{ fontSize: 13 }}>{t('accounts.form.retryNote')}</AppText>}
      </>, <>
        <ActionButton label={pending && error ? t('common.retrySave') : t('onboarding.account.create')} onPress={save} busy={busy}
          disabled={!name.trim() || !draftFitsCurrency(opening, chosen).ok} />
        <ActionButton label={t('onboarding.account.later')} secondary onPress={finish} disabled={busy} />
      </>)}
    </ValueTransition>
  </SafeAreaView>;
}
