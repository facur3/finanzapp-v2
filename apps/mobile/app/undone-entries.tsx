import { useMemo } from 'react';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, EmptyState } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';
import { useI18n } from '../src/i18n/provider';

export default function UndoneEntriesScreen() {
  const { archive } = useLedger();
  const { t } = useI18n();
  const entries = useMemo(() => archive?.records.filter(record => record.voided).map(record => record.entry) ?? [], [archive]);
  const transfers = useMemo(() => archive?.transfers?.filter(r => r.voided).map(r => r.transfer) ?? [], [archive]);
  // 24UX6E: nothing here counts in a balance or a report, so the day sections carry no net (`dayNet={false}`); the
  // explanation sits on the type scale and only over a list, never above «Nada para recuperar».
  const anything = entries.length + transfers.length > 0;
  return <EntryList entries={entries} transfers={transfers} accounts={archive?.accounts ?? []} dayNet={false}
    header={anything ? <AppText secondary variant="subhead" style={{ paddingBottom: 8 }}>{t('activity.undoneHeader')}</AppText> : undefined}
    empty={<EmptyState title={t('activity.undoneEmptyTitle')} detail={t('activity.undoneEmptyDetail')} icon="arrow-undo-outline" />} />;
}
