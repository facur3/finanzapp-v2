import { useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { formatMinorUnits, parseMinorUnits, sameRecurringRule, todayKey, validateRecurringRule,
  type EntryKind, type RecurringFrequency, type RecurringRule } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { AccountField, CategoryField, DateField } from './form-controls';
import { initialAccountId } from './presentation';

export function RecurringForm({ original, accountId: requestedAccount }: { original?: RecurringRule; accountId?: string }) {
  const { snapshot, saveRecurring } = useLedger();
  const accounts = snapshot?.accounts ?? [];
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [kind, setKind] = useState<EntryKind>(before?.kind ?? 'expense');
  const [accountId, setAccountId] = useState(() => before?.accountId ?? initialAccountId(accounts, requestedAccount));
  const [amount, setAmount] = useState(before ? formatMinorUnits(before.amountMinor) : '');
  const [merchant, setMerchant] = useState(before?.merchant ?? '');
  const [category, setCategory] = useState(before?.category ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(before?.frequency ?? 'monthly');
  const [date, setDate] = useState(() => new Date((before?.nextDateISO ?? todayKey()) + 'T12:00:00'));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<RecurringRule | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find(item => item.id === accountId);
  const originalCurrency = accounts.find(item => item.id === before?.accountId)?.currency;
  const eligibleAccounts = before ? accounts.filter(item => item.currency === originalCurrency) : accounts;
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/recurring'); } };

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const nextDateISO = todayKey(date);
        if (nextDateISO < todayKey()) throw new Error('La próxima fecha debe ser hoy o una fecha futura.');
        const now = new Date().toISOString();
        if (before) {
          const anchorDateISO = nextDateISO === before.nextDateISO && frequency === before.frequency ? before.anchorDateISO : nextDateISO;
          const candidate: RecurringRule = {
            ...before,
            accountId,
            kind,
            amountMinor: parseMinorUnits(amount),
            merchant: merchant.trim(),
            category: category.trim(),
            frequency,
            anchorDateISO,
            nextDateISO,
          };
          validateRecurringRule(candidate, accounts);
          if (sameRecurringRule(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: now };
        } else {
          submission = {
            id: operation.id,
            createdAt: operation.createdAt,
            updatedAt: operation.createdAt,
            revision: 0,
            accountId,
            kind,
            amountMinor: parseMinorUnits(amount),
            merchant: merchant.trim(),
            category: category.trim(),
            frequency,
            anchorDateISO: nextDateISO,
            nextDateISO,
            active: true,
          };
        }
        validateRecurringRule(submission, accounts);
        setPending(submission);
      }
      await saveRecurring(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el recurrente. Conservamos el mismo envío para reintentar sin duplicarlo.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar recurrente' : 'Nuevo recurrente', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    {!accounts.length ? <EmptyState title="Primero, una cuenta"
      detail="Los recurrentes necesitan una cuenta para registrar cada vencimiento en la moneda correcta."
      action={<ActionButton label="Agregar cuenta" onPress={() => router.replace('/new-account')} />} /> : <>
      <Choices value={kind} onChange={setKind} disabled={locked}
        options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} />
      <AmountField currency={account?.currency ?? 'ARS'} value={amount}
        onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} />
      <Field label={kind === 'expense' ? 'Comercio o concepto' : 'Origen o concepto'} value={merchant}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!locked} />
      <Surface grouped>
        <CategoryField entries={snapshot?.entries ?? []} kind={kind} value={category} onChange={setCategory} disabled={locked} />
        <AccountField accounts={eligibleAccounts} value={accountId} onChange={setAccountId} disabled={locked} />
        <DateField value={date} onChange={setDate} disabled={locked} allowFuture label="Próxima fecha" />
      </Surface>
      <ViewFrequency value={frequency} onChange={setFrequency} disabled={locked} />
      <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
        Si la próxima fecha es hoy, FinanzApp registra ese movimiento al guardar. Luego avanza la fecha automáticamente sin duplicarlo.
      </AppText>
      <ErrorMessage message={error} />
      {pending && !busy && error && <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
        El envío quedó congelado para que Reintentar no cree otra regla.
      </AppText>}
      <ActionButton label={pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Crear recurrente'}
        onPress={save} busy={busy} disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account} />
    </>}
  </Screen>;
}

function ViewFrequency({ value, onChange, disabled }: {
  value: RecurringFrequency; onChange: (value: RecurringFrequency) => void; disabled: boolean;
}) {
  return <>
    <AppText secondary style={{ fontSize: 14, fontWeight: '500' }}>Frecuencia</AppText>
    <Choices value={value} onChange={onChange} disabled={disabled}
      options={[
        { value: 'weekly', label: 'Semanal' },
        { value: 'monthly', label: 'Mensual' },
        { value: 'yearly', label: 'Anual' },
      ]} />
  </>;
}
