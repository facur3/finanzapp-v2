import { useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { BACKUP_MAX_BYTES, createRecoveryBackup, parsePilotBackup } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, ErrorMessage, NavigationRow, Screen, SectionTitle, Surface } from '../src/ui/components';

/** Export and import of the native pilot backup, moved out of the Más hub so
 * that screen stays a list. The export logic is unchanged: a snapshot this app
 * can restore, shared through the system sheet, never uploaded on its own. */
export default function BackupScreen() {
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

  return <Screen>
    <Surface><SectionTitle>Compartir copia</SectionTitle>
      <AppText secondary style={{ fontSize: 15 }}>Guardá tus cuentas, tarjetas, deudas, movimientos, presupuestos y recurrentes en un lugar privado antes de borrar la app o cambiar de teléfono.</AppText>
      <AppText secondary style={{ fontSize: 13 }}>Incluye el estado actual y los movimientos deshechos. El archivo no está cifrado: guardalo en un lugar privado.</AppText>
      <ErrorMessage message={error} />
      <ActionButton label="Compartir copia" icon="share-outline" onPress={exportBackup} busy={busy} disabled={!archive} secondary />
    </Surface>
    <Surface grouped>
      <NavigationRow title="Importar copia" subtitle="Revisar el archivo antes de agregar" icon="download-outline" last disabled={busy}
        onPress={() => router.push('/backup-import')} />
    </Surface>
    <AppText secondary variant="footnote">Una copia es una foto de tus datos, no una sincronización entre dispositivos. Importar solo agrega lo que falta y nunca reemplaza registros existentes.</AppText>
  </Screen>;
}
