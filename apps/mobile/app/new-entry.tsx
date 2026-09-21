import { useLocalSearchParams } from 'expo-router';
import { MovementForm } from '../src/ui/movement-form';

export default function NewEntryScreen() {
  const params = useLocalSearchParams<{ accountId?: string; kind?: string; currency?: string }>();
  return <MovementForm accountId={typeof params.accountId === 'string' ? params.accountId : undefined}
    currency={typeof params.currency === 'string' ? params.currency : undefined}
    kind={typeof params.kind === 'string' ? params.kind : undefined} />;
}
