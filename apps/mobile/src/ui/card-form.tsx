import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { formatMinorUnits, parseMinorUnits, sameCreditCardProfile, validateAccount, validateCreditCardProfile,
  type Account, type CreditCardProfile, type Currency } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, DetailRow, ErrorMessage, Field, IconButton, Screen, Surface, useStacked } from './components';
import { space } from './theme';

type PendingCreate = { account: Account; card: CreditCardProfile };

/** Creates a card with its hidden internal account in one durable commit, or
 * edits the card profile. A submitted command stays frozen across retries. */
export function CardForm({ original }: { original?: CreditCardProfile }) {
  const stacked = useStacked();
  const { snapshot, addCard, saveCard } = useLedger();
  const account = snapshot?.accounts.find(item => item.id === original?.accountId);
  const [before] = useState(original);
  const [identity] = useState(() => ({ id: randomUUID(), accountId: randomUUID(), createdAt: new Date().toISOString() }));
  const [name, setName] = useState(account?.name ?? '');
  const [issuer, setIssuer] = useState(before?.issuer ?? '');
  const [last4, setLast4] = useState(before?.last4 ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'ARS');
  const [debt, setDebt] = useState('');
  const [limit, setLimit] = useState(before?.creditLimitMinor ? formatMinorUnits(before.creditLimitMinor) : '');
  const [closingDay, setClosingDay] = useState(before ? String(before.closingDay) : '');
  const [dueDay, setDueDay] = useState(before ? String(before.dueDay) : '');
  const [busy, setBusy] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [pendingEdit, setPendingEdit] = useState<CreditCardProfile | null>(null);
  const [pendingArchive, setPendingArchive] = useState<CreditCardProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const locked = busy || !!pendingCreate || !!pendingEdit || !!pendingArchive;
  const close = () => { if (!saving.current) { if (router.canGoBack()) router.back(); else router.replace('/cards'); } };

  function day(value: string, label: string): number {
    const number = Number(value);
    if (!/^\d{1,2}$/.test(value) || number < 1 || number > 31) throw new Error(`Ingresá el día de ${label} entre 1 y 31.`);
    return number;
  }
  function profileBase(): Omit<CreditCardProfile, 'revision' | 'updatedAt' | 'active'> {
    return {
      id: before?.id ?? identity.id,
      accountId: before?.accountId ?? identity.accountId,
      issuer: issuer.trim(),
      last4: last4.trim(),
      creditLimitMinor: limit.trim() ? parseMinorUnits(limit) : null,
      closingDay: day(closingDay.trim(), 'cierre'),
      dueDay: day(dueDay.trim(), 'vencimiento'),
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
          const candidate: CreditCardProfile = { ...profileBase(), active: before.active, revision: before.revision, updatedAt: before.updatedAt };
          validateCreditCardProfile(candidate, snapshot.accounts);
          if (sameCreditCardProfile(candidate, before)) { saving.current = false; close(); return; }
          submission = { ...candidate, revision: before.revision + 1, updatedAt: new Date().toISOString() };
          validateCreditCardProfile(submission, snapshot.accounts);
          setPendingEdit(submission);
        }
        await saveCard(submission);
      } else {
        let submission = pendingCreate;
        if (!submission) {
          const openingDebt = debt.trim() ? parseMinorUnits(debt) : 0;
          if (openingDebt < 0) throw new Error('La deuda inicial no puede ser negativa. Si la tarjeta tiene saldo a favor, registralo después como devolución.');
          const card: CreditCardProfile = { ...profileBase(), active: true, revision: 0, updatedAt: identity.createdAt };
          const newAccount: Account = { id: identity.accountId, name: name.trim(), currency, openingMinor: -openingDebt, createdAt: identity.createdAt };
          validateAccount(newAccount);
          validateCreditCardProfile(card, [...snapshot.accounts, newAccount]);
          submission = { account: newAccount, card };
          setPendingCreate(submission);
        }
        await addCard(submission.account, submission.card);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar la tarjeta. Reintentá el mismo envío.');
    } finally { saving.current = false; setBusy(false); }
  }

  async function commitArchive(submission: CreditCardProfile) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      setPendingArchive(submission);
      await saveCard(submission);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false; close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos archivar la tarjeta. Reintentá el mismo cambio.');
    } finally { saving.current = false; setBusy(false); }
  }
  function archive() {
    if (!before || busy || saving.current) return;
    if (pendingArchive) { void commitArchive(pendingArchive); return; }
    const submission = { ...before, active: !before.active, revision: before.revision + 1, updatedAt: new Date().toISOString() };
    if (!before.active) { void commitArchive(submission); return; }
    Alert.alert('¿Archivar esta tarjeta?', 'Las compras y pagos anteriores siguen en tus registros y reportes. La tarjeta deja de aparecer en Tarjetas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Archivar', style: 'destructive', onPress: () => { void commitArchive(submission); } },
    ]);
  }

  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar tarjeta' : 'Nueva tarjeta', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />

    {before && account ? <Surface grouped>
      <DetailRow label="Tarjeta" value={account.name} icon="card-outline" onPress={() => router.push({ pathname: '/edit-account/[id]', params: { id: account.id } })} />
      <DetailRow label="Moneda" value={account.currency} last />
    </Surface> : <>
      <Field label="Nombre de la tarjeta" value={name} onChangeText={setName}
        placeholder="Ej. Visa Galicia" maxLength={80} autoCapitalize="words" editable={!locked} />
      <Choices value={currency} onChange={setCurrency} disabled={locked}
        options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />
      <AmountField label="Deuda actual (opcional)" currency={currency} value={debt}
        onChangeText={value => { setDebt(value); setError(null); }} editable={!locked} />
      <AppText secondary variant="footnote" style={{ marginTop: -space.m }}>Lo que ya debés hoy en esta tarjeta. No cuenta como gasto: las compras anteriores no se vuelven a registrar.</AppText>
    </>}

    <View style={{ gap: space.l }}>
      <Field label="Emisor (opcional)" value={issuer} onChangeText={setIssuer}
        placeholder="Banco o billetera" maxLength={80} autoCapitalize="words" editable={!locked} />
      <Field label="Últimos 4 dígitos (opcional)" value={last4} onChangeText={value => setLast4(value.replace(/\D/g, '').slice(0, 4))}
        placeholder="4009" keyboardType="number-pad" maxLength={4} editable={!locked} />
    </View>

    <AmountField label="Límite de crédito (opcional)" currency={currency} value={limit}
      onChangeText={value => { setLimit(value); setError(null); }} editable={!locked} />

    <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 12 }}>
      <View style={{ flex: stacked ? undefined : 1 }}><Field label="Día de cierre" value={closingDay} onChangeText={value => setClosingDay(value.replace(/\D/g, '').slice(0, 2))}
        placeholder="1–31" keyboardType="number-pad" maxLength={2} editable={!locked} /></View>
      <View style={{ flex: stacked ? undefined : 1 }}><Field label="Día de vencimiento" value={dueDay} onChangeText={value => setDueDay(value.replace(/\D/g, '').slice(0, 2))}
        placeholder="1–31" keyboardType="number-pad" maxLength={2} editable={!locked} /></View>
    </View>
    <AppText secondary variant="footnote" style={{ marginTop: -space.s }}>
      Están en tu resumen. Con ellos FinanzApp calcula el próximo cierre y vencimiento; no consulta al banco.
    </AppText>

    <ErrorMessage message={error} />
    {(pendingCreate || pendingEdit) && error && <AppText secondary variant="footnote">
      El envío quedó congelado para que Reintentar no cree otra tarjeta ni aplique cambios dos veces.
    </AppText>}
    <ActionButton label={error && (pendingCreate || pendingEdit) ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Crear tarjeta'}
      onPress={save} busy={busy} disabled={before ? !closingDay || !dueDay : !name.trim() || !closingDay || !dueDay} />
    {before && <ActionButton label={pendingArchive && error ? 'Reintentar' : before.active ? 'Archivar tarjeta' : 'Reactivar tarjeta'}
      onPress={archive} secondary disabled={busy || !!pendingEdit} />}
  </Screen>;
}
