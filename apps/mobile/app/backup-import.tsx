import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { BACKUP_MAX_BYTES, parsePilotBackup, previewBackupImport, type ImportPreview, type ParsedBackup } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, Money, Screen, SectionTitle, Surface } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';

type Review = { backup: ParsedBackup; preview: ImportPreview; name: string };

export default function BackupImportScreen() {
  const { archive, restoreBackup } = useLedger();
  const { t, formatDateTime, formatCount } = useI18n();
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
      if (picked.result.size > BACKUP_MAX_BYTES) throw new Error('backup.import.tooLarge');
      const backup = parsePilotBackup(await picked.result.text());
      setReview({ backup, preview: previewBackupImport(archive, backup.archive), name: picked.result.name });
      setDone(false);
    } catch (cause) {
      setReview(null);
      setError(cause instanceof Error ? cause.message : 'backup.import.readFailed');
    } finally { working.current = false; setBusy(false); }
  }

  function refreshReview() {
    if (!review || !archive || working.current) return;
    try {
      setReview({ ...review, preview: previewBackupImport(archive, review.backup.archive) });
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'backup.import.reviewFailed'); }
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
      setError(cause instanceof Error ? cause.message : 'backup.import.verifyFailed');
    } finally { working.current = false; setBusy(false); }
  }
  function confirm() {
    if (!review || review.preview.conflicts || working.current || confirming.current || done) return;
    confirming.current = true;
    const selected = review;
    Alert.alert(t('backup.import.confirmTitle'), t('backup.import.confirmMessage'), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: t('backup.import.confirmButton'), onPress: () => { confirming.current = false; void apply(selected); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }

  const plan = review?.preview;
  const additions = (plan?.accounts.length ?? 0) + (plan?.records.length ?? 0) + (plan?.transfers.length ?? 0)
    + (plan?.recurring.length ?? 0) + (plan?.budgets.length ?? 0) + (plan?.cards.length ?? 0) + (plan?.debts.length ?? 0);
  const hiddenIncoming = new Set([...plan?.cards ?? [], ...plan?.debts ?? []].map(item => item.accountId));
  // A count is grouped on screen ("1.234", "1,234"); VoiceOver gets the plain digits, which every voice reads as one number.
  const count = (value: number) => ({ value: formatCount(value), spokenValue: String(value) });
  return <Screen>
    <Stack.Screen options={{ gestureEnabled: !busy, headerBackVisible: !busy }} />
    {done ? <EmptyState title={t('backup.import.doneTitle')} detail={t('backup.import.doneDetail')} icon="checkmark-circle-outline"
      action={<ActionButton label={t('backup.import.chooseAnother')} onPress={choose} busy={busy} secondary />} /> : <>
      {!review && <EmptyState title={t('backup.import.emptyTitle')} icon="folder-open-outline"
        detail={t('backup.import.emptyDetail')}
        action={<ActionButton label={t('backup.import.choose')} icon="document-outline" onPress={choose} busy={busy} disabled={!archive} />} />}
      {review && plan && <>
        <View style={{ gap: 6 }}><SectionTitle>{t('backup.import.reviewTitle')}</SectionTitle>
          <AppText secondary numberOfLines={2} style={{ fontSize: 14 }}>{review.name}</AppText>
          <AppText secondary style={{ fontSize: 13 }}>{formatDateTime(review.backup.exportedAt)}</AppText>
        </View>
        <Surface grouped>
          <DetailRow label={t('backup.import.rows.accounts')} {...count(plan.accounts.filter(account => !hiddenIncoming.has(account.id)).length)} />
          <DetailRow label={t('backup.import.rows.cards')} {...count(plan.cards.length)} />
          <DetailRow label={t('backup.import.rows.debts')} {...count(plan.debts.length)} />
          <DetailRow label={t('backup.import.rows.movements')} {...count(plan.records.filter(record => !record.voided).length)} />
          <DetailRow label={t('backup.import.rows.transfers')} {...count(plan.transfers.filter(record => !record.voided).length)} />
          <DetailRow label={t('backup.import.rows.recurring')} {...count(plan.recurring.length)} />
          <DetailRow label={t('backup.import.rows.budgets')} {...count(plan.budgets.length)} />
          <DetailRow label={t('backup.import.rows.voided')} {...count(plan.records.filter(record => record.voided).length + plan.transfers.filter(record => record.voided).length)} />
          <DetailRow label={t('backup.import.rows.present')} {...count(plan.identical)} last />
        </Surface>
        {plan.conflicts > 0 ? <ErrorMessage message={t('backup.import.conflicts', { count: plan.conflicts })} /> : <>
          <Surface><SectionTitle caption={t('backup.import.availableCaption')}>{t('backup.import.availableAfter')}</SectionTitle>
            {(['ARS', 'USD'] as const).filter(currency => plan.after?.[currency] !== undefined).map(currency => <View key={currency} style={{ gap: 6 }}>
              <AppText secondary style={{ fontSize: 13 }}>{currency}</AppText>
              <Money minor={plan.after![currency]!} currency={currency} size={28} />
              <AppText secondary style={{ fontSize: 13 }}>{t('backup.import.now')}</AppText>
              <Money minor={plan.before[currency] ?? 0} currency={currency} size={15} />
            </View>)}
            {!Object.keys(plan.after ?? {}).length && <AppText secondary>{t('backup.import.noAccounts')}</AppText>}
          </Surface>
          <AppText secondary style={{ fontSize: 13 }}>{additions ? t('backup.import.onlyMissing') : t('backup.import.nothingNew')}</AppText>
        </>}
      </>}
      <ErrorMessage message={error} />
      {review && <>
        {error && <ActionButton label={t('backup.import.reviewAgain')} onPress={refreshReview} secondary disabled={busy} />}
        {!!plan && !plan.conflicts && additions > 0 && <ActionButton label={t('backup.import.confirmImport')} onPress={confirm} busy={busy} />}
        <ActionButton label={t('backup.import.chooseAnother')} onPress={choose} disabled={busy} secondary />
      </>}
      <AppText secondary style={{ fontSize: 13 }}>{t('backup.import.formats')}</AppText>
    </>}
  </Screen>;
}
