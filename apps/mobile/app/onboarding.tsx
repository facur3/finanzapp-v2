import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LEDGER_CURRENCIES, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, PressFeedback } from '../src/ui/components';
import { ChoiceScreen } from '../src/ui/choice-screen';
import { LocaleChooser } from '../src/ui/locale-choosers';
import { showsPreference } from '../src/ui/locale-options';
import { useDisplayCurrency } from '../src/ui/display-currency-provider';
import { ValueTransition } from '../src/ui/motion';
import { currencyStepOptions, markOnboardingDone, nextStep, onboardingSteps, previousStep, stepPosition, suggestedDisplayCurrency,
  type OnboardingStep } from '../src/ui/onboarding-flow';
import { space, usePalette } from '../src/ui/theme';
import { defaultPreferenceStore } from '../src/i18n/preference';
import { useI18n, useLocalePreferences } from '../src/i18n/provider';

/** The first opening (Producto 25B): welcome, language, region, the currency of the totals, an optional first
 * account. One route, one screen that changes step in place (the same `ValueTransition` as Inicio's number, a fade
 * under Reduce Motion), no header and no back swipe: the flow is not a stack. Every step has Omitir at the top,
 * which ends the whole setup writing nothing, and Continuar at the bottom, which keeps what is chosen and goes
 * on. Language and region are the same choosers as Más (they save on a tap, and the app re-titles itself in the
 * new language in place); the currency step is the same `ChoiceScreen` over the build's 146 currencies with the
 * region's suggestion pinned; the account step opens the normal New account form as a modal and moves on by itself
 * once an account exists. Nothing here reads or writes the ledger; the existing person never sees it
 * (`onboardingDecision` in `_layout.tsx`). The hardware back of Android steps back (`BackHandler`, a no-op on iOS). */
export default function OnboardingScreen() {
  const { snapshot, gate = LEDGER_CURRENCIES } = useLedger();
  const { t, locale, currencyName } = useI18n();
  const preferences = useLocalePreferences();
  const p = usePalette();
  const display = useDisplayCurrency([]);
  const showsRegion = !!preferences && showsPreference('region', preferences.state);
  const steps = useMemo(() => onboardingSteps(showsRegion), [showsRegion]);
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const detectedRegion = preferences?.state.region ?? null;
  const suggested = useMemo(() => suggestedDisplayCurrency(detectedRegion, gate), [detectedRegion, gate]);
  const [currency, setCurrency] = useState<Currency | null>(null);
  const chosen = currency ?? suggested;
  const finish = () => { markOnboardingDone(defaultPreferenceStore); router.replace('/'); };
  const advance = () => { const next = nextStep(step, steps); if (next) setStep(next); else finish(); };
  const continueWith = () => {
    // The display currency is a choice only once the person continues with it; skipping writes nothing.
    if (step === 'currency') { display.setCurrency(chosen); display.setMode('consolidated'); }
    advance();
  };
  // An account created from the last step (the modal closes over this screen) ends the setup by itself.
  const accounts = snapshot?.accounts.length ?? 0;
  useEffect(() => { if (step === 'account' && accounts > 0) finish(); }, [step, accounts]);
  // Android: the hardware back goes to the previous step, never out of the setup (iOS has no such button; a no-op there).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { const back = previousStep(step, steps); if (back) setStep(back); return true; });
    return () => subscription.remove();
  }, [step, steps]);

  const position = stepPosition(step, steps);
  const currencyRows = useMemo(() => step === 'currency' ? currencyStepOptions(suggested, gate, locale, t('onboarding.currency.suggested')) : null,
    [step, suggested, gate, locale, t]);
  const heading = (title: string, detail: string) => <View style={{ gap: 6, paddingHorizontal: space.xl, paddingBottom: space.m }}>
    {position && <AppText secondary variant="eyebrow">{t('onboarding.step', position)}</AppText>}
    <AppText accessibilityRole="header" variant="title1">{title}</AppText>
    <AppText secondary variant="subhead">{detail}</AppText>
  </View>;
  const footer = (children: ReactNode) => <View style={{ paddingHorizontal: space.xl, paddingTop: space.m, gap: space.s }}>{children}</View>;

  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.background }}>
    <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.xl, minHeight: 44, alignItems: 'center' }}>
      <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('onboarding.skipAllLabel')} hitSlop={8} onPress={finish}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
        <AppText variant="subhead" style={{ color: p.primary, fontWeight: '600' }}>{t('onboarding.skipAll')}</AppText>
      </PressFeedback>
    </View>
    <ValueTransition id={step} variant="fade" style={{ flex: 1 }}>
      {step === 'welcome' && <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: space.l }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 10, paddingHorizontal: space.xl }}>
          <AppText accessibilityRole="header" variant="largeTitle">{t('onboarding.welcome.title')}</AppText>
          <AppText secondary style={{ maxWidth: 360 }}>{t('onboarding.welcome.detail')}</AppText>
        </View>
        {footer(<ActionButton label={t('onboarding.welcome.start')} onPress={advance} />)}
      </View>}
      {step === 'language' && <View style={{ flex: 1, paddingBottom: space.l }}>
        {heading(t('onboarding.language.title'), t('onboarding.language.detail'))}
        <View style={{ flex: 1 }}><LocaleChooser kind="language" /></View>
        {footer(<ActionButton label={t('onboarding.continue')} onPress={continueWith} />)}
      </View>}
      {step === 'region' && <View style={{ flex: 1, paddingBottom: space.l }}>
        {heading(t('onboarding.region.title'), t('onboarding.region.detail'))}
        <View style={{ flex: 1 }}><LocaleChooser kind="region" /></View>
        {footer(<ActionButton label={t('onboarding.continue')} onPress={continueWith} />)}
      </View>}
      {step === 'currency' && currencyRows && <View style={{ flex: 1, paddingBottom: space.l }}>
        {heading(t('onboarding.currency.title'), t('onboarding.currency.detail'))}
        <View style={{ flex: 1 }}>
          <ChoiceScreen<Currency> title={t('onboarding.currency.title')} pinned={currencyRows.pinned} options={currencyRows.options} selected={chosen}
            onChoose={code => { setCurrency(code); return true; }} onConfirm={continueWith} />
        </View>
        {footer(<ActionButton label={t('onboarding.continue')} spokenLabel={t('onboarding.continue') + ', ' + currencyName(chosen)} onPress={continueWith} />)}
      </View>}
      {step === 'account' && <View style={{ flex: 1, justifyContent: 'space-between', paddingBottom: space.l }}>
        {heading(t('onboarding.account.title'), t('onboarding.account.detail'))}
        {footer(<>
          <ActionButton label={t('onboarding.account.create')} icon="add-outline" onPress={() => router.push({ pathname: '/new-account', params: { currency: chosen } })} />
          <ActionButton label={t('onboarding.account.later')} secondary onPress={finish} />
        </>)}
      </View>}
    </ValueTransition>
  </SafeAreaView>;
}
