import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { BudgetForm } from '../../src/ui/budget-form';
import { EmptyState, Screen } from '../../src/ui/components';
import { useI18n } from '../../src/i18n/provider';

export default function EditBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const budget = archive?.budgets?.find(item => item.id === id && item.active);
  if (!budget) return <Screen><EmptyState title={t('budgets.edit.notFoundTitle')}
    detail={t('budgets.edit.notFoundDetail')} icon="speedometer-outline" /></Screen>;
  return <BudgetForm original={budget} monthISO={budget.monthISO} />;
}
