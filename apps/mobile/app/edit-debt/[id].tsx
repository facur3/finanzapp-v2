import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useI18n } from '../../src/i18n/provider';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, IconButton, Screen } from '../../src/ui/components';
import { DebtForm } from '../../src/ui/debt-form';

export default function EditDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const debt = archive?.debts?.find(item => item.id === id && !item.deleted);
  // 24UX6E: the modal keeps its close button when there is nothing to edit (the same close as the form's).
  if (!debt) return <Screen>
    <Stack.Screen options={{ headerLeft: () => <IconButton name="close" label={t('common.close')}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/debts'); }} /> }} />
    <EmptyState title={t('debts.detail.notFoundTitle')} detail={t('debts.detail.notFoundDetail')} icon="people-outline" />
  </Screen>;
  return <DebtForm key={id} original={debt} />;
}
