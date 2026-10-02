import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { categoryCatalog, planFinancingCategories, type CategoryCatalogRow, type EntryKind } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { AppText, CategoryBadge, IconButton, PressFeedback, Screen, SectionTitle, Surface, useStacked } from '../src/ui/components';
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
  // 24T2: a latent preset (Intereses) is listed once a movement, a definition or a saved plan with interest uses it.
  const inUse = useMemo(() => planFinancingCategories(archive?.installmentPlans), [archive?.installmentPlans]);
  const expense = useMemo(() => snapshot ? categoryCatalog('expense', definitions, snapshot.entries, inUse) : [], [snapshot, definitions, inUse]);
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

/** 24UX6E: a row on the Forest row geometry (16 × 12, 64 pt minimum, hairline). It opens a modal editor, so it carries
 * no chevron (a chevron promises a push). An archived row is never dimmed: its group, its caption and the spoken
 * «archivada» carry the state; it leads with its kind, which the Archivadas group mixes. At accessibility text sizes a
 * name wraps instead of being cut. */
function CatalogSection({ title, caption, kind, rows }: { title: string; caption?: string; kind?: EntryKind; rows: CategoryCatalogRow[] }) {
  const p = usePalette();
  const { t, language } = useI18n();
  const stacked = useStacked();
  if (!rows.length) return null;
  return <View>
    <SectionTitle caption={caption}>{title}</SectionTitle>
    <Surface grouped>
      {rows.map((row, index) => { const name = localizedCategoryLabel(row.identity, language), used = usage(row, t), archived = row.identity.archived;
        const income = row.identity.kind === 'income';
        // Only the Archivadas group (no `kind`) names the kind: visibly capitalised first, spoken as a word in the sentence.
        const detail = kind ? used : [t(income ? 'movement.income' : 'movement.expense'), used].filter(Boolean).join(' · ');
        return <PressFeedback key={row.identity.kind + '|' + row.identity.key} feedback="highlight" accessibilityRole="button"
        accessibilityLabel={archived ? t('categoryManager.list.rowLabelArchived', { name, kind: t(income ? 'movement.incomeWord' : 'movement.expenseWord'), usage: used })
          : t('categoryManager.list.rowLabel', { name, usage: used })}
        accessibilityHint={t(archived ? 'categoryManager.list.rowHintArchived' : 'categoryManager.list.rowHint')}
        onPress={() => router.push({ pathname: '/edit-category', params: { kind: row.identity.kind, key: row.identity.key } })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64,
          borderBottomColor: p.line, borderBottomWidth: index === rows.length - 1 ? 0 : StyleSheet.hairlineWidth }}>
        <CategoryBadge category={row.identity.storedLabel} kind={kind ?? row.identity.kind} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AppText numberOfLines={stacked ? undefined : 2} style={{ fontWeight: '500' }}>{name}</AppText>
          <AppText secondary variant="footnote">{detail}</AppText>
        </View>
      </PressFeedback>; })}
    </Surface>
  </View>;
}
