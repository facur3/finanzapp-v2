import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { ActionButton, AppText, Choices, EmptyState, Field } from '../../src/ui/components';
import { EntryList } from '../../src/ui/entry-list';
import { selectEntries, selectTransfers, type EntryFilter } from '../../src/ui/presentation';

export default function ActivityScreen() {
  const { snapshot } = useLedger();
  const [filter, setFilter] = useState<EntryFilter>('all');
  const [query, setQuery] = useState('');
  const entries = useMemo(() => snapshot ? selectEntries(snapshot.entries, snapshot.accounts, filter, query) : [], [snapshot, filter, query]);
  const transfers = useMemo(() => snapshot && filter === 'all' ? selectTransfers(snapshot.transfers ?? [], snapshot.accounts, query) : [], [snapshot, filter, query]);
  if (!snapshot) return null;
  const count = entries.length + transfers.length;
  const hasRecords = snapshot.entries.length + (snapshot.transfers?.length ?? 0) > 0;
  return <EntryList entries={entries} transfers={transfers} accounts={snapshot.accounts}
    header={hasRecords ? <View style={{ gap: 16, paddingTop: 4, paddingBottom: 8 }}>
      <Field label="Buscar movimientos" placeholder="Concepto, categoría o cuenta" value={query} onChangeText={setQuery}
        autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" />
      <Choices value={filter} onChange={setFilter}
        options={[{ value: 'all', label: 'Todos' }, { value: 'expense', label: 'Gastos' }, { value: 'income', label: 'Ingresos' }]} />
      <AppText secondary style={{ fontSize: 13 }}>{count === 1 ? '1 movimiento' : count + ' movimientos'}</AppText>
    </View> : undefined}
    empty={hasRecords ? <EmptyState title="Sin coincidencias" icon="search-outline"
      detail="Probá con otro concepto, categoría o cuenta."
      action={<ActionButton label="Limpiar filtros" secondary onPress={() => { setQuery(''); setFilter('all'); }} />} />
      : <EmptyState title="Tu actividad, en un lugar" icon="receipt-outline"
        detail="Tus gastos, ingresos y transferencias se ordenan acá por fecha."
        action={<ActionButton label={snapshot.accounts.length ? 'Registrar movimiento' : 'Agregar cuenta'}
          onPress={() => router.push(snapshot.accounts.length ? '/new-entry' : '/new-account')} />} />} />;
}
