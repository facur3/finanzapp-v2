import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useI18n } from '../../src/i18n/provider';
import { useLedger } from '../../src/storage/LedgerProvider';
import { CardForm } from '../../src/ui/card-form';
import { EmptyState, IconButton, Screen } from '../../src/ui/components';

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { archive } = useLedger();
  const { t } = useI18n();
  const card = archive?.cards?.find(item => item.id === id);
  // 25Q4: the modal keeps a close button when there is nothing to edit (the same close as the form's).
  const closeButton = <Stack.Screen options={{ headerLeft: () => <IconButton name="close" label={t('common.close')}
    onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/cards'); }} /> }} />;
  if (!card) return <Screen>{closeButton}<EmptyState title={t('cards.panel.notFoundTitle')}
    detail={t('cards.panel.notFoundDetail')} icon="card-outline" /></Screen>;
  // 25B2: a deleted card is never edited again; its detail and its history stay readable.
  if (card.deleted) return <Screen>{closeButton}<EmptyState title={t('cards.panel.deletedTitle')} detail={t('cards.panel.deletedDetail')} icon="card-outline" /></Screen>;
  return <CardForm key={id} original={card} />;
}
