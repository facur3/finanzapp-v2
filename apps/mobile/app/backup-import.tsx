import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { BACKUP_MAX_BYTES, parsePilotBackup, previewBackupImport, type ImportPreview, type ParsedBackup } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, Money, Screen, SectionTitle, Surface } from '../src/ui/components';

type Review = { backup: ParsedBackup; preview: ImportPreview; name: string };

export default function BackupImportScreen() {
  const { archive, restoreBackup } = useLedger();
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const confirming = useRef(false);

  async function choose() {
    if (working.current || !archive) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain'], multipleFiles: false });
      if (picked.canceled) return;
      // Read only the selected file. Never remove/overwrite the original,
      // including Android document-provider URIs and iOS picker copies.
      if (picked.result.size > BACKUP_MAX_BYTES) throw new Error('La copia supera 5 MB. Conservá el archivo; no se importó nada.');
      const backup = parsePilotBackup(await picked.result.text());
      setReview({ backup, preview: previewBackupImport(archive, backup.archive), name: picked.result.name });
      setDone(false);
    } catch (cause) {
      setReview(null);
      setError(cause instanceof Error ? cause.message : 'No pudimos leer la copia. Tus datos y el archivo siguen intactos.');
    } finally { working.current = false; setBusy(false); }
  }

  function refreshReview() {
    if (!review || !archive || working.current) return;
    try {
      setReview({ ...review, preview: previewBackupImport(archive, review.backup.archive) });
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos revisar la copia.'); }
  }

  async function apply(selected: Review) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await restoreBackup(selected.backup.archive, selected.preview.baseline);
      setDone(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos verificar la importación. Reintentá con la misma copia para comprobarla sin duplicar datos.');
    } finally { working.current = false; setBusy(false); }
  }
  function confirm() {
    if (!review || review.preview.conflicts || working.current || confirming.current || done) return;
    confirming.current = true;
    const selected = review;
    Alert.alert('¿Importar esta copia?', 'Se agregarán únicamente los registros que faltan. No se reemplazan tus datos actuales.', [
      { text: 'Cancelar', style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: 'Importar', onPress: () => { confirming.current = false; void apply(selected); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }

  const plan = review?.preview;
  const additions = (plan?.accounts.length ?? 0) + (plan?.records.length ?? 0) + (plan?.transfers.length ?? 0) + (plan?.recurring.length ?? 0);
  return <Screen>
    <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
    {done ? <EmptyState title="Copia incorporada" detail="Tus cuentas, movimientos y recurrentes ya están guardados en este dispositivo. No se duplicaron registros existentes." icon="checkmark-circle-outline"
      action={<ActionButton label="Elegir otra copia" onPress={choose} busy={busy} secondary />} /> : <>
      {!review && <EmptyState title="Recuperá tus registros" icon="folder-open-outline"
        detail="Elegí una copia del piloto nativo. Podrás revisar los cambios antes de guardarlos. No se envía el archivo a ningún servidor."
        action={<ActionButton label="Elegir copia" icon="document-outline" onPress={choose} busy={busy} disabled={!archive} />} />}
      {review && plan && <>
        <View style={{ gap: 6 }}><SectionTitle>Revisar copia</SectionTitle>
          <AppText secondary numberOfLines={2} style={{ fontSize: 14 }}>{review.name}</AppText>
          <AppText secondary style={{ fontSize: 13 }}>{new Date(review.backup.exportedAt).toLocaleString('es-AR')}</AppText>
        </View>
        <Surface grouped>
          <DetailRow label="Cuentas nuevas" value={String(plan.accounts.length)} />
          <DetailRow label="Movimientos nuevos" value={String(plan.records.filter(record => !record.voided).length)} />
          <DetailRow label="Transferencias nuevas" value={String(plan.transfers.filter(record => !record.voided).length)} />
          <DetailRow label="Recurrentes nuevos" value={String(plan.recurring.length)} />
          <DetailRow label="Deshechos a conservar" value={String(plan.records.filter(record => record.voided).length + plan.transfers.filter(record => record.voided).length)} />
          <DetailRow label="Registros ya presentes" value={String(plan.identical)} last />
        </Surface>
        {plan.conflicts > 0 ? <ErrorMessage message={`Hay ${plan.conflicts} registros con cambios diferentes. No se importará nada. Esta copia no puede reemplazar correcciones locales ni reactivar movimientos deshechos.`} /> : <>
          <Surface><SectionTitle>Disponible después</SectionTitle>
            {(['ARS', 'USD'] as const).filter(currency => plan.after?.[currency] !== undefined).map(currency => <View key={currency} style={{ gap: 6 }}>
              <AppText secondary style={{ fontSize: 13 }}>{currency}</AppText>
              <Money minor={plan.after![currency]!} currency={currency} size={28} />
              <AppText secondary style={{ fontSize: 13 }}>Ahora</AppText>
              <Money minor={plan.before[currency] ?? 0} currency={currency} size={15} />
            </View>)}
            {!Object.keys(plan.after ?? {}).length && <AppText secondary>No contiene cuentas.</AppText>}
          </Surface>
          <AppText secondary style={{ fontSize: 13 }}>{additions ? 'Solo se agrega lo que falta. No se reemplaza ni se borra nada.' : 'Esta copia ya está incorporada. No hay nada nuevo para agregar.'}</AppText>
        </>}
      </>}
      <ErrorMessage message={error} />
      {review && <>
        {error && <ActionButton label="Volver a revisar" onPress={refreshReview} secondary disabled={busy} />}
        {!!plan && !plan.conflicts && additions > 0 && <ActionButton label="Confirmar importación" onPress={confirm} busy={busy} />}
        <ActionButton label="Elegir otra copia" onPress={choose} disabled={busy} secondary />
      </>}
      <AppText secondary style={{ fontSize: 13 }}>Copias nativas v1/v2/v3/v4 · JSON de hasta 5 MB. La importación de la app web, tarjetas e inversiones llegará en otra etapa.</AppText>
    </>}
  </Screen>;
}
