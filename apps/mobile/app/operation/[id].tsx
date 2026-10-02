import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { isEntryRefund, isPlanPayoff, isPlanRefund, operationPlanId, projectOperationLines, type PurchaseOperation } from '@finanzapp/domain';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, DetailRow, EmptyState, ErrorMessage, GlyphTile, LifecycleNote, MerchantBadge, Money, Screen, SectionTitle, Surface } from '../../src/ui/components';
import { useAccountNameOf, useCategoryLookOf } from '../../src/ui/category-hues';
import { useOperationChange } from '../../src/ui/operation-actions';
import { numberRanges, payoffNumbers, payoffParts } from '../../src/ui/operation-presentation';
import { useI18n } from '../../src/i18n/provider';
import { space, usePalette } from '../../src/ui/theme';

export default function OperationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const operation = archive?.purchaseOperations?.find(item => item.id === id);
  if (!operation) return <Screen><EmptyState title={t('operations.detail.notFoundTitle')} detail={t('operations.detail.notFoundDetail')} icon="arrow-undo-outline" /></Screen>;
  return <OperationDetail key={id} operation={operation} />;
}

/** Producto 24T3: the read-only detail of a devolución or an adelanto de cuotas, pushed from its line (A26). The amount and
 * the purchase first, then the facts it stores, then what it records in the ledger, said once. Its one action is the undo
 * («Deshacer devolución / adelanto») or, once undone, the restore, offered only when the domain's dry run passes; when it
 * does not, the screen says why instead of offering a button storage would refuse. The status updates in place. */
