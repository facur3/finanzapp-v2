import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { categoryCatalog, type CategoryCatalogRow, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, CategoryBadge, IconButton, PressFeedback, Screen, SectionTitle, Surface } from '../src/ui/components';
import { usePalette } from '../src/ui/theme';

/** Every category the app knows, per kind: the presets (decorated when the
 * user changed them), the custom ones and the historical strings typed before
 * this existed, each with its recorded use. Tapping a row edits its look or
 * archives it; nothing here rewrites a movement. Archived categories sit in
 * their own quiet group so history stays understandable. */
export default function CategoriesScreen() {
  const { snapshot, archive } = useLedger();
  const definitions = archive?.categories ?? [];
  const expense = useMemo(() => snapshot ? categoryCatalog('expense', definitions, snapshot.entries) : [], [snapshot, definitions]);
  const income = useMemo(() => snapshot ? categoryCatalog('income', definitions, snapshot.entries) : [], [snapshot, definitions]);
  if (!snapshot) return null;
  const archived = [...expense, ...income].filter(row => row.identity.archived);
  return <Screen>
    <Stack.Screen options={{ headerRight: () => <IconButton name="add" label="Nueva categoría" onPress={() => router.push('/new-category')} /> }} />
    <AppText secondary variant="subhead">
      Tocá una categoría para cambiar su nombre, ícono o color, o para archivarla. Los movimientos anteriores nunca cambian.
    </AppText>
    <CatalogSection title="Gastos" kind="expense" rows={expense.filter(row => !row.identity.archived)} />
    <CatalogSection title="Ingresos" kind="income" rows={income.filter(row => !row.identity.archived)} />
    {archived.length > 0 && <CatalogSection title="Archivadas" caption="No se ofrecen al registrar; los movimientos que las usan siguen igual." rows={archived} />}
  </Screen>;
}

function usage(row: CategoryCatalogRow): string {
  const count = row.count === 0 ? null : `${row.count} ${row.count === 1 ? 'movimiento' : 'movimientos'}`;
  const source = row.identity.source === 'preset' ? (row.identity.definition ? 'Predeterminada · editada' : 'Predeterminada')
    : row.identity.source === 'custom' ? 'Propia' : 'Histórica';
  return [count, source].filter(Boolean).join(' · ');
}

function CatalogSection({ title, caption, kind, rows }: { title: string; caption?: string; kind?: EntryKind; rows: CategoryCatalogRow[] }) {
  const p = usePalette();
  if (!rows.length) return null;
  return <View>
    <SectionTitle caption={caption}>{title}</SectionTitle>
    <Surface grouped>
      {rows.map((row, index) => <PressFeedback key={row.identity.kind + '|' + row.identity.key} feedback="highlight" accessibilityRole="button"
        accessibilityLabel={row.identity.label + ', ' + usage(row) + (row.identity.archived ? ', archivada' : '')}
        accessibilityHint="Edita el nombre, el ícono y el color"
        onPress={() => router.push({ pathname: '/edit-category', params: { kind: row.identity.kind, key: row.identity.key } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10,
          borderBottomColor: p.line, borderBottomWidth: index === rows.length - 1 ? 0 : 0.5, opacity: row.identity.archived ? 0.6 : 1 }}>
        <CategoryBadge category={row.identity.storedLabel} kind={kind ?? row.identity.kind} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText numberOfLines={1} style={{ fontWeight: '500' }}>{row.identity.label}</AppText>
          <AppText secondary variant="footnote">{usage(row)}{kind ? '' : row.identity.kind === 'income' ? ' · Ingreso' : ' · Gasto'}</AppText>
        </View>
      </PressFeedback>)}
    </Surface>
  </View>;
}
