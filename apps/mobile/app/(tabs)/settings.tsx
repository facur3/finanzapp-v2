import { useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { createPilotBackup } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, ErrorMessage, Screen, SectionTitle, Surface } from '../../src/ui/components';

export default function SettingsScreen() {
  const { snapshot } = useLedger();
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function exportBackup() {
    if (!snapshot || sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setError(null);
    let file: File | null = null;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('No está disponible el menú para compartir en este dispositivo.');
      const backup = createPilotBackup(snapshot);
      file = new File(Paths.cache, `finanzapp-piloto-${Date.now()}.json`);
      file.create();
      file.write(JSON.stringify(backup, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Guardar copia de FinanzApp' });
      // The sheet can be cancelled. Do not announce a successful export here.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar la copia. Tus datos siguen en el dispositivo.');
    } finally {
      if (file?.exists) { try { file.delete(); } catch { /* Cache cleanup can be retried by the OS. */ } }
      sharing.current = false;
      setBusy(false);
    }
  }

  return <Screen>
    <Surface><SectionTitle>Tus datos</SectionTitle>
      <AppText>Los movimientos se guardan en este dispositivo y podés registrarlos sin conexión.</AppText>
      <AppText secondary>Este piloto todavía no sincroniza con tu cuenta de FinanzApp. Si borrás la app, podés perder sus datos locales.</AppText>
    </Surface>
    <Surface><SectionTitle>Copia de seguridad</SectionTitle>
      <AppText secondary>Exportá tus cuentas y movimientos a un archivo. Contiene datos personales: elegí dónde guardarlo. La restauración y la importación de la app anterior llegan en la siguiente etapa.</AppText>
      <ErrorMessage message={error} />
      <ActionButton label="Compartir copia" onPress={exportBackup} busy={busy} disabled={!snapshot} secondary />
    </Surface>
    <AppText secondary style={{ textAlign: 'center', fontSize: 13 }}>FinanzApp · Piloto nativo 0.1.0</AppText>
  </Screen>;
}
