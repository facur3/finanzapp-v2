import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { Stack } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import { BACKUP_MAX_BYTES, parsePilotBackup, previewBackupImport, sortCurrencies, type Currency, type ImportPreview, type LedgerArchive,
  type ParsedBackup } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { isPickerCopy, restoreCatchUp } from '../src/ui/backup-file';
import { committedBeforeRefresh } from '../src/ui/presentation';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, Money, Screen, SectionTitle, Surface } from '../src/ui/components';
import { errorHaptic, successHaptic } from '../src/ui/motion';
import { useCurrentDay } from '../src/ui/theme';
import { useI18n } from '../src/i18n/provider';

/** `due`: the movements the restore's catch-ups also record for the copy's rules and plans (`restoreCatchUp`). */
type Review = { backup: ParsedBackup; preview: ImportPreview; name: string; due: number };

export default function BackupImportScreen() {
  const { archive, restoreBackup } = useLedger();
  const { t, formatDate, formatDateTime, formatCount, failureMessage } = useI18n();
  // The device's day, the one the restore's catch-ups run through.
  const day = useCurrentDay();
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = useRef(false);
  const confirming = useRef(false);

  // 25Q4: the review also counts what the restore's catch-ups record (nothing while a conflict refuses the import).
  function reviewOf(current: LedgerArchive, backup: ParsedBackup, name: string): Review {
    const preview = previewBackupImport(current, backup.archive);
    return { backup, preview, name, due: preview.conflicts ? 0 : restoreCatchUp(current, preview, day) };
  }

  async function choose() {
    if (working.current || !archive) return;
    working.current = true;
    setBusy(true);
    setError(null);
    // 25Q2: a native read failure is told in the app's words, never as the platform's text. (The picker itself never
    // rejects: expo-file-system 57 turns its own failures into a cancel.)
    const readFailed = (): never => { throw new Error('backup.import.readFailed'); };
    let copy: File | null = null;
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain'], multipleFiles: false });
      if (picked.canceled) return;
      copy = picked.result;
      // Only the selected file is read. iOS hands its own copy inside the app (asCopy); that copy is deleted once its text is
      // in memory (finally): the review and the import never read it again, and a retry picks again. The original (Files,
      // iCloud Drive, an Android provider) is never removed or overwritten.
      if (picked.result.size > BACKUP_MAX_BYTES) throw new Error('backup.import.tooLarge');
      const backup = parsePilotBackup(await picked.result.text().catch(readFailed));
      setReview(reviewOf(archive, backup, picked.result.name));
      setDone(false);
    } catch (cause) {
      setReview(null);
      // 25Q2: after an import, a file that fails leaves «Copia incorporada» for the choice and its sentence (it said nothing).
      setDone(false);
      setError(failureMessage(cause, 'backup.import.readFailed'));
    } finally {
      try { if (copy && isPickerCopy(copy.uri, Paths.document.parentDirectory.uri)) copy.delete(); } catch { /* Best effort: iOS clears tmp too. */ }
      working.current = false;
      setBusy(false);
    }
  }

  function refreshReview() {
    if (!review || !archive || working.current) return;
    try {
      setReview(reviewOf(archive, review.backup, review.name));
      setError(null);
    } catch (cause) { setError(failureMessage(cause, 'backup.import.reviewFailed')); }
  }

  async function apply(selected: Review) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await restoreBackup(selected.backup.archive, selected.preview.baseline);
      setDone(true);
      successHaptic();
    } catch (cause) {
      // 25R1: the import committed and only the view could not be read again (the banner says to verify): the copy is in, so
      // the screen says so and never offers «Confirmar importación» again under a sentence that says the save finished.
      if (committedBeforeRefresh(cause)) { setDone(true); return; }
      setError(failureMessage(cause, 'backup.import.verifyFailed'));
      // 25Q4: nothing stays frozen here; the review offers the import again.
      errorHaptic();
    } finally { working.current = false; setBusy(false); }
  }
  function confirm() {
    if (!review || review.preview.conflicts || working.current || confirming.current || done) return;
    confirming.current = true;
    const selected = review;
    Alert.alert(t('backup.import.confirmTitle', { date: formatDateTime(selected.backup.exportedAt) }), t('backup.import.confirmMessage'), [
      { text: t('common.cancel'), style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: t('backup.import.confirmButton'), onPress: () => { confirming.current = false; void apply(selected); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  }

  const plan = review?.preview;
  // Everything the import would write (as importArchive decides it): a copy whose only news is an instalment plan, a look
  // or a category still offers the import (24T2 review); 24T3: so does one whose only news is a devolución or an adelanto.
  const additions = (plan?.accounts.length ?? 0) + (plan?.records.length ?? 0) + (plan?.transfers.length ?? 0)
    + (plan?.recurring.length ?? 0) + (plan?.budgets.length ?? 0) + (plan?.cards.length ?? 0) + (plan?.debts.length ?? 0)
    + (plan?.installmentPlans.length ?? 0) + (plan?.appearances.length ?? 0) + (plan?.categories.length ?? 0) + (plan?.cardCycleDates.length ?? 0)
    + (plan?.purchaseOperations.length ?? 0);
  const hiddenIncoming = new Set([...plan?.cards ?? [], ...plan?.debts ?? []].map(item => item.accountId));
  // A count is grouped on screen ("1.234", "1,234"); VoiceOver gets the plain digits, which every voice reads as one number.
  const count = (value: number) => ({ value: formatCount(value), spokenValue: String(value) });
  // 25Q4: what tells two copies apart before importing: the date the header carries and the newest live movement inside it,
  // whose date VoiceOver hears written out («5 de marzo de 2026», never «5 mar»; 25Q4 review).
  const latest = review ? [...review.backup.archive.records.filter(record => !record.voided).map(record => record.entry.dateISO),
    ...(review.backup.archive.transfers ?? []).filter(record => !record.voided).map(record => record.transfer.dateISO)]
    .reduce<string | null>((max, date) => max === null || date > max ? date : max, null) : null;
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
          <AppText secondary style={{ fontSize: 13 }}>{t('backup.import.exportedAt', { date: formatDateTime(review.backup.exportedAt) })}</AppText>
          {latest && <AppText secondary style={{ fontSize: 13 }} accessibilityLabel={t('backup.import.latestMovement', { date: formatDate(latest, 'long') })}>
            {t('backup.import.latestMovement', { date: formatDate(latest, 'dayYear') })}</AppText>}
        </View>
        <Surface grouped>
          <DetailRow label={t('backup.import.rows.accounts')} {...count(plan.accounts.filter(account => !hiddenIncoming.has(account.id)).length)} />
          <DetailRow label={t('backup.import.rows.cards')} {...count(plan.cards.length)} />
          <DetailRow label={t('backup.import.rows.debts')} {...count(plan.debts.length)} />
          <DetailRow label={t('backup.import.rows.movements')} {...count(plan.records.filter(record => !record.voided).length)} />
          <DetailRow label={t('backup.import.rows.transfers')} {...count(plan.transfers.filter(record => !record.voided).length)} />
          <DetailRow label={t('backup.import.rows.recurring')} {...count(plan.recurring.length)} />
          <DetailRow label={t('backup.import.rows.budgets')} {...count(plan.budgets.length)} />
          {plan.installmentPlans.length > 0 && <DetailRow label={t('backup.import.rows.plans')} {...count(plan.installmentPlans.length)} />}
          {plan.purchaseOperations.some(operation => !operation.voided) && <DetailRow label={t('backup.import.rows.operations')} {...count(plan.purchaseOperations.filter(operation => !operation.voided).length)} />}
          {plan.currencyUnits.length > 0 && <DetailRow label={t('backup.import.units')} {...count(plan.currencyUnits.length)} />}
          <DetailRow label={t('backup.import.rows.voided')} {...count(plan.records.filter(record => record.voided).length + plan.transfers.filter(record => record.voided).length
            + plan.purchaseOperations.filter(operation => operation.voided).length)} />
          <DetailRow label={t('backup.import.rows.present')} {...count(plan.identical)} last />
        </Surface>
        {plan.scaleConflicts.length > 0 ? <ErrorMessage message={t('backup.import.scaleConflict', { codes: plan.scaleConflicts.join(', ') })} />
          : plan.conflicts > 0 ? <ErrorMessage message={t('backup.import.conflicts', { count: plan.conflicts })} /> : <>
          <Surface><SectionTitle caption={t('backup.import.availableCaption')}>{t('backup.import.availableAfter')}</SectionTitle>
            {sortCurrencies(Object.keys(plan.after ?? {}) as Currency[]).map(currency => <View key={currency} style={{ gap: 6 }}>
              <AppText secondary style={{ fontSize: 13 }}>{currency}</AppText>
              <Money minor={plan.after![currency]!} currency={currency} size={28} />
              <AppText secondary style={{ fontSize: 13 }}>{t('backup.import.now')}</AppText>
              <Money minor={plan.before[currency] ?? 0} currency={currency} size={15} />
            </View>)}
            {!Object.keys(plan.after ?? {}).length && <AppText secondary>{t('backup.import.noAccounts')}</AppText>}
          </Surface>
          {review.due > 0 && <AppText secondary style={{ fontSize: 13 }}>{t('backup.import.catchUp', { count: review.due })}</AppText>}
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
