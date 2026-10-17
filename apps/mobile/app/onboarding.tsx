import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, Keyboard, Platform, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent,
  type Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, Stack, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { setStatusBarStyle } from 'expo-status-bar';
import { randomUUID } from 'expo-crypto';
import { LEDGER_CURRENCIES, draftFitsCurrency, makeAccountAppearance, minorFromLedgerDraft, validateAccount, validateAccountAppearance,
  type Account, type AccountAppearance, type Currency } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { DEFAULT_LOOK, accountGlyph } from '../src/ui/appearance';
import { ActionButton, AmountField, AppText, ErrorMessage, Field, GlyphTile, IconButton, NavigationRow, PressFeedback, Surface } from '../src/ui/components';
import { idleBarColor } from '../src/ui/charts';
import { CurrencyChip } from '../src/ui/currency-chip';
import { InlineFlag } from '../src/ui/marks';
import { languageName, regionName, showsPreference } from '../src/ui/locale-options';
import { useDisplayCurrency } from '../src/ui/display-currency-provider';
import { TEXT_STYLE_MAX_SCALE, WEIGHT_WIDTH, titleFit, widestWordEm } from '../src/ui/geometry';
import { ValueTransition, duration, easeOutCss, errorHaptic, successHaptic, warningHaptic } from '../src/ui/motion';
import { AccountCard, AvailableArt, CommitmentsArt, RecordArt } from '../src/ui/onboarding-art';
import { ACCOUNT_PRESETS, STORY_PAGES, markOnboardingDone, onboardingDecision, previousStep, suggestedCurrency, type AccountPreset,
  type OnboardingStep } from '../src/ui/onboarding-flow';
import { radius, space, type, usePalette, useReduceMotion } from '../src/ui/theme';
import { languageFlag, regionFlag } from '../src/i18n/flags';
import { defaultPreferenceStore } from '../src/i18n/preference';
import { useI18n, useLocalePreferences } from '../src/i18n/provider';

/** The story's pages: an illustration and a headline each (`lead`, then `emphasis` in the brand colour). */
const STORY = [
  { art: RecordArt, lead: 'onboarding.story.record.lead', emphasis: 'onboarding.story.record.emphasis' },
  { art: CommitmentsArt, lead: 'onboarding.story.commitments.lead', emphasis: 'onboarding.story.commitments.emphasis' },
  { art: AvailableArt, lead: 'onboarding.story.available.lead', emphasis: 'onboarding.story.available.emphasis' },
] as const;
const PRESETS = Object.keys(ACCOUNT_PRESETS) as AccountPreset[];
/** VoiceOver moves to the new title once the step's fade has settled. */
const FOCUS_DELAY = 250;

/** The first opening (Producto 25B; 25O1, «Primera impresión»): four steps on one route, no header and no back swipe.
 *
 *   1. The story: three pages, swiped or stepped with Siguiente, each a small scene of the app drawn from fixed sample
 *      figures (`onboarding-art.tsx`) over a short headline; a three-segment progress at the top.
 *   2. «¿Dónde tenés tu plata?»: three answers (cash, a bank, a digital wallet), each a preset of the first account; under
 *      them the region and the language as two quiet pills that open the Más choosers (pushed over this screen; a choice
 *      there is saved as in Más and this screen re-titles itself in the new language), and «Restaurar una copia», which
 *      opens the import: back here with an account in the ledger, the setup ends and never asks for a duplicate.
 *   3. The opening balance of that account: the question, the currency chip (the region's suggestion, any of the gate's),
 *      the amount and the name, prefilled and editable. Crear cuenta saves through the same domain rules as Nueva cuenta
 *      (a failed write keeps the draft and its operation id) and seeds the display currency of the totals.
 *   4. The close, on the sapphire field Inicio opens with: the account as a card, «Todo listo.» and Empezar.
 *
 * Omitir, at the top of the first three, skips the rest and keeps whatever was already saved. Shown to a new installation
 * only: `onboardingDecision` decides in `_layout.tsx` before the splash lifts, and again here, so a link into
 * `/onboarding` or a restored navigation on a device with data goes straight to the app and never reaches an existing
 * person's preferences. The splash lifts on this screen's first layout, so nothing under it is ever seen. Every step
 * scrolls (the largest Dynamic Type on a compact iPhone must still reach its buttons); a step change is the same fade as
 * Inicio's number, after which VoiceOver moves to the new title. Android's hardware back steps back, never out. */
