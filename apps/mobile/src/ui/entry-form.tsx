import { useMemo, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { accountBalanceMinor, categoryKey, formatMinorUnits, makeEntryChange, parseMinorUnits, sameEntry, summarizeMonthlyBudgets, todayKey,
  validateEntry, validateEntryChange, type Entry, type EntryChange, type EntryKind, type EntryRecord } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { budgetTone } from './budget-presentation';
import { ActionButton, AmountField, AppText, Choices, EmptyState, ErrorMessage, Field, IconButton, Screen, Surface } from './components';
import { AccountField, CategoryField, DateField } from './form-controls';
import { accountKindLabel, postingAccounts } from './liability-presentation';
import { initialAccountId } from './presentation';
import { space } from './theme';

type FormKind = EntryKind | 'transfer';

/** Seed values for a new posting (an Assistant draft handed to the form). Display strings; the amount is the same canonical text the field renders. */
export type EntryPrefill = { amount?: string; merchant?: string; category?: string; dateISO?: string };

/** One form for creating and correcting a posting. The amount, the kind, the
 * category and the account or card are the four things a user must see; a
 * submitted command stays frozen across retries, including a failed refresh
 * after SQLite committed. */
export function EntryForm({ original, accountId: requestedAccount, currency, kind: requestedKind, onKindChange, onAccountChange, prefill }: {
  original?: EntryRecord; accountId?: string; currency?: string; kind?: string; prefill?: EntryPrefill;
  /** When a host owns the Gasto / Ingreso / Transferencia switch it passes `kind` and this callback; the form then renders no switch of its own. */
  onKindChange?: (kind: FormKind) => void;
  /** Lets the host carry the chosen account over when the mode changes. */
  onAccountChange?: (accountId: string) => void;
}) {
  const { snapshot, archive, addEntry, updateEntry } = useLedger();
  // Cash accounts and cards can carry an expense or income; a personal debt only changes through payments.
  const accounts = postingAccounts(snapshot?.accounts ?? [], archive?.debts);
  const [before] = useState(original);
  const [operation] = useState(() => ({ id: randomUUID(), createdAt: new Date().toISOString() }));
  const [ownKind, setKind] = useState<EntryKind>(before?.entry.kind ?? (requestedKind === 'income' ? 'income' : 'expense'));
  const kind: EntryKind = onKindChange ? (requestedKind === 'income' ? 'income' : 'expense') : ownKind;
  const [accountId, setAccountId] = useState(() => before?.entry.accountId ?? initialAccountId(accounts, requestedAccount, currency));
  const [amount, setAmount] = useState(before ? formatMinorUnits(before.entry.amountMinor) : prefill?.amount ?? '');
  const [merchant, setMerchant] = useState(before?.entry.merchant ?? prefill?.merchant ?? '');
  const [category, setCategory] = useState(before?.entry.category ?? prefill?.category ?? '');
  const [date, setDate] = useState(() => before ? new Date(before.entry.dateISO + 'T12:00:00') : prefill?.dateISO ? new Date(prefill.dateISO + 'T12:00:00') : new Date());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ entry: Entry; change?: EntryChange } | null>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const account = accounts.find(item => item.id === accountId);
  const originalCurrency = accounts.find(item => item.id === before?.entry.accountId)?.currency;
  const eligibleAccounts = before ? accounts.filter(item => item.currency === originalCurrency) : accounts;
  const locked = busy || pending !== null;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/'); } };
  const cards = archive?.cards ?? [], debts = archive?.debts ?? [];
  const kindOf = (id: string) => { const found = accounts.find(item => item.id === id); return found ? accountKindLabel(found, cards, debts) : 'Cuenta'; };
  const isCard = !!account && cards.some(card => card.accountId === account.id);

  // Live context for the two prominent selectors: recorded balance or card debt, and the category budget for that month.
  const accountDetail = useMemo(() => {
    if (!account || !snapshot) return undefined;
    const balance = accountBalanceMinor(account, snapshot.entries, snapshot.transfers);
    const money = (minor: number) => (account.currency === 'USD' ? 'US$ ' : '$ ') + formatMinorUnits(Math.abs(minor));
    if (isCard) return balance < 0 ? `Tarjeta de crédito · deuda ${money(balance)}` : `Tarjeta de crédito · ${balance > 0 ? 'a favor ' + money(balance) : 'sin deuda'}`;
    return `Saldo registrado ${balance < 0 ? '−' : ''}${money(balance)}`;
  }, [account, snapshot, isCard]);
  const budget = useMemo(() => {
    if (!account || !snapshot || kind !== 'expense' || !category.trim()) return null;
    try {
      const row = summarizeMonthlyBudgets(snapshot, archive?.budgets ?? [], account.currency, todayKey(date).slice(0, 7)).rows
        .find(item => categoryKey(item.budget.category) === categoryKey(category));
      if (!row) return null;
      const money = (minor: number) => (account.currency === 'USD' ? 'US$ ' : '$ ') + formatMinorUnits(minor);
      return { text: row.exceeded ? `Presupuesto excedido por ${money(-row.remainingMinor)}` : `${money(row.spentMinor)} de ${money(row.budget.amountMinor)} este mes`,
        tone: budgetTone(row) };
    } catch { return null; }
  }, [account, snapshot, archive?.budgets, kind, category, date]);
  let parsed: number | null = null;
  try { parsed = parseMinorUnits(amount); } catch { parsed = null; }
  const amountEcho = parsed && parsed > 0 && account ? ` · ${account.currency === 'USD' ? 'US$ ' : '$ '}${formatMinorUnits(parsed)}` : '';

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      let submission = pending;
      if (!submission) {
        const dateISO = todayKey(date);
        if (dateISO > todayKey()) throw new Error('Elegí hoy o una fecha anterior. Los movimientos programados llegan en otra etapa.');
        const entry: Entry = { ...(before?.entry ?? operation), kind, accountId, amountMinor: parseMinorUnits(amount),
          merchant: merchant.trim(), category: category.trim(), dateISO };
        validateEntry(entry, accounts);
        if (before && sameEntry(before.entry, entry)) { saving.current = false; close(); return; }
        const change = before ? makeEntryChange(operation.id, before, 'edit', new Date().toISOString(), entry) : undefined;
        if (change) validateEntryChange(change, accounts);
        submission = { entry, change };
        setPending(submission);
      }
      if (submission.change) await updateEntry(submission.change);
      else await addEntry(submission.entry);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos verificar el guardado. Reintentá con este mismo movimiento.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const title = before ? 'Editar movimiento' : kind === 'expense' ? (isCard ? 'Compra con tarjeta' : 'Registrar gasto') : 'Registrar ingreso';
  return <Screen gap={space.l}>
    <Stack.Screen options={{ title, gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />
    {!accounts.length ? <EmptyState title="Primero, una cuenta" detail="Cada movimiento necesita una cuenta para actualizar su saldo."
      action={<ActionButton label="Agregar cuenta" onPress={() => router.replace('/new-account')} />} /> : <>
      {!onKindChange && <Choices<EntryKind> value={kind} onChange={setKind} disabled={locked}
        options={[{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }]} />}
      <AmountField currency={account?.currency ?? 'ARS'} value={amount} onChangeText={value => { setAmount(value); setError(null); }} editable={!locked}
        tone={kind === 'income' ? 'income' : 'neutral'} label={kind === 'expense' ? 'Gasto' : 'Ingreso'} />
      <View style={{ gap: space.m }}>
        <CategoryField entries={snapshot?.entries ?? []} kind={kind} value={category} onChange={setCategory} disabled={locked}
          prominent detail={budget?.text} detailTone={budget?.tone} />
        <AccountField label={kind === 'expense' ? 'Pagado con' : 'Ingresa en'} accounts={eligibleAccounts} value={accountId} onChange={id => { setAccountId(id); onAccountChange?.(id); }} disabled={locked}
          prominent kindOf={kindOf} detail={accountDetail}
          describe={item => { const balance = snapshot ? accountBalanceMinor(item, snapshot.entries, snapshot.transfers) : 0;
            return (cards.some(card => card.accountId === item.id) ? 'deuda ' : 'saldo ') + formatMinorUnits(Math.abs(balance)); }} />
      </View>
      <Field label={kind === 'expense' ? 'Comercio o concepto' : 'Origen o concepto'} value={merchant} placeholder={kind === 'expense' ? 'Ej. Carrefour' : 'Ej. Sueldo'}
        onChangeText={setMerchant} maxLength={120} autoCapitalize="sentences" editable={!locked} />
      <Surface grouped><DateField value={date} onChange={setDate} disabled={locked} /></Surface>
      {isCard && kind === 'expense' && !before && <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>
        Cuenta como gasto una sola vez y suma a la deuda de la tarjeta. El pago del resumen se registra desde Tarjetas.
      </AppText>}
      {before && <AppText secondary variant="footnote" style={{ textAlign: 'center' }}>Corregís el movimiento original. No se registra otro gasto o ingreso.</AppText>}
      <ErrorMessage message={error} />
      {pending && !busy && error && <AppText secondary variant="footnote">Conservamos el envío para reintentar sin duplicarlo. Para cambiar los datos, cerrá y revisá primero Movimientos.</AppText>}
      <ActionButton label={pending && error ? 'Reintentar guardado' : before ? 'Guardar cambios' : (kind === 'expense' ? 'Guardar gasto' : 'Guardar ingreso') + amountEcho}
        onPress={save} busy={busy} disabled={!amount.trim() || !merchant.trim() || !category.trim() || !account} />
    </>}
  </Screen>;
}
