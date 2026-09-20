import { useLocalSearchParams } from 'expo-router';
import { TransferForm } from '../src/ui/transfer-form';

const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;

export default function NewTransferScreen() {
  const params = useLocalSearchParams<{ accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string; note?: string; maxAmountMinor?: string }>();
  return <TransferForm accountId={text(params.accountId)} fromAccountId={text(params.fromAccountId)} toAccountId={text(params.toAccountId)}
    title={text(params.title)} defaultNote={text(params.note)} maxAmountMinor={text(params.maxAmountMinor)} />;
}
