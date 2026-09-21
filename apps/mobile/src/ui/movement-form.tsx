import { useState } from 'react';
import { View } from 'react-native';
import { Choices } from './components';
import { EntryForm, type EntryPrefill } from './entry-form';
import { ValueTransition } from './motion';
import { space, usePalette } from './theme';
import { TransferForm } from './transfer-form';

export type MovementKind = 'expense' | 'income' | 'transfer';

/** One modal for the three ways money moves. The Gasto / Ingreso /
 * Transferencia control lives here, above the scrolling form, and only changes
 * state: the thumb slides, the haptic ticks and the form below crossfades. No
 * navigation is involved, so nothing interrupts the control mid-motion. The
 * account chosen so far carries over between modes; other draft fields do not. */
export function MovementForm({ kind: initialKind = 'expense', accountId, currency, prefill }: {
  kind?: string; accountId?: string; currency?: string; prefill?: EntryPrefill;
}) {
  const p = usePalette();
  const [kind, setKind] = useState<MovementKind>(initialKind === 'income' ? 'income' : initialKind === 'transfer' ? 'transfer' : 'expense');
  const [carried, setCarried] = useState<string | undefined>(accountId);
  return <View style={{ flex: 1, backgroundColor: p.background }}>
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.m }}>
      <Choices<MovementKind> value={kind} onChange={setKind}
        options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }, { value: 'transfer', label: 'Transferencia' }]} />
    </View>
    <ValueTransition id={kind === 'transfer' ? 'transfer' : 'entry'} variant="fade" style={{ flex: 1 }}>
      {kind === 'transfer'
        ? <TransferForm accountId={carried} onAccountChange={setCarried} />
        : <EntryForm kind={kind} onKindChange={setKind} accountId={carried} currency={currency} onAccountChange={setCarried} prefill={prefill} />}
    </ValueTransition>
  </View>;
}
