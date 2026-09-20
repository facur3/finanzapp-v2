import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { RecurringForm } from '../../src/ui/recurring-form';

export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const rule = archive?.recurring?.find(item => item.id === id);
  if (!rule) return <Screen><EmptyState title="No encontramos este recurrente"
    detail="Volvé a Recurrentes para elegir una regla guardada en este dispositivo." icon="repeat-outline" /></Screen>;
  return <RecurringForm original={rule} />;
}
