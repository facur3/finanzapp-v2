import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useLedger } from '../../src/storage/LedgerProvider';
import { EmptyState, IconButton, Screen } from '../../src/ui/components';
import { RecurringForm } from '../../src/ui/recurring-form';
import { useI18n } from '../../src/i18n/provider';

export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const rule = archive?.recurring?.find(item => item.id === id);
  // A deleted rule (24UX4) opens as not found; one this screen has ever shown live (the ledger may hydrate after the
  // screen mounts) keeps its form, locked, while the screen closes after its own deletion. Keyed by id: another
  // rule in the same screen starts over. Set during render, React's pattern for information from previous renders.
  const [seenLiveId, setSeenLiveId] = useState<string | null>(null);
  if (rule && !rule.deleted && seenLiveId !== rule.id) setSeenLiveId(rule.id);
  // 24UX6E: the modal keeps its close button when there is nothing to edit (the same close as the form's).
  if (!rule || (rule.deleted && seenLiveId !== rule.id)) return <Screen>
    <Stack.Screen options={{ headerLeft: () => <IconButton name="close" label={t('common.close')}
      onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/recurring'); }} /> }} />
    <EmptyState title={t('recurring.edit.notFoundTitle')} detail={t('recurring.edit.notFoundDetail')} icon="repeat-outline" />
  </Screen>;
  return <RecurringForm original={rule} />;
}
