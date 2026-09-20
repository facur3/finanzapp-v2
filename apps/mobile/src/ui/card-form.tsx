import { useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { formatMinorUnits, parseMinorUnits, sameCreditCardProfile, validateAccount, validateCreditCardProfile,
  type Account, type CreditCardProfile, type Currency } from '@finanzapp/domain';
import { useLedger } from '../storage/LedgerProvider';
import { ActionButton, AmountField, AppText, Choices, DetailRow, ErrorMessage, Field, IconButton, Screen, Surface } from './components';

type PendingCreate = { account: Account; card: CreditCardProfile };

export function CardForm({ original }: { original?: CreditCardProfile }) {
  const { snapshot, addCard, saveCard } = useLedger();
  const account = snapshot?.accounts.find(item => item.id === original?.accountId);
  const [before] = useState(original);
  const [identity] = useState(() => ({
    id: randomUUID(),
    accountId: randomUUID(),
    createdAt: new Date().toISOString(),
  }));
  const [name, setName] = useState(account?.name ?? '');
  const [issuer, setIssuer] = useState(before?.issuer ?? '');
  const [last4, setLast4] = useState(before?.last4 ?? '');
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? 'ARS');
  const [debt, setDebt] = useState(before || !account ? '' : formatMinorUnits(Math.max(0, -account.openingMinor)));
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

  function profileBase(): Omit<CreditCardProfile, 'revision' | 'updatedAt' | 'active'> {
    const createdAt = before?.createdAt ?? identity.createdAt;
    return {
      id: before?.id ?? identity.id,
      accountId: before?.accountId ?? identity.accountId,
      issuer: issuer.trim(),
      last4: last4.trim(),
      creditLimitMinor: limit.trim() ? parseMinorUnits(limit) : null,
      closingDay: Number(closingDay),
      dueDay: Number(dueDay),
      createdAt,
    };
  }

  async function save() {
    if (saving.current || !snapshot) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    Keyboard.dismiss();
    try {
      if (before) {
        let submission = pendingEdit;
        if (!submission) {
          const candidate: CreditCardProfile = { ...profileBase(), active: before.active,
            revision: before.revision, updatedAt: before.updatedAt };
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
          const card: CreditCardProfile = { ...profileBase(), active: true, revision: 0, updatedAt: identity.createdAt };
          const newAccount: Account = {
            id: identity.accountId,
            name: name.trim(),
            currency,
            openingMinor: -openingDebt,
            createdAt: identity.createdAt,
          };
          validateAccount(newAccount);
          validateCreditCardProfile(card, [...snapshot.accounts, newAccount]);
          submission = { account: newAccount, card };
          setPendingCreate(submission);
        }
        await addCard(submission.account, submission.card);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      saving.current = false;
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar la tarjeta. Reintentá el mismo envío.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
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
    const submission = { ...before, active: false, revision: before.revision + 1, updatedAt: new Date().toISOString() };
    Alert.alert('¿Archivar esta tarjeta?', 'Las compras y pagos anteriores siguen en tus registros. La tarjeta deja de aparecer como activa.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Archivar', style: 'destructive', onPress: () => { void commitArchive(submission); } },
    ]);
  }

  return <Screen>
    <Stack.Screen options={{ title: before ? 'Editar tarjeta' : 'Nueva tarjeta', gestureEnabled: !busy,
      headerLeft: () => <IconButton name="close" label="Cerrar" onPress={close} disabled={busy} /> }} />

    {before && account ? <Surface grouped>
      <DetailRow label="Tarjeta" value={account.name} />
      <DetailRow label="Moneda" value={account.currency} last />
    </Surface> : <>
      <Field label="Nombre de la tarjeta" value={name} onChangeText={setName}
        placeholder="Ej. Visa Santander" maxLength={80} autoCapitalize="words" editable={!locked} />
      <Choices value={currency} onChange={setCurrency} disabled={locked}
        options={[{ value: 'ARS', label: 'Pesos · ARS' }, { value: 'USD', label: 'Dólares · USD' }]} />
      <AmountField label="Deuda actual (opcional)" currency={currency} value={debt}
        onChangeText={value => { setDebt(value); setError(null); }} editable={!locked} />
    </>}

    <Surface grouped>
      <View style={{ padding: 16, gap: 14 }}>
        <Field label="Emisor (opcional)" value={issuer} onChangeText={setIssuer}
          placeholder="Banco o fintech" maxLength={80} autoCapitalize="words" editable={!locked} />
        <Field label="Últimos 4 dígitos (opcional)" value={last4} onChangeText={value => setLast4(value.replace(/\D/g, '').slice(0, 4))}
          placeholder="1234" keyboardType="number-pad" maxLength={4} editable={!locked} />
      </View>
    </Surface>

    <AmountField label="Límite de crédito (opcional)" currency={currency} value={limit}
      onChangeText={value => { setLimit(value); setError(null); }} editable={!locked} />

    <Surface grouped>
      <View style={{ padding: 16, gap: 14 }}>
        <Field label="Día de cierre" value={closingDay} onChangeText={value => setClosingDay(value.replace(/\D/g, '').slice(0, 2))}
          placeholder="1–31" keyboardType="number-pad" maxLength={2} editable={!locked} />
        <Field label="Día de vencimiento" value={dueDay} onChangeText={value => setDueDay(value.replace(/\D/g, '').slice(0, 2))}
          placeholder="1–31" keyboardType="number-pad" maxLength={2} editable={!locked} />
      </View>
    </Surface>

    <AppText secondary style={{ fontSize: 13 }}>
      Las compras se registran como gasto una sola vez. Pagar la tarjeta mueve saldo hacia la deuda y no vuelve a contar el consumo.
    </AppText>
    <ErrorMessage message={error} />
    {(pendingCreate || pendingEdit) && error && <AppText secondary style={{ fontSize: 13 }}>
      El envío quedó congelado para que Reintentar no cree otra tarjeta ni aplique cambios dos veces.
    </AppText>}
    <ActionButton label={error && (pendingCreate || pendingEdit) ? 'Reintentar guardado' : before ? 'Guardar cambios' : 'Crear tarjeta'}
      onPress={save} busy={busy} disabled={before ? !closingDay || !dueDay : !name.trim() || !closingDay || !dueDay} />
    {before && <ActionButton label={pendingArchive && error ? 'Reintentar archivo' : 'Archivar tarjeta'}
      onPress={archive} secondary disabled={busy || !!pendingEdit} />}
  </Screen>;
}
