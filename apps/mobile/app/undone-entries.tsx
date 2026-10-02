import { useMemo } from 'react';
import { View } from 'react-native';
import { useLedger } from '../src/storage/LedgerProvider';
import { ActionButton, AppText, EmptyState, EntryRow, ErrorMessage, SectionTitle, Surface } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { useOperationChange } from '../src/ui/operation-actions';
import { operationIdOf, undoneOperationLines } from '../src/ui/operation-presentation';
import { useI18n } from '../src/i18n/provider';

export default function UndoneEntriesScreen() {
  const { archive } = useLedger();
  const { t, errorText } = useI18n();
  const changes = useOperationChange();
  const entries = useMemo(() => archive?.records.filter(record => record.voided).map(record => record.entry) ?? [], [archive]);
  const transfers = useMemo(() => archive?.transfers?.filter(r => r.voided).map(r => r.transfer) ?? [], [archive]);
  // 24T3 (A26): undone devoluciones and adelantos de cuotas, one row per operation (a devolución that only lowered future
  // instalments included), above the movements. «Restaurar» only when the domain's dry run passes; otherwise the reason.
  const operations = useMemo(() => archive ? undoneOperationLines(archive) : [], [archive]);
  // 24UX6E: nothing here counts in a balance or a report, so the day sections carry no net (`dayNet={false}`); the
  // explanation sits on the type scale and only over a list, never above «Nada para recuperar».
  const anything = entries.length + transfers.length + operations.length > 0;
  const accounts = archive?.accounts ?? [];
  const explanation = <AppText secondary variant="subhead" style={{ paddingBottom: 8 }}>{t('activity.undoneHeader')}</AppText>;
  const header = !anything ? undefined : !operations.length ? explanation : <View>
    {explanation}
    <View style={{ paddingTop: 16, gap: 8 }}>
      <SectionTitle>{t('operations.undone.section')}</SectionTitle>
      {operations.map(line => {
        const id = operationIdOf(line)!;
        const operation = archive?.purchaseOperations?.find(item => item.id === id);
        const account = accounts.find(item => item.id === line.accountId);
        if (!operation || !account) return null;
        const check = changes.check(operation);
        const frozen = changes.pending?.after.id === id;
        const error = changes.error?.id === id ? changes.error.message : null;
        return <View key={id} style={{ gap: 8 }}>
          <Surface grouped><EntryRow entry={line} account={account} last /></Surface>
          <ErrorMessage message={error} />
          {check.ok || frozen
            ? <ActionButton label={frozen ? t('common.retryChange') : t('operations.undone.restore')} icon="arrow-redo-outline" compact secondary
              busy={changes.busyId === id} disabled={changes.busyId !== null && changes.busyId !== id} onPress={() => changes.ask(operation)} />
            : <AppText secondary variant="footnote">{errorText(check.reason)}</AppText>}
        </View>;
      })}
    </View>
  </View>;
  return <EntryList entries={entries} transfers={transfers} accounts={accounts} dayNet={false} header={header}
    empty={operations.length ? undefined : <EmptyState title={t('activity.undoneEmptyTitle')} detail={t('activity.undoneEmptyDetail')} icon="arrow-undo-outline" />} />;
}
