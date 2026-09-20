import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { DebtForm } from '../../src/ui/debt-form';
import { EmptyState, Screen } from '../../src/ui/components';

export default function EditDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const debt = archive?.debts?.find(item => item.id === id && item.active);
  if (!debt) return <Screen><EmptyState title="No encontramos esta deuda"
    detail="Volvé a Deudas para elegir una obligación activa." icon="people-outline" /></Screen>;
  return <DebtForm original={debt} />;
}
