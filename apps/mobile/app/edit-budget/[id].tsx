import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { BudgetForm } from '../../src/ui/budget-form';
import { EmptyState, IconButton, Screen } from '../../src/ui/components';
import { useI18n } from '../../src/i18n/provider';

export default function EditBudgetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const budget = archive?.budgets?.find(item => item.id === id && item.active);
  // 24UX6E: the modal keeps its close button when there is nothing to edit (the same close as the form's).
  if (!budget) return <Screen>
    <Stack.Screen options={{ headerLeft: () => <IconButton name="close" label={t('common.close')}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/budgets'); }} /> }} />
    <EmptyState title={t('budgets.edit.notFoundTitle')} detail={t('budgets.edit.notFoundDetail')} icon="speedometer-outline" />
  </Screen>;
  return <BudgetForm original={budget} monthISO={budget.monthISO} />;
}
