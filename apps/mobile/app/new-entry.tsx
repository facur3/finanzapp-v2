import { useLocalSearchParams } from 'expo-router';
import { MovementForm } from '../src/ui/movement-form';

export default function NewEntryScreen() {
  const params = useLocalSearchParams<{ accountId?: string; kind?: string; currency?: string; amount?: string; merchant?: string; category?: string; date?: string }>();
  const text = (value: unknown) => typeof value === 'string' && value ? value : undefined;
  // A prefilled draft (from the Assistant's Editar) only seeds the fields; saving stays the form's explicit button.
  const prefill = text(params.amount) || text(params.merchant) || text(params.category) || text(params.date)
    ? { amount: text(params.amount), merchant: text(params.merchant), category: text(params.category), dateISO: text(params.date) } : undefined;
  return <MovementForm accountId={text(params.accountId)} currency={text(params.currency)} kind={text(params.kind)} prefill={prefill} />;
}
