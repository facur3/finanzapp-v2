import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { RecurringForm } from '../../src/ui/recurring-form';
import { useI18n } from '../../src/i18n/provider';

export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const rule = archive?.recurring?.find(item => item.id === id);
  if (!rule) return <Screen><EmptyState title={t('recurring.edit.notFoundTitle')}
    detail={t('recurring.edit.notFoundDetail')} icon="repeat-outline" /></Screen>;
  return <RecurringForm original={rule} />;
}
