import { useMemo } from 'react';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, EmptyState } from '../src/ui/components';
import { EntryList } from '../src/ui/entry-list';

export default function UndoneEntriesScreen() {
  const { archive } = useLedger();
  const entries = useMemo(() => archive?.records.filter(record => record.voided).map(record => record.entry) ?? [], [archive]);
  return <EntryList entries={entries} accounts={archive?.accounts ?? []}
    header={<AppText secondary style={{ fontSize: 15, paddingBottom: 8 }}>Estos movimientos no cuentan en tus saldos ni reportes. Abrí uno para recuperarlo.</AppText>}
    empty={<EmptyState title="Nada para recuperar" detail="Los movimientos que deshagas quedarán acá. No se eliminan definitivamente." icon="arrow-undo-outline" />} />;
}
