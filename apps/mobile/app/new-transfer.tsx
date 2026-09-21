import { useLocalSearchParams } from 'expo-router';
import { MovementForm } from '../src/ui/movement-form';
import { TransferForm } from '../src/ui/transfer-form';

const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;

/** A plain transfer opens the shared movement modal in Transferencia mode. A
 * card payment or debt settlement fixes the obligation side and has no mode
 * switch, so it renders the transfer form on its own. */
export default function NewTransferScreen() {
  const params = useLocalSearchParams<{ accountId?: string; fromAccountId?: string; toAccountId?: string; title?: string; note?: string; maxAmountMinor?: string }>();
  const obligation = text(params.fromAccountId) || text(params.toAccountId);
  if (!obligation) return <MovementForm kind="transfer" accountId={text(params.accountId)} />;
  return <TransferForm accountId={text(params.accountId)} fromAccountId={text(params.fromAccountId)} toAccountId={text(params.toAccountId)}
    title={text(params.title)} defaultNote={text(params.note)} maxAmountMinor={text(params.maxAmountMinor)} />;
}