function OperationDetail({ operation }: { operation: PurchaseOperation }) {
  const { archive } = useLedger();
  const p = usePalette();
  const { t, formatDate, formatMonth, moneyText, spokenMoney, errorText } = useI18n();
  const accountName = useAccountNameOf();
  const categoryLook = useCategoryLookOf('expense');
  const changes = useOperationChange();
  const refund = operation.kind === 'refund';
  const voided = operation.voided;
  const currency = operation.currency;
  const account = archive?.accounts.find(item => item.id === operation.accountId);
  const card = archive?.cards?.find(item => item.accountId === operation.accountId);
  const planId = operationPlanId(operation);
  const plan = planId === null ? undefined : archive?.installmentPlans?.find(item => item.id === planId);
  const purchase = isEntryRefund(operation) ? archive?.records.find(record => record.entry.id === operation.target.entryId) : undefined;
  const merchant = purchase?.entry.merchant ?? plan?.merchant ?? '';
  // The category its line counts in, resolved as the ledger reads it (A30 for a plan's credit), even while it is undone.
  const line = archive ? projectOperationLines({ records: archive.records, installmentPlans: archive.installmentPlans, purchaseOperations: [{ ...operation, voided: false }] })[0] : undefined;
  const category = line?.category ?? purchase?.entry.category ?? plan?.category ?? '';
  const categoryLabel = category ? categoryLook(category).label : '';
  const busy = changes.busyId === operation.id;
  const frozen = changes.pending?.after.id === operation.id;
  const check = changes.check(operation);
  const error = changes.error?.id === operation.id ? changes.error.message : null;
  const month = formatMonth(operation.dateISO.slice(0, 7), 'monthYear');
  const long = formatDate(operation.dateISO, 'weekdayLong');
  const date = long.charAt(0).toLocaleUpperCase() + long.slice(1);
  const status = t(voided ? (refund ? 'operations.detail.statusVoidedRefund' : 'operations.detail.statusVoidedPayoff')
    : refund ? 'operations.detail.statusRefund' : 'operations.detail.statusPayoff');
  const name = account ? accountName(account) : '';

  // What it records, with the region's separators on screen and in the spoken form for VoiceOver.
  const effects = (money: (minor: number) => string): string[] => {
    if (isEntryRefund(operation)) return [t('operations.detail.effectEntry', { amount: money(operation.amountMinor), account: name, category: categoryLabel, month })];
    if (isPlanRefund(operation)) return operation.creditMinor > 0 ? [t('operations.detail.effectCredit', { amount: money(operation.creditMinor), card: name, category: categoryLabel, month })] : [];
    return [t('operations.detail.payoffNote')];
  };
  const shown = effects(minor => moneyText(minor, currency));
  const spoken = effects(minor => spokenMoney(minor, currency));

  const actionLabel = frozen ? t('common.retryChange') : t(voided ? (refund ? 'operations.detail.restoreRefund' : 'operations.detail.restorePayoff')
    : refund ? 'operations.detail.undoRefund' : 'operations.detail.undoPayoff');
  return <Screen gap={space.xl}>
    <Stack.Screen options={{ title: t(refund ? 'operations.detail.refundTitle' : 'operations.detail.payoffTitle'), gestureEnabled: !busy, headerBackVisible: !busy }} />
    <View style={{ gap: 14, alignItems: 'center', paddingVertical: 12 }}>
      {refund ? <GlyphTile icon="arrow-undo-outline" large /> : <MerchantBadge merchant={merchant} category={category} large />}
      <View style={{ alignItems: 'center', gap: 4, width: '100%' }}>
        {/* The amount returned or brought forward, unsigned in ink (24UX6C; a devolución is never an income's «+»). */}
        <Money minor={operation.amountMinor} currency={currency} large align="center" color={voided ? p.tertiary : undefined} />
        <AppText variant="title3" style={{ textAlign: 'center' }}>{merchant}</AppText>
        <AppText secondary variant="subhead" style={{ textAlign: 'center' }}>{date}</AppText>
      </View>
      <AppText accessibilityLiveRegion="polite" variant="caption" style={{ color: voided ? p.warning : p.secondary, fontWeight: '500', textAlign: 'center' }}>{status}</AppText>
    </View>
    <Surface grouped>
      <DetailRow label={t(plan ? 'operations.detail.plan' : 'operations.detail.purchase')} value={merchant} icon={plan ? 'layers-outline' : 'bag-outline'} disabled={busy}
        onPress={plan && !plan.deleted ? () => router.push({ pathname: '/installment/[id]', params: { id: plan.id } })
          : purchase ? () => router.push({ pathname: '/entry/[id]', params: { id: purchase.entry.id } }) : undefined} />
      {account && <DetailRow label={t(card ? 'operations.detail.card' : 'operations.detail.account')} value={name} icon={card ? 'card-outline' : 'wallet-outline'} disabled={busy}
        onPress={() => router.push(card ? { pathname: '/card/[id]', params: { id: card.id } } : { pathname: '/account/[id]', params: { id: account.id } })} />}
      <DetailRow label={t('operations.detail.category')} value={categoryLabel} icon="pricetag-outline" />
      <DetailRow label={t('operations.detail.date')} value={formatDate(operation.dateISO, 'dayYear')} spokenValue={formatDate(operation.dateISO, 'long')} icon="calendar-outline" last />
    </Surface>
    <View style={{ gap: space.s }}>
      <SectionTitle>{t('operations.detail.effects')}</SectionTitle>
      {isPlanRefund(operation) && operation.reductions.length > 0 && <Surface grouped>
        {operation.reductions.map((row, index) => <DetailRow key={row.number} label={t('operations.detail.reduction', { number: row.number })}
          value={t('operations.detail.reductionValue', { amount: moneyText(row.minor, currency) })}
          spokenValue={t('operations.detail.reductionValue', { amount: spokenMoney(row.minor, currency) })} last={index === operation.reductions.length - 1} />)}
      </Surface>}
      {isPlanPayoff(operation) && <Surface grouped>
        <DetailRow label={t('operations.detail.covered')} value={t('operations.detail.coveredValue', { count: payoffNumbers(operation).length, range: numberRanges(payoffNumbers(operation)) })} />
        {payoffParts(operation).map((part, index, parts) => {
          const last = index === parts.length - 1;
          if (part.component === 'principal') return <DetailRow key={part.component} label={t('operations.detail.settledPrincipal')} value={moneyText(part.minor, currency)}
            spokenValue={spokenMoney(part.minor, currency)} last={last} />;
          if (operation.financing === 'waived') return <DetailRow key={part.component} label={t(`operations.detail.waivedShare.${part.component}`)}
            value={t('operations.detail.waivedValue')} last={last} />;
          return <DetailRow key={part.component} label={t(`operations.detail.settledShare.${part.component}`)} value={moneyText(part.minor, currency)}
            spokenValue={spokenMoney(part.minor, currency)} last={last} />;
        })}
      </Surface>}
      {shown.map((sentence, index) => <AppText key={index} secondary variant="footnote" accessibilityLabel={spoken[index]}>{sentence}</AppText>)}
      {isPlanRefund(operation) && operation.reductions.length > 0 && <AppText secondary variant="footnote">{t('operations.detail.effectReductions')}</AppText>}
    </View>
    <ErrorMessage message={error} />
    {check.ok || frozen
      ? <ActionButton label={actionLabel} icon={voided ? 'arrow-redo-outline' : 'arrow-undo-outline'} onPress={() => changes.ask(operation)} busy={busy} secondary={!voided} />
      : <LifecycleNote icon="information-circle-outline" title={t(voided ? 'operations.detail.blockedRestoreTitle' : 'operations.detail.blockedTitle')} detail={errorText(check.reason)} />}
  </Screen>;
}
