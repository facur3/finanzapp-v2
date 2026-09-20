import { useLocalSearchParams } from 'expo-router';
import { TransferForm } from '../src/ui/transfer-form';

export default function NewTransferScreen() {
  const { accountId, fromAccountId, toAccountId, title, note } = useLocalSearchParams<{
    accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string; note?: string;
  }>();
  return <TransferForm accountId={accountId} fromAccountId={fromAccountId} toAccountId={toAccountId}
    title={title} defaultNote={note} />;
}
