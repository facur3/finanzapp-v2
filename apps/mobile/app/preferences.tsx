import { View } from 'react-native';
import { router } from 'expo-router';
import { LEDGER_CURRENCIES } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, GlyphTile, NavigationRow, Screen, Surface } from '../src/ui/components';
import { useMaterialDecision } from '../src/ui/material';
import { MATERIAL_LABELS } from '../src/ui/material-policy';
import { useThemePreference } from '../src/ui/theme';
import { useI18n, useLocalePreferences } from '../src/i18n/provider';
import { previewOnlyCurrencies } from '../src/storage/currency-gate';
import { preferenceSummary, shownRegion, showsPreference } from '../src/ui/locale-options';
import { LanguageMark, RegionMark } from '../src/ui/marks';
import { BUILD_QA_PROFILE } from '../src/dev/qa-profile';

declare const __DEV__: boolean | undefined;
// Diagnostic: where this launch read the device languages. "módulo nativo" proves the build links expo-localization.
const LOCALE_SOURCE_LABELS = { native: 'settings.localeSource.native', intl: 'settings.localeSource.intl', none: 'settings.localeSource.none' } as const;
/** The pilot's version and the internal release name; neither is translated. */
const VERSION = '0.1.0', RELEASE = '25R1';
/** 24UX5: the material and locale diagnostics are for a tester on a development build; everyone else sees the version,
 * like the About line of an iOS app. `__DEV__` is false in a preview or store bundle, so the line is compiled away. */
const DIAGNOSTICS = typeof __DEV__ !== 'undefined' && __DEV__;

/** Ajustes (Producto 25N1): what configures the app rather than the ledger, pushed from the gear of Finanzas' navigation
 * bar. Three groups under small caps labels: Preferencias (Idioma, Región, Apariencia: device settings), Tus datos (Copia
 * de seguridad) and Acerca de (Licencias); the version line and a development build's diagnostics as a quiet footer. The
 * rows, their subtitles, their marks and the routes they open are Más' before 25N1, unchanged. Región shows because two
 * regions are released (Producto 23.1C2) and hides itself in a build with a single one (`showsPreference`). Idioma leads
 * with the flag of the variety its copy is written in, Región with the flag of the region its subtitle names (25O1). */
export default function PreferencesScreen() {
  const { gate = LEDGER_CURRENCIES } = useLedger();
  // Which control material this session draws and why: lets a tester confirm the opaque or glass mode without guessing.
  const material = useMaterialDecision();
  const { localeSource, t } = useI18n();
  // A development bundle started with EXPO_PUBLIC_CURRENCY_PREVIEW=1 names its extra currencies here, so a tester never mistakes it for a release.
  const previewCurrencies = previewOnlyCurrencies(gate);
  const locale = useLocalePreferences();
  const { preference: appearance } = useThemePreference();
  const appearanceLabel = t(appearance === 'light' ? 'preferences.appearanceLight' : appearance === 'dark' ? 'preferences.appearanceDark' : 'preferences.appearanceSystem');
  const showsRegion = !!locale && showsPreference('region', locale.state);

  return <Screen gap={28}>
    <View style={{ gap: 8 }}>
      <GroupLabel>{t('settings.sections.preferences')}</GroupLabel>
      <Surface grouped>
        {locale && <NavigationRow title={t('preferences.language')} subtitle={preferenceSummary('language', locale.state, t)} leading={<LanguageMark language={locale.state.language} size={34} />} onPress={() => router.push('/language')} />}
        {locale && showsRegion && <NavigationRow title={t('preferences.region')} subtitle={preferenceSummary('region', locale.state, t)} leading={<RegionMark region={shownRegion(locale.state)} size={34} />} onPress={() => router.push('/region')} />}
        {/* 24UX6A: Sistema, Claro or Oscuro; a device setting like the language and the region. */}
        <NavigationRow title={t('preferences.appearance')} subtitle={appearanceLabel} leading={<GlyphTile icon="contrast-outline" size={34} />} last onPress={() => router.push('/appearance')} />
      </Surface>
    </View>
    <View style={{ gap: 8 }}>
      <GroupLabel>{t('settings.sections.yourData')}</GroupLabel>
      <Surface grouped>
        <NavigationRow title={t('settings.rows.backup')} subtitle={t('settings.rows.backupSubtitle')} leading={<GlyphTile icon="save-outline" size={34} />} last onPress={() => router.push('/backup')} />
      </Surface>
    </View>
    <View style={{ gap: 8 }}>
      <GroupLabel>{t('settings.sections.about')}</GroupLabel>
      <Surface grouped>
        <NavigationRow title={t('settings.rows.licenses')} subtitle={t('settings.rows.licensesSubtitle')} leading={<GlyphTile icon="document-text-outline" size={34} />} last onPress={() => router.push('/licenses')} />
      </Surface>
    </View>
    <View style={{ gap: 2 }}>
      <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>{t('settings.version', { version: VERSION, release: RELEASE })}</AppText>
      {DIAGNOSTICS && <AppText tertiary style={{ textAlign: 'center', fontSize: 13 }}>{t('settings.diagnostics', { material: t(MATERIAL_LABELS[material.reason]), source: t(LOCALE_SOURCE_LABELS[localeSource]) })}</AppText>}
    </View>
    {previewCurrencies.length > 0 && <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>{t('settings.currencyPreview', { codes: previewCurrencies.join(', ') })}</AppText>}
    {BUILD_QA_PROFILE && <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>{t('settings.qaProfile', { name: BUILD_QA_PROFILE })}</AppText>}
  </Screen>;
}

/** A group's small caps label (Forest «label.caps»): a heading for VoiceOver, quiet to the eye. */
function GroupLabel({ children }: { children: string }) {
  return <AppText accessibilityRole="header" secondary variant="eyebrow" style={{ paddingHorizontal: 4 }}>{children}</AppText>;
}
