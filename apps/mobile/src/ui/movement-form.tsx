import { useState } from 'react';
import { View } from 'react-native';
import { Choices } from './components';
import { EntryForm, type EntryPrefill } from './entry-form';
import { ValueTransition } from './motion';
import { space, usePalette } from './theme';
import { TransferForm } from './transfer-form';
import { useI18n } from '../i18n/provider';

export type MovementKind = 'expense' | 'income' | 'transfer';

/** One modal for the three ways money moves. The Gasto / Ingreso /
 * Transferencia control lives here, above the scrolling form, and only changes
 * state: the thumb slides, the haptic ticks and the form below crossfades. No
 * navigation is involved, so nothing interrupts the control mid-motion. The
 * account chosen so far carries over between modes; other draft fields do not
 * (Gasto ↔ Ingreso keep the draft, each kind its own category).
 *
 * 25VIS2: while a save is in flight or frozen for an exact retry (an unknown
 * outcome), the form reports itself locked and the switch is disabled: Retry
 * resends what was submitted, so the screen may not turn into another kind
 * meanwhile, and a switch to Transferencia may not drop the frozen submission. */
export function MovementForm({ kind: initialKind = 'expense', accountId, currency, prefill }: {
  kind?: string; accountId?: string; currency?: string; prefill?: EntryPrefill;
}) {
  const p = usePalette();
  const { t } = useI18n();
  const [kind, setKind] = useState<MovementKind>(initialKind === 'income' ? 'income' : initialKind === 'transfer' ? 'transfer' : 'expense');
  const [carried, setCarried] = useState<string | undefined>(accountId);
  const [locked, setLocked] = useState(false);
  // 4 pt under the track keep the segments' 44 pt slop clear of the scroller below, which would otherwise take those touches.
  return <View style={{ flex: 1, backgroundColor: p.background }}>
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.m, paddingBottom: 4 }}>
      <Choices<MovementKind> value={kind} onChange={setKind} disabled={locked}
        options={[{ value: 'expense', label: t('movement.expense') }, { value: 'income', label: t('movement.income') }, { value: 'transfer', label: t('movement.transfer') }]} />
    </View>
    <ValueTransition id={kind === 'transfer' ? 'transfer' : 'entry'} variant="fade" style={{ flex: 1 }}>
      {kind === 'transfer'
        ? <TransferForm accountId={carried} onAccountChange={setCarried} onLockedChange={setLocked} />
        : <EntryForm kind={kind} onKindChange={setKind} accountId={carried} currency={currency} onAccountChange={setCarried} onLockedChange={setLocked} prefill={prefill} />}
    </ValueTransition>
  </View>;
}
