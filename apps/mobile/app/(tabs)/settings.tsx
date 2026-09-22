import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, todayKey } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { FINANCE_ROW_LOOKS, appearanceHex } from '../../src/ui/appearance';
import { AppText, DetailRow, GlyphTile, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { useMaterialDecision } from '../../src/ui/material';
import { MATERIAL_LABELS } from '../../src/ui/material-policy';
import { usePalette } from '../../src/ui/theme';

/** Más is the secondary navigation hub: everything that is not one of the four
 * other tabs, in two native grouped lists. Finanzas holds the tools that
 * shape the ledger (Tarjetas among them since the centre tab became the
 * Assistant), each with a soft tinted identity tile from the same palette
 * accounts and categories use (the row itself stays neutral); App y datos
 * stays neutral. Home only surfaces contextual information; permanent
 * navigation lives here. The route file keeps its historical name (settings). */
export default function MoreScreen() {
  const { archive } = useLedger();
  const p = usePalette();
  // Which control material this session draws and why: lets a tester confirm the opaque or glass mode without guessing.
  const material = useMaterialDecision();
  const activeRecurring = archive?.recurring?.filter(rule => rule.active).length ?? 0;
  const activeDebts = archive?.debts?.filter(debt => debt.active).length ?? 0;
  const currentBudgets = archive?.budgets?.filter(budget => budget.active && budget.monthISO === currentMonthISO(todayKey())).length ?? 0;
  const customCategories = archive?.categories?.filter(definition => !definition.archived).length ?? 0;
  const activeCards = archive?.cards?.filter(card => card.active).length ?? 0;
  const undone = (archive?.records.filter(record => record.voided).length ?? 0) + (archive?.transfers?.filter(record => record.voided).length ?? 0);
  const plural = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many);
  const tile = (key: keyof typeof FINANCE_ROW_LOOKS) => <GlyphTile icon={FINANCE_ROW_LOOKS[key].glyph} color={appearanceHex(FINANCE_ROW_LOOKS[key].color, p)} size={30} />;

  return <Screen>
    <View>
      <SectionTitle>Finanzas</SectionTitle>
      <Surface grouped>
        <DetailRow label="Cuentas" value="Saldos y movimientos" icon="wallet-outline" leading={tile('accounts')} onPress={() => router.push('/accounts')} />
        <DetailRow label="Tarjetas" value={activeCards ? plural(activeCards, 'tarjeta de crédito', 'tarjetas de crédito') : 'Compras y resúmenes'} icon="card-outline" leading={tile('cards')} onPress={() => router.push('/cards')} />
        <DetailRow label="Presupuestos" value={currentBudgets ? currentBudgets + ' este mes' : 'Plan mensual'} icon="speedometer-outline" leading={tile('budgets')} onPress={() => router.push('/budgets')} />
        <DetailRow label="Recurrentes" value={activeRecurring ? plural(activeRecurring, 'activo', 'activos') : 'Pagos e ingresos'} icon="repeat-outline" leading={tile('recurring')} onPress={() => router.push('/recurring')} />
        <DetailRow label="Deudas y cobros" value={activeDebts ? plural(activeDebts, 'pendiente', 'pendientes') : 'Debo · me deben'} icon="people-outline" leading={tile('debts')} onPress={() => router.push('/debts')} />
        <DetailRow label="Categorías" value={customCategories ? plural(customCategories, 'personalizada', 'personalizadas') : 'Gastos e ingresos'} icon="pricetags-outline" leading={tile('categories')} last onPress={() => router.push('/categories')} />
      </Surface>
    </View>
    <View style={{ gap: 10 }}>
      <SectionTitle>App y datos</SectionTitle>
      <Surface grouped>
        <DetailRow label="Copia de seguridad" value="Compartir e importar" icon="save-outline" onPress={() => router.push('/backup')} />
        <DetailRow label="Movimientos deshechos" value={undone ? plural(undone, 'recuperable', 'recuperables') : 'Ninguno'} icon="arrow-undo-outline" last onPress={() => router.push('/undone-entries')} />
      </Surface>
      <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>
        Tus registros quedan en este dispositivo y podés registrar sin conexión. La sincronización todavía no está activada.
      </AppText>
    </View>
    <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>FinanzApp · Piloto nativo 0.1.0 · Producto 22 · {MATERIAL_LABELS[material.reason]}</AppText>
  </Screen>;
}
