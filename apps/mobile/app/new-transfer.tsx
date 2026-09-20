import { useLocalSearchParams } from 'expo-router';
import { TransferForm } from '../src/ui/transfer-form';

export default function NewTransferScreen() {
  const { accountId, fromAccountId, toAccountId, title, note, maxAmountMinor } = useLocalSearchParams<{
    accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string; note?: string; maxAmountMinor?: string;
  }>();
  return <TransferForm accountId={accountId} fromAccountId={fromAccountId} toAccountId={toAccountId}
    title={title} defaultNote={note} maxAmountMinor={maxAmountMinor} />;
}
