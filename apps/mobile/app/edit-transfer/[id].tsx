import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, IconButton, Screen } from '../../src/ui/components';
import { TransferForm } from '../../src/ui/transfer-form';
import { useI18n } from '../../src/i18n/provider';
export default function EditTransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const record = archive?.transfers?.find(r => r.transfer.id === id);
  // 25Q4: the modal keeps a close button when there is nothing to edit (the same close as the form's).
  return record && !record.voided ? <TransferForm key={id} original={record} /> : <Screen>
    <Stack.Screen options={{ headerLeft: () => <IconButton name="close" label={t('common.close')}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} /> }} />
    <EmptyState title={t('transferForm.notEditableTitle')} detail={t('transferForm.notEditableDetail')} />
  </Screen>;
}
