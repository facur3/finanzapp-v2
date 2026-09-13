import { useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, Screen } from '../../src/ui/components';
import { TransferForm } from '../../src/ui/transfer-form';
export default function EditTransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const record = archive?.transfers?.find(r => r.transfer.id === id);
  return record && !record.voided ? <TransferForm key={id} original={record} /> : <Screen>
    <EmptyState title="No se puede editar" detail="Esta transferencia no existe o fue deshecha. Volvé a su detalle para revisarla." />
  </Screen>;
}
