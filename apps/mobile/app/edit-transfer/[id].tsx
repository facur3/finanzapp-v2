import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { TransferForm } from '../../src/ui/transfer-form';
import { useI18n } from '../../src/i18n/provider';
export default function EditTransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const record = archive?.transfers?.find(r => r.transfer.id === id);
  return record && !record.voided ? <TransferForm key={id} original={record} /> : <Screen>
    <EmptyState title={t('transferForm.notEditableTitle')} detail={t('transferForm.notEditableDetail')} />
  </Screen>;
}
