import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, IconButton, Screen } from '../../src/ui/components';
import { EntryForm } from '../../src/ui/entry-form';
import { useI18n } from '../../src/i18n/provider';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const record = archive?.records.find(item => item.entry.id === id);
  // 25Q4: the modal keeps a close button when there is nothing to edit (the same close as the form's).
  if (!record || record.voided) return <Screen>
    <Stack.Screen options={{ headerLeft: () => <IconButton name="close" label={t('common.close')}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} /> }} />
    <EmptyState title={t('entryForm.notEditableTitle')} detail={t('entryForm.notEditableDetail')} />
  </Screen>;
  // Keep the initial revision/draft while editing; the repository detects conflicts.
  return <EntryForm key={id} original={record} />;
}
