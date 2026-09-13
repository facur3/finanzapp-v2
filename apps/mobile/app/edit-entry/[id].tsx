import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { EntryForm } from '../../src/ui/entry-form';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.records.find(item => item.entry.id === id);
  if (!record || record.voided) return <Screen><EmptyState title="Este movimiento no se puede editar"
    detail="Volvé al detalle. Si está deshecho, primero podés recuperarlo." /></Screen>;
  // Keep the initial revision/draft while editing; the repository detects conflicts.
  return <EntryForm key={id} original={record} />;
}
