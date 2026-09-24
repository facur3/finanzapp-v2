import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, todayKey } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { FINANCE_ROW_LOOKS, appearanceHex } from '../../src/ui/appearance';
import { AppText, GlyphTile, NavigationRow, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { useMaterialDecision } from '../../src/ui/material';
import { MATERIAL_LABELS } from '../../src/ui/material-policy';
import { usePalette } from '../../src/ui/theme';
import { useI18n, useLocalePreferences } from '../../src/i18n/provider';
import { preferenceSummary, showsPreference } from '../../src/ui/locale-options';

// Diagnostic: where this launch read the device languages. "módulo nativo" proves the build links expo-localization.
const LOCALE_SOURCE_LABELS = { native: 'Idioma: módulo nativo', intl: 'Idioma: Intl (sin módulo nativo)', none: 'Idioma: predeterminado' } as const;

/** Más is the secondary navigation hub: everything that is not one of the four
 * other tabs, in two native grouped lists. Finanzas holds the tools that
 * shape the ledger (Tarjetas among them since the centre tab became the
 * Assistant), each with a soft tinted identity tile from the same palette
 * accounts and categories use (the row itself stays neutral); App y datos
 * stays neutral. Home only surfaces contextual information; permanent
 * navigation lives here. Idioma (and Región once a second region is
 * released) sit in App y datos: device settings, not ledger data. The route
 * file keeps its historical name (settings). */
export default function MoreScreen() {
  const { archive } = useLedger();
  const p = usePalette();
  // Which control material this session draws and why: lets a tester confirm the opaque or glass mode without guessing.
  const material = useMaterialDecision();
  const { localeSource, t } = useI18n();
  const locale = useLocalePreferences();
  const showsRegion = !!locale && showsPreference('region', locale.state);
  const activeRecurring = archive?.recurring?.filter(rule => rule.active).length ?? 0;
  const activeDebts = archive?.debts?.filter(debt => debt.active).length ?? 0;
  const currentBudgets = archive?.budgets?.filter(budget => budget.active && budget.monthISO === currentMonthISO(todayKey())).length ?? 0;
  const customCategories = archive?.categories?.filter(definition => !definition.archived).length ?? 0;
  const activeCards = archive?.cards?.filter(card => card.active).length ?? 0;
  const undone = (archive?.records.filter(record => record.voided).length ?? 0) + (archive?.transfers?.filter(record => record.voided).length ?? 0);
  const plural = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many);
  const tile = (key: keyof typeof FINANCE_ROW_LOOKS) => <GlyphTile icon={FINANCE_ROW_LOOKS[key].glyph} color={appearanceHex(FINANCE_ROW_LOOKS[key].color, p)} size={34} />;

  return <Screen>
    <View>
      <SectionTitle>Finanzas</SectionTitle>
      <Surface grouped>
        <NavigationRow title="Cuentas" subtitle="Saldos y movimientos" leading={tile('accounts')} onPress={() => router.push('/accounts')} />
        <NavigationRow title="Tarjetas" subtitle={activeCards ? plural(activeCards, 'tarjeta de crédito', 'tarjetas de crédito') : 'Compras y resúmenes'} leading={tile('cards')} onPress={() => router.push('/cards')} />
        <NavigationRow title="Presupuestos" subtitle={currentBudgets ? currentBudgets + ' este mes' : 'Plan mensual'} leading={tile('budgets')} onPress={() => router.push('/budgets')} />
        <NavigationRow title="Recurrentes" subtitle={activeRecurring ? plural(activeRecurring, 'activo', 'activos') : 'Pagos e ingresos'} leading={tile('recurring')} onPress={() => router.push('/recurring')} />
        <NavigationRow title="Deudas y cobros" subtitle={activeDebts ? plural(activeDebts, 'pendiente', 'pendientes') : 'Debo · me deben'} leading={tile('debts')} onPress={() => router.push('/debts')} />
        <NavigationRow title="Categorías" subtitle={customCategories ? plural(customCategories, 'personalizada', 'personalizadas') : 'Gastos e ingresos'} leading={tile('categories')} last onPress={() => router.push('/categories')} />
      </Surface>
    </View>
    <View style={{ gap: 10 }}>
      <SectionTitle>App y datos</SectionTitle>
      <Surface grouped>
        <NavigationRow title="Copia de seguridad" subtitle="Compartir e importar" icon="save-outline" onPress={() => router.push('/backup')} />
        <NavigationRow title="Movimientos deshechos" subtitle={undone ? plural(undone, 'recuperable', 'recuperables') : 'Ninguno'} icon="arrow-undo-outline" last={!locale} onPress={() => router.push('/undone-entries')} />
        {locale && <NavigationRow title={t('preferences.language')} subtitle={preferenceSummary('language', locale.state, t)} icon="language-outline" last={!showsRegion} onPress={() => router.push('/language')} />}
        {locale && showsRegion && <NavigationRow title={t('preferences.region')} subtitle={preferenceSummary('region', locale.state, t)} icon="globe-outline" last onPress={() => router.push('/region')} />}
      </Surface>
      <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>
        Tus registros quedan en este dispositivo y podés registrar sin conexión. La sincronización todavía no está activada.
      </AppText>
    </View>
    <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>FinanzApp · Piloto nativo 0.1.0 · Producto 23.1B1 · {MATERIAL_LABELS[material.reason]} · {LOCALE_SOURCE_LABELS[localeSource]}</AppText>
  </Screen>;
}
