import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { formatMinorUnits, parseMinorUnits, sameMonthlyBudget, validateMonthlyBudget,
  type BudgetScope, type Currency, type MonthlyBudget } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, ErrorMessage, IconButton, Screen } from './components';
import { CategoryField } from './form-controls';
import { formatMonth } from '../i18n/format';

const monthLabel = (monthISO: string) => formatMonth(monthISO);

/** One limit for one month and currency. The first question is what kind of
 * limit: General is the ceiling for all of the month's recorded expenses and
 * has no category; Por categoría is a sublimit inside it for one category.
 * The kind and the currency are fixed once a budget exists; editing changes
 * the amount (and the category of a sublimit). */
export function BudgetForm({ original, monthISO, currency: requestedCurrency, scope: requestedScope }: {
  original?: MonthlyBudget; monthISO: string; currency?: string; scope?: string;
}) {
  const { snapshot, saveBudget } = useLedger();
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [scope, setScope] = useState<BudgetScope>(before?.scope ?? (requestedScope === 'total' ? 'total' : 'category'));
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
        const amountMinor = parseMinorUnits(amount);
        if (before) {
          // The kind never changes on edit: a total keeps no category, a sublimit keeps one.
          const candidate: MonthlyBudget = before.scope === 'total' ? { ...before, amountMinor }
            : { ...before, category: category.trim(), amountMinor };
          validateMonthlyBudget(candidate);
          if (sameMonthlyBudget(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: now };
        } else {
          const base = { id: operation.id, currency, monthISO, amountMinor, active: true, createdAt: operation.createdAt, revision: 0, updatedAt: operation.createdAt };
          submission = scope === 'total' ? { ...base, scope: 'total' } : { ...base, scope: 'category', category: category.trim() };
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

  const general = scope === 'total';
  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar presupuesto' : 'Nuevo presupuesto', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    <View style={{ gap: 4, alignItems: 'center', paddingTop: 8 }}>
      <AppText secondary style={{ fontSize: 14, textTransform: 'capitalize' }}>{monthLabel(before?.monthISO ?? monthISO)}</AppText>
      <AppText variant="title2">{general ? 'Presupuesto general' : 'Límite por categoría'}</AppText>
    </View>
    {!before && <Choices<BudgetScope> value={scope} onChange={setScope} disabled={locked}
      options={[{ value: 'total', label: 'General' }, { value: 'category', label: 'Por categoría' }]} />}
    {!before && <Choices value={currency} onChange={setCurrency} disabled={locked}
      options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />}
    <AmountField label="Presupuesto" currency={currency} value={amount}
      onChangeText={value => { setAmount(value); setError(null); }} editable={!locked} />
    {!general && <CategoryField entries={snapshot?.entries ?? []} kind="expense" value={category} onChange={setCategory} disabled={locked} prominent />}
    <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>
      {general ? 'Es el techo de todos los gastos registrados del mes en esta moneda. No cuenta ingresos, transferencias ni pagos de tarjeta; una compra con tarjeta cuenta una sola vez.'
        : 'Se compara con los gastos registrados en esta categoría durante ese mes. Es un sublímite: no se suma al presupuesto general.'}
    </AppText>
    <ErrorMessage message={error} />
    {pending && error && <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      El envío quedó congelado para que Reintentar no cree otro presupuesto.
    </AppText>}
    <ActionButton label={pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Crear presupuesto'}
      onPress={save} busy={busy} disabled={!amount.trim() || (!general && !category.trim())} />
    {before && <ActionButton label={archivePending && error ? 'Reintentar eliminación' : 'Eliminar presupuesto'}
      onPress={archive} secondary disabled={busy || pending !== null} />}
  </Screen>;
}
