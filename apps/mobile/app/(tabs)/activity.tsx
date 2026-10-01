import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, SearchField } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries, selectTransfers, type EntryFilter } from '../../src/ui/presentation';
import { useCategoryLookOf } from '../../src/ui/category-hues';
import { useI18n } from '../../src/i18n/provider';

/** Movimientos: everything recorded, newest first, by day (Producto 24UX6C, Forest). The search pill, the kind filter
 * (Todos, Gastos, Ingresos, Transf.) and the count, then each day as a heading with its net and the day's movements in
 * one grouped surface. Recording is the dock's «+» (no «+» of its own in the header); a row opens its detail, where
 * Deshacer and Recuperar live. Amounts follow movement-amount.ts: no sign on an expense, «+» on an income, a transfer
 * in its own tone; a day's net keeps its sign, which is a computed meaning. */
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
  const count = entries.length + transfers.length;
  // VoiceOver hears the new count once the search or the filter settles (iOS has no live regions): after a short pause
  // while typing, at once for a filter; never on the first render or when only the ledger changes. The tab stays mounted
  // under other tabs and pushed screens, so a pending announcement is cancelled when Movimientos loses focus (Codex,
  // PR #72): it never speaks over another screen.
  const asked = useRef({ query, filter });
  const focused = useRef(true);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the announcement says is read when it fires: the count of that moment, in the language of that moment.
  const latest = useRef({ count, t });
  latest.current = { count, t };
  const cancel = () => { if (pending.current) clearTimeout(pending.current); pending.current = null; };
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; cancel(); };
  }, []));
  useEffect(() => {
    if (asked.current.query === query && asked.current.filter === filter) return;
    asked.current = { query, filter };
    cancel();
    if (!focused.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      if (focused.current) AccessibilityInfo.announceForAccessibility(latest.current.t('count.movements', { count: latest.current.count }));
    }, query ? 700 : 0);
  }, [query, filter]);
  useEffect(() => cancel, []);
  if (!snapshot) return null;
  const hasRecords = snapshot.entries.length + (snapshot.transfers?.length ?? 0) > 0;
  return <EntryList entries={entries} transfers={transfers} accounts={snapshot.accounts}
    header={hasRecords ? <View style={{ gap: 14, paddingTop: 4 }}>
      <SearchField label={t('activity.search')} placeholder={t('activity.searchPlaceholder')} value={query} onChangeText={setQuery} />
      <Choices value={filter} onChange={setFilter}
        options={[{ value: 'all', label: t('activity.all') }, { value: 'expense', label: t('activity.expenses') }, { value: 'income', label: t('activity.incomes') },
          { value: 'transfer', label: t('activity.transfers') }]} />
      <AppText secondary variant="footnote" style={{ paddingHorizontal: 4 }}>{t('count.movements', { count })}</AppText>
    </View> : undefined}
    empty={hasRecords ? <EmptyState title={t('activity.noMatchesTitle')} icon="search-outline"
      detail={t('activity.noMatchesDetail')}
      action={<ActionButton label={t('activity.clearFilters')} secondary onPress={() => { setQuery(''); setFilter('all'); }} />} />
      : <EmptyState title={t('activity.emptyTitle')} icon="receipt-outline"
        detail={t('activity.emptyDetail')}
        action={<ActionButton label={snapshot.accounts.length ? t('nav.recordMovement') : t('common.addAccount')}
          onPress={() => router.push(snapshot.accounts.length ? '/new-entry' : '/new-account')} />} />} />;
}
