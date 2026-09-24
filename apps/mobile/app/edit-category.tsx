import { useLocalSearchParams } from 'expo-router';
import { categoryCatalog, resolveCategory } from '@finanzapp/domain';
import { useLedger } from '../src/storage/LedgerProvider';
import { CategoryForm } from '../src/ui/category-form';
import { EmptyState, Screen } from '../src/ui/components';
import { useI18n } from '../src/i18n/provider';

/** Edit one identity `(kind, key)`. A preset or a historical string has no
 * stored definition yet: the form adopts it with the spelling movements carry. */
export default function EditCategoryScreen() {
  const { kind, key } = useLocalSearchParams<{ kind?: string; key?: string }>();
  const { snapshot, archive } = useLedger();
  const { t } = useI18n();
  const entryKind = kind === 'income' ? 'income' : 'expense';
  const definitions = archive?.categories ?? [];
  const row = snapshot && key ? categoryCatalog(entryKind, definitions, snapshot.entries).find(item => item.identity.key === key) : undefined;
  const identity = row?.identity ?? (key && resolveCategory(entryKind, key, definitions).source !== 'historical' ? resolveCategory(entryKind, key, definitions) : undefined);
  if (!identity) return <Screen><EmptyState title={t('categoryManager.notFound.title')} detail={t('categoryManager.notFound.detail')} icon="pricetags-outline" /></Screen>;
  return <CategoryForm key={entryKind + '|' + key} original={identity} />;
}
