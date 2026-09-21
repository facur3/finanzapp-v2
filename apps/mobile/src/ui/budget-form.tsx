import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { formatMinorUnits, parseMinorUnits, sameMonthlyBudget, validateMonthlyBudget,
  type Currency, type MonthlyBudget } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, ErrorMessage, IconButton, Screen } from './components';
import { CategoryField } from './form-controls';

function monthLabel(monthISO: string) {
  const [year, month] = monthISO.split('-').map(Number);
  return new Date(year, month - 1, 1, 12).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function BudgetForm({ original, monthISO, currency: requestedCurrency }: {
  original?: MonthlyBudget; monthISO: string; currency?: string;
}) {
  const { snapshot, saveBudget } = useLedger();
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [currency, setCurrency] = useState<Currency>(before?.currency ?? (requestedCurrency === 'USD' ? 'USD' : 'ARS'));
  const [amount, setAmount] = useState(before ? formatMinorUnits(before.amountMinor) : '');
  const [category, setCategory] = useState(before?.category ?? '');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<MonthlyBudget | null>(null);
  const [archivePending, setArchivePending] = useState<MonthlyBudget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || pending !== null || archivePending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/budgets'); } };

  async function save() {
    if (saving.current || !snapshot) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const now = new Date().toISOString();
        if (before) {
          const candidate: MonthlyBudget = {
            ...before,
            category: category.trim(),
            amountMinor: parseMinorUnits(amount),
          };
          validateMonthlyBudget(candidate);
          if (sameMonthlyBudget(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: now };
        } else {
          submission = {
            id: operation.id,
            category: category.trim(),
            currency,
            monthISO,
            amountMinor: parseMinorUnits(amount),
            active: true,
            createdAt: operation.createdAt,
            revision: 0,
            updatedAt: operation.createdAt,
          };
        }
        validateMonthlyBudget(submission);
        setPending(submission);
      }
      await saveBudget(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar el presupuesto. Reintentá con el mismo envío.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function commitArchive(submission: MonthlyBudget) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      setArchivePending(submission);
      await saveBudget(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos eliminar el presupuesto. Reintentá el mismo cambio.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function archive() {
    if (!before || busy || saving.current) return;
    if (archivePending) {
      await commitArchive(archivePending);
      return;
    }
    const submission: MonthlyBudget = {
      ...before, active: false, revision: before.revision + 1, updatedAt: new Date().toISOString(),
    };
    Alert.alert('¿Eliminar este presupuesto?', 'Se deja de usar para este mes. Tus gastos y movimientos no se modifican.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => { void commitArchive(submission); } },
    ]);
  }

  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar presupuesto' : 'Nuevo presupuesto', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    <View style={{ gap: 4, alignItems: 'center', paddingTop: 8 }}>
      <AppText secondary style={{ fontSize: 14, textTransform: 'capitalize' }}>{monthLabel(before?.monthISO ?? monthISO)}</AppText>
      <AppText variant="title2">Límite mensual</AppText>
    </View>
    {!before && <Choices value={currency} onChange={setCurrency} disabled={locked}
      options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />}
    <AmountField label="Presupuesto" currency={currency} value={amount}
      onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} />
    <CategoryField entries={snapshot?.entries ?? []} kind="expense" value={category} onChange={setCategory} disabled={locked} prominent />
    <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>
      Se compara con los gastos registrados en esta categoría durante ese mes.
    </AppText>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      El envío quedó congelado para que Reintentar no cree otro presupuesto.
    </AppText>}
    <ActionButton label={pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Crear presupuesto'}
      onPress={save} busy={busy} disabled={!amount.trim() || !category.trim()} />
    {before && <ActionButton label={archivePending && error ? 'Reintentar eliminación' : 'Eliminar presupuesto'}
      onPress={archive} secondary disabled={busy || pending !== null} />}
  </Screen>;
}
