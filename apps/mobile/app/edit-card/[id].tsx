import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { CardForm } from '../../src/ui/card-form';
import { EmptyState, Screen } from '../../src/ui/components';

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const card = archive?.cards?.find(item => item.id === id);
  if (!card) return <Screen><EmptyState title="No encontramos esta tarjeta"
    detail="Volvé a Tarjetas para elegir una tarjeta guardada en este dispositivo." icon="card-outline" /></Screen>;
  return <CardForm key={id} original={card} />;
}
