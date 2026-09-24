import { useLocalSearchParams } from 'expo-router';
import { useI18n } from '../../src/i18n/provider';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { DebtForm } from '../../src/ui/debt-form';

export default function EditDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const debt = archive?.debts?.find(item => item.id === id);
  if (!debt) return <Screen><EmptyState title={t('debts.detail.notFoundTitle')}
    detail={t('debts.detail.notFoundDetail')} icon="people-outline" /></Screen>;
  return <DebtForm key={id} original={debt} />;
}
