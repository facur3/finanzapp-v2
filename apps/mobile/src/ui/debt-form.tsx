import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { parseMinorUnits, samePersonalDebtProfile, todayKey, validateAccount, validatePersonalDebtProfile,
  type Account, type Currency, type DebtDirection, type PersonalDebtProfile } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, DetailRow, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { DateField } from './form-controls';
import { space } from './theme';

type DueMode = 'none' | 'dated';
type PendingCreate = { account: Account; debt: PersonalDebtProfile };

/** Creates a debt or receivable with its hidden account (opening balance is
 * the principal) or edits its profile. Amounts change only through payments. */
export function DebtForm({ original }: { original?: PersonalDebtProfile }) {
  const { snapshot, addDebt, saveDebt } = useLedger();
  const account = snapshot?.accounts.find(item => item.id === original?.accountId);
  const [before] = useState(original);
  const [identity] = useState(() => ({ id: randomUUID(), accountId: randomUUID(), createdAt: new Date().toISOString() }));
  const [direction, setDirection] = useState<DebtDirection>(before?.direction ?? 'owed_by_me');
  const [counterparty, setCounterparty] = useState(before?.counterparty ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'ARS');
  const [amount, setAmount] = useState('');
  const [dueMode, setDueMode] = useState<DueMode>(before?.dueDateISO ? 'dated' : 'none');
  const [dueDate, setDueDate] = useState(() => new Date((before?.dueDateISO ?? todayKey()) + 'T12:00:00'));
  const [note, setNote] = useState(before?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PersonalDebtProfile | null>(null);
  const [pendingArchive, setPendingArchive] = useState<PersonalDebtProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || !!pendingCreate || !!pendingEdit || !!pendingArchive;
  const owed = (before?.direction ?? direction) === 'owed_by_me';
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/debts'); } };

  function profileBase() {
    return {
      id: before?.id ?? identity.id,
      accountId: before?.accountId ?? identity.accountId,
      direction: before?.direction ?? direction,
      counterparty: counterparty.trim(),
      dueDateISO: dueMode === 'dated' ? todayKey(dueDate) : null,
      note: note.trim(),
      createdAt: before?.createdAt ?? identity.createdAt,
    };
  }

  async function save() {
    if (saving.current || !snapshot) return;
    saving.current = true; setBusy(true); setError(null); Keyboard.dismiss();
    try {
      if (before) {
        let submission = pendingEdit;
        if (!submission) {
          const candidate: PersonalDebtProfile = { ...profileBase(), active: before.active, revision: before.revision, updatedAt: before.updatedAt };
          validatePersonalDebtProfile(candidate, snapshot.accounts);
          if (samePersonalDebtProfile(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: new Date().toISOString() };
          validatePersonalDebtProfile(submission, snapshot.accounts);
          setPendingEdit(submission);
        }
        await saveDebt(submission);
      } else {
        let submission = pendingCreate;
        if (!submission) {
          const principal = parseMinorUnits(amount);
          if (principal <= 0) throw new Error('Ingresá un monto mayor que cero.');
          const debt: PersonalDebtProfile = { ...profileBase(), active: true, revision: 0, updatedAt: identity.createdAt };
          const newAccount: Account = {
            id: identity.accountId,
            name: (direction === 'owed_by_me' ? 'Debo · ' : 'Me deben · ') + counterparty.trim(),
            currency,
            openingMinor: direction === 'owed_by_me' ? -principal : principal,
            createdAt: identity.createdAt,
          };
          validateAccount(newAccount);
          validatePersonalDebtProfile(debt, [...snapshot.accounts, newAccount]);
          submission = { account: newAccount, debt };
          setPendingCreate(submission);
        }
        await addDebt(submission.account, submission.debt);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar la deuda. Reintentá el mismo envío.');
    } finally { saving.current = false; setBusy(false); }
  }

  async function commitArchive(submission: PersonalDebtProfile) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      setPendingArchive(submission);
      await saveDebt(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos archivar la deuda. Reintentá el mismo cambio.');
    } finally { saving.current = false; setBusy(false); }
  }
  function archive() {
    if (!before || busy || saving.current) return;
    if (pendingArchive) { void commitArchive(pendingArchive); return; }
    const submission = { ...before, active: !before.active, revision: before.revision + 1, updatedAt: new Date().toISOString() };
    if (!before.active) { void commitArchive(submission); return; }
    Alert.alert('¿Archivar esta deuda?', 'Los pagos o cobros anteriores siguen guardados. Solo deja de aparecer como pendiente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Archivar', style: 'destructive', onPress: () => { void commitArchive(submission); } },
    ]);
  }

  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar deuda' : 'Nueva deuda', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />

    {before && account ? <Surface grouped>
      <DetailRow label={owed ? 'Debo a' : 'Me debe'} value={before.counterparty} />
      <DetailRow label="Moneda" value={account.currency} last />
    </Surface> : <>
      <Choices value={direction} onChange={setDirection} disabled={locked}
        options={[{ value: 'owed_by_me', label: 'Debo' }, { value: 'owed_to_me', label: 'Me deben' }]} />
      <AmountField label={owed ? 'Monto que debés' : 'Monto que te deben'} currency={currency} value={amount}
        onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} />
      <Choices value={currency} onChange={setCurrency} disabled={locked}
        options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />
    </>}

    <Field label={owed ? 'Persona o entidad' : 'Persona o cliente'} value={counterparty} onChangeText={setCounterparty}
      placeholder="Nombre o concepto" maxLength={80} autoCapitalize="words" editable={!locked} />

    <View style={{ gap: space.s }}>
      <AppText secondary variant="footnote" style={{ fontWeight: '500' }}>Vencimiento</AppText>
      <Choices value={dueMode} onChange={setDueMode} disabled={locked}
        options={[{ value: 'none', label: 'Sin fecha' }, { value: 'dated', label: 'Con fecha' }]} />
    </View>
    {dueMode === 'dated' && <Surface grouped>
      <DateField value={dueDate} onChange={setDueDate} disabled={locked} allowFuture label="Fecha límite" />
    </Surface>}

    <Field label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={120} autoCapitalize="sentences" editable={!locked} />

    <AppText secondary variant="footnote">
      {owed ? 'Cada pago que registres sale de una cuenta y baja este saldo.' : 'Cada cobro que registres entra a una cuenta y baja este saldo.'} No se crean gastos ni ingresos al saldar una deuda.
    </AppText>
    <ErrorMessage message={error} />
    {(pendingCreate || pendingEdit) && error && <AppText secondary variant="footnote">
      El envío quedó congelado para que Reintentar no cree otra obligación ni aplique cambios dos veces.
    </AppText>}
    <ActionButton label={error && (pendingCreate || pendingEdit) ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Crear deuda'}
      onPress={save} busy={busy} disabled={before ? !counterparty.trim() : !counterparty.trim() || !amount.trim()} />
    {before && <ActionButton label={pendingArchive && error ? 'Reintentar' : before.active ? 'Archivar deuda' : 'Reactivar deuda'}
      onPress={archive} secondary disabled={busy || !!pendingEdit} />}
  </Screen>;
}
