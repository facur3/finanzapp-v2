import { useLocalSearchParams } from 'expo-router';
import { TransferForm } from '../src/ui/transfer-form';
export default function NewTransferScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  return <TransferForm accountId={accountId} />;
}
