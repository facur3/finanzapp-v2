import { View } from 'react-native';
import { router } from 'expo-router';
import { currentMonthISO, todayKey } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { AppText, DetailRow, Screen, SectionTitle, Surface } from '../../src/ui/components';

/** Más is the secondary navigation hub: everything that is not one of the four
 * primary tabs, in two native grouped lists. Finanzas holds the tools that
 * shape the ledger; App y datos holds the Assistant preview and the person's
 * data. Home only surfaces contextual information; permanent navigation lives
 * here. The route file keeps its historical name (settings). */
export default function MoreScreen() {
  const { archive } = useLedger();
  const activeRecurring = archive?.recurring?.filter(rule => rule.active).length ?? 0;
  const activeDebts = archive?.debts?.filter(debt => debt.active).length ?? 0;
  const currentBudgets = archive?.budgets?.filter(budget => budget.active && budget.monthISO === currentMonthISO(todayKey())).length ?? 0;
  const undone = (archive?.records.filter(record => record.voided).length ?? 0) + (archive?.transfers?.filter(record => record.voided).length ?? 0);
  const plural = (count: number, one: string, many: string) => count + ' ' + (count === 1 ? one : many);

  return <Screen>
    <View>
      <SectionTitle>Finanzas</SectionTitle>
      <Surface grouped>
        <DetailRow label="Cuentas" value="Saldos y movimientos" icon="wallet-outline" onPress={() => router.push('/accounts')} />
        <DetailRow label="Presupuestos" value={currentBudgets ? currentBudgets + ' este mes' : 'Plan mensual'} icon="speedometer-outline" onPress={() => router.push('/budgets')} />
        <DetailRow label="Recurrentes" value={activeRecurring ? plural(activeRecurring, 'activo', 'activos') : 'Pagos e ingresos'} icon="repeat-outline" onPress={() => router.push('/recurring')} />
        <DetailRow label="Deudas y cobros" value={activeDebts ? plural(activeDebts, 'pendiente', 'pendientes') : 'Debo · me deben'} icon="people-outline" onPress={() => router.push('/debts')} />
        <DetailRow label="Categorías" value="Gastos e ingresos" icon="pricetags-outline" last onPress={() => router.push('/categories')} />
      </Surface>
    </View>
    <View style={{ gap: 10 }}>
      <SectionTitle>App y datos</SectionTitle>
      <Surface grouped>
        <DetailRow label="Asistente" value="Vista previa" icon="sparkles-outline" onPress={() => router.push('/assistant-preview')} />
        <DetailRow label="Copia de seguridad" value="Compartir e importar" icon="save-outline" onPress={() => router.push('/backup')} />
        <DetailRow label="Movimientos deshechos" value={undone ? plural(undone, 'recuperable', 'recuperables') : 'Ninguno'} icon="arrow-undo-outline" last onPress={() => router.push('/undone-entries')} />
      </Surface>
      <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>
        Tus registros quedan en este dispositivo y podés registrar sin conexión. La sincronización todavía no está activada.
      </AppText>
    </View>
    <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>FinanzApp · Piloto nativo 0.1.0 · Producto 19</AppText>
  </Screen>;
}
