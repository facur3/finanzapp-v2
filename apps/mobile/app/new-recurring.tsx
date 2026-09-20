import { useLocalSearchParams } from 'expo-router';
import { RecurringForm } from '../src/ui/recurring-form';

export default function NewRecurringScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  return <RecurringForm accountId={accountId} />;
}
