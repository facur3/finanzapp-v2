import { router, Stack, useLocalSearchParams } from 'expo-router';
import { categoryCatalog, planFinancingCategories, resolveCategory } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { CategoryForm } from '../src/ui/category-form';
import { EmptyState, IconButton, Screen } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';

/** Edit one identity `(kind, key)`. A preset or a historical string has no
 * stored definition yet: the form adopts it with the spelling movements carry. */
export default function EditCategoryScreen() {
  const { kind, key } = useLocalSearchParams<{ kind?: string; key?: string }>();
  const { snapshot, archive } = useLedger();
  const { t } = useI18n();
  const entryKind = kind === 'income' ? 'income' : 'expense';
  const definitions = archive?.categories ?? [];
  const row = snapshot && key ? categoryCatalog(entryKind, definitions, snapshot.entries, planFinancingCategories(archive?.installmentPlans)).find(item => item.identity.key === key) : undefined;
  const identity = row?.identity ?? (key && resolveCategory(entryKind, key, definitions).source !== 'historical' ? resolveCategory(entryKind, key, definitions) : undefined);
  // 24UX6E: the modal keeps its close button when there is nothing to edit (the same close as the form's).
  if (!identity) return <Screen>
    <Stack.Screen options={{ headerLeft: () => <IconButton name="close" label={t('common.close')}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/categories'); }} /> }} />
    <EmptyState title={t('categoryManager.notFound.title')} detail={t('categoryManager.notFound.detail')} icon="pricetags-outline" />
  </Screen>;
  return <CategoryForm key={entryKind + '|' + key} original={identity} />;
}
