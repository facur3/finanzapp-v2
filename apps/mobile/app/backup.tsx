import { useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { BACKUP_MAX_BYTES, createRecoveryBackup, parsePilotBackup } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, ErrorMessage, NavigationRow, Screen, SectionTitle, Surface } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';

/** Export and import of the native pilot backup, moved out of the Más hub so
 * that screen stays a list. The export logic is unchanged: a snapshot this app
 * can restore, shared through the system sheet, never uploaded on its own. */
export default function BackupScreen() {
  const { archive } = useLedger();
  const { t } = useI18n();
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
      if (!await Sharing.isAvailableAsync()) throw new Error('backup.export.sharingUnavailable');
      const backup = createRecoveryBackup(archive);
      const json = JSON.stringify(backup, null, 2);
      parsePilotBackup(json); // Only export a snapshot this app can restore.
      file = new File(Paths.cache, `finanzapp-piloto-${Date.now()}.json`);
      file.create();
      file.write(json);
      if (file.size > BACKUP_MAX_BYTES) throw new Error('backup.export.tooLarge');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: t('backup.export.dialogTitle') });
      // The sheet can be cancelled. Do not announce a successful export here.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'backup.export.prepareFailed');
    } finally {
      try { if (file?.exists) file.delete(); } catch { /* Only our temporary export; the OS can clear the cache later. */ }
      sharing.current = false;
      setBusy(false);
    }
  }

  return <Screen>
    <Surface><SectionTitle>{t('backup.export.share')}</SectionTitle>
      <AppText secondary style={{ fontSize: 15 }}>{t('backup.export.intro')}</AppText>
      <AppText secondary style={{ fontSize: 13 }}>{t('backup.export.note')}</AppText>
      <ErrorMessage message={error} />
      <ActionButton label={t('backup.export.share')} icon="share-outline" onPress={exportBackup} busy={busy} disabled={!archive} secondary />
    </Surface>
    <Surface grouped>
      <NavigationRow title={t('backup.export.importTitle')} subtitle={t('backup.export.importSubtitle')} icon="download-outline" last disabled={busy}
        onPress={() => router.push('/backup-import')} />
    </Surface>
    <AppText secondary variant="footnote">{t('backup.export.footer')}</AppText>
  </Screen>;
}
