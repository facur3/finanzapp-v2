import { useRef, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, ErrorMessage, NavigationRow, Screen, SectionTitle, Surface } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';
import { buildBackupFile } from '../src/ui/backup-file';

/** Export and import of the native pilot backup, moved out of the Más hub so
 * that screen stays a list. A snapshot this app can restore, shared through the
 * system sheet, never uploaded on its own. 25Q2: measured before anything is
 * written, named by its date, and a native failure is told in the app's words. */
export default function BackupScreen() {
  const { archive } = useLedger();
  const { t, failureMessage } = useI18n();
  const [busy, setBusy] = useState(false);
  const sharing = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function exportBackup() {
    if (!archive || sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setError(null);
    let file: File | null = null;
    // A native failure (the file system, the share sheet) is told in the app's words, never as the platform's text.
    const prepareFailed = (): never => { throw new Error('backup.export.prepareFailed'); };
    try {
      if (!await Sharing.isAvailableAsync().catch(prepareFailed)) throw new Error('backup.export.sharingUnavailable');
      // Built, measured and checked for a restore before any file exists (a copy over the cap says so in its own words).
      const backup = buildBackupFile(archive);
      const target = new File(Paths.cache, backup.name);
      file = target;
      try { if (target.exists) target.delete(); target.create(); target.write(backup.json); } catch { prepareFailed(); }
      await Sharing.shareAsync(target.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: t('backup.export.dialogTitle') }).catch(prepareFailed);
      // The sheet can be cancelled. Do not announce a successful export here.
    } catch (cause) {
      setError(failureMessage(cause, 'backup.export.prepareFailed'));
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
  </Screen>;
}
