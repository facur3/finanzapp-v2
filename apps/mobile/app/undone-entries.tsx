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
  return <EntryList entries={entries} transfers={transfers} accounts={archive?.accounts ?? []}
    header={<AppText secondary style={{ fontSize: 15, paddingBottom: 8 }}>{t('activity.undoneHeader')}</AppText>}
    empty={<EmptyState title={t('activity.undoneEmptyTitle')} detail={t('activity.undoneEmptyDetail')} icon="arrow-undo-outline" />} />;
}
