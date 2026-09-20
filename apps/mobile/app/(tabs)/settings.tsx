import { useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { BACKUP_MAX_BYTES, createRecoveryBackup, currentMonthISO, parsePilotBackup, todayKey } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, ErrorMessage, Screen, SectionTitle, Surface } from '../../src/ui/components';

export default function SettingsScreen() {
  const { archive } = useLedger();
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function exportBackup() {
    if (!archive || sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setError(null);
    let file: File | null = null;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('No está disponible el menú para compartir en este dispositivo.');
      const backup = createRecoveryBackup(archive);
      const json = JSON.stringify(backup, null, 2);
      parsePilotBackup(json); // Only export a snapshot this app can restore.
      file = new File(Paths.cache, `finanzapp-piloto-${Date.now()}.json`);
      file.create();
      file.write(json);
      if (file.size > BACKUP_MAX_BYTES) throw new Error('La copia supera el límite de 5 MB de este piloto. No borres la app; conservá tus datos mientras ampliamos la recuperación.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Guardar copia de FinanzApp' });
      // The sheet can be cancelled. Do not announce a successful export here.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar la copia. Tus datos siguen en el dispositivo.');
    } finally {
      try { if (file?.exists) file.delete(); } catch { /* Only our temporary export; the OS can clear the cache later. */ }
      sharing.current = false;
      setBusy(false);
    }
  }

  const activeRecurring = archive?.recurring?.filter(rule => rule.active).length ?? 0;
  const activeCards = archive?.cards?.filter(card => card.active).length ?? 0;
  const activeDebts = archive?.debts?.filter(debt => debt.active).length ?? 0;
  const currentBudgets = archive?.budgets?.filter(budget => budget.active && budget.monthISO === currentMonthISO(todayKey())).length ?? 0;

  return <Screen>
    <Surface grouped>
      <DetailRow label="Cuentas" value="Saldos y movimientos" icon="wallet-outline" onPress={() => router.push('/accounts')} />
      <DetailRow label="Tarjetas" value={activeCards ? activeCards + (activeCards === 1 ? ' activa' : ' activas') : 'Compras y pagos'} icon="card-outline" onPress={() => router.navigate('/cards')} />
      <DetailRow label="Deudas y cobros" value={activeDebts ? activeDebts + (activeDebts === 1 ? ' pendiente' : ' pendientes') : 'Debo · me deben'} icon="people-outline" onPress={() => router.push('/debts')} />
      <DetailRow label="Presupuestos" value={currentBudgets ? currentBudgets + ' este mes' : 'Plan mensual'} icon="speedometer-outline"
        onPress={() => router.push('/budgets')} />
      <DetailRow label="Recurrentes" value={activeRecurring ? activeRecurring + ' activos' : 'Pagos e ingresos'} icon="repeat-outline"
        onPress={() => router.push('/recurring')} />
      <DetailRow label="Asistente" value="Próximamente" icon="sparkles-outline" last onPress={() => router.push('/assistant-preview')} />
    </Surface>
    <Surface><SectionTitle>Datos y privacidad</SectionTitle>
      <AppText>Tus registros quedan en este dispositivo.</AppText>
      <AppText secondary style={{ fontSize: 15 }}>Podés registrar movimientos sin conexión. La sincronización todavía no está activada.</AppText>
    </Surface>
    <Surface><SectionTitle>Copia de seguridad</SectionTitle>
      <AppText secondary style={{ fontSize: 15 }}>Guardá tus cuentas, tarjetas, deudas, movimientos, presupuestos y recurrentes en un lugar privado antes de borrar la app o cambiar de teléfono.</AppText>
      <AppText secondary style={{ fontSize: 13 }}>Incluye el estado actual y los movimientos deshechos. El archivo no está cifrado: guardalo en un lugar privado.</AppText>
      <ErrorMessage message={error} />
      <ActionButton label="Compartir copia" icon="share-outline" onPress={exportBackup} busy={busy} disabled={!archive} secondary />
    </Surface>
    <Surface grouped>
      <DetailRow label="Importar copia" value="Revisar archivo" icon="download-outline" disabled={busy}
        onPress={() => router.push('/backup-import')} />
      <DetailRow label="Movimientos deshechos" value={String((archive?.records.filter(record => record.voided).length ?? 0) + (archive?.transfers?.filter(record => record.voided).length ?? 0))}
        icon="arrow-undo-outline" last disabled={busy} onPress={() => router.push('/undone-entries')} />
    </Surface>
    <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>FinanzApp · Piloto nativo 0.1.0 · Interfaz 14</AppText>
  </Screen>;
}
