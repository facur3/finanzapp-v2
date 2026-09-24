import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, Field } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries, selectTransfers, type EntryFilter } from '../../src/ui/presentation';
import { useCategoryLookOf } from '../../src/ui/category-hues';
import { useI18n } from '../../src/i18n/provider';

export default function ActivityScreen() {
  const { snapshot } = useLedger();
  const [filter, setFilter] = useState<EntryFilter>('all');
  const [query, setQuery] = useState('');
  const { t } = useI18n();
  // The search also matches the name a category shows, so a built-in category answers to its name in the interface language.
  const expenseLook = useCategoryLookOf('expense'), incomeLook = useCategoryLookOf('income');
  const entries = useMemo(() => snapshot ? selectEntries(snapshot.entries, snapshot.accounts, filter, query, undefined,
    entry => (entry.kind === 'income' ? incomeLook : expenseLook)(entry.category).label) : [], [snapshot, filter, query, expenseLook, incomeLook]);
  const transferWord = t('rows.transfer');
  const transfers = useMemo(() => snapshot && (filter === 'all' || filter === 'transfer') ? selectTransfers(snapshot.transfers ?? [], snapshot.accounts, query, undefined, transferWord) : [],
    [snapshot, filter, query, transferWord]);
  if (!snapshot) return null;
  const count = entries.length + transfers.length;
  const hasRecords = snapshot.entries.length + (snapshot.transfers?.length ?? 0) > 0;
  return <EntryList entries={entries} transfers={transfers} accounts={snapshot.accounts}
    header={hasRecords ? <View style={{ gap: 12, paddingTop: 4, paddingBottom: 4 }}>
      <Field label={t('activity.search')} placeholder={t('activity.searchPlaceholder')} value={query} onChangeText={setQuery}
        autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" />
      <Choices value={filter} onChange={setFilter}
        options={[{ value: 'all', label: t('activity.all') }, { value: 'expense', label: t('activity.expenses') }, { value: 'income', label: t('activity.incomes') },
          { value: 'transfer', label: t('activity.transfers') }]} />
      <AppText tertiary variant="caption" style={{ paddingHorizontal: 4 }}>{t('count.movements', { count })}</AppText>
    </View> : undefined}
    empty={hasRecords ? <EmptyState title={t('activity.noMatchesTitle')} icon="search-outline"
      detail={t('activity.noMatchesDetail')}
      action={<ActionButton label={t('activity.clearFilters')} secondary onPress={() => { setQuery(''); setFilter('all'); }} />} />
      : <EmptyState title={t('activity.emptyTitle')} icon="receipt-outline"
        detail={t('activity.emptyDetail')}
        action={<ActionButton label={snapshot.accounts.length ? t('nav.recordMovement') : t('common.addAccount')}
          onPress={() => router.push(snapshot.accounts.length ? '/new-entry' : '/new-account')} />} />} />;
}