export default function OnboardingScreen() {
  const { snapshot, gate = LEDGER_CURRENCIES, addAccount } = useLedger();
  const { t, failureMessage, speechLanguage } = useI18n();
  const preferences = useLocalePreferences();
  const p = usePalette();
  const reduced = useReduceMotion();
  const { width, fontScale } = useWindowDimensions();
  const display = useDisplayCurrency([]);
  const hasAccounts = (snapshot?.accounts.length ?? 0) > 0;
  // The guard: decided once, when this screen mounts, from the same rule as the layout.
  const [eligible] = useState(() => onboardingDecision(defaultPreferenceStore, hasAccounts) === 'new');
  const [step, setStep] = useState<OnboardingStep>('story');
  const [page, setPage] = useState(0);
  // The furthest page reached (its scene has played) and whether the story was left and opened again (every scene still).
  const [reached, setReached] = useState(0);
  const [returned, setReturned] = useState(false);
  const [preset, setPreset] = useState<AccountPreset>('cash');
  const region = preferences?.state.region ?? null;
  const suggested = suggestedCurrency(region, gate);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency | null>(null);
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ account: Account; appearance: AccountAppearance } | null>(null);
  const [created, setCreated] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const pager = useRef<ScrollView>(null);
  const titles = useRef<Partial<Record<string, Text | null>>>({});
  const lifted = useRef(false);
  const chosen = currency ?? suggested;
  const locked = busy || !!pending;

  const finish = () => { markOnboardingDone(defaultPreferenceStore); router.replace('/'); };
  // 25O1: the native splash lifts once this screen has drawn (the layout keeps it up for a new installation), so the tabs
  // mounted under it are never seen; a screen that redirects lifts it at once.
  const liftSplash = () => { if (!lifted.current) { lifted.current = true; void SplashScreen.hideAsync().catch(() => {}); } };
  useEffect(() => { if (!eligible) { liftSplash(); router.replace('/'); } }, [eligible]);
  // 25O1: back from the import with an account in the ledger (a copy restored), the setup is over: never a duplicate first account.
  // 25O1 review: also when the accounts arrive while the story or «¿Dónde tenés tu plata?» is in front (a read retried from the
  // banner, a return to the app); under the import they wait for back, and the account step's own save still reaches the close.
  useFocusEffect(useCallback(() => { if (eligible && hasAccounts && (step === 'story' || step === 'start')) finish(); }, [eligible, hasAccounts, step]));
  // The close is the field's own colour under the status bar; every other step the scheme's.
  useEffect(() => { if (eligible) setStatusBarStyle(step === 'done' ? p.heroStatusBar : p.isDark ? 'light' : 'dark', true); }, [step, p.isDark, p.heroStatusBar]);
  // 25O1: a step or page changes in place, with no navigation event, so VoiceOver is moved to the new title once it is up.
  const focusKey = step === 'story' ? 'story' + page : step;
  const focusArmed = useRef(false);
  useEffect(() => {
    if (!focusArmed.current) { focusArmed.current = true; return; }
    const timer = setTimeout(() => { const title = titles.current[focusKey]; if (title) AccessibilityInfo.sendAccessibilityEvent(title, 'focus'); }, FOCUS_DELAY);
    return () => clearTimeout(timer);
  }, [focusKey]);
  const titleRef = (key: string) => (node: Text | null) => { titles.current[key] = node; };

  const showPage = (next: number) => { setPage(next); setReached(current => Math.max(current, next)); };
  const goToPage = (next: number) => { pager.current?.scrollTo({ x: next * width, animated: !reduced }); showPage(next); };
  const forward = () => { if (page < STORY_PAGES - 1) goToPage(page + 1); else setStep('start'); };
  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next >= 0 && next < STORY_PAGES && next !== page) showPage(next);
  };
  const back = () => {
    if (step === 'story') { if (page > 0) goToPage(page - 1); return; }
    if (step === 'done') { finish(); return; }
    // A submission sent with an unknown outcome stays frozen for «Reintentar»: its account cannot be swapped for another.
    if (step === 'account' && locked) return;
    const previous = previousStep(step);
    if (previous === 'story') setReturned(true);
    if (previous) setStep(previous);
  };
  const choose = (next: AccountPreset) => { setPreset(next); setName(t(ACCOUNT_PRESETS[next].name)); setError(null); setStep('account'); };
  // Android: the hardware back mirrors the back button, page by page in the story, and never leaves the setup (a no-op on iOS).
  // 25O1 review: only while the setup is in front; a screen pushed over it (Región, Idioma, the import) keeps its own back.
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  }, [step, page, locked]));

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    // 25Q4: true once the write is sent: a failure after it taps Warning (frozen for the retry), before it Error.
    let sent = false;
    try {
      // The same validation and the same retry rule as the New account form: a failed write keeps the draft and its
      // operation id, so retrying can never create the account twice. The preset gives the icon; the colour is the default.
      let submission = pending;
      if (!submission) {
        const account: Account = { ...operation, name: name.trim(), currency: chosen, openingMinor: minorFromLedgerDraft(opening.trim() || '0', chosen) };
        validateAccount(account);
        const appearance = makeAccountAppearance(account.id, ACCOUNT_PRESETS[preset].icon, DEFAULT_LOOK.color, operation.createdAt);
        validateAccountAppearance(appearance, [account]);
        submission = { account, appearance };
        setPending(submission);
      }
      sent = true;
      await addAccount(submission.account, submission.appearance);
      successHaptic();
      // The first account's currency is the first suggestion for the totals: the display currency, consolidated
      // (docs/currency.md §2.9); the person changes it later from the chip. Language and region are untouched.
      display.setCurrency(submission.account.currency);
      display.setMode('consolidated');
      setCreated(submission.account);
      setStep('done');
    } catch (cause) {
      setError(failureMessage(cause, 'accounts.form.saveFailed'));
      if (sent) warningHaptic(); else errorHaptic();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (!eligible) return null;
  const showsRegion = !!preferences && showsPreference('region', preferences.state);
  const glyph = accountGlyph(ACCOUNT_PRESETS[preset].icon);
  // A headline grows with Dynamic Type to the Large Title's 60 pt, or less where its longest word would not fit the page
  // whole (never below its own 40 pt).
  const headlineScale = (text: string) => titleFit(fontScale, TEXT_STYLE_MAX_SCALE.display!, widestWordEm([text]), (type.display.fontSize ?? 40) * WEIGHT_WIDTH.bold,
    width - 2 * space.xxl, width - 2 * space.xxl).maxScale;
  const padded = { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.m, paddingBottom: space.l };

  const topBar = <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: space.xl }}>
    {step === 'story'
      // One VoiceOver element the bar's full height, so touch exploration finds it; the segments are 4 pt in its middle.
      ? <View accessible accessibilityRole="progressbar" accessibilityLabel={t('onboarding.page', { current: page + 1, total: STORY_PAGES })}
        accessibilityLanguage={speechLanguage} style={{ flex: 1, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {/* 25O1 review: the pages to come in the idle bars' ink, 3:1 on the canvas (the line colour was 1.3:1). */}
        {STORY.map((item, index) => <Animated.View key={item.lead} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= page ? p.text : idleBarColor(p),
          transitionProperty: 'backgroundColor', transitionDuration: reduced ? 0 : duration.state, transitionTimingFunction: easeOutCss }} />)}
      </View>
      : <View style={{ flex: 1, alignItems: 'flex-start', marginLeft: -10 }}>
        <IconButton name="chevron-back" label={t('onboarding.back')} onPress={back} disabled={step === 'account' && locked} color={p.primary} />
      </View>}
    <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('onboarding.skipLabel')} accessibilityHint={t('onboarding.skipHint')} hitSlop={8}
      disabled={busy} onPress={finish} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
      <AppText variant="subhead" style={{ color: p.primary, fontWeight: '600' }}>{t('onboarding.skip')}</AppText>
    </PressFeedback>
  </View>;

  const story = <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
    <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: page * width, y: 0 }}
      onMomentumScrollEnd={settle} style={{ flex: 1 }}>
      {STORY.map((item, index) => {
        const Art = item.art;
        const scale = headlineScale(t(item.lead) + ' ' + t(item.emphasis));
        // Only the page in front exists for VoiceOver: the others would be read off screen.
        return <ScrollView key={item.lead} style={{ width }} contentContainerStyle={{ flexGrow: 1 }} alwaysBounceVertical={false} showsVerticalScrollIndicator={false}
          accessibilityElementsHidden={index !== page} importantForAccessibility={index === page ? 'auto' : 'no-hide-descendants'}>
          <Art play={index <= reached} still={returned} currency={suggested} />
          <AppText ref={titleRef('story' + index)} accessibilityRole="header" variant="display" maxFontSizeMultiplier={scale}
            style={{ paddingHorizontal: space.xxl, paddingTop: space.m, paddingBottom: space.s }}>
            {t(item.lead)}{' '}<AppText variant="display" maxFontSizeMultiplier={scale} style={{ color: p.primary }}>{t(item.emphasis)}</AppText>
          </AppText>
        </ScrollView>;
      })}
    </ScrollView>
    <View style={{ paddingHorizontal: space.xl, paddingVertical: space.l }}>
      <ActionButton label={page < STORY_PAGES - 1 ? t('onboarding.next') : t('onboarding.continue')} onPress={forward} />
    </View>
  </SafeAreaView>;

  const start = <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={padded} alwaysBounceVertical={false}>
      <View style={{ gap: space.s, paddingHorizontal: space.xs }}>
        <AppText ref={titleRef('start')} accessibilityRole="header" variant="largeTitle">{t('onboarding.start.title')}</AppText>
        <AppText secondary>{t('onboarding.start.detail')}</AppText>
      </View>
      <Surface grouped style={{ marginTop: space.xxl }}>
        {PRESETS.map((key, index) => <NavigationRow key={key} title={t(ACCOUNT_PRESETS[key].title)} subtitle={t(ACCOUNT_PRESETS[key].detail)}
          leading={<GlyphTile icon={accountGlyph(ACCOUNT_PRESETS[key].icon)} size={48} color={p.primary} />} last={index === PRESETS.length - 1}
          onPress={() => choose(key)} />)}
      </Surface>
      <View style={{ flexGrow: 1, minHeight: space.xxl }} />
      <View style={{ alignItems: 'center', gap: 14 }}>
        {preferences && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.s }}>
          {showsRegion && <Pill label={t('onboarding.start.regionLabel', { name: regionName(preferences.state.region, preferences.state.language) })}
            hint={t('onboarding.start.regionHint')} onPress={() => router.push('/region')}>
            <InlineFlag flag={regionFlag(preferences.state.region)} size={15} />
            <AppText variant="subhead" style={{ fontWeight: '500' }}>{regionName(preferences.state.region, preferences.state.language)}</AppText>
          </Pill>}
          <Pill label={t('onboarding.start.languageLabel', { name: languageName(preferences.state.language) })} hint={t('onboarding.start.languageHint')}
            onPress={() => router.push('/language')}>
            <InlineFlag flag={languageFlag(preferences.state.language)} size={15} />
            <AppText variant="subhead" style={{ fontWeight: '500' }}>{languageName(preferences.state.language)}</AppText>
          </Pill>
        </View>}
        <PressFeedback feedback="opacity" accessibilityRole="button" accessibilityLabel={t('onboarding.start.restore')} accessibilityHint={t('onboarding.start.restoreHint')}
          onPress={() => router.push('/backup-import')} style={{ paddingHorizontal: space.s }}>
          <AppText variant="subhead" style={{ textAlign: 'center' }}>
            <AppText variant="subhead" secondary>{t('onboarding.start.restoreQuestion')}</AppText>{' '}
            <AppText variant="subhead" style={{ color: p.primary, fontWeight: '600' }}>{t('onboarding.start.restore')}</AppText>
          </AppText>
        </PressFeedback>
      </View>
    </ScrollView>
  </SafeAreaView>;

  const account = <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={padded} alwaysBounceVertical={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      <View style={{ gap: space.s, paddingHorizontal: space.xs }}>
        <View style={{ marginBottom: space.s }}><GlyphTile icon={glyph} large color={p.primary} /></View>
        <AppText ref={titleRef('account')} accessibilityRole="header" variant="largeTitle">{t(ACCOUNT_PRESETS[preset].question)}</AppText>
        <AppText secondary>{t('onboarding.account.zero')}</AppText>
      </View>
      <View style={{ gap: space.m, marginTop: space.xxl }}>
        {/* 25O1 review: the chip above the amount at every size: a seven-digit balance (1.500.000 pesos is ordinary) keeps the
            whole width at 46 pt; beside the chip it fell to about 32 pt and scrolled inside the field at 1.2× text. */}
        <View style={{ alignItems: 'flex-start', gap: space.xs, padding: space.l, borderRadius: radius.group, backgroundColor: p.surface }}>
          <CurrencyChip value={chosen} onChange={setCurrency} currencies={gate} disabled={locked} />
          <View style={{ alignSelf: 'stretch' }}>
            <AmountField bare label={t('accounts.form.openingBalance')} currency={chosen} value={opening} onChangeText={value => { setOpening(value); setError(null); }}
              keyboardType="numbers-and-punctuation" inputMode={undefined} editable={!locked} />
          </View>
        </View>
        <Field label={t('onboarding.account.name')} value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" editable={!locked} />
        <ErrorMessage message={error} />
        {pending && error && <AppText secondary variant="footnote">{t('common.retryNote', { where: t('common.retryWhere.accounts') })}</AppText>}
      </View>
      <View style={{ flexGrow: 1, minHeight: space.xxl }} />
      <ActionButton label={pending && error ? t('common.retrySave') : t('onboarding.account.create')} onPress={save} busy={busy}
        disabled={!name.trim() || !draftFitsCurrency(opening, chosen).ok} />
    </ScrollView>
  </SafeAreaView>;

  // The close fills the screen, the status bar's strip included, with the field Inicio opens with.
  const done = created && <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.hero }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.xl, paddingBottom: space.l }} alwaysBounceVertical={false}>
      {/* The card's check stands 42 pt above it. */}
      <View style={{ flexGrow: 1, justifyContent: 'center', paddingTop: 42 + space.xxl, paddingBottom: space.xxl }}>
        <AccountCard name={created.name} glyph={glyph} minor={created.openingMinor} currency={created.currency} />
      </View>
      <View style={{ gap: space.s, paddingHorizontal: space.xs }}>
        <AppText ref={titleRef('done')} accessibilityRole="header" variant="largeTitle" style={{ color: p.heroInk }}>{t('onboarding.done.title')}</AppText>
        <AppText style={{ color: p.heroSecondary }}>{t('onboarding.done.detail')}</AppText>
      </View>
      <View style={{ paddingTop: space.xxl }}><ActionButton onField label={t('onboarding.done.start')} onPress={finish} /></View>
    </ScrollView>
  </SafeAreaView>;

  return <View style={{ flex: 1, backgroundColor: p.background }} onLayout={liftSplash}>
    <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
    {step !== 'done' && <SafeAreaView edges={['top']}>{topBar}</SafeAreaView>}
    <ValueTransition id={step} variant="fade" style={{ flex: 1 }}>
      {step === 'story' ? story : step === 'start' ? start : step === 'account' ? account : done}
    </ValueTransition>
  </View>;
}

/** A quiet preference pill: 36 pt drawn, 44 pt to the finger, on the inset fill. */
function Pill({ label, hint, onPress, children }: { label: string; hint: string; onPress: () => void; children: ReactNode }) {
  const p = usePalette();
  return <PressFeedback accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} onPress={onPress} hitSlop={{ top: 4, bottom: 4 }}
    style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 18, backgroundColor: p.inset }}>{children}</PressFeedback>;
}
