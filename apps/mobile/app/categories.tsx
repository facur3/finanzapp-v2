import { useMemo } from 'react';
import { View } from 'react-native';
import { useLedger } from '../src/storage/LedgerProvider';
import { categoryCatalog, type CategoryCatalogRow } from '../src/ui/categories';
import { AppText, CategoryBadge, Screen, SectionTitle, Surface } from '../src/ui/components';
import { usePalette } from '../src/ui/theme';

/** Read-only for now: the default categories and every category the person
 * wrote when recording, with how many recorded movements use each. Renaming,
 * merging and archiving are the next dedicated phase; until then a movement
 * keeps its category string exactly as it was saved. */
export default function CategoriesScreen() {
  const { snapshot } = useLedger();
  const expense = useMemo(() => snapshot ? categoryCatalog(snapshot.entries, 'expense') : [], [snapshot]);
  const income = useMemo(() => snapshot ? categoryCatalog(snapshot.entries, 'income') : [], [snapshot]);
  if (!snapshot) return null;
  return <Screen>
    <AppText secondary variant="subhead">
      Las categorías predeterminadas y las que escribiste al registrar. Editarlas, combinarlas o archivarlas llega en una próxima etapa;
      mientras tanto cada movimiento conserva el nombre tal como lo guardaste.
    </AppText>
    <CatalogSection title="Gastos" rows={expense} />
    <CatalogSection title="Ingresos" rows={income} />
  </Screen>;
}

function CatalogSection({ title, rows }: { title: string; rows: CategoryCatalogRow[] }) {
  const p = usePalette();
  const usage = (row: CategoryCatalogRow) => row.count === 0 ? 'Predeterminada'
    : `${row.count} ${row.count === 1 ? 'movimiento' : 'movimientos'}${row.preset ? '' : ' · Propia'}`;
  return <View>
    <SectionTitle>{title}</SectionTitle>
    <Surface grouped>
      {rows.map((row, index) => <View key={row.label} accessible accessibilityLabel={row.label + ', ' + usage(row)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10,
          borderBottomColor: p.line, borderBottomWidth: index === rows.length - 1 ? 0 : 0.5 }}>
        <CategoryBadge category={row.label} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText numberOfLines={1} style={{ fontWeight: '500' }}>{row.label}</AppText>
          <AppText secondary variant="footnote">{usage(row)}</AppText>
        </View>
      </View>)}
    </Surface>
  </View>;
}
