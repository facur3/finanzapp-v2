import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, todayKey, LEDGER_CURRENCIES } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { FINANCE_ROW_LOOKS, appearanceHex } from '../../src/ui/appearance';
import { AppText, GlyphTile, NavigationRow, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { useMaterialDecision } from '../../src/ui/material';
import { MATERIAL_LABELS } from '../../src/ui/material-policy';
import { usePalette } from '../../src/ui/theme';
import { useI18n, useLocalePreferences } from '../../src/i18n/provider';
import { previewOnlyCurrencies } from '../../src/storage/currency-gate';
import { preferenceSummary, showsPreference } from '../../src/ui/locale-options';

declare const __DEV__: boolean | undefined;
// Diagnostic: where this launch read the device languages. "módulo nativo" proves the build links expo-localization.
const LOCALE_SOURCE_LABELS = { native: 'settings.localeSource.native', intl: 'settings.localeSource.intl', none: 'settings.localeSource.none' } as const;
/** The pilot's version and the internal release name; neither is translated. */
const VERSION = '0.1.0', RELEASE = '25B';
/** 24UX5: the material and locale diagnostics are for a tester on a development build; everyone else sees the version,
 * like the About line of an iOS app. `__DEV__` is false in a preview or store bundle, so the line is compiled away. */
const DIAGNOSTICS = typeof __DEV__ !== 'undefined' && __DEV__;

/** Más is the secondary navigation hub: everything that is not one of the four
 * other tabs, in two native grouped lists. Finanzas holds the tools that
 * shape the ledger (Tarjetas among them since the centre tab became the
 * Assistant), each with a soft tinted identity tile from the same palette
 * accounts and categories use (the row itself stays neutral); App y datos
 * stays neutral. Home only surfaces contextual information; permanent
 * navigation lives here. Idioma and Región sit in App y datos: device
 * settings, not ledger data. Región shows because two regions are released
 * (Producto 23.1C2) and hides itself in a build with a single one
 * (`showsPreference`). The route file keeps its historical name (settings). */
export default function MoreScreen() {
  const { archive, gate = LEDGER_CURRENCIES } = useLedger();
  const p = usePalette();
  // Which control material this session draws and why: lets a tester confirm the opaque or glass mode without guessing.
  const material = useMaterialDecision();
  const { localeSource, t } = useI18n();
  // A development bundle started with EXPO_PUBLIC_CURRENCY_PREVIEW=1 names its extra currencies here, so a tester never mistakes it for a release.
  const previewCurrencies = previewOnlyCurrencies(gate);
  const locale = useLocalePreferences();
  const showsRegion = !!locale && showsPreference('region', locale.state);
  const activeRecurring = archive?.recurring?.filter(rule => rule.active).length ?? 0;
  const activeDebts = archive?.debts?.filter(debt => debt.active).length ?? 0;
  const currentBudgets = archive?.budgets?.filter(budget => budget.active && budget.monthISO === currentMonthISO(todayKey())).length ?? 0;
  const customCategories = archive?.categories?.filter(definition => !definition.archived).length ?? 0;
  const activeCards = archive?.cards?.filter(card => card.active).length ?? 0;
  const undone = (archive?.records.filter(record => record.voided).length ?? 0) + (archive?.transfers?.filter(record => record.voided).length ?? 0);
  const tile = (key: keyof typeof FINANCE_ROW_LOOKS) => <GlyphTile icon={FINANCE_ROW_LOOKS[key].glyph} color={appearanceHex(FINANCE_ROW_LOOKS[key].color, p)} size={34} />;

  return <Screen>
    <View>
      <SectionTitle>{t('settings.sections.finance')}</SectionTitle>
      <Surface grouped>
        <NavigationRow title={t('settings.rows.accounts')} subtitle={t('settings.rows.accountsSubtitle')} leading={tile('accounts')} onPress={() => router.push('/accounts')} />
        <NavigationRow title={t('settings.rows.cards')} subtitle={activeCards ? t('settings.rows.cardsCount', { count: activeCards }) : t('settings.rows.cardsSubtitle')} leading={tile('cards')} onPress={() => router.push('/cards')} />
        <NavigationRow title={t('settings.rows.budgets')} subtitle={currentBudgets ? t('settings.rows.budgetsCount', { count: currentBudgets }) : t('settings.rows.budgetsSubtitle')} leading={tile('budgets')} onPress={() => router.push('/budgets')} />
        <NavigationRow title={t('settings.rows.recurring')} subtitle={activeRecurring ? t('settings.rows.recurringCount', { count: activeRecurring }) : t('settings.rows.recurringSubtitle')} leading={tile('recurring')} onPress={() => router.push('/recurring')} />
        <NavigationRow title={t('settings.rows.debts')} subtitle={activeDebts ? t('settings.rows.debtsCount', { count: activeDebts }) : t('settings.rows.debtsSubtitle')} leading={tile('debts')} onPress={() => router.push('/debts')} />
        <NavigationRow title={t('settings.rows.categories')} subtitle={customCategories ? t('settings.rows.categoriesCount', { count: customCategories }) : t('settings.rows.categoriesSubtitle')} leading={tile('categories')} last onPress={() => router.push('/categories')} />
      </Surface>
    </View>
    <View style={{ gap: 10 }}>
      <SectionTitle>{t('settings.sections.appData')}</SectionTitle>
      <Surface grouped>
        <NavigationRow title={t('settings.rows.backup')} subtitle={t('settings.rows.backupSubtitle')} icon="save-outline" onPress={() => router.push('/backup')} />
        <NavigationRow title={t('settings.rows.undone')} subtitle={undone ? t('settings.rows.undoneCount', { count: undone }) : t('settings.rows.undoneNone')} icon="arrow-undo-outline" last={!locale} onPress={() => router.push('/undone-entries')} />
        {locale && <NavigationRow title={t('preferences.language')} subtitle={preferenceSummary('language', locale.state, t)} icon="language-outline" last={!showsRegion} onPress={() => router.push('/language')} />}
        {locale && showsRegion && <NavigationRow title={t('preferences.region')} subtitle={preferenceSummary('region', locale.state, t)} icon="globe-outline" last onPress={() => router.push('/region')} />}
      </Surface>
      <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>
        {t('settings.localNote')}
      </AppText>
    </View>
    <View style={{ gap: 2 }}>
      <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>{t('settings.version', { version: VERSION, release: RELEASE })}</AppText>
      {DIAGNOSTICS && <AppText tertiary style={{ textAlign: 'center', fontSize: 13 }}>{t('settings.diagnostics', { material: t(MATERIAL_LABELS[material.reason]), source: t(LOCALE_SOURCE_LABELS[localeSource]) })}</AppText>}
    </View>
    {previewCurrencies.length > 0 && <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>{t('settings.currencyPreview', { codes: previewCurrencies.join(', ') })}</AppText>}
  </Screen>;
}
