import { useMemo } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { categoryCatalog, type CategoryCatalogRow, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, CategoryBadge, IconButton, PressFeedback, Screen, SectionTitle, Surface } from '../src/ui/components';
import { usePalette } from '../src/ui/theme';
import { localizedCategoryLabel } from '../src/ui/appearance';
import { useI18n } from '../src/i18n/provider';
import type { Translate } from '../src/i18n/messages';

/** Every category the app knows, per kind: the presets (decorated when the
 * user changed them), the custom ones and the historical strings typed before
 * this existed, each with its recorded use. Tapping a row edits its look or
 * archives it; nothing here rewrites a movement. Archived categories sit in
 * their own quiet group so history stays understandable. */
export default function CategoriesScreen() {
  const { snapshot, archive } = useLedger();
  const { t } = useI18n();
  const definitions = archive?.categories ?? [];
  const expense = useMemo(() => snapshot ? categoryCatalog('expense', definitions, snapshot.entries) : [], [snapshot, definitions]);
  const income = useMemo(() => snapshot ? categoryCatalog('income', definitions, snapshot.entries) : [], [snapshot, definitions]);
  if (!snapshot) return null;
  const archived = [...expense, ...income].filter(row => row.identity.archived);
  return <Screen>
    <Stack.Screen options={{ headerRight: () => <IconButton name="add" label={t('nav.titles.newCategory')} onPress={() => router.push('/new-category')} /> }} />
    <AppText secondary variant="subhead">
      {t('categoryManager.list.intro')}
    </AppText>
    <CatalogSection title={t('categoryManager.list.expenses')} kind="expense" rows={expense.filter(row => !row.identity.archived)} />
    <CatalogSection title={t('categoryManager.list.incomes')} kind="income" rows={income.filter(row => !row.identity.archived)} />
    {archived.length > 0 && <CatalogSection title={t('categoryManager.list.archived')} caption={t('categoryManager.list.archivedCaption')} rows={archived} />}
  </Screen>;
}

function usage(row: CategoryCatalogRow, t: Translate): string {
  const count = row.count === 0 ? null : t('count.movements', { count: row.count });
  const source = t(row.identity.source === 'preset' ? (row.identity.definition ? 'categoryManager.list.source.presetEdited' : 'categoryManager.list.source.preset')
    : row.identity.source === 'custom' ? 'categoryManager.list.source.custom' : 'categoryManager.list.source.historical');
  return [count, source].filter(Boolean).join(' · ');
}

function CatalogSection({ title, caption, kind, rows }: { title: string; caption?: string; kind?: EntryKind; rows: CategoryCatalogRow[] }) {
  const p = usePalette();
  const { t, language } = useI18n();
  if (!rows.length) return null;
  return <View>
    <SectionTitle caption={caption}>{title}</SectionTitle>
    <Surface grouped>
      {rows.map((row, index) => { const name = localizedCategoryLabel(row.identity, language), used = usage(row, t);
        return <PressFeedback key={row.identity.kind + '|' + row.identity.key} feedback="highlight" accessibilityRole="button"
        accessibilityLabel={t(row.identity.archived ? 'categoryManager.list.rowLabelArchived' : 'categoryManager.list.rowLabel', { name, usage: used })}
        accessibilityHint={t('categoryManager.list.rowHint')}
        onPress={() => router.push({ pathname: '/edit-category', params: { kind: row.identity.kind, key: row.identity.key } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10,
          borderBottomColor: p.line, borderBottomWidth: index === rows.length - 1 ? 0 : 0.5, opacity: row.identity.archived ? 0.6 : 1 }}>
        <CategoryBadge category={row.identity.storedLabel} kind={kind ?? row.identity.kind} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText numberOfLines={2} style={{ fontWeight: '500' }}>{name}</AppText>
          <AppText secondary variant="footnote">{used}{kind ? '' : ' · ' + t(row.identity.kind === 'income' ? 'movement.income' : 'movement.expense')}</AppText>
        </View>
      </PressFeedback>; })}
    </Surface>
  </View>;
}
