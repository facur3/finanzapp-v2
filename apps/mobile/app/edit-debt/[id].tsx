import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { DebtForm } from '../../src/ui/debt-form';

export default function EditDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const debt = archive?.debts?.find(item => item.id === id);
  if (!debt) return <Screen><EmptyState title="No encontramos esta deuda"
    detail="Volvé a Deudas para elegir una obligación guardada en este dispositivo." icon="people-outline" /></Screen>;
  return <DebtForm key={id} original={debt} />;
}
